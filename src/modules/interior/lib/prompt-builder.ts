import { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { PROJECT_TYPE_MAP } from '@/modules/exterior/lib/prompt-builder';
import {
  bulletSection,
  cameraSentence,
  interiorDetailLines,
  joinList,
  narrativeSentence,
  present,
  resolveRenderStyle,
  when,
} from '@/modules/shared/lib/prompt-helpers';

const ROOM_MAP: Record<string, string> = {
  "Baño principal": "a luxurious master bathroom sanctuary",
  "Biblioteca/Estudio": "a sophisticated private library and study",
  "Cocina gourmet": "a state-of-the-art gourmet kitchen",
  "Comedor formal": "an elegant formal dining room",
  "Cuarto de juegos": "a vibrant and spacious playroom",
  "Dormitorio principal": "a serene master bedroom suite",
  "Gimnasio privado": "a high-end private home gym",
  "Home Cinema": "a professional-grade home cinema",
  "Pasillo/Galería": "a dramatic architectural gallery hallway",
  "Recibidor/Entryway": "a grand and welcoming entryway",
  "Sala de estar/Living room": "a breathtaking expansive living room",
  "Terraza/Deck interior": "a seamless indoor-outdoor terrace",
  "Vestidor/Walk-in closet": "a bespoke luxury walk-in closet"
};

const FURNITURE_MAP: Record<string, string> = {
  "Bespoke / Hecho a medida": "bespoke custom-crafted furniture",
  "Bohemio": "eclectic bohemian furnishings",
  "Clásico/Tradicional": "timeless classical furniture pieces",
  "Diseño de autor (Iconic Designers)": "iconic designer furniture and high-end curated pieces",
  "Escandinavo": "clean-lined Scandinavian furniture",
  "Industrial": "raw industrial-style furnishings",
  "Maximalista": "bold maximalist interior decor",
  "Mid-Century Modern": "authentic mid-century modern furniture",
  "Minimalista": "restrained minimalist furniture",
  "Rústico moderno": "warm modern rustic furnishings"
};

const INTERIOR_LIGHTING_MAP: Record<string, string> = {
  "Candelabro/Lámpara colgante": "a dramatic statement chandelier",
  "Iluminación de riel (Track lighting)": "discreet architectural track lighting",
  "Iluminación indirecta (Cove lighting)": "soft atmospheric cove lighting",
  "Lámparas de pie/diseño": "curated designer floor lamps",
  "LED empotrados (Recessed)": "precision recessed LED spots",
  "Luz natural cenital (Skylight)": "abundant natural light from a monumental skylight",
  "Luz natural lateral (Grandes ventanales)": "flooded with natural light through floor-to-ceiling windows"
};

function getRoomScaleDesc(m2: number): string {
  if (!m2 || m2 <= 0) return "";
  if (m2 < 10) return `an intimate ${m2}m² micro-space`;
  if (m2 < 20) return `a compact ${m2}m² room`;
  if (m2 < 35) return `a well-proportioned ${m2}m² room`;
  if (m2 < 60) return `a generous ${m2}m² space`;
  if (m2 < 100) return `a spacious ${m2}m² living area`;
  return `a grand ${m2}m² expansive space`;
}

export function buildInteriorPrompt(params: DreamHouseParams, targetModel?: string, hasSpacePhoto: boolean = false): string {
  const roomDesc = lookup(ROOM_MAP, params.roomType) || "a beautifully designed interior space";
  const scaleDesc = getRoomScaleDesc(params.roomSizeM2);
  const isOpenAI = targetModel?.includes('OpenAI') || false;
  const style = resolveRenderStyle(params.renderStyle);
  // El tipo de proyecto y el sitio son los mismos del exterior (esencia compartida entre módulos)
  const buildingType = lookup(PROJECT_TYPE_MAP, params.projectType) || params.projectType || '';
  const detailLines = interiorDetailLines(params, buildingType);

  const styleDesc = joinList(params.architecturalStyles) || "contemporary";
  const architectDesc = joinList(params.architect, '&');
  const furnitureDesc = joinList((params.furnitureStyle ?? []).map(s => lookup(FURNITURE_MAP, s) || s));
  const lightingDesc = (params.interiorLighting ?? []).map(l => lookup(INTERIOR_LIGHTING_MAP, l) || l).join(', complemented by ');
  const materialList = (params.materials ?? []).filter(present).join(', ');
  const colorDesc = joinList(params.colorPalette);
  const camera = style.photographic ? cameraSentence(params) : "";
  // Remodelación: lo que se conserva es la envolvente; el estilo y el maestro elegidos mandan sobre el rediseño
  const remodelDirection = [
    styleDesc && `the ${styleDesc} style`,
    architectDesc && `the design principles of ${architectDesc}`,
  ].filter(Boolean).join(' and ');
  const spaceNote = hasSpacePhoto
    ? `Redesign the existing space shown in the reference photo: keep its architectural shell (walls, openings, ceiling height) and its camera viewpoint, and change only the design, furnishings, finishes and lighting. Apply ${remodelDirection} to the redesign of every surface, piece and light source.`
    : "";

  if (isOpenAI) {
    const prompt = `
[INTENDED USE: Professional Architectural Interior Design Visualization]

SCENE & CONTEXT:
- Subject: ${roomDesc}${scaleDesc ? ` (${scaleDesc})` : ""}
- Perspective: ${present(params.cameraAngle) ? `${params.cameraAngle}, inside the space` : "Inside the space, looking at the layout and key features"}
${spaceNote ? `- Existing space: ${spaceNote}\n` : ""}
ARCHITECTURAL & DESIGN SPECIFICATION:
- Style: ${styleDesc} character${architectDesc ? `, shaped by the design principles of ${architectDesc}` : ""}
${furnitureDesc ? `- Furniture: Curated pieces of ${furnitureDesc}. Each piece sits with physical weight, showing natural material texture and subtle wear at contact points.\n` : ""}${params.flooringMaterial ? `- Flooring: ${params.flooringMaterial}, rendered with convincing grain and joint lines\n` : ""}${params.ceilingDetail ? `- Ceiling: ${params.ceilingDetail}, confirmed by subtle shadow and texture\n` : ""}${materialList ? `- Materials: ${materialList} elements throughout the space. Each material must show honest texture, grain direction, and micro-imperfections.\n` : ""}${colorDesc ? `- Color Palette: ${colorDesc}, colors shifting naturally across surfaces based on light angle\n` : ""}${bulletSection('ADDITIONAL DESIGN SPECIFICATION', detailLines)}
${style.photographic ? 'PHOTOGRAPHY & LIGHTING' : 'VISUAL TREATMENT & LIGHTING'}:
${camera ? `- Camera Config: ${camera}\n` : ""}${style.photographic ? `- Depth of Field: ${params.depthOfField || "Natural depth of field separating foreground from background"}\n` : ""}${lightingDesc ? `- Lighting: Illuminated by ${lightingDesc}. Light falls with natural gradient and fall-off from bright source to soft shadow.\n` : ""}${params.artDirection ? `- Art Direction: ${params.artDirection}\n` : ""}
CONSTRAINTS & QUALITY:
- Look: ${style.photographic ? `${style.look} High tactile presence and physical weight.` : style.look}
- Exclude: ${style.photographic ? "No digital/CGI smoothness, no plastic surfaces, no over-sharpened edges. " : ""}No watermarks, no logos.
`.trim();
    return prompt;
  }

  // Classic Gemini flow
  const article = /^[aeiou]/i.test(style.medium) ? 'An' : 'A';
  let prompt = `${article} ${style.medium.replace('architectural ', 'architectural interior ')} taken inside ${roomDesc}${scaleDesc ? ` — ${scaleDesc}` : ""}. `;
  if (spaceNote) prompt += `${spaceNote} `;

  prompt += `The space carries a ${styleDesc} character`;
  if (architectDesc) {
    prompt += `, shaped by the design principles of ${architectDesc}`;
  }
  prompt += `. `;

  if (furnitureDesc) {
    prompt += `Every object in the room is ${furnitureDesc} — `;
    prompt += `each piece sits with the physical weight of a real object: surfaces show natural material variation, `;
    prompt += `subtle wear at edges and contact points, and the honest craft marks that separate handmade from digital. `;
  }

  if (lightingDesc) {
    prompt += `The room is illuminated by ${lightingDesc}. `;
    prompt += `Light falls with natural gradient and fall-off — bright at source, dissolving into soft shadow — `;
    prompt += `revealing surface depth, material texture, and the three-dimensional volume of every form. `;
  }

  // Materials with physical specificity
  prompt += when(params.flooringMaterial, (v) => `The floor is ${v} — its grain, joint lines, and surface sheen are physically convincing. `);
  prompt += when(params.ceilingDetail, (v) => `The ceiling is ${v}, its material presence confirmed by subtle shadow and texture. `);

  if (materialList) {
    prompt += `Throughout the space: ${materialList} — each rendered with honest texture, `;
    prompt += `natural color variation across the surface, and the controlled micro-imperfections `;
    prompt += `(pore structure, grain direction, slight tonal shifts) that distinguish real material from a smooth CGI simulation. `;
  }

  if (colorDesc) {
    prompt += `Color palette: ${colorDesc}, rendered as pigment and light interact physically — `;
    prompt += `colors shift subtly across planes as light angle changes. `;
  }

  prompt += narrativeSentence(detailLines);

  // Camera integrated naturally into the scene
  if (camera) {
    prompt += `${camera.charAt(0).toUpperCase()}${camera.slice(1)} — `;
    prompt += `depth of field separates foreground objects from a naturally softened background. `;
  }

  if (params.artDirection) {
    prompt += `\nCreative Direction: ${params.artDirection}. `;
  }

  if (style.photographic) {
    // Quality instruction: specific realism criteria, not generic tags
    prompt += `\nThe image must feel like a photograph, not a render: imperfect enough to be believed, `;
    prompt += `lit well enough to be aspirational. No plastic surfaces, no over-sharpened edges, `;
    prompt += `no uniform smoothness on any material. Shadows have soft gradient fall-off. `;
    prompt += `Every surface has physical weight and tactile presence.`;
  } else {
    prompt += `\n${style.look}`;
  }

  return prompt.trim();
}
