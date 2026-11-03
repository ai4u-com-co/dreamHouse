// Máscara de edición por zona: el borde debe acomodarse, no cortar en seco.
// Imágenes sintéticas con sharp, sin red ni claves. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { editMaskGeometry, prepareEditMask, blendEditedOntoBase } from '@/lib/edit-mask';

const LIMIT = 4096 * 4096;

/** Máscara de usuario: opaca (no editable) salvo un cuadrado transparente (editable) */
async function userMask(w, h, box) {
  const alpha = Buffer.alloc(w * h, 255);
  for (let y = box.y; y < box.y + box.size; y++) for (let x = box.x; x < box.x + box.size; x++) alpha[y * w + x] = 0;
  return sharp({ create: { width: w, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}
const solid = (w, h, rgb) => sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).png().toBuffer();
const at = (buf, w, x, y) => buf[y * w + x];

test('el margen crece con la imagen (un valor fijo no sirve en 2K)', () => {
  const small = editMaskGeometry(640, 360);
  const big = editMaskGeometry(2048, 1152);
  assert.ok(big.margin > small.margin * 2, `${big.margin} vs ${small.margin}`);
  assert.ok(small.margin >= 2 && small.sigma > 0);
});

test('los buffers de mezcla son de 1 canal (width*height bytes)', async () => {
  const w = 400, h = 300;
  const { blendAlpha } = await prepareEditMask(await userMask(w, h, { x: 150, y: 100, size: 100 }), w, h, LIMIT);
  assert.equal(blendAlpha.length, w * h);
});

test('la zona editable se amplía: justo fuera del trazo ya hay peso de mezcla', async () => {
  const w = 400, h = 300, box = { x: 150, y: 100, size: 100 };
  const { geometry, blendAlpha } = await prepareEditMask(await userMask(w, h, box), w, h, LIMIT);
  const cy = box.y + 50;
  assert.ok(at(blendAlpha, w, box.x + 50, cy) > 250, 'dentro del trazo el cambio es completo');
  assert.ok(at(blendAlpha, w, box.x - 1, cy) > 128, 'pegado al trazo, por fuera, aún se mezcla (antes era un corte de 2 px)');
  assert.ok(geometry.margin >= 2);
});

test('el borde es un degradado monótono y su ancho es proporcional al margen', async () => {
  const w = 1600, h = 900, box = { x: 600, y: 300, size: 400 };
  const { blendAlpha, geometry } = await prepareEditMask(await userMask(w, h, box), w, h, LIMIT);
  const cy = box.y + 200;
  let prev = 256, band = 0;
  for (let x = box.x + 40; x >= box.x - 80; x--) {
    const v = at(blendAlpha, w, x, cy);
    assert.ok(v <= prev, `no monótono en x=${x}`);
    if (v > 5 && v < 250) band++;
    prev = v;
  }
  assert.ok(band >= geometry.margin, `la transición debe ser gradual, no un escalón (banda ${band}px, margen ${geometry.margin}px)`);
});

test('lejos de la zona la imagen queda idéntica al original (peso 0)', async () => {
  const w = 400, h = 300, box = { x: 150, y: 100, size: 100 };
  const { blendAlpha, geometry } = await prepareEditMask(await userMask(w, h, box), w, h, LIMIT);
  const far = box.x - geometry.margin * 4;
  assert.equal(at(blendAlpha, w, far, box.y + 50), 0);
  assert.equal(at(blendAlpha, w, 5, 5), 0);
});

test('la máscara para el modelo está ampliada y es transparente donde se puede editar', async () => {
  const w = 400, h = 300, box = { x: 150, y: 100, size: 100 };
  const { modelMaskPng, geometry } = await prepareEditMask(await userMask(w, h, box), w, h, LIMIT);
  const { data, info } = await sharp(modelMaskPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.equal(info.width, w); assert.equal(info.height, h); assert.equal(info.channels, 4);
  const alphaAt = (x, y) => data[(y * w + x) * 4 + 3];
  assert.equal(alphaAt(box.x + 50, box.y + 50), 0, 'dentro: transparente (editable)');
  assert.equal(alphaAt(box.x - Math.floor(geometry.margin / 2), box.y + 50), 0, 'el margen también es editable');
  assert.equal(alphaAt(5, 5), 255, 'lejos: opaco (protegido)');
});

test('al componer: lejos queda el original, dentro el resultado y en el borde una mezcla', async () => {
  const w = 400, h = 300, box = { x: 150, y: 100, size: 100 };
  const prepared = await prepareEditMask(await userMask(w, h, box), w, h, LIMIT);
  const base = await solid(w, h, { r: 200, g: 200, b: 200 });   // gris claro
  const edited = await solid(w, h, { r: 20, g: 20, b: 20 });    // casi negro
  const out = await blendEditedOntoBase(base, edited, prepared, { base: LIMIT, result: LIMIT }, 100);
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => data[(y * w + x) * info.channels];
  const cy = box.y + 50;
  assert.ok(Math.abs(px(5, 5) - 200) <= 3, 'lejos: igual al original');
  assert.ok(px(box.x + 50, cy) < 40, 'dentro: el resultado del modelo');
  const edge = px(box.x - 3, cy);
  assert.ok(edge > 40 && edge < 190, `en el borde hay mezcla, no corte (valor ${edge})`);
});
