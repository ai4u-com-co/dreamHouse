// Preset «Fotografía de interiorismo» (solo Interior): apagado por defecto, excluyente con «Fotografía de revista». Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PARAMS } from '@/types';
import * as SC from '@/modules/shared/constants';
import { buildInteriorPrompt } from '@/modules/interior/lib/prompt-builder';
import { buildExteriorPrompt } from '@/modules/exterior/lib/prompt-builder';
import { sanitizeAssistantParams, sanitizeSourceParams } from '@/lib/assistant-params';

const OPENAI = SC.AI_MODELS[0];
const MARK = 'INTERIOR DESIGN PHOTOGRAPHY';
const MAG = 'ARCHITECTURAL MAGAZINE PHOTOGRAPHY';
const on = (over = {}) => ({ ...DEFAULT_PARAMS, mode: 'interior', ...SC.applyInteriorPhotoPreset(), ...over });

test('predeterminados: el preset de interiorismo está apagado y calidad/modelo no cambian', () => {
  assert.equal(DEFAULT_PARAMS.interiorPhoto, false);
  assert.equal(DEFAULT_PARAMS.renderQuality, 'Borrador');
  assert.equal(DEFAULT_PARAMS.aiModel, SC.AI_MODELS[0]);
});

test('el preset usa valores que existen en los selectores de Interior (si no, el selector quedaría en blanco)', () => {
  const p = SC.applyInteriorPhotoPreset();
  assert.ok(SC.CAMERA_PRESET_NAMES.includes(p.cameraPreset));
  assert.ok(SC.FOCAL_LENGTHS.includes(p.focalLength));
  assert.ok(SC.APERTURES.includes(p.aperture));
  assert.ok(SC.filmLooksFor(p.cameraPreset).includes(p.filmSimulation));
  assert.ok(SC.DEPTH_OF_FIELD_OPTIONS.includes(p.depthOfField));
  assert.ok(SC.INTERIOR_ANGLES.includes(p.cameraAngle), 'ángulo de interior');
  assert.ok(SC.INTERIOR_COMPOSITIONS.includes(p.composition), 'composición de interior');
  assert.ok(SC.TIMES_OF_DAY.includes(p.timeOfDay));
  assert.ok(SC.INTERIOR_DAYLIGHT_TYPES.includes(p.lighting), 'luz que cabe dentro de un espacio');
  assert.equal(p.interiorPhoto, true);
});

test('es excluyente con «Fotografía de revista»: encender uno apaga el otro, en los dos sentidos', () => {
  assert.equal(SC.applyInteriorPhotoPreset().magazinePhoto, false);
  assert.equal(SC.applyMagazinePreset('interior').interiorPhoto, false);
  assert.equal(SC.applyMagazinePreset('exterior').interiorPhoto, false);
  // pasar de uno a otro deja solo uno encendido
  const conRevista = { ...DEFAULT_PARAMS, ...SC.applyMagazinePreset('interior') };
  const alInteriorismo = { ...conRevista, ...SC.applyInteriorPhotoPreset() };
  assert.deepEqual([alInteriorismo.magazinePhoto, alInteriorismo.interiorPhoto], [false, true]);
});

test('apagar devuelve a fábrica solo lo que sigue como lo dejó el preset', () => {
  const encendido = on();
  const apagado = { ...encendido, ...SC.revertInteriorPhotoPreset(encendido) };
  for (const k of Object.keys(SC.INTERIOR_PHOTO_PRESET)) assert.equal(apagado[k], DEFAULT_PARAMS[k], k);
  assert.equal(apagado.interiorPhoto, false);
  const editado = on({ cameraAngle: 'Nivel de ojos', timeOfDay: 'Mediodía' });
  const r = SC.revertInteriorPhotoPreset(editado);
  assert.equal(r.cameraAngle, undefined, 'lo que la persona eligió a mano no se pisa');
  assert.equal(r.timeOfDay, undefined);
  assert.equal(r.interiorPhoto, false);
});

test('el bloque de interiorismo llega al prompt solo en Interior, encendido y con estilo fotográfico', () => {
  const p = buildInteriorPrompt(on(), OPENAI);
  assert.ok(p.includes(MARK));
  assert.match(p, /Curated styling/);
  assert.match(p, /Layered light/);
  assert.ok(!buildInteriorPrompt({ ...DEFAULT_PARAMS, mode: 'interior' }, OPENAI).includes(MARK), 'apagado: el prompt histórico no cambia');
  assert.ok(!buildExteriorPrompt({ ...DEFAULT_PARAMS, interiorPhoto: true }, false, OPENAI).includes(MARK), 'un exterior nunca lo recibe');
  const ilustracion = SC.RENDER_STYLES.find((s) => /Ilustraci/.test(s));
  assert.ok(!buildInteriorPrompt(on({ renderStyle: ilustracion }), OPENAI).includes(MARK), 'una ilustración no se fotografía');
});

test('nunca salen dos bloques de fotografía: si llegaran ambos encendidos (metadatos), manda el de interiorismo', () => {
  const p = buildInteriorPrompt(on({ magazinePhoto: true }), OPENAI);
  assert.ok(p.includes(MARK));
  assert.ok(!p.includes(MAG));
  // y el de revista sigue funcionando solo
  assert.ok(buildInteriorPrompt({ ...DEFAULT_PARAMS, mode: 'interior', ...SC.applyMagazinePreset('interior') }, OPENAI).includes(MAG));
});

test('«sin personas» solo si no pidió gente, y la dirección creativa gana los conflictos', () => {
  assert.match(buildInteriorPrompt(on(), OPENAI), /no people/);
  assert.doesNotMatch(buildInteriorPrompt(on({ humanContext: SC.HUMAN_CONTEXT[1] }), OPENAI), /no people/);
  assert.match(buildInteriorPrompt(on({ artDirection: 'Con un perro dormido en el sofá' }), OPENAI), /the CREATIVE DIRECTION wins any conflict/);
});

test('el asistente IA no puede encenderlo; los metadatos de una imagen lo conservan (solo booleano)', () => {
  assert.equal('interiorPhoto' in sanitizeAssistantParams({ interiorPhoto: true }).params, false);
  assert.equal(sanitizeSourceParams({ interiorPhoto: true }).interiorPhoto, true);
  assert.equal('interiorPhoto' in sanitizeSourceParams({ interiorPhoto: 'true' }), false);
});
