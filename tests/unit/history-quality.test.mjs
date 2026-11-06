// Calidad de las imágenes del historial: la miniatura es solo para la grilla; lo demás usa el render completo.
// Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('la miniatura de la grilla es nítida (>= 640 px y calidad >= 0.8), no la de 320 px al 60 %', async () => {
  const { THUMBNAIL_MAX_SIDE, THUMBNAIL_QUALITY } = await import('@/lib/image-thumbnail');
  assert.ok(THUMBNAIL_MAX_SIDE >= 640, `miniatura de ${THUMBNAIL_MAX_SIDE}px: borrosa en cualquier tarjeta`);
  assert.ok(THUMBNAIL_QUALITY >= 0.8);
  const hook = src('src/lib/hooks/useHistory.ts');
  assert.match(hook, /createThumbnail\(record\.imageUrl, THUMBNAIL_MAX_SIDE, THUMBNAIL_QUALITY\)/, 'el historial usa las constantes, sin números sueltos');
});

test('al cargar un registro del historial, el panel de resultado recibe el render COMPLETO, no la miniatura', () => {
  const studio = src('src/app/studio/page.tsx');
  const load = studio.slice(studio.indexOf('const handleLoadHistory'), studio.indexOf('const handleLoadHistory') + 1800);
  assert.match(load, /getFullImageDataUrl\(record\.id\)/);
  assert.match(load, /setImageUrl\(fullImage \?\? record\.imageUrl\)/);
  assert.match(load, /solo conserva una miniatura/, 'si solo hay miniatura, se avisa');
});

test('el render completo se entrega como data URL (extensión de descarga y «usar como base» correctas)', () => {
  const hook = src('src/lib/hooks/useHistory.ts');
  assert.match(hook, /readAsDataURL\(blob\)/);
  assert.match(src('src/components/ResultDisplay.tsx'), /\^data:image/, 'imageExtension entiende data URLs');
});

test('si el historial no puede guardar un render (renders y vistas) se avisa y una vista generada no cuenta como fallida', () => {
  const studio = src('src/app/studio/page.tsx');
  assert.match(studio, /pero no se pudo guardar en el historial/);
  assert.match(studio, /La vista SÍ se generó/);
});

test('el render completo se guarda sin recomprimir (el Blob del original, no el canvas)', () => {
  const hook = src('src/lib/hooks/useHistory.ts');
  assert.match(hook, /fullImage = await \(await fetch\(record\.imageUrl\)\)\.blob\(\)/);
  assert.match(hook, /saveGeneration\(\{ \.\.\.record, imageUrl: thumbnailUrl \}, fullImage\)/);
});
