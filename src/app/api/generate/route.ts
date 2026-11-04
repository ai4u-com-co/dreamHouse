import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { prepareEditMask, blendEditedOntoBase, type PreparedEditMask } from '@/lib/edit-mask';
import { embedImageMetadata, pickEmbeddableParams, METADATA_APP, METADATA_VERSION, type DreamHouseImageMetadata } from '@/lib/image-metadata';
import { DreamHouseParams } from '@/types';
import { getOpenAIImageSettings, type OpenAIImageQuality } from '@/lib/openai-image-settings';
import { lookup } from '@/lib/safe-lookup';
import { normalizeRenderSettings } from '@/lib/render-settings';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';
import { authenticate, charge, chargeFailure, noChargeNote, refund, renderCredits, type Charge } from '@/lib/billing';

// Vercel configuration: maxDuration only works on Pro plan, but it's the correct way to declare it
// Hobby plan has 10s limit, Pro plan allows up to 300s
export const maxDuration = 120; // Increased to 120s to allow for image generation and thinking time

// Constants for validation
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100MB per image
const MAX_TOTAL_PAYLOAD_SIZE = 100 * 1024 * 1024; // 100MB total payload
const MAX_REFERENCE_IMAGES = 14; // Nano Banana 2 support up to 14
const OPENAI_MAX_INPUT_IMAGES = 17; // tope de imágenes de entrada de GPT Image 2.5

// Base + máscara de edición: el cliente las exporta como PNG de hasta 2048 px por lado
const EDIT_MASK_MAX_SIDE = 2048;
const EDIT_MASK_MAX_BYTES = 25 * 1024 * 1024; // por archivo
const EDIT_MASK_MAX_PIXELS = EDIT_MASK_MAX_SIDE * EDIT_MASK_MAX_SIDE;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// La imagen que devuelve OpenAI puede llegar a 8,3 MP (límite de la API)
const OPENAI_RESULT_MAX_PIXELS = 8_500_000;

// Valida el par base + máscara en el servidor (no se confía en el tipo MIME ni en los límites del cliente):
// firma PNG real, límite de bytes, límite de píxeles ANTES de decodificar, y mismas dimensiones.
async function validateEditMaskPair(baseFile: File, maskFile: File): Promise<string | null> {
  const dims: Array<{ width: number; height: number }> = [];
  for (const [file, label] of [[baseFile, 'Edit base image'], [maskFile, 'Edit mask']] as const) {
    if (file.size > EDIT_MASK_MAX_BYTES) {
      return `${label} exceeds maximum size of ${EDIT_MASK_MAX_BYTES / 1024 / 1024}MB.`;
    }
    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length < PNG_SIGNATURE.length || !buf.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
      return `${label} must be a PNG.`;
    }
    try {
      const meta = await sharp(buf, { limitInputPixels: EDIT_MASK_MAX_PIXELS }).metadata();
      if (meta.format !== 'png' || !meta.width || !meta.height) {
        return `${label} must be a PNG.`;
      }
      if (meta.width > EDIT_MASK_MAX_SIDE || meta.height > EDIT_MASK_MAX_SIDE) {
        return `${label} exceeds ${EDIT_MASK_MAX_SIDE}px per side.`;
      }
      dims.push({ width: meta.width, height: meta.height });
    } catch {
      return `${label} is not a valid image or is too large.`;
    }
  }
  if (dims[0].width !== dims[1].width || dims[0].height !== dims[1].height) {
    return 'Edit base image and mask must have identical dimensions.';
  }
  return null;
}

// Qué archivos usa cada módulo. `lotImage` es el archivo "principal" y significa algo distinto en cada uno:
// exterior = foto del terreno · interior = foto del espacio actual · vistas = la casa a fotografiar.
const INPUTS_BY_MODE: Record<string, { lot: boolean; exteriorRef: boolean; floorPlan: boolean; files: boolean; objects: boolean }> = {
  exterior: { lot: true, exteriorRef: true, floorPlan: true, files: true, objects: false },
  interior: { lot: true, exteriorRef: false, floorPlan: true, files: true, objects: true },
  vistas: { lot: true, exteriorRef: false, floorPlan: false, files: false, objects: false },
  edit: { lot: false, exteriorRef: false, floorPlan: false, files: false, objects: false },
};

// Incrusta los metadatos en una imagen en data URL (JPEG/PNG). Si no es data URL o falla, la devuelve igual.
function embedMetadataInDataUrl(dataUrl: string, meta: DreamHouseImageMetadata): string {
  const match = /^data:(image\/[a-z]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return dataUrl;
  const embedded = embedImageMetadata(new Uint8Array(Buffer.from(match[2], 'base64')), meta);
  return `data:${match[1]};base64,${Buffer.from(embedded).toString('base64')}`;
}

// Helper function to validate image size
function validateImageSize(file: File, fieldName: string, skipSizeLimit: boolean = false): { valid: boolean; error?: string } {
  if (!skipSizeLimit && file.size > MAX_IMAGE_SIZE) {
    return {
      valid: false,
      error: `${fieldName} exceeds maximum size of ${MAX_IMAGE_SIZE / 1024 / 1024}MB. Current size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
    };
  }
  if (!file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `${fieldName} must be an image file. Received: ${file.type}`
    };
  }
  return { valid: true };
}

// Formato de salida de OpenAI: JPEG es más rápido que PNG y mantiene la respuesta
// por debajo del límite de 4,5 MB del cuerpo de respuesta de una función de Vercel.
const OPENAI_OUTPUT_FORMAT = 'jpeg' as const;
const OPENAI_OUTPUT_COMPRESSION = 95;

// La máscara de OpenAI es una guía, no una garantía: el modelo puede tocar fuera de la zona.
// Para que lo no marcado quede idéntico píxel a píxel, se compone el resultado sobre la imagen
// original. El trazo del usuario es aproximado, así que ni se entrega literal ni se corta en seco:
// la zona se amplía un margen y el borde se mezcla con un degradado proporcional a la imagen
// (ver src/lib/edit-mask.ts), para que el cambio se acomode a la arquitectura y no deje costura.

// Prepara la máscara ampliada (para el modelo) y el peso de mezcla. Devuelve null si no se puede
// (p. ej. imagen ilegible): se usa entonces la máscara tal como la dibujó el usuario.
async function prepareMaskedEdit(baseFile: File, maskFile: File): Promise<PreparedEditMask | null> {
  try {
    const baseBuf = Buffer.from(await baseFile.arrayBuffer());
    const maskBuf = Buffer.from(await maskFile.arrayBuffer());
    const baseMeta = await sharp(baseBuf, { limitInputPixels: EDIT_MASK_MAX_PIXELS }).metadata();
    if (!baseMeta.width || !baseMeta.height) return null;
    return await prepareEditMask(maskBuf, baseMeta.width, baseMeta.height, EDIT_MASK_MAX_PIXELS);
  } catch (error) {
    console.error('Edit mask preparation failed, using the mask as drawn:', error);
    return null;
  }
}

// Compone el resultado del modelo sobre la imagen original con el peso de mezcla preparado.
// Devuelve null si no se puede componer (p. ej. la relación de aspecto cambió): se usa entonces
// la imagen del modelo tal cual.
async function compositeMaskedEdit(baseFile: File, prepared: PreparedEditMask, resultBase64: string): Promise<string | null> {
  try {
    const baseBuf = Buffer.from(await baseFile.arrayBuffer());
    const resultBuf = Buffer.from(resultBase64, 'base64');
    const resultMeta = await sharp(resultBuf, { limitInputPixels: OPENAI_RESULT_MAX_PIXELS }).metadata();
    if (!resultMeta.width || !resultMeta.height) return null;
    if (Math.abs(resultMeta.width / resultMeta.height - prepared.width / prepared.height) > 0.01) return null;

    const final = await blendEditedOntoBase(
      baseBuf,
      resultBuf,
      prepared,
      { base: EDIT_MASK_MAX_PIXELS, result: OPENAI_RESULT_MAX_PIXELS },
      OPENAI_OUTPUT_COMPRESSION,
    );
    return final.toString('base64');
  } catch (error) {
    console.error('Masked edit compositing failed, using model output as is:', error);
    return null;
  }
}

// Helper function to calculate a valid size parameter for GPT Image (2 / 2.5)
function getGptImage2Size(aspectRatio: string, resolutionPreset: string): string {
  let widthRatio = 16;
  let heightRatio = 9;

  if (aspectRatio && aspectRatio.includes(':')) {
    const parts = aspectRatio.split(':');
    widthRatio = parseInt(parts[0], 10) || 16;
    heightRatio = parseInt(parts[1], 10) || 9;
  }

  // La API exige una relación de aspecto entre 1:3 y 3:1
  const clampedRatio = Math.min(3, Math.max(1 / 3, widthRatio / heightRatio));
  widthRatio = clampedRatio;
  heightRatio = 1;

  // Target total pixels based on preset
  let targetPixels = 1024 * 1024; // Default "1K" (~1MP)
  if (resolutionPreset === "2K") {
    targetPixels = 2560 * 1440; // ~3.7MP
  } else if (resolutionPreset === "4K") {
    targetPixels = 3824 * 2144; // ~8.2MP (safe limit below 3840 edge size)
  } else if (resolutionPreset === "512") {
    targetPixels = 655360; // Minimum limit for gpt-image-2
  }

  const ratio = widthRatio / heightRatio;
  let h = Math.sqrt(targetPixels / ratio);
  let w = h * ratio;

  // Round dimensions to nearest multiple of 16
  w = Math.round(w / 16) * 16;
  h = Math.round(h / 16) * 16;

  // Enforce constraints:
  // 1. Max edge length must be less than 3840px (3824 is the highest multiple of 16 below 3840)
  if (w >= 3840) w = 3824;
  if (h >= 3840) h = 3824;

  // 2. Total pixels must not be less than 655,360
  while (w * h < 655360) {
    w += 16;
    h = Math.round((w / ratio) / 16) * 16;
  }

  // 3. Total pixels must not exceed 8,294,400
  while (w * h > 8294400) {
    w -= 16;
    h = Math.round((w / ratio) / 16) * 16;
  }

  return `${w}x${h}`;
}

// Helper function to calculate total payload size
function calculatePayloadSize(files: File[], lotImage: File | null, exteriorReferenceImage: File | null, floorPlanImage: File | null, editCompositeFile: File | null, paramsJson: string): number {
  let totalSize = paramsJson.length;
  files.forEach(file => totalSize += file.size);
  if (lotImage) totalSize += lotImage.size;
  if (exteriorReferenceImage) totalSize += exteriorReferenceImage.size;
  if (floorPlanImage) totalSize += floorPlanImage.size;
  if (editCompositeFile) totalSize += editCompositeFile.size;
  return totalSize;
}

export async function POST(req: NextRequest) {
  // Sin sesión de Google válida no se procesa nada (ni siquiera se lee el cuerpo): la clave de OpenAI es de Mariano.
  const auth = await authenticate(req.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHENTICATED', message: 'Inicia sesión para generar renders.' }, { status: 401 });
  }
  // Cobro de esta solicitud: si algo falla ANTES de entregar la imagen, el catch lo devuelve (el token no sale del servidor).
  let charged: Extract<Charge, { ok: true }> | null = null;
  let delivered = false;
  try {
    const formData = await req.formData();
    const paramsJson = formData.get('params') as string;
    
    if (!paramsJson) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const rawParams: unknown = JSON.parse(paramsJson);
    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) {
      return NextResponse.json({ message: 'Invalid parameters' }, { status: 400 });
    }
    // El cliente puede enviar cualquier cosa: se normalizan modelo, calidad, ratio y resolución, y lo que
    // falte usa los mismos predeterminados que la interfaz (GPT Image 2.5, calidad más baja y 16:9)
    const params = normalizeRenderSettings(rawParams as DreamHouseParams);
    // Gemini se retiró: normalizeRenderSettings solo deja pasar los modelos de GPT Image 2.5 (cualquier otro cae en el predeterminado)
    const useOpenAI = true;

    // La clave de OpenAI vive SOLO en el servidor (OPENAI_API_KEY en Vercel): el navegador no manda ninguna.
    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ code: 'SERVER_MISCONFIGURED', message: 'El servicio de imágenes no está configurado todavía.' }, { status: 500 });
    }
    const openaiClient = new OpenAI({ apiKey: openaiApiKey });

    // Cada módulo usa solo sus propios archivos: lo que quedó cargado de otro módulo no se envía.
    const modeInputs = lookup(INPUTS_BY_MODE, params.mode) ?? INPUTS_BY_MODE.exterior;
    const files = modeInputs.files ? (formData.getAll('files') as File[]) : [];
    const lotImage = modeInputs.lot ? (formData.get('lotImage') as File | null) : null;
    const exteriorReferenceImage = modeInputs.exteriorRef ? (formData.get('exteriorReferenceImage') as File | null) : null;
    const floorPlanImage = modeInputs.floorPlan ? (formData.get('floorPlanImage') as File | null) : null;
    const editCompositeFile = formData.get('editCompositeFile') as File | null;
    const objectImages = modeInputs.objects ? (formData.getAll('objectImages') as File[]) : [];
    const editBaseFile = formData.get('editBaseFile') as File | null;
    const editMaskFile = formData.get('editMaskFile') as File | null;

    // Validate number of reference images
    if (files.length > MAX_REFERENCE_IMAGES) {
      return NextResponse.json(
        { message: `Maximum ${MAX_REFERENCE_IMAGES} reference images allowed. Received: ${files.length}` },
        { status: 400 }
      );
    }

    // Validate individual image sizes
    for (const file of files) {
      const validation = validateImageSize(file, 'Reference image');
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }
    }

    const isEditMode = params.mode === 'edit';

    if (lotImage) {
      const validation = validateImageSize(lotImage, 'Lot image', isEditMode);
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }
    }
    
    if (exteriorReferenceImage) {
      const validation = validateImageSize(exteriorReferenceImage, 'Exterior reference image', isEditMode);
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }
    }

    if (floorPlanImage) {
      const validation = validateImageSize(floorPlanImage, 'Floor plan image', isEditMode);
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }
    }

    if (editCompositeFile) {
      const validation = validateImageSize(editCompositeFile, 'Edit Composite image', true);
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }
    }

    if (editBaseFile || editMaskFile) {
      if (!editBaseFile || !editMaskFile) {
        return NextResponse.json({ message: 'Edit base image and mask must be sent together.' }, { status: 400 });
      }
      const maskError = await validateEditMaskPair(editBaseFile, editMaskFile);
      if (maskError) {
        return NextResponse.json({ message: maskError }, { status: 400 });
      }
    }

    if (objectImages.length > 13) {
      return NextResponse.json({ message: 'Maximum 13 object images allowed.' }, { status: 400 });
    }
    for (const file of objectImages) {
      const validation = validateImageSize(file, 'Object image');
      if (!validation.valid) {
        return NextResponse.json({ message: validation.error }, { status: 400 });
      }
    }

    // Validate total payload size
    const totalPayloadSize = calculatePayloadSize(files, lotImage, exteriorReferenceImage, floorPlanImage, editCompositeFile, paramsJson);
    if (!isEditMode && totalPayloadSize > MAX_TOTAL_PAYLOAD_SIZE) {
      return NextResponse.json(
        {
          message: `Total payload size (${(totalPayloadSize / 1024 / 1024).toFixed(2)}MB) exceeds maximum allowed size of ${MAX_TOTAL_PAYLOAD_SIZE / 1024 / 1024}MB. Please reduce image sizes or number of images.`
        },
        { status: 413 }
      );
    }

    // --- NEW: Narrative Prompt Building ---
    let narrativePrompt = "";
    if (params.mode === 'interior') {
      narrativePrompt = buildInteriorPrompt(params, params.aiModel, !!lotImage);
    } else if (params.mode === 'exterior') {
      narrativePrompt = buildExteriorPrompt(params, !!exteriorReferenceImage, params.aiModel);
    } else if (params.mode === 'vistas') {
      narrativePrompt = buildVistasPrompt(params, params.viewType || 'Perspectiva Principal (Hero Shot)', params.aiModel);
    } else {
      narrativePrompt = `USER EDIT PROMPT: ${params.editPrompt}`;
    }

    // --- OpenAI: imágenes de entrada con su rol ---
    // La primera imagen es la base de la edición; cada una se describe por número en el prompt
    // (la API no recibe etiquetas como Gemini, así que el rol va dentro del texto).
    const openaiInputs: Array<{ file: File; role: string }> = [];
    if (useOpenAI) {
      if (params.mode === 'edit' && editBaseFile && editMaskFile) {
        openaiInputs.push({
          file: editBaseFile,
          role: "the original image to edit; the transparent area of the mask is approximately where the change belongs, and it must blend with the architecture around it",
        });
      } else if (params.mode === 'edit' && editCompositeFile) {
        openaiInputs.push({
          file: editCompositeFile,
          role: "the original image with the user's sketch and notes drawn on top; the drawings are edit instructions, not content to keep",
        });
      } else {
        const lotRole = params.mode === 'vistas'
          ? "the house to photograph (reference): the SAME house must appear, identical in form, materials and design; only the camera changes"
          : params.mode === 'interior'
            ? "the existing space to redesign: keep its architectural shell (walls, openings, ceiling height) and its camera viewpoint"
            : "the lot or terrain photo (site context to integrate the building into)";
        if (params.mode === 'vistas' && lotImage) {
          openaiInputs.push({ file: lotImage, role: lotRole });
        }
        if (exteriorReferenceImage) {
          openaiInputs.push({
            file: exteriorReferenceImage,
            role: "the existing house (structural base): keep its general volumes, shape and structure while applying the requested styles and materials",
          });
        }
        if (params.mode === 'interior' && lotImage) {
          openaiInputs.push({ file: lotImage, role: lotRole });
        }
        if (floorPlanImage) {
          openaiInputs.push({ file: floorPlanImage, role: "the floor plan (geometric reference for layout and proportions)" });
        }
        if (params.mode === 'exterior' && lotImage) {
          openaiInputs.push({ file: lotImage, role: lotRole });
        }
        // Interior puede sumar objetos (hasta 13) + espacio + plano + referencias: las referencias de estilo
        // ceden el sitio antes que las piezas, que "deben aparecer" en el resultado.
        const roomForReferences = Math.max(0, OPENAI_MAX_INPUT_IMAGES - openaiInputs.length - objectImages.length);
        const referenceRole = params.mode === 'interior'
          ? "a conceptual style reference (take mood, material palette, atmosphere and spatial feeling; do not copy specific rooms, furniture or compositions)"
          : "a conceptual style reference (take mood, material palette and proportions; do not copy specific buildings or facades)";
        files.slice(0, roomForReferences).forEach(file => openaiInputs.push({ file, role: referenceRole }));
        objectImages.forEach(file => openaiInputs.push({
          file,
          role: "a specific furniture piece or object that must appear in the final design; preserve its exact shape, color, material and design",
        }));
      }
    }
    const openaiMaskFile = useOpenAI && params.mode === 'edit' && editBaseFile && editMaskFile ? editMaskFile : null;
    // Máscara ampliada para el modelo + peso de mezcla del borde (la validada, dibujada por el usuario, queda de respaldo)
    const preparedMask = openaiMaskFile && editBaseFile ? await prepareMaskedEdit(editBaseFile, openaiMaskFile) : null;
    const maskForModel = preparedMask
      ? new File([new Uint8Array(preparedMask.modelMaskPng)], 'edit_mask.png', { type: 'image/png' })
      : openaiMaskFile;
    const openaiImageGuide = openaiInputs.length > 0
      ? `INPUT IMAGES:\n${openaiInputs.map((input, i) => `- Image ${i + 1}: ${input.role}.`).join('\n')}`
      : "";

    let mandate = "";
    if (useOpenAI) {
      if (params.mode === "interior") {
        mandate = ['INTERNAL SPATIAL MANDATE:',
          params.roomType ? `- Respect room functionality: ${params.roomType}.` : '',
          params.furnitureStyle.length ? `- Render furniture: ${params.furnitureStyle.join(', ')}.` : '',
          params.flooringMaterial || params.ceilingDetail
            ? `- ${[params.flooringMaterial && `Flooring: ${params.flooringMaterial}`, params.ceilingDetail && `Ceiling: ${params.ceilingDetail}`].filter(Boolean).join(', ')}.`
            : '',
          lotImage ? '- Redesign the existing space from the reference photo; keep its architectural shell and viewpoint.' : '',
        ].filter(Boolean).join('\n');
      } else if (params.mode === "exterior") {
        const structureMandate = exteriorReferenceImage 
          ? "PRESERVE general architectural volumes and facade structure from reference image."
          : "Adhere to the provided layout/floor plan geometry.";
        mandate = `ARCHITECTURAL EXTERIOR MANDATE:
- ${structureMandate}${params.levels > 0 ? `\n- Show exactly ${params.levels} floors.` : ''}`;
      } else if (params.mode === "vistas") {
        mandate = `ARCHITECTURAL PORTFOLIO MANDATE:
- Maintain design style, materials, and geometry identical to the reference image (Image 1 is the house).
- Do not restyle, redesign or add elements that are not implied by the reference.`;
      } else if (openaiMaskFile) {
        mandate = `IMAGE EDITING MANDATE (MASKED EDIT):
- Change only the masked area, following the edit instruction above.
- The mask was painted by hand, so its outline is APPROXIMATE: it marks where the change is wanted, not an exact cut line. Never reproduce the brush outline as a visible edge, halo, seam or tone shift.
- Let the change follow the architecture and logic of the space. Carry the new surface, material, color or object up to the natural boundaries nearby (wall corners, ceiling and floor lines, baseboards, window and door frames, joints between planes, furniture edges) and stop there, never in the middle of a continuous plane.
- Respect the original perspective and vanishing lines, the light direction and color temperature, the shadows and reflections, and the scale of the surroundings, so the edited area reads as part of the same space.
- Inside the thin band around the mask you may adjust slightly where it is needed to make the junction coherent. Everything beyond that band stays identical: camera angle, framing, perspective, lighting, materials, proportions, surrounding objects and resolution.`;
      } else {
        mandate = `IMAGE EDITING MANDATE (SURGICAL EDIT):
- Change only the areas marked or described in the user's sketch and notes.
- Keep everything else identical: camera angle, framing, perspective, lighting direction and color temperature, materials, proportions, surrounding objects, saturation, contrast and resolution.
- The sketch lines, arrows and notes drawn on the image are instructions only; they must not appear in the output.`;
      }
    } else {
      if (params.mode === "interior") {
        mandate = ['INTERNAL SPATIAL MANDATE:',
          '- This image is a professional interior design visualization. Scale, lighting, and texture are critical.',
          params.roomType ? `- Respect the functional logic of the specified room: ${params.roomType}.` : '',
          params.furnitureStyle.length || params.interiorLighting.length
            ? `- Ensure ${[params.furnitureStyle.length && `the furniture style (${params.furnitureStyle.join(', ')})`, params.interiorLighting.length && `the lighting (${params.interiorLighting.join(', ')})`].filter(Boolean).join(' and ')} are rendered with high fidelity.`
            : '',
          params.flooringMaterial || params.ceilingDetail
            ? `- Materiality: ${[params.flooringMaterial && `the floor (${params.flooringMaterial})`, params.ceilingDetail && `the ceiling (${params.ceilingDetail})`].filter(Boolean).join(' and ')} must define the vertical boundaries of the space.`
            : '',
          lotImage ? '- The CURRENT SPACE PHOTO is the base: redesign it, keeping its architectural shell (walls, openings, ceiling height) and viewpoint.' : '',
        ].filter(Boolean).join('\n');
      } else if (params.mode === "exterior") {
        const structureMandate = exteriorReferenceImage 
          ? "PRESERVE the fundamental architectural geometry, massing, and volumetric structure of the provided HOUSE REFERENCE IMAGE. Apply the requested styles and materials to this existing structure."
          : "Preserve the geometry of the provided floor plan if applicable.";
        mandate = `ARCHITECTURAL EXTERIOR MANDATE:
- This image is part of a professional architectural portfolio. Volumetric hierarchy is absolute.
- ${structureMandate}
- Integrate the building perfectly into the terrain/lot if provided.${params.levels > 0 ? `\n- Ensure exactly ${params.levels} floors are visible.` : ''}`;
      } else if (params.mode === "vistas") {
        mandate = `ARCHITECTURAL PORTFOLIO MANDATE:
- This is a consistent architectural portfolio generation.
- The reference image is the ABSOLUTE TRUTH for materials, geometry, and style.
- Change the camera angle and perspective according to the request, but DO NOT change the house design.`;
      } else {
        mandate = `IMAGE EDITING MANDATE:
- Using the provided image (which may include user sketches/notes as a guide), perform the requested edits.
- The user's sketch/notes drawn on the image are instructions/guides for what to change and where.
- Seamlessly integrate the changes, matching the original lighting, style, and perspective.`;
      }
    }

    let fullPrompt = "";
    if (useOpenAI) {
      // El constructor de prompt ya define estilo, luz, textura y exclusiones de composición;
      // aquí solo se agregan lo estructural (mandato), las exclusiones del usuario y las imágenes de entrada.
      const userExclusions = params.negativePrompt?.trim()
        ? `\n- Also avoid: ${params.negativePrompt.trim()}`
        : "";
      fullPrompt = `${openaiImageGuide ? `${openaiImageGuide}\n\n` : ""}${narrativePrompt}

[MANDATES & CONSTRAINTS]
${mandate}${userExclusions}
- No watermarks, logos or text inside the image.`.trim();
    }

    console.log("Generated Narrative Prompt:", fullPrompt);

    let imageUrl = "";
    let usedModel: string = 'gpt-image-2.5-sunburst';
    let usedQuality: string | undefined;
    let usedSize: string | undefined;
    const groundingMetadata = null; // se conserva en la respuesta por compatibilidad (antes venía de Gemini)

    if (useOpenAI && openaiClient) {
      const imageFiles = openaiInputs.map(input => input.file);
      // En edición el tamaño lo decide la imagen de entrada ("auto"): forzar 16:9 deformaría lo editado
      // Resolución máxima 2K: la respuesta de una función de Vercel no puede pasar de 4,5 MB
      const effectiveResolution = params.renderOutputResolution === '4K' ? '2K' : params.renderOutputResolution;
      const sizeStr = params.mode === 'edit' ? 'auto' : getGptImage2Size(params.renderAspectRatio, effectiveResolution);
      const requested = getOpenAIImageSettings(params.aiModel, params.renderQuality);
      const openaiModel = requested.model;
      const qualityVal: OpenAIImageQuality = requested.quality;

      // COBRO antes de llamar a OpenAI (atómico; los admin no pagan). Si OpenAI falla, el catch devuelve el cobro.
      const amount = renderCredits(qualityVal, effectiveResolution, params.mode);
      const c = await charge(auth.sb, amount, 'render', { mode: params.mode, quality: qualityVal, resolution: effectiveResolution || '1K', model: openaiModel });
      if (!c.ok) {
        const failure = chargeFailure(c);
        return NextResponse.json(failure.body, { status: failure.status });
      }
      charged = c;

      usedModel = openaiModel;
      usedQuality = qualityVal;
      usedSize = sizeStr;

      let result;
      if (imageFiles.length > 0) {
        console.log(`Editing/Compositing with OpenAI (${openaiModel}) using ${imageFiles.length} image files. Size: ${sizeStr}, Quality: ${qualityVal}`);
        result = await openaiClient.images.edit({
          model: openaiModel,
          image: imageFiles,
          ...(maskForModel ? { mask: maskForModel } : {}),
          prompt: fullPrompt,
          size: sizeStr as `${number}x${number}` | 'auto',
          quality: qualityVal,
          output_format: OPENAI_OUTPUT_FORMAT,
          output_compression: OPENAI_OUTPUT_COMPRESSION,
        });
      } else {
        console.log(`Generating text-to-image with OpenAI (${openaiModel}). Size: ${sizeStr}, Quality: ${qualityVal}`);
        result = await openaiClient.images.generate({
          model: openaiModel,
          prompt: fullPrompt,
          size: sizeStr as `${number}x${number}` | 'auto',
          quality: qualityVal,
          output_format: OPENAI_OUTPUT_FORMAT,
          output_compression: OPENAI_OUTPUT_COMPRESSION,
        });
      }

      const imageBase64 = result?.data?.[0]?.b64_json;
      const imageUrlResult = result?.data?.[0]?.url;
      if (imageBase64) {
        const composited = preparedMask && editBaseFile
          ? await compositeMaskedEdit(editBaseFile, preparedMask, imageBase64)
          : null;
        imageUrl = `data:image/${OPENAI_OUTPUT_FORMAT};base64,${composited ?? imageBase64}`;
      } else if (imageUrlResult) {
        imageUrl = imageUrlResult;
      } else {
         throw new Error("No image data or URL returned from OpenAI");
      }
    } else {
      throw new Error('OpenAI client is not initialized.');
    }

    // Nombre del proyecto: lo escribía Gemini (y solo con ese modelo); con GPT Image 2.5 siempre fue el predeterminado.
    const houseName = "DreamHouse Project";

    // --- Metadatos incrustados: los parámetros viajan dentro del archivo ---
    const metadataId = crypto.randomUUID();
    if (params.embedMetadata !== false) {
      imageUrl = embedMetadataInDataUrl(imageUrl, {
        app: METADATA_APP,
        version: METADATA_VERSION,
        id: metadataId,
        createdAt: new Date().toISOString(),
        mode: params.mode,
        model: usedModel,
        quality: usedQuality,
        size: usedSize,
        houseName,
        viewType: params.mode === 'vistas' ? params.viewType : undefined,
        parentId: params.sourceRender?.id,
        // Lista explícita de campos de diseño; ciudad, notas y prompt solo si el usuario lo permitió
        params: pickEmbeddableParams(params, !!params.embedDetails),
        prompt: params.embedDetails ? fullPrompt : undefined,
      });
    }

    delivered = true;
    return NextResponse.json({ imageUrl, groundingMetadata, houseName, metadataId, remaining: charged?.remaining });

  } catch (error: unknown) {
    console.error("API Error Detailed:", error);

    // Si ya se cobró y la imagen no llegó a entregarse, se devuelve el cobro (el token de devolución jamás sale del servidor).
    let remaining: number | undefined;
    let refunded = true;
    if (charged && !delivered) {
      const r = await refund(auth.sb, charged);
      remaining = r.remaining;
      refunded = r.refunded;
    }
    const note = charged ? noChargeNote(refunded) : '';

    let errorMessage = "Ocurrió un error inesperado al generar el render.";
    let statusCode = 500;
    let errorCode = "UNKNOWN_ERROR";

    if (error instanceof Error) {
      const sdkError = error as { status?: number; code?: string | number | null };
      const text = error.message;

      if (text.includes('Deadline expired') || text.includes('timeout') || text.includes('TIMEOUT') || text.includes('Timed out')) {
        errorMessage = "El tiempo de espera expiró: la generación tardó más de lo esperado.";
        statusCode = 504;
        errorCode = "TIMEOUT";
      } else if (text.includes('payload') || text.includes('too large')) {
        errorMessage = "El tamaño de los archivos es demasiado grande. Reduce el tamaño o la cantidad de imágenes.";
        statusCode = 413;
        errorCode = "PAYLOAD_TOO_LARGE";
      } else if (sdkError.code === 'moderation_blocked' || text.includes('safety system')) {
        errorMessage = "Los filtros de seguridad de OpenAI bloquearon la solicitud; ajusta la descripción o las imágenes.";
        statusCode = 422;
        errorCode = "MODERATION_BLOCKED";
      } else if (sdkError.status === 401 || sdkError.status === 403) {
        // La clave del SERVIDOR falló: no es culpa de la sesión de la persona, así que NO se responde 401 (el navegador pediría volver a entrar).
        errorMessage = "El servicio de imágenes no está disponible por ahora. Avisa al administrador.";
        statusCode = 502;
        errorCode = "UPSTREAM_AUTH";
      } else if (sdkError.status === 429 || sdkError.status === 503 || text.includes('Service Unavailable')) {
        errorMessage = "El servicio de imágenes está saturado en este momento; inténtalo de nuevo en un minuto.";
        statusCode = 503;
        errorCode = "SERVICE_UNAVAILABLE";
      } else if (charged) {
        // Error no reconocido: no se reenvía el texto crudo de OpenAI (puede traer datos internos); queda en el registro del servidor.
        errorMessage = "No se pudo generar el render.";
        statusCode = 502;
        errorCode = "GENERATION_FAILED";
      } else {
        // Antes de cobrar solo hay errores de validación propios de esta ruta: su texto es seguro y útil.
        errorMessage = text;
        statusCode = sdkError.status && sdkError.status >= 400 && sdkError.status < 500 && sdkError.status !== 401 ? sdkError.status : 500;
      }
    }

    return NextResponse.json(
      { message: `${errorMessage}${note}`, code: errorCode, ...(remaining !== undefined ? { remaining } : {}) },
      { status: statusCode }
    );
  }
}

