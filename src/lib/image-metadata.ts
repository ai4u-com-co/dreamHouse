// ============================================
// DREAMHOUSE — metadatos incrustados en la imagen
// ============================================
// Cada render sale con los parámetros con los que se generó dentro del propio archivo, así
// sobreviven a la descarga, al correo o a un "arrastrar y soltar" en otra sesión:
//   - JPEG: paquete XMP en un segmento APP1.
//   - PNG:  chunk iTXt con la clave estándar "XML:com.adobe.xmp".
// El contenido va en un único atributo `dreamhouse:payload` (JSON en UTF-8, codificado en base64),
// dentro de un paquete XMP válido, de modo que cualquier visor lo ignora sin romperse.
// Módulo isomórfico (navegador y servidor), sin dependencias.

import type { DreamHouseParams, GenerationMode } from '../types';

export const METADATA_APP = 'DreamHouse';
export const METADATA_VERSION = 1;

export interface DreamHouseImageMetadata {
  app: typeof METADATA_APP;
  version: number;
  /** Identificador de esta imagen; las vistas lo usan como `parentId` de su render de origen */
  id: string;
  createdAt: string; // ISO 8601
  mode: GenerationMode;
  /** Modelo que generó la imagen, p. ej. "gpt-image-2.5-sunburst" */
  model: string;
  quality?: string;
  size?: string;
  houseName?: string;
  /** Solo en modo vistas: qué vista es (p. ej. "Perspectiva Principal (Hero Shot)") */
  viewType?: string;
  /** Id de la imagen de la que se derivó (render original de una vista, imagen base de una edición) */
  parentId?: string;
  /** Parámetros del formulario con los que se generó */
  params: Partial<DreamHouseParams>;
  /** Prompt final enviado al modelo (se omite si el paquete no cabe) */
  prompt?: string;
}

/**
 * Campos de diseño que se incrustan por defecto. Es una LISTA EXPLÍCITA: un campo nuevo del formulario
 * no viaja dentro de la imagen hasta que alguien lo agregue aquí a propósito.
 * Quedan fuera, y solo se incrustan si el usuario lo pide (`embedDetails`): la ciudad, las notas y
 * textos libres (`artDirection`, `negativePrompt`, `editPrompt`) y el prompt completo.
 */
export const DESIGN_PARAM_KEYS = [
  'architecturalStyles', 'architect', 'mood', 'materials', 'finishLevel', 'colorPalette',
  'cameraAngle', 'composition', 'timeOfDay', 'season', 'lighting', 'humanContext',
  'cameraPreset', 'focalLength', 'aperture', 'filmSimulation', 'depthOfField',
  'renderStyle', 'renderAspectRatio', 'renderOutputResolution', 'renderQuality', 'aiModel',
  'projectType', 'climate', 'environment', 'waterBody', 'weatherCondition', 'size', 'levels',
  'roofType', 'layoutType', 'parkingSpots', 'parkingType', 'socialAreas', 'exteriorElements',
  'vegetation', 'architecturalDetails',
  'roomType', 'roomSizeM2', 'furnitureStyle', 'interiorLighting', 'flooringMaterial', 'ceilingDetail',
  'bedrooms', 'bathrooms', 'kitchenType', 'livingAreaType',
  'editChangeType', 'editIntensity', 'editPreserve',
  'siteTopography', 'solarOrientation', 'constructionSystem', 'roofMaterial', 'passiveStrategies', 'windowType', 'wallFinish',
  'floorPlanStyle', 'lotWidthM', 'lotDepthM', 'planSpaces', 'zoningLayout', 'floorPlanAnnotations',
] as const satisfies ReadonlyArray<keyof DreamHouseParams>;

/** Solo con permiso expreso del usuario: ubicación y textos libres */
export const DETAIL_PARAM_KEYS = [
  'city', 'artDirection', 'negativePrompt', 'editPrompt',
] as const satisfies ReadonlyArray<keyof DreamHouseParams>;

/** Parámetros que se pueden incrustar: la lista de diseño, y los detalles solo si `includeDetails` */
export function pickEmbeddableParams(params: DreamHouseParams, includeDetails = false): Partial<DreamHouseParams> {
  const keys: ReadonlyArray<keyof DreamHouseParams> = includeDetails ? [...DESIGN_PARAM_KEYS, ...DETAIL_PARAM_KEYS] : DESIGN_PARAM_KEYS;
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    const value = params[key];
    if (value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)) out[key] = value;
  }
  return out as Partial<DreamHouseParams>;
}

const XMP_HEADER = 'http://ns.adobe.com/xap/1.0/\0';
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_XMP_KEYWORD = 'XML:com.adobe.xmp';
// Un segmento JPEG admite 65.535 bytes incluyendo los 2 de su longitud y el encabezado XMP
const JPEG_MAX_XMP_BYTES = 65_533 - XMP_HEADER.length;

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8');

// ---------- utilidades ----------

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  const binary = atob(text);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

let crcTable: Uint32Array | null = null;
function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = crcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const isJpeg = (b: Uint8Array) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8;
const isPng = (b: Uint8Array) => b.length > 8 && PNG_SIGNATURE.every((v, i) => b[i] === v);
const isWebp = (b: Uint8Array) =>
  b.length > 16 && decoder.decode(b.subarray(0, 4)) === 'RIFF' && decoder.decode(b.subarray(8, 12)) === 'WEBP';

function buildXmpPacket(meta: DreamHouseImageMetadata): string {
  const payload = toBase64(encoder.encode(JSON.stringify(meta)));
  return (
    '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>' +
    '<x:xmpmeta xmlns:x="adobe:ns:meta/">' +
    '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
    '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" ' +
    'xmlns:dreamhouse="https://ai4u.com.co/ns/dreamhouse/1.0/" ' +
    `xmp:CreatorTool="${METADATA_APP}" dreamhouse:payload="${payload}"/>` +
    '</rdf:RDF></x:xmpmeta><?xpacket end="w"?>'
  );
}

/** Reduce el paquete hasta que quepa: primero sin prompt, luego sin parámetros pesados */
function fitMetadata(meta: DreamHouseImageMetadata, maxBytes: number): string | null {
  const attempts: DreamHouseImageMetadata[] = [meta, { ...meta, prompt: undefined }, { ...meta, prompt: undefined, params: {} }];
  for (const attempt of attempts) {
    const packet = buildXmpPacket(attempt);
    if (encoder.encode(packet).length <= maxBytes) return packet;
  }
  return null;
}

// ---------- escribir ----------

function embedInJpeg(bytes: Uint8Array, meta: DreamHouseImageMetadata): Uint8Array {
  const packet = fitMetadata(meta, JPEG_MAX_XMP_BYTES);
  if (!packet) return bytes;
  const body = concat(encoder.encode(XMP_HEADER), encoder.encode(packet));
  const length = body.length + 2;
  const segment = concat(new Uint8Array([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff]), body);
  // Tras el marcador SOI (los dos primeros bytes). Se reemplaza un XMP previo, si lo hubiera.
  const cleaned = removeJpegXmp(bytes);
  // JFIF exige que su segmento APP0 vaya inmediatamente después de SOI: el XMP se inserta tras él
  let offset = 2;
  if (cleaned[2] === 0xff && cleaned[3] === 0xe0) offset = 4 + ((cleaned[4] << 8) | cleaned[5]);
  return concat(cleaned.subarray(0, offset), segment, cleaned.subarray(offset));
}

function removeJpegXmp(bytes: Uint8Array): Uint8Array {
  const found = findJpegXmp(bytes);
  if (!found) return bytes;
  return concat(bytes.subarray(0, found.start), bytes.subarray(found.end));
}

function embedInPng(bytes: Uint8Array, meta: DreamHouseImageMetadata): Uint8Array {
  const packet = fitMetadata(meta, 5 * 1024 * 1024);
  if (!packet) return bytes;
  // iTXt: keyword\0 · compressionFlag(0) · compressionMethod(0) · languageTag\0 · translatedKeyword\0 · texto
  const data = concat(
    encoder.encode(PNG_XMP_KEYWORD),
    new Uint8Array([0, 0, 0, 0, 0]),
    encoder.encode(packet)
  );
  const type = encoder.encode('iTXt');
  const crc = crc32(concat(type, data));
  const chunk = new Uint8Array(12 + data.length);
  const view = new DataView(chunk.buffer);
  view.setUint32(0, data.length);
  chunk.set(type, 4);
  chunk.set(data, 8);
  view.setUint32(8 + data.length, crc);

  // Antes de IEND (último chunk: 12 bytes) y sin duplicar un XMP previo
  const cleaned = removePngXmp(bytes);
  const iend = cleaned.length - 12;
  return concat(cleaned.subarray(0, iend), chunk, cleaned.subarray(iend));
}

function removePngXmp(bytes: Uint8Array): Uint8Array {
  const found = findPngXmp(bytes);
  if (!found) return bytes;
  return concat(bytes.subarray(0, found.start), bytes.subarray(found.end));
}

// ---------- WebP (contenedor RIFF: el XMP viaja en un chunk «XMP » dentro de un VP8X) ----------

interface WebpChunk { type: string; start: number; data: number; size: number; end: number }

function webpChunks(bytes: Uint8Array): WebpChunk[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const chunks: WebpChunk[] = [];
  let pos = 12;
  while (pos + 8 <= bytes.length) {
    const size = view.getUint32(pos + 4, true);
    const end = Math.min(bytes.length, pos + 8 + size + (size & 1)); // los chunks se rellenan a longitud par
    chunks.push({ type: decoder.decode(bytes.subarray(pos, pos + 4)), start: pos, data: pos + 8, size, end });
    pos = end;
  }
  return chunks;
}

/** Cabecera VP8X para un WebP simple (VP8 con pérdida o VP8L sin pérdida), que no la trae */
function webpExtendedHeader(bytes: Uint8Array, first: WebpChunk): Uint8Array | null {
  const d = bytes.subarray(first.data, first.data + first.size);
  let width = 0;
  let height = 0;
  let alpha = false;
  if (first.type === 'VP8 ' && d.length >= 10 && d[3] === 0x9d && d[4] === 0x01 && d[5] === 0x2a) {
    width = (d[6] | (d[7] << 8)) & 0x3fff;
    height = (d[8] | (d[9] << 8)) & 0x3fff;
  } else if (first.type === 'VP8L' && d.length >= 5 && d[0] === 0x2f) {
    const bits = (d[1] | (d[2] << 8) | (d[3] << 16) | (d[4] << 24)) >>> 0;
    width = (bits & 0x3fff) + 1;
    height = ((bits >>> 14) & 0x3fff) + 1;
    alpha = ((bits >>> 28) & 1) === 1;
  } else {
    return null;
  }
  if (!width || !height) return null;
  const out = new Uint8Array(18);
  out.set(encoder.encode('VP8X'), 0);
  out[4] = 10; // tamaño del chunk (LE)
  out[8] = 0x04 | (alpha ? 0x10 : 0); // XMP (+ alfa)
  const w = width - 1;
  const h = height - 1;
  out[12] = w & 0xff; out[13] = (w >> 8) & 0xff; out[14] = (w >> 16) & 0xff;
  out[15] = h & 0xff; out[16] = (h >> 8) & 0xff; out[17] = (h >> 16) & 0xff;
  return out;
}

function embedInWebp(bytes: Uint8Array, meta: DreamHouseImageMetadata): Uint8Array {
  const packet = fitMetadata(meta, 5 * 1024 * 1024);
  if (!packet) return bytes;
  const chunks = webpChunks(bytes).filter((c) => c.type !== 'XMP ');
  if (!chunks.length) return bytes;
  if (chunks.some((c) => c.type === 'ANIM')) return bytes; // animación: no se toca

  const parts: Uint8Array[] = [];
  let header: Uint8Array | null = null;
  if (chunks[0].type === 'VP8X') {
    header = bytes.slice(chunks[0].start, chunks[0].end);
    header[8] |= 0x04; // activa el indicador de XMP
  } else {
    header = webpExtendedHeader(bytes, chunks[0]);
    if (!header) return bytes;
  }
  const rest = chunks[0].type === 'VP8X' ? chunks.slice(1) : chunks;
  parts.push(header);
  for (const c of rest) parts.push(bytes.subarray(c.start, c.end));

  const text = encoder.encode(packet);
  const xmp = new Uint8Array(8 + text.length + (text.length & 1));
  xmp.set(encoder.encode('XMP '), 0);
  new DataView(xmp.buffer).setUint32(4, text.length, true);
  xmp.set(text, 8);
  parts.push(xmp);

  const body = concat(...parts);
  const out = new Uint8Array(12 + body.length);
  out.set(encoder.encode('RIFF'), 0);
  new DataView(out.buffer).setUint32(4, 4 + body.length, true);
  out.set(encoder.encode('WEBP'), 8);
  out.set(body, 12);
  return out;
}

/**
 * Devuelve la imagen con los metadatos incrustados. Si el formato no es JPEG, PNG ni WebP
 * (o algo falla) devuelve los bytes originales sin tocar: nunca rompe la imagen.
 */
export function embedImageMetadata(bytes: Uint8Array, meta: DreamHouseImageMetadata): Uint8Array {
  try {
    if (isJpeg(bytes)) return embedInJpeg(bytes, meta);
    if (isPng(bytes)) return embedInPng(bytes, meta);
    if (isWebp(bytes)) return embedInWebp(bytes, meta);
  } catch (error) {
    console.error('No se pudieron incrustar los metadatos:', error);
  }
  return bytes;
}

// ---------- leer ----------

interface Located {
  start: number; // inicio del segmento/chunk completo
  end: number; // fin (exclusive)
  text: string; // contenido XMP
}

function findJpegXmp(bytes: Uint8Array): Located | null {
  if (!isJpeg(bytes)) return null;
  let pos = 2;
  while (pos + 4 <= bytes.length) {
    if (bytes[pos] !== 0xff) return null;
    const marker = bytes[pos + 1];
    if (marker === 0xd9 || marker === 0xda) return null; // fin de imagen / inicio de datos: ya no hay metadatos
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) { pos += 2; continue; } // marcadores sin longitud
    const length = (bytes[pos + 2] << 8) | bytes[pos + 3];
    if (length < 2 || pos + 2 + length > bytes.length) return null;
    if (marker === 0xe1) {
      const body = bytes.subarray(pos + 4, pos + 2 + length);
      const header = decoder.decode(body.subarray(0, XMP_HEADER.length));
      if (header === XMP_HEADER) {
        return { start: pos, end: pos + 2 + length, text: decoder.decode(body.subarray(XMP_HEADER.length)) };
      }
    }
    pos += 2 + length;
  }
  return null;
}

function findPngXmp(bytes: Uint8Array): Located | null {
  if (!isPng(bytes)) return null;
  let pos = 8;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  while (pos + 12 <= bytes.length) {
    const length = view.getUint32(pos);
    const type = decoder.decode(bytes.subarray(pos + 4, pos + 8));
    const end = pos + 12 + length;
    if (end > bytes.length) return null;
    if (type === 'iTXt') {
      const data = bytes.subarray(pos + 8, pos + 8 + length);
      const keywordEnd = data.indexOf(0);
      if (keywordEnd > 0 && decoder.decode(data.subarray(0, keywordEnd)) === PNG_XMP_KEYWORD) {
        // Tras el keyword: flag, método, languageTag\0, translatedKeyword\0, texto
        let cursor = keywordEnd + 3;
        for (let zeros = 0; zeros < 2 && cursor < data.length; cursor++) if (data[cursor] === 0) zeros++;
        return { start: pos, end, text: decoder.decode(data.subarray(cursor)) };
      }
    }
    if (type === 'IEND') return null;
    pos = end;
  }
  return null;
}

function findWebpXmp(bytes: Uint8Array): Located | null {
  if (!isWebp(bytes)) return null;
  const xmp = webpChunks(bytes).find((c) => c.type === 'XMP ');
  if (!xmp) return null;
  return { start: xmp.start, end: xmp.end, text: decoder.decode(bytes.subarray(xmp.data, xmp.data + xmp.size)) };
}

/** Lee los metadatos de DreamHouse de una imagen. Devuelve null si no los tiene o no son válidos. */
export function readImageMetadata(bytes: Uint8Array): DreamHouseImageMetadata | null {
  try {
    const located = findJpegXmp(bytes) ?? findPngXmp(bytes) ?? findWebpXmp(bytes);
    if (!located) return null;
    const match = /dreamhouse:payload="([A-Za-z0-9+/=]+)"/.exec(located.text);
    if (!match) return null;
    const parsed = JSON.parse(decoder.decode(fromBase64(match[1]))) as DreamHouseImageMetadata;
    if (parsed?.app !== METADATA_APP || typeof parsed.id !== 'string' || typeof parsed.params !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Atajo para el navegador: lee los metadatos de un File subido por el usuario */
export async function readImageMetadataFromFile(file: File): Promise<DreamHouseImageMetadata | null> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return null;
  return readImageMetadata(new Uint8Array(await file.arrayBuffer()));
}
