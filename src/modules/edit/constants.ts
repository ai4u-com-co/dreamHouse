// ============================================
// DREAMHOUSE PRO - EDIT MODULE CONSTANTS
// ============================================
// Parámetros propios de la edición de un espacio. El resto de la dirección de diseño (tipo de edificio,
// tipo de espacio, estilo, arquitecto, materiales, mobiliario…) es la MISMA de exterior e interior y se
// registra en `modules/shared/param-modes.ts`.

/** Qué clase de cambio se pide (orienta al modelo sobre cómo tratar la zona) */
export const EDIT_CHANGE_TYPES = [
  "Cambiar materiales / acabados",
  "Cambiar el color",
  "Cambiar el mobiliario",
  "Cambiar la iluminación",
  "Añadir un elemento u objeto",
  "Quitar un elemento",
  "Reemplazar un elemento por otro",
  "Rediseñar el espacio completo",
  "Cambiar el ambiente / la atmósfera",
];

/** Cuánto se permite transformar la zona marcada */
export const EDIT_INTENSITIES = [
  "Sutil (retoque, casi igual)",
  "Moderada",
  "Radical (transformación total)",
];

/** Lo que NO debe cambiar fuera de la edición pedida */
export const EDIT_PRESERVE_OPTIONS = [
  "Estructura y volúmenes",
  "Perspectiva y encuadre",
  "Iluminación y sombras",
  "Colores generales",
  "Mobiliario existente",
  "Materiales existentes",
  "Vegetación y entorno",
  "Aberturas (puertas y ventanas)",
];
