import { DEFAULT_PARAMS, type DreamHouseParams, type RenderBackground, type RenderFormat } from '@/types';
import * as SC from '@/modules/shared/constants';
import { validateCustomSize } from '@/lib/openai-image-core.ts';

// Ajustes de salida que llegan del cliente (o de un historial antiguo). El cliente puede enviar cualquier cosa:
// aquí se garantiza que el modelo, la calidad, el formato y la resolución sean del tipo y del catálogo
// esperados, y si no lo son (o faltan) se aplican los predeterminados de la app
// (GPT Image 2.5 Sunburst, calidad más baja, 16:9, 1K, JPEG, fondo automático y 1 variante).
//
// OJO: esto es para CARGAR (historial, formularios). El servidor NO se apoya en esta normalización para las opciones que
// se cobran: las valida estrictas con `resolveImageOptions` (ver render-options.ts) y rechaza con 400 lo que no sea válido.

const MODES = new Set(['exterior', 'interior', 'edit', 'vistas']);
const inList = (list: readonly string[], v: unknown): v is string => typeof v === 'string' && list.includes(v);

/** Valores antiguos de la resolución: "" y "512" eran 1K (lo más barato); "4K" se acotaba a 2K. */
export function legacyResolution(v: unknown): string {
  if (v === undefined || v === null || v === '' || v === '512') return '1K';
  if (v === '4K') return '2K';
  return typeof v === 'string' ? v : '';
}

export function normalizeRenderSettings(params: DreamHouseParams): DreamHouseParams {
  const aiModel = typeof params.aiModel === 'string' && SC.AI_MODELS.includes(params.aiModel)
    ? params.aiModel
    : DEFAULT_PARAMS.aiModel;
  const renderQuality = (SC.RENDER_QUALITIES as readonly string[]).includes(params.renderQuality as string)
    ? params.renderQuality
    : DEFAULT_PARAMS.renderQuality;
  const renderAspectRatio = inList(SC.ASPECT_RATIOS, params.renderAspectRatio) ? params.renderAspectRatio : DEFAULT_PARAMS.renderAspectRatio;
  const legacy = legacyResolution(params.renderOutputResolution);
  const renderOutputResolution = inList(SC.OUTPUT_RESOLUTIONS, legacy) ? legacy : DEFAULT_PARAMS.renderOutputResolution;
  const size = typeof params.renderCustomSize === 'string' ? params.renderCustomSize : '';
  const sizeOk = /^\d{3,4}x\d{3,4}$/.test(size) && (() => { const [w, h] = size.split('x').map(Number); return validateCustomSize(w, h) === null; })();
  const renderCustomSize = sizeOk ? size : DEFAULT_PARAMS.renderCustomSize;
  const renderFormat = (inList(SC.RENDER_FORMATS, params.renderFormat) ? params.renderFormat : DEFAULT_PARAMS.renderFormat) as RenderFormat;
  const renderBackground = (inList(SC.RENDER_BACKGROUNDS, params.renderBackground) ? params.renderBackground : DEFAULT_PARAMS.renderBackground) as RenderBackground;
  const renderVariants = typeof params.renderVariants === 'number' && Number.isInteger(params.renderVariants) && params.renderVariants >= 1 && params.renderVariants <= 4
    ? params.renderVariants
    : DEFAULT_PARAMS.renderVariants;
  const renderModeration = params.renderModeration === 'low' ? 'low' : 'auto';
  const mode = MODES.has(params.mode as string) ? params.mode : DEFAULT_PARAMS.mode;
  return {
    ...params, mode, aiModel, renderQuality, renderAspectRatio, renderOutputResolution, renderCustomSize,
    renderFormat, renderBackground, renderVariants, renderModeration,
  };
}
