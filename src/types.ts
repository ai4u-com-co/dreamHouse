export type GenerationMode = "exterior" | "interior" | "edit" | "vistas";

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
  thinkingLevel: "Minimal" | "High";
  renderQuality: RenderQuality;
  /** Incrustar los parámetros dentro del archivo de imagen generado (XMP/iTXt) */
  embedMetadata: boolean;
  /** Incluir además ciudad, notas, textos libres y el prompt completo (más detalle, menos privado) */
  embedDetails: boolean;
  /** Render original del que se deriva esta generación (lo llena la subida de una imagen con metadatos) */
  sourceRender?: SourceRender;

  // Creative (Shared)
  technicalNotes: string;
  artDirection: string;
  negativePrompt: string;
  editPrompt: string;
  aiModel: string;
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
}

export interface VistasSpecificParams {
  selectedVistas: string[];
  viewType?: string; // Current view being generated in the batch
}

export type DreamHouseParams = SharedParams & ExteriorSpecificParams & InteriorSpecificParams & VistasSpecificParams;

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
  thinkingLevel: "Minimal",
  renderQuality: "Borrador",
  embedMetadata: true,
  embedDetails: false,
  technicalNotes: "",
  artDirection: "",
  negativePrompt: "",
  editPrompt: "",
  aiModel: "GPT Image 2.5 Sunburst (OpenAI)",

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

  // Vistas
  selectedVistas: [],
};
