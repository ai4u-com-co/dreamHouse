import type { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { filmLooksFor } from '@/modules/shared/constants';

// ============================================
// Ayudas compartidas por los constructores de prompt
// ============================================
// Regla de oro: cada campo del formulario que el usuario elige debe llegar al prompt, y un campo
// vacío no debe dejar huecos del tipo "captured during , with  lighting".

/** ¿El valor tiene contenido útil? (cadenas no vacías, listas con elementos, números > 0) */
export function present(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0;
  if (typeof value === 'string') return value.trim() !== '';
  return false;
}

/** Une una lista con "a, b and c" (los elementos vacíos se descartan) */
export function joinList(items: string[] | undefined, conjunction = 'and'): string {
  const clean = (items ?? []).filter(present);
  if (clean.length <= 1) return clean[0] ?? '';
  return `${clean.slice(0, -1).join(', ')} ${conjunction} ${clean[clean.length - 1]}`;
}

/** Texto condicional: devuelve `text(value)` solo si hay valor; si no, cadena vacía */
export function when<T>(value: T, text: (v: T) => string): string {
  return present(value) ? text(value) : '';
}

// ---------- estilo de render ----------

export interface RenderStyleDirective {
  /** ¿Es fotografía? Si no, no se habla de cámara, película ni "photograph" */
  photographic: boolean;
  /** Sustantivo para la frase de apertura: "architectural photograph", "architectural illustration"… */
  medium: string;
  /** Una línea con la dirección visual (para el bloque de restricciones) */
  look: string;
}

const RENDER_STYLE_MAP: Record<string, RenderStyleDirective> = {
  "Fotorrealista": { photographic: true, medium: 'architectural photograph', look: 'Photorealistic architectural photography.' },
  "Editorial / Magazine": { photographic: true, medium: 'editorial architectural photograph', look: 'Editorial architecture-magazine photography: considered composition, refined color grade, restrained retouching.' },
  "3D técnico / Clean render": { photographic: false, medium: 'clean architectural 3D render', look: 'Clean technical 3D render: precise geometry, neutral even lighting, crisp edges, minimal atmosphere.' },
  "Acuarela arquitectónica": { photographic: false, medium: 'architectural watercolor illustration', look: 'Architectural watercolor illustration: translucent washes, visible paper texture, soft bleeding edges, fine ink linework.' },
  "Boceto digital / Sketch": { photographic: false, medium: 'digital architectural sketch', look: 'Digital architectural sketch: confident linework, light tonal hatching, selective color accents.' },
  "Ilustración arquitectónica": { photographic: false, medium: 'architectural illustration', look: 'Architectural illustration: clean shapes, controlled palette, graphic clarity, subtle texture.' },
  "Render artístico / Painterly": { photographic: false, medium: 'painterly architectural render', look: 'Painterly architectural render: visible brushwork, rich color, atmospheric depth.' },
};

/** Sin estilo elegido = fotorrealista (el comportamiento histórico de la app) */
export function resolveRenderStyle(style: string | undefined): RenderStyleDirective {
  return lookup(RENDER_STYLE_MAP, style) ?? RENDER_STYLE_MAP["Fotorrealista"];
}

// ---------- fotografía ----------

/** "Shot on X, 35mm lens at f/5.6, Classic Chrome." — solo con las piezas que existan */
export function cameraSentence(params: DreamHouseParams): string {
  const parts = [
    when(params.cameraPreset, (v) => `shot on ${v}`),
    when(params.focalLength, (v) => `${v} lens`),
    when(params.aperture, (v) => `at ${v}`),
    // Un look que no pertenece a la cámara elegida (p. ej. una simulación Fujifilm con una Canon) no se aplica
    when(filmLooksFor(params.cameraPreset).includes(params.filmSimulation) ? params.filmSimulation : '', (v) => `${v} color rendering`),
  ].filter(Boolean);
  return parts.length ? `${parts.join(', ')}` : '';
}

// ---------- detalles que antes se perdían ----------

/** "3 bedrooms, 2 bathrooms": el programa de la vivienda, válido como contexto en exterior e interior */
function homeProgram(params: DreamHouseParams): string[] {
  return [
    when(params.bedrooms, (v) => `${v} bedroom${v > 1 ? 's' : ''}`),
    when(params.bathrooms, (v) => `${v} bathroom${v > 1 ? 's' : ''}`),
  ].filter(Boolean);
}

/** Campos del módulo exterior que el usuario elige y que antes no llegaban al prompt */
export function exteriorDetailLines(params: DreamHouseParams): string[] {
  const parking = present(params.parkingType) && !/sin estacionamiento/i.test(params.parkingType)
    ? `${params.parkingType}${present(params.parkingSpots) ? ` (${params.parkingSpots} spaces)` : ''}`
    : /sin estacionamiento/i.test(params.parkingType ?? '') ? 'no parking visible' : '';
  return [
    when(params.climate, (v) => `Climate: ${v} — light quality, vegetation and building response should feel native to it`),
    when(params.waterBody, (v) => `Water on site: ${v}`),
    when(params.weatherCondition, (v) => `Weather: ${v}`),
    when(params.roofType, (v) => `Roof: ${v}`),
    when(params.roofMaterial, (v) => `Roof covering: ${v}`),
    when(params.constructionSystem, (v) => `Construction system (visible in the structure, proportions and joints): ${v}`),
    when(params.windowType, (v) => `Openings: ${v}`),
    when(params.siteTopography, (v) => `Terrain: ${v}; the building must sit on it with believable foundations, retaining walls and levels`),
    when(params.solarOrientation, (v) => `Orientation: ${v}; sun direction and shadows must be consistent with it`),
    when(params.passiveStrategies, (v) => `Passive and bioclimatic strategies expressed in the architecture: ${joinList(v)}`),
    when(parking, (v) => `Parking: ${v}`),
    when(params.socialAreas, (v) => `Social areas expressed in the design: ${joinList(v)}`),
    when(params.exteriorElements, (v) => `Exterior elements present: ${joinList(v)}`),
    when(params.vegetation, (v) => `Landscaping and vegetation: ${joinList(v)}`),
    when(params.architecturalDetails, (v) => `Architectural details: ${joinList(v)}`),
    when(params.colorPalette, (v) => `Facade color palette: ${joinList(v)}`),
    when(homeProgram(params), (v) => `Home program (what the building must accommodate): ${joinList(v)}`),
    when(params.mood, (v) => `Mood: ${v}`),
    when(params.composition, (v) => `Framing preference: ${v}`),
    when(params.humanContext, (v) => `Human presence: ${v}`),
  ].filter(Boolean);
}

/**
 * Lo que el interior comparte con el exterior: el tipo de edificio y el sitio. En un interior definen
 * lo que se ve por las ventanas y la luz natural. `buildingType` es el tipo ya traducido al inglés.
 */
export function interiorContextLines(params: DreamHouseParams, buildingType: string): string[] {
  const season = present(params.season) ? ` in ${params.season}` : '';
  return [
    when(buildingType, (v) => `Building context: the space belongs to ${/^[aeiou]/i.test(v) ? 'an' : 'a'} ${v}; its character should feel coherent with it`),
    when(params.city, (v) => `Location: ${v}`),
    when(params.environment, (v) => `Surroundings visible through the windows: ${v}`),
    when(params.climate, (v) => `Climate: ${v} — the natural light and what is seen outside should feel native to it`),
    when(params.waterBody, (v) => `Water at the site: ${v}, glimpsed through the windows where the layout allows`),
    when(params.weatherCondition, (v) => `Weather outside: ${v}`),
    present(params.timeOfDay)
      ? `Natural daylight entering the space: ${params.timeOfDay}${season}`
      : when(params.season, (v) => `Season outside: ${v}`),
    when(params.lighting, (v) => `Natural light quality: ${v}`),
  ].filter(Boolean);
}

/** Campos del módulo interior que antes no llegaban al prompt */
export function interiorDetailLines(params: DreamHouseParams, buildingType = ''): string[] {
  return [
    ...interiorContextLines(params, buildingType),
    when(params.wallFinish, (v) => `Wall finish: ${v}`),
    when(params.windowType, (v) => `Openings: ${v}`),
    when(params.kitchenType, (v) => `Kitchen type: ${v}`),
    when(params.livingAreaType, (v) => `Living area type: ${v}`),
    when(homeProgram(params), (v) => `Home program (context for the space): ${joinList(v)}`),
    when(params.finishLevel, (v) => `Finish standard: ${v}`),
    when(params.mood, (v) => `Mood: ${v}`),
    when(params.cameraAngle, (v) => `Camera angle: ${v}`),
    when(params.composition, (v) => `Framing preference: ${v}`),
    when(params.humanContext, (v) => `Human presence: ${v}`),
  ].filter(Boolean);
}

/** Convierte las líneas en una sección de lista; vacío si no hay líneas */
export function bulletSection(title: string, lines: string[]): string {
  return lines.length ? `${title}:\n${lines.map((l) => `- ${l}`).join('\n')}\n` : '';
}

/** Las mismas líneas como una frase corrida (para el estilo narrativo de Gemini) */
export function narrativeSentence(lines: string[]): string {
  return lines.length ? `${lines.join('. ')}. ` : '';
}
