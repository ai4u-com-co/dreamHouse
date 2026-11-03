// Selección de modelo y calidad de OpenAI a partir de lo que elige el usuario en la interfaz.
// Vive aparte de la ruta para poder probarla sin cargar Next.

/** Modelos de GPT Image 2.5: Sunburst (base, el más preciso editando) y Flare (pequeño y rápido) */
export type OpenAIImageModel = 'gpt-image-2.5-sunburst' | 'gpt-image-2.5-flare';
export type OpenAIImageQuality = 'low' | 'medium' | 'high' | 'xhigh';

/** Etiqueta de la interfaz (RENDER_QUALITIES) → valor de la API */
export const QUALITY_BY_LABEL: Record<string, OpenAIImageQuality> = {
  'Borrador': 'low',
  'Estándar': 'medium',
  'Alta': 'high',
  'Máxima': 'xhigh',
};

/** La calidad más baja: es el predeterminado de la app y de cualquier llamada que no indique una */
export const LOWEST_QUALITY: OpenAIImageQuality = 'low';

/**
 * - Modelo: Flare si el nombre lo dice; cualquier otro valor (incluido "GPT Image 2 (OpenAI)" de
 *   registros antiguos) cae en Sunburst, el predeterminado.
 * - Calidad: la elegida; sin calidad indicada (llamadas directas o registros antiguos), la más baja.
 */
export function getOpenAIImageSettings(aiModel: string, renderQuality?: string): { model: OpenAIImageModel; quality: OpenAIImageQuality } {
  const model: OpenAIImageModel = aiModel.includes('Flare') ? 'gpt-image-2.5-flare' : 'gpt-image-2.5-sunburst';
  const quality = QUALITY_BY_LABEL[renderQuality ?? ''] ?? LOWEST_QUALITY;
  return { model, quality };
}
