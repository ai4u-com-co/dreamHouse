// Selección de modelo y calidad de OpenAI a partir de lo que elige el usuario en la interfaz.
// Vive aparte de la ruta para poder probarla sin cargar Next.

import { lookup } from '@/lib/safe-lookup';
import { IMAGE_MODELS, type ImageModelKey, type ImageQualityKey } from '@/lib/openai-image-core.ts';

/** Modelos de GPT Image 2.5: Sunburst (base, el más preciso editando) y Flare (pequeño y rápido) */
export type OpenAIImageModel = (typeof IMAGE_MODELS)[ImageModelKey];
export type OpenAIImageQuality = ImageQualityKey;

/** Etiqueta de la interfaz (RENDER_QUALITIES) → valor de la API */
export const QUALITY_BY_LABEL: Record<string, OpenAIImageQuality> = {
  'Borrador': 'low',
  'Estándar': 'medium',
  'Alta': 'high',
  'Muy alta': 'xhigh',
  'Máxima': 'max',
};

/** La calidad más baja: es el predeterminado de la app y de cualquier llamada que no indique una */
export const LOWEST_QUALITY: OpenAIImageQuality = 'low';

/** Modelo del núcleo según el nombre de la interfaz: Flare si el nombre lo dice; cualquier otro valor (incluido
 *  "GPT Image 2 (OpenAI)" de registros antiguos) cae en Sunburst, el predeterminado. */
export const imageModelKey = (aiModel: unknown): ImageModelKey => (typeof aiModel === 'string' && aiModel.includes('Flare') ? 'flare' : 'sunburst');

/**
 * - Modelo: ver imageModelKey.
 * - Calidad: la elegida; sin calidad indicada (llamadas directas o registros antiguos), la más baja.
 */
export function getOpenAIImageSettings(aiModel: string, renderQuality?: string): { model: OpenAIImageModel; quality: OpenAIImageQuality } {
  const model = IMAGE_MODELS[imageModelKey(aiModel)];
  const quality = lookup(QUALITY_BY_LABEL, renderQuality) ?? LOWEST_QUALITY;
  return { model, quality };
}
