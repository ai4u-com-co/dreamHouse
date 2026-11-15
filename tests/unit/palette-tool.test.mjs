// Tools · Paleta de colores: prompt (arquitectura/ambiente/paisajismo intactos, solo color), cotización como edición y entradas.
// Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '@/types';
import { buildFullPalettePrompt, PALETTE_PRESERVE_LINES } from '@/modules/tools/paleta/lib/prompt-builder';
import { pickOpenAIInputs, quoteRender } from '@/lib/render-options';
import { normalizeRenderSettings } from '@/lib/render-settings';
import { readFileSync } from 'node:fs';

const base = { ...DEFAULT_PARAMS, mode: 'paleta' };

test('el prompt describe las dos imágenes y recolorea sin rediseñar', () => {
  const p = buildFullPalettePrompt(base);
  assert.match(p, /Image 1: the SPACE/);
  assert.match(p, /Image 2: the COLOR PALETTE/);
  assert.match(p, /RECOLORING, not a redesign/);
  for (const line of PALETTE_PRESERVE_LINES) assert.ok(p.includes(line), `conserva: ${line.slice(0, 40)}`);
  assert.match(p, /landscaping/i);
  assert.match(p, /ambience/i);
  assert.match(p, /architecture/i);
});

test('sin dirección creativa ni prompt negativo no hay líneas vacías de ellos', () => {
  const p = buildFullPalettePrompt(base);
  assert.doesNotMatch(p, /SUPREME MANDATE/);
  assert.doesNotMatch(p, /Also avoid/);
});

test('dirección creativa y prompt negativo llegan al prompt; la imagen base sigue mandando', () => {
  const p = buildFullPalettePrompt({ ...base, artDirection: 'el tono más fuerte solo en la pared del fondo', negativePrompt: 'personas, carteles' });
  assert.match(p, /SUPREME MANDATE/);
  assert.ok(p.includes('el tono más fuerte solo en la pared del fondo'));
  assert.match(p, /Also avoid: personas, carteles/);
  assert.match(p, /architecture, layout and landscaping never change/);
});

test('el modo paleta es válido y sobrevive a normalizeRenderSettings', () => {
  assert.equal(normalizeRenderSettings({ ...base }).mode, 'paleta');
});

test('se cotiza como edición: tamaño auto (el de tu imagen), JPEG y una sola imagen', () => {
  const q = quoteRender({ ...base, renderVariants: 3, renderFormat: 'png' }, { inputImagePixels: [1_500_000, 200_000], estimate: true });
  assert.ok(q.ok);
  assert.equal(q.value.apiSize, 'auto');
  assert.equal(q.value.options.n, 1);
  assert.equal(q.value.options.format, 'jpeg');
});

test('las entradas son [espacio, paleta] en ese orden, y sin espacio o sin paleta no sobran', () => {
  const space = { n: 'space' };
  const palette = { n: 'palette' };
  assert.deepEqual(pickOpenAIInputs('paleta', { editImage: space, references: [palette], objects: [] }), [space, palette]);
  assert.deepEqual(pickOpenAIInputs('paleta', { editImage: space, references: [], objects: [] }), [space]);
  assert.deepEqual(pickOpenAIInputs('paleta', { editImage: null, references: [palette, { n: 'extra' }], objects: [] }), [palette]);
});

test('Tools vive dentro del Módulo de Trabajo del Studio (no como página aparte)', () => {
  const studio = readFileSync('src/app/studio/page.tsx', 'utf8');
  assert.match(studio, /switchMode\('paleta'\)/, 'botón del selector de módulos');
  assert.match(studio, /<PaletteTool/, 'el panel se monta en el Studio');
  assert.match(studio, /isTools \? \(/, 'reemplaza los formularios de los otros módulos');
  const header = readFileSync('src/components/Header.tsx', 'utf8');
  assert.doesNotMatch(header, /href: '\/tools'/, 'sin enlace de menú aparte');
  assert.match(readFileSync('src/app/tools/page.tsx', 'utf8'), /redirect\('\/studio'\)/, '/tools lleva al Studio');
});
