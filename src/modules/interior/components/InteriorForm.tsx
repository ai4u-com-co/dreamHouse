import React from 'react';
import { DreamHouseParams } from '@/types';
import * as IC from '../constants';
import * as EC from '../../exterior/constants';
import { OutputOptions } from '@/components/FormExtras';
import * as SC from '../../shared/constants';
import { Sparkles, Armchair, LayoutGrid, Layers, Palette, Camera, ImageIcon, PenLine, ScanSearch, MapPin } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { ChipsField, EssenceFields, SiteFields, HomeProgramFields } from '@/components/FormFields';
import { AmbienceSelects } from '@/components/FormExtras';
import ObjectUploader from '@/components/ObjectUploader';
import { DebouncedInput } from '@/components/ui/DebouncedInput';

interface InteriorFormProps {
  params: DreamHouseParams;
  onChange: (params: DreamHouseParams) => void;
  disabled?: boolean;
  activeSection: string | null;
  onSectionChange: (id: string) => void;
  objectFiles: File[];
  onObjectFilesChange: (files: File[]) => void;
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-4 py-2 mb-6 border-l-2 border-primary">
      <p className="text-sm text-muted-foreground leading-relaxed font-medium">{children}</p>
    </div>
  );
}

export default function InteriorForm({ params, onChange, disabled, activeSection, onSectionChange, objectFiles, onObjectFilesChange }: InteriorFormProps) {
  const handleChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const renderChipsGroup = (label: string, key: keyof DreamHouseParams, options: string[], helpText: string, scrollable: boolean = false) => (
    <ChipsField params={params} onChange={handleChange} disabled={disabled} label={label} field={key} options={options} helpText={helpText} scrollable={scrollable} />
  );

  // const selectedCamera = SC.CAMERA_PRESETS.find(c => c.name === params.cameraPreset) ?? null;
  // const filmSims = selectedCamera?.isFujifilm ? SC.FUJIFILM_FILM_SIMULATIONS : SC.UNIVERSAL_FILM_LOOKS;

  const identitySummary = [
    params.projectType,
    params.roomType,
    params.mood,
    params.roomSizeM2 ? `${params.roomSizeM2}m²` : '',
    params.architecturalStyles.join(', '),
    params.architect.join(', ')
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const siteSummary = [
    params.city,
    params.climate,
    params.timeOfDay
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const designSummary = [
    params.furnitureStyle.join(', '),
    params.interiorLighting.join(', ')
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const objectsSummary = objectFiles.length > 0 ? `${objectFiles.length} objetos cargados` : 'Sin objetos';

  const programSummary = [
    params.kitchenType,
    params.livingAreaType,
    params.bedrooms ? `${params.bedrooms} hab` : '',
    params.bathrooms ? `${params.bathrooms} baños` : ''
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const finishesSummary = [
    params.flooringMaterial,
    params.ceilingDetail,
    params.materials.join(', ')
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const colorSummary = params.colorPalette.join(', ') || 'Sin definir';

  const cameraSummary = [
    params.cameraPreset,
    params.cameraAngle,
    params.composition
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const outputSummary = [
    params.aiModel,
    params.renderStyle,
    params.renderAspectRatio
  ].filter(Boolean).join(' · ') || 'Sin definir';

  return (
    <div className="space-y-0" role="form" aria-label="Módulo de Diseño Interior">
      {/* ── 01 ESPACIO ─────────────────────────────────────────── */}
      <Section 
        title="Espacio y Propósito" 
        number="05" 
        icon={<Sparkles className="w-5 h-5" />} 
        isOpen={activeSection === 'identity'} 
        onToggle={() => onSectionChange('identity')}
        summary={identitySummary}
      >
        <SectionDescription>Define la esencia del proyecto: qué edificio es, qué espacio, con qué atmósfera, estilo e influencia de autor. Estos datos son los mismos del módulo Exterior: si los cambias aquí, también cambian allá.</SectionDescription>
        <div className="space-y-8">
          <EssenceFields
            params={params}
            onChange={handleChange}
            disabled={disabled}
            projectTypeLabel="Tipo de Proyecto (edificio)"
            projectTypeHelp="El edificio al que pertenece el espacio."
            stylesLabel="Estilo Decorativo"
            stylesHelp="Lenguaje estético interior."
            architectLabel="Influencia de Autor (Arquitecto)"
            architectHelp="Busca la sensibilidad espacial de un maestro específico."
          >
            <Select label="Espacio / Habitación" value={params.roomType} onChange={(e) => handleChange("roomType", e.target.value)} options={IC.ROOM_TYPES} disabled={disabled} />
          </EssenceFields>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label htmlFor="field-room-size" className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Superficie del espacio</label>
              <p className="text-[11px] text-muted-foreground opacity-60 font-mono tracking-tight px-1">m² aproximados — define la escala y proporción de la escena</p>
              <div className="relative">
                <DebouncedInput
                  id="field-room-size"
                  type="number"
                  min={0}
                  value={params.roomSizeM2 || ""}
                  onChange={(val) => handleChange("roomSizeM2", parseFloat(val) || 0)}
                  placeholder="ej: 35"
                  disabled={disabled}
                  className="pl-4 pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">m²</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* ── SITIO Y LUZ NATURAL (mismos campos que el exterior) ───────── */}
      <Section
        title="Sitio y Luz Natural"
        number="06"
        icon={<MapPin className="w-5 h-5" />}
        isOpen={activeSection === 'site'}
        onToggle={() => onSectionChange('site')}
        summary={siteSummary}
      >
        <SectionDescription>Dónde está el espacio y qué luz recibe: define lo que se ve por las ventanas y el color de la luz natural. Comparte los datos con el módulo Exterior.</SectionDescription>
        <div className="space-y-8">
          <SiteFields params={params} onChange={handleChange} disabled={disabled} />
          <AmbienceSelects params={params} onChange={handleChange} disabled={disabled} people hint="La hora, la estación y el tipo de luz describen la luz natural que entra al espacio." />
        </div>
      </Section>

      {/* ── 02 EQUIPAMIENTO ─────────────────────────────────────── */}
      <Section 
        title="Equipamiento y Luz" 
        number="07" 
        icon={<Armchair className="w-5 h-5" />} 
        isOpen={activeSection === 'interior-design'} 
        onToggle={() => onSectionChange('interior-design')}
        summary={designSummary}
      >
        <SectionDescription>Configura los muebles y la iluminación ambiental.</SectionDescription>
        <div className="space-y-8">
          {renderChipsGroup("Mobiliario", "furnitureStyle", IC.FURNITURE_STYLES, "Piezas y acabados de muebles.", true)}
          {renderChipsGroup("Iluminación Interior", "interiorLighting", IC.INTERIOR_LIGHTING_TYPES, "Fuentes de luz artificial y natural.", true)}
        </div>
      </Section>

      {/* ── 03 OBJETOS ──────────────────────────────────────────── */}
      <Section 
        title="Piezas & Objetos" 
        number="08" 
        icon={<ScanSearch className="w-5 h-5" />} 
        isOpen={activeSection === 'interior-objects'} 
        onToggle={() => onSectionChange('interior-objects')}
        summary={objectsSummary}
      >
        <SectionDescription>Sube fotos de muebles u objetos específicos que quieres incluir: sillas, camas, lámparas, mesas… Gemini los integrará fielmente en la escena.</SectionDescription>
        <ObjectUploader files={objectFiles} onFilesChange={onObjectFilesChange} disabled={disabled} />
      </Section>

      {/* ── 04 PROGRAMA ─────────────────────────────────────────── */}
      <Section 
        title="Detalle Funcional" 
        number="09" 
        icon={<LayoutGrid className="w-5 h-5" />} 
        isOpen={activeSection === 'program'} 
        onToggle={() => onSectionChange('program')}
        summary={programSummary}
      >
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Tipo de Cocina" value={params.kitchenType} onChange={(e) => handleChange("kitchenType", e.target.value)} options={IC.KITCHEN_TYPES} disabled={disabled} />
            <Select label="Área Social" value={params.livingAreaType} onChange={(e) => handleChange("livingAreaType", e.target.value)} options={IC.LIVING_AREA_TYPES} disabled={disabled} />
          </div>
          <HomeProgramFields params={params} onChange={handleChange} disabled={disabled} />
        </div>
      </Section>

      {/* ── 05 ACABADOS ─────────────────────────────────────────── */}
      <Section 
        title="Materialidad y Superficies" 
        number="10" 
        icon={<Layers className="w-5 h-5" />} 
        isOpen={activeSection === 'materials'} 
        onToggle={() => onSectionChange('materials')}
        summary={finishesSummary}
      >
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Suelo / Pavimento" value={params.flooringMaterial} onChange={(e) => handleChange("flooringMaterial", e.target.value)} options={IC.FLOORING_MATERIALS} disabled={disabled} />
            <Select label="Techo / Cielorraso" value={params.ceilingDetail} onChange={(e) => handleChange("ceilingDetail", e.target.value)} options={IC.CEILING_DETAILS} disabled={disabled} />
          </div>
          {renderChipsGroup("Revestimientos", "materials", EC.MATERIALS, "Materiales de muros y superficies.", true)}
          <Select label="Nivel de Acabado" value={params.finishLevel} onChange={(e) => handleChange("finishLevel", e.target.value)} options={EC.FINISH_LEVELS} disabled={disabled} />
        </div>
      </Section>

      {/* ── 06 ESTÉTICA ─────────────────────────────────────────── */}
      <Section 
        title="Paleta de Color" 
        number="11" 
        icon={<Palette className="w-5 h-5" />} 
        isOpen={activeSection === 'landscape'} 
        onToggle={() => onSectionChange('landscape')}
        summary={colorSummary}
      >
        {renderChipsGroup("Colores Dominantes", "colorPalette", SC.COLORS, "Gama cromática interior.")}
      </Section>

      {/* ── 07 FOTOGRAFÍA ───────────────────────────────────────── */}
      <Section 
        title="Configuración de Cámara" 
        number="12" 
        icon={<Camera className="w-5 h-5" />} 
        isOpen={activeSection === 'photography'} 
        onToggle={() => onSectionChange('photography')}
        summary={cameraSummary}
      >
        <div className="space-y-6">
          <Select label="Dirección de Fotografía" value={params.cameraPreset} onChange={(e) => handleChange("cameraPreset", e.target.value)} options={SC.CAMERA_PRESET_NAMES} disabled={disabled} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Distancia Focal" value={params.focalLength} onChange={(e) => handleChange("focalLength", e.target.value)} options={SC.FOCAL_LENGTHS} disabled={disabled} />
            <Select label="Apertura" value={params.aperture} onChange={(e) => handleChange("aperture", e.target.value)} options={SC.APERTURES} disabled={disabled} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Ángulo" value={params.cameraAngle} onChange={(e) => handleChange("cameraAngle", e.target.value)} options={SC.ANGLES} disabled={disabled} />
            <Select label="Composición" value={params.composition} onChange={(e) => handleChange("composition", e.target.value)} options={SC.COMPOSITIONS} disabled={disabled} />
          </div>
        </div>
      </Section>

      {/* ── 08 SALIDA ──────────────────────────────────────────── */}
      <Section 
        title="Output Final" 
        number="13" 
        icon={<ImageIcon className="w-5 h-5" />} 
        isOpen={activeSection === 'output'} 
        onToggle={() => onSectionChange('output')}
        summary={outputSummary}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <Select label="Modelo de IA" value={params.aiModel} onChange={(e) => handleChange("aiModel", e.target.value)} options={SC.AI_MODELS} disabled={disabled} />
          <OutputOptions params={params} onChange={handleChange} disabled={disabled} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Select label="Estilo de Imagen" value={params.renderStyle} onChange={(e) => handleChange("renderStyle", e.target.value)} options={SC.RENDER_STYLES} disabled={disabled} />
          <Select label="Aspect Ratio" value={params.renderAspectRatio} onChange={(e) => handleChange("renderAspectRatio", e.target.value)} options={SC.ASPECT_RATIOS} disabled={disabled} />
          <Select label="Resolución" value={params.renderOutputResolution} onChange={(e) => handleChange("renderOutputResolution", e.target.value)} options={SC.OUTPUT_RESOLUTIONS} disabled={disabled} />
        </div>
      </Section>

      {/* ── 09 DIRECCIÓN ───────────────────────────────────────── */}
      <Section title="Dirección Creativa" number="14" icon={<PenLine className="w-5 h-5" />} isOpen={activeSection === 'creative'} onToggle={() => onSectionChange('creative')}>
        <DebouncedInput
          type="textarea"
          value={params.artDirection || ""}
          onChange={(val) => handleChange("artDirection", val)}
          placeholder="Notas sobre el estilismo o la luz..."
          disabled={disabled}
        />
      </Section>
    </div>
  );
}
