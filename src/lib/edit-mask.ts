import sharp from 'sharp';

// ============================================
// Máscara de edición por zona: bordes que se acomodan a la arquitectura
// ============================================
// El usuario pinta a mano la zona a cambiar, así que su contorno es APROXIMADO: casi nunca coincide con
// una esquina de pared, un zócalo o el marco de una ventana. Tratarlo como un corte exacto deja una
// costura visible (el material nuevo se detiene donde acabó el trazo, no donde acaba la pared).
//
// Dos medidas, ambas proporcionales al tamaño de la imagen (un blur fijo de 2 px no sirve en 2K):
//   1. La zona editable se amplía un margen (`margin`), y esa zona ampliada es la que se le entrega
//      al modelo: puede armonizar la unión en vez de detenerse en seco.
//   2. Al componer el resultado sobre la foto original, el borde se mezcla con un degradado ancho
//      (`sigma`) centrado en el borde ampliado: dentro del trazo el peso es ~1 (cambio completo),
//      fuera de la banda es 0 (píxel idéntico al original).

/** Margen de ampliación como fracción del lado corto de la imagen (~13 px en 1080) */
export const EDIT_MARGIN_RATIO = 0.012;
/** El degradado cubre ±2,5 σ: con σ = margen / 2,5 el peso es ~0,99 en el borde del trazo y ~0,5 en el borde ampliado */
const FEATHER_DIVISOR = 2.5;

export interface EditMaskGeometry {
  /** Píxeles que se amplía la zona editable */
  margin: number;
  /** Sigma del degradado de mezcla */
  sigma: number;
}

export function editMaskGeometry(width: number, height: number): EditMaskGeometry {
  const margin = Math.max(2, Math.round(Math.min(width, height) * EDIT_MARGIN_RATIO));
  return { margin, sigma: Math.max(0.8, margin / FEATHER_DIVISOR) };
}

export interface PreparedEditMask {
  width: number;
  height: number;
  geometry: EditMaskGeometry;
  /** PNG RGBA para el modelo: transparente = editable, ya ampliada (OpenAI solo mira el canal alfa) */
  modelMaskPng: Buffer;
  /** Peso de mezcla por píxel (0-255, un canal, `width*height` bytes): 255 = usar el resultado del modelo */
  blendAlpha: Buffer;
}

/**
 * A partir de la máscara dibujada (transparente = editable) construye la máscara ampliada para el modelo
 * y el peso de mezcla con borde degradado. `maskBuf` ya debe tener las dimensiones de la imagen base.
 */
export async function prepareEditMask(
  maskBuf: Buffer,
  width: number,
  height: number,
  limitInputPixels: number,
): Promise<PreparedEditMask> {
  const geometry = editMaskGeometry(width, height);

  // Zona editable binaria (255 = editable), ampliada
  const editable = await sharp(maskBuf, { limitInputPixels })
    .resize(width, height)
    .ensureAlpha()
    .extractChannel(3)
    .negate()
    .threshold(128)
    .dilate(geometry.margin)
    .raw()
    .toBuffer();

  // Máscara para el modelo: alfa 0 donde se puede editar
  // toColourspace('b-w'): sin esto sharp expande a 3 canales al salir y el buffer deja de medir width*height
  const modelAlpha = await sharp(editable, { raw: { width, height, channels: 1 } }).negate().toColourspace('b-w').raw().toBuffer();
  const modelMaskPng = await sharp({ create: { width, height, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(modelAlpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  // Peso de mezcla: la misma zona ampliada con el borde degradado
  const blendAlpha = await sharp(editable, { raw: { width, height, channels: 1 } }).blur(geometry.sigma).toColourspace('b-w').raw().toBuffer();
  if (blendAlpha.length !== width * height || modelAlpha.length !== width * height) {
    throw new Error('edit-mask: los canales alfa deben ser de 1 canal (width*height bytes)');
  }

  return { width, height, geometry, modelMaskPng, blendAlpha };
}

/** Mezcla el resultado del modelo sobre la imagen original con el peso dado; devuelve un JPEG */
export async function blendEditedOntoBase(
  baseBuf: Buffer,
  resultBuf: Buffer,
  mask: Pick<PreparedEditMask, 'width' | 'height' | 'blendAlpha'>,
  limits: { base: number; result: number },
  jpegQuality: number,
): Promise<Buffer> {
  const { width, height, blendAlpha } = mask;
  // joinChannel debe ir en una llamada aparte: dentro de la misma cadena que removeAlpha no añade el canal
  const editedRgb = await sharp(resultBuf, { limitInputPixels: limits.result }).resize(width, height).removeAlpha().png().toBuffer();
  const editedPatch = await sharp(editedRgb)
    .joinChannel(blendAlpha, { raw: { width, height, channels: 1 } })
    .png()
    .toBuffer();

  return sharp(baseBuf, { limitInputPixels: limits.base })
    .removeAlpha()
    .composite([{ input: editedPatch }])
    .jpeg({ quality: jpegQuality })
    .toBuffer();
}
