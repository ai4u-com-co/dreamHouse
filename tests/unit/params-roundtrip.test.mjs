// Recuperar los parámetros de una generación: lo que se guarda en la imagen (o en el archivo de parámetros)
// debe volver COMPLETO al formulario. Esta prueba falla si se agrega un parámetro al formulario y no viaja.
// Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { DEFAULT_PARAMS } from '@/types';
import * as SC from '@/modules/shared/constants';
import * as EC from '@/modules/exterior/constants';
import * as IC from '@/modules/interior/constants';
import * as EDC from '@/modules/edit/constants';
import * as PC from '@/modules/planta/constants';
import { embedImageMetadata, readImageMetadata, pickEmbeddableParams, DESIGN_PARAM_KEYS, DETAIL_PARAM_KEYS } from '@/lib/image-metadata';
import { sanitizeRestoredParams } from '@/lib/assistant-params';
import { buildParamsFile, parseParamsFile, restoreParamsFromFile } from '@/lib/restore-params';

const LONG_TEXT = `Atardecer con neblina baja y SIN ningún vecino.\nQue se sienta como una fotografía de revista de 1970. ${'Detalle largo. '.repeat(60)}`.trim();

// Un valor distinto del de fábrica para CADA campo del formulario (si falta uno, la prueba avisa)
const FULL = {
  ...DEFAULT_PARAMS,
  mode: 'exterior',
  architecturalStyles: [SC.STYLES[3], SC.STYLES[5]], architect: [SC.ARCHITECTS[2]], mood: SC.MOODS[1],
  materials: [EC.MATERIALS[2]], finishLevel: EC.FINISH_LEVELS[1], colorPalette: [SC.COLORS[1]],
  cameraAngle: SC.ANGLES[1], composition: SC.COMPOSITIONS[1], timeOfDay: SC.TIMES_OF_DAY[1], season: SC.SEASONS[1],
  lighting: SC.LIGHTING_TYPES[1], humanContext: SC.HUMAN_CONTEXT[1],
  cameraPreset: 'Canon EOS R5 II', focalLength: SC.FOCAL_LENGTHS[2], aperture: SC.APERTURES[2], filmSimulation: SC.UNIVERSAL_FILM_LOOKS[2],
  depthOfField: SC.DEPTH_OF_FIELD_OPTIONS[1], renderStyle: SC.RENDER_STYLES[3],
  renderAspectRatio: '3:2', renderOutputResolution: '2K', renderQuality: 'Alta', aiModel: SC.AI_MODELS[1],
  projectType: EC.PROJECT_TYPES[3], city: 'Medellín', climate: EC.CLIMATES[1], environment: EC.ENVIRONMENTS[1],
  waterBody: EC.WATER_BODIES[1], weatherCondition: EC.WEATHER_CONDITIONS[1], size: '250', levels: 3,
  roofType: EC.ROOF_TYPES[1], layoutType: EC.LAYOUT_TYPES[1], parkingSpots: 2, parkingType: EC.PARKING_TYPES[1],
  socialAreas: [EC.SOCIAL_AREAS[1]], exteriorElements: [EC.EXTERIOR_ELEMENTS[1]], vegetation: [EC.VEGETATION[1]],
  architecturalDetails: [EC.ARCHITECTURAL_DETAILS[1]],
  siteTopography: EC.SITE_TOPOGRAPHIES[2], solarOrientation: EC.SOLAR_ORIENTATIONS[1], constructionSystem: EC.CONSTRUCTION_SYSTEMS[1],
  roofMaterial: EC.ROOF_MATERIALS[1], passiveStrategies: [EC.PASSIVE_STRATEGIES[1]], windowType: EC.WINDOW_TYPES[1],
  roomType: IC.ROOM_TYPES[1], roomSizeM2: 30, furnitureStyle: [IC.FURNITURE_STYLES[1]], interiorLighting: [IC.INTERIOR_LIGHTING_TYPES[1]],
  flooringMaterial: IC.FLOORING_MATERIALS[1], ceilingDetail: IC.CEILING_DETAILS[1], bedrooms: 3, bathrooms: 2,
  kitchenType: IC.KITCHEN_TYPES[1], livingAreaType: IC.LIVING_AREA_TYPES[1], wallFinish: IC.WALL_FINISHES[1],
  editChangeType: EDC.EDIT_CHANGE_TYPES[1], editIntensity: EDC.EDIT_INTENSITIES[1], editPreserve: [EDC.EDIT_PRESERVE_OPTIONS[1]],
  floorPlanStyle: PC.FLOOR_PLAN_STYLES[1], lotWidthM: 12, lotDepthM: 25, planSpaces: [PC.PLAN_SPACES[1]],
  zoningLayout: PC.ZONING_LAYOUTS[1], floorPlanAnnotations: [PC.FLOOR_PLAN_ANNOTATIONS[1]],
  artDirection: LONG_TEXT, negativePrompt: 'sin autos\nsin carteles', editPrompt: 'quitar el árbol del frente',
};

// Lo que NO se recupera a propósito, con su razón (todo lo demás debe volver)
const NOT_RESTORED = {
  mode: 'se conserva el módulo actual de la persona',
  selectedVistas: 'es una selección de la tanda, no un diseño',
  hasExteriorReference: 'depende de un archivo que no se guarda',
  hasLotZone: 'depende de un archivo que no se guarda',
  sourceRender: 'es la genealogía, no un parámetro del formulario',
  renderCustomSize: 'opción de costo de la salida',
  renderFormat: 'opción de costo de la salida',
  renderBackground: 'opción de costo de la salida',
  renderVariants: 'opción de costo de la salida (multiplica el cobro)',
  renderModeration: 'opción reservada a administradores',
  embedMetadata: 'preferencia de privacidad de la persona',
  embedDetails: 'preferencia de privacidad de la persona',
  viewType: 'es la vista concreta de una tanda',
};

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const png = (w = 64, h = 48) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 120, g: 90, b: 60, alpha: 1 } } });
const FORMATS = {
  jpeg: () => png().jpeg().toBuffer(),
  png: () => png().png().toBuffer(),
  'webp (con pérdida)': () => png().webp({ quality: 70 }).toBuffer(),
  'webp (sin pérdida)': () => png().webp({ lossless: true }).toBuffer(),
  'webp (transparente)': () => sharp({ create: { width: 40, height: 30, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.3 } } }).webp({ lossless: true }).toBuffer(),
};

const metaFor = (params, details) => ({ app: 'DreamHouse', version: 1, id: 'img-1', mode: 'exterior', houseName: 'Casa de prueba', params: pickEmbeddableParams(params, details) });

test('cada campo del formulario viaja, o está en la lista de exclusiones con su razón', () => {
  const carried = new Set([...DESIGN_PARAM_KEYS, ...DETAIL_PARAM_KEYS]);
  const missing = Object.keys(DEFAULT_PARAMS).filter((k) => !carried.has(k) && !(k in NOT_RESTORED));
  assert.deepEqual(missing, [], `Estos parámetros no se guardan en la imagen ni están justificados en NOT_RESTORED: ${missing.join(', ')}`);
  for (const k of Object.keys(NOT_RESTORED)) assert.ok(k in DEFAULT_PARAMS || k === 'viewType' || k === 'sourceRender', `NOT_RESTORED menciona "${k}", que ya no existe`);
});

test('la muestra completa cambia TODOS los campos recuperables (la prueba no se queda corta)', () => {
  const unchanged = [...DESIGN_PARAM_KEYS, ...DETAIL_PARAM_KEYS].filter((k) => eq(FULL[k], DEFAULT_PARAMS[k]));
  assert.deepEqual(unchanged, [], `Falta un valor de muestra distinto del de fábrica para: ${unchanged.join(', ')}`);
});

for (const [name, make] of Object.entries(FORMATS)) {
  test(`${name}: con «incluir detalles» vuelve TODO, incluidos los textos largos, y la imagen sigue siendo válida`, async () => {
    const original = new Uint8Array(await make());
    const out = embedImageMetadata(original, metaFor(FULL, true));
    assert.ok(out.length > original.length, 'los metadatos deben haberse incrustado');
    const decoded = await sharp(Buffer.from(out)).metadata();
    const before = await sharp(Buffer.from(original)).metadata();
    assert.equal(decoded.width, before.width);
    assert.equal(decoded.height, before.height);

    const meta = readImageMetadata(out);
    assert.ok(meta, 'se debe poder leer lo incrustado');
    const { params } = sanitizeRestoredParams(meta.params);
    const lost = [...DESIGN_PARAM_KEYS, ...DETAIL_PARAM_KEYS].filter((k) => !eq(params[k], FULL[k]));
    assert.deepEqual(lost, [], `No se recuperaron: ${lost.join(', ')}`);
  });

  test(`${name}: sin «incluir detalles» vuelve el diseño y NO viajan ciudad ni textos (privacidad)`, async () => {
    const out = embedImageMetadata(new Uint8Array(await make()), metaFor(FULL, false));
    const { params } = sanitizeRestoredParams(readImageMetadata(out).params);
    for (const k of DESIGN_PARAM_KEYS) assert.ok(eq(params[k], FULL[k]), `se perdió ${k}`);
    for (const k of DETAIL_PARAM_KEYS) assert.ok(!(k in params), `${k} no debía viajar sin permiso`);
  });
}

test('re-incrustar sobre una imagen que ya tenía metadatos no duplica ni corrompe (WebP)', async () => {
  const once = embedImageMetadata(new Uint8Array(await FORMATS['webp (con pérdida)']()), metaFor(FULL, false));
  const twice = embedImageMetadata(once, { ...metaFor(FULL, false), id: 'img-2' });
  assert.equal(readImageMetadata(twice).id, 'img-2');
  assert.ok(Math.abs(twice.length - once.length) < 64);
  await sharp(Buffer.from(twice)).metadata();
});

test('archivo de parámetros (.json): ida y vuelta completa, sin la genealogía', () => {
  const file = buildParamsFile({ mode: 'exterior', params: { ...FULL, sourceRender: { id: 'x', mode: 'exterior', params: {} } }, houseName: 'Casa', timestamp: 1 });
  assert.ok(!('sourceRender' in file.params));
  const result = parseParamsFile(JSON.stringify(file));
  assert.ok(result.ok);
  const lost = [...DESIGN_PARAM_KEYS, ...DETAIL_PARAM_KEYS].filter((k) => !eq(result.params[k], FULL[k]));
  assert.deepEqual(lost, []);
  assert.equal(result.mode, 'exterior');
  assert.equal(result.hasTexts, true);
});

test('restoreParamsFromFile: imagen de DreamHouse, imagen ajena y archivo no válido', async () => {
  const out = embedImageMetadata(new Uint8Array(await FORMATS.png()), metaFor(FULL, true));
  const good = await restoreParamsFromFile(new File([out], 'casa.png', { type: 'image/png' }));
  assert.ok(good.ok && good.source === 'imagen' && good.count > 50);
  const foreign = await restoreParamsFromFile(new File([new Uint8Array(await FORMATS.jpeg())], 'otra.jpg', { type: 'image/jpeg' }));
  assert.ok(!foreign.ok && /no trae parámetros/i.test(foreign.message));
  const wrong = await restoreParamsFromFile(new File(['hola'], 'x.pdf', { type: 'application/pdf' }));
  assert.ok(!wrong.ok);
  const bad = await restoreParamsFromFile(new File(['{ no es json'], 'p.json', { type: 'application/json' }));
  assert.ok(!bad.ok);
});

test('lo recuperado es no confiable: solo valores de los catálogos y textos limpios', () => {
  const hostile = {
    architect: ['<script>alert(1)</script>', SC.ARCHITECTS[0]], mood: 'inventado', aiModel: 'otro-modelo', sourceRender: { id: 'x' },
    mode: 'edit', embedMetadata: false, renderVariants: 4, __proto__: { polluted: true }, constructor: 'x',
    artDirection: `hola\u0000\u0007 mundo\nlínea 2 ${'x'.repeat(9000)}`, city: 'Bogotá\u0000',
  };
  const { params } = sanitizeRestoredParams(hostile);
  assert.deepEqual(params.architect, [SC.ARCHITECTS[0]]);
  for (const k of ['mood', 'aiModel', 'sourceRender', 'mode', 'embedMetadata', 'renderVariants', 'polluted']) assert.ok(!(k in params), `${k} no debía pasar`);
  assert.ok(params.artDirection.length <= 4000);
  assert.ok(!/[\u0000-\u0008]/.test(params.artDirection));
  assert.match(params.artDirection, /\n/, 'conserva los saltos de línea');
  assert.equal(params.city, 'Bogotá');
});
