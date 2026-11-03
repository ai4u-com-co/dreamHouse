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

/** Calidad de render que elige el usuario (OpenAI): se traduce a low / medium / high / xhigh */
export type RenderQuality = "Borrador" | "Estándar" | "Alta" | "Máxima";

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
  renderOutputResolution: string;
  thinkingLevel: "Minimal" | "High";
  renderQuality: RenderQuality;
  /** Incrustar los parámetros dentro del archivo de imagen generado (XMP/iTXt) */
  embedMetadata: boolean;
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
  focalLength: "35mm (documental natural)",
  aperture: "f/5.6 (punto dulce arquitectónico)",
  filmSimulation: "Classic Chrome",
  depthOfField: "Total (f/8–f/11, todo nítido)",
  renderStyle: "",
  renderAspectRatio: "16:9",
  renderOutputResolution: "",
  thinkingLevel: "Minimal",
  renderQuality: "Estándar",
  embedMetadata: true,
  technicalNotes: "",
  artDirection: "",
  negativePrompt: "",
  editPrompt: "",
  aiModel: "Gemini 3.1 Flash Image Preview",

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
