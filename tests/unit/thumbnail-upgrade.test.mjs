// Las miniaturas antiguas del historial (320 px al 60 %) se rehacen desde el render completo. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('qué registros necesitan mejorar su miniatura', async () => {
  const { needsThumbnailUpgrade, THUMBNAIL_VERSION } = await import('@/lib/image-thumbnail');
  assert.equal(needsThumbnailUpgrade({ hasFullImage: true }), true, 'sin versión = miniatura antigua');
  assert.equal(needsThumbnailUpgrade({ hasFullImage: true, thumbV: 1 }), true);
  assert.equal(needsThumbnailUpgrade({ hasFullImage: true, thumbV: THUMBNAIL_VERSION }), false, 'ya está al día');
  assert.equal(needsThumbnailUpgrade({ hasFullImage: false }), false, 'sin render completo no hay de dónde rehacerla');
  assert.equal(needsThumbnailUpgrade({}), false);
});

test('los registros nuevos nacen con la miniatura al día (no se vuelven a procesar)', () => {
  assert.match(src('src/lib/db.ts'), /thumbV: THUMBNAIL_VERSION \}/);
});

test('la mejora cambia SOLO la miniatura: no toca la fecha ni los parámetros', () => {
  const db = src('src/lib/db.ts');
  const body = db.slice(db.indexOf('async updateThumbnail'), db.indexOf('async getAllGenerations'));
  assert.match(body, /store\.put\(\{ \.\.\.record, imageUrl, thumbV \}\)/);
  assert.doesNotMatch(body, /timestamp/);
  assert.match(body, /if \(!record\) return/, 'si el registro se borró mientras tanto, no se recrea');
});

test('la mejora corre de una en una, se detiene si cambia la cuenta y no guarda una miniatura fallida', () => {
  const hook = src('src/lib/hooks/useHistory.ts');
  assert.match(hook, /upgrading\.current/);
  assert.match(hook, /currentOwner\.current !== owner\) return/);
  assert.match(hook, /thumb\.startsWith\('data:image\/'\)/, 'si createThumbnail falla devuelve la entrada: no se guarda como miniatura');
  assert.match(hook, /failedUpgrades/, 'un fallo no se reintenta en bucle');
  assert.match(hook, /URL\.revokeObjectURL\(source\)/, 'se libera la memoria del render decodificado');
  assert.match(hook, /getFullImage\(record\.id\)/, 'se rehace desde el render completo guardado');
});

test('un render transparente ya no queda negro en la miniatura (fondo blanco antes de dibujar)', () => {
  const t = src('src/lib/image-thumbnail.ts');
  assert.ok(t.indexOf("fillStyle = '#ffffff'") > -1);
  assert.ok(t.indexOf("fillStyle = '#ffffff'") < t.indexOf('drawImage'), 'el fondo va ANTES de dibujar la imagen');
});
