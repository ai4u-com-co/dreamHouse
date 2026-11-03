import React from 'react';
import { DreamHouseParams } from '@/types';
import { OutputOptions } from '@/components/FormExtras';
import * as SC from '../../shared/constants';
import { Section } from '@/components/ui/Section';
import { Select } from '@/components/ui/Select';
import { PenLine, ImageIcon, Trash2 } from 'lucide-react';
import SketchCanvas, { type EditMaskPayload } from '@/components/SketchCanvas';
import LotUploader from '@/components/LotUploader';
import { DebouncedInput } from '@/components/ui/DebouncedInput';

interface EditFormProps {
  params: DreamHouseParams;
  onChange: (params: DreamHouseParams) => void;
  disabled?: boolean;
  activeSection: string | null;
  onSectionChange: (id: string) => void;
  baseImage: File | null;
  onBaseImageUpdate: (file: File | null) => void;
  onCompositeImageUpdate: (file: File | null) => void;
  onMaskUpdate: (payload: EditMaskPayload | null) => void;
}

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
  onSectionChange,
  baseImage,
  onBaseImageUpdate,
  onCompositeImageUpdate,
  onMaskUpdate
}: EditFormProps) {
  const handleChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="space-y-0" role="form" aria-label="Módulo de Edición de Imagen">

      {/* ── 04 SKETCH CANVAS ─────────────────────────────────────── */}
      <Section title="Modo Sketch / Edición Visual" number="02" icon={<PenLine className="w-5 h-5" />} isOpen={activeSection === 'sketch'} onToggle={() => onSectionChange('sketch')}>
        <SectionDescription>Dibuja sobre la imagen base para indicar las zonas que deseas modificar y escribe tu instrucción de edición.</SectionDescription>
        
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

      {/* ── 05 PROCESO ─────────────────────────────────────────── */}
      <Section title="Configuración de Salida" number="03" icon={<ImageIcon className="w-5 h-5" />} isOpen={activeSection === 'output'} onToggle={() => onSectionChange('output')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          <Select label="Modelo de IA" value={params.aiModel} onChange={(e) => handleChange("aiModel", e.target.value)} options={SC.AI_MODELS} disabled={disabled} />
          <OutputOptions params={params} onChange={handleChange} disabled={disabled} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <Select label="Estilo Render" value={params.renderStyle} onChange={(e) => handleChange("renderStyle", e.target.value)} options={SC.RENDER_STYLES} disabled={disabled} />
          <Select label="Ratio de Aspecto" value={params.renderAspectRatio} onChange={(e) => handleChange("renderAspectRatio", e.target.value)} options={SC.ASPECT_RATIOS} disabled={disabled} />
          <Select label="Resolución" value={params.renderOutputResolution} onChange={(e) => handleChange("renderOutputResolution", e.target.value)} options={SC.OUTPUT_RESOLUTIONS} disabled={disabled} />
        </div>
      </Section>

    </div>
  );
}
