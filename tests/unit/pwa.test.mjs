// Contrato de la PWA: instalable en el celular. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import sharp from 'sharp';
import manifest from '../../src/app/manifest.ts';

const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const m = manifest();

test('el manifest cumple lo mínimo para instalarse (nombre, start_url, standalone, colores)', () => {
  assert.ok(m.name && m.short_name, 'name y short_name');
  assert.ok(m.short_name.length <= 12, 'short_name corto para el ícono del celular');
  assert.equal(m.display, 'standalone');
  assert.equal(m.start_url, '/studio');
  assert.equal(m.lang, 'es');
  assert.match(m.theme_color, /^#[0-9a-f]{6}$/i);
  assert.match(m.background_color, /^#[0-9a-f]{6}$/i);
});

test('hay íconos 192 y 512, y uno maskable; todos existen con el tamaño declarado', async () => {
  const sizes = m.icons.map((i) => i.sizes);
  assert.ok(sizes.includes('192x192') && sizes.includes('512x512'));
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'falta ícono maskable (Android lo recorta en círculo)');
  for (const icon of m.icons) {
    const file = new URL(`public${icon.src}`, root);
    assert.ok(existsSync(file), `no existe ${icon.src}`);
    const meta = await sharp(file.pathname).metadata();
    assert.equal(`${meta.width}x${meta.height}`, icon.sizes, `${icon.src} no mide lo que declara`);
  }
  assert.ok(existsSync(new URL('public/icons/apple-touch-icon.png', root)), 'falta el ícono de iPhone');
});

test('el service worker nunca guarda /api ni peticiones que no sean GET', () => {
  const sw = read('public/sw.js');
  assert.match(sw, /request\.method !== 'GET'/);
  assert.match(sw, /startsWith\('\/api\/'\)/);
  assert.match(sw, /OFFLINE_URL/);
});

test('el layout declara viewport, color de tema y metadatos de iPhone', () => {
  const layout = read('src/app/layout.tsx');
  assert.match(layout, /export const viewport/);
  assert.match(layout, /themeColor/);
  assert.match(layout, /appleWebApp/);
  assert.match(layout, /apple-touch-icon/);
});

test('existe la página sin conexión que el service worker sirve de respaldo', () => {
  assert.ok(existsSync(new URL('src/app/offline/page.tsx', root)));
});
