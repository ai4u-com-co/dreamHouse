import React from 'react';
import { DreamHouseParams } from '@/types';
import * as VC from '../constants';
import clsx from 'clsx';
import { Check, LayoutGrid, ImageIcon } from 'lucide-react';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { OutputOptions, AmbienceSelects } from '@/components/FormExtras';
import * as SC from '../../shared/constants';

interface VistasFormProps {
  params: DreamHouseParams;
  onChange: (params: DreamHouseParams) => void;
  disabled?: boolean;
  activeSection: string | null;
  onSectionChange: (id: string) => void;
}

function SectionDescription({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative pl-4 py-2 mb-6 border-l-2 border-primary">
      <p className="text-sm text-muted-foreground leading-relaxed font-medium">{children}</p>
    </div>
  );
}

export default function VistasForm({ params, onChange, disabled, activeSection, onSectionChange }: VistasFormProps) {
  const handleChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  const selected = Array.isArray(params.selectedVistas) ? params.selectedVistas : [];

  const toggleVista = (vista: string) => {
    const next = selected.includes(vista)
      ? selected.filter(v => v !== vista)
      : [...selected, vista];
    handleChange('selectedVistas', next);
  };

  return (
    <div className="space-y-0" role="form" aria-label="Módulo de Generación de Vistas">

      {/* ── 01 SELECCIÓN DE VISTAS ────────────────────────────────── */}
      <Section title="Portafolio de Vistas" number="05" icon={<LayoutGrid className="w-5 h-5" />} isOpen={activeSection === 'vistasSelection'} onToggle={() => onSectionChange('vistasSelection')}>
        <SectionDescription>Selecciona las vistas arquitectónicas que deseas generar para tu portafolio basado en la foto subida.</SectionDescription>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
          {VC.ARCHITECTURAL_VISTAS.map(vista => {
            const isSelected = selected.includes(vista);
            return (
              <button
                key={vista}
                type="button"
                disabled={disabled}
                onClick={() => toggleVista(vista)}
                className={clsx(
                  'flex items-start gap-3 px-3 py-2.5 border text-left transition-all duration-150',
                  'disabled:opacity-40 disabled:cursor-not-allowed',
                  isSelected
                    ? 'bg-foreground text-background border-foreground'
                    : 'bg-transparent text-muted-foreground border-border hover:border-foreground hover:text-foreground'
                )}
              >
                <span className={clsx('mt-0.5 w-3.5 h-3.5 shrink-0 flex items-center justify-center border',
                  isSelected ? 'border-background' : 'border-current'
                )}>
                  {isSelected && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
                </span>
                <span className="flex flex-col min-w-0">
                  <span className="text-xs font-bold uppercase tracking-wide leading-tight">{vista}</span>
                  <span className={clsx('text-[10px] font-mono leading-snug mt-0.5 truncate',
                    isSelected ? 'opacity-70' : 'opacity-50'
                  )}>
                    {VC.VISTA_SHORT_DESC[vista]}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <p className="mt-3 text-[11px] text-muted-foreground font-mono opacity-60">
            {selected.length} vista{selected.length > 1 ? 's' : ''} seleccionada{selected.length > 1 ? 's' : ''}
          </p>
        )}
      </Section>

      {/* ── 02 PROCESO ─────────────────────────────────────────── */}
      <Section title="Configuración de Salida" number="06" icon={<ImageIcon className="w-5 h-5" />} isOpen={activeSection === 'output'} onToggle={() => onSectionChange('output')}>
        <div className="mb-8">
          <AmbienceSelects
            params={params}
            onChange={handleChange}
            disabled={disabled}
            hint={params.sourceRender
              ? 'Opcional: si lo dejas vacío, las vistas mantienen la hora, estación y luz del render original.'
              : 'Opcional: si lo dejas vacío, las vistas mantienen la luz de la foto de la casa.'}
          />
        </div>
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
    </div>
  );
}
