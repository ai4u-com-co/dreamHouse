// Opciones de salida de GPT Image 2.5: defaults baratos, registros antiguos y cotización (mismo núcleo que el servidor).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '@/types';
import * as SC from '@/modules/shared/constants';
import { normalizeRenderSettings } from '@/lib/render-settings';
import { quoteRender, pickOpenAIInputs } from '@/lib/render-options';
import { ASPECTS } from '@/lib/openai-image-core.ts';

test('defaults: Borrador · 1K · 1 variante · JPEG · fondo automático · moderación automática · Sunburst', () => {
  assert.deepEqual(
    [DEFAULT_PARAMS.renderQuality, DEFAULT_PARAMS.renderOutputResolution, DEFAULT_PARAMS.renderVariants, DEFAULT_PARAMS.renderFormat, DEFAULT_PARAMS.renderBackground, DEFAULT_PARAMS.renderModeration],
    ['Borrador', '1K', 1, 'jpeg', 'auto', 'auto'],
  );
  assert.equal(DEFAULT_PARAMS.aiModel, SC.AI_MODELS[0]);
  const q = quoteRender(DEFAULT_PARAMS, { inputImagePixels: [] });
  assert.ok(q.ok);
  assert.equal(q.value.options.credits, 1);
  assert.equal(q.value.options.quality, 'low');
});

test('calidades de la interfaz: cinco, con «Muy alta» y «Máxima» al final', () => {
  assert.deepEqual([...SC.RENDER_QUALITIES], ['Borrador', 'Estándar', 'Alta', 'Muy alta', 'Máxima']);
  for (const q of SC.RENDER_QUALITIES) assert.ok(SC.RENDER_QUALITY_HINTS[q]);
});

test('todos los formatos que ofrece la interfaz los acepta el núcleo (nada se acota en silencio)', () => {
  for (const a of SC.ASPECT_RATIOS) assert.ok(ASPECTS.includes(a), a);
  for (const r of ['1K', '2K']) for (const a of SC.ASPECT_RATIOS) assert.ok(quoteRender({ ...DEFAULT_PARAMS, renderOutputResolution: r, renderAspectRatio: a }, { inputImagePixels: [] }).ok, `${r} ${a}`);
});

test('registros antiguos: valores que ya no existen se normalizan a lo barato y válido', () => {
  const old = normalizeRenderSettings({ ...DEFAULT_PARAMS, renderOutputResolution: '4K', renderAspectRatio: '1:8', renderQuality: 'Máxima', renderVariants: undefined, renderFormat: undefined });
  assert.equal(old.renderOutputResolution, '2K');
  assert.equal(old.renderAspectRatio, '16:9');
  assert.equal(old.renderVariants, 1);
  assert.equal(old.renderFormat, 'jpeg');
  for (const r of ['', '512', undefined]) assert.equal(normalizeRenderSettings({ ...DEFAULT_PARAMS, renderOutputResolution: r }).renderOutputResolution, '1K');
  assert.equal(normalizeRenderSettings({ ...DEFAULT_PARAMS, renderCustomSize: 'constructor' }).renderCustomSize, DEFAULT_PARAMS.renderCustomSize);
});

test('el costo crece con cada opción cara y el tamaño personalizado se valida', () => {
  const base = quoteRender(DEFAULT_PARAMS, { inputImagePixels: [] }).value.options.credits;
  const cost = (over) => quoteRender({ ...DEFAULT_PARAMS, ...over }, { inputImagePixels: [] }).value.options.credits;
  assert.ok(cost({ renderQuality: 'Estándar' }) > base);
  assert.ok(cost({ renderQuality: 'Máxima' }) > cost({ renderQuality: 'Muy alta' }));
  assert.ok(cost({ renderOutputResolution: '2K' }) > base);
  assert.equal(cost({ renderVariants: 3 }), base * 3);
  assert.equal(cost({ renderOutputResolution: 'Personalizado', renderCustomSize: '1280x720' }) >= 1, true);
  assert.equal(quoteRender({ ...DEFAULT_PARAMS, renderOutputResolution: 'Personalizado', renderCustomSize: '1000x700' }, { inputImagePixels: [] }).ok, false);
});

test('moderación baja solo se cotiza con admin verificado; transparente pasa a webp', () => {
  assert.equal(quoteRender({ ...DEFAULT_PARAMS, renderModeration: 'low' }, { inputImagePixels: [] }).ok, false);
  assert.equal(quoteRender({ ...DEFAULT_PARAMS, renderModeration: 'low' }, { inputImagePixels: [], isAdmin: true }).ok, true);
  assert.equal(quoteRender({ ...DEFAULT_PARAMS, renderBackground: 'transparent' }, { inputImagePixels: [] }).value.options.format, 'webp');
});

test('edición: el tamaño es auto y se cobra por los píxeles de la base (acotados al rango del núcleo)', () => {
  const q = quoteRender({ ...DEFAULT_PARAMS, mode: 'edit', renderVariants: 4 }, { inputImagePixels: [2048 * 2048] });
  assert.equal(q.value.apiSize, 'auto');
  assert.equal(q.value.options.n, 1);
  assert.equal(q.value.options.pixels, 3_686_400);
  const tiny = quoteRender({ ...DEFAULT_PARAMS, mode: 'edit' }, { inputImagePixels: [100 * 100] });
  assert.equal(tiny.value.options.pixels, 655_360);
});

test('pickOpenAIInputs: vistas solo la casa; interior suma objetos; el tope es 17', () => {
  assert.deepEqual(pickOpenAIInputs('vistas', { lot: 'L', exteriorRef: 'E', floorPlan: 'P', references: ['r'], objects: ['o'] }), ['L']);
  assert.deepEqual(pickOpenAIInputs('interior', { lot: 'L', floorPlan: 'P', references: ['r'], objects: ['o'] }), ['P', 'L', 'r', 'o']);
  const refs = Array.from({ length: 20 }, (_, i) => `r${i}`);
  assert.equal(pickOpenAIInputs('exterior', { lot: 'L', exteriorRef: 'E', floorPlan: 'P', references: refs, objects: [] }).length, 17);
});
