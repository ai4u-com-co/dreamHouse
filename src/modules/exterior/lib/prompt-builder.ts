import { DreamHouseParams } from '@/types';

const PROJECT_TYPE_MAP: Record<string, string> = {
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
  "Courtyard-centered": "organized around a central contemplative courtyard",
  "Linear/Corridor": "composed of a series of linear, interconnected volumes",
  "Loft-style": "conceived as an expansive open-volume loft with industrial proportions",
  "Open plan": "exhibiting an airy and interconnected spatial organization",
  "Pavilion-style": "designed as a cluster of distinct, site-specific pavilions",
  "Radial/Central": "radiating from a singular central core",
  "Split-level": "distributed across staggered, multi-level volumetric planes",
  "Traditional (zonificado)": "clearly articulated into distinct functional zones",
  "Wing-based": "split into specialized wings for optimized privacy and function"
};

function getLightingPhysics(timeOfDay: string, lightingType: string, season: string): string {
  const lower = (timeOfDay || '').toLowerCase();
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

  return `The scene is captured during ${timeOfDay}${seasonCtx}, with ${lightingType} lighting that defines shadow direction, sculpts the building's volumes, and confirms the physical depth of every surface plane.`;
}

export function buildExteriorPrompt(params: DreamHouseParams, hasStructuralReference: boolean = false, targetModel?: string): string {
  const projectType = PROJECT_TYPE_MAP[params.projectType] || params.projectType;
  let scaleDesc = "modern structure";
  if (params.size) {
    const numericMeters = parseFloat(params.size);
    if (!isNaN(numericMeters) && numericMeters > 0) {
      scaleDesc = `${numericMeters}m² architectural structure`;
    } else {
      scaleDesc = VOLUMETRIC_SCALE_MAP[params.size] || params.size || "modern structure";
    }
  }
  const organizationDesc = FORM_ORGANIZATION_MAP[params.layoutType] ? `, ${FORM_ORGANIZATION_MAP[params.layoutType]}` : "";
  const isOpenAI = targetModel?.includes('OpenAI') || false;

  if (isOpenAI) {
    const styleDesc = params.architecturalStyles.join(' and ') || "modern style";
    const architectDesc = params.architect.length > 0 ? params.architect.join(' & ') : "";
    const materialDesc = params.materials.length > 0 ? `${params.materials.join(' and ')}, finished to a ${params.finishLevel} standard` : "";
    const lightingPhys = getLightingPhysics(params.timeOfDay, params.lighting, params.season);
    
    const prompt = `
[INTENDED USE: Professional Architectural Portfolio Image]

SCENE & CONTEXT:
- Subject: ${hasStructuralReference ? `reimagined version of the ${projectType} from reference image` : `${scaleDesc} ${projectType}`}
- Camera Angle: ${params.cameraAngle || 'eye-level'} view
- Location/Setting: ${params.city ? `Located in the urban context of ${params.city}` : `Rooted in a ${params.environment || 'carefully considered'} environment`}

ARCHITECTURAL SPECIFICATION:
- Style: ${styleDesc} character${architectDesc ? `, drawing from the language of ${architectDesc}` : ""}
${params.layoutType ? `- Layout: Organized with a ${FORM_ORGANIZATION_MAP[params.layoutType] || params.layoutType} configuration\n` : ""}${params.levels > 0 ? `- Levels: Distributed across exactly ${params.levels} floors\n` : ""}- Materials: ${materialDesc || "traditional architectural facade materials"}
- Material Detail: Honest textures with physical thickness, weathering at base, and clear joint shadow lines. No digital smoothness or plastic sheen.

PHOTOGRAPHY & LIGHTING:
- Camera Config: Shot on ${params.cameraPreset}, ${params.focalLength} lens at ${params.aperture}, ${params.filmSimulation}
- Lighting: ${lightingPhys}
${params.artDirection ? `- Art Direction: ${params.artDirection}\n` : ""}
CONSTRAINTS & QUALITY:
- Look: Photorealistic architectural photography.
- Composition: The building is the SOLE PROTAGONIST. Neutral background (open sky, landscape, or vegetation).
- Exclude: No neighboring buildings, no adjacent houses, no other structures, no party walls, no visible neighbors in the background. No watermarks, no logos.
`.trim();
    return prompt;
  }

  // Classic Gemini flow
  let prompt = "";
  if (hasStructuralReference) {
    prompt = `An architectural photograph — ${params.cameraAngle || 'eye-level'} view — documenting a reimagined version of the ${projectType} shown in the reference image. `;
  } else {
    prompt = `An architectural photograph — ${params.cameraAngle || 'eye-level'} view — of a ${scaleDesc} ${projectType}. `;
  }

  if (params.city) {
    prompt += `The building occupies its site in ${params.city} with confident presence, reading clearly against its urban context. `;
  } else {
    prompt += `The project is rooted in a ${params.environment || 'carefully considered'} environment — the setting is specific enough to feel real, not generic. `;
  }

  prompt += `The building${organizationDesc} carries a ${params.architecturalStyles.join(' and ')} character. `;

  if (params.levels > 0) {
    prompt += `Its massing is distributed across ${params.levels} floors, each level reading clearly as a distinct horizontal band in the composition. `;
  }

  if (params.architect.length > 0) {
    prompt += `The design sensibility — proportions, material honesty, spatial hierarchy — draws from the language of ${params.architect.join(' & ')}. `;
  }

  if (params.materials.length > 0) {
    prompt += `The facade is built from ${params.materials.join(' and ')}, finished to a ${params.finishLevel} standard. `;
    prompt += `Render each material with honest surface behavior: grain patterns, natural color variation across panels, `;
    prompt += `the subtle imperfections and micro-texture that make a facade feel constructed rather than modeled — `;
    prompt += `weathering at base, joint shadow lines, material edges with physical thickness. `;
  }

  // Physics-based lighting description derived from time of day
  prompt += `${getLightingPhysics(params.timeOfDay, params.lighting, params.season)} `;

  prompt += `Shot on ${params.cameraPreset}, ${params.focalLength} lens at ${params.aperture}, ${params.filmSimulation}. `;

  if (params.artDirection) {
    prompt += `\nCreative Direction: ${params.artDirection}. `;
  }

  // Quality: specific photographic criteria, not generic tags
  prompt += `\nThe image must feel like a working architectural photographer's best frame — `;
  prompt += `shadows have a single clear direction and soft-edged fall-off, surfaces have tactile texture and physical weight, `;
  prompt += `atmosphere adds depth between foreground and background. `;
  prompt += `No CGI smoothness, no plastic surfaces, no artificially sharpened or uniform-textured materials.`;

  prompt += `\nCRITICAL COMPOSITION RULE: The building is the SOLE PROTAGONIST of this image. The background must be neutral — open sky, landscape, vegetation, or abstract environment. NEVER include neighboring buildings, adjacent houses, other structures, or visible neighbors in the background. No urban density, no party walls, no competing architecture. The subject must stand alone.`;

  return prompt.trim();
}
