import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, Part } from '@google/genai';
import OpenAI from 'openai';
import sharp from 'sharp';
import { embedImageMetadata, METADATA_APP, METADATA_VERSION, type DreamHouseImageMetadata } from '@/lib/image-metadata';
import { DreamHouseParams } from '@/types';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';

// Vercel configuration: maxDuration only works on Pro plan, but it's the correct way to declare it
// Hobby plan has 10s limit, Pro plan allows up to 300s
export const maxDuration = 120; // Increased to 120s to allow for image generation and thinking time

// Constants for validation
const MAX_IMAGE_SIZE = 100 * 1024 * 1024; // 100MB per image
const MAX_TOTAL_PAYLOAD_SIZE = 100 * 1024 * 1024; // 100MB total payload
const MAX_REFERENCE_IMAGES = 14; // Nano Banana 2 support up to 14

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
  interior: { lot: true, exteriorRef: false, floorPlan: true, files: false, objects: true },
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

// Selección de modelo OpenAI según la opción elegida en la UI.
// - Sunburst: modelo base de GPT Image 2.5, el más preciso editando (default).
// - Flare: modelo pequeño y rápido, pensado para borradores.
// Cualquier valor anterior (p. ej. "GPT Image 2 (OpenAI)") cae en Sunburst.
type OpenAIImageModel = 'gpt-image-2.5-sunburst' | 'gpt-image-2.5-flare';
type OpenAIImageQuality = 'low' | 'medium' | 'high' | 'xhigh';

const QUALITY_BY_LABEL: Record<string, OpenAIImageQuality> = {
  'Borrador': 'low',
  'Estándar': 'medium',
  'Alta': 'high',
  'Máxima': 'xhigh',
};

function getOpenAIImageSettings(aiModel: string, thinkingLevel: string, renderQuality?: string): { model: OpenAIImageModel; quality: OpenAIImageQuality } {
  const model: OpenAIImageModel = aiModel.includes('Flare') ? 'gpt-image-2.5-flare' : 'gpt-image-2.5-sunburst';
  // Registros anteriores al selector de calidad solo traen thinkingLevel
  const quality = QUALITY_BY_LABEL[renderQuality ?? ''] ?? (thinkingLevel === 'High' ? 'high' : 'medium');
  return { model, quality };
}

// Formato de salida de OpenAI: JPEG es más rápido que PNG y mantiene la respuesta
// por debajo del límite de 4,5 MB del cuerpo de respuesta de una función de Vercel.
const OPENAI_OUTPUT_FORMAT = 'jpeg' as const;
const OPENAI_OUTPUT_COMPRESSION = 95;

// La máscara de OpenAI es una guía, no una garantía: el modelo puede tocar fuera de la zona.
// Para que lo no marcado quede idéntico píxel a píxel, se compone el resultado sobre la
// imagen original usando la propia máscara (con un borde suavizado para que no se note el corte).
// Devuelve null si no se puede componer (p. ej. la relación de aspecto cambió): se usa entonces
// la imagen del modelo tal cual.
async function compositeMaskedEdit(baseFile: File, maskFile: File, resultBase64: string): Promise<string | null> {
  try {
    const baseBuf = Buffer.from(await baseFile.arrayBuffer());
    const maskBuf = Buffer.from(await maskFile.arrayBuffer());
    const resultBuf = Buffer.from(resultBase64, 'base64');

    const baseMeta = await sharp(baseBuf, { limitInputPixels: EDIT_MASK_MAX_PIXELS }).metadata();
    const resultMeta = await sharp(resultBuf, { limitInputPixels: OPENAI_RESULT_MAX_PIXELS }).metadata();
    if (!baseMeta.width || !baseMeta.height || !resultMeta.width || !resultMeta.height) return null;
    const { width, height } = baseMeta;
    if (Math.abs(resultMeta.width / resultMeta.height - width / height) > 0.01) return null;

    // Zona editable = parte transparente de la máscara, con borde suavizado
    const editableAlpha = await sharp(maskBuf, { limitInputPixels: EDIT_MASK_MAX_PIXELS })
      .resize(width, height)
      .ensureAlpha()
      .extractChannel(3)
      .negate()
      .blur(2)
      .raw()
      .toBuffer();

    // joinChannel debe ir en una llamada aparte: dentro de la misma cadena que removeAlpha no añade el canal
    const editedRgb = await sharp(resultBuf, { limitInputPixels: OPENAI_RESULT_MAX_PIXELS }).resize(width, height).removeAlpha().png().toBuffer();
    const editedPatch = await sharp(editedRgb)
      .joinChannel(editableAlpha, { raw: { width, height, channels: 1 } })
      .png()
      .toBuffer();

    const final = await sharp(baseBuf, { limitInputPixels: EDIT_MASK_MAX_PIXELS })
      .removeAlpha()
      .composite([{ input: editedPatch }])
      .jpeg({ quality: OPENAI_OUTPUT_COMPRESSION })
      .toBuffer();
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
  let requestedOpenAI = false; // para que el mensaje de error nombre la clave correcta
  try {
    const formData = await req.formData();
    const paramsJson = formData.get('params') as string;
    
    if (!paramsJson) {
      return NextResponse.json({ message: 'Missing parameters' }, { status: 400 });
    }

    const params: DreamHouseParams = JSON.parse(paramsJson);
    const useOpenAI = params.aiModel && params.aiModel.includes('OpenAI');
    requestedOpenAI = !!useOpenAI;

    // API Key validation based on selected model
    let geminiApiKey = null;
    let openaiApiKey = null;

    if (useOpenAI) {
      openaiApiKey = req.headers.get('x-openai-api-key') || process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return NextResponse.json(
          { message: 'OpenAI API Key is missing. Please configure OPENAI_API_KEY in Vercel or provide it.' },
          { status: 401 }
        );
      }
    } else {
      geminiApiKey = req.headers.get('x-api-key') || process.env.GEMINI_API_KEY;
      if (!geminiApiKey) {
        return NextResponse.json(
          { message: 'API Key is missing. Please configure GEMINI_API_KEY in Vercel environment variables or provide it in the header.' },
          { status: 401 }
        );
      }
    }

    let ai: GoogleGenAI | null = null;
    if (!useOpenAI && geminiApiKey) {
      console.log("Initializing Gemini SDK with API Key (truncated):", geminiApiKey.substring(0, 5) + "...");
      ai = new GoogleGenAI({ 
        apiKey: geminiApiKey,
        httpOptions: { timeout: 120000 }
      });
    }

    let openaiClient: OpenAI | null = null;
    if (useOpenAI && openaiApiKey) {
      console.log("Initializing OpenAI SDK");
      openaiClient = new OpenAI({ apiKey: openaiApiKey });
    }

    // Cada módulo usa solo sus propios archivos: lo que quedó cargado de otro módulo no se envía.
    const modeInputs = INPUTS_BY_MODE[params.mode] ?? INPUTS_BY_MODE.exterior;
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

    // Process images to base64 for multimodal generation
    let lotImageBase64 = "";
    let lotImageMimeType = "";
    let exteriorRefBase64 = "";
    let exteriorRefMimeType = "";
    let floorPlanImageBase64 = "";
    let floorPlanImageMimeType = "";
    let editCompositeBase64 = "";
    let editCompositeMimeType = "";
    const referenceImagesBase64: Array<{ mimeType: string; data: string }> = [];
    const objectImagesBase64: Array<{ mimeType: string; data: string }> = [];

    if (lotImage) {
      const buffer = await lotImage.arrayBuffer();
      lotImageBase64 = Buffer.from(buffer).toString('base64');
      lotImageMimeType = lotImage.type;
    }
    
    if (exteriorReferenceImage) {
      const buffer = await exteriorReferenceImage.arrayBuffer();
      exteriorRefBase64 = Buffer.from(buffer).toString('base64');
      exteriorRefMimeType = exteriorReferenceImage.type;
    }

    if (files.length > 0) {
      for (const file of files) {
        const buffer = await file.arrayBuffer();
        const base64Data = Buffer.from(buffer).toString('base64');
        referenceImagesBase64.push({ mimeType: file.type, data: base64Data });
      }
    }

    if (floorPlanImage) {
      const buffer = await floorPlanImage.arrayBuffer();
      floorPlanImageBase64 = Buffer.from(buffer).toString('base64');
      floorPlanImageMimeType = floorPlanImage.type;
    }

    if (editCompositeFile) {
      const buffer = await editCompositeFile.arrayBuffer();
      editCompositeBase64 = Buffer.from(buffer).toString('base64');
      editCompositeMimeType = editCompositeFile.type;
    }

    if (objectImages.length > 0) {
      for (const file of objectImages) {
        const buffer = await file.arrayBuffer();
        objectImagesBase64.push({ mimeType: file.type, data: Buffer.from(buffer).toString('base64') });
      }
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
          role: "the original image to edit; only the area made transparent by the mask may change",
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
        files.forEach(file => openaiInputs.push({
          file,
          role: "a conceptual style reference (take mood, material palette and proportions; do not copy specific buildings or facades)",
        }));
        objectImages.forEach(file => openaiInputs.push({
          file,
          role: "a specific furniture piece or object that must appear in the final design; preserve its exact shape, color, material and design",
        }));
      }
    }
    const openaiMaskFile = useOpenAI && params.mode === 'edit' && editBaseFile && editMaskFile ? editMaskFile : null;
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
- Keep everything outside the mask identical: camera angle, framing, perspective, lighting direction and color temperature, materials, proportions, surrounding objects and resolution.
- Blend the changed area seamlessly with its surroundings, matching the original light, style and perspective.`;
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
    } else {
      fullPrompt = `${narrativePrompt}

${mandate}
- QUALITY: The image must feel photographed, not rendered. Every surface needs physical weight: honest texture, natural color variation, controlled imperfections (grain, wear at edges, subtle tonal shifts) that confirm real material. Lighting must have a single clear direction with soft gradient fall-off into shadow. No CGI smoothness, no plastic sheen, no over-sharpened or uniformly perfect surfaces. Shadows reveal depth. Glass reflects its environment.

VERIFICATION STEPS:
1. Review the generated composition against the text description.
2. ${params.materials.length ? `Verify that all requested materials (${params.materials.join(', ')}) are clearly visible and rendered with honest texture — not smooth or generic.` : 'Verify that every material is rendered with honest texture — not smooth or generic.'}
3. Confirm that no forbidden elements appear (Negative Prompt: ${params.negativePrompt || 'None'}).
4. Check that lighting has a clear direction and casts soft-edged shadows that read the three-dimensional form.
5. Confirm no surface looks digitally smooth, plastic, or uniformly perfect — introduce micro-imperfections if needed.
6. If the result is incorrect, reasoning should correct the composition before final output.`.trim();
    }

    console.log("Generated Narrative Prompt:", fullPrompt);

    // --- Generate Exterior Image ---
    const imageGenerationParts: Part[] = [{ text: fullPrompt }];

    if (params.mode === 'edit' && editCompositeBase64) {
      // In edit mode, we only use the composite file (original + user sketches)
      imageGenerationParts.push({
        inlineData: { mimeType: editCompositeMimeType, data: editCompositeBase64 }
      });
    } else {
      // Image order: floor plan (geometric reference) → lot (terrain) → style references
      if (floorPlanImageBase64) {
        imageGenerationParts.push({
          inlineData: { mimeType: floorPlanImageMimeType, data: floorPlanImageBase64 }
        });
      }

      if (lotImageBase64) {
        imageGenerationParts.push({
          text: params.mode === 'vistas'
            ? "HOUSE REFERENCE IMAGE: the following image is the house to photograph. The SAME house must appear in the result, identical in form, materials and design; only the camera changes."
            : params.mode === 'interior'
              ? "CURRENT SPACE PHOTO: the following image is the existing space to redesign. Keep its architectural shell (walls, openings, ceiling height) and its camera viewpoint."
              : "LOT / TERRAIN PHOTO: the following image is the site context the building must be integrated into."
        });
        imageGenerationParts.push({
          inlineData: { mimeType: lotImageMimeType, data: lotImageBase64 }
        });
      }

      if (exteriorRefBase64) {
        imageGenerationParts.push({
          text: "HOUSE REFERENCE IMAGE (STRUCTURAL BASE): The following image is the existing house that must be modified. Maintain its general volume, shape, and architectural structure while applying the new materials, colors, and styles specified in the prompt."
        });
        imageGenerationParts.push({
          inlineData: { mimeType: exteriorRefMimeType, data: exteriorRefBase64 }
        });
      }

      if (objectImagesBase64.length > 0) {
        imageGenerationParts.push({
          text: `OBJECT REFERENCES (${objectImagesBase64.length} piece${objectImagesBase64.length > 1 ? 's' : ''}): The following images are specific furniture pieces, fixtures, or decorative objects that MUST appear in the final interior design. Incorporate each one faithfully — preserve its exact shape, color, material, and design. Place them naturally within the space according to the room layout and style.`
        });
        for (const obj of objectImagesBase64) {
          imageGenerationParts.push({ inlineData: { mimeType: obj.mimeType, data: obj.data } });
        }
      }

      if (referenceImagesBase64.length > 0) {
        const refLabel = params.mode === 'exterior'
          ? `CONCEPTUAL STYLE REFERENCES (${referenceImagesBase64.length} image${referenceImagesBase64.length > 1 ? 's' : ''}): The following images are provided as conceptual inspiration ONLY — NOT as literal templates to replicate. Extract from them: architectural style vocabulary, material palette, spatial mood, massing proportions, and compositional sensibility. DO NOT copy specific buildings, facades, windows, or compositions shown. Translate their essence and spirit into the current project's own design language.`
          : `STYLE REFERENCES (${referenceImagesBase64.length} image${referenceImagesBase64.length > 1 ? 's' : ''}): The following images define the desired aesthetic mood, material palette, and spatial atmosphere. Use them as directional inspiration for the overall look and feel.`;
        imageGenerationParts.push({ text: refLabel });
        for (const refImage of referenceImagesBase64) {
          imageGenerationParts.push({
            inlineData: { mimeType: refImage.mimeType, data: refImage.data }
          });
        }
      }
    }

    let imageUrl = "";
    let usedModel = "gemini-3.1-flash-image-preview";
    let usedQuality: string | undefined;
    let usedSize: string | undefined;
    let groundingMetadata = null;

    if (useOpenAI && openaiClient) {
      const imageFiles = openaiInputs.map(input => input.file);
      // En edición el tamaño lo decide la imagen de entrada ("auto"): forzar 16:9 deformaría lo editado
      const sizeStr = params.mode === 'edit' ? 'auto' : getGptImage2Size(params.renderAspectRatio, params.renderOutputResolution);
      const { model: openaiModel, quality: qualityVal } = getOpenAIImageSettings(params.aiModel, params.thinkingLevel, params.renderQuality);
      usedModel = openaiModel;
      usedQuality = qualityVal;
      usedSize = sizeStr;

      let result;
      if (imageFiles.length > 0) {
        console.log(`Editing/Compositing with OpenAI (${openaiModel}) using ${imageFiles.length} image files. Size: ${sizeStr}, Quality: ${qualityVal}`);
        result = await openaiClient.images.edit({
          model: openaiModel,
          image: imageFiles,
          ...(openaiMaskFile ? { mask: openaiMaskFile } : {}),
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
        const composited = openaiMaskFile && editBaseFile
          ? await compositeMaskedEdit(editBaseFile, openaiMaskFile, imageBase64)
          : null;
        imageUrl = `data:image/${OPENAI_OUTPUT_FORMAT};base64,${composited ?? imageBase64}`;
      } else if (imageUrlResult) {
        imageUrl = imageUrlResult;
      } else {
         throw new Error("No image data or URL returned from OpenAI");
      }
    } else {
      if (!ai) {
        throw new Error("GoogleGenAI client is not initialized.");
      }
      console.log("Generating with Gemini");
      const generationResponse = await ai.models.generateContent({
        model: "gemini-3.1-flash-image-preview",
        contents: [{ parts: imageGenerationParts }],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          tools: [
            { 
              googleSearch: { 
                searchTypes: {
                  webSearch: {},
                  imageSearch: {}
                }
              }
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any
          ],
          imageConfig: {
            ...(params.renderAspectRatio && params.mode !== 'edit' ? { aspectRatio: params.renderAspectRatio } : {}),
            ...(params.renderOutputResolution ? { imageSize: params.renderOutputResolution } : {})
          },
          thinkingConfig: {
            thinkingLevel: params.thinkingLevel === "High" ? "HIGH" : "MINIMAL",
            includeThoughts: true
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any
        }
      });

      const candidates = generationResponse.candidates;
      if (!candidates || candidates.length === 0) {
        throw new Error("No image candidates returned");
      }

      const firstCandidate = candidates[0];
      const parts = firstCandidate?.content?.parts;
      const imagePart = parts?.find((part: Part) => part.inlineData);

      if (!imagePart || !imagePart.inlineData) {
        throw new Error("No image data found in response");
      }

      const imageBase64 = imagePart.inlineData.data;
      const mimeType = imagePart.inlineData.mimeType || "image/png";
      imageUrl = `data:${mimeType};base64,${imageBase64}`;
      groundingMetadata = firstCandidate.groundingMetadata;
    }

    // --- Generate House Name using Economical Model (Gemini 1.5 Flash) ---
    let houseName = "DreamHouse Project";
    try {
      const namePrompt = `Generate an inspirational 3-word name (in Spanish) for an architectural house with these characteristics:
- Style: ${params.architecturalStyles.join(', ') || 'Modern'}
- Mode: ${params.mode}
- Mood: ${params.mood}
- Materials: ${params.materials.join(', ')}
- Location: ${params.city || 'Any'}
- Context: ${params.environment}

Return ONLY the 3-word name, no quotes, no extra text. Focus on what makes it unique.`;
      
      let nameText = "";
      if (ai) {
        const nameResult = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{ parts: [{ text: namePrompt }] }]
        });
        nameText = nameResult.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }
      
      if (nameText && nameText.split(/\s+/).length <= 6) { // Sanity check on length
        houseName = nameText;
      }
    } catch (nameError) {
      console.error("Failed to generate house name:", nameError);
      // Fallback to project name based on style
      houseName = `${params.architecturalStyles[0] || 'Modern'} Design House`;
    }

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
        // Sin el render de origen (ya viaja como parentId) ni banderas internas
        params: { ...params, sourceRender: undefined, embedMetadata: undefined },
        prompt: fullPrompt,
      });
    }

    return NextResponse.json({ imageUrl, groundingMetadata, houseName, metadataId });

  } catch (error: unknown) {
    console.error("API Error Detailed:", error);

    let errorMessage = "Ocurrió un error inesperado al generar el render.";
    let statusCode = 500;
    let errorCode = "UNKNOWN_ERROR";

    if (error instanceof Error) {
      errorMessage = error.message;

      // Handle common gRPC/API error strings
      if (errorMessage.includes('Deadline expired') || errorMessage.includes('timeout') || errorMessage.includes('TIMEOUT')) {
        errorMessage = "El tiempo de espera ha expirado (timeout). La generación está tomando más tiempo de lo esperado en los servidores de Google. Por favor, intenta de nuevo.";
        statusCode = 504;
        errorCode = "TIMEOUT";
      } else if (errorMessage.includes('payload') || errorMessage.includes('too large')) {
        errorMessage = "El tamaño de los archivos es demasiado grande. Por favor, reduce el tamaño o la cantidad de imágenes.";
        statusCode = 413;
        errorCode = "PAYLOAD_TOO_LARGE";
      } else if (errorMessage.includes('API_KEY') || errorMessage.includes('authentication') || errorMessage.includes('401')) {
        errorMessage = `Error de autenticación: la ${requestedOpenAI ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY'} no es válida o falta.`;
        statusCode = 401;
        errorCode = "AUTH_ERROR";
      } else if (errorMessage.includes('503') || errorMessage.includes('Service Unavailable')) {
        errorMessage = "El servicio de Google AI no está disponible temporalmente (503). Por favor, intenta de nuevo en unos momentos.";
        statusCode = 503;
        errorCode = "SERVICE_UNAVAILABLE";
      }

      // If it's a specific SDK ApiError, it should have a status code
      const sdkError = error as { status?: number; code?: number };
      if (sdkError.status) {
        statusCode = sdkError.status;
      }
    }

    return NextResponse.json(
      { message: errorMessage, code: errorCode },
      { status: statusCode }
    );
  }
}

