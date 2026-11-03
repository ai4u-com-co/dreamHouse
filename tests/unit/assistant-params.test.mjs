import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeAssistantParams } from '@/lib/assistant-params';
import { PROJECT_TYPES, SIZES, MATERIALS } from '@/modules/exterior/constants';

test('descarta campos bloqueados: el asistente no puede cambiar el modo, el modelo ni la calidad', () => {
  const { params, dropped } = sanitizeAssistantParams({ mode: 'edit', aiModel: 'x', renderQuality: 'Máxima', sourceRender: {}, mood: 'inventado' });
  assert.equal(params.mode, undefined);
  assert.equal(params.aiModel, undefined);
  assert.equal(params.renderQuality, undefined);
  assert.ok(dropped.includes('mode') && dropped.includes('aiModel'));
});

test('descarta claves que no existen', () => {
  const { params, dropped } = sanitizeAssistantParams({ campoInventado: 'x' });
  assert.deepEqual(params, {});
  assert.deepEqual(dropped, ['campoInventado']);
});

test('conserva valores válidos y descarta los que el formulario no ofrece', () => {
  const { params, dropped } = sanitizeAssistantParams({ projectType: PROJECT_TYPES[0], climate: 'Clima de Marte' });
  assert.equal(params.projectType, PROJECT_TYPES[0]);
  assert.equal(params.climate, undefined);
  assert.ok(dropped.some((d) => d.includes('Clima de Marte')));
});

test('los tipos se corrigen: número como texto, texto como lista', () => {
  const { params } = sanitizeAssistantParams({ levels: '3', materials: MATERIALS[0] });
  assert.equal(params.levels, 3);
  assert.deepEqual(params.materials, [MATERIALS[0]]);
});

test('números inválidos o negativos se descartan', () => {
  assert.deepEqual(sanitizeAssistantParams({ levels: -2 }).params, {});
  assert.deepEqual(sanitizeAssistantParams({ levels: 'muchos' }).params, {});
});

test('size acepta metros cuadrados o una etiqueta conocida, no texto libre', () => {
  assert.equal(sanitizeAssistantParams({ size: 120 }).params.size, '120');
  assert.equal(sanitizeAssistantParams({ size: SIZES[0] }).params.size, SIZES[0]);
  assert.equal(sanitizeAssistantParams({ size: 'enorme' }).params.size, undefined);
});

test('respeta el máximo de estilos y arquitectos', () => {
  const { params } = sanitizeAssistantParams({ architecturalStyles: ['Minimalista', 'Brutalista', 'Moderno', 'Industrial', 'Rústico'] });
  assert.ok((params.architecturalStyles ?? []).length <= 3);
});

test('una respuesta que no es un objeto devuelve vacío sin romper', () => {
  for (const bad of [null, undefined, 'texto', 42, [1, 2]]) {
    assert.deepEqual(sanitizeAssistantParams(bad).params, {});
  }
});
