'use client';

import React from 'react';
import clsx from 'clsx';
import type { DreamHouseParams } from '@/types';
import { Select } from '@/components/ui/Select';
import { Chip } from '@/components/ui/Chip';
import { DebouncedInput } from '@/components/ui/DebouncedInput';
import * as SC from '@/modules/shared/constants';
import * as EC from '@/modules/exterior/constants';

// ============================================
// Bloques de formulario COMPARTIDOS entre módulos
// ============================================
// Exterior e Interior pintan estos mismos componentes sobre el mismo estado (`params`), así que un
// cambio hecho en uno se ve en el otro y no pueden divergir en opciones ni en etiquetas. Si un
// parámetro aplica a más de un módulo (ver `modules/shared/param-modes.ts`), su control vive aquí.

export type ChangeHandler = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => void;

interface FieldProps {
  params: DreamHouseParams;
  onChange: ChangeHandler;
  disabled?: boolean;
}

/** Grupo de chips de selección múltiple sobre un campo de lista de `params` */
export function ChipsField({
  params,
  onChange,
  disabled,
  label,
  field,
  options,
  helpText,
  scrollable = false,
}: FieldProps & {
  label: string;
  field: keyof DreamHouseParams;
  options: readonly string[];
  helpText: string;
  scrollable?: boolean;
}) {
  const current = Array.isArray(params[field]) ? (params[field] as string[]) : [];
  const toggle = (value: string) => {
    const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
    onChange(field, next as DreamHouseParams[typeof field]);
  };
  return (
    <fieldset className="flex flex-col gap-2">
      <div className="flex flex-col gap-1 px-1">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">{label}</label>
        <p className="text-xs text-muted-foreground opacity-60 font-mono tracking-tight">{helpText}</p>
      </div>
      <div className={clsx('flex flex-wrap gap-2 p-1', scrollable && 'max-h-56 overflow-y-auto custom-scrollbar border border-border/20 bg-card/30')}>
        {options.map((opt) => (
          <Chip key={opt} selected={current.includes(opt)} disabled={disabled} onToggle={() => toggle(opt)}>
            {opt}
          </Chip>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * La esencia del proyecto: qué es (tipo), con qué atmósfera, en qué estilo y bajo qué influencia.
 * Es la misma en exterior e interior; cada módulo añade lo suyo alrededor (p. ej. el tipo de espacio).
 */
export function EssenceFields({
  params,
  onChange,
  disabled,
  projectTypeLabel,
  projectTypeHelp,
  stylesLabel = 'Estilos Arquitectónicos',
  stylesHelp = 'Combina estéticas para una propuesta única.',
  architectLabel = 'Arquitectos Inspiradores',
  architectHelp = 'Influencia formal y conceptual del diseño.',
  children,
}: FieldProps & {
  projectTypeLabel: string;
  projectTypeHelp?: string;
  stylesLabel?: string;
  stylesHelp?: string;
  architectLabel?: string;
  architectHelp?: string;
  /** Controles propios del módulo (p. ej. el tipo de espacio en interior), junto al tipo de proyecto */
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="flex flex-col gap-2">
          <Select
            label={projectTypeLabel}
            value={params.projectType}
            onChange={(e) => onChange('projectType', e.target.value)}
            options={EC.PROJECT_TYPES}
            disabled={disabled}
          />
          {projectTypeHelp && <p className="text-xs text-muted-foreground opacity-70 font-mono tracking-tight">{projectTypeHelp}</p>}
        </div>
        <Select label="Atmósfera / Mood" value={params.mood} onChange={(e) => onChange('mood', e.target.value)} options={SC.MOODS} disabled={disabled} />
        {children}
      </div>
      <div className="grid grid-cols-1 gap-6">
        <ChipsField params={params} onChange={onChange} disabled={disabled} label={stylesLabel} field="architecturalStyles" options={SC.STYLES} helpText={stylesHelp} scrollable />
        <ChipsField params={params} onChange={onChange} disabled={disabled} label={architectLabel} field="architect" options={SC.ARCHITECTS} helpText={architectHelp} scrollable />
      </div>
    </div>
  );
}

/**
 * Sitio: ciudad, entorno, clima, agua y tiempo. En exterior definen el emplazamiento; en interior,
 * la luz y lo que se ve por las ventanas. Mismo estado en ambos.
 */
export function SiteFields({ params, onChange, disabled }: FieldProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest pl-1" htmlFor="field-city">Ciudad / Región</label>
        <DebouncedInput
          id="field-city"
          value={params.city}
          onChange={(val) => onChange('city', val)}
          placeholder="Ej: Kyoto, Oslo, Atacama..."
          disabled={disabled}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Select label="Entorno Natural" value={params.environment} onChange={(e) => onChange('environment', e.target.value)} options={EC.ENVIRONMENTS} disabled={disabled} />
        <Select label="Clima Dominante" value={params.climate} onChange={(e) => onChange('climate', e.target.value)} options={EC.CLIMATES} disabled={disabled} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Select label="Cuerpo de Agua" value={params.waterBody} onChange={(e) => onChange('waterBody', e.target.value)} options={EC.WATER_BODIES} disabled={disabled} />
        <Select label="Condición del Tiempo" value={params.weatherCondition} onChange={(e) => onChange('weatherCondition', e.target.value)} options={EC.WEATHER_CONDITIONS} disabled={disabled} />
      </div>
    </div>
  );
}

/** Dormitorios y baños: el programa de la vivienda, contexto válido para el exterior y para el interior */
export function HomeProgramFields({ params, onChange, disabled }: FieldProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="field-bedrooms">Dormitorios</label>
        <DebouncedInput id="field-bedrooms" type="number" min={1} value={params.bedrooms || ''} placeholder="—" onChange={(val) => onChange('bedrooms', parseInt(val) || 0)} disabled={disabled} />
      </div>
      <div className="flex flex-col gap-2">
        <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground" htmlFor="field-bathrooms">Baños</label>
        <DebouncedInput id="field-bathrooms" type="number" min={1} value={params.bathrooms || ''} placeholder="—" onChange={(val) => onChange('bathrooms', parseInt(val) || 0)} disabled={disabled} />
      </div>
    </div>
  );
}
