// Pruebas del módulo de metadatos. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { embedImageMetadata, readImageMetadata, pickEmbeddableParams } from '@/lib/image-metadata';
import { DEFAULT_PARAMS } from '@/types';

const meta = (over = {}) => ({
  app: 'DreamHouse',
  version: 1,
  id: 'abc-123',
  createdAt: '2026-11-03T22:00:00.000Z',
  mode: 'exterior',
  model: 'gpt-image-2.5-sunburst',
  quality: 'high',
  size: '1360x768',
  houseName: 'Casa Nube Serena',
  params: { projectType: 'Tiny house', materials: ['Madera', 'Concreto'], levels: 1, city: 'Medellín — árbol ñandú' },
  prompt: 'An architectural photograph of a tiny house…',
  ...over,
});

const makeJpeg = () => sharp({ create: { width: 64, height: 48, channels: 3, background: '#88aa99' } }).jpeg().toBuffer();
const makePng = () => sharp({ create: { width: 64, height: 48, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 0.5 } } }).png().toBuffer();

for (const [name, make] of [['JPEG', makeJpeg], ['PNG', makePng]]) {
  test(`${name}: ida y vuelta conserva todos los campos, incluidas tildes y emojis`, async () => {
    const original = new Uint8Array(await make());
    const m = meta({ houseName: 'Casa 🌿 Ñandú' });
    const out = embedImageMetadata(original, m);
    assert.ok(out.length > original.length, 'el archivo debe crecer');
    assert.deepEqual(readImageMetadata(out), m);
  });

  test(`${name}: la imagen sigue siendo válida y con las mismas dimensiones`, async () => {
    const original = new Uint8Array(await make());
    const out = embedImageMetadata(original, meta());
    const info = await sharp(Buffer.from(out)).metadata();
    assert.equal(info.width, 64);
    assert.equal(info.height, 48);
    // y se puede decodificar completa (no solo leer la cabecera)
    await sharp(Buffer.from(out)).raw().toBuffer();
  });

  test(`${name}: incrustar dos veces reemplaza, no acumula`, async () => {
    const original = new Uint8Array(await make());
    const once = embedImageMetadata(original, meta({ id: 'uno' }));
    const twice = embedImageMetadata(once, meta({ id: 'dos' }));
    assert.equal(readImageMetadata(twice).id, 'dos');
    assert.equal(twice.length, embedImageMetadata(original, meta({ id: 'dos' })).length);
  });

  test(`${name}: una imagen sin metadatos devuelve null`, async () => {
    assert.equal(readImageMetadata(new Uint8Array(await make())), null);
  });
}

test('JPEG: si el prompt es enorme, se omite y se conservan los parámetros', async () => {
  const original = new Uint8Array(await makeJpeg());
  const out = embedImageMetadata(original, meta({ prompt: 'x'.repeat(200_000) }));
  const read = readImageMetadata(out);
  assert.ok(read, 'debe seguir siendo legible');
  assert.equal(read.prompt, undefined);
  assert.equal(read.params.projectType, 'Tiny house');
  await sharp(Buffer.from(out)).raw().toBuffer();
});

test('PNG: un paquete grande cabe sin recortar', async () => {
  const original = new Uint8Array(await makePng());
  const out = embedImageMetadata(original, meta({ prompt: 'y'.repeat(200_000) }));
  assert.equal(readImageMetadata(out).prompt.length, 200_000);
  await sharp(Buffer.from(out)).raw().toBuffer();
});

test('formatos no soportados y bytes basura no se rompen', async () => {
  const webp = new Uint8Array(await sharp({ create: { width: 8, height: 8, channels: 3, background: '#fff' } }).webp().toBuffer());
  assert.deepEqual(embedImageMetadata(webp, meta()), webp); // WebP: se devuelve igual
  assert.equal(readImageMetadata(webp), null);
  assert.equal(readImageMetadata(new Uint8Array([1, 2, 3])), null);
  assert.equal(readImageMetadata(new Uint8Array(0)), null);
});

test('un paquete con otra app o JSON corrupto se rechaza', async () => {
  const original = new Uint8Array(await makeJpeg());
  const ajeno = embedImageMetadata(original, meta({ app: 'OtraApp' }));
  assert.equal(readImageMetadata(ajeno), null);
});

// ---------- privacidad: qué se incrusta ----------

const sensitive = {
  ...DEFAULT_PARAMS,
  city: 'Calle Secreta 123, Medellín',
  artDirection: 'Nota privada del cliente',
  technicalNotes: 'Presupuesto: 500 millones',
  negativePrompt: 'sin vecinos',
  editPrompt: 'quitar el carro del vecino',
  projectType: 'Tiny house',
  materials: ['Madera'],
  campoNuevoSinRevisar: 'no debería viajar',
  sourceRender: { id: 'x', mode: 'exterior', params: {} },
};

test('por defecto solo se incrustan campos de diseño: nada de ciudad, notas ni textos libres', () => {
  const out = pickEmbeddableParams(sensitive);
  assert.equal(out.projectType, 'Tiny house');
  assert.deepEqual(out.materials, ['Madera']);
  for (const key of ['city', 'artDirection', 'technicalNotes', 'negativePrompt', 'editPrompt', 'sourceRender', 'campoNuevoSinRevisar']) {
    assert.ok(!(key in out), `no debe incrustarse "${key}"`);
  }
  const serialized = JSON.stringify(out);
  assert.ok(!/Secreta|privada|500 millones|vecino/.test(serialized));
});

test('con permiso expreso se incluyen ciudad y textos libres, pero un campo nuevo sigue fuera', () => {
  const out = pickEmbeddableParams(sensitive, true);
  assert.equal(out.city, 'Calle Secreta 123, Medellín');
  assert.equal(out.artDirection, 'Nota privada del cliente');
  assert.ok(!('campoNuevoSinRevisar' in out));
  assert.ok(!('sourceRender' in out));
});

test('los valores vacíos no ocupan espacio en el archivo', () => {
  const out = pickEmbeddableParams(DEFAULT_PARAMS);
  assert.ok(!('mood' in out) && !('materials' in out));
});
