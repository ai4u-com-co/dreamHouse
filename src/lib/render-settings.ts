import { DEFAULT_PARAMS, type DreamHouseParams } from '@/types';
import * as SC from '@/modules/shared/constants';

// Ajustes de salida que llegan del cliente a /api/generate. El cliente puede enviar cualquier cosa:
// aquí se garantiza que el modelo, la calidad, el formato y la resolución sean del tipo y del catálogo
// esperados, y si no lo son (o faltan) se aplican los predeterminados de la app
// (GPT Image 2.5, calidad más baja y 16:9).

const ASPECT_RATIO_PATTERN = /^\d{1,2}:\d{1,2}$/;
const MODES = new Set(['exterior', 'interior', 'edit', 'vistas']);

export function normalizeRenderSettings(params: DreamHouseParams): DreamHouseParams {
  const aiModel = typeof params.aiModel === 'string' && SC.AI_MODELS.includes(params.aiModel)
    ? params.aiModel
    : DEFAULT_PARAMS.aiModel;
  const renderQuality = (SC.RENDER_QUALITIES as readonly string[]).includes(params.renderQuality as string)
    ? params.renderQuality
    : DEFAULT_PARAMS.renderQuality;
  const renderAspectRatio = typeof params.renderAspectRatio === 'string' && ASPECT_RATIO_PATTERN.test(params.renderAspectRatio)
    ? params.renderAspectRatio
    : DEFAULT_PARAMS.renderAspectRatio;
  const renderOutputResolution = typeof params.renderOutputResolution === 'string' && SC.OUTPUT_RESOLUTIONS.includes(params.renderOutputResolution)
    ? params.renderOutputResolution
    : DEFAULT_PARAMS.renderOutputResolution;
  const mode = MODES.has(params.mode as string) ? params.mode : DEFAULT_PARAMS.mode;
  return { ...params, mode, aiModel, renderQuality, renderAspectRatio, renderOutputResolution };
}
