// Opciones de salida de GPT Image 2.5 y su costo en créditos. PURO: lo usan el navegador (para mostrar el costo ANTES de
// generar) y el servidor (que es quien cobra y valida de verdad). Toda la aritmética sale del núcleo compartido.
import type { DreamHouseParams } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { QUALITY_BY_LABEL, imageModelKey } from '@/lib/openai-image-settings';
import { creditsFor, estimateOutputTokens, MAX_PIXELS, MIN_PIXELS, resolveImageOptions, type Resolved, type ResolvedImageOptions } from '@/lib/openai-image-core.ts';

/** Máximo de imágenes de entrada de GPT Image 2.5 (el mismo tope que usa el servidor). */
export const OPENAI_MAX_INPUT_IMAGES = 17;

type Loose = Partial<DreamHouseParams> & Record<string, unknown>;

/**
 * Convierte los parámetros del formulario en la entrada del núcleo. NO corrige valores inválidos: si algo no es válido,
 * lo pasa tal cual para que `resolveImageOptions` lo rechace (así el servidor responde 400 sin cobrar).
 * Solo se traducen los valores antiguos de la resolución ("", "512", "4K") y, en edición, se fija lo que no aplica.
 */
export function imageOptionsInput(p: Loose): Record<string, unknown> {
  const edit = p.mode === 'edit';
  const label: unknown = p.renderQuality;
  const res: unknown = p.renderOutputResolution;
  const resolution = res === undefined || res === '' || res === '512' ? '1K' : res === '4K' ? '2K' : res;
  const custom = resolution === 'Personalizado';
  return {
    model: imageModelKey(p.aiModel),
    // Una etiqueta que no existe NO cae en la más barata: se rechaza ('__invalida__' no es una calidad del núcleo)
    quality: label === undefined || label === '' ? undefined : (lookup(QUALITY_BY_LABEL, label) ?? '__invalida__'),
    aspectRatio: p.renderAspectRatio,
    imageSize: custom ? 'custom' : resolution,
    size: custom ? p.renderCustomSize : undefined,
    // En edición con máscara el resultado se compone sobre el original en JPEG, una sola imagen y sin transparencia
    format: edit ? 'jpeg' : p.renderFormat,
    background: edit ? 'auto' : p.renderBackground,
    n: edit ? 1 : p.renderVariants,
    moderation: p.renderModeration,
  };
}

/** Píxeles con los que se calcula el costo de una edición: los de la imagen base, dentro del rango del núcleo. */
export const clampEditPixels = (px: number): number => Math.min(MAX_PIXELS, Math.max(MIN_PIXELS, Math.round(px)));

export interface Quote {
  /** El modo edición pide size 'auto' a OpenAI: lo decide la imagen base. */
  apiSize: string;
  options: ResolvedImageOptions;
}

/**
 * Valida y cotiza. `inputImagePixels` = píxeles REALES de cada imagen de entrada (la primera es la base en edición).
 * En edición el tamaño lo decide la imagen de entrada: se manda size 'auto' y se cobra la salida por los píxeles de la base
 * (acotados al rango del núcleo); sin base conocida se asume 1 MP. `isAdmin` = rol verificado (solo así vale moderation 'low').
 */
export function quoteRender(
  params: Loose,
  ctx: { inputImagePixels: number[]; isAdmin?: boolean; promptChars?: number; estimate?: boolean },
): { ok: true; value: Quote } | Extract<Resolved, { ok: false }> {
  const input = imageOptionsInput(params);
  const edit = params.mode === 'edit';
  // En edición el tamaño del formulario no aplica: se valida con uno neutro y luego se sustituye por el de la base
  const r: Resolved = resolveImageOptions(
    edit ? { ...input, imageSize: '1K', aspectRatio: '1:1', size: undefined } : input,
    { inputImagePixels: ctx.inputImagePixels, isAdmin: ctx.isAdmin, promptChars: ctx.promptChars, estimate: ctx.estimate },
  );
  if (!r.ok) return r;
  const v = r.value;
  if (!edit) return { ok: true, value: { apiSize: v.size, options: v } };
  const pixels = clampEditPixels(ctx.inputImagePixels[0] ?? 1_048_576);
  // Se desconoce la forma de la base (solo sus píxeles): se cotiza como cuadrada, que es la curva más cara (conservador)
  const side = Math.round(Math.sqrt(pixels));
  const options: ResolvedImageOptions = {
    ...v,
    pixels,
    credits: creditsFor({ quality: v.quality, width: side, height: side, n: 1, inputPixels: ctx.inputImagePixels, promptChars: ctx.promptChars }),
    estimatedOutputTokens: estimateOutputTokens(v.quality, side, side),
  };
  return { ok: true, value: { apiSize: 'auto', options } };
}

/**
 * Qué archivos de entrada usa el servidor en cada módulo (espejo de /api/generate; cada uno cuesta según sus píxeles).
 * Genérico: el navegador lo usa con sus `File` para medirlos y mostrar el costo antes de generar.
 */
export function pickOpenAIInputs<T>(
  mode: DreamHouseParams['mode'],
  c: { lot?: T | null; exteriorRef?: T | null; floorPlan?: T | null; references: T[]; objects: T[]; editImage?: T | null },
): T[] {
  if (mode === 'edit') return c.editImage ? [c.editImage] : [];
  if (mode === 'vistas') return c.lot ? [c.lot] : [];
  const objects = mode === 'interior' ? c.objects.slice(0, 13) : [];
  const base = [mode === 'exterior' ? c.exteriorRef : null, c.floorPlan, c.lot].filter((x): x is T => !!x);
  const room = Math.max(0, OPENAI_MAX_INPUT_IMAGES - base.length - objects.length);
  return [...base, ...c.references.slice(0, room), ...objects];
}
