import { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { PROJECT_TYPE_MAP } from '@/modules/exterior/lib/prompt-builder';
import {
  bulletSection,
  creativeDirectionBlock,
  creativeDirectionLead,
  creativeDirectionText,
  joinList,
  narrativeSentence,
  present,
  when,
} from '@/modules/shared/lib/prompt-helpers';

export const FLOOR_PLAN_STYLE_MAP: Record<string, string> = {
  "Planta Técnica 2D (Línea arquitectónica y cotas)":
    "Orthographic top-down 2D architectural CAD floor plan drawing on a crisp neutral sheet: clean black-and-graphite line weights, hatched structural walls, clear door swings, window symbols, fixed fixtures and precise architectural drafting.",
  "Planta Humanizada 2D (Texturas, mobiliario y color)":
    "Orthographic top-down 2D humanized architectural presentation floor plan: true material textures on floors (wood, stone, tile, concrete), tasteful scaled furniture in every room, soft ambient drop shadows under walls and greenery around the perimeter.",
  "Planta 3D Cortada (Isométrica / Axonométrica sin techo)":
    "3D cutaway isometric architectural floor plan (dollhouse view with roof removed at 1.40m height): extruded walls with thickness, visible interior flooring, furniture, doors, windows and spatial volume on a clean neutral studio background.",
  "Diagrama de Zonificación y Programa (Bloques y flujos)":
    "Architectural spatial zoning and programmatic layout diagram (top-down): clearly differentiated functional blocks (social, private, service, circulation and outdoor zones) with clean architectural linework, flow arrows and room organization.",
  "Croquis Arquitectónico a Mano (Boceto de distribución)":
    "Hand-drawn architectural floor plan study sketch on heavyweight paper: confident ink pen wall poché, warm marker washes for floor zones, freehand furniture layout and proportional spatial division.",
};

export const ZONING_LAYOUT_MAP: Record<string, string> = {
  "Zona social y privada separadas por alas": "social and private zones clearly separated into distinct wings",
  "Planta abierta integrada (Open Concept)": "open-plan social core integrating kitchen, dining and living without partition walls",
  "Organizada alrededor de patio central": "rooms and circulation organized around a central courtyard",
  "Eje lineal con galería de circulación": "linear spine layout with a clear circulation gallery connecting rooms",
  "Núcleo central de servicios y circulación": "central service and circulation core freeing the perimeter for living spaces and bedrooms",
  "Zona social en primer piso y privada en segundo": "ground floor dedicated to social and service areas, upper floor reserved for private bedrooms",
  "Pabellones conectados por puente o corredor": "distinct pavilions linked by a glazed bridge or covered breezeway",
  "Zona social volcada hacia el jardín posterior": "social spaces opening wide toward the rear garden, with service and entry buffered toward the street",
};

export function plantaDetailLines(params: DreamHouseParams): string[] {
  const parking = present(params.parkingType) && !/sin estacionamiento/i.test(params.parkingType)
    ? `${params.parkingType}${present(params.parkingSpots) ? ` (${params.parkingSpots} spaces)` : ''}`
    : /sin estacionamiento/i.test(params.parkingType ?? '')
      ? 'no parking zone'
      : present(params.parkingSpots)
        ? `${params.parkingSpots} parking spaces`
        : '';

  const lotDims = present(params.lotWidthM) && present(params.lotDepthM)
    ? `${params.lotWidthM}m front width × ${params.lotDepthM}m depth (${params.lotWidthM * params.lotDepthM}m² footprint/lot)`
    : present(params.lotWidthM)
      ? `${params.lotWidthM}m front width`
      : present(params.lotDepthM)
        ? `${params.lotDepthM}m depth`
        : '';

  return [
    params.hasLotZone
      ? 'Selected buildable zone on lot photo: fit the floor plan layout, orientation and footprint specifically to the highlighted polygon zone marked on the terrain image (do not reproduce the red selection overlay lines)'
      : '',
    when(lotDims, (v) => `Lot / Footprint dimensions: ${v}`),
    when(params.size, (v) => `Total built area: ${/^\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()} m²` : v}`),
    when(params.levels, (v) => `Number of levels: ${v} floor${v > 1 ? 's' : ''} (show clear stair core and vertical connection if multi-story)`),
    when(params.layoutType, (v) => `Spatial footprint geometry: ${v}`),
    when(params.zoningLayout, (v) => `Zoning & internal circulation strategy: ${lookup(ZONING_LAYOUT_MAP, v) || v}`),
    when(params.bedrooms, (v) => `Bedrooms: ${v} well-proportioned bedroom${v > 1 ? 's' : ''} with closet space`),
    when(params.bathrooms, (v) => `Bathrooms: ${v} complete bathroom${v > 1 ? 's' : ''} with logical wet-wall plumbing grouping`),
    when(params.kitchenType, (v) => `Kitchen layout: ${v}`),
    when(params.livingAreaType, (v) => `Main living / social area: ${v}`),
    when(params.planSpaces, (v) => `Additional rooms and spaces in the plan: ${joinList(v)}`),
    when(parking, (v) => `Parking / Garage integration: ${v}`),
    when(params.socialAreas, (v) => `Outdoor social areas integrated into the plan: ${joinList(v)}`),
    when(params.solarOrientation, (v) => `Solar orientation: ${v}`),
    when(params.siteTopography, (v) => `Site topography: ${v}`),
    when(params.constructionSystem, (v) => `Structural system reflected in wall thickness and grid: ${v}`),
    when(params.passiveStrategies, (v) => `Passive & bioclimatic layout strategies: ${joinList(v)}`),
    when(params.materials, (v) => `Material palette expressed in floor textures and walls: ${joinList(v)}`),
    when(params.colorPalette, (v) => `Color palette of the presentation sheet: ${joinList(v)}`),
    when(params.mood, (v) => `Spatial mood and character: ${v}`),
    when(params.floorPlanAnnotations, (v) => `Graphic elements and annotations to include: ${joinList(v)}`),
  ].filter(Boolean);
}

export function buildPlantaPrompt(params: DreamHouseParams, targetModel?: string, hasBaseReference: boolean = false): string {
  const isOpenAI = targetModel?.includes('OpenAI') || false;
  const hasCreative = Boolean(creativeDirectionText(params));
  const projectType = lookup(PROJECT_TYPE_MAP, params.projectType) || params.projectType || 'residential building';
  const styleDesc = joinList(params.architecturalStyles) || 'contemporary architectural';
  const architectDesc = joinList(params.architect, '&');
  const defaultPlanStyle = FLOOR_PLAN_STYLE_MAP["Planta Humanizada 2D (Texturas, mobiliario y color)"];
  const planStyleDesc = lookup(FLOOR_PLAN_STYLE_MAP, params.floorPlanStyle)
    || params.floorPlanStyle
    || (hasCreative ? `${defaultPlanStyle} (unless the CREATIVE DIRECTION specifies a different representation, view or graphic style)` : defaultPlanStyle);
  const detailLines = plantaDetailLines(params);

  if (isOpenAI) {
    return `
[INTENDED USE: Professional Architectural Floor Plan & Spatial Division]
${creativeDirectionLead(params) ? `\n${creativeDirectionLead(params)}\n` : ''}
FLOOR PLAN & SPATIAL BRIEF:
- Subject: Architectural floor plan and spatial division for ${/^[aeiou]/i.test(projectType) ? 'an' : 'a'} ${projectType}${hasBaseReference ? ', adapting the geometry of the provided reference sketch or site photo' : ''}
- Representation Style: ${planStyleDesc}
- Architectural Language: ${styleDesc} spatial organization${architectDesc ? `, inspired by the plan logic and proportions of ${architectDesc}` : ''}${hasCreative && !params.architecturalStyles.length ? ' (guided primarily by the CREATIVE DIRECTION)' : ''}
${bulletSection('PROGRAM & SPATIAL DIVISION SPECIFICATION', detailLines)}
ARCHITECTURAL DRAFTING & LAYOUT RULES:
${hasBaseReference ? '- Hard Geometric Slot (Base Image Limits): Respect the spatial boundaries, footprint and proportions of the uploaded reference image/zone while still executing ALL requested program parameters, styles and instructions.\n' : ''}- Coherent circulation: Every room must have a logical door or opening, clear circulation paths, realistic furniture scale and functional adjacency (entry → social → kitchen/dining → private hallway → bedrooms/bathrooms).
- Proportional wall thickness: Exterior structural walls thicker than interior partitions; wet areas (bathrooms, kitchen, laundry) grouped efficiently.
- Framing: Full floor plan centered with clean breathing room around the perimeter on a neutral architectural sheet${hasCreative ? ' (unless the CREATIVE DIRECTION requests otherwise)' : ''}.${hasCreative ? '\n- Creative Direction Authority: Every spatial relationship, room adjacency, dimension, orientation, zone placement or special feature requested in the CREATIVE DIRECTION below must be executed as the primary design driver, overriding any generic default.' : ''}
${creativeDirectionBlock(params) ? `\n${creativeDirectionBlock(params)}\n` : ''}`.trim();
  }

  // Narrative flow
  let prompt = `Architectural floor plan and spatial division for ${/^[aeiou]/i.test(projectType) ? 'an' : 'a'} ${projectType}${hasBaseReference ? ', respecting the proportions of the provided sketch or site image' : ''}. `;
  prompt += `${planStyleDesc} `;
  prompt += `The spatial organization follows a ${styleDesc} language${architectDesc ? `, drawing from the plan geometry and proportions of ${architectDesc}` : ''}. `;
  prompt += narrativeSentence(detailLines);
  prompt += `Ensure coherent architectural circulation, realistic room proportions, clear wall hierarchy, logical door openings and functional zoning between social, service and private areas.`;

  const creative = creativeDirectionBlock(params);
  if (creative) prompt += `\n\n${creative}`;

  return `${creativeDirectionLead(params) ? `${creativeDirectionLead(params)}\n\n` : ''}${prompt}`.trim();
}
