// GPT Image 2.6 como opción (el 2.5 sigue siendo el predeterminado). Puntos MEDIDOS con la API real el 14-nov-2026
// (`output_tokens`, Sunburst y Flare idénticos). Si el cobro queda por DEBAJO de ellos, la app regala créditos.
// Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = await import('@/lib/openai-image-core.ts');
const { getOpenAIImageSettings, imageModelKey } = await import('@/lib/openai-image-settings');
const SC = await import('@/modules/shared/constants');
const { DEFAULT_PARAMS } = await import('@/types');
const { quoteRender } = await import('@/lib/render-options');

const MEDIDOS_26 = [
  ['low', 1024, 640, 450], ['low', 1536, 1024, 664], ['low', 1024, 1024, 824], ['low', 1792, 1280, 794], ['low', 1920, 640, 273], ['low', 2560, 1440, 861],
  ['medium', 1024, 640, 789], ['medium', 1024, 1024, 1449], ['high', 1024, 640, 956], ['high', 1024, 1024, 1756], ['xhigh', 1024, 640, 1700], ['max', 1024, 640, 3824],
];

test('el cobro estimado del 2.6 nunca queda por debajo de lo medido en la API real', () => {
  for (const [q, w, h, real] of MEDIDOS_26) {
    const est = core.estimateOutputTokens(q, w, h, 'sunburst26');
    assert.ok(est >= real, `${q} ${w}x${h}: estimado ${est} < real ${real}`);
    assert.equal(core.estimateOutputTokens(q, w, h, 'flare26'), est, 'Flare 2.6 cuesta lo mismo que Sunburst 2.6');
  }
});

test('el 2.5 no cambia de costo (sin modelo = 2.5) y el 2.6 es más caro en low y medium', () => {
  assert.equal(core.estimateOutputTokens('low', 1024, 1024), core.estimateOutputTokens('low', 1024, 1024, 'sunburst'));
  assert.ok(core.estimateOutputTokens('low', 1024, 1024, 'sunburst26') > 4 * core.estimateOutputTokens('low', 1024, 1024, 'sunburst'));
  assert.ok(core.creditsFor({ quality: 'low', model: 'sunburst26', width: 1024, height: 1024, n: 1, promptChars: 0 }) > core.creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, promptChars: 0 }));
});

test('el nombre de la interfaz elige el modelo; el 2.5 Sunburst es el predeterminado y los registros antiguos caen ahí', () => {
  assert.equal(SC.AI_MODELS[0], DEFAULT_PARAMS.aiModel);
  assert.equal(imageModelKey(DEFAULT_PARAMS.aiModel), 'sunburst');
  assert.equal(imageModelKey('GPT Image 2.6 Sunburst (OpenAI)'), 'sunburst26');
  assert.equal(imageModelKey('GPT Image 2.6 Flare · borrador rápido (OpenAI)'), 'flare26');
  assert.equal(imageModelKey('GPT Image 2 (OpenAI)'), 'sunburst');
  assert.equal(getOpenAIImageSettings('GPT Image 2.6 Sunburst (OpenAI)').model, 'gpt-image-2.6-sunburst');
  assert.equal(getOpenAIImageSettings('GPT Image 2.6 Flare · borrador rápido (OpenAI)').model, 'gpt-image-2.6-flare');
  assert.equal(SC.AI_MODELS.length, 4);
});

test('la cotización del formulario usa el modelo elegido (2.6 cobra más que 2.5 con los mismos ajustes)', () => {
  const base = { ...DEFAULT_PARAMS, mode: 'exterior' };
  const c25 = quoteRender({ ...base, aiModel: SC.AI_MODELS[0] }, { inputImagePixels: [], estimate: true });
  const c26 = quoteRender({ ...base, aiModel: SC.AI_MODELS[2] }, { inputImagePixels: [], estimate: true });
  assert.ok(c25.ok && c26.ok);
  assert.equal(c26.value.options.modelId, 'gpt-image-2.6-sunburst');
  assert.ok(c26.value.options.credits > c25.value.options.credits, `${c26.value.options.credits} vs ${c25.value.options.credits}`);
});
