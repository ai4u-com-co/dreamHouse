import React from 'react';
import { DreamHouseParams } from '@/types';
import { OutputOptions, CreativeFields } from '@/components/FormExtras';
import * as SC from '../../shared/constants';
import * as EC from '../../exterior/constants';
import * as IC from '../../interior/constants';
import * as EDC from '../constants';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { ChipsField, EssenceFields } from '@/components/FormFields';
import { PenLine, ImageIcon, Trash2, SlidersHorizontal, Sparkles, Layers } from 'lucide-react';
import SketchCanvas, { type EditMaskPayload } from '@/components/SketchCanvas';
import LotUploader from '@/components/LotUploader';
import { DebouncedInput } from '@/components/ui/DebouncedInput';

interface EditFormProps {
  params: DreamHouseParams;
  onChange: (params: DreamHouseParams) => void;
  disabled?: boolean;
  activeSection?: string | null;
  openSections?: Set<string>;
  onSectionChange: (id: string) => void;
  baseImage: File | null;
  onBaseImageUpdate: (file: File | null) => void;
  /** Archivo original de la base, antes de recomprimirlo (para leer sus metadatos) */
  onBaseOriginalSelected?: (file: File) => void;
  onCompositeImageUpdate: (file: File | null) => void;
  onMaskUpdate: (payload: EditMaskPayload | null) => void;
}

/** En edición el espacio puede ser un interior o una fachada: ambos catálogos de materiales */
const ALL_MATERIALS = [...new Set([...EC.MATERIALS, ...IC.INTERIOR_MATERIALS])].sort((a, b) => a.localeCompare(b, 'es'));

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-4 py-2 mb-6 border-l-2 border-primary">
      <p className="text-sm text-muted-foreground leading-relaxed font-medium">{children}</p>
    </div>
  );
}

export default function EditForm({ 
  params, 
  onChange, 
  disabled, 
  activeSection, 
  openSections,
  onSectionChange,
  baseImage,
  onBaseImageUpdate,
  onBaseOriginalSelected,
  onCompositeImageUpdate,
  onMaskUpdate
}: EditFormProps) {
  const isSectionOpen = (id: string) => openSections ? openSections.has(id) : activeSection === id;
  const handleChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const changeSummary = [
    params.editChangeType,
    params.editIntensity,
    params.editPreserve.length ? `conserva ${params.editPreserve.length}` : '',
  ].filter(Boolean).join(' · ') || 'Opcional';

  const designSummary = [
    params.roomType,
    params.projectType,
    params.architecturalStyles.join(', '),
    params.architect.join(', '),
    params.mood,
  ].filter(Boolean).join(' · ') || 'Opcional';

  const finishesSummary = [
    params.flooringMaterial,
    params.ceilingDetail,
    params.wallFinish,
    params.materials.join(', '),
    params.furnitureStyle.join(', '),
    params.colorPalette.join(', '),
  ].filter(Boolean).join(' · ') || 'Opcional';

  return (
    <div className="space-y-0" role="form" aria-label="Módulo de Edición de Imagen">

      {/* ── 04 SKETCH CANVAS ─────────────────────────────────────── */}
      <Section title="Modo Sketch / Edición Visual" number="02" icon={<PenLine className="w-5 h-5" />} isOpen={isSectionOpen('sketch')} onToggle={() => onSectionChange('sketch')}>
        <SectionDescription>Marca las zonas que deseas modificar —pintando con el pincel o con «Zona por puntos», tocando punto por punto como en un mapa— y escribe tu instrucción de edición.</SectionDescription>
        
        <div className="space-y-8">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">Instrucción Principal (Prompt de Edición)</label>
            <DebouncedInput 
              type="textarea"
              value={params.editPrompt || ""} 
              onChange={(val) => handleChange("editPrompt", val)} 
              placeholder="Ej: Make the tree smaller, add a modern pool, change the wall color to white..." 
              disabled={disabled}
              className="h-24"
            />
          </div>

          {!baseImage ? (
            <LotUploader 
              file={baseImage} 
              onFileChange={onBaseImageUpdate} 
              onOriginalSelected={onBaseOriginalSelected}
              title="Sube la imagen a editar" 
              description="Sube la base sobre la que harás los trazos."
              skipSizeValidation={true}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex justify-end">
                <button 
                  onClick={() => onBaseImageUpdate(null)} 
                  className="text-xs text-destructive hover:underline flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  Quitar imagen base
                </button>
              </div>
              <SketchCanvas baseImage={baseImage} onCompositeImageUpdate={onCompositeImageUpdate} onMaskUpdate={onMaskUpdate} />
            </div>
          )}
        </div>
      </Section>

      {/* ── 03 TIPO DE CAMBIO ──────────────────────────────────── */}
      <Section title="Tipo de Cambio" number="03" icon={<SlidersHorizontal className="w-5 h-5" />} isOpen={isSectionOpen('edit-change')} onToggle={() => onSectionChange('edit-change')} summary={changeSummary}>
        <SectionDescription>Opcional. Orienta a la IA sobre qué clase de cambio es, cuánto puede transformar la zona y qué debe quedar idéntico.</SectionDescription>
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Tipo de cambio" value={params.editChangeType} onChange={(e) => handleChange("editChangeType", e.target.value)} options={EDC.EDIT_CHANGE_TYPES} disabled={disabled} />
            <Select label="Intensidad" value={params.editIntensity} onChange={(e) => handleChange("editIntensity", e.target.value)} options={EDC.EDIT_INTENSITIES} disabled={disabled} />
          </div>
          <ChipsField params={params} onChange={handleChange} disabled={disabled} label="Qué debe conservarse" field="editPreserve" options={EDC.EDIT_PRESERVE_OPTIONS} helpText="Lo que no debe cambiar fuera de la zona editada." />
        </div>
      </Section>

      {/* ── 04 ESPACIO Y DIRECCIÓN DE DISEÑO (mismos campos que interior/exterior) ── */}
      <Section title="Espacio y Dirección de Diseño" number="04" icon={<Sparkles className="w-5 h-5" />} isOpen={isSectionOpen('edit-design')} onToggle={() => onSectionChange('edit-design')} summary={designSummary}>
        <SectionDescription>Opcional. Dile a la IA qué tipo de espacio es y bajo qué estilo o maestro rediseñarlo. Se aplica solo a lo que editas. Son los mismos datos de Exterior e Interior: si los cambias aquí, también cambian allá.</SectionDescription>
        <EssenceFields
          params={params}
          onChange={handleChange}
          disabled={disabled}
          projectTypeLabel="Tipo de Proyecto (edificio)"
          projectTypeHelp="El edificio al que pertenece el espacio."
          stylesLabel="Estilo del Cambio"
          stylesHelp="Lenguaje estético de lo que se edita."
          architectLabel="Influencia de Autor (Arquitecto / Maestro)"
          architectHelp="Aplica la sensibilidad de un maestro solo a la zona editada."
        >
          <Select label="Tipo de Espacio" value={params.roomType} onChange={(e) => handleChange("roomType", e.target.value)} options={IC.ROOM_TYPES} disabled={disabled} />
        </EssenceFields>
      </Section>

      {/* ── 05 MATERIALES, COLOR Y MOBILIARIO ─────────────────── */}
      <Section title="Materiales, Color y Mobiliario" number="05" icon={<Layers className="w-5 h-5" />} isOpen={isSectionOpen('edit-finishes')} onToggle={() => onSectionChange('edit-finishes')} summary={finishesSummary}>
        <SectionDescription>Opcional. Qué materiales, colores y piezas debe usar el cambio.</SectionDescription>
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Suelo / Pavimento" value={params.flooringMaterial} onChange={(e) => handleChange("flooringMaterial", e.target.value)} options={IC.FLOORING_MATERIALS} disabled={disabled} />
            <Select label="Techo / Cielorraso" value={params.ceilingDetail} onChange={(e) => handleChange("ceilingDetail", e.target.value)} options={IC.CEILING_DETAILS} disabled={disabled} />
            <Select label="Acabado de Muros" value={params.wallFinish} onChange={(e) => handleChange("wallFinish", e.target.value)} options={IC.WALL_FINISHES} disabled={disabled} />
            <Select label="Tipo de Aberturas" value={params.windowType} onChange={(e) => handleChange("windowType", e.target.value)} options={EC.WINDOW_TYPES} disabled={disabled} />
          </div>
          <ChipsField params={params} onChange={handleChange} disabled={disabled} label="Materiales y Revestimientos" field="materials" options={ALL_MATERIALS} helpText="Materiales de muros y superficies." scrollable />
          <ChipsField params={params} onChange={handleChange} disabled={disabled} label="Mobiliario" field="furnitureStyle" options={IC.FURNITURE_STYLES} helpText="Estilo de las piezas de mobiliario." scrollable />
          <ChipsField params={params} onChange={handleChange} disabled={disabled} label="Luminarias" field="interiorLighting" options={IC.INTERIOR_LIGHTING_TYPES} helpText="Tipo de luminarias, si el cambio las incluye." scrollable />
          <ChipsField params={params} onChange={handleChange} disabled={disabled} label="Colores Dominantes" field="colorPalette" options={SC.COLORS} helpText="Gama cromática del cambio." />
          <Select label="Nivel de Acabado" value={params.finishLevel} onChange={(e) => handleChange("finishLevel", e.target.value)} options={EC.FINISH_LEVELS} disabled={disabled} />
        </div>
      </Section>

      {/* ── 05 PROCESO ─────────────────────────────────────────── */}
      <Section title="Configuración de Salida" number="06" icon={<ImageIcon className="w-5 h-5" />} isOpen={isSectionOpen('output')} onToggle={() => onSectionChange('output')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <OutputOptions params={params} onChange={handleChange} disabled={disabled} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Select label="Estilo Render" value={params.renderStyle} onChange={(e) => handleChange("renderStyle", e.target.value)} options={SC.RENDER_STYLES} disabled={disabled} />
        </div>
        <div className="mt-5">
          <CreativeFields params={params} onChange={handleChange} disabled={disabled} artDirection={false} />
        </div>
      </Section>

    </div>
  );
}
