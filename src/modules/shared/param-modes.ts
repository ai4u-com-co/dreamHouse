import type { DreamHouseParams, GenerationMode } from '@/types';

// ============================================
// Registro único: qué parámetro aplica a qué módulo
// ============================================
// Todos los módulos comparten UN solo estado (`params` en el Studio). Lo que cambia de un módulo a otro
// es qué parámetros son relevantes. Esa decisión vivía repartida (formularios, panel "Design Spec",
// randomizador, endpoint) y se desalineaba: un campo podía existir en el estado y en el prompt pero no
// tener control en pantalla (le pasó a `projectType` en interior, y a `humanContext` y `parkingSpots`
// en todos).
//
// Regla: si un parámetro está aquí para un módulo, ese módulo DEBE (1) mostrar un control para él y
// (2) usarlo en su prompt. `tests/unit/param-wiring.test.mjs` lo verifica; añadir un campo aquí sin
// cablearlo rompe la prueba.
//
// 'edit' usa un subconjunto opcional: la dirección de diseño de la zona que se cambia.
// 'vistas' hereda su diseño del render original (`sourceRender`): consume los parámetros pero no los
// edita, por eso aparece aquí solo para el panel y el prompt, no para la prueba de controles.

type Modes = readonly GenerationMode[];

const EXT: Modes = ['exterior'];
const INT: Modes = ['interior'];
const EDIT: Modes = ['edit'];
const EXT_INT: Modes = ['exterior', 'interior'];
const EXT_VISTAS: Modes = ['exterior', 'vistas'];
const ALL_DESIGN: Modes = ['exterior', 'interior', 'vistas'];
// Edición: la dirección de diseño de la zona que se cambia (opcional). La luz, el sitio y la cámara NO
// aplican: la edición conserva los de la imagen original.
const DESIGN_EDIT: Modes = ['exterior', 'interior', 'vistas', 'edit'];
const INT_EDIT: Modes = ['interior', 'edit'];

export const PARAM_MODES = {
  // ── Esencia del proyecto (compartida: se edita en un módulo y se ve en el otro) ──
  projectType: DESIGN_EDIT,
  architecturalStyles: DESIGN_EDIT,
  architect: DESIGN_EDIT,
  mood: DESIGN_EDIT,

  // ── Sitio y luz natural (en interior definen lo que entra por las ventanas) ──
  city: ALL_DESIGN,
  climate: ALL_DESIGN,
  environment: ALL_DESIGN,
  waterBody: ALL_DESIGN,
  weatherCondition: ALL_DESIGN,
  timeOfDay: ALL_DESIGN,
  season: ALL_DESIGN,
  lighting: ALL_DESIGN,

  // ── Materialidad y estética ──
  materials: DESIGN_EDIT,
  finishLevel: DESIGN_EDIT,
  colorPalette: DESIGN_EDIT,

  // ── Cámara y escena ──
  cameraAngle: EXT_INT,
  composition: EXT_INT,
  humanContext: EXT_INT,

  // ── Programa de la vivienda (dormitorios/baños: contexto también para el exterior) ──
  bedrooms: EXT_INT,
  bathrooms: EXT_INT,

  // ── Solo exterior (y vistas, que lo hereda) ──
  size: EXT_VISTAS,
  levels: EXT_VISTAS,
  roofType: EXT_VISTAS,
  layoutType: EXT_VISTAS,
  architecturalDetails: EXT_VISTAS,
  exteriorElements: EXT_VISTAS,
  vegetation: EXT_VISTAS,
  parkingType: EXT,
  parkingSpots: EXT,
  socialAreas: EXT,

  // ── Solo interior ──
  roomType: INT_EDIT,
  roomSizeM2: INT,
  furnitureStyle: INT_EDIT,
  interiorLighting: INT_EDIT,
  flooringMaterial: INT_EDIT,
  ceilingDetail: INT_EDIT,
  kitchenType: INT,
  livingAreaType: INT,

  // ── Solo edición ──
  editChangeType: EDIT,
  editIntensity: EDIT,
  editPreserve: EDIT,
} as const satisfies Partial<Record<keyof DreamHouseParams, Modes>>;

export type RegisteredParam = keyof typeof PARAM_MODES;

/** Módulos en los que aplica un parámetro (vacío si no está registrado) */
export function modesFor(key: keyof DreamHouseParams): readonly GenerationMode[] {
  return (PARAM_MODES as Partial<Record<keyof DreamHouseParams, Modes>>)[key] ?? [];
}

/** ¿El parámetro forma parte del diseño en este módulo? */
export function appliesTo(key: keyof DreamHouseParams, mode: GenerationMode): boolean {
  return modesFor(key).includes(mode);
}

/** Parámetros que el módulo debe poder editar (excluye 'vistas', que hereda y no edita) */
export function editableParams(mode: 'exterior' | 'interior' | 'edit'): RegisteredParam[] {
  return (Object.keys(PARAM_MODES) as RegisteredParam[]).filter((k) => appliesTo(k, mode));
}
