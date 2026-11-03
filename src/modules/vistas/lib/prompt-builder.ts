import { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { VISTA_DESCRIPTIONS, VISTA_KINDS, type VistaKind } from '../constants';
import { PROJECT_TYPE_MAP } from '@/modules/exterior/lib/prompt-builder';
import { sanitizeSourceParams } from '@/lib/assistant-params';
import {
  cameraSentence,
  joinList,
  present,
  resolveRenderStyle,
  when,
} from '@/modules/shared/lib/prompt-helpers';

/**
 * Cómo debe comportarse el modelo según lo que la vista le exige respecto a la referencia.
 * El objetivo es siempre el mismo: LA MISMA CASA. Lo único que cambia es el punto de vista
 * (o, en las vistas de iluminación, solo la hora).
 */
const KIND_RULES: Record<VistaKind, string> = {
  seen: "This view shows parts of the building that are visible in the reference. Every visible element must stay identical: only the camera position, distance and angle change.",
  unseen: "This view shows sides or elements that are NOT visible in the reference. Extrapolate them conservatively: continue the same materials, window rhythm and proportions, floor-to-floor heights, roof geometry and level of finish. Do NOT add new volumes, extra floors, towers or features that the visible design does not imply. Anything visible in the reference that is also visible from this angle must match it exactly.",
  lighting: "Only the time of day and the lighting change. Geometry, materials, openings, landscaping and surroundings stay identical to the reference; interior and exterior lights switch on as the hour requires.",
  detail: "This is a close view of a real detail of the reference. Show only details consistent with the reference's materials, joints and proportions; do not invent new materials or components.",
  diagram: "This is a deliberate architectural representation (cut or exploded view), not a photograph. Keep the design language, volumes, proportions and materiality of the reference; simplifying is allowed, redesigning is not.",
};

/** Campos de diseño que se heredan del render original cuando el usuario no los eligió de nuevo */
const INHERITED_KEYS = [
  'projectType', 'levels', 'architecturalStyles', 'architect', 'materials', 'finishLevel',
  'roofType', 'layoutType', 'colorPalette', 'environment', 'city', 'climate', 'vegetation',
  'waterBody', 'weatherCondition', 'timeOfDay', 'season', 'lighting', 'mood', 'renderStyle',
  'exteriorElements', 'architecturalDetails', 'size',
] as const;

/**
 * Parámetros efectivos de la vista: lo que el usuario eligió para esta vista manda; lo que dejó
 * vacío se hereda de los parámetros con los que se generó el render original (si se conocen).
 */
export function effectiveVistaParams(params: DreamHouseParams): DreamHouseParams {
  // El render de origen lo envía el cliente (y sus parámetros pueden venir de los metadatos de una imagen
  // ajena): se vuelve a validar aquí, y solo entran valores que el formulario ofrece.
  const source = params.sourceRender ? sanitizeSourceParams(params.sourceRender.params) : undefined;
  if (!source || Object.keys(source).length === 0) return params;
  const merged = { ...params } as Record<string, unknown>;
  for (const key of INHERITED_KEYS) {
    if (!present(merged[key]) && present((source as Record<string, unknown>)[key])) {
      merged[key] = (source as Record<string, unknown>)[key];
    }
  }
  return merged as unknown as DreamHouseParams;
}

/** "DESIGN FACTS": lo que se sabe del diseño y que no puede cambiar entre vistas */
function designFactLines(p: DreamHouseParams): string[] {
  const projectType = lookup(PROJECT_TYPE_MAP, p.projectType) || p.projectType;
  const site = [p.environment, p.climate, p.city].filter(present).join(', ');
  return [
    when(projectType, (v) => `Building type: ${v}`),
    when(p.levels, (v) => `Exactly ${v} floor${v > 1 ? 's' : ''}`),
    when(p.architecturalStyles, (v) => `Architectural style: ${joinList(v)}${present(p.architect) ? `, in the language of ${joinList(p.architect, '&')}` : ''}`),
    when(p.materials, (v) => `Materials: ${joinList(v)}${present(p.finishLevel) ? `, finished to a ${p.finishLevel} standard` : ''}`),
    when(p.roofType, (v) => `Roof: ${v}`),
    when(p.layoutType, (v) => `Spatial layout: ${v}`),
    when(p.colorPalette, (v) => `Color palette: ${joinList(v)}`),
    when(site, (v) => `Site: ${v}`),
    when(p.vegetation, (v) => `Landscaping: ${joinList(v)}`),
    when(p.exteriorElements, (v) => `Exterior elements: ${joinList(v)}`),
    when(p.architecturalDetails, (v) => `Architectural details: ${joinList(v)}`),
  ].filter(Boolean);
}

/** Continuidad de ambiente entre las vistas de un mismo portafolio */
function continuityLines(p: DreamHouseParams, kind: VistaKind): string[] {
  if (kind === 'lighting') return [
    when(p.season, (v) => `Season: ${v}`),
    when(p.weatherCondition, (v) => `Weather: ${v}`),
  ].filter(Boolean);
  return [
    when(p.timeOfDay, (v) => `Time of day: ${v}`),
    when(p.season, (v) => `Season: ${v}`),
    when(p.lighting, (v) => `Light quality: ${v}`),
    when(p.weatherCondition, (v) => `Weather: ${v}`),
  ].filter(Boolean);
}

/**
 * Builds a narrative prompt for architectural vistas based on a base image.
 * The prompt emphasizes maintaining the core design elements of the reference house
 * while changing the perspective or focus, and uses the parameters of the original render
 * (when known) as fixed design facts so every view of the portfolio stays consistent.
 */
export function buildVistasPrompt(rawParams: DreamHouseParams, viewType: string, targetModel?: string): string {
  const params = effectiveVistaParams(rawParams);
  const vistaDescription = lookup(VISTA_DESCRIPTIONS, viewType) || "A professional architectural view.";
  const kind: VistaKind = lookup(VISTA_KINDS, viewType) ?? 'seen';
  const isOpenAI = targetModel?.includes('OpenAI') || false;
  const style = resolveRenderStyle(params.renderStyle);
  const hasSource = !!rawParams.sourceRender;

  const styles = params.architecturalStyles.length > 0
    ? `maintaining the ${params.architecturalStyles.join(' and ')} style`
    : "maintaining its original architectural style";

  const architectCredit = params.architect.length > 0
    ? `as seen through the lens of ${params.architect.join(' and ')}`
    : "";

  const materialList = params.materials.join(', ') || 'all original facade materials';
  const lightingCtx = params.lighting
    ? `${params.lighting} light — with clear shadow direction, soft gradient fall-off, and surface-specific specularity`
    : "lighting that matches the reference image — preserve its shadow direction, intensity, and color temperature";
  const facts = designFactLines(params);
  const continuity = continuityLines(params, kind);
  const camera = style.photographic ? cameraSentence(params) : "";
  const moodLine = params.mood || "Professional, high-end architectural presentation — evocative but not over-processed.";

  if (isOpenAI) {
    const prompt = `
[INTENDED USE: Professional Architectural Portfolio Image]

TASK:
- Action: Generate a new ${viewType} of the SAME house shown in the reference image. Same house, different camera.
- Camera Perspective: ${vistaDescription}
- View rule: ${KIND_RULES[kind]}

IDENTITY LOCK (identical to the reference, do not restyle or redesign):
- Overall massing and proportions, number of floors, roof shape and geometry.
- Position, size and rhythm of windows, doors and openings.
- Materials, colors and finishes; landscaping and surrounding site.
- Style: replicate the design language ${styles}${architectCredit ? ` ${architectCredit}` : ""}.
${facts.length ? `\nDESIGN FACTS${hasSource ? " (from the original render's parameters)" : ""} — fixed, must match the reference:\n${facts.map((l) => `- ${l}`).join('\n')}\n` : ""}${continuity.length ? `\nCONTINUITY with the rest of the portfolio:\n${continuity.map((l) => `- ${l}`).join('\n')}\n` : ""}
COMPOSITION:
- Subject: the building is the sole protagonist, standing completely alone.
- Background: neutral (open sky, landscape or vegetation).
- Exclude: neighboring buildings, adjacent houses, other structures, party walls and competing architecture.

${style.photographic ? "PHOTOGRAPHY & LIGHTING" : "VISUAL TREATMENT & LIGHTING"}:
${camera ? `- Camera Setting: ${camera}\n` : ""}- Lighting: ${lightingCtx}
- Mood/Atmosphere: ${moodLine}
- Materials: ${materialList}, with honest texture, grain and natural color variation.
- Look: ${style.photographic ? "Photorealistic. Real textures, pores, material thickness, glass reflections, and soft shadows. No digital smoothness." : style.look}
`.trim();
    return prompt;
  }

  // Classic Gemini flow
  const basicPrompt = `
ARCHITECTURAL PORTFOLIO GENERATION:
Task: Generate a new ${viewType} of the house provided in the reference image.

CRITICAL COMPOSITION RULE: The building is the SOLE PROTAGONIST. The background must be neutral — open sky, landscape, or vegetation. NEVER include neighboring buildings, adjacent houses, other structures, or visible neighbors. No urban density, no party walls. The subject must stand completely alone.

VISUAL REQUIREMENTS:
- View Type: ${vistaDescription}
- View rule: ${KIND_RULES[kind]}
- Style Consistency: The building must be IDENTICAL in form, materials, and character to the reference — same house, different camera position. Every architectural decision (massing, openings, roof geometry, material palette) is fixed.
${facts.length ? `- Design facts (fixed): ${facts.join('; ')}.\n` : ""}${continuity.length ? `- Continuity: ${continuity.join('; ')}.\n` : ""}- Context: ${params.environment ? `The house sits within a ${params.environment} setting — keep the environmental character consistent.` : "Maintain the same site and environmental context as the reference."}
- Lighting: ${lightingCtx}.
- Atmosphere: ${moodLine}

NARRATIVE:
${style.photographic ? "An architectural photograph" : `A ${style.medium}`}${architectCredit ? ` ${architectCredit}` : ""}, capturing the ${viewType} of the building ${styles}.
The camera is placed to reveal ${vistaDescription}.
Every material — ${materialList} — must be rendered with honest texture and physical specificity: grain patterns, natural color variation, the micro-imperfections that confirm real construction. Window glass reflects its surroundings. Shadows have soft edges and reveal surface depth. No surface looks digitally smooth or uniformly perfect.
${style.photographic ? "" : style.look}
`.trim();

  return basicPrompt;
}
