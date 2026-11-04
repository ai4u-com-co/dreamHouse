import React from 'react';
import { modesFor } from '@/modules/shared/param-modes';
import { DEFAULT_PARAMS, DreamHouseParams, GenerationMode } from '@/types';
import {
  FileText, Sparkles, MapPin, Layers, LayoutGrid,
  Hammer, Palette, Camera, Settings2, PenLine, Maximize2, Armchair, Paperclip
} from 'lucide-react';

/** Un archivo cargado por el usuario y si el módulo actual lo usa */
export interface LoadedFile {
  label: string;
  name: string;
  used: boolean;
}

interface PromptPreviewProps {
  params: DreamHouseParams;
  /** Archivos cargados (con el rol que cumplen en el módulo actual) */
  loadedFiles?: LoadedFile[];
}

type ParamValue = string | string[] | number;

interface ParamItem {
  label: string;
  value: ParamValue;
  /** Campo de params al que corresponde (para saber si sigue en su valor por defecto) */
  key?: keyof DreamHouseParams;
  /** Módulos en los que este dato aplica (por defecto, los del grupo) */
  modes?: GenerationMode[];
}

interface ParamGroup {
  number: string;
  title: string;
  icon: React.ReactNode;
  items: ParamItem[];
  /** Módulos en los que aplica el grupo (por defecto, todos) */
  modes?: GenerationMode[];
}

const MODE_LABELS: Record<GenerationMode, string> = {
  exterior: 'Exterior',
  interior: 'Interior',
  edit: 'Edición',
  vistas: 'Vistas',
};

function hasValue(val: ParamValue): boolean {
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === 'number') return val > 0;
  return val !== '' && val !== undefined && val !== null;
}

function renderValue(val: ParamValue): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'number') return [String(val)];
  return [val];
}

/** ¿El valor sigue siendo el de fábrica? Se muestra, pero no cuenta como algo que el usuario eligió */
function isFactoryDefault(item: ParamItem): boolean {
  if (!item.key) return false;
  return JSON.stringify(DEFAULT_PARAMS[item.key]) === JSON.stringify(item.value);
}

const INT: GenerationMode[] = ['interior'];
const EXT_VISTAS: GenerationMode[] = ['exterior', 'vistas'];
const NOT_EDIT: GenerationMode[] = ['exterior', 'interior', 'vistas'];

export default function PromptPreview({ params, loadedFiles = [] }: PromptPreviewProps) {
  const mode = params.mode;
  const groups: ParamGroup[] = [
    {
      number: '03',
      title: 'Modo de Trabajo',
      icon: <Maximize2 className="w-3.5 h-3.5" />,
      items: [
        { label: 'MODO', value: MODE_LABELS[mode] ?? mode },
        { label: 'VISTAS', value: params.selectedVistas, key: 'selectedVistas', modes: ['vistas'] },
        { label: 'ORIGEN', value: params.sourceRender ? `${params.sourceRender.houseName || 'Render DreamHouse'}${params.sourceRender.model ? ` · ${params.sourceRender.model}` : ''}` : '', modes: ['vistas', 'edit'] },
      ],
    },
    {
      number: '04',
      title: 'Esencia del Proyecto',
      icon: <Sparkles className="w-3.5 h-3.5" />,
      modes: NOT_EDIT,
      items: [
        { label: 'TIPO', value: params.projectType, key: 'projectType' },
        { label: 'ESPACIO', value: params.roomType, key: 'roomType' },
        { label: 'ESTILO', value: params.architecturalStyles, key: 'architecturalStyles' },
        { label: 'ARQUITECTO', value: params.architect, key: 'architect' },
        { label: 'MOOD', value: params.mood, key: 'mood' },
      ],
    },
    {
      number: '05',
      title: 'Contexto y Ubicación',
      icon: <MapPin className="w-3.5 h-3.5" />,
      modes: NOT_EDIT,
      items: [
        { label: 'CIUDAD', value: params.city, key: 'city' },
        { label: 'CLIMA', value: params.climate, key: 'climate' },
        { label: 'ENTORNO', value: params.environment, key: 'environment' },
        { label: 'AGUA', value: params.waterBody, key: 'waterBody' },
        { label: 'TIEMPO', value: params.weatherCondition, key: 'weatherCondition' },
      ],
    },
    {
      number: '06',
      title: 'Volumetría y Forma',
      icon: <Layers className="w-3.5 h-3.5" />,
      modes: EXT_VISTAS,
      items: [
        { label: 'TAMAÑO', value: params.size, key: 'size' },
        { label: 'NIVELES', value: params.levels, key: 'levels' },
        { label: 'CUBIERTA', value: params.roofType, key: 'roofType' },
        { label: 'PLANTA', value: params.layoutType, key: 'layoutType' },
      ],
    },
    {
      number: '07',
      title: 'Diseño Interior',
      icon: <Armchair className="w-3.5 h-3.5" />,
      modes: INT,
      items: [
        { label: 'M²', value: params.roomSizeM2, key: 'roomSizeM2' },
        { label: 'MUEBLES', value: params.furnitureStyle, key: 'furnitureStyle' },
        { label: 'LUZ INT.', value: params.interiorLighting, key: 'interiorLighting' },
        { label: 'SUELO', value: params.flooringMaterial, key: 'flooringMaterial' },
        { label: 'TECHO', value: params.ceilingDetail, key: 'ceilingDetail' },
      ],
    },
    {
      number: '08',
      title: 'Programa Arquitectónico',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
      modes: ['exterior', 'interior'],
      items: [
        { label: 'HABITAC.', value: params.bedrooms, key: 'bedrooms' },
        { label: 'BAÑOS', value: params.bathrooms, key: 'bathrooms' },
        { label: 'COCINA', value: params.kitchenType, key: 'kitchenType' },
        { label: 'SALA', value: params.livingAreaType, key: 'livingAreaType' },
        { label: 'PARQUEO', value: params.parkingSpots, key: 'parkingSpots' },
        { label: 'TIPO PKG', value: params.parkingType, key: 'parkingType' },
        { label: 'ÁREAS SOC.', value: params.socialAreas, key: 'socialAreas' },
      ],
    },
    {
      number: '09',
      title: 'Materialidad y Acabados',
      icon: <Hammer className="w-3.5 h-3.5" />,
      modes: NOT_EDIT,
      items: [
        { label: 'REVESTIM.', value: params.materials, key: 'materials' },
        { label: 'CALIDAD', value: params.finishLevel, key: 'finishLevel' },
        { label: 'DETALLES', value: params.architecturalDetails, key: 'architecturalDetails' },
      ],
    },
    {
      number: '10',
      title: 'Estética y Paisaje',
      icon: <Palette className="w-3.5 h-3.5" />,
      modes: NOT_EDIT,
      items: [
        { label: 'PALETA', value: params.colorPalette, key: 'colorPalette' },
        { label: 'ELEMENTOS', value: params.exteriorElements, key: 'exteriorElements' },
        { label: 'VEGETACIÓN', value: params.vegetation, key: 'vegetation' },
      ],
    },
    {
      number: '11',
      title: 'Parámetros Fotográficos',
      icon: <Camera className="w-3.5 h-3.5" />,
      modes: NOT_EDIT,
      items: [
        { label: 'CÁMARA', value: params.cameraPreset, key: 'cameraPreset' },
        { label: 'FOCAL', value: params.focalLength, key: 'focalLength' },
        { label: 'APERTURA', value: params.aperture, key: 'aperture' },
        { label: 'PELÍCULA', value: params.filmSimulation, key: 'filmSimulation' },
        { label: 'ÁNGULO', value: params.cameraAngle, key: 'cameraAngle' },
        { label: 'COMPOSICIÓN', value: params.composition, key: 'composition' },
        { label: 'HORA', value: params.timeOfDay, key: 'timeOfDay' },
        { label: 'ESTACIÓN', value: params.season, key: 'season' },
        { label: 'LUZ', value: params.lighting, key: 'lighting' },
        { label: 'PERSONAS', value: params.humanContext, key: 'humanContext' },
      ],
    },
    {
      number: '12',
      title: 'Configuración de Salida',
      icon: <Settings2 className="w-3.5 h-3.5" />,
      items: [
        { label: 'MODELO IA', value: params.aiModel, key: 'aiModel' },
        { label: 'RENDER', value: params.renderStyle, key: 'renderStyle', modes: NOT_EDIT },
        { label: 'CALIDAD', value: params.aiModel.includes('OpenAI') ? params.renderQuality : '', key: 'renderQuality' },
        { label: 'RATIO', value: params.renderAspectRatio, key: 'renderAspectRatio', modes: NOT_EDIT },
        { label: 'RESOLUCIÓN', value: params.renderOutputResolution, key: 'renderOutputResolution', modes: NOT_EDIT },
        { label: 'THINKING', value: params.thinkingLevel !== 'Minimal' ? params.thinkingLevel : '', modes: NOT_EDIT },
      ],
    },
    {
      number: '13',
      title: 'Dirección Creativa',
      icon: <PenLine className="w-3.5 h-3.5" />,
      items: [
        { label: 'EDITAR', value: params.editPrompt, key: 'editPrompt', modes: ['edit'] },
        { label: 'TÉCNICAS', value: params.technicalNotes, key: 'technicalNotes', modes: NOT_EDIT },
        { label: 'ART DIR.', value: params.artDirection, key: 'artDirection', modes: NOT_EDIT },
        { label: 'EXCLUIR', value: params.negativePrompt, key: 'negativePrompt' },
      ],
    },
  ];

  // Solo lo que aplica al módulo actual
  const applicable = groups
    .filter((g) => !g.modes || g.modes.includes(mode))
    .map((g) => ({
      ...g,
      // La aplicabilidad de cada parámetro sale del registro único; `modes` del ítem solo para lo que no es un parámetro del diseño
      items: g.items.filter((item) => {
        const modes = item.key && modesFor(item.key).length ? modesFor(item.key) : item.modes;
        return !modes || modes.includes(mode);
      }),
    }));

  const visibleGroups = applicable.filter((g) => g.items.some((item) => hasValue(item.value)));

  // Cuenta solo lo que el usuario eligió (los valores de fábrica se muestran pero no cuentan)
  const totalParams = applicable.reduce(
    (acc, g) => acc + g.items.filter((item) => hasValue(item.value) && !isFactoryDefault(item)).length,
    0
  );
  const usedFiles = loadedFiles.filter((f) => f.used);
  const ignoredFiles = loadedFiles.filter((f) => !f.used);

  return (
    <div className="h-full flex flex-col animate-fade-in-up bg-card/50 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-border/60 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-primary/10 rounded-sm">
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-foreground">Design Spec</h3>
            <p className="text-xs text-muted-foreground font-mono">
              {totalParams > 0 ? `${totalParams} PARAMS ACTIVE` : 'NO PARAMS SET'}
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-primary/40"></div>
          <div className="w-1 h-1 rounded-full bg-primary/40"></div>
          <div className={`w-1 h-1 rounded-full ${totalParams > 0 ? 'bg-primary' : 'bg-border'}`}></div>
        </div>
      </div>

      {totalParams === 0 && loadedFiles.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest text-center">
            Configure parameters<br />to see the spec
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto pr-2 space-y-5">
          {visibleGroups.map((group) => {
            const activeItems = group.items.filter((item) => hasValue(item.value));
            return (
              <div
                key={group.number}
                className="relative pl-3 border-l border-border/40 hover:border-primary/30 transition-colors duration-300"
              >
                {/* Section Header */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-xs font-mono text-muted-foreground/40">{group.number}</span>
                  <span className="text-muted-foreground">{group.icon}</span>
                  <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                    {group.title}
                  </span>
                </div>

                {/* Items */}
                <div className="grid grid-cols-1 gap-1.5">
                  {activeItems.map((item, i) => {
                    const values = renderValue(item.value);
                    return values.map((val, vIdx) => (
                      <div
                        key={`${i}-${vIdx}`}
                        className="group flex items-baseline gap-3 transition-all"
                      >
                        <span className="text-xs font-mono text-muted-foreground/50 w-[4.5rem] shrink-0 uppercase tracking-tight text-right group-hover:text-primary/70 transition-colors">
                          {item.label}
                        </span>
                        <span className="text-xs font-medium text-foreground border-b border-dashed border-border/50 pb-0.5 group-hover:border-primary/30 transition-colors leading-tight break-words min-w-0">
                          {val}
                        </span>
                      </div>
                    ));
                  })}
                </div>
              </div>
            );
          })}

          {/* Archivos cargados: qué se usa en este módulo y qué se ignora */}
          {loadedFiles.length > 0 && (
            <div className="relative pl-3 border-l border-border/40">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-muted-foreground"><Paperclip className="w-3.5 h-3.5" /></span>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">Archivos</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {usedFiles.map((f, i) => (
                  <div key={`u-${i}`} className="flex items-baseline gap-3">
                    <span className="text-xs font-mono text-muted-foreground/50 w-[4.5rem] shrink-0 uppercase tracking-tight text-right">{f.label}</span>
                    <span className="text-xs font-medium text-foreground leading-tight break-words min-w-0">{f.name}</span>
                  </div>
                ))}
                {ignoredFiles.map((f, i) => (
                  <div key={`i-${i}`} className="flex items-baseline gap-3 opacity-60">
                    <span className="text-xs font-mono text-muted-foreground/50 w-[4.5rem] shrink-0 uppercase tracking-tight text-right">{f.label}</span>
                    <span className="text-xs leading-tight break-words min-w-0">{f.name} <em className="text-xs not-italic text-muted-foreground">(no se usa en {MODE_LABELS[mode]})</em></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
