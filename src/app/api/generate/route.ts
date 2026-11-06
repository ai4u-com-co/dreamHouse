import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { prepareEditMask, blendEditedOntoBase, type PreparedEditMask } from '@/lib/edit-mask';
import { embedImageMetadata, pickEmbeddableParams, METADATA_APP, METADATA_VERSION, type DreamHouseImageMetadata } from '@/lib/image-metadata';
import { DreamHouseParams } from '@/types';
import { quoteRender } from '@/lib/render-options';
import { FALLBACK_MODEL, creditsFromUsage, mimeFor, promptCostUnits, usageForLog } from '@/lib/openai-image-core.ts';
import { openaiImageFields } from '@/lib/openai-image-server.ts';
import { lookup } from '@/lib/safe-lookup';
import { normalizeRenderSettings } from '@/lib/render-settings';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildEditPrompt } from '@/modules/edit/lib/prompt-builder';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';
import { buildPlantaPrompt } from '@/modules/planta/lib/prompt-builder';
import { APP_ID, authenticate, charge, chargeFailure, isAdmin, noChargeNote, recordUsage, refund, topUp, type Charge } from '@/lib/billing';

// Vercel: «Muy alta» tarda ~30 s y «Máxima» ~60 s o más (medido); con varias variantes y entradas, más. 300 s es el tope del plan Pro.
export const maxDuration = 300;

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
  planta: { lot: true, exteriorRef: false, floorPlan: true, files: false, objects: false },
  exterior: { lot: true, exteriorRef: true, floorPlan: true, files: true, objects: false },
  interior: { lot: true, exteriorRef: false, floorPlan: true, files: true, objects: true },
  vistas: { lot: true, exteriorRef: false, floorPlan: false, files: false, objects: false },
  edit: { lot: false, exteriorRef: false, floorPlan: false, files: false, objects: false },
};

// Incrusta los metadatos en una imagen en data URL (JPEG, PNG o WebP). Si no es data URL o falla, la devuelve igual.
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

// Calidad JPEG con la que se compone una edición con máscara sobre el original (el resultado final de esa ruta siempre es JPEG)
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

// Píxeles reales de una imagen (solo cabecera, no se decodifica): el costo de una edición depende de la imagen base.
async function imagePixels(file: File): Promise<number | undefined> {
  try {
    const meta = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: false }).metadata();
    return meta.width && meta.height ? meta.width * meta.height : undefined;
  } catch {
    return undefined;
  }
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
    if (params.mode === 'planta') {
      narrativePrompt = buildPlantaPrompt(params, params.aiModel, !!(floorPlanImage || lotImage));
    } else if (params.mode === 'interior') {
      narrativePrompt = buildInteriorPrompt(params, params.aiModel, !!lotImage);
    } else if (params.mode === 'exterior') {
      narrativePrompt = buildExteriorPrompt(params, !!exteriorReferenceImage, params.aiModel, !!floorPlanImage);
    } else if (params.mode === 'vistas') {
      narrativePrompt = buildVistasPrompt(params, params.viewType || 'Perspectiva Principal (Hero Shot)', params.aiModel);
    } else {
      // Instrucción acotada + dirección de diseño opcional (ver modules/edit/lib/prompt-builder.ts)
      narrativePrompt = buildEditPrompt(params);
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
            : params.mode === 'planta' && params.hasLotZone
              ? "the lot or terrain photo with a highlighted red polygon marking the exact buildable zone where the floor plan must be created: fit the floor plan footprint, orientation and layout to that marked zone (do not copy the red selection overlay lines into the final drawing)"
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
          const floorPlanRole = params.mode === 'exterior'
            ? "HARD GEOMETRIC SLOT (floor plan): this floor plan sets the strict geometric boundaries (exact footprint, perimeter shape, wings, setbacks, courtyard/terrace zones and window/door bays 1:1); stay strictly within these spatial limits while fully executing all requested exterior parameters (architectural style, facade materials, roof type, levels, landscaping, lighting and Creative Direction), and do not copy flat 2D drafting lines or text labels into the photo"
            : "HARD GEOMETRIC ANCHOR (floor plan or sketch): preserve its exact layout, spatial division, proportions and perimeter footprint while applying the requested parameters; do not copy raw 2D labels or dimension text into the image";
          openaiInputs.push({ file: floorPlanImage, role: floorPlanRole });
        }
        if ((params.mode === 'exterior' || params.mode === 'planta') && lotImage) {
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
      if (params.mode === "planta") {
        mandate = [
          'ARCHITECTURAL FLOOR PLAN MANDATE:',
          '- Generate a coherent architectural floor plan and spatial division matching any specified room counts, areas and zoning (freely proposing a balanced layout for any unspecified parameters).',
          params.bedrooms > 0 ? `- Show ${params.bedrooms} bedroom${params.bedrooms > 1 ? 's' : ''}.` : '',
          params.bathrooms > 0 ? `- Show ${params.bathrooms} bathroom${params.bathrooms > 1 ? 's' : ''}.` : '',
          floorPlanImage ? '- Respect the overall footprint and layout proportions of the provided reference sketch.' : '',
          lotImage && params.hasLotZone
            ? '- Fit the floor plan footprint and orientation specifically to the highlighted polygon zone marked on the provided lot photo; do not draw the red selection overlay lines.'
            : lotImage
              ? '- Fit the floor plan footprint within the geometry of the provided site/lot reference.'
              : '',
        ].filter(Boolean).join('\n');
      } else if (params.mode === "interior") {
        mandate = ['INTERNAL SPATIAL MANDATE:',
          params.roomType ? `- Respect room functionality: ${params.roomType}.` : '',
          params.furnitureStyle.length ? `- Render furniture: ${params.furnitureStyle.join(', ')}.` : '',
          params.flooringMaterial || params.ceilingDetail
            ? `- ${[params.flooringMaterial && `Flooring: ${params.flooringMaterial}`, params.ceilingDetail && `Ceiling: ${params.ceilingDetail}`].filter(Boolean).join(', ')}.`
            : '',
          lotImage ? '- Redesign the existing space from the reference photo; keep its architectural shell and viewpoint.' : '',
          floorPlanImage ? '- Preserve the exact layout, proportions and perspective of the floor plan or sketch; do not add new elements or text.' : '',
        ].filter(Boolean).join('\n');
      } else if (params.mode === "exterior") {
        const structureLines = [
          exteriorReferenceImage
            ? "PRESERVE general architectural volumes and facade structure from the house reference image."
            : "",
          floorPlanImage
            ? "HARD CONSTRAINT (FLOOR PLAN SLOT): The provided floor plan image defines the strict 1:1 geometric boundaries (footprint, perimeter shape, wings, recesses, courtyard/patio voids, terraces, entry and window/door bays). Respect these spatial limits strictly while still executing ALL requested exterior parameters (style, facade materials, roof, levels, environment, landscaping, lighting and Creative Direction); do not draw flat 2D plan lines or text labels."
            : "",
          !exteriorReferenceImage && !floorPlanImage
            ? "Compose the building from the written specification only."
            : "",
          params.levels > 0 ? `Show exactly ${params.levels} floors.` : "",
        ].filter(Boolean);
        mandate = `ARCHITECTURAL EXTERIOR MANDATE:\n${structureLines.map((l) => `- ${l}`).join('\n')}`;
      } else if (params.mode === "vistas") {
        mandate = `ARCHITECTURAL PORTFOLIO MANDATE:
- House anchor: Image 1 is the house. In every view repeat its massing, number of floors, roof, window and door rhythm, materials and colors exactly; only the camera changes.
- Do not restyle, redesign or add elements that are not implied by the reference.`;
      } else if (openaiMaskFile) {
        mandate = `IMAGE EDITING MANDATE (MASKED EDIT):
- Replace ONLY the masked area, following the edit instruction above.
- The mask was painted by hand, so its outline is APPROXIMATE: it marks where the change is wanted, not an exact cut line. Never reproduce the brush outline as a visible edge, halo, seam or tone shift.
- Let the change follow the architecture and logic of the space. Carry the new surface, material, color or object up to the natural boundaries nearby (wall corners, ceiling and floor lines, baseboards, window and door frames, joints between planes, furniture edges) and stop there, never in the middle of a continuous plane.
- Respect the original perspective and vanishing lines, the light direction and color temperature, the shadows and reflections, and the scale of the surroundings, so the edited area reads as part of the same space.
- Inside the thin band around the mask you may adjust slightly where it is needed to make the junction coherent. Everything beyond that band stays identical: camera angle, framing, perspective, lighting, materials, proportions, surrounding objects and resolution.`;
      } else {
        mandate = `IMAGE EDITING MANDATE (SURGICAL EDIT):
- Replace ONLY the areas marked or described in the user's sketch and notes.
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
      const creativePriority = params.artDirection?.trim()
        ? `\n- SUPREME MANDATE — The CREATIVE DIRECTION in the brief above has the highest priority and is MANDATORY: execute every spatial, functional and visual instruction in "${params.artDirection.trim()}" literally and completely; where it conflicts with any default rule, preset or parameter here, it wins unconditionally (except the structural integrity of the base image).`
        : "";
      fullPrompt = `${openaiImageGuide ? `${openaiImageGuide}\n\n` : ""}${narrativePrompt}

[MANDATES & CONSTRAINTS]
${mandate}${userExclusions}${creativePriority}
- No extra text, no watermarks, no unrelated logos.`.trim();
    }

    console.log("Generated Narrative Prompt:", fullPrompt);

    // --- Opciones de salida: validación ESTRICTA con el núcleo compartido (400 sin cobrar si algo no es válido) ---
    const imageFiles = openaiInputs.map(input => input.file);
    // El costo de cada imagen de entrada sale de sus píxeles REALES (el servidor no confía en que el navegador las redujo);
    // en edición la primera es la base y el tamaño de salida lo decide ella ("auto").
    const inputImagePixels: number[] = [];
    for (const file of imageFiles) {
      const px = await imagePixels(file);
      if (!px) return NextResponse.json({ code: 'BAD_OPTIONS', option: 'bad_input_image', message: 'No se pudo leer una de las imágenes. Súbela de nuevo (JPG, PNG o WebP).' }, { status: 400 });
      inputImagePixels.push(px);
    }
    // La máscara también es una imagen de entrada: cuenta (y cuesta) por sus píxeles reales
    if (maskForModel) {
      const mpx = await imagePixels(maskForModel);
      if (!mpx) return NextResponse.json({ code: 'BAD_OPTIONS', option: 'bad_input_image', message: 'No se pudo leer la máscara de edición.' }, { status: 400 });
      inputImagePixels.push(mpx);
    }
    // El rol se consulta (con el JWT de la persona) solo cuando la solicitud pide algo reservado a admin
    const wantsAdminOption = (rawParams as Record<string, unknown>).renderModeration === 'low';
    const callerIsAdmin = wantsAdminOption ? await isAdmin(auth.sb, auth.userId) : false;
    const quote = quoteRender(rawParams as Record<string, unknown>, { inputImagePixels, isAdmin: callerIsAdmin, promptChars: promptCostUnits(fullPrompt) });
    if (!quote.ok) {
      // Moderación baja sin ser admin: 403; cualquier otra opción inválida: 400. En ambos casos, ANTES de cobrar.
      if (quote.code === 'forbidden_moderation') {
        return NextResponse.json({ code: 'ADMIN_ONLY', message: quote.message }, { status: 403 });
      }
      return NextResponse.json({ code: 'BAD_OPTIONS', option: quote.code, message: quote.message }, { status: 400 });
    }
    const v = quote.value.options;
    const apiSize = quote.value.apiSize;

    // COBRO antes de llamar a OpenAI (atómico; los admin no pagan). Si OpenAI falla, el catch devuelve el cobro.
    const c = await charge(auth.sb, v.credits, 'render', {
      mode: params.mode, model: v.modelId, quality: v.quality, size: apiSize, n: v.n, format: v.format, background: v.background, inputs: imageFiles.length, chars: promptCostUnits(fullPrompt),
    });
    if (!c.ok) {
      const failure = chargeFailure(c);
      return NextResponse.json(failure.body, { status: failure.status });
    }
    charged = c;

    // Los campos extra (safety_identifier, quality 'max', background…) pueden ir por delante de los tipos del SDK:
    // el cuerpo que viaja es exactamente el verificado contra la API.
    type ImageResult = { data?: Array<{ b64_json?: string; url?: string }>; usage?: unknown };
    const callOpenAI = async (modelId: string): Promise<ImageResult> => {
      const fields = openaiImageFields({ ...v, size: apiSize }, { appId: APP_ID, userId: auth.userId }, modelId);
      if (imageFiles.length > 0) {
        console.log(`Editing/Compositing with OpenAI (${modelId}) using ${imageFiles.length} input images. Size: ${apiSize}, Quality: ${v.quality}, n: ${v.n}`);
        return await openaiClient.images.edit({
          ...fields,
          image: imageFiles,
          ...(maskForModel ? { mask: maskForModel } : {}),
          prompt: fullPrompt,
        } as unknown as Parameters<typeof openaiClient.images.edit>[0]) as unknown as ImageResult;
      }
      console.log(`Generating text-to-image with OpenAI (${modelId}). Size: ${apiSize}, Quality: ${v.quality}, n: ${v.n}`);
      return await openaiClient.images.generate({ ...fields, prompt: fullPrompt } as unknown as Parameters<typeof openaiClient.images.generate>[0]) as unknown as ImageResult;
    };

    let usedModel: string = v.modelId;
    let result: ImageResult;
    try {
      result = await callOpenAI(v.modelId);
    } catch (err) {
      // Respaldo SOLO si la cuenta aún no tiene GPT Image 2.5 (no se vuelve a cobrar: el cobro ya está hecho)
      const e = err as { status?: number; code?: string | null };
      if (e?.status === 404 || e?.code === 'model_not_found') {
        usedModel = FALLBACK_MODEL;
        result = await callOpenAI(FALLBACK_MODEL);
      } else {
        throw err;
      }
    }

    const mime = mimeFor(v.format);
    const imageUrls: string[] = [];
    for (const item of result?.data ?? []) {
      if (item?.b64_json) {
        const composited = preparedMask && editBaseFile
          ? await compositeMaskedEdit(editBaseFile, preparedMask, item.b64_json)
          : null;
        // La composición con máscara siempre entrega JPEG
        imageUrls.push(`data:${composited ? 'image/jpeg' : mime};base64,${composited ?? item.b64_json}`);
      } else if (item?.url) {
        imageUrls.push(item.url);
      }
    }
    if (imageUrls.length === 0) throw new Error("No image data or URL returned from OpenAI");
    const usedQuality = v.quality;
    const usedSize = apiSize;
    const groundingMetadata = null; // se conserva en la respuesta por compatibilidad (antes venía de Gemini)
    // Uso real de OpenAI para el control de costos: jamás puede romper la entrega
    await recordUsage(auth.sb, c.logId, c.refundToken, usageForLog(result?.usage, { model: usedModel, quality: v.quality, size: apiSize, n: v.n }));

    // Nombre del proyecto: lo escribía Gemini (y solo con ese modelo); con GPT Image 2.5 siempre fue el predeterminado.
    const houseName = "DreamHouse Project";

    // --- Metadatos incrustados: los parámetros viajan dentro del archivo (cada variante lleva su propio id) ---
    const metadataIds: string[] = [];
    const images = imageUrls.map((url) => {
      const metadataId = crypto.randomUUID();
      metadataIds.push(metadataId);
      if (params.embedMetadata === false) return url;
      return embedMetadataInDataUrl(url, {
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
    });

    delivered = true;
    // Liquidación con el uso real (los admin no pagan: sin refundToken no hay cobro extra). Va DESPUÉS de marcar la entrega para que un
    // fallo posterior nunca devuelva el cobro de una imagen ya hecha; y nunca rompe la respuesta (topUp no lanza).
    const settled = await topUp(auth.sb, c, creditsFromUsage(result?.usage));
    // `imageUrl`/`image` = la primera (compatibilidad); `images` = todas las variantes. El token de devolución nunca sale.
    return NextResponse.json({
      imageUrl: images[0],
      image: images[0],
      images,
      groundingMetadata,
      houseName,
      metadataId: metadataIds[0],
      metadataIds,
      remaining: settled.remaining,
      model: usedModel,
      options: { size: apiSize, quality: v.quality, format: v.format, n: v.n, background: v.background, model: v.model },
      usage: usageForLog(result?.usage),
    });

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

