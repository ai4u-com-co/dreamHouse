import type { DreamHouseParams, GenerationMode } from '@/types';
import { readImageMetadataFromFile, METADATA_APP } from '@/lib/image-metadata';
import { sanitizeRestoredParams, cleanLabel } from '@/lib/assistant-params';

// ============================================
// Recuperar los parámetros de una generación
// ============================================
// Dos orígenes, el mismo resultado: (1) una imagen hecha por DreamHouse (los parámetros viajan dentro del
// archivo: JPEG, PNG o WebP) y (2) un archivo de parámetros `.json` descargado desde el historial.

export const PARAMS_FILE_KIND = 'dreamhouse-params';
const MAX_JSON_BYTES = 256 * 1024;

export interface ParamsFile {
  app: typeof METADATA_APP;
  kind: typeof PARAMS_FILE_KIND;
  version: 1;
  mode: GenerationMode;
  houseName?: string;
  createdAt: string;
  params: Partial<DreamHouseParams>;
}

export interface RestoreResult {
  ok: true;
  params: Partial<DreamHouseParams>;
  /** Cuántos campos se recuperaron */
  count: number;
  mode?: GenerationMode;
  houseName?: string;
  source: 'imagen' | 'archivo';
  /** Valores que ya no existen en los catálogos y se descartaron */
  dropped: string[];
  /** ¿Se recuperaron ciudad y textos libres? (en una imagen, solo si se guardó con «incluir detalles») */
  hasTexts: boolean;
}
export interface RestoreFailure { ok: false; message: string }

const MODES: readonly string[] = ['exterior', 'interior', 'edit', 'vistas'];
const TEXT_KEYS = ['city', 'artDirection', 'negativePrompt', 'editPrompt'] as const;

function toResult(raw: unknown, source: RestoreResult['source'], mode: unknown, houseName: unknown): RestoreResult | RestoreFailure {
  const { params, dropped } = sanitizeRestoredParams(raw);
  const count = Object.keys(params).length;
  if (count === 0) return { ok: false, message: 'No se encontró ningún parámetro válido en ese archivo.' };
  return {
    ok: true,
    params,
    count,
    mode: typeof mode === 'string' && MODES.includes(mode) ? (mode as GenerationMode) : undefined,
    houseName: cleanLabel(houseName),
    source,
    dropped,
    hasTexts: TEXT_KEYS.some((k) => k in params),
  };
}

/** Contenido del archivo de parámetros de una generación (para guardarlo o compartirlo) */
export function buildParamsFile(record: { mode: GenerationMode; params: DreamHouseParams; houseName?: string; timestamp?: number }): ParamsFile {
  const params: Partial<DreamHouseParams> = { ...record.params };
  delete params.sourceRender; // la genealogía no es un parámetro del formulario
  return {
    app: METADATA_APP,
    kind: PARAMS_FILE_KIND,
    version: 1,
    mode: record.mode,
    houseName: record.houseName,
    createdAt: new Date(record.timestamp ?? Date.now()).toISOString(),
    params,
  };
}

/** Lee un archivo de parámetros (texto JSON). Solo se aceptan los campos del formulario, con valores válidos. */
export function parseParamsFile(text: string): RestoreResult | RestoreFailure {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { ok: false, message: 'El archivo no es un JSON válido.' }; }
  const file = data as Partial<ParamsFile> | null;
  if (!file || file.app !== METADATA_APP || file.kind !== PARAMS_FILE_KIND || typeof file.params !== 'object') {
    return { ok: false, message: 'Ese archivo no es un archivo de parámetros de DreamHouse.' };
  }
  return toResult(file.params, 'archivo', file.mode, file.houseName);
}

/** Recupera los parámetros de un archivo que sube la persona: una imagen de DreamHouse o un `.json` de parámetros */
export async function restoreParamsFromFile(file: File): Promise<RestoreResult | RestoreFailure> {
  if (/\.json$/i.test(file.name) || file.type === 'application/json') {
    if (file.size > MAX_JSON_BYTES) return { ok: false, message: 'El archivo de parámetros es demasiado grande.' };
    return parseParamsFile(await file.text());
  }
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) {
    return { ok: false, message: 'Sube una imagen JPG, PNG o WebP generada con DreamHouse, o un archivo de parámetros (.json).' };
  }
  const meta = await readImageMetadataFromFile(file);
  if (!meta) {
    return { ok: false, message: 'Esa imagen no trae parámetros de DreamHouse. Solo las imágenes descargadas directamente de la app los conservan (no capturas de pantalla ni imágenes reenviadas por chat).' };
  }
  return toResult(meta.params, 'imagen', meta.mode, meta.houseName);
}
