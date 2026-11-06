// Las vistas básicas vienen preseleccionadas al entrar al módulo. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PARAMS } from '@/types';
import { ARCHITECTURAL_VISTAS, DEFAULT_VISTAS, VISTA_DESCRIPTIONS, VISTA_KINDS, VISTA_SHORT_DESC } from '@/modules/vistas/constants';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';

const OPENAI = 'GPT Image 2.5 Sunburst (OpenAI)';

test('al entrar a Vistas ya están marcadas las básicas: principal, frontal, aérea e isométrica', () => {
  assert.deepEqual(DEFAULT_PARAMS.selectedVistas, [
    'Perspectiva Principal (Hero Shot)', 'Fachada Frontal (Elevación)', 'Vista Aérea (Drone)', 'Vista Isométrica',
  ]);
});

test('las básicas son vistas reales y completas (descripción, etiqueta y tipo)', () => {
  for (const v of DEFAULT_VISTAS) {
    assert.ok(ARCHITECTURAL_VISTAS.includes(v), `"${v}" no está en la lista de vistas`);
  }
  for (const v of ARCHITECTURAL_VISTAS) {
    assert.ok(VISTA_DESCRIPTIONS[v], `falta la descripción de "${v}"`);
    assert.ok(VISTA_SHORT_DESC[v], `falta la etiqueta de "${v}"`);
    assert.ok(VISTA_KINDS[v], `falta el tipo de "${v}"`);
  }
  assert.equal(new Set(ARCHITECTURAL_VISTAS).size, ARCHITECTURAL_VISTAS.length, 'hay vistas repetidas');
});

test('el estado de fábrica es una copia: marcar o quitar vistas no altera las básicas', () => {
  assert.notEqual(DEFAULT_PARAMS.selectedVistas, DEFAULT_VISTAS);
  const copy = [...DEFAULT_PARAMS.selectedVistas];
  copy.push('Vista Nocturna');
  assert.equal(DEFAULT_VISTAS.length, 4);
});

test('la vista isométrica pide una isométrica verdadera de toda la casa y conserva la identidad', () => {
  const text = buildVistasPrompt({ ...DEFAULT_PARAMS, mode: 'vistas' }, 'Vista Isométrica', OPENAI);
  assert.match(text, /true isometric view of the whole building/);
  assert.match(text, /no perspective convergence/);
  assert.match(text, /IDENTITY LOCK/);
  // Es distinta de la explotada (esa separa los pisos)
  const exploded = buildVistasPrompt({ ...DEFAULT_PARAMS, mode: 'vistas' }, 'Isométrica Explotada', OPENAI);
  assert.notEqual(text, exploded);
});

test('el formulario avisa de las básicas y permite restablecerlas', () => {
  const form = readFileSync(new URL('../../src/modules/vistas/components/VistasForm.tsx', import.meta.url), 'utf8');
  assert.match(form, /Restablecer básicas/);
  assert.match(form, /DEFAULT_VISTAS/);
});
