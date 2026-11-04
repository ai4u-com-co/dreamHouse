// Entradas hostiles: claves del prototipo y valores de tipo incorrecto (el cliente puede enviar cualquier cosa).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '@/types';
import { lookup } from '@/lib/safe-lookup';
import { getOpenAIImageSettings } from '@/lib/openai-image-settings';
import { normalizeRenderSettings } from '@/lib/render-settings';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';
import { resolveRenderStyle } from '@/modules/shared/lib/prompt-helpers';

const PROTO_KEYS = ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf'];
const MODELS = ['GPT Image 2.5 Sunburst (OpenAI)', 'Gemini 3.1 Flash Image Preview'];

test('lookup ignora lo heredado del prototipo y las claves que no son texto', () => {
  const map = { a: 1 };
  assert.equal(lookup(map, 'a'), 1);
  for (const key of [...PROTO_KEYS, 'b', undefined, null, 42, {}, ['a']]) assert.equal(lookup(map, key), undefined, String(key));
});

test('calidad: una clave del prototipo NO es una calidad válida; cae en la más baja', () => {
  for (const key of PROTO_KEYS) {
    const { quality } = getOpenAIImageSettings(DEFAULT_PARAMS.aiModel, key);
    assert.equal(quality, 'low', `renderQuality="${key}" debe caer en low, no ser una función`);
    assert.equal(typeof quality, 'string');
  }
});

test('prompts: una clave del prototipo en un campo del formulario no se interpola como código de función', () => {
  for (const key of PROTO_KEYS) {
    for (const model of MODELS) {
      const outputs = [
        buildExteriorPrompt({ ...DEFAULT_PARAMS, projectType: key, size: key, layoutType: key, renderStyle: key }, false, model),
        buildInteriorPrompt({ ...DEFAULT_PARAMS, roomType: key, furnitureStyle: [key], interiorLighting: [key], renderStyle: key }, model),
        buildVistasPrompt({ ...DEFAULT_PARAMS, projectType: key, renderStyle: key }, key, model),
      ];
      for (const out of outputs) {
        assert.ok(!/native code|function Object|\[object /.test(out), `"${key}" se coló como código en el prompt (${model}):\n${out.slice(0, 300)}`);
        assert.ok(!/View rule: undefined/.test(out));
      }
    }
  }
  assert.equal(resolveRenderStyle('constructor').photographic, true, 'estilo desconocido = fotorrealista');
});

test('frontera de la API: ajustes de tipo incorrecto o fuera de catálogo se reemplazan por los predeterminados', () => {
  const bad = normalizeRenderSettings({
    ...DEFAULT_PARAMS, aiModel: 12345, renderQuality: 'constructor', renderAspectRatio: '16:9; DROP', renderOutputResolution: '8K', mode: 'hack',
  });
  assert.equal(bad.aiModel, DEFAULT_PARAMS.aiModel);
  assert.equal(bad.renderQuality, 'Borrador');
  assert.equal(bad.renderAspectRatio, '16:9');
  assert.equal(bad.renderOutputResolution, '');
  assert.equal(bad.mode, 'exterior');
});

test('frontera de la API: valores válidos se respetan y los que faltan toman el predeterminado', () => {
  const FLARE = 'GPT Image 2.5 Flare · borrador rápido (OpenAI)';
  const ok = normalizeRenderSettings({ ...DEFAULT_PARAMS, aiModel: FLARE, renderQuality: 'Alta', renderAspectRatio: '1:1', renderOutputResolution: '2K', mode: 'vistas' });
  assert.deepEqual([ok.aiModel, ok.renderQuality, ok.renderAspectRatio, ok.renderOutputResolution, ok.mode], [FLARE, 'Alta', '1:1', '2K', 'vistas']);
  const missing = normalizeRenderSettings({ mode: 'exterior' });
  assert.deepEqual([missing.aiModel, missing.renderQuality, missing.renderAspectRatio], ['GPT Image 2.5 Sunburst (OpenAI)', 'Borrador', '16:9']);
});

test('frontera de la API: un modelo de registros antiguos que ya no existe en la lista cae en el predeterminado', () => {
  assert.equal(normalizeRenderSettings({ ...DEFAULT_PARAMS, aiModel: 'GPT Image 2 (OpenAI)' }).aiModel, DEFAULT_PARAMS.aiModel);
});

test('frontera de la API: Gemini se retiró; un cliente (o un registro antiguo) que lo pida cae en GPT Image 2.5, nunca en otro proveedor', () => {
  const out = normalizeRenderSettings({ ...DEFAULT_PARAMS, aiModel: 'Gemini 3.1 Flash Image Preview' });
  assert.equal(out.aiModel, DEFAULT_PARAMS.aiModel);
  assert.match(out.aiModel, /OpenAI/);
});
