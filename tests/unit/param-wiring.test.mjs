// Contrato del registro de parámetros por módulo (src/modules/shared/param-modes.ts).
// Si un parámetro aplica a un módulo, ese módulo debe poder EDITARLO y debe USARLO en el prompt.
// Esta prueba habría detectado: `projectType` sin control en interior, `humanContext` y `parkingSpots`
// sin control en ningún módulo, y los datos de sitio/luz que el prompt interior ignoraba.
// Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEFAULT_PARAMS } from '@/types';
import { PARAM_MODES, editableParams, modesFor } from '@/modules/shared/param-modes';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildEditPrompt } from '@/modules/edit/lib/prompt-builder';

const OPENAI = 'GPT Image 2.5 Sunburst (OpenAI)';
const GEMINI = 'Gemini 3.1 Flash Image Preview';
const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

// Un valor de muestra válido por parámetro (los tipos de arreglo/número/cadena de DEFAULT_PARAMS)
const SAMPLE = {
  projectType: 'Casa de playa', architecturalStyles: ['Brutalista'], architect: ['Tadao Ando'], mood: 'Sereno',
  city: 'Cartagena', climate: 'Tropical', environment: 'Costa', waterBody: 'Lago', weatherCondition: 'Niebla',
  timeOfDay: 'Hora dorada', season: 'Invierno', lighting: 'Difusa',
  materials: ['Acero'], finishLevel: 'Lujo/Premium', colorPalette: ['Blanco'],
  cameraAngle: 'Nivel de ojos', composition: 'Simétrica', humanContext: 'Familia disfrutando',
  bedrooms: 3, bathrooms: 2,
  size: '250', levels: 3, roofType: 'Cubierta verde', layoutType: 'Open plan', architecturalDetails: ['Voladizos'],
  exteriorElements: ['Pérgola'], vegetation: ['Palmas'], parkingType: 'Garaje cerrado (2+ autos)', parkingSpots: 4,
  socialAreas: ['Piscina'],
  roomType: 'Cocina gourmet', roomSizeM2: 28, furnitureStyle: ['Escandinavo'], interiorLighting: ['Iluminación indirecta (Cove lighting)'],
  flooringMaterial: 'Roble', ceilingDetail: 'Vigas de madera', kitchenType: 'Isla central', livingAreaType: 'Doble altura',
  editChangeType: 'Cambiar el color', editIntensity: 'Radical (transformación total)', editPreserve: ['Perspectiva y encuadre'],
};

// Algunos campos solo se expresan junto a otro (p. ej. las plazas, si hay estacionamiento)
const NEEDS = { parkingSpots: { parkingType: 'Garaje cerrado (2+ autos)' } };

const BUILDERS = {
  exterior: (params, model) => buildExteriorPrompt(params, false, model),
  interior: (params, model) => buildInteriorPrompt(params, model),
  edit: (params) => buildEditPrompt(params),
};

test('el registro y la prueba están al día: todo parámetro registrado tiene valor de muestra', () => {
  for (const key of Object.keys(PARAM_MODES)) {
    assert.ok(key in SAMPLE, `Falta un valor de muestra para "${key}" en tests/unit/param-wiring.test.mjs`);
    assert.ok(key in DEFAULT_PARAMS, `"${key}" está en el registro pero no existe en DEFAULT_PARAMS`);
  }
});

for (const mode of ['exterior', 'interior', 'edit']) {
  for (const key of editableParams(mode)) {
    test(`${mode}: "${key}" llega al prompt (OpenAI y Gemini)`, () => {
      // Línea base con materiales para que `finishLevel` también se exprese en exterior
      const base = { ...DEFAULT_PARAMS, mode, materials: ['Madera'], ...NEEDS[key] };
      for (const model of [OPENAI, GEMINI]) {
        const before = BUILDERS[mode](base, model);
        const after = BUILDERS[mode]({ ...base, [key]: SAMPLE[key] }, model);
        assert.notEqual(after, before, `${mode}/${model}: cambiar "${key}" no cambia el prompt: el parámetro no está cableado`);
      }
    });
  }
}

// ── Cada parámetro del módulo tiene un control en su formulario ──
const FORMS = {
  exterior: 'src/modules/exterior/components/ExteriorForm.tsx',
  interior: 'src/modules/interior/components/InteriorForm.tsx',
  edit: 'src/modules/edit/components/EditForm.tsx',
};
const SHARED_FILES = ['src/components/FormFields.tsx', 'src/components/FormExtras.tsx'];
const SHARED_COMPONENTS = ['ChipsField', 'EssenceFields', 'SiteFields', 'HomeProgramFields', 'AmbienceSelects', 'OutputOptions'];

/** Cuerpo de un componente compartido (desde `export function Name` hasta el siguiente `\nexport` o el fin) */
function componentBody(name) {
  for (const file of SHARED_FILES) {
    const src = read(file);
    const start = src.indexOf(`export function ${name}(`);
    if (start === -1) continue;
    const next = src.indexOf('\nexport ', start + 1);
    return src.slice(start, next === -1 ? undefined : next);
  }
  return '';
}

/** Todo el código que puede crear un control en un formulario: el propio y los componentes compartidos que usa */
function controlSource(mode) {
  const form = read(FORMS[mode]);
  let source = form;
  for (const name of SHARED_COMPONENTS) {
    if (!new RegExp(`<${name}\\b`).test(form)) continue;
    let body = componentBody(name);
    // El control de "Personas" solo existe si el formulario pide `people`
    if (name === 'AmbienceSelects' && !/<AmbienceSelects[^>]*\bpeople\b/.test(form)) body = body.replaceAll('humanContext', '');
    source += `\n${body}`;
  }
  return source;
}

for (const mode of ['exterior', 'interior', 'edit']) {
  test(`${mode}: todo parámetro que aplica tiene un control en el formulario`, () => {
    const source = controlSource(mode);
    const missing = editableParams(mode).filter((key) => !new RegExp(`['"]${key}['"]`).test(source));
    assert.deepEqual(missing, [], `Parámetros de ${mode} sin control en pantalla: ${missing.join(', ')}`);
  });
}

// ── El panel "Design Spec" no mantiene listas propias de aplicabilidad ──
test('PromptPreview toma la aplicabilidad de los parámetros del registro (sin listas duplicadas)', () => {
  const source = read('src/components/PromptPreview.tsx');
  const dupes = [];
  for (const line of source.split('\n')) {
    const key = /key: '([a-zA-Z0-9]+)'/.exec(line)?.[1];
    if (key && modesFor(key).length && /\bmodes:/.test(line)) dupes.push(key);
  }
  assert.deepEqual(dupes, [], `Estos parámetros declaran modes en PromptPreview además del registro: ${dupes.join(', ')}`);
});

test('la esencia del proyecto es compartida: tipo, mood, estilo y arquitecto aplican a exterior, interior y vistas', () => {
  for (const key of ['projectType', 'mood', 'architecturalStyles', 'architect']) {
    for (const mode of ['exterior', 'interior', 'vistas']) {
      assert.ok(modesFor(key).includes(mode), `"${key}" debería aplicar a ${mode}`);
    }
  }
});

// ── Remodelación de un espacio existente: estilos y maestros también mandan ──
for (const model of [OPENAI, GEMINI]) {
  test(`interior con foto del espacio actual (remodelación): estilo y maestro llegan al prompt (${model})`, () => {
    const params = { ...DEFAULT_PARAMS, mode: 'interior', architecturalStyles: ['Japandi'], architect: ['Tadao Ando'] };
    const text = buildInteriorPrompt(params, model, true);
    assert.match(text, /Japandi/, 'el estilo elegido debe aparecer');
    assert.match(text, /Tadao Ando/, 'el maestro elegido debe aparecer');
    // Con foto, el texto de remodelación los aplica de forma explícita al rediseño
    assert.match(text, /apply[^.]*Japandi[^.]*Tadao Ando|Japandi[^.]*Tadao Ando[^.]*redesign/is, 'la instrucción de remodelación debe vincular estilo y maestro');
  });
}

// ── Edición: los parámetros son opcionales y solo orientan la zona editada ──
test('edición sin parámetros: el prompt es exactamente la instrucción histórica', () => {
  const params = { ...DEFAULT_PARAMS, mode: 'edit', editPrompt: 'Make the tree smaller' };
  assert.equal(
    buildEditPrompt(params),
    '[INTENDED USE: Photorealistic architectural image edit]\n\nEDIT INSTRUCTION — change ONLY what is described here, nothing else:\nMake the tree smaller',
  );
});

test('edición: el tipo de espacio, el maestro y lo que se conserva llegan al prompt y se acotan a la zona editada', () => {
  const params = {
    ...DEFAULT_PARAMS, mode: 'edit', editPrompt: 'Replace the sofa',
    roomType: 'Sala de estar/Living room', architect: ['Tadao Ando'], editPreserve: ['Perspectiva y encuadre', 'Aberturas (puertas y ventanas)'],
  };
  const text = buildEditPrompt(params);
  assert.match(text, /living room/i);
  assert.match(text, /Tadao Ando/);
  assert.match(text, /EDITED AREA ONLY/);
  assert.match(text, /perspective, framing and camera viewpoint and the doors and windows/);
});
