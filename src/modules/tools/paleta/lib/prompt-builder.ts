import type { DreamHouseParams } from '@/types';
import { present } from '@/modules/shared/lib/prompt-helpers';

// ============================================
// Tools · Paleta de colores
// ============================================
// Dos imágenes de entrada, siempre en este orden:
//   Image 1 = el espacio (interior o exterior) que se recolorea
//   Image 2 = la paleta de colores (muestras, moodboard o foto de referencia)
// La salida es el MISMO espacio, con la misma arquitectura, el mismo ambiente y el mismo paisajismo,
// pero con sus colores llevados a la paleta. No hay selectores de diseño: solo dirección creativa y prompt negativo.

export const PALETTE_INPUT_GUIDE = [
  'INPUT IMAGES:',
  '- Image 1: the SPACE to recolor (an interior or an exterior). This is the base image: its architecture, layout, camera and everything that is not a color must come out identical.',
  '- Image 2: the COLOR PALETTE. Take ONLY its colors (hues, tones, saturation and their relationships) from swatches, color chips or whatever it shows; do NOT copy its objects, shapes, composition, text or labels into the result.',
].join('\n');

/** Líneas de lo que NO puede cambiar (también útiles para pruebas) */
export const PALETTE_PRESERVE_LINES = [
  'The architecture: geometry, volumes, proportions, structure, number of floors, roof shape, openings (doors and windows) and every construction detail stay exactly where and as they are.',
  'The space and its layout: the position, shape and scale of every piece of furniture, fixture and object stay the same; nothing is added, removed, moved or redesigned.',
  'The ambience: light direction, time of day, shadows, reflections, atmosphere and mood stay the same; only the color of the surfaces that receive that light changes.',
  'The landscaping and surroundings: vegetation, trees, plants, lawn, terrain, water, sky and background keep their layout and natural colors (greens stay green, sky stays sky).',
  'The photograph itself: same camera angle, framing, perspective, lens and resolution.',
];

export function buildPalettePrompt(): string {
  const parts: string[] = [
    '[INTENDED USE: Photorealistic color-palette restyling of an existing architectural image]',
    PALETTE_INPUT_GUIDE,
    'TASK — Re-render Image 1 so that its colors follow the palette in Image 2. This is a RECOLORING, not a redesign.',
    [
      'WHAT TO RECOLOR (apply the palette here):',
      '- Walls, ceilings, floors, facades, cladding, roofing and every built surface.',
      '- Furniture, upholstery, textiles, curtains, rugs, cabinetry, decor and objects.',
      '- Paint, tiles, trims, door and window frames, railings and other architectural finishes.',
      'Distribute the palette the way a designer would: the largest surfaces take the dominant tones, secondary surfaces the supporting tones, and small elements the accent tones. Keep each material believable: wood keeps its grain, concrete its texture, glass its transparency, metal its sheen; only their color moves toward the palette.',
    ].join('\n'),
    [
      'MUST STAY EXACTLY AS IN IMAGE 1 (no exceptions):',
      ...PALETTE_PRESERVE_LINES.map((l) => `- ${l}`),
    ].join('\n'),
    'The result must read as the same real photograph of the same place, simply painted and furnished in this palette.',
  ];
  return parts.join('\n\n');
}

/** Mandato + exclusiones del usuario + dirección creativa, como en los demás módulos (la imagen base manda sobre todo) */
export function buildPaletteConstraints(params: DreamHouseParams): string {
  const lines = [
    'COLOR PALETTE MANDATE:',
    '- Every recolored surface must use colors from Image 2; do not introduce other hues, except the natural colors of vegetation, sky, water and skin.',
    '- Architecture, space, ambience and landscaping stay identical to Image 1; only color changes.',
  ];
  if (present(params.negativePrompt)) lines.push(`- Also avoid: ${params.negativePrompt.trim()}`);
  if (present(params.artDirection)) {
    lines.push(
      `- SUPREME MANDATE — The CREATIVE DIRECTION has the highest priority and is MANDATORY: apply "${params.artDirection.trim()}" literally and completely to how the palette is used; where it conflicts with any default rule here, it wins unconditionally (except the structural integrity of Image 1: architecture, layout and landscaping never change).`,
    );
  }
  lines.push('- No extra text, no watermarks, no unrelated logos, no color swatches or palette chips drawn on the image.');
  return lines.join('\n');
}

/** Prompt completo que se envía a la API */
export function buildFullPalettePrompt(params: DreamHouseParams): string {
  return `${buildPalettePrompt()}\n\n[MANDATES & CONSTRAINTS]\n${buildPaletteConstraints(params)}`.trim();
}
