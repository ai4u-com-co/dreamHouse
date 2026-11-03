import React from 'react';
import type { DreamHouseParams, RenderQuality } from '@/types';
import { Select } from '@/components/ui/Select';
import * as SC from '@/modules/shared/constants';

type ChangeHandler = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => void;

interface ExtrasProps {
  params: DreamHouseParams;
  onChange: ChangeHandler;
  disabled?: boolean;
}

/**
 * Opciones de salida compartidas por los cuatro módulos: calidad del render (solo OpenAI) y
 * si los parámetros se guardan dentro de la imagen. Va dentro de una cuadrícula de 2 columnas.
 */
export function OutputOptions({ params, onChange, disabled }: ExtrasProps) {
  const isOpenAI = params.aiModel.includes('OpenAI');
  return (
    <>
      {isOpenAI && (
        <div className="flex flex-col gap-2">
          <Select
            label="Calidad del render"
            value={params.renderQuality}
            onChange={(e) => onChange('renderQuality', e.target.value as RenderQuality)}
            options={[...SC.RENDER_QUALITIES]}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">{SC.RENDER_QUALITY_HINTS[params.renderQuality]}</p>
        </div>
      )}
      <fieldset className="sm:col-span-2 flex flex-col gap-1 border-0 p-0 m-0">
        <legend className="sr-only">Metadatos de la imagen</legend>
        <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 accent-primary"
            checked={params.embedMetadata}
            onChange={(e) => onChange('embedMetadata', e.target.checked)}
            disabled={disabled}
          />
          <span>
            <span className="font-semibold">Guardar los parámetros dentro de la imagen</span>
            <span className="block text-xs text-muted-foreground">
              Al volver a subir este render, la app recupera cómo se hizo (estilo, materiales, luz…) para mantener el mismo diseño en las vistas.
              Cualquiera que reciba el archivo puede leerlos.
            </span>
          </span>
        </label>
        {params.embedMetadata && (
          <label className="flex items-start gap-3 min-h-[44px] py-2 pl-7 cursor-pointer text-sm">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-primary"
              checked={params.embedDetails}
              onChange={(e) => onChange('embedDetails', e.target.checked)}
              disabled={disabled}
            />
            <span>
              <span className="font-semibold">Incluir también ciudad, notas y el prompt completo</span>
              <span className="block text-xs text-muted-foreground">
                Más detalle para reproducir el render, pero menos privado: no lo actives si vas a compartir la imagen.
              </span>
            </span>
          </label>
        )}
      </fieldset>
    </>
  );
}

/**
 * Hora del día, estación y tipo de luz (y, si se pide, presencia de personas). En exterior definen la luz
 * de la escena; en interior, la luz natural que entra por las ventanas. Mismo estado en ambos módulos.
 */
export function AmbienceSelects({ params, onChange, disabled, hint, people = false }: ExtrasProps & { hint?: string; people?: boolean }) {
  return (
    <div className="space-y-3">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Select label="Hora del día" value={params.timeOfDay} onChange={(e) => onChange('timeOfDay', e.target.value)} options={SC.TIMES_OF_DAY} disabled={disabled} />
        <Select label="Estación" value={params.season} onChange={(e) => onChange('season', e.target.value)} options={SC.SEASONS} disabled={disabled} />
        <Select label="Tipo de luz" value={params.lighting} onChange={(e) => onChange('lighting', e.target.value)} options={SC.LIGHTING_TYPES} disabled={disabled} />
      </div>
      {people && (
        <Select label="Personas en la escena" value={params.humanContext} onChange={(e) => onChange('humanContext', e.target.value)} options={SC.HUMAN_CONTEXT} disabled={disabled} />
      )}
    </div>
  );
}
