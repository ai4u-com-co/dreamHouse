// La dirección creativa es la instrucción de mayor autoridad: va completa, al final, con prioridad máxima,
// y gana sobre cualquier parámetro o regla por defecto. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PARAMS } from '@/types';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';
import { buildPlantaPrompt } from '@/modules/planta/lib/prompt-builder';

const OPENAI = 'GPT Image 2.5 Sunburst (OpenAI)';
const GEMINI = 'Gemini 3.1 Flash Image Preview';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const CREATIVE = 'Atardecer con neblina baja y SIN ningún vecino; que se sienta como una fotografía de revista de 1970';

const BUILDERS = {
  planta: (p, m) => buildPlantaPrompt(p, m),
  exterior: (p, m) => buildExteriorPrompt(p, false, m),
  interior: (p, m) => buildInteriorPrompt(p, m),
  vistas: (p, m) => buildVistasPrompt(p, 'Perspectiva Principal (Hero Shot)', m),
};

for (const mode of ['planta', 'exterior', 'interior', 'vistas']) {
  for (const model of [OPENAI, GEMINI]) {
    const tag = `${mode}/${model.split(' ')[0]}`;
    test(`${tag}: la dirección creativa va completa, al final y con prioridad máxima`, () => {
      const text = BUILDERS[mode]({ ...DEFAULT_PARAMS, mode, materials: ['Madera'], artDirection: CREATIVE }, model);
      assert.ok(text.includes(CREATIVE), 'el texto del cliente debe aparecer completo y sin alterar');
      assert.match(text, /HIGHEST PRIORITY/);
      assert.match(text, /THIS DIRECTION WINS/);
      assert.ok(text.indexOf(CREATIVE) > text.length * 0.6, 'debe ir hacia el final del prompt (lo último que el modelo lee)');
      assert.match(text.slice(0, 400), /CREATIVE DIRECTION[\s\S]*overrides/, 'el inicio avisa de que existe y manda');
      assert.equal(text.split(CREATIVE).length - 1, 1, 'el texto no debe repetirse');
    });
    test(`${tag}: sin dirección creativa no hay bloque de prioridad`, () => {
      const text = BUILDERS[mode]({ ...DEFAULT_PARAMS, mode, materials: ['Madera'], artDirection: '   ' }, model);
      assert.doesNotMatch(text, /CREATIVE DIRECTION/);
    });
  }
}

test('vistas: la dirección creativa manda en todo salvo la identidad de la casa', () => {
  const text = BUILDERS.vistas({ ...DEFAULT_PARAMS, mode: 'vistas', artDirection: CREATIVE }, OPENAI);
  assert.match(text, /identity of the house in the reference image/);
});

test('exterior: la regla de «sin vecinos» cede ante la dirección creativa', () => {
  const text = buildExteriorPrompt({ ...DEFAULT_PARAMS, mode: 'exterior', artDirection: 'con vecinos y calle viva' }, false, OPENAI);
  assert.match(text, /unless the CREATIVE DIRECTION asks otherwise/);
});

test('la dirección creativa se ofrece en planta, exterior, interior y vistas', () => {
  for (const f of ['src/modules/planta/components/PlantaForm.tsx', 'src/modules/exterior/components/ExteriorForm.tsx', 'src/modules/interior/components/InteriorForm.tsx', 'src/modules/vistas/components/VistasForm.tsx']) {
    const tag = read(f).match(/<CreativeFields[^>]*>/)?.[0] ?? '';
    assert.ok(tag, `${f} debe pintar CreativeFields`);
    assert.doesNotMatch(tag, /artDirection=\{false\}/, `${f} debe ofrecer la dirección creativa`);
  }
});

test('el servidor le da prioridad a la dirección creativa sobre los mandatos por defecto', () => {
  assert.match(read('src/app/api/generate/route.ts'), /CREATIVE DIRECTION in the brief above has the highest priority/);
});
