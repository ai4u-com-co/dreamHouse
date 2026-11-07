// Pruebas de los constructores de prompt. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '@/types';
import { PROJECT_TYPES } from '@/modules/exterior/constants';
import { buildExteriorPrompt, PROJECT_TYPE_MAP } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildVistasPrompt, effectiveVistaParams } from '@/modules/vistas/lib/prompt-builder';
import { buildPlantaPrompt, FLOOR_PLAN_STYLE_MAP, ZONING_LAYOUT_MAP } from '@/modules/planta/lib/prompt-builder';
import { FLOOR_PLAN_STYLES, ZONING_LAYOUTS } from '@/modules/planta/constants';
import { ARCHITECTURAL_VISTAS, VISTA_DESCRIPTIONS, VISTA_KINDS } from '@/modules/vistas/constants';

const OPENAI = 'GPT Image 2.5 Sunburst (OpenAI)';
const GEMINI = 'Gemini 3.1 Flash Image Preview';
const p = (over = {}) => ({ ...DEFAULT_PARAMS, ...over });

// Señales de un hueco en el prompt: valor vacío interpolado
const HOLES = [/undefined/, /\bnull\b/, /NaN/, /\(\)/, /during ,/, /with {2}/, /carries a {2}/, /standard\b.*\bstandard/s, /floor is {2}/, /: \.\s/, / ,/];
function assertNoHoles(text, label) {
  for (const hole of HOLES) assert.ok(!hole.test(text), `${label}: hueco ${hole} en el prompt:\n${text.slice(0, 900)}`);
}

test('todos los tipos de proyecto tienen traducción al inglés', () => {
  const missing = PROJECT_TYPES.filter((t) => !PROJECT_TYPE_MAP[t]);
  assert.deepEqual(missing, []);
  assert.ok(PROJECT_TYPES.includes('Tiny house'));
});

test('con los parámetros por defecto ningún prompt tiene huecos (todos los modos y proveedores)', () => {
  for (const model of [OPENAI, GEMINI]) {
    assertNoHoles(buildPlantaPrompt(p({ aiModel: model, mode: 'planta' }), model), `planta/${model}`);
    assertNoHoles(buildExteriorPrompt(p({ aiModel: model }), false, model), `exterior/${model}`);
    assertNoHoles(buildInteriorPrompt(p({ aiModel: model }), model), `interior/${model}`);
    for (const view of ARCHITECTURAL_VISTAS) {
      assertNoHoles(buildVistasPrompt(p({ aiModel: model }), view, model), `vistas/${view}/${model}`);
    }
  }
});

test('planta: todos los estilos de plano y criterios de zonificación tienen descripción en inglés', () => {
  for (const s of FLOOR_PLAN_STYLES) assert.ok(FLOOR_PLAN_STYLE_MAP[s], `sin descripción en FLOOR_PLAN_STYLE_MAP: ${s}`);
  for (const z of ZONING_LAYOUTS) assert.ok(ZONING_LAYOUT_MAP[z], `sin descripción en ZONING_LAYOUT_MAP: ${z}`);
});

test('planta: cuando se selecciona zona sobre el lote (hasLotZone), el prompt indica adaptar la planta al polígono marcado', () => {
  for (const model of [OPENAI, GEMINI]) {
    const out = buildPlantaPrompt(p({ mode: 'planta', hasLotZone: true, aiModel: model }), model, true);
    assert.match(out, /highlighted polygon zone marked on the terrain image/);
  }
});

test('exterior: cuando se adjunta foto de la planta (hasFloorPlanReference), el prompt impone render exterior puro sin detalles internos y forma exterior general de referencia', () => {
  for (const model of [OPENAI, GEMINI]) {
    const out = buildExteriorPrompt(p({ mode: 'exterior', aiModel: model }), false, model, true);
    assert.match(out, /HARD CONSTRAINT/);
    assert.match(out, /EXTERIOR/i);
    assert.match(out, /furniture|room layouts|cutaway/i);
    assert.match(out, /1:1/);
    assert.match(out, /PROMPT/i);
  }
});

test('con materiales pero sin nivel de acabado no queda "finished to a  standard"', () => {
  for (const model of [OPENAI, GEMINI]) {
    const out = buildExteriorPrompt(p({ materials: ['Madera'], finishLevel: '' }), false, model);
    assert.ok(!/finished to a\s+standard/.test(out), out);
    assert.match(out, /Madera/);
  }
});

test('levels = 0 no se convierte en "exactamente 0 pisos"', () => {
  for (const model of [OPENAI, GEMINI]) {
    assert.ok(!/0 floors/.test(buildExteriorPrompt(p({ levels: 0 }), false, model)));
  }
  assert.match(buildExteriorPrompt(p({ levels: 2 }), false, OPENAI), /exactly 2 floors/);
});

const EXTERIOR_FIELDS = {
  climate: ['Tropical', /Tropical/],
  waterBody: ['Lago', /Lago/],
  weatherCondition: ['Niebla', /Niebla/],
  roofType: ['Cubierta verde', /Cubierta verde/],
  parkingType: ['Garaje cerrado (2+ autos)', /Garaje cerrado/],
  socialAreas: [['Piscina', 'Deck'], /Piscina/],
  exteriorElements: [['Pérgola'], /Pérgola/],
  vegetation: [['Palmas'], /Palmas/],
  architecturalDetails: [['Voladizos'], /Voladizos/],
  mood: ['Sereno', /Sereno/],
};
for (const [field, [value, expected]] of Object.entries(EXTERIOR_FIELDS)) {
  test(`exterior: el campo "${field}" que elige el usuario llega al prompt (OpenAI y Gemini)`, () => {
    for (const model of [OPENAI, GEMINI]) {
      assert.match(buildExteriorPrompt(p({ [field]: value }), false, model), expected, `${field}/${model}`);
    }
  });
}

const INTERIOR_FIELDS = {
  kitchenType: ['Isla central', /Isla central/],
  livingAreaType: ['Doble altura', /Doble altura/],
  bedrooms: [3, /3 bedrooms/],
  bathrooms: [2, /2 bathrooms/],
  finishLevel: ['Lujo/Premium', /Lujo\/Premium/],
  mood: ['Cálido', /Cálido/],
};
for (const [field, [value, expected]] of Object.entries(INTERIOR_FIELDS)) {
  test(`interior: el campo "${field}" que elige el usuario llega al prompt (OpenAI y Gemini)`, () => {
    for (const model of [OPENAI, GEMINI]) {
      assert.match(buildInteriorPrompt(p({ [field]: value }), model), expected, `${field}/${model}`);
    }
  });
}

test('interior: la foto del espacio actual se menciona cuando existe', () => {
  for (const model of [OPENAI, GEMINI]) {
    assert.match(buildInteriorPrompt(p(), model, true), /existing space|reference photo/i);
    assert.ok(!/existing space shown/i.test(buildInteriorPrompt(p(), model, false)));
  }
});

test('un estilo no fotográfico no habla de fotografía ni de cámara', () => {
  for (const model of [OPENAI, GEMINI]) {
    for (const builder of [
      (par) => buildExteriorPrompt(par, false, model),
      (par) => buildInteriorPrompt(par, model),
      (par) => buildVistasPrompt(par, 'Perspectiva Principal (Hero Shot)', model),
    ]) {
      const out = builder(p({ renderStyle: 'Acuarela arquitectónica', cameraPreset: 'Sony A7R V', focalLength: '35mm' }));
      assert.match(out, /watercolor/i);
      assert.ok(!/photograph(?!y)/i.test(out.replace(/photographic/gi, '')) || /watercolor/i.test(out), out);
      assert.ok(!/Sony A7R V/.test(out), 'no debe citar la cámara en una acuarela');
    }
  }
});

test('sin estilo elegido se mantiene el look fotorrealista histórico', () => {
  assert.match(buildExteriorPrompt(p(), false, OPENAI), /Photorealistic/);
  assert.match(buildExteriorPrompt(p(), false, GEMINI), /architectural photograph/);
});

// ---------- vistas ----------

// Valores reales de los catálogos: el servidor descarta cualquier valor que el formulario no ofrezca
const SOURCE = {
  id: 'render-1',
  mode: 'exterior',
  params: {
    projectType: 'Tiny house', levels: 1, materials: ['Madera', 'Concreto'], finishLevel: 'Premium/Alto',
    architecturalStyles: ['Minimalista'], roofType: 'A cuatro aguas', environment: 'Bosque',
    timeOfDay: 'Amanecer (Golden Hour)', season: 'Otoño', lighting: 'Ambiental difusa',
  },
};

test('vistas: lo que el usuario dejó vacío se hereda del render original', () => {
  const eff = effectiveVistaParams(p({ sourceRender: SOURCE }));
  assert.deepEqual(eff.materials, ['Madera', 'Concreto']);
  assert.equal(eff.levels, 1);
  assert.equal(eff.roofType, 'A cuatro aguas');
});

test('vistas: lo que el usuario eligió manda sobre el render original', () => {
  const eff = effectiveVistaParams(p({ sourceRender: SOURCE, materials: ['Acero'] }));
  assert.deepEqual(eff.materials, ['Acero']);
});

test('vistas: los hechos de diseño del render original llegan al prompt', () => {
  for (const model of [OPENAI, GEMINI]) {
    const out = buildVistasPrompt(p({ sourceRender: SOURCE }), 'Perspectiva Principal (Hero Shot)', model);
    assert.match(out, /tiny house/i);
    assert.match(out, /Exactly 1 floor/);
    assert.match(out, /Madera/);
    assert.match(out, /A cuatro aguas/);
    assert.match(out, /Amanecer \(Golden Hour\)/, 'continuidad de la hora entre vistas');
  }
});

test('vistas: sin render de origen no se inventan hechos de diseño', () => {
  const out = buildVistasPrompt(p(), 'Perspectiva Principal (Hero Shot)', OPENAI);
  assert.ok(!/DESIGN FACTS/.test(out));
});

test('vistas: las que muestran lo que NO se ve piden extrapolar con cuidado', () => {
  for (const view of ['Fachada Posterior', 'Vista Aérea (Drone)', 'Vista de Cubierta']) {
    assert.match(buildVistasPrompt(p(), view, OPENAI), /NOT visible/);
  }
  assert.ok(!/NOT visible/.test(buildVistasPrompt(p(), 'Perspectiva Principal (Hero Shot)', OPENAI)));
});

test('vistas: las de iluminación no heredan la hora del render original', () => {
  const out = buildVistasPrompt(p({ sourceRender: SOURCE }), 'Vista Nocturna', OPENAI);
  assert.ok(!/Time of day: Amanecer/.test(out));
  assert.match(out, /Only the time of day and the lighting change/);
});

test('vistas: todas tienen descripción y clasificación', () => {
  for (const view of ARCHITECTURAL_VISTAS) {
    assert.ok(VISTA_DESCRIPTIONS[view], `sin descripción: ${view}`);
    assert.ok(VISTA_KINDS[view], `sin clasificación: ${view}`);
  }
});
