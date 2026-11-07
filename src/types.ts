import { DEFAULT_VISTAS } from '@/modules/vistas/constants';

export type GenerationMode = "planta" | "exterior" | "interior" | "edit" | "vistas";

/** Render del que se deriva esta generación (vistas, ediciones): sus parámetros se usan para mantener fidelidad */
export interface SourceRender {
  /** Id de la imagen de origen (metadatos incrustados), para enlazar la genealogía */
  id: string;
  mode: GenerationMode;
  houseName?: string;
  model?: string;
  /** Parámetros con los que se generó el render original */
  params: Partial<DreamHouseParams>;
}

/** Calidad de render que elige el usuario (OpenAI): se traduce a low / medium / high / xhigh / max */
export type RenderQuality = "Borrador" | "Estándar" | "Alta" | "Muy alta" | "Máxima";
export type RenderFormat = "jpeg" | "webp" | "png";
export type RenderBackground = "auto" | "opaque" | "transparent";

/** Slot personalizado para cargar imágenes de referencia de detalles (puertas, ventanas, acabados, mobiliario, etc.) */
export interface CustomDetailSlot {
  id: string;
  label: string;
  file: File | null;
}

export interface SharedParams {
  mode: GenerationMode;
  
  // Identity (Shared)
  architecturalStyles: string[];
  architect: string[];
  mood: string;
  materials: string[];
  finishLevel: string;
  colorPalette: string[];

  // Photography (Shared)
  cameraAngle: string;
  composition: string;
  timeOfDay: string;
  season: string;
  lighting: string;
  humanContext: string;
  cameraPreset: string;
  focalLength: string;
  aperture: string;
  filmSimulation: string;
  depthOfField: string;

  // Output (Shared)
  renderStyle: string;
  renderAspectRatio: string;
  /** "1K" | "2K" | "Personalizado" (los valores antiguos "", "512" y "4K" se normalizan al cargar) */
  renderOutputResolution: string;
  /** "ANCHOxALTO" cuando la resolución es "Personalizado" (múltiplos de 16, hasta 2560x1440) */
  renderCustomSize: string;
  /** Formato de archivo del render (con fondo transparente se fuerza webp) */
  renderFormat: RenderFormat;
  renderBackground: RenderBackground;
  /** Variantes por solicitud (1–4); en edición siempre 1 */
  renderVariants: number;
  /** "low" solo la puede usar un administrador; el servidor lo verifica */
  renderModeration: "auto" | "low";
  renderQuality: RenderQuality;
  /** Incrustar los parámetros dentro del archivo de imagen generado (XMP/iTXt) */
  embedMetadata: boolean;
  /** Incluir además ciudad, notas, textos libres y el prompt completo (más detalle, menos privado) */
  embedDetails: boolean;
  /** Render original del que se deriva esta generación (lo llena la subida de una imagen con metadatos) */
  sourceRender?: SourceRender;

  // Creative (Shared)
  artDirection: string;
  negativePrompt: string;
  editPrompt: string;
  aiModel: string;
  /** Nombres de los slots personalizados de detalle con imagen activa */
  customSlotLabels?: string[];
}

export interface ExteriorSpecificParams {
  projectType: string;
  city: string;
  climate: string;
  environment: string;
  waterBody: string;
  weatherCondition: string;
  size: string;
  levels: number;
  roofType: string;
  layoutType: string;
  parkingSpots: number;
  parkingType: string;
  socialAreas: string[];
  exteriorElements: string[];
  vegetation: string[];
  architecturalDetails: string[];
  hasExteriorReference?: boolean;
  /** Emplazamiento y construcción */
  siteTopography: string;
  solarOrientation: string;
  constructionSystem: string;
  roofMaterial: string;
  passiveStrategies: string[];
  /** Tipo de aberturas (aplica a exterior, interior, vistas y edición) */
  windowType: string;
}

export interface InteriorSpecificParams {
  roomType: string;
  roomSizeM2: number;
  furnitureStyle: string[];
  interiorLighting: string[];
  flooringMaterial: string;
  ceilingDetail: string;
  bedrooms: number;
  bathrooms: number;
  kitchenType: string;
  livingAreaType: string;
  wallFinish: string;
}

export interface VistasSpecificParams {
  selectedVistas: string[];
  viewType?: string; // Current view being generated in the batch
}

export interface EditSpecificParams {
  /** Qué clase de cambio se pide (vacío = lo que diga la instrucción) */
  editChangeType: string;
  /** Cuánto se permite transformar la zona marcada */
  editIntensity: string;
  /** Qué debe permanecer idéntico fuera de lo que se edita */
  editPreserve: string[];
}

export interface PlantaSpecificParams {
  /** Tipo de representación gráfica de la planta (2D técnica, 2D humanizada, 3D cortada, diagrama, croquis) */
  floorPlanStyle: string;
  /** Frente del terreno o huella en metros (0 = automático) */
  lotWidthM: number;
  /** Fondo del terreno o huella en metros (0 = automático) */
  lotDepthM: number;
  /** Ambientes y espacios complementarios del programa arquitectónico */
  planSpaces: string[];
  /** Criterio de distribución, zonificación y circulación interna */
  zoningLayout: string;
  /** Elementos gráficos, cotas y anotaciones que se dibujan en el plano */
  floorPlanAnnotations: string[];
  /** Indica si el usuario marcó un polígono/zona sobre la foto del lote donde emplazar la planta */
  hasLotZone?: boolean;
}

export type DreamHouseParams = SharedParams & ExteriorSpecificParams & InteriorSpecificParams & VistasSpecificParams & EditSpecificParams & PlantaSpecificParams;

export const DEFAULT_PARAMS: DreamHouseParams = {
  // Shared
  mode: "exterior",
  architecturalStyles: [],
  architect: [],
  mood: "",
  materials: [],
  finishLevel: "",
  colorPalette: [],
  cameraAngle: "",
  composition: "",
  timeOfDay: "",
  season: "",
  lighting: "",
  humanContext: "",
  cameraPreset: "Fujifilm X100 VI",
  focalLength: "35mm",
  aperture: "f/5.6",
  filmSimulation: "Classic Chrome",
  depthOfField: "Total (f/8–f/11, todo nítido)",
  renderStyle: "",
  renderAspectRatio: "16:9",
  renderOutputResolution: "1K",
  renderCustomSize: "1280x720",
  renderFormat: "jpeg",
  renderBackground: "auto",
  renderVariants: 1,
  renderModeration: "auto",
  renderQuality: "Borrador",
  embedMetadata: true,
  embedDetails: false,
  artDirection: "",
  negativePrompt: "",
  editPrompt: "",
  aiModel: "GPT Image 2.5 Sunburst (OpenAI)",
  customSlotLabels: [],

  // Exterior
  projectType: "",
  city: "",
  climate: "",
  environment: "",
  waterBody: "",
  weatherCondition: "",
  size: "",
  levels: 0,
  roofType: "",
  layoutType: "",
  parkingSpots: 0,
  parkingType: "",
  socialAreas: [],
  exteriorElements: [],
  vegetation: [],
  architecturalDetails: [],
  hasExteriorReference: false,
  siteTopography: "",
  solarOrientation: "",
  constructionSystem: "",
  roofMaterial: "",
  passiveStrategies: [],
  windowType: "",

  // Interior
  roomType: "",
  roomSizeM2: 0,
  furnitureStyle: [],
  interiorLighting: [],
  flooringMaterial: "",
  ceilingDetail: "",
  bedrooms: 0,
  bathrooms: 0,
  kitchenType: "",
  livingAreaType: "",
  wallFinish: "",

  // Vistas
  selectedVistas: [...DEFAULT_VISTAS],

  // Edición
  editChangeType: "",
  editIntensity: "",
  editPreserve: [],

  // Planta Arquitectónica
  floorPlanStyle: "",
  lotWidthM: 0,
  lotDepthM: 0,
  planSpaces: [],
  zoningLayout: "",
  floorPlanAnnotations: [],
  hasLotZone: false,
};
