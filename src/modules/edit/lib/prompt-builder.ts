import type { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { PROJECT_TYPE_MAP } from '@/modules/exterior/lib/prompt-builder';
import { FURNITURE_MAP, INTERIOR_LIGHTING_MAP, ROOM_MAP } from '@/modules/interior/lib/prompt-builder';
import { bulletSection, joinList, present, when } from '@/modules/shared/lib/prompt-helpers';

// ============================================
// Prompt de edición
// ============================================
// La instrucción del usuario manda. Los parámetros de diseño (tipo de espacio, estilo, maestro,
// materiales…) son OPCIONALES y solo orientan el CÓMO del cambio: se aplican a lo que se edita, nunca
// al resto de la imagen. Sin parámetros, el texto es exactamente el histórico.

const CHANGE_TYPE_MAP: Record<string, string> = {
  "Cambiar materiales / acabados": "a change of materials and finishes",
  "Cambiar el color": "a change of color",
  "Cambiar el mobiliario": "a change of furniture",
  "Cambiar la iluminación": "a change of lighting fixtures and lighting design",
  "Añadir un elemento u objeto": "the addition of a new element or object",
  "Quitar un elemento": "the removal of an element; fill the freed area with what would naturally be behind it",
  "Reemplazar un elemento por otro": "the replacement of one element by another",
  "Rediseñar el espacio completo": "a redesign of the whole marked space",
  "Cambiar el ambiente / la atmósfera": "a change of ambience and atmosphere",
};

const INTENSITY_MAP: Record<string, string> = {
  "Sutil (retoque, casi igual)": "SUBTLE — a light retouch that keeps the original recognizable; change as little as the instruction allows",
  "Moderada": "MODERATE — a clearly visible change that still respects the original proportions and logic",
  "Radical (transformación total)": "RADICAL — a complete transformation of the edited area, free to depart from how it looked before",
};

const PRESERVE_MAP: Record<string, string> = {
  "Estructura y volúmenes": "the structure and volumes",
  "Perspectiva y encuadre": "the perspective, framing and camera viewpoint",
  "Iluminación y sombras": "the lighting, light direction and shadows",
  "Colores generales": "the overall color scheme",
  "Mobiliario existente": "the existing furniture",
  "Materiales existentes": "the existing materials",
  "Vegetación y entorno": "the vegetation and surroundings",
  "Aberturas (puertas y ventanas)": "the doors and windows",
};

/** Dirección de diseño elegida para la zona que se edita (vacío si el usuario no eligió nada) */
export function editDesignLines(params: DreamHouseParams): string[] {
  const buildingType = lookup(PROJECT_TYPE_MAP, params.projectType) || params.projectType || '';
  const space = lookup(ROOM_MAP, params.roomType) || params.roomType || '';
  const furniture = joinList((params.furnitureStyle ?? []).map((s) => lookup(FURNITURE_MAP, s) || s));
  const lighting = (params.interiorLighting ?? []).map((l) => lookup(INTERIOR_LIGHTING_MAP, l) || l).join(', complemented by ');
  return [
    when(space, (v) => `Type of space being edited: ${v}; the change must suit how this space is used`),
    when(buildingType, (v) => `Building context: ${/^[aeiou]/i.test(v) ? 'an' : 'a'} ${v}`),
    when(params.architecturalStyles, (v) => `Style of the new design: ${joinList(v)}`),
    when(params.architect, (v) => `Design influence: the principles and sensibility of ${joinList(v, '&')}`),
    when(params.mood, (v) => `Mood: ${v}`),
    when(params.materials, (v) => `Materials to use: ${joinList(v)}`),
    when(params.flooringMaterial, (v) => `Flooring, if it is part of the edit: ${v}`),
    when(params.ceilingDetail, (v) => `Ceiling, if it is part of the edit: ${v}`),
    when(furniture, (v) => `Furniture, if it is part of the edit: ${v}`),
    when(lighting, (v) => `Lighting fixtures, if they are part of the edit: ${v}`),
    when(params.colorPalette, (v) => `Color palette of the new design: ${joinList(v)}`),
    when(params.finishLevel, (v) => `Finish standard: ${v}`),
  ].filter(Boolean);
}

export function buildEditPrompt(params: DreamHouseParams): string {
  const instruction = params.editPrompt ?? '';
  const change = lookup(CHANGE_TYPE_MAP, params.editChangeType);
  const intensity = lookup(INTENSITY_MAP, params.editIntensity);
  const preserve = joinList((params.editPreserve ?? []).map((p) => lookup(PRESERVE_MAP, p) || p));
  const design = editDesignLines(params);

  // Una sola instrucción, acotada: «replace ONLY X» (Cookbook). Lo que se conserva va en el mandato.
  let text = `[INTENDED USE: Photorealistic architectural image edit]\n\nEDIT INSTRUCTION — change ONLY what is described here, nothing else:\n${instruction}`;
  if (change) text += `\n\nKind of change: ${change}.`;
  if (intensity) text += `\n\nIntensity: ${intensity}.`;
  if (design.length) {
    text += `\n\n${bulletSection('DESIGN DIRECTION FOR THE EDITED AREA ONLY (it guides how the change looks; it never authorizes changing anything else)', design).trim()}`;
  }
  if (present(preserve)) text += `\n\nMust stay exactly as in the original, with no exceptions: ${preserve}.`;
  return text;
}
