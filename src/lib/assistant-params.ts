import { DEFAULT_PARAMS, type DreamHouseParams } from '@/types';
import * as SC from '@/modules/shared/constants';
import * as EC from '@/modules/exterior/constants';
import * as IC from '@/modules/interior/constants';

// ============================================
// Saneado de lo que devuelve el asistente IA
// ============================================
// El asistente convierte una idea en texto libre en parámetros del formulario. Su respuesta es
// texto generado por un modelo: nunca debe pisar el estado sin validar. Aquí se queda solo con
// campos que existen, del tipo correcto y con valores que el formulario realmente ofrece.

/** Campos que el asistente nunca debe tocar */
const BLOCKED_KEYS = new Set<string>([
  'mode', 'aiModel', 'renderQuality', 'embedMetadata', 'sourceRender', 'selectedVistas',
  'viewType', 'editPrompt', 'thinkingLevel', 'hasExteriorReference',
]);

/** Valores admitidos por campo (los mismos que ofrecen los selectores del formulario) */
const OPTIONS: Partial<Record<keyof DreamHouseParams, readonly string[]>> = {
  architecturalStyles: SC.STYLES, architect: SC.ARCHITECTS, mood: SC.MOODS, colorPalette: SC.COLORS,
  cameraAngle: SC.ANGLES, composition: SC.COMPOSITIONS, timeOfDay: SC.TIMES_OF_DAY, season: SC.SEASONS,
  lighting: SC.LIGHTING_TYPES, humanContext: SC.HUMAN_CONTEXT,
  projectType: EC.PROJECT_TYPES, climate: EC.CLIMATES, environment: EC.ENVIRONMENTS, waterBody: EC.WATER_BODIES,
  weatherCondition: EC.WEATHER_CONDITIONS, roofType: EC.ROOF_TYPES, parkingType: EC.PARKING_TYPES,
  layoutType: EC.LAYOUT_TYPES, socialAreas: EC.SOCIAL_AREAS, architecturalDetails: EC.ARCHITECTURAL_DETAILS,
  materials: EC.MATERIALS, finishLevel: EC.FINISH_LEVELS, exteriorElements: EC.EXTERIOR_ELEMENTS, vegetation: EC.VEGETATION,
  roomType: IC.ROOM_TYPES, furnitureStyle: IC.FURNITURE_STYLES, interiorLighting: IC.INTERIOR_LIGHTING_TYPES,
  flooringMaterial: IC.FLOORING_MATERIALS, ceilingDetail: IC.CEILING_DETAILS,
  kitchenType: IC.KITCHEN_TYPES, livingAreaType: IC.LIVING_AREA_TYPES,
};

/** Máximo de elementos por lista (lo que el propio prompt del asistente le pide) */
const MAX_ITEMS: Partial<Record<keyof DreamHouseParams, number>> = {
  architecturalStyles: 3, architect: 2,
};

export interface SanitizedAssistantParams {
  params: Partial<DreamHouseParams>;
  /** Campos o valores que se descartaron, para avisar al usuario */
  dropped: string[];
}

export function sanitizeAssistantParams(raw: unknown): SanitizedAssistantParams {
  const params: Record<string, unknown> = {};
  const dropped: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { params: {}, dropped: ['respuesta inválida'] };

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(key) || !(key in DEFAULT_PARAMS)) {
      dropped.push(key);
      continue;
    }
    const k = key as keyof DreamHouseParams;
    const reference = DEFAULT_PARAMS[k];
    const allowed = OPTIONS[k];

    if (Array.isArray(reference)) {
      const list = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((v): v is string => typeof v === 'string');
      const valid = allowed ? list.filter((v) => allowed.includes(v)) : list;
      if (valid.length < list.length) dropped.push(`${key}: ${list.filter((v) => !valid.includes(v)).join(', ')}`);
      const capped = MAX_ITEMS[k] ? valid.slice(0, MAX_ITEMS[k]) : valid;
      if (capped.length) params[key] = capped;
    } else if (typeof reference === 'number') {
      const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
      if (Number.isFinite(n) && n >= 0) params[key] = Math.round(n);
      else dropped.push(key);
    } else if (typeof reference === 'string') {
      const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
      if (!text) continue;
      if (key === 'size') {
        // `size` acepta metros cuadrados (un número) o una de las etiquetas de tamaño
        const meters = parseFloat(text);
        if ((Number.isFinite(meters) && meters > 0) || EC.SIZES.includes(text)) params[key] = text;
        else dropped.push(`${key}: ${text}`);
      } else if (allowed && !allowed.includes(text)) {
        dropped.push(`${key}: ${text}`);
      } else {
        params[key] = text;
      }
    }
    // booleanos y objetos: no se aceptan del asistente
  }
  return { params: params as Partial<DreamHouseParams>, dropped };
}
