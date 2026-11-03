import { DreamHouseParams } from '@/types';
import { VISTA_DESCRIPTIONS } from '../constants';

/**
 * Builds a narrative prompt for architectural vistas based on a base image.
 * The prompt emphasizes maintaining the core design elements of the reference house
 * while changing the perspective or focus.
 */
export function buildVistasPrompt(params: DreamHouseParams, viewType: string, targetModel?: string): string {
  const vistaDescription = VISTA_DESCRIPTIONS[viewType] || "A professional architectural view.";
  const isOpenAI = targetModel?.includes('OpenAI') || false;
  
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

  if (isOpenAI) {
    const prompt = `
[INTENDED USE: Professional Architectural Portfolio Image]

TASK:
- Action: Generate a new ${viewType} of the house provided in the reference image.
- Camera Perspective: ${vistaDescription}

COMPOSITION:
- Subject: the building is the sole protagonist, standing completely alone.
- Background: neutral (open sky, landscape or vegetation).
- Exclude: neighboring buildings, adjacent houses, other structures, party walls and competing architecture.

ARCHITECTURAL STYLE & CONSISTENCY:
- Constraint: The building must be IDENTICAL in form, materials, and character to the reference image. Same house, different camera angle. All massing, openings, roof geometry, and material palettes are fixed.
- Style Context: Replicate the design language ${styles} ${architectCredit ? `by ${params.architect.join(' & ')}` : ""}.
- Materials: ${materialList}. Rendered with honest texture, grain patterns, and natural color variation.

PHOTOGRAPHY & LIGHTING:
- Camera Setting: Shot on ${params.cameraPreset}, ${params.focalLength} lens at ${params.aperture}, ${params.filmSimulation}
- Lighting: ${lightingCtx}
- Mood/Atmosphere: ${params.mood || "Professional, high-end architectural photography — evocative but not over-processed."}
- Look: Photorealistic. Real textures, pores, material thickness, glass reflections, and soft shadows. No digital smoothness.
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
- Style Consistency: The building must be IDENTICAL in form, materials, and character to the reference — same house, different camera position. Every architectural decision (massing, openings, roof geometry, material palette) is fixed.
- Context: ${params.environment ? `The house sits within a ${params.environment} setting — keep the environmental character consistent.` : "Maintain the same site and environmental context as the reference."}
- Lighting: ${lightingCtx}.
- Atmosphere: ${params.mood || "Professional, high-end architectural photography — evocative but not over-processed."}

NARRATIVE:
An architectural photograph ${architectCredit}, capturing the ${viewType} of the building ${styles}.
The camera is placed to reveal ${vistaDescription}.
Every material — ${materialList} — must be rendered with honest texture and physical specificity: grain patterns, natural color variation, the micro-imperfections that confirm real construction. Window glass reflects its surroundings. Shadows have soft edges and reveal surface depth. No surface looks digitally smooth or uniformly perfect.
`.trim();

  return basicPrompt;
}
