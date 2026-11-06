import React from 'react';
import { DreamHouseParams } from '@/types';
import * as EC from '../constants';
import { OutputOptions, AmbienceSelects, CameraFields, CreativeFields } from '@/components/FormExtras';
import * as SC from '../../shared/constants';
import { Sparkles, MapPin, Box, Camera, ImageIcon, Home } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { ChipsField, EssenceFields, SiteFields, HomeProgramFields } from '@/components/FormFields';
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

  const renderChipsGroup = (label: string, key: keyof DreamHouseParams, options: string[], helpText: string, scrollable: boolean = false) => (
    <ChipsField params={params} onChange={handleChange} disabled={disabled} label={label} field={key} options={options} helpText={helpText} scrollable={scrollable} />
  );

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
        <EssenceFields params={params} onChange={handleChange} disabled={disabled} projectTypeLabel="Tipo de Proyecto (Principal)" />
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
            <Subtitle>Slot de Planta Arquitectónica (Geometría y Forma de la Casa)</Subtitle>
            <FloorPlanUploader 
              file={floorPlanFile} 
              onFileChange={onFloorPlanFileChange} 
              title="Plano Residencial / Planta Guía"
              description="La planta sirve únicamente como referencia de la forma y geometría de la casa (huella 1:1, alas, patios y vanos). La foto exterior debe cumplir con todos los demás parámetros que configures en el formulario y en el prompt."
            />
            {floorPlanFile && (
              <div className="mt-3 p-4 border border-primary/40 bg-primary/5 text-xs text-muted-foreground leading-relaxed" role="status">
                <span className="font-bold uppercase tracking-wider text-primary block mb-1">
                  Slot de Planta activo: forma y geometría ancladas (1:1)
                </span>
                La planta solo define la forma y geometría de la casa. La fachada exterior, materiales, estilo arquitectónico, cubierta, niveles, paisaje, iluminación y dirección creativa se generan cumpliendo fielmente con los parámetros del prompt.
              </div>
            )}
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
            <Subtitle>Referencias Visuales / Inspiración (Máx. 5)</Subtitle>
            <ReferenceUploader files={files} onFilesChange={onFilesChange} />
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
          <SiteFields params={params} onChange={handleChange} disabled={disabled} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select label="Topografía del Terreno" value={params.siteTopography} onChange={(e) => handleChange("siteTopography", e.target.value)} options={EC.SITE_TOPOGRAPHIES} disabled={disabled} />
            <Select label="Orientación Solar" value={params.solarOrientation} onChange={(e) => handleChange("solarOrientation", e.target.value)} options={EC.SOLAR_ORIENTATIONS} disabled={disabled} />
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mt-5">
              <Select label="Sistema Constructivo" value={params.constructionSystem} onChange={(e) => handleChange("constructionSystem", e.target.value)} options={EC.CONSTRUCTION_SYSTEMS} disabled={disabled} />
              <Select label="Material de Cubierta" value={params.roofMaterial} onChange={(e) => handleChange("roofMaterial", e.target.value)} options={EC.ROOF_MATERIALS} disabled={disabled} />
              <Select label="Tipo de Aberturas" value={params.windowType} onChange={(e) => handleChange("windowType", e.target.value)} options={EC.WINDOW_TYPES} disabled={disabled} />
            </div>
            <div className="mt-6">
              {renderChipsGroup("Estrategias Pasivas / Bioclimáticas", "passiveStrategies", EC.PASSIVE_STRATEGIES, "Cómo responde el edificio al sol, al viento y al agua.", true)}
            </div>
          </div>

          <div>
            <Subtitle>Programa Exterior</Subtitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <Select label="Estacionamiento" value={params.parkingType} onChange={(e) => handleChange("parkingType", e.target.value)} options={EC.PARKING_TYPES} disabled={disabled} />
                <div className="flex flex-col gap-2">
                  <label htmlFor="field-parking-spots" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Plazas de estacionamiento</label>
                  <DebouncedInput id="field-parking-spots" type="number" min={0} max={20} value={params.parkingSpots || ''} placeholder="Auto" onChange={(val) => handleChange("parkingSpots", parseInt(val) || 0)} disabled={disabled} />
                </div>
              </div>
              {renderChipsGroup("Áreas Sociales", "socialAreas", EC.SOCIAL_AREAS, "Espacios compartidos exteriores.", true)}
            </div>
          </div>

          <div>
            <Subtitle>Programa de la Vivienda</Subtitle>
            <HomeProgramFields params={params} onChange={handleChange} disabled={disabled} />
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
              <CameraFields params={params} onChange={handleChange} disabled={disabled} scene="exterior" />
              <AmbienceSelects params={params} onChange={handleChange} disabled={disabled} people />
            </div>
          </div>

          <div>
            <Subtitle>Configuración del Generador de IA</Subtitle>
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <OutputOptions params={params} onChange={handleChange} disabled={disabled} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <Select label="Estilo" value={params.renderStyle} onChange={(e) => handleChange("renderStyle", e.target.value)} options={SC.RENDER_STYLES} disabled={disabled} />
              </div>
            </div>
          </div>

          <div>
            <Subtitle>Dirección Creativa y Exclusiones</Subtitle>
            <CreativeFields params={params} onChange={handleChange} disabled={disabled} />
          </div>
        </div>
      </Section>
    </div>
  );
}
