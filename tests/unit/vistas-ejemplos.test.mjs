// Vistas: ejemplo visual de cada vista y cableado de sus prompts con la foto. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { DEFAULT_PARAMS } from '@/types';
import { ARCHITECTURAL_VISTAS, VISTA_EXAMPLES, VISTA_KINDS } from '@/modules/vistas/constants';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';

const OPENAI = 'GPT Image 2.5 Sunburst (OpenAI)';
const base = { ...DEFAULT_PARAMS, mode: 'vistas', aiModel: OPENAI };
// Render de origen con luz de día: es lo normal (casi todos los renders se generan de día)
const conOrigen = { ...base, sourceRender: { id: 'r1', params: { lighting: 'Golden hour cálida', timeOfDay: 'Mañana', levels: 1 } } };

test('cada vista tiene su ejemplo visual y el archivo existe y es liviano', () => {
  for (const v of ARCHITECTURAL_VISTAS) {
    const src = VISTA_EXAMPLES[v];
    assert.ok(src, `falta el ejemplo de "${v}"`);
    assert.match(src, /^\/vistas-ejemplos\/[a-z0-9-]+\.webp$/, `ruta rara para "${v}": ${src}`);
    const file = `public${src}`;
    assert.ok(existsSync(file), `no existe ${file}`);
    assert.ok(statSync(file).size < 120 * 1024, `${file} pesa demasiado para una miniatura`);
  }
  assert.equal(new Set(Object.values(VISTA_EXAMPLES)).size, ARCHITECTURAL_VISTAS.length, 'dos vistas comparten ejemplo');
});

test('el formulario muestra el ejemplo de cada vista antes de generar', () => {
  const form = readFileSync('src/modules/vistas/components/VistasForm.tsx', 'utf8');
  assert.match(form, /VISTA_EXAMPLES\[/, 'VistasForm no usa VISTA_EXAMPLES');
  assert.match(form, /<img|<Image/, 'VistasForm no pinta la imagen del ejemplo');
});

test('crepuscular y nocturna NO heredan la luz del render original ni piden "conservar la luz de la referencia"', () => {
  for (const v of ['Vista Nocturna', 'Vista Crepuscular (Blue Hour)']) {
    for (const params of [base, conOrigen]) {
      const p = buildVistasPrompt(params, v, OPENAI);
      assert.doesNotMatch(p, /preserve its shadow direction/i, `"${v}" pide conservar la luz de la referencia`);
      assert.doesNotMatch(p, /Golden hour/i, `"${v}" arrastra la luz de día del render original`);
      assert.match(p, /LIGHTING:[\s\S]*- Lighting: [^\n]*(night|twilight|blue)/i, `"${v}" no dice cuál es su luz`);
    }
  }
});

test('las vistas de día siguen conservando la luz de la referencia', () => {
  const p = buildVistasPrompt(base, 'Perspectiva Principal (Hero Shot)', OPENAI);
  assert.match(p, /preserve its shadow direction/i);
});

test('isométrica y representaciones técnicas no se piden como foto con lente', () => {
  const tecnicas = ARCHITECTURAL_VISTAS.filter((v) => VISTA_KINDS[v] === 'diagram').concat('Vista Isométrica');
  assert.ok(tecnicas.length >= 3);
  for (const v of tecnicas) {
    const p = buildVistasPrompt({ ...base, magazinePhoto: true }, v, OPENAI);
    assert.doesNotMatch(p, /\blens\b|shot on |tilt-shift|level horizon/i, `"${v}" lleva instrucciones de cámara fotográfica`);
    assert.doesNotMatch(p, /Real textures, pores/i, `"${v}" se pide como fotografía con poros`);
  }
});

test('las vistas fotográficas conservan cámara y fotografía de revista', () => {
  const p = buildVistasPrompt({ ...base, magazinePhoto: true }, 'Perspectiva Principal (Hero Shot)', OPENAI);
  assert.match(p, /Camera Setting: shot on /);
  assert.match(p, /tilt-shift/i);
});

test('el servidor rechaza una vista sin foto de la casa, antes de cobrar', () => {
  const route = readFileSync('src/app/api/generate/route.ts', 'utf8');
  const guard = route.indexOf("params.mode === 'vistas' && !lotImage");
  assert.ok(guard > 0, 'no hay guardia de foto obligatoria para vistas');
  assert.ok(guard < route.indexOf('await charge('), 'la guardia debe ir antes del cobro');
});
