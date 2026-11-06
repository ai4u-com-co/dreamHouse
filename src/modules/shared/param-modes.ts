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

const PLANTA: Modes = ['planta'];
const INT: Modes = ['interior'];
const EDIT: Modes = ['edit'];
const PLANTA_EXT: Modes = ['planta', 'exterior'];
const PLANTA_INT: Modes = ['planta', 'interior'];
const EXT_INT: Modes = ['exterior', 'interior'];
const PLANTA_EXT_INT: Modes = ['planta', 'exterior', 'interior'];
const EXT_VISTAS: Modes = ['exterior', 'vistas'];
const PLANTA_EXT_VISTAS: Modes = ['planta', 'exterior', 'vistas'];
const ALL_DESIGN: Modes = ['exterior', 'interior', 'vistas'];
// Edición: la dirección de diseño de la zona que se cambia (opcional). La luz, el sitio y la cámara NO
// aplican: la edición conserva los de la imagen original.
const DESIGN_EDIT: Modes = ['exterior', 'interior', 'vistas', 'edit'];
const ALL_MODES: Modes = ['planta', 'exterior', 'interior', 'vistas', 'edit'];
const INT_EDIT: Modes = ['interior', 'edit'];

export const PARAM_MODES = {
  // ── Esencia del proyecto (compartida: se edita en un módulo y se ve en el otro) ──
  projectType: ALL_MODES,
  architecturalStyles: ALL_MODES,
  architect: ALL_MODES,
  mood: ALL_MODES,

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
  materials: ALL_MODES,
  finishLevel: DESIGN_EDIT,
  colorPalette: ALL_MODES,

  // ── Cámara y escena ──
  cameraAngle: EXT_INT,
  composition: EXT_INT,
  humanContext: EXT_INT,

  // ── Programa de la vivienda (dormitorios/baños: compartido entre planta, exterior e interior) ──
  bedrooms: PLANTA_EXT_INT,
  bathrooms: PLANTA_EXT_INT,

  // ── Volumetría, huella y programa exterior (compartidos entre planta, exterior y vistas) ──
  size: PLANTA_EXT_VISTAS,
  levels: PLANTA_EXT_VISTAS,
  roofType: EXT_VISTAS,
  layoutType: PLANTA_EXT_VISTAS,
  architecturalDetails: EXT_VISTAS,
  exteriorElements: EXT_VISTAS,
  vegetation: EXT_VISTAS,
  parkingType: PLANTA_EXT,
  parkingSpots: PLANTA_EXT,
  socialAreas: PLANTA_EXT,

  // ── Emplazamiento y construcción (compartidos con planta y vistas) ──
  siteTopography: PLANTA_EXT_VISTAS,
  solarOrientation: PLANTA_EXT_VISTAS,
  constructionSystem: PLANTA_EXT_VISTAS,
  roofMaterial: EXT_VISTAS,
  passiveStrategies: PLANTA_EXT_VISTAS,
  windowType: DESIGN_EDIT,

  // ── Interior (cocina y zona social también se definen desde la planta) ──
  roomType: INT_EDIT,
  roomSizeM2: INT,
  furnitureStyle: INT_EDIT,
  interiorLighting: INT_EDIT,
  flooringMaterial: INT_EDIT,
  ceilingDetail: INT_EDIT,
  kitchenType: PLANTA_INT,
  livingAreaType: PLANTA_INT,
  wallFinish: INT_EDIT,

  // ── Solo edición ──
  editChangeType: EDIT,
  editIntensity: EDIT,
  editPreserve: EDIT,

  // ── Solo planta arquitectónica (división espacial y representación del plano) ──
  floorPlanStyle: PLANTA,
  lotWidthM: PLANTA,
  lotDepthM: PLANTA,
  planSpaces: PLANTA,
  zoningLayout: PLANTA,
  floorPlanAnnotations: PLANTA,
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
export function editableParams(mode: 'planta' | 'exterior' | 'interior' | 'edit'): RegisteredParam[] {
  return (Object.keys(PARAM_MODES) as RegisteredParam[]).filter((k) => appliesTo(k, mode));
}
