import React from 'react';
import { DreamHouseParams } from '@/types';
import * as EC from '../constants';
import { OutputOptions, AmbienceSelects } from '@/components/FormExtras';
import * as SC from '../../shared/constants';
import clsx from 'clsx';
import { Sparkles, MapPin, Box, Camera, ImageIcon, Home } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import ReferenceUploader from '@/components/ReferenceUploader';
import LotUploader from '@/components/LotUploader';
import FloorPlanUploader from '@/components/FloorPlanUploader';
import { DebouncedInput } from '@/components/ui/DebouncedInput';

interface ExteriorFormProps {
  params: DreamHouseParams;
  onChange: (params: DreamHouseParams) => void;
  disabled?: boolean;
  activeSection: string | null;
  onSectionChange: (id: string) => void;

  // File Upload State & Handlers
  files: File[];
  onFilesChange: (files: File[]) => void;
  lotFile: File | null;
  onLotFileChange: (file: File | null) => void;
  exteriorReferenceFile: File | null;
  onExteriorReferenceFileChange: (file: File | null) => void;
  floorPlanFile: File | null;
  onFloorPlanFileChange: (file: File | null) => void;
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-4 py-2 mb-6 border-l-2 border-primary">
      <p className="text-sm text-muted-foreground leading-relaxed font-medium">{children}</p>
    </div>
  );
}

function Subtitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-mono font-bold text-primary uppercase tracking-widest border-b border-border/40 pb-2 mb-4">
      {children}
    </h4>
  );
}

export default function ExteriorForm({
  params,
  onChange,
  disabled,
  activeSection,
  onSectionChange,
  files,
  onFilesChange,
  lotFile,
  onLotFileChange,
  exteriorReferenceFile,
  onExteriorReferenceFileChange,
  floorPlanFile,
  onFloorPlanFileChange
}: ExteriorFormProps) {
  const handleChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const toggleMultiSelect = (key: keyof DreamHouseParams, value: string) => {
    const current = Array.isArray(params[key]) ? (params[key] as string[]) : [];
    const newValues = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    handleChange(key, newValues);
  };

  const renderChipsGroup = (label: string, key: keyof DreamHouseParams, options: string[], helpText: string, scrollable: boolean = false) => {
    const current = Array.isArray(params[key]) ? (params[key] as string[]) : [];
    return (
      <fieldset className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 px-1">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
          <p className="text-[11px] text-muted-foreground opacity-60 font-mono tracking-tight">{helpText}</p>
        </div>
        <div className={clsx("flex flex-wrap gap-2 p-1", scrollable && "max-h-56 overflow-y-auto custom-scrollbar border border-border/20 bg-card/30")}>
          {options.map(opt => (
            <Chip key={opt} selected={current.includes(opt)} disabled={disabled} onToggle={() => toggleMultiSelect(key, opt)}>
              {opt}
            </Chip>
          ))}
        </div>
      </fieldset>
    );
  };

  const conceptSummary = [
    params.projectType,
    params.architecturalStyles.join(', '),
    params.architect.join(', '),
    params.mood
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const mediaSummary = [
    files.length > 0 ? `${files.length} refs` : '',
    lotFile ? 'Terreno' : '',
    exteriorReferenceFile ? 'Casa base' : '',
    floorPlanFile ? 'Plano' : ''
  ].filter(Boolean).join(' · ') || 'Sin archivos';

  const siteSummary = [
    params.city,
    params.environment,
    params.climate
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const designSummary = [
    params.size ? (isNaN(Number(params.size)) ? params.size : `${params.size}m²`) : '',
    params.levels ? `${params.levels} pisos` : '',
    params.materials.join(', ')
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const renderSummary = [
    params.cameraPreset,
    params.cameraAngle,
    params.aiModel
  ].filter(Boolean).join(' · ') || 'Sin definir';

  return (
    <div className="space-y-0" role="form" aria-label="Módulo de Arquitectura Exterior">
      
      {/* ── FASE 1: CONCEPTO CENTRAL ────────────────────────────── */}
      <Section 
        title="Fase 1: Concepto Central" 
        number="02" 
        icon={<Sparkles className="w-5 h-5" />} 
        isOpen={activeSection === 'concept'} 
        onToggle={() => onSectionChange('concept')}
        summary={conceptSummary}
      >
        <SectionDescription>Define la esencia y el carácter arquitectónico del edificio exterior. Comienza eligiendo el tipo de proyecto.</SectionDescription>
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select 
              label="Tipo de Proyecto (Principal)" 
              value={params.projectType} 
              onChange={(e) => handleChange("projectType", e.target.value)} 
              options={EC.PROJECT_TYPES} 
              disabled={disabled} 
            />
            <Select 
              label="Atmósfera / Mood" 
              value={params.mood} 
              onChange={(e) => handleChange("mood", e.target.value)} 
              options={SC.MOODS} 
              disabled={disabled} 
            />
          </div>
          <div className="grid grid-cols-1 gap-6">
            {renderChipsGroup("Estilos Arquitectónicos", "architecturalStyles", SC.STYLES, "Combina estéticas para una propuesta única.", true)}
            {renderChipsGroup("Arquitectos Inspiradores", "architect", SC.ARCHITECTS, "Influencia formal y conceptual del diseño.", true)}
          </div>
        </div>
      </Section>

      {/* ── FASE 2: GEOMETRÍA E IMAGEN BASE ───────────────────────── */}
      <Section 
        title="Fase 2: Geometría e Imagen Base" 
        number="03" 
        icon={<ImageIcon className="w-5 h-5" />} 
        isOpen={activeSection === 'media'} 
        onToggle={() => onSectionChange('media')}
        summary={mediaSummary}
      >
        <SectionDescription>Sube las fotos y planos que guiarán la estructura de la generación.</SectionDescription>
        <div className="space-y-8">
          <div>
            <Subtitle>Referencias Visuales / Inspiración (Máx. 5)</Subtitle>
            <ReferenceUploader files={files} onFilesChange={onFilesChange} />
          </div>

          <div>
            <Subtitle>Imágenes de Emplazamiento y Estructura</Subtitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <LotUploader 
                file={lotFile} 
                onFileChange={onLotFileChange} 
                title="Foto del Lote / Terreno"
                description="Sube una foto real del terreno. La IA integrará el volumen en el sitio."
              />
              <LotUploader 
                file={exteriorReferenceFile} 
                onFileChange={(f) => {
                  onExteriorReferenceFileChange(f);
                  handleChange("hasExteriorReference", !!f);
                }} 
                title="Casa Actual (Estructura Base)"
                description="Sube una foto de la casa existente. La IA mantendrá la volumetría y cambiará el estilo."
                icon={<Home className="w-5 h-5 text-primary" />}
              />
            </div>
          </div>

          <div>
            <Subtitle>Plano de Planta (Guía Geométrica)</Subtitle>
            <FloorPlanUploader 
              file={floorPlanFile} 
              onFileChange={onFloorPlanFileChange} 
              title="Plano Residencial"
              description="Sube el plano de planta. El exterior respetará la geometría del plano."
            />
          </div>
        </div>
      </Section>

      {/* ── FASE 3: SITIO Y CLIMA ────────────────────────────────── */}
      <Section 
        title="Fase 3: Sitio y Clima" 
        number="04" 
        icon={<MapPin className="w-5 h-5" />} 
        isOpen={activeSection === 'site'} 
        onToggle={() => onSectionChange('site')}
        summary={siteSummary}
      >
        <SectionDescription>El emplazamiento físico y las condiciones climáticas del sitio.</SectionDescription>
        <div className="space-y-6">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1">Ciudad / Región</label>
            <DebouncedInput 
              value={params.city} 
              onChange={(val) => handleChange("city", val)} 
              placeholder="Ej: Kyoto, Oslo, Atacama..." 
              disabled={disabled} 
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Entorno Natural" value={params.environment} onChange={(e) => handleChange("environment", e.target.value)} options={EC.ENVIRONMENTS} disabled={disabled} />
            <Select label="Clima Dominante" value={params.climate} onChange={(e) => handleChange("climate", e.target.value)} options={EC.CLIMATES} disabled={disabled} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Cuerpo de Agua" value={params.waterBody} onChange={(e) => handleChange("waterBody", e.target.value)} options={EC.WATER_BODIES} disabled={disabled} />
            <Select label="Condición del Tiempo" value={params.weatherCondition} onChange={(e) => handleChange("weatherCondition", e.target.value)} options={EC.WEATHER_CONDITIONS} disabled={disabled} />
          </div>
        </div>
      </Section>

      {/* ── FASE 4: DISEÑO FÍSICO Y PROGRAMA ───────────────────────── */}
      <Section 
        title="Fase 4: Diseño Físico y Programa" 
        number="05" 
        icon={<Box className="w-5 h-5" />} 
        isOpen={activeSection === 'design'} 
        onToggle={() => onSectionChange('design')}
        summary={designSummary}
      >
        <SectionDescription>Configura la volumetría, el programa funcional, los materiales y el paisaje.</SectionDescription>
        <div className="space-y-10">
          <div>
            <Subtitle>Volumetría y Estructura</Subtitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest px-1">Superficie construida / Tamaño</label>
                <div className="relative">
                  <DebouncedInput 
                    type="number" 
                    min={0}
                    value={params.size || ""} 
                    onChange={(val) => handleChange("size", val)} 
                    placeholder="ej: 250" 
                    disabled={disabled} 
                    className="pl-4 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">m²</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Niveles / Pisos</label>
                <DebouncedInput 
                  type="number" 
                  min={1} 
                  max={50} 
                  value={params.levels || ''} placeholder="Auto" 
                  onChange={(val) => handleChange("levels", parseInt(val) || 0)} 
                  disabled={disabled} 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
              <Select label="Tipo de Cubierta" value={params.roofType} onChange={(e) => handleChange("roofType", e.target.value)} options={EC.ROOF_TYPES} disabled={disabled} />
              <Select label="Esquema Espacial" value={params.layoutType} onChange={(e) => handleChange("layoutType", e.target.value)} options={EC.LAYOUT_TYPES} disabled={disabled} />
            </div>
          </div>

          <div>
            <Subtitle>Programa Exterior</Subtitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Select label="Estacionamiento" value={params.parkingType} onChange={(e) => handleChange("parkingType", e.target.value)} options={EC.PARKING_TYPES} disabled={disabled} />
              {renderChipsGroup("Áreas Sociales", "socialAreas", EC.SOCIAL_AREAS, "Espacios compartidos exteriores.", true)}
            </div>
          </div>

          <div>
            <Subtitle>Paisajismo y Entorno Verde</Subtitle>
            <div className="space-y-6">
              {renderChipsGroup("Elementos de Sitio", "exteriorElements", EC.EXTERIOR_ELEMENTS, "Infraestructura exterior.", true)}
              {renderChipsGroup("Especies Vegetales", "vegetation", EC.VEGETATION, "Entorno verde natural.", true)}
            </div>
          </div>

          <div>
            <Subtitle>Piel, Color y Acabado</Subtitle>
            <div className="space-y-6">
              {renderChipsGroup("Materiales Dominantes", "materials", EC.MATERIALS, "Paleta constructiva exterior (Max. 3 recomendados).", true)}
              <Select label="Calidad de Ejecución" value={params.finishLevel} onChange={(e) => handleChange("finishLevel", e.target.value)} options={EC.FINISH_LEVELS} disabled={disabled} />
              {renderChipsGroup("Paleta de Color", "colorPalette", SC.COLORS, "Tonos cromáticos de la fachada.")}
              {renderChipsGroup("Detalles de Diseño", "architecturalDetails", EC.ARCHITECTURAL_DETAILS, "Gamas y ornamentación.")}
            </div>
          </div>
        </div>
      </Section>

      {/* ── FASE 5: CAPTURA Y RENDER ────────────────────────────── */}
      <Section 
        title="Fase 5: Captura y Render" 
        number="06" 
        icon={<Camera className="w-5 h-5" />} 
        isOpen={activeSection === 'render'} 
        onToggle={() => onSectionChange('render')}
        summary={renderSummary}
      >
        <SectionDescription>Configura la dirección de cámara, los parámetros de la IA y el control creativo.</SectionDescription>
        <div className="space-y-10">
          <div>
            <Subtitle>Dirección de Cámara</Subtitle>
            <div className="space-y-5">
              <Select label="Preset de Cámara" value={params.cameraPreset} onChange={(e) => handleChange("cameraPreset", e.target.value)} options={SC.CAMERA_PRESET_NAMES} disabled={disabled} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Select label="Lente" value={params.focalLength} onChange={(e) => handleChange("focalLength", e.target.value)} options={SC.FOCAL_LENGTHS} disabled={disabled} />
                <Select label="Diafragma" value={params.aperture} onChange={(e) => handleChange("aperture", e.target.value)} options={SC.APERTURES} disabled={disabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Select label="Ángulo" value={params.cameraAngle} onChange={(e) => handleChange("cameraAngle", e.target.value)} options={SC.ANGLES} disabled={disabled} />
                <Select label="Composición" value={params.composition} onChange={(e) => handleChange("composition", e.target.value)} options={SC.COMPOSITIONS} disabled={disabled} />
              </div>
              <AmbienceSelects params={params} onChange={handleChange} disabled={disabled} />
            </div>
          </div>

          <div>
            <Subtitle>Configuración del Generador de IA</Subtitle>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Select label="Modelo de IA" value={params.aiModel} onChange={(e) => handleChange("aiModel", e.target.value)} options={SC.AI_MODELS} disabled={disabled} />
          <OutputOptions params={params} onChange={handleChange} disabled={disabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Select label="Estilo" value={params.renderStyle} onChange={(e) => handleChange("renderStyle", e.target.value)} options={SC.RENDER_STYLES} disabled={disabled} />
                <Select label="Ratio" value={params.renderAspectRatio} onChange={(e) => handleChange("renderAspectRatio", e.target.value)} options={SC.ASPECT_RATIOS} disabled={disabled} />
                <Select label="Resolución" value={params.renderOutputResolution} onChange={(e) => handleChange("renderOutputResolution", e.target.value)} options={SC.OUTPUT_RESOLUTIONS} disabled={disabled} />
              </div>
            </div>
          </div>

          <div>
            <Subtitle>Dirección Creativa Adicional</Subtitle>
            <DebouncedInput 
              type="textarea"
              value={params.artDirection} 
              onChange={(val) => handleChange("artDirection", val)} 
              placeholder="Instrucciones artísticas específicas o detalles que no cubran los selectores..." 
              disabled={disabled}
            />
          </div>
        </div>
      </Section>
    </div>
  );
}
