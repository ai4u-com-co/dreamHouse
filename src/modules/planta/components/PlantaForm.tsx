'use client';

import React from 'react';
import clsx from 'clsx';
import { DreamHouseParams } from '@/types';
import * as PC from '../constants';
import * as EC from '../../exterior/constants';
import * as IC from '../../interior/constants';
import * as SC from '../../shared/constants';
import { OutputOptions, CreativeFields } from '@/components/FormExtras';
import { LayoutGrid, Compass, Layers, Sparkles, ImageIcon } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { ChipsField, EssenceFields, HomeProgramFields } from '@/components/FormFields';
import FloorPlanUploader from '@/components/FloorPlanUploader';
import LotUploader from '@/components/LotUploader';
import { DebouncedInput } from '@/components/ui/DebouncedInput';

interface PlantaFormProps {
  params: DreamHouseParams;
  onChange: (params: DreamHouseParams) => void;
  disabled?: boolean;
  activeSection: string | null;
  onSectionChange: (id: string) => void;
  floorPlanFile: File | null;
  onFloorPlanFileChange: (file: File | null) => void;
  lotFile: File | null;
  onLotFileChange: (file: File | null) => void;
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

export default function PlantaForm({
  params,
  onChange,
  disabled,
  activeSection,
  onSectionChange,
  floorPlanFile,
  onFloorPlanFileChange,
  lotFile,
  onLotFileChange,
}: PlantaFormProps) {
  const handleChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const renderChipsGroup = (
    label: string,
    key: keyof DreamHouseParams,
    options: readonly string[],
    helpText: string,
    scrollable: boolean = false,
  ) => (
    <ChipsField
      params={params}
      onChange={handleChange}
      disabled={disabled}
      label={label}
      field={key}
      options={options}
      helpText={helpText}
      scrollable={scrollable}
    />
  );

  const programSummary = [
    params.size ? (isNaN(Number(params.size)) ? params.size : `${params.size} m²`) : '',
    params.lotWidthM && params.lotDepthM ? `Lote ${params.lotWidthM}×${params.lotDepthM} m` : '',
    params.levels ? `${params.levels} ${params.levels === 1 ? 'piso' : 'pisos'}` : '',
    params.bedrooms ? `${params.bedrooms} hab.` : '',
    params.bathrooms ? `${params.bathrooms} baños` : '',
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const zoningSummary = [
    params.layoutType,
    params.zoningLayout,
    params.planSpaces.length > 0 ? `${params.planSpaces.length} ambientes extra` : '',
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const styleSummary = [
    params.floorPlanStyle || 'Planta Humanizada 2D',
    params.projectType,
    params.architecturalStyles.join(', '),
  ].filter(Boolean).join(' · ') || 'Sin definir';

  const mediaSummary = [
    floorPlanFile ? 'Boceto guía' : '',
    lotFile ? 'Terreno' : '',
  ].filter(Boolean).join(' · ') || 'Opcional';

  return (
    <div className="space-y-0" role="form" aria-label="Módulo de Planta Arquitectónica">
      {/* ── FASE 1: PROGRAMA ARQUITECTÓNICO Y METRAJE ─────────────────── */}
      <Section
        title="Fase 1: Programa y Dimensiones"
        number="02"
        icon={<LayoutGrid className="w-5 h-5" />}
        isOpen={activeSection === 'program'}
        onToggle={() => onSectionChange('program')}
        summary={programSummary}
      >
        <SectionDescription>
          Define los metros cuadrados, dimensiones del terreno, niveles, habitaciones, baños y ambientes que debe resolver la planta antes de levantar la casa. Todo este programa se conserva al pasar a Exterior o Interior.
        </SectionDescription>

        <div className="space-y-8">
          <div>
            <Subtitle>Superficie, Huella y Niveles</Subtitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="field-planta-size" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Área Construida (m²)
                </label>
                <div className="relative">
                  <DebouncedInput
                    id="field-planta-size"
                    type="number"
                    min={15}
                    max={5000}
                    value={params.size || ''}
                    placeholder="Ej: 180"
                    onChange={(val) => handleChange('size', val)}
                    disabled={disabled}
                    className="pl-4 pr-12"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">m²</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="field-planta-levels" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Niveles / Pisos
                </label>
                <DebouncedInput
                  id="field-planta-levels"
                  type="number"
                  min={1}
                  max={10}
                  value={params.levels || ''}
                  placeholder="Ej: 1"
                  onChange={(val) => handleChange('levels', parseInt(val) || 0)}
                  disabled={disabled}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="field-lot-width" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Frente del Lote (m)
                </label>
                <div className="relative">
                  <DebouncedInput
                    id="field-lot-width"
                    type="number"
                    min={3}
                    max={500}
                    value={params.lotWidthM || ''}
                    placeholder="Ej: 12"
                    onChange={(val) => handleChange('lotWidthM', parseInt(val) || 0)}
                    disabled={disabled}
                    className="pl-4 pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">m</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="field-lot-depth" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Fondo del Lote (m)
                </label>
                <div className="relative">
                  <DebouncedInput
                    id="field-lot-depth"
                    type="number"
                    min={3}
                    max={500}
                    value={params.lotDepthM || ''}
                    placeholder="Ej: 25"
                    onChange={(val) => handleChange('lotDepthM', parseInt(val) || 0)}
                    disabled={disabled}
                    className="pl-4 pr-10"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono">m</span>
                </div>
              </div>
            </div>
          </div>

          <div>
            <Subtitle>Habitaciones, Baños y Núcleo Social</Subtitle>
            <div className="space-y-5">
              <HomeProgramFields params={params} onChange={handleChange} disabled={disabled} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Select
                  label="Distribución de Cocina"
                  value={params.kitchenType}
                  onChange={(e) => handleChange('kitchenType', e.target.value)}
                  options={IC.KITCHEN_TYPES}
                  disabled={disabled}
                />
                <Select
                  label="Configuración de Sala / Zona Social"
                  value={params.livingAreaType}
                  onChange={(e) => handleChange('livingAreaType', e.target.value)}
                  options={IC.LIVING_AREA_TYPES}
                  disabled={disabled}
                />
              </div>
            </div>
          </div>

          <div>
            <Subtitle>Ambientes Complementarios y Servicios</Subtitle>
            {renderChipsGroup(
              'Espacios Adicionales de la Planta',
              'planSpaces',
              PC.PLAN_SPACES,
              'Selecciona los cuartos y áreas que deben incluirse en la división espacial.',
            )}
          </div>

          <div>
            <Subtitle>Estacionamiento y Áreas Exteriores en Planta</Subtitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <Select
                  label="Tipo de Estacionamiento"
                  value={params.parkingType}
                  onChange={(e) => handleChange('parkingType', e.target.value)}
                  options={EC.PARKING_TYPES}
                  disabled={disabled}
                />
                <div className="flex flex-col gap-2">
                  <label htmlFor="field-planta-parking-spots" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Plazas de Estacionamiento
                  </label>
                  <DebouncedInput
                    id="field-planta-parking-spots"
                    type="number"
                    min={0}
                    max={20}
                    value={params.parkingSpots || ''}
                    placeholder="Auto"
                    onChange={(val) => handleChange('parkingSpots', parseInt(val) || 0)}
                    disabled={disabled}
                  />
                </div>
              </div>
              {renderChipsGroup(
                'Áreas Sociales Exteriores',
                'socialAreas',
                EC.SOCIAL_AREAS,
                'Terrazas, piscina o zonas exteriores articuladas con la planta.',
                true,
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── FASE 2: DIVISIÓN ESPACIAL, ZONIFICACIÓN Y SITIO ──────────── */}
      <Section
        title="Fase 2: División Espacial y Zonificación"
        number="03"
        icon={<Compass className="w-5 h-5" />}
        isOpen={activeSection === 'zoning'}
        onToggle={() => onSectionChange('zoning')}
        summary={zoningSummary}
      >
        <SectionDescription>
          Define cómo se organizan las zonas social, privada y de servicios dentro de la huella, la orientación solar y el sistema estructural que modula los muros.
        </SectionDescription>

        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Select
              label="Esquema Espacial (Huella)"
              value={params.layoutType}
              onChange={(e) => handleChange('layoutType', e.target.value)}
              options={EC.LAYOUT_TYPES}
              disabled={disabled}
            />
            <Select
              label="Criterio de Zonificación y Circulación"
              value={params.zoningLayout}
              onChange={(e) => handleChange('zoningLayout', e.target.value)}
              options={PC.ZONING_LAYOUTS}
              disabled={disabled}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <Select
              label="Orientación Solar"
              value={params.solarOrientation}
              onChange={(e) => handleChange('solarOrientation', e.target.value)}
              options={EC.SOLAR_ORIENTATIONS}
              disabled={disabled}
            />
            <Select
              label="Topografía del Terreno"
              value={params.siteTopography}
              onChange={(e) => handleChange('siteTopography', e.target.value)}
              options={EC.SITE_TOPOGRAPHIES}
              disabled={disabled}
            />
            <Select
              label="Sistema Constructivo / Modulación"
              value={params.constructionSystem}
              onChange={(e) => handleChange('constructionSystem', e.target.value)}
              options={EC.CONSTRUCTION_SYSTEMS}
              disabled={disabled}
            />
          </div>

          {renderChipsGroup(
            'Estrategias Pasivas y Bioclimáticas en Planta',
            'passiveStrategies',
            EC.PASSIVE_STRATEGIES,
            'Ventilación cruzada, patios de luz, captación solar o aleros expresados en la planta.',
            true,
          )}
        </div>
      </Section>

      {/* ── FASE 3: REPRESENTACIÓN GRÁFICA Y ESTILO DEL PLANO ─────────── */}
      <Section
        title="Fase 3: Tipo de Plano y Lenguaje Arquitectónico"
        number="04"
        icon={<Layers className="w-5 h-5" />}
        isOpen={activeSection === 'style'}
        onToggle={() => onSectionChange('style')}
        summary={styleSummary}
      >
        <SectionDescription>
          Elige el estilo de representación del plano (técnico CAD, planta humanizada a color, corte 3D sin techo o diagrama de zonificación), las cotas/anotaciones y la identidad arquitectónica.
        </SectionDescription>

        <div className="space-y-8">
          <div>
            <Subtitle>Tipo de Representación de la Planta</Subtitle>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {PC.FLOOR_PLAN_STYLES.map((styleOpt) => {
                const selected = params.floorPlanStyle === styleOpt;
                return (
                  <button
                    key={styleOpt}
                    type="button"
                    disabled={disabled}
                    onClick={() => handleChange('floorPlanStyle', selected ? '' : styleOpt)}
                    aria-pressed={selected}
                    className={clsx(
                      'text-left p-4 min-h-[44px] border transition-all flex items-center justify-between gap-3',
                      selected
                        ? 'bg-primary text-primary-foreground border-primary font-bold'
                        : 'bg-card/60 text-foreground border-border hover:border-primary/60',
                    )}
                  >
                    <span className="text-xs uppercase tracking-wider leading-snug">{styleOpt}</span>
                  </button>
                );
              })}
            </div>

            {renderChipsGroup(
              'Anotaciones y Elementos Gráficos del Plano',
              'floorPlanAnnotations',
              PC.FLOOR_PLAN_ANNOTATIONS,
              'Qué información técnica y gráfica debe dibujarse sobre la planta.',
            )}
          </div>

          <div>
            <Subtitle>Esencia y Lenguaje Arquitectónico</Subtitle>
            <EssenceFields
              params={params}
              onChange={handleChange}
              disabled={disabled}
              projectTypeLabel="Tipología del Proyecto"
              projectTypeHelp="Define la escala y vocación del edificio (casa unifamiliar, cabaña, apartamento, finca…)."
            />
          </div>

          <div>
            <Subtitle>Texturas de Piso y Paleta de la Lámina</Subtitle>
            <div className="space-y-6">
              {renderChipsGroup(
                'Materiales Expresados en Planta',
                'materials',
                EC.MATERIALS,
                'Materiales para muros, pisos y terrazas en plantas humanizadas o 3D.',
                true,
              )}
              {renderChipsGroup(
                'Paleta Cromática',
                'colorPalette',
                SC.COLORS,
                'Tonos dominantes de la representación gráfica.',
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ── FASE 4: BOCETO O TERRENO DE REFERENCIA (OPCIONAL) ────────── */}
      <Section
        title="Fase 4: Croquis o Lote de Referencia (Opcional)"
        number="05"
        icon={<ImageIcon className="w-5 h-5" />}
        isOpen={activeSection === 'media'}
        onToggle={() => onSectionChange('media')}
        summary={mediaSummary}
      >
        <SectionDescription>
          Opcional: si ya tienes un dibujo a mano en servilleta/papel o una foto del terreno, súbelo para que la planta adapte su distribución a esa geometría.
        </SectionDescription>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FloorPlanUploader
            file={floorPlanFile}
            onFileChange={onFloorPlanFileChange}
            title="Boceto o Croquis a Mano"
            description="Sube un boceto rápido o esquema previo. La IA lo convertirá en una planta arquitectónica bien proporcionada."
          />
          <LotUploader
            file={lotFile}
            onFileChange={onLotFileChange}
            title="Foto o Polígono del Terreno"
            description="Sube una imagen del lote para emplazar la distribución según el terreno."
          />
        </div>
      </Section>

      {/* ── FASE 5: FORMATO Y DIRECCIÓN CREATIVA ─────────────────────── */}
      <Section
        title="Fase 5: Formato y Dirección Creativa"
        number="06"
        icon={<Sparkles className="w-5 h-5" />}
        isOpen={activeSection === 'render'}
        onToggle={() => onSectionChange('render')}
        summary={`${params.renderAspectRatio} · ${params.renderOutputResolution}`}
      >
        <SectionDescription>
          Elige la proporción de la lámina y añade indicaciones específicas sobre relaciones espaciales (ej. «la habitación principal debe mirar al jardín posterior y tener baño y vestier integrados»).
        </SectionDescription>
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <OutputOptions params={params} onChange={handleChange} disabled={disabled} />
          </div>
          <CreativeFields params={params} onChange={handleChange} disabled={disabled} />
        </div>
      </Section>
    </div>
  );
}
