// Preset «Fotografía de revista»: cámara de arquitecto + instrucciones editoriales. Apagado por defecto; el predeterminado de calidad sigue en low.
// Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '@/types';
import * as SC from '@/modules/shared/constants';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';
import { sanitizeAssistantParams, sanitizeSourceParams } from '@/lib/assistant-params';
import { quoteRender } from '@/lib/render-options';

const OPENAI = SC.AI_MODELS[0];
const MARK = 'ARCHITECTURAL MAGAZINE PHOTOGRAPHY';
const on = (over = {}) => ({ ...DEFAULT_PARAMS, ...SC.applyMagazinePreset('exterior'), ...over });

test('predeterminados: el preset está apagado y la calidad sigue en Borrador (low)', () => {
  assert.equal(DEFAULT_PARAMS.magazinePhoto, false);
  assert.equal(DEFAULT_PARAMS.renderQuality, 'Borrador');
  const q = quoteRender({ ...DEFAULT_PARAMS, mode: 'exterior' }, { inputImagePixels: [], estimate: true });
  assert.ok(q.ok);
  assert.equal(q.value.options.quality, 'low');
  assert.equal(DEFAULT_PARAMS.aiModel, SC.AI_MODELS[0], 'y el modelo, 2.5 Sunburst');
});

test('el preset usa valores que existen en los selectores (si no, el selector quedaría en blanco)', () => {
  for (const scene of ['exterior', 'interior', 'vistas']) {
    const p = SC.applyMagazinePreset(scene);
    assert.ok(SC.CAMERA_PRESET_NAMES.includes(p.cameraPreset), `${scene}: cámara`);
    assert.ok(SC.FOCAL_LENGTHS.includes(p.focalLength), `${scene}: focal`);
    assert.ok(SC.APERTURES.includes(p.aperture), `${scene}: apertura`);
    assert.ok(SC.filmLooksFor(p.cameraPreset).includes(p.filmSimulation), `${scene}: look de película de esa cámara`);
    assert.ok(SC.DEPTH_OF_FIELD_OPTIONS.includes(p.depthOfField), `${scene}: profundidad`);
    assert.equal(p.magazinePhoto, true);
  }
  const ext = SC.applyMagazinePreset('exterior');
  assert.ok(SC.TIMES_OF_DAY.includes(ext.timeOfDay) && SC.LIGHTING_TYPES.includes(ext.lighting));
  assert.equal(SC.applyMagazinePreset('vistas').timeOfDay, undefined, 'las vistas siguen la luz de la casa original');
  assert.equal(SC.applyMagazinePreset('interior').timeOfDay, undefined);
});

test('apagar el preset devuelve a fábrica solo lo que sigue como lo dejó el preset', () => {
  const encendido = on();
  const apagado = { ...encendido, ...SC.revertMagazinePreset('exterior', encendido) };
  for (const k of ['cameraPreset', 'focalLength', 'aperture', 'filmSimulation', 'timeOfDay', 'lighting']) assert.equal(apagado[k], DEFAULT_PARAMS[k], k);
  assert.equal(apagado.magazinePhoto, false);
  // lo que la persona cambió a mano después se respeta
  const editado = on({ focalLength: '50mm', timeOfDay: 'Mañana' });
  const r = SC.revertMagazinePreset('exterior', editado);
  assert.equal(r.focalLength, undefined, 'la focal que eligió la persona no se pisa');
  assert.equal(r.timeOfDay, undefined);
  assert.equal(r.magazinePhoto, false);
});

test('el bloque editorial llega al prompt solo si el preset está encendido y el estilo es fotográfico', () => {
  assert.ok(buildExteriorPrompt(on(), false, OPENAI).includes(MARK));
  assert.ok(buildInteriorPrompt({ ...on(), mode: 'interior' }, OPENAI).includes(MARK));
  assert.ok(buildVistasPrompt({ ...on(), mode: 'vistas' }, 'Perspectiva Principal (Hero Shot)', OPENAI).includes(MARK));
  assert.ok(!buildExteriorPrompt({ ...DEFAULT_PARAMS }, false, OPENAI).includes(MARK), 'apagado: el prompt histórico no cambia');
  assert.ok(buildExteriorPrompt(on(), false, OPENAI).includes('tilt-shift correction'));
  const ilustracion = SC.RENDER_STYLES.find((s) => /Ilustraci/.test(s));
  assert.ok(!buildExteriorPrompt(on({ renderStyle: ilustracion }), false, OPENAI).includes(MARK), 'una ilustración no se fotografía');
});

test('«sin personas» solo si la persona no pidió gente, y la dirección creativa gana los conflictos', () => {
  assert.match(buildExteriorPrompt(on(), false, OPENAI), /no people/);
  assert.doesNotMatch(buildExteriorPrompt(on({ humanContext: SC.HUMAN_CONTEXT[1] }), false, OPENAI), /no people/);
  assert.match(buildExteriorPrompt(on({ artDirection: 'Atardecer con personas en la terraza' }), false, OPENAI), /the CREATIVE DIRECTION wins any conflict/);
});

test('el asistente IA no puede encender el preset; los metadatos de una imagen sí lo conservan (solo booleano)', () => {
  assert.equal('magazinePhoto' in sanitizeAssistantParams({ magazinePhoto: true }).params, false);
  assert.equal(sanitizeSourceParams({ magazinePhoto: true }).magazinePhoto, true);
  assert.equal('magazinePhoto' in sanitizeSourceParams({ magazinePhoto: 'true' }), false, 'un texto no es un booleano');
});
