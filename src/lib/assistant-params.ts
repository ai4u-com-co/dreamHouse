import { DEFAULT_PARAMS, type DreamHouseParams } from '@/types';
import * as SC from '@/modules/shared/constants';
import * as EC from '@/modules/exterior/constants';
import * as IC from '@/modules/interior/constants';
import * as EDC from '@/modules/edit/constants';
import { DESIGN_PARAM_KEYS } from '@/lib/image-metadata';

// ============================================
// Saneado de parámetros que NO son de confianza
// ============================================
// Dos orígenes, mismo principio: nunca entra al estado ni a un prompt algo que el formulario no ofrece.
//   - la respuesta del asistente IA (texto generado por un modelo)
//   - los metadatos de una imagen subida (los puede haber fabricado cualquiera)
// Política: DENEGAR POR DEFECTO. Cada campo debe tener una lista de valores admitidos; el texto libre
// solo se acepta en los campos que se declaran explícitamente como tales, y siempre acotado.

/** Campos que el asistente nunca debe tocar */
const BLOCKED_KEYS = new Set<string>([
  'mode', 'aiModel', 'renderQuality', 'embedMetadata', 'embedDetails', 'sourceRender', 'selectedVistas',
  'viewType', 'editPrompt', 'thinkingLevel', 'hasExteriorReference',
]);

/** Únicos campos de texto libre admitidos (solo desde el asistente, nunca desde metadatos de imagen) */
const FREE_TEXT_KEYS = new Set<string>(['city', 'artDirection', 'technicalNotes', 'negativePrompt']);
export const FREE_TEXT_MAX_LENGTH = 200;

/** Valores admitidos por campo (los mismos que ofrecen los selectores del formulario) */
const OPTIONS: Partial<Record<keyof DreamHouseParams, readonly string[]>> = {
  architecturalStyles: SC.STYLES, architect: SC.ARCHITECTS, mood: SC.MOODS, colorPalette: SC.COLORS,
  cameraAngle: SC.ANGLES, composition: SC.COMPOSITIONS, timeOfDay: SC.TIMES_OF_DAY, season: SC.SEASONS,
  lighting: SC.LIGHTING_TYPES, humanContext: SC.HUMAN_CONTEXT,
  cameraPreset: SC.CAMERA_PRESET_NAMES, focalLength: SC.FOCAL_LENGTHS, aperture: SC.APERTURES,
  filmSimulation: [...SC.FUJIFILM_FILM_SIMULATIONS, ...SC.UNIVERSAL_FILM_LOOKS, DEFAULT_PARAMS.filmSimulation],
  depthOfField: [...SC.DEPTH_OF_FIELD_OPTIONS, DEFAULT_PARAMS.depthOfField],
  renderStyle: SC.RENDER_STYLES, renderAspectRatio: SC.ASPECT_RATIOS, renderOutputResolution: SC.OUTPUT_RESOLUTIONS,
  projectType: EC.PROJECT_TYPES, climate: EC.CLIMATES, environment: EC.ENVIRONMENTS, waterBody: EC.WATER_BODIES,
  weatherCondition: EC.WEATHER_CONDITIONS, roofType: EC.ROOF_TYPES, parkingType: EC.PARKING_TYPES,
  layoutType: EC.LAYOUT_TYPES, socialAreas: EC.SOCIAL_AREAS, architecturalDetails: EC.ARCHITECTURAL_DETAILS,
  materials: EC.MATERIALS, finishLevel: EC.FINISH_LEVELS, exteriorElements: EC.EXTERIOR_ELEMENTS, vegetation: EC.VEGETATION,
  roomType: IC.ROOM_TYPES, furnitureStyle: IC.FURNITURE_STYLES, interiorLighting: IC.INTERIOR_LIGHTING_TYPES,
  flooringMaterial: IC.FLOORING_MATERIALS, ceilingDetail: IC.CEILING_DETAILS,
  kitchenType: IC.KITCHEN_TYPES, livingAreaType: IC.LIVING_AREA_TYPES,
  editChangeType: EDC.EDIT_CHANGE_TYPES, editIntensity: EDC.EDIT_INTENSITIES, editPreserve: EDC.EDIT_PRESERVE_OPTIONS,
};

/** Máximo de elementos por lista (lo que el propio prompt del asistente le pide) */
const MAX_ITEMS: Partial<Record<keyof DreamHouseParams, number>> = {
  architecturalStyles: 3, architect: 2,
};

export interface SanitizedParams {
  params: Partial<DreamHouseParams>;
  /** Campos o valores que se descartaron, para avisar al usuario */
  dropped: string[];
}
export type SanitizedAssistantParams = SanitizedParams;

/** Texto libre acotado: sin saltos de línea ni caracteres de control, longitud máxima */
function cleanFreeText(text: string): string {
  return text.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, FREE_TEXT_MAX_LENGTH);
}

interface CoreOptions {
  /** Si se indica, solo se aceptan estas claves */
  allowedKeys?: ReadonlySet<string>;
  /** ¿Se admite texto libre en los campos declarados como tales? */
  allowFreeText: boolean;
}

function sanitizeCore(raw: unknown, { allowedKeys, allowFreeText }: CoreOptions): SanitizedParams {
  const params: Record<string, unknown> = {};
  const dropped: string[] = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { params: {}, dropped: ['respuesta inválida'] };

  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (BLOCKED_KEYS.has(key) || !(key in DEFAULT_PARAMS) || (allowedKeys && !allowedKeys.has(key))) {
      dropped.push(key);
      continue;
    }
    const k = key as keyof DreamHouseParams;
    const reference = DEFAULT_PARAMS[k];
    const allowed = OPTIONS[k];

    if (Array.isArray(reference)) {
      const list = (Array.isArray(value) ? value : typeof value === 'string' ? [value] : []).filter((v): v is string => typeof v === 'string');
      if (!allowed) { dropped.push(key); continue; } // denegar por defecto: una lista sin catálogo no se acepta
      const valid = list.filter((v) => allowed.includes(v));
      if (valid.length < list.length) dropped.push(`${key}: ${list.filter((v) => !valid.includes(v)).join(', ').slice(0, 80)}`);
      const capped = MAX_ITEMS[k] ? valid.slice(0, MAX_ITEMS[k]) : valid;
      if (capped.length) params[key] = capped;
    } else if (typeof reference === 'number') {
      const n = typeof value === 'number' ? value : typeof value === 'string' && /^\d{1,4}$/.test(value.trim()) ? Number(value) : NaN;
      if (Number.isFinite(n) && n >= 0 && n <= 9999) params[key] = Math.round(n);
      else dropped.push(key);
    } else if (typeof reference === 'string') {
      const text = typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '';
      if (!text) continue;
      if (key === 'size') {
        // Metros cuadrados (número estricto) o una de las etiquetas de tamaño; nada de "12abc"
        const trimmed = text.trim();
        if (/^\d{1,5}(\.\d+)?$/.test(trimmed) && Number(trimmed) > 0) params[key] = String(Number(trimmed));
        else if (EC.SIZES.includes(text)) params[key] = text;
        else dropped.push(`${key}: ${text.slice(0, 40)}`);
      } else if (allowed) {
        if (allowed.includes(text)) params[key] = text;
        else dropped.push(`${key}: ${text.slice(0, 80)}`);
      } else if (allowFreeText && FREE_TEXT_KEYS.has(key)) {
        const clean = cleanFreeText(text);
        if (clean) params[key] = clean;
      } else {
        dropped.push(key); // sin catálogo y no declarado como texto libre: denegado
      }
    }
    // booleanos y objetos: no se aceptan
  }
  return { params: params as Partial<DreamHouseParams>, dropped };
}

/** Respuesta del asistente IA: campos del formulario con valores que el formulario ofrece */
export function sanitizeAssistantParams(raw: unknown): SanitizedParams {
  return sanitizeCore(raw, { allowFreeText: true });
}

const DESIGN_KEYS = new Set<string>(DESIGN_PARAM_KEYS);

/**
 * Parámetros leídos de los metadatos de una imagen (o recibidos como `sourceRender`): solo la lista
 * de campos de diseño y solo valores del catálogo. Sin texto libre de ningún tipo.
 */
export function sanitizeSourceParams(raw: unknown): Partial<DreamHouseParams> {
  return sanitizeCore(raw, { allowedKeys: DESIGN_KEYS, allowFreeText: false }).params;
}

/** Cadena corta y sin caracteres de control, para nombres que vienen de metadatos */
export function cleanLabel(value: unknown, max = 80): string | undefined {
  return typeof value === 'string' && value.trim() ? cleanFreeText(value).slice(0, max) : undefined;
}
