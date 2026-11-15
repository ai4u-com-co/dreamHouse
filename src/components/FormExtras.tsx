import React from 'react';
import type { DreamHouseParams } from '@/types';
import { Select } from '@/components/ui/Select';
import { DebouncedInput } from '@/components/ui/DebouncedInput';
import * as SC from '@/modules/shared/constants';

type ChangeHandler = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => void;

interface ExtrasProps {
  params: DreamHouseParams;
  onChange: ChangeHandler;
  disabled?: boolean;
}

/**
 * Opciones de salida compartidas por los cuatro módulos: si los parámetros se guardan dentro de la imagen.
 * (Modelo, calidad, tamaño, formato, fondo y variantes viven en «Opciones avanzadas del modelo»: ModelOptionsPanel.)
 * Va dentro de una cuadrícula de 2 columnas.
 */
export function OutputOptions({ params, onChange, disabled }: ExtrasProps) {
  return (
    <>
      <fieldset className="sm:col-span-2 flex flex-col gap-1 border-0 p-0 m-0">
        <legend className="sr-only">Metadatos de la imagen</legend>
        <label className="flex items-start gap-3 min-h-[44px] py-2 cursor-pointer text-sm">
          <input
            type="checkbox"
            className="mt-0.5 h-5 w-5 accent-primary"
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
              className="mt-0.5 h-5 w-5 accent-primary"
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
export function AmbienceSelects({ params, onChange, disabled, hint, people = false, lightingOptions = SC.LIGHTING_TYPES }: ExtrasProps & { hint?: string; people?: boolean; lightingOptions?: string[] }) {
  return (
    <div className="space-y-3">
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Select label="Hora del día" value={params.timeOfDay} onChange={(e) => onChange('timeOfDay', e.target.value)} options={SC.TIMES_OF_DAY} disabled={disabled} />
        <Select label="Estación" value={params.season} onChange={(e) => onChange('season', e.target.value)} options={SC.SEASONS} disabled={disabled} />
        <Select label="Tipo de luz" value={params.lighting} onChange={(e) => onChange('lighting', e.target.value)} options={lightingOptions} disabled={disabled} />
      </div>
      {people && (
        <Select label="Personas en la escena" value={params.humanContext} onChange={(e) => onChange('humanContext', e.target.value)} options={SC.HUMAN_CONTEXT} disabled={disabled} />
      )}
    </div>
  );
}

const MAGAZINE_HINT: Record<SC.MagazineScene, string> = {
  exterior: 'Cámara de fotógrafo de arquitectura (24 mm tilt-shift, f/8, verticales paralelas), hora azul con luz interior encendida y puesta en escena editorial. Puedes cambiar cualquier ajuste después.',
  interior: 'Cámara de fotógrafo de arquitectura (24 mm tilt-shift, f/8, verticales paralelas), luz de ventana equilibrada y estilismo editorial. Puedes cambiar cualquier ajuste después.',
  vistas: 'Cámara de fotógrafo de arquitectura (24 mm tilt-shift, f/8, verticales paralelas) y puesta en escena editorial en todas las vistas. No cambia la luz de la casa original.',
};

/**
 * Preset «Fotografía de revista»: un interruptor que ajusta la cámara (y la luz en exteriores) y agrega al prompt las instrucciones de un
 * fotógrafo de arquitectura. Solo aplica con estilo fotográfico. Apagado, devuelve a fábrica solo lo que siguen siendo los valores del preset.
 */
export function MagazinePresetToggle({ params, onPatch, disabled, scene }: { params: DreamHouseParams; onPatch: (patch: Partial<DreamHouseParams>) => void; disabled?: boolean; scene: SC.MagazineScene }) {
  return (
    <label className="flex items-start gap-3 min-h-[44px] p-4 cursor-pointer text-sm border border-primary/40 bg-primary/5">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 accent-primary"
        checked={params.magazinePhoto}
        onChange={(e) => onPatch(e.target.checked ? SC.applyMagazinePreset(scene) : SC.revertMagazinePreset(scene, params))}
        disabled={disabled}
        data-testid="magazine-preset"
      />
      <span>
        <span className="font-semibold">Fotografía de revista</span>
        <span className="block text-xs text-muted-foreground">{MAGAZINE_HINT[scene]}</span>
      </span>
    </label>
  );
}

/**
 * Preset «Fotografía de interiorismo» (solo Interior): cámara de arquitecto + esquina con capas de profundidad + luz de ventana suave, y en el
 * prompt el estilismo de un fotógrafo de decoración. Excluyente con «Fotografía de revista». Apagado devuelve a fábrica solo lo del preset.
 */
export function InteriorPhotoPresetToggle({ params, onPatch, disabled }: { params: DreamHouseParams; onPatch: (patch: Partial<DreamHouseParams>) => void; disabled?: boolean }) {
  return (
    <label className="flex items-start gap-3 min-h-[44px] p-4 cursor-pointer text-sm border border-primary/40 bg-primary/5">
      <input
        type="checkbox"
        className="mt-0.5 h-5 w-5 accent-primary"
        checked={params.interiorPhoto}
        onChange={(e) => onPatch(e.target.checked ? SC.applyInteriorPhotoPreset() : SC.revertInteriorPhotoPreset(params))}
        disabled={disabled}
        data-testid="interior-photo-preset"
      />
      <span>
        <span className="font-semibold">Fotografía de interiorismo</span>
        <span className="block text-xs text-muted-foreground">
          Estilo de revista de decoración: esquina con capas de profundidad, luz de ventana suave con lámparas cálidas, estilismo curado (textiles, libros, flores, cerámica) y materiales con textura real. No se combina con «Fotografía de revista».
        </span>
      </span>
    </label>
  );
}

/**
 * Dirección de cámara: preset, lente, diafragma, ángulo, composición, look de película y profundidad de campo.
 * Mismo bloque en exterior e interior; solo cambian las listas de ángulo y composición (un interior no se
 * fotografía desde un dron). El look de película depende de la cámara: las Fujifilm tienen sus simulaciones.
 */
export function CameraFields({ params, onChange, disabled, scene }: ExtrasProps & { scene: 'exterior' | 'interior' }) {
  const angles = scene === 'interior' ? SC.INTERIOR_ANGLES : SC.ANGLES;
  const compositions = scene === 'interior' ? SC.INTERIOR_COMPOSITIONS : SC.COMPOSITIONS;
  const filmLooks = SC.filmLooksFor(params.cameraPreset);
  return (
    <div className="space-y-5">
      <Select label="Preset de Cámara" value={params.cameraPreset} onChange={(e) => onChange('cameraPreset', e.target.value)} options={SC.CAMERA_PRESET_NAMES} disabled={disabled} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Select label="Distancia Focal" value={params.focalLength} onChange={(e) => onChange('focalLength', e.target.value)} options={SC.FOCAL_LENGTHS} disabled={disabled} />
        <Select label="Apertura" value={params.aperture} onChange={(e) => onChange('aperture', e.target.value)} options={SC.APERTURES} disabled={disabled} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Select label="Ángulo" value={params.cameraAngle} onChange={(e) => onChange('cameraAngle', e.target.value)} options={angles} disabled={disabled} />
        <Select label="Composición" value={params.composition} onChange={(e) => onChange('composition', e.target.value)} options={compositions} disabled={disabled} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Select label="Look de película" value={filmLooks.includes(params.filmSimulation) ? params.filmSimulation : ''} onChange={(e) => onChange('filmSimulation', e.target.value)} options={filmLooks} disabled={disabled} />
        <Select label="Profundidad de campo" value={params.depthOfField} onChange={(e) => onChange('depthOfField', e.target.value)} options={SC.DEPTH_OF_FIELD_OPTIONS} disabled={disabled} />
      </div>
    </div>
  );
}

/** Dirección creativa libre y lo que NO debe aparecer: compartido por todos los módulos de generación */
export function CreativeFields({ params, onChange, disabled, artDirection = true }: ExtrasProps & { artDirection?: boolean }) {
  return (
    <div className={artDirection ? 'grid grid-cols-1 md:grid-cols-2 gap-5 items-stretch' : 'space-y-6'}>
      {artDirection && (
        <div className="flex flex-col gap-2 p-4 border border-primary/40 bg-primary/5 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label htmlFor="field-art-direction" className="text-xs font-bold text-foreground uppercase tracking-widest">
              Dirección creativa (Instrucción Principal)
            </label>
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-primary text-primary-foreground">
              Máxima prioridad
            </span>
          </div>
          <p className="text-xs text-muted-foreground font-mono tracking-tight">
            Opcional pero con máxima fuerza: todo lo que escribas aquí manda por encima de cualquier selector o regla por defecto.
          </p>
          <DebouncedInput
            id="field-art-direction"
            type="textarea"
            value={params.artDirection || ''}
            onChange={(val) => onChange('artDirection', val)}
            placeholder="Describe con libertad cómo quieres la distribución, relaciones entre espacios, estilo o detalles específicos..."
            disabled={disabled}
            className="min-h-[104px]"
          />
        </div>
      )}
      <div className="flex flex-col gap-2 min-w-0 md:p-4 md:border md:border-border">
        <label htmlFor="field-negative-prompt" className="text-xs font-bold text-foreground uppercase tracking-widest">Prompt negativo (lo que NO debe aparecer)</label>
        <DebouncedInput
          id="field-negative-prompt"
          type="textarea"
          value={params.negativePrompt || ''}
          onChange={(val) => onChange('negativePrompt', val)}
          placeholder="Ej: personas, autos, carteles, muebles de plástico..."
          disabled={disabled}
          className="min-h-[104px] md:flex-1"
        />
      </div>
    </div>
  );
}
