'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown, Clock, Coins, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { twMerge } from 'tailwind-merge';
import type { DreamHouseParams } from '@/types';
import { DEFAULT_PARAMS } from '@/types';
import * as SC from '@/modules/shared/constants';
import { validateCustomSize } from '@/lib/openai-image-core.ts';
import type { Quote } from '@/lib/render-options';

// «Opciones avanzadas del modelo»: todo lo que admite GPT Image 2.5, plegado y en lo más económico por defecto.
// El costo en créditos se ve SIEMPRE (también con el panel cerrado) y se calcula con el mismo núcleo que usa el servidor.

type OnChange = <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => void;

export type QuoteState = { ok: true; value: Quote } | { ok: false; message: string };

const MODEL_SUNBURST = SC.AI_MODELS[0];
const MODEL_FLARE = SC.AI_MODELS[1];

const MODEL_HINT: Record<string, string> = {
  [MODEL_SUNBURST]: 'Sunburst es el más preciso al editar y para la entrega final.',
  [MODEL_FLARE]: 'Flare es más rápido (≈30 % menos de tiempo) con el mismo costo: ideal para explorar ideas.',
};

const FORMAT_HINT: Record<string, string> = {
  jpeg: 'JPEG: liviano, el mejor para fotos de render.',
  webp: 'WebP: liviano y admite fondo transparente.',
  png: 'PNG: sin pérdida, pesa mucho; mejor en tamaños pequeños.',
};

/** Tiempos medidos: «Alta» ~20 s, «Muy alta» ~30 s y «Máxima» ~60 s o más. */
export const durationNote = (quality: string): string | null =>
  quality === 'Máxima'
    ? 'Con «Máxima» cada imagen puede tardar más de 1 minuto; con varias variantes, bastante más. No cierres la pestaña.'
    : quality === 'Muy alta'
      ? 'Con «Muy alta» cada imagen tarda unos 30 segundos o más. No cierres la pestaña.'
      : null;

const fieldClass =
  'w-full bg-card border border-border py-3 px-3 rounded-none text-foreground text-sm font-medium focus:outline-none focus:border-primary hover:border-foreground disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]';

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label htmlFor={htmlFor} className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground leading-snug">{hint}</p>}
    </div>
  );
}

/** Costo en créditos y duración: siempre visible (el panel puede estar cerrado). */
export function CostSummary({ quote, isAdmin, credits, multiplier = 1, params, className }: {
  quote: QuoteState;
  isAdmin: boolean;
  credits: number;
  /** Vistas seleccionadas: se genera una imagen por vista */
  multiplier?: number;
  params: DreamHouseParams;
  className?: string;
}) {
  if (!quote.ok) {
    return (
      <p role="alert" className={twMerge('text-sm font-bold text-destructive', className)} data-testid="cost-error">{quote.message}</p>
    );
  }
  const o = quote.value.options;
  const total = o.credits * multiplier;
  const slow = durationNote(params.renderQuality);
  const short = !isAdmin && total > credits;
  return (
    <div className={twMerge('flex flex-col gap-1', className)} data-testid="cost-summary">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Coins className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
        <span className="font-bold uppercase tracking-wide" data-testid="cost-credits">
          Costo: {total} {total === 1 ? 'crédito' : 'créditos'}
        </span>
        <span className="text-xs text-muted-foreground">
          {o.n > 1 ? `${o.n} variantes · ` : ''}{multiplier > 1 ? `${multiplier} vistas · ` : ''}
          {quote.value.apiSize === 'auto' ? 'tamaño de tu imagen' : quote.value.apiSize.replace('x', '×')}
          {isAdmin ? ' · Admin: sin límite' : ''}
        </span>
      </p>
      {short && (
        <p role="status" className="text-xs font-bold text-destructive">
          Te faltan {total - credits} {total - credits === 1 ? 'crédito' : 'créditos'} (tienes {credits}). Baja la calidad, el tamaño o las variantes.
        </p>
      )}
      {slow && (
        <p role="status" className="flex items-start gap-2 text-xs text-muted-foreground" data-testid="duration-note">
          <Clock className="w-4 h-4 shrink-0 mt-px" aria-hidden="true" />
          <span>{slow}</span>
        </p>
      )}
    </div>
  );
}

export default function ModelOptionsPanel({ params, onChange, disabled, isAdmin, quote, credits, multiplier = 1, defaultOpen = false }: {
  params: DreamHouseParams;
  onChange: OnChange;
  disabled?: boolean;
  isAdmin: boolean;
  quote: QuoteState;
  credits: number;
  multiplier?: number;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isEdit = params.mode === 'edit';
  const custom = params.renderOutputResolution === 'Personalizado';

  // Tamaño personalizado: dos campos con su propio texto (se confirma al tener ambos números)
  const [w0, h0] = params.renderCustomSize.split('x');
  const [wText, setWText] = useState(w0);
  const [hText, setHText] = useState(h0);
  useEffect(() => {
    const [w, h] = params.renderCustomSize.split('x');
    setWText(w);
    setHText(h);
  }, [params.renderCustomSize]);
  const sizeError = custom ? validateCustomSize(Number(wText), Number(hText)) : null;
  const commitSize = (w: string, h: string) => {
    if (/^\d{3,4}$/.test(w) && /^\d{3,4}$/.test(h) && validateCustomSize(Number(w), Number(h)) === null) onChange('renderCustomSize', `${w}x${h}`);
  };

  const isDefault =
    params.aiModel === DEFAULT_PARAMS.aiModel && params.renderQuality === DEFAULT_PARAMS.renderQuality &&
    params.renderOutputResolution === DEFAULT_PARAMS.renderOutputResolution && params.renderFormat === DEFAULT_PARAMS.renderFormat &&
    params.renderBackground === DEFAULT_PARAMS.renderBackground && params.renderVariants === DEFAULT_PARAMS.renderVariants &&
    params.renderModeration === DEFAULT_PARAMS.renderModeration && params.renderAspectRatio === DEFAULT_PARAMS.renderAspectRatio;

  const resetCheap = () => {
    onChange('aiModel', DEFAULT_PARAMS.aiModel);
    onChange('renderQuality', DEFAULT_PARAMS.renderQuality);
    onChange('renderAspectRatio', DEFAULT_PARAMS.renderAspectRatio);
    onChange('renderOutputResolution', DEFAULT_PARAMS.renderOutputResolution);
    onChange('renderCustomSize', DEFAULT_PARAMS.renderCustomSize);
    onChange('renderFormat', DEFAULT_PARAMS.renderFormat);
    onChange('renderBackground', DEFAULT_PARAMS.renderBackground);
    onChange('renderVariants', DEFAULT_PARAMS.renderVariants);
    onChange('renderModeration', DEFAULT_PARAMS.renderModeration);
  };

  const modelShort = params.aiModel === MODEL_FLARE ? 'Flare' : 'Sunburst';
  const summary = [modelShort, params.renderQuality, isEdit ? 'tamaño de tu imagen' : custom ? params.renderCustomSize : `${params.renderAspectRatio} · ${params.renderOutputResolution}`, isEdit ? null : params.renderFormat.toUpperCase(), !isEdit && params.renderVariants > 1 ? `${params.renderVariants} variantes` : null].filter(Boolean).join(' · ');

  return (
    <section className="border border-border bg-card" aria-label="Opciones del modelo y costo">
      <div className="p-4 sm:p-6 border-b border-border">
        <CostSummary quote={quote} isAdmin={isAdmin} credits={credits} multiplier={multiplier} params={params} />
      </div>
      <button
        type="button"
        id="adv-toggle"
        aria-expanded={open}
        aria-controls="adv-panel"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] flex items-center justify-between gap-3 p-4 sm:px-6 text-left hover:bg-muted transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <SlidersHorizontal className="w-5 h-5 text-primary shrink-0" aria-hidden="true" />
          <span className="min-w-0">
            <span className="block text-xs font-mono font-bold uppercase tracking-widest">Opciones avanzadas del modelo</span>
            <span className="block text-xs text-muted-foreground truncate" data-testid="adv-summary">{summary}</span>
          </span>
        </span>
        <ChevronDown className={twMerge('w-5 h-5 shrink-0 transition-transform', open ? 'rotate-180' : '')} aria-hidden="true" />
      </button>

      {open && (
        <div id="adv-panel" role="region" aria-labelledby="adv-toggle" className="p-4 sm:p-6 border-t border-border space-y-6">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Todo arranca en lo más económico (Borrador · 1K · 1 imagen · JPEG). Sube una opción solo si un borrador no alcanza: «un ajuste más alto no
            garantiza un mejor resultado en todos los casos».
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <Field label="Modelo" htmlFor="adv-model" hint={MODEL_HINT[params.aiModel]}>
              <select id="adv-model" className={fieldClass} value={params.aiModel} disabled={disabled} onChange={(e) => onChange('aiModel', e.target.value)}>
                <option value={MODEL_SUNBURST}>Sunburst · Preciso</option>
                <option value={MODEL_FLARE}>Flare · Rápido</option>
              </select>
            </Field>

            <Field label="Calidad" htmlFor="adv-quality" hint={SC.RENDER_QUALITY_HINTS[params.renderQuality]}>
              <select id="adv-quality" className={fieldClass} value={params.renderQuality} disabled={disabled} onChange={(e) => onChange('renderQuality', e.target.value as DreamHouseParams['renderQuality'])}>
                {SC.RENDER_QUALITIES.map((q) => <option key={q} value={q}>{q}</option>)}
              </select>
            </Field>

            {isEdit ? (
              <p className="sm:col-span-2 text-xs text-muted-foreground border border-dashed border-border p-3" data-testid="edit-size-note">
                En edición el tamaño lo define tu imagen base (el costo se calcula con sus píxeles reales) y se genera una sola imagen en JPEG.
              </p>
            ) : (
              <>
                <Field label="Formato (relación)" htmlFor="adv-aspect" hint="Elige según el destino: 16:9 pantalla, 4:5 redes, 9:16 historias.">
                  <select id="adv-aspect" className={fieldClass} value={params.renderAspectRatio} disabled={disabled || custom} onChange={(e) => onChange('renderAspectRatio', e.target.value)}>
                    {SC.ASPECT_RATIOS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>

                <Field label="Resolución" htmlFor="adv-resolution" hint="1K ≈ 1 megapíxel (borrador). 2K llega a 2048 px (más caro). Personalizado: múltiplos de 16, hasta 2560×1440.">
                  <select id="adv-resolution" className={fieldClass} value={params.renderOutputResolution} disabled={disabled} onChange={(e) => onChange('renderOutputResolution', e.target.value)}>
                    {SC.OUTPUT_RESOLUTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </Field>

                {custom && (
                  <div className="sm:col-span-2">
                    <div className="grid grid-cols-2 gap-5">
                      <Field label="Ancho (px)" htmlFor="adv-width">
                        <input
                          id="adv-width" inputMode="numeric" className={fieldClass} value={wText} disabled={disabled}
                          onChange={(e) => { const t = e.target.value.replace(/\D/g, '').slice(0, 4); setWText(t); commitSize(t, hText); }}
                          aria-invalid={!!sizeError}
                        />
                      </Field>
                      <Field label="Alto (px)" htmlFor="adv-height">
                        <input
                          id="adv-height" inputMode="numeric" className={fieldClass} value={hText} disabled={disabled}
                          onChange={(e) => { const t = e.target.value.replace(/\D/g, '').slice(0, 4); setHText(t); commitSize(wText, t); }}
                          aria-invalid={!!sizeError}
                        />
                      </Field>
                    </div>
                    {sizeError && <p role="alert" className="mt-2 text-xs font-bold text-destructive" data-testid="size-error">{sizeError}</p>}
                  </div>
                )}

                <Field label="Formato de archivo" htmlFor="adv-format" hint={params.renderBackground === 'transparent' ? 'Con fondo transparente se guarda en WebP.' : FORMAT_HINT[params.renderFormat]}>
                  <select id="adv-format" className={fieldClass} value={params.renderBackground === 'transparent' && params.renderFormat === 'jpeg' ? 'webp' : params.renderFormat} disabled={disabled} onChange={(e) => onChange('renderFormat', e.target.value as DreamHouseParams['renderFormat'])}>
                    {SC.RENDER_FORMATS.map((f) => <option key={f} value={f} disabled={f === 'jpeg' && params.renderBackground === 'transparent'}>{SC.RENDER_FORMAT_LABELS[f]}</option>)}
                  </select>
                </Field>

                <Field label="Fondo" htmlFor="adv-background" hint="Transparente sirve para recortar la casa o un objeto aislado; revisa los bordes del resultado.">
                  <select
                    id="adv-background" className={fieldClass} value={params.renderBackground} disabled={disabled}
                    onChange={(e) => {
                      const v = e.target.value as DreamHouseParams['renderBackground'];
                      onChange('renderBackground', v);
                      if (v === 'transparent' && params.renderFormat === 'jpeg') onChange('renderFormat', 'webp');
                    }}
                  >
                    {SC.RENDER_BACKGROUNDS.map((b) => <option key={b} value={b}>{SC.RENDER_BACKGROUND_LABELS[b]}</option>)}
                  </select>
                </Field>

                <Field label="Variantes" htmlFor="adv-variants" hint="Cada variante cuesta lo mismo que la primera. Útil para explorar versiones del mismo diseño.">
                  <select id="adv-variants" className={fieldClass} value={params.renderVariants} disabled={disabled} onChange={(e) => onChange('renderVariants', Number(e.target.value))}>
                    {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
              </>
            )}

            {isAdmin && (
              <Field label="Moderación (solo administradores)" htmlFor="adv-moderation" hint="«Baja» es menos restrictiva. El servidor lo verifica: solo funciona con tu rol de administrador.">
                <select id="adv-moderation" className={fieldClass} value={params.renderModeration} disabled={disabled} onChange={(e) => onChange('renderModeration', e.target.value as DreamHouseParams['renderModeration'])}>
                  <option value="auto">Automática</option>
                  <option value="low">Baja</option>
                </select>
              </Field>
            )}
          </div>

          <button
            type="button"
            onClick={resetCheap}
            disabled={disabled || isDefault}
            className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 border border-foreground text-xs font-bold uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            Volver a lo más económico
          </button>
        </div>
      )}
    </section>
  );
}
