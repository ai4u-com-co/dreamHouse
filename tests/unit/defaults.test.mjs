// Predeterminados de la app: GPT Image 2.5, calidad más baja y 16:9 en todos los módulos.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PARAMS } from '@/types';
import * as SC from '@/modules/shared/constants';
import { getOpenAIImageSettings, LOWEST_QUALITY } from '@/lib/openai-image-settings';

test('el modelo predeterminado es GPT Image 2.5 (Sunburst) y es el primero de la lista', () => {
  assert.equal(DEFAULT_PARAMS.aiModel, 'GPT Image 2.5 Sunburst (OpenAI)');
  assert.equal(SC.AI_MODELS[0], DEFAULT_PARAMS.aiModel);
  assert.ok(SC.AI_MODELS.includes(DEFAULT_PARAMS.aiModel), 'debe existir en el selector (si no, se vería "—")');
  assert.deepEqual(SC.AI_MODELS.filter((m) => /Gemini/.test(m)).length, 1, 'Gemini sigue disponible como alternativa');
});

test('la calidad predeterminada es la más baja', () => {
  assert.equal(DEFAULT_PARAMS.renderQuality, 'Borrador');
  assert.equal(SC.RENDER_QUALITIES[0], DEFAULT_PARAMS.renderQuality);
  assert.equal(getOpenAIImageSettings(DEFAULT_PARAMS.aiModel, DEFAULT_PARAMS.renderQuality).quality, 'low');
});

test('el formato predeterminado es 16:9 y la resolución la mínima (1K)', () => {
  assert.equal(DEFAULT_PARAMS.renderAspectRatio, '16:9');
  assert.ok(SC.ASPECT_RATIOS.includes('16:9'));
  assert.equal(DEFAULT_PARAMS.renderOutputResolution, '', 'vacío = 1K, la resolución más barata');
});

test('el servidor sin calidad indicada usa la más baja (llamadas directas y registros antiguos)', () => {
  assert.equal(LOWEST_QUALITY, 'low');
  for (const quality of [undefined, '', 'inventada']) {
    assert.equal(getOpenAIImageSettings('GPT Image 2.5 Sunburst (OpenAI)', quality).quality, 'low');
  }
});

test('las demás calidades siguen disponibles y el modelo se elige por nombre', () => {
  assert.equal(getOpenAIImageSettings('GPT Image 2.5 Sunburst (OpenAI)', 'Estándar').quality, 'medium');
  assert.equal(getOpenAIImageSettings('GPT Image 2.5 Sunburst (OpenAI)', 'Alta').quality, 'high');
  assert.equal(getOpenAIImageSettings('GPT Image 2.5 Sunburst (OpenAI)', 'Máxima').quality, 'xhigh');
  assert.equal(getOpenAIImageSettings('GPT Image 2.5 Flare · borrador rápido (OpenAI)').model, 'gpt-image-2.5-flare');
  assert.equal(getOpenAIImageSettings('GPT Image 2.5 Sunburst (OpenAI)').model, 'gpt-image-2.5-sunburst');
  assert.equal(getOpenAIImageSettings('GPT Image 2 (OpenAI)').model, 'gpt-image-2.5-sunburst', 'registros antiguos caen en Sunburst');
});

// "Sorpréndeme" no puede pisar los ajustes de salida (antes sorteaba ratio y resolución, podía salir 4K o 1:4)
test('"Sorpréndeme" no sortea el ratio, la resolución, el modelo ni la calidad', () => {
  const page = readFileSync(new URL('../../src/app/studio/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('const handleRandomize');
  const end = page.indexOf('const handleGenerate');
  assert.ok(start > 0 && end > start, 'no se encontró handleRandomize');
  const randomize = page.slice(start, end);
  for (const field of ['renderAspectRatio', 'renderOutputResolution', 'aiModel', 'renderQuality']) {
    assert.ok(!new RegExp(`${field}\\s*:`).test(randomize), `handleRandomize no debe tocar ${field}`);
  }
});

test('"Reset" vuelve a los predeterminados (usa DEFAULT_PARAMS completo)', () => {
  const page = readFileSync(new URL('../../src/app/studio/page.tsx', import.meta.url), 'utf8');
  const start = page.indexOf('const handleReset');
  const reset = page.slice(start, page.indexOf('};', start));
  assert.match(reset, /\.\.\.DEFAULT_PARAMS/);
  assert.ok(!/aiModel|renderAspectRatio|renderQuality/.test(reset), 'Reset no debe sobrescribir esos campos con otros valores');
});
