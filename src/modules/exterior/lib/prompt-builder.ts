import { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import {
  bulletSection,
  cameraSentence,
  creativeDirectionBlock,
  creativeDirectionLead,
  exteriorDetailLines,
  joinList,
  narrativeSentence,
  present,
  resolveRenderStyle,
} from '@/modules/shared/lib/prompt-helpers';

export const PROJECT_TYPE_MAP: Record<string, string> = {
  "A-frame": "A-frame cabin with a steeply pitched triangular roof reaching the ground",
  "Apartamento/Penthouse": "penthouse apartment",
  "Biblioteca": "library",
  "Cabaña": "timber cabin",
  "Café/Cafetería": "specialty café",
  "Capilla/Iglesia": "chapel",
  "Casa contenedor": "house built from repurposed shipping containers",
  "Casa de campo/Finca": "country house (finca) set in a rural landscape",
  "Casa de playa": "beach house",
  "Casa en el árbol": "treehouse elevated among tree trunks",
  "Casa prefabricada/Modular": "modular prefabricated house",
  "Casa unifamiliar": "single-family house",
  "Centro cultural": "cultural center",
  "Clínica/Hospital": "medical clinic",
  "Co-living": "co-living residential building",
  "Dúplex/Townhouse": "townhouse",
  "Edificio educativo": "educational building",
  "Edificio residencial": "residential building",
  "Estudio/Taller de arte": "artist studio and workshop",
  "Gimnasio": "fitness gym building",
  "Glamping/Domo": "glamping lodge with a geodesic dome",
  "Hacienda": "hacienda-style estate house organized around a courtyard",
  "Hotel boutique": "boutique hotel",
  "Hotel resort": "resort hotel",
  "Loft": "loft-style building with open double-height spaces",
  "Mixed-use": "mixed-use building",
  "Museo/Galería": "museum",
  "Oficinas corporativas": "corporate office building",
  "Pabellón": "freestanding pavilion",
  "Restaurante/Bar": "restaurant",
  "Retail/Tienda": "retail store",
  "Sauna": "modern sauna and wellness facility",
  "Spa/Wellness": "wellness spa",
  "Teatro/Auditorio": "theater",
  "Tiny house": "tiny house, a very small compact dwelling with a minimal footprint",
  "Turco": "Turkish bath (hammam) and wellness facility",
  "Villa de lujo": "luxury villa",
  "Zona húmeda": "wet-area wellness facility with sauna, Turkish bath and pool"
};

const VOLUMETRIC_SCALE_MAP: Record<string, string> = {
  "Estate (>1000m²)": "monumental expansive complex",
  "Grande (300-500m²)": "large-scale structure",
  "Mansión (500-1000m²)": "grand-scale extensive massing",
  "Mediana (150-300m²)": "mid-sized architectural volume",
  "Pequeña (50-150m²)": "compact residential-scale structure",
  "Tiny House (<50m²)": "very small structure with a minimal footprint"
};

const FORM_ORGANIZATION_MAP: Record<string, string> = {
  "Alrededor de un patio central": "organized around a central contemplative courtyard",
  "Lineal / en barra": "composed of a series of linear, interconnected volumes",
  "Tipo loft (volumen abierto)": "conceived as an expansive open-volume loft with industrial proportions",
  "Planta abierta": "exhibiting an airy and interconnected spatial organization",
  "Pabellones separados": "designed as a cluster of distinct, site-specific pavilions",
  "Radial / núcleo central": "radiating from a singular central core",
  "Medios niveles": "distributed across staggered, multi-level volumetric planes",
  "Tradicional (zonificado)": "clearly articulated into distinct functional zones",
  "Por alas": "split into specialized wings for optimized privacy and function"
};

export function getLightingPhysics(timeOfDay: string, rawLightingType: string, season: string): string {
  const lower = (timeOfDay || '').toLowerCase();
  const lightingType = present(rawLightingType) ? rawLightingType : 'natural';
  const seasonCtx = season ? ` in ${season}` : '';

  if (lower.includes('golden') || lower.includes('hora dorada') || lower.includes('sunset') || lower.includes('atardecer') || lower.includes('sunrise') || lower.includes('amanecer')) {
    return `Low-angle golden light rakes across the facade${seasonCtx}, dragging long warm shadows from every surface relief, window reveal, and material joint — the ${lightingType} quality at its most dramatic. Facade textures are amplified by raking illumination; every grain and cast shadow is visible.`;
  }
  if (lower.includes('blue hour') || lower.includes('hora azul') || lower.includes('twilight') || lower.includes('crepúsculo')) {
    return `Deep blue twilight sky${seasonCtx} provides a cool luminous field against which warm interior light bleeds softly through glazing — the ${lightingType} liminal quality where artificial and natural light balance. The building glows from within while its silhouette reads against a gradient sky.`;
  }
  if (lower.includes('night') || lower.includes('noche')) {
    return `Night scene${seasonCtx}: artificial sources sculpt the building from darkness, interior warmth escapes through glass, facade materials absorb and reflect ${lightingType} light with honest surface behavior — matte planes go dark, specular surfaces catch highlights.`;
  }
  if (lower.includes('overcast') || lower.includes('nublado') || lower.includes('cloudy') || lower.includes('cubierto')) {
    return `Soft, directionless overcast sky${seasonCtx} wraps the building in even diffuse light — the ${lightingType} quality that reveals true material color without the distraction of harsh shadows. Surface texture reads through subtle tonal variation rather than cast shadow.`;
  }
  if (lower.includes('morning') || lower.includes('mañana')) {
    return `Early morning light arrives low from the east${seasonCtx}, laying cool-warm gradients across the facade and throwing long directional shadows that emphasize the building's three-dimensional relief — ${lightingType} quality with atmospheric haze softening the background.`;
  }
  if (lower.includes('midday') || lower.includes('mediodía') || lower.includes('noon')) {
    return `High midday sun${seasonCtx} creates stark, vertical contrast: flat horizontal surfaces bleach bright while vertical recesses drop into deep shadow — ${lightingType} conditions that emphasize the building's massing and relief with maximum tonal separation.`;
  }
  if (lower.includes('afternoon') || lower.includes('tarde')) {
    return `Warm afternoon light tracks from the west${seasonCtx}, wrapping the facade in directional warmth with elongating shadows that read the building's depth — ${lightingType} conditions where every surface plane has a distinct luminosity.`;
  }

  if (!present(timeOfDay)) {
    return `Natural daylight${seasonCtx} with a single clear direction defines shadow direction, sculpts the building's volumes, and confirms the physical depth of every surface plane${present(rawLightingType) ? ` — ${rawLightingType} lighting quality` : ''}.`;
  }
  return `The scene is captured during ${timeOfDay}${seasonCtx}, with ${lightingType} lighting that defines shadow direction, sculpts the building's volumes, and confirms the physical depth of every surface plane.`;
}

export function buildExteriorPrompt(
  params: DreamHouseParams,
  hasStructuralReference: boolean = false,
  targetModel?: string,
  hasFloorPlanReference: boolean = false,
): string {
  const projectType = lookup(PROJECT_TYPE_MAP, params.projectType) || params.projectType || "building";
  let scaleDesc = "modern structure";
  if (params.size) {
    const numericMeters = parseFloat(params.size);
    if (!isNaN(numericMeters) && numericMeters > 0) {
      scaleDesc = `${numericMeters}m² architectural structure`;
    } else {
      scaleDesc = lookup(VOLUMETRIC_SCALE_MAP, params.size) || params.size || "modern structure";
    }
  }
  const organizationDesc = lookup(FORM_ORGANIZATION_MAP, params.layoutType) ? `, ${lookup(FORM_ORGANIZATION_MAP, params.layoutType)}` : "";
  const isOpenAI = targetModel?.includes('OpenAI') || false;
  const style = resolveRenderStyle(params.renderStyle);
  const detailLines = exteriorDetailLines(params);
  const styleDesc = joinList(params.architecturalStyles) || "contemporary";
  const architectDesc = joinList(params.architect, '&');
  const finishDesc = present(params.finishLevel) ? `, finished to a ${params.finishLevel} standard` : "";
  const materialDesc = present(params.materials) ? `${joinList(params.materials)}${finishDesc}` : "";
  const lightingPhys = getLightingPhysics(params.timeOfDay, params.lighting, params.season);
  const camera = style.photographic ? cameraSentence(params) : "";
  const siteDesc = present(params.city)
    ? `Located in the urban context of ${params.city}`
    : `Rooted in a ${params.environment || 'carefully considered'} environment`;

  const floorPlanHardBlock = hasFloorPlanReference
    ? `\nHARD GEOMETRIC CONSTRAINT — FLOOR PLAN SLOT (BOUNDARIES + FULL PARAMETER EXECUTION):
- Hard Spatial Limits (1:1 Footprint): The provided floor plan image defines the strict geometric boundaries of the building — exact footprint, perimeter shape (L-shape, U-shape, courtyard, wings, setbacks, projections), entry position, outdoor terraces/pool/deck zones, and window/door bays along the facades. Do NOT exceed, distort or replace these spatial boundaries.
- Full Parameter Execution Within Those Limits: While strictly obeying the floor plan's footprint and spatial limits, you MUST actively build and dress the 3D exterior applying ALL requested parameters in this brief (architectural style, facade materials, finish standard, color palette, roof type and covering, number of levels, window design, landscaping, site environment, lighting, camera angle and any Creative Direction).
- 2D-to-3D Translation: Extrude the 2D plan into a real three-dimensional built exterior volume (never render flat 2D plan lines, dimension arrows or text labels on the ground).\n`
    : "";

  if (isOpenAI) {
    const subjectDesc = hasStructuralReference && hasFloorPlanReference
      ? `reimagined version of the ${projectType} from reference image, strictly obeying the footprint and spatial layout of the provided floor plan`
      : hasStructuralReference
        ? `reimagined version of the ${projectType} from reference image`
        : hasFloorPlanReference
          ? `3D architectural exterior of a ${scaleDesc} ${projectType} extruded and built strictly from the provided floor plan reference`
          : `${scaleDesc} ${projectType}`;
    const prompt = `
[INTENDED USE: Professional Architectural Portfolio Image]
${creativeDirectionLead(params) ? `\n${creativeDirectionLead(params)}\n` : ""}
SCENE & CONTEXT:
- Subject: ${subjectDesc}
- Camera Angle: ${params.cameraAngle || 'eye-level'} view
- Location/Setting: ${siteDesc}
${floorPlanHardBlock}
ARCHITECTURAL SPECIFICATION:
- Style: ${styleDesc} character${architectDesc ? `, drawing from the language of ${architectDesc}` : ""}
${params.layoutType ? `- Layout: Organized with a ${lookup(FORM_ORGANIZATION_MAP, params.layoutType) || params.layoutType} configuration\n` : ""}${params.levels > 0 ? `- Levels: Distributed across exactly ${params.levels} floors\n` : ""}- Materials: ${materialDesc || "traditional architectural facade materials"}
- Material Detail: Honest textures with physical thickness, weathering at base, and clear joint shadow lines. No digital smoothness or plastic sheen.
${bulletSection('ADDITIONAL DESIGN SPECIFICATION', detailLines)}
${style.photographic ? 'PHOTOGRAPHY & LIGHTING' : 'VISUAL TREATMENT & LIGHTING'}:
${camera ? `- Camera Config: ${camera}\n` : ""}${style.photographic && params.depthOfField ? `- Depth of Field: ${params.depthOfField}\n` : ""}- Lighting: ${lightingPhys}

CONSTRAINTS & QUALITY:
- Look: ${style.look}
- Composition: The building is the SOLE PROTAGONIST. Neutral background (open sky, landscape, or vegetation).
- Exclude: No neighboring buildings, no adjacent houses, no other structures, no party walls, no visible neighbors in the background${creativeDirectionBlock(params) ? ' (unless the CREATIVE DIRECTION asks otherwise)' : ''}. No watermarks, no logos.
${creativeDirectionBlock(params) ? `\n${creativeDirectionBlock(params)}\n` : ""}`.trim();
    return prompt;
  }

  // Classic Gemini flow
  const article = /^[aeiou]/i.test(style.medium) ? 'An' : 'A';
  let prompt = "";
  if (hasStructuralReference) {
    prompt = `${article} ${style.medium} — ${params.cameraAngle || 'eye-level'} view — documenting a reimagined version of the ${projectType} shown in the reference image. `;
  } else {
    prompt = `${article} ${style.medium} — ${params.cameraAngle || 'eye-level'} view — of a ${scaleDesc} ${projectType}. `;
  }
  if (hasFloorPlanReference) {
    prompt += `HARD GEOMETRIC CONSTRAINT (FLOOR PLAN SLOT): The provided floor plan image defines the strict 1:1 geometric boundaries (footprint, perimeter wings, recesses, courtyards, terraces and window/door positions) — stay strictly within those spatial limits while fully applying all requested exterior parameters (style, facade materials, roof type, levels, landscaping, lighting and Creative Direction), without copying flat 2D drafting lines or text. `;
  }

  if (present(params.city)) {
    prompt += `The building occupies its site in ${params.city} with confident presence, reading clearly against its urban context. `;
  } else {
    prompt += `The project is rooted in a ${params.environment || 'carefully considered'} environment — the setting is specific enough to feel real, not generic. `;
  }

  prompt += `The building${organizationDesc} carries a ${styleDesc} character. `;

  if (params.levels > 0) {
    prompt += `Its massing is distributed across ${params.levels} floors, each level reading clearly as a distinct horizontal band in the composition. `;
  }

  if (architectDesc) {
    prompt += `The design sensibility — proportions, material honesty, spatial hierarchy — draws from the language of ${architectDesc}. `;
  }

  if (materialDesc) {
    prompt += `The facade is built from ${materialDesc}. `;
    prompt += `Render each material with honest surface behavior: grain patterns, natural color variation across panels, `;
    prompt += `the subtle imperfections and micro-texture that make a facade feel constructed rather than modeled — `;
    prompt += `weathering at base, joint shadow lines, material edges with physical thickness. `;
  }

  prompt += narrativeSentence(detailLines);

  // Physics-based lighting description derived from time of day
  prompt += `${lightingPhys} `;

  if (camera) prompt += `${camera.charAt(0).toUpperCase()}${camera.slice(1)}. `;
  if (style.photographic && params.depthOfField) prompt += `Depth of field: ${params.depthOfField}. `;

  if (style.photographic) {
    // Quality: specific photographic criteria, not generic tags
    prompt += `\nThe image must feel like a working architectural photographer's best frame — `;
    prompt += `shadows have a single clear direction and soft-edged fall-off, surfaces have tactile texture and physical weight, `;
    prompt += `atmosphere adds depth between foreground and background. `;
    prompt += `No CGI smoothness, no plastic surfaces, no artificially sharpened or uniform-textured materials.`;
  } else {
    prompt += `\n${style.look}`;
  }

  prompt += `\nCRITICAL COMPOSITION RULE: The building is the SOLE PROTAGONIST of this image. The background must be neutral — open sky, landscape, vegetation, or abstract environment. NEVER include neighboring buildings, adjacent houses, other structures, or visible neighbors in the background. No urban density, no party walls, no competing architecture. The subject must stand alone.`;

  const creative = creativeDirectionBlock(params);
  if (creative) prompt += `\n\n${creative}`;

  return `${creativeDirectionLead(params) ? `${creativeDirectionLead(params)}\n\n` : ''}${prompt}`.trim();
}
