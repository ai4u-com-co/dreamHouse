// Rutas /api con Supabase y OpenAI simulados a nivel de fetch (sin red ni secretos). La clave de OpenAI es de Mariano:
// aquí se prueba que NADA se genera sin sesión y saldo, que el cobro va ANTES de OpenAI, que se devuelve si falla y que el
// token de devolución y los errores crudos de OpenAI jamás llegan al navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { DEFAULT_PARAMS } from '@/types';
import { ASSISTANT_CREDITS } from '@/lib/billing';
import { creditsFor } from '@/lib/openai-image-core.ts';
import { pickOpenAIInputs } from '@/lib/render-options';

process.env.OPENAI_API_KEY = 'sk-servidor-de-prueba';
const generate = await import('../../src/app/api/generate/route.ts');
const parse = await import('../../src/app/api/parse-prompt/route.ts');

const TOKEN = 'token-secreto-de-devolucion-que-no-debe-salir';
const JPEG_B64 = (await sharp({ create: { width: 8, height: 8, channels: 3, background: '#808080' } }).jpeg().toBuffer()).toString('base64');

let world;
const reset = (over = {}) => {
  world = {
    calls: [],
    userOk: true,
    consume: { ok: true, remaining: 9, log_id: 42, refund_token: TOKEN },
    consumeError: null,
    refund: { ok: true, remaining: 10 },
    role: 'user',
    active: true,
    recordUsageStatus: 200,
    openai: { status: 200, body: { data: [{ b64_json: JPEG_B64 }] } },
    chat: { status: 200, body: { id: 'x', object: 'chat.completion', choices: [{ index: 0, message: { role: 'assistant', content: '{"mood":"Cálido"}' }, finish_reason: 'stop' }] } },
    ...over,
  };
};
const j = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

globalThis.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  world.calls.push({ url, init });
  if (url.includes('/auth/v1/user')) return world.userOk ? j(200, { id: 'u1', aud: 'authenticated', role: 'authenticated', email: 'a@b.co' }) : j(401, { msg: 'bad jwt' });
  if (url.includes('/rest/v1/rpc/consume_credits') && typeof init.body === 'string' && JSON.parse(init.body).p_action === 'image_topup') {
    if (world.topupThrows) throw new Error('red caída');
    return Array.isArray(world.topup) ? j(200, world.topup.shift()) : j(200, world.topup ?? { ok: true, remaining: 5 });
  }
  if (url.includes('/rest/v1/rpc/consume_credits')) return world.consumeError ? j(world.consumeError.http, world.consumeError.body) : j(200, world.consume);
  if (url.includes('/rest/v1/rpc/refund_credits')) return j(200, world.refund);
  if (url.includes('/rest/v1/rpc/record_usage')) return world.recordUsageStatus === 200 ? j(200, { ok: true }) : j(500, { message: 'boom' });
  if (url.includes('/rest/v1/app_memberships')) return j(200, { role: world.role, is_active: world.active });
  if (url.includes('api.openai.com/v1/images')) return j(world.openai.status, world.openai.body);
  if (url.includes('api.openai.com/v1/chat/completions')) return j(world.chat.status, world.chat.body);
  throw new Error(`fetch no simulado: ${url}`);
};

const called = (frag) => world.calls.filter((c) => c.url.includes(frag));
const rpcBody = (name) => JSON.parse(called(`/rpc/${name}`)[0].init.body);

const genReq = (over = {}, headers = { authorization: 'Bearer jwt-ok' }) => {
  const form = new FormData();
  form.append('params', JSON.stringify({ ...DEFAULT_PARAMS, mode: 'exterior', ...over }));
  return new NextRequest('http://localhost/api/generate', { method: 'POST', headers, body: form });
};
const parseReq = (body, headers = { authorization: 'Bearer jwt-ok' }) =>
  new NextRequest('http://localhost/api/parse-prompt', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

// ---------------------------------------------------------------- precios
test('precios: el costo sale del núcleo (tokens de salida × variantes + imágenes de entrada)', () => {
  assert.equal(creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, promptChars: 0 }), 2); // 196 tokens de salida = US$0,0059 ≈ 1,3 créditos
  assert.equal(ASSISTANT_CREDITS, 1);
});

// ---------------------------------------------------------------- /api/generate
test('generate: sin Authorization responde 401, no cobra y no llama a OpenAI', async () => {
  reset();
  const res = await generate.POST(genReq({}, {}));
  assert.equal(res.status, 401);
  assert.equal(called('rpc').length, 0);
  assert.equal(called('openai').length, 0);
});

test('generate: JWT inválido responde 401 y no cobra', async () => {
  reset({ userOk: false });
  const res = await generate.POST(genReq());
  assert.equal(res.status, 401);
  assert.equal(called('rpc').length, 0);
});

test('generate: sin saldo responde 402 y NO llama a OpenAI', async () => {
  reset({ consume: { ok: false, remaining: 0, log_id: null, refund_token: null } });
  const res = await generate.POST(genReq());
  assert.equal(res.status, 402);
  const out = await res.json();
  assert.equal(out.code, 'INSUFFICIENT_CREDITS');
  assert.equal(out.remaining, 0);
  assert.equal(called('openai').length, 0);
});

test('generate: cuenta sin acceso (42501) responde 403 y NO llama a OpenAI', async () => {
  reset({ consumeError: { http: 403, body: { code: '42501', message: 'no access to app' } } });
  const res = await generate.POST(genReq());
  assert.equal(res.status, 403);
  assert.equal(called('openai').length, 0);
});

test('generate: éxito cobra ANTES de OpenAI, entrega la imagen y NUNCA el token de devolución', async () => {
  reset();
  const res = await generate.POST(genReq());
  assert.equal(res.status, 200);
  const text = await res.clone().text();
  const out = await res.json();
  assert.match(out.imageUrl, /^data:image\/jpeg;base64,/);
  assert.equal(out.remaining, 9);
  assert.ok(!text.includes(TOKEN), 'el refund_token se filtró al navegador');
  assert.ok(!/refund/i.test(text), 'la respuesta no debe mencionar la devolución');
  const cobro = rpcBody('consume_credits');
  assert.equal(cobro.p_app, 'dreamhouse');
  assert.equal(cobro.p_amount, creditsFor({ quality: 'low', width: 1360, height: 768, n: 1, inputPixels: [], promptChars: cobro.p_meta.chars }));
  assert.equal(cobro.p_action, 'render');
  const orden = world.calls.map((c) => c.url);
  assert.ok(orden.findIndex((u) => u.includes('consume_credits')) < orden.findIndex((u) => u.includes('api.openai.com')), 'el cobro debe ir antes de llamar a OpenAI');
  assert.equal(called('refund_credits').length, 0);
});

test('generate: usa SOLO la clave del servidor; ignora cualquier clave que mande el navegador', async () => {
  reset();
  await generate.POST(genReq({}, { authorization: 'Bearer jwt-ok', 'x-openai-api-key': 'sk-del-navegador', 'x-api-key': 'g-del-navegador' }));
  const gen = called('api.openai.com/v1/images')[0];
  assert.ok(gen, 'no se llamó a OpenAI');
  assert.match(new Headers(gen.init.headers).get('authorization') ?? '', /sk-servidor-de-prueba/);
  assert.ok(!JSON.stringify(world.calls).includes('sk-del-navegador'));
});

test('generate: el cobro es EXACTAMENTE v.credits del núcleo (calidad, tamaño, variantes)', async () => {
  for (const [over, quality, , n] of [
    [{ renderQuality: 'Alta', renderOutputResolution: '2K', renderAspectRatio: '1:1' }, 'high', 1920 * 1920, 1],
    [{ renderQuality: 'Muy alta' }, 'xhigh', 1376 * 768, 1],
    [{ renderQuality: 'Máxima', renderAspectRatio: '1:1' }, 'max', 1024 * 1024, 1],
    [{ renderQuality: 'Estándar', renderAspectRatio: '1:1', renderVariants: 3 }, 'medium', 1024 * 1024, 3],
  ]) {
    reset();
    const res = await generate.POST(genReq(over));
    assert.equal(res.status, 200, JSON.stringify(over));
    const [width, height] = JSON.parse(called('api.openai.com/v1/images')[0].init.body).size.split('x').map(Number);
    const promptChars = rpcBody('consume_credits').p_meta.chars; // el cobro registra el largo del prompt que viajó a OpenAI
    assert.ok(promptChars > 100, 'el cobro debe registrar el largo del prompt');
    assert.equal(rpcBody('consume_credits').p_amount, creditsFor({ quality, width, height, n, inputPixels: [], promptChars }), JSON.stringify(over));
  }
  // el valor antiguo «4K» se acota a 2K (no 4K) y «512» a 1K
  reset();
  await generate.POST(genReq({ renderOutputResolution: '4K', renderAspectRatio: '1:1' }));
  assert.equal(JSON.parse(called('api.openai.com/v1/images')[0].init.body).size, '1920x1920');
  reset();
  await generate.POST(genReq({ renderOutputResolution: '512', renderAspectRatio: '1:1' }));
  assert.equal(JSON.parse(called('api.openai.com/v1/images')[0].init.body).size, '1024x1024');
});

test('generate: los valores por defecto son los más baratos y el cuerpo a OpenAI lleva exactamente lo verificado', async () => {
  reset();
  const res = await generate.POST(genReq());
  assert.equal(res.status, 200);
  const body = JSON.parse(called('api.openai.com/v1/images')[0].init.body);
  assert.equal(body.model, 'gpt-image-2.5-sunburst');
  assert.equal(body.quality, 'low');
  assert.equal(body.n, 1);
  assert.equal(body.output_format, 'jpeg');
  assert.equal(body.output_compression, 90);
  assert.match(body.safety_identifier, /^[0-9a-f]{64}$/);
  assert.ok(!('input_fidelity' in body) && !('background' in body) && !('moderation' in body) && !('response_format' in body));
  const meta = rpcBody('consume_credits').p_meta;
  assert.deepEqual([meta.model, meta.quality, meta.n, meta.format, meta.background, meta.inputs], ['gpt-image-2.5-sunburst', 'low', 1, 'jpeg', 'auto', 0]);
});

test('generate: cada opción nueva llega a OpenAI con su nombre; transparente fuerza webp; n>1 devuelve images', async () => {
  reset({ openai: { status: 200, body: { data: [{ b64_json: JPEG_B64 }, { b64_json: JPEG_B64 }], usage: { input_tokens: 5, output_tokens: 214, input_tokens_details: { text_tokens: 5, image_tokens: 0 } } } } });
  const res = await generate.POST(genReq({ aiModel: 'GPT Image 2.5 Flare · borrador rápido (OpenAI)', renderQuality: 'Muy alta', renderBackground: 'transparent', renderVariants: 2, renderFormat: 'jpeg', embedMetadata: false }));
  assert.equal(res.status, 200);
  const body = JSON.parse(called('api.openai.com/v1/images')[0].init.body);
  assert.deepEqual([body.model, body.quality, body.n, body.output_format, body.background], ['gpt-image-2.5-flare', 'xhigh', 2, 'webp', 'transparent']);
  assert.equal(body.output_compression, 85);
  const out = await res.json();
  assert.equal(out.images.length, 2);
  assert.equal(out.image, out.images[0]);
  assert.equal(out.imageUrl, out.images[0]);
  assert.match(out.images[0], /^data:image\/webp;base64,/);
  assert.deepEqual([out.options.n, out.options.format, out.options.quality], [2, 'webp', 'xhigh']);
  assert.equal(out.usage.out, 214);
});

test('generate: record_usage recibe el log, el token (solo servidor) y claves permitidas; si falla, la generación NO se rompe', async () => {
  reset();
  const ok = await generate.POST(genReq());
  assert.equal(ok.status, 200);
  const u = rpcBody('record_usage');
  assert.equal(u.p_log_id, 42);
  assert.equal(u.p_token, TOKEN);
  for (const k of Object.keys(u.p_usage)) assert.ok(['in', 'in_img', 'in_txt', 'out', 'n', 'model', 'quality', 'size'].includes(k), `clave no permitida: ${k}`);
  assert.ok(!(await ok.text()).includes(TOKEN));
  reset({ recordUsageStatus: 500 });
  const res = await generate.POST(genReq());
  assert.equal(res.status, 200, 'un fallo de record_usage no debe romper la entrega');
  assert.equal(called('refund_credits').length, 0, 'ni devolver el cobro');
});

test('generate: opciones inválidas responden 400 SIN cobrar ni llamar a OpenAI (incluye claves de prototipo)', async () => {
  const bad = [
    { renderQuality: 'constructor' }, { renderQuality: '__proto__' }, { renderQuality: 'toString' }, { renderQuality: 'inventada' },
    { renderAspectRatio: '1:8' }, { renderAspectRatio: 'constructor' }, { renderOutputResolution: '8K' }, { renderOutputResolution: 'constructor' },
    { renderOutputResolution: 'Personalizado', renderCustomSize: '1000x700' }, { renderOutputResolution: 'Personalizado', renderCustomSize: '3200x640' },
    { renderFormat: 'gif' }, { renderFormat: '__proto__' }, { renderBackground: 'toString' }, { renderVariants: 5 }, { renderVariants: 0 }, { renderVariants: '2' },
    { renderModeration: 'constructor' }, { renderOutputResolution: '2K', renderFormat: 'png', renderVariants: 4, renderAspectRatio: '1:1' },
  ];
  for (const over of bad) {
    reset();
    const res = await generate.POST(genReq(over));
    assert.equal(res.status, 400, JSON.stringify(over));
    assert.equal((await res.json()).code, 'BAD_OPTIONS');
    assert.equal(called('rpc').length, 0, `cobró con ${JSON.stringify(over)}`);
    assert.equal(called('api.openai.com').length, 0);
  }
});

test('generate: moderación baja solo para admin (403 sin cobrar si no lo es; con rol admin pasa y lleva moderation)', async () => {
  reset({ role: 'user' });
  const res = await generate.POST(genReq({ renderModeration: 'low' }));
  assert.equal(res.status, 403);
  assert.equal((await res.json()).code, 'ADMIN_ONLY');
  assert.equal(called('consume_credits').length, 0);
  assert.equal(called('api.openai.com').length, 0);
  reset({ role: 'admin' });
  const ok = await generate.POST(genReq({ renderModeration: 'low' }));
  assert.equal(ok.status, 200);
  assert.equal(JSON.parse(called('api.openai.com/v1/images')[0].init.body).moderation, 'low');
  // membresía INACTIVA con rol admin: tampoco
  reset({ role: 'admin', active: false });
  const inactive = await generate.POST(genReq({ renderModeration: 'low' }));
  assert.equal(inactive.status, 403);
  assert.equal(called('consume_credits').length, 0);
  assert.equal(called('api.openai.com').length, 0);
  // la consulta filtra por app y por el id verificado del usuario
  const q = called('app_memberships')[0].url;
  assert.match(q, /app_id=eq\.dreamhouse/);
  assert.match(q, /user_id=eq\.u1/);
  // sin pedir moderación baja ni siquiera se consulta el rol
  reset();
  await generate.POST(genReq());
  assert.equal(called('app_memberships').length, 0);
});

test('generate: una imagen de entrada enorme (> 2048x2048) responde 400 sin cobrar; el costo de entrada es por píxeles reales', async () => {
  const big = await sharp({ create: { width: 2400, height: 2400, channels: 3, background: '#888' } }).jpeg().toBuffer();
  reset();
  const form = new FormData();
  form.append('params', JSON.stringify({ ...DEFAULT_PARAMS, mode: 'exterior' }));
  form.append('lotImage', new File([big], 'lote.jpg', { type: 'image/jpeg' }));
  const res = await generate.POST(new NextRequest('http://localhost/api/generate', { method: 'POST', headers: { authorization: 'Bearer jwt-ok' }, body: form }));
  assert.equal(res.status, 400);
  assert.equal(called('consume_credits').length, 0);

  const small = await sharp({ create: { width: 1024, height: 640, channels: 3, background: '#888' } }).jpeg().toBuffer();
  reset();
  const form2 = new FormData();
  form2.append('params', JSON.stringify({ ...DEFAULT_PARAMS, mode: 'exterior', renderAspectRatio: '1:1' }));
  form2.append('lotImage', new File([small], 'lote.jpg', { type: 'image/jpeg' }));
  const ok = await generate.POST(new NextRequest('http://localhost/api/generate', { method: 'POST', headers: { authorization: 'Bearer jwt-ok' }, body: form2 }));
  assert.equal(ok.status, 200);
  assert.equal(rpcBody('consume_credits').p_amount, creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, inputPixels: [1024 * 640], promptChars: rpcBody('consume_credits').p_meta.chars }));
  assert.equal(called('api.openai.com/v1/images/edits').length, 1, 'con una imagen de entrada se usa /images/edits');
});

test('generate: el espejo del cliente (pickOpenAIInputs) elige las mismas imágenes que el servidor', async () => {
  const img = (n) => sharp({ create: { width: 640, height: 640, channels: 3, background: '#888' } }).jpeg().toBuffer().then((b) => new File([b], `${n}.jpg`, { type: 'image/jpeg' }));
  const [lot, ref, plan, r1, r2, o1] = await Promise.all(['lot', 'ref', 'plan', 'r1', 'r2', 'o1'].map(img));
  for (const mode of ['planta', 'exterior', 'interior', 'vistas']) {
    reset();
    const form = new FormData();
    form.append('params', JSON.stringify({ ...DEFAULT_PARAMS, mode, selectedVistas: ['x'], renderAspectRatio: '1:1' }));
    form.append('lotImage', lot);
    form.append('exteriorReferenceImage', ref);
    form.append('floorPlanImage', plan);
    form.append('files', r1);
    form.append('files', r2);
    form.append('objectImages', o1);
    const res = await generate.POST(new NextRequest('http://localhost/api/generate', { method: 'POST', headers: { authorization: 'Bearer jwt-ok' }, body: form }));
    assert.equal(res.status, 200, mode);
    const n = pickOpenAIInputs(mode, { lot, exteriorRef: ref, floorPlan: plan, references: [r1, r2], objects: [o1] }).length;
    assert.equal(rpcBody('consume_credits').p_amount, creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, inputPixels: Array(n).fill(640 * 640), promptChars: rpcBody('consume_credits').p_meta.chars }), mode);
    assert.equal(rpcBody('consume_credits').p_meta.inputs, n, mode);
  }
});

test('generate: edición cobra por los píxeles reales de la base (acotados) y manda size auto; n y formato quedan fijos', async () => {
  const base = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: '#888' } }).png().toBuffer();
  reset();
  const form = new FormData();
  form.append('params', JSON.stringify({ ...DEFAULT_PARAMS, mode: 'edit', editPrompt: 'cambiar el piso', renderVariants: 3, renderFormat: 'png', renderBackground: 'transparent' }));
  form.append('editCompositeFile', new File([base], 'c.png', { type: 'image/png' }));
  const res = await generate.POST(new NextRequest('http://localhost/api/generate', { method: 'POST', headers: { authorization: 'Bearer jwt-ok' }, body: form }));
  assert.equal(res.status, 200);
  const sent = called('api.openai.com/v1/images/edits')[0].init.body;
  assert.equal(sent.get('size'), 'auto');
  assert.equal(sent.get('n'), '1');
  assert.equal(sent.get('output_format'), 'jpeg');
  assert.equal(sent.get('background'), null);
  const side = Math.round(Math.sqrt(1600 * 1200)); // en edición se cotiza como cuadrada (se desconoce la forma de la base)
  assert.equal(rpcBody('consume_credits').p_amount, creditsFor({ quality: 'low', width: side, height: side, n: 1, inputPixels: [1600 * 1200], promptChars: rpcBody('consume_credits').p_meta.chars }));
  assert.match(sent.get('prompt'), /change ONLY what is described here/);
});

test('generate: un modelo Gemini (cliente viejo) se atiende con GPT Image 2.5, nunca con otro proveedor', async () => {
  reset();
  const res = await generate.POST(genReq({ aiModel: 'Gemini 3.1 Flash Image Preview' }));
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(called('api.openai.com/v1/images')[0].init.body).model, 'gpt-image-2.5-sunburst');
  assert.equal(called('googleapis').length, 0);
});

test('generate: si OpenAI falla devuelve el cobro con el token (solo servidor) y no reenvía el error crudo', async () => {
  reset({ openai: { status: 500, body: { error: { message: 'detalle interno secreto de OpenAI', type: 'server_error' } } } });
  const res = await generate.POST(genReq());
  assert.ok(res.status >= 500);
  const text = await res.text();
  assert.ok(!text.includes(TOKEN));
  assert.ok(!text.includes('detalle interno secreto'), 'no se reenvían los errores crudos de OpenAI');
  assert.equal(called('refund_credits').length, 1);
  const dev = rpcBody('refund_credits');
  assert.equal(dev.p_log_id, 42);
  assert.equal(dev.p_token, TOKEN);
  assert.match(text, /No se te cobró/);
  assert.equal(JSON.parse(text).remaining, 10);
});

test('generate: si la clave del SERVIDOR falla en OpenAI responde 502 (no 401: el navegador pediría volver a entrar) y devuelve el cobro', async () => {
  reset({ openai: { status: 401, body: { error: { message: 'Incorrect API key', code: 'invalid_api_key' } } } });
  const res = await generate.POST(genReq());
  assert.equal(res.status, 502);
  assert.equal((await res.json()).code, 'UPSTREAM_AUTH');
  assert.equal(called('refund_credits').length, 1);
});

test('generate: moderación bloqueada responde 422 y devuelve el cobro', async () => {
  reset({ openai: { status: 400, body: { error: { message: 'Your request was rejected by the safety system.', code: 'moderation_blocked', type: 'image_generation_user_error' } } } });
  const res = await generate.POST(genReq());
  assert.equal(res.status, 422);
  assert.equal(called('refund_credits').length, 1);
});

test('generate: si la devolución también falla, no promete que no se cobró', async () => {
  reset({ openai: { status: 500, body: { error: { message: 'x' } } }, refund: { ok: false, reason: 'expired' } });
  const res = await generate.POST(genReq());
  const out = await res.json();
  assert.doesNotMatch(out.message, /No se te cobró/);
  assert.match(out.message, /escríbenos/);
});

test('generate: un admin no paga (sin token) y si OpenAI falla no se intenta devolver nada', async () => {
  reset({ consume: { ok: true, remaining: 0, log_id: 7, refund_token: null }, openai: { status: 500, body: { error: { message: 'x' } } } });
  const res = await generate.POST(genReq());
  assert.ok(res.status >= 500);
  assert.equal(called('refund_credits').length, 0);
});

// ---------------------------------------------------------------- /api/parse-prompt
test('parse-prompt: sin sesión responde 401 y no cobra ni llama a OpenAI', async () => {
  reset();
  const res = await parse.POST(parseReq({ textPrompt: 'casa moderna', mode: 'exterior' }, {}));
  assert.equal(res.status, 401);
  assert.equal(called('rpc').length, 0);
  assert.equal(called('openai').length, 0);
});

test('parse-prompt: cobra 1 crédito, usa la clave del servidor y devuelve el saldo aparte de los parámetros', async () => {
  reset();
  const res = await parse.POST(parseReq({ textPrompt: 'casa moderna', mode: 'exterior' }, { authorization: 'Bearer jwt-ok', 'x-openai-api-key': 'sk-del-navegador' }));
  assert.equal(res.status, 200);
  const out = await res.json();
  assert.equal(out.mood, 'Cálido');
  assert.equal(out._remaining, 9);
  assert.equal(rpcBody('consume_credits').p_amount, 1);
  assert.equal(rpcBody('consume_credits').p_action, 'assistant');
  assert.ok(!JSON.stringify(world.calls).includes('sk-del-navegador'));
});

test('parse-prompt: sin saldo responde 402 y NO llama a OpenAI; un texto enorme responde 400 sin cobrar', async () => {
  reset({ consume: { ok: false, remaining: 0, log_id: null, refund_token: null } });
  assert.equal((await parse.POST(parseReq({ textPrompt: 'casa', mode: 'exterior' }))).status, 402);
  assert.equal(called('openai').length, 0);
  reset();
  assert.equal((await parse.POST(parseReq({ textPrompt: 'x'.repeat(2001), mode: 'exterior' }))).status, 400);
  assert.equal(called('rpc').length, 0);
});

test('parse-prompt: si la clave del servidor no tiene permiso de texto (clave solo de imágenes) devuelve el cobro y un mensaje claro', async () => {
  reset({ chat: { status: 403, body: { error: { message: 'You have insufficient permissions for this operation.', code: 'insufficient_permissions' } } } });
  const res = await parse.POST(parseReq({ textPrompt: 'casa moderna', mode: 'exterior' }));
  assert.equal(res.status, 502);
  const text = await res.text();
  assert.equal(JSON.parse(text).code, 'ASSISTANT_UNAVAILABLE');
  assert.ok(!text.includes('insufficient permissions'), 'no se reenvía el texto crudo de OpenAI');
  assert.ok(!text.includes(TOKEN));
  assert.equal(called('refund_credits').length, 1);
  assert.match(text, /No se te cobró/);
});

// ── Liquidación con el uso real (el precio previo es una estimación; lo real manda) ──────────────────────────────────────────────
// Uso real de 364 tokens de salida y 1151 de texto: 364*30 + 1151*5 = US$0,01667 → 4 créditos; el render por defecto cobra menos.
const usoCaro = { input_tokens: 1151, input_tokens_details: { image_tokens: 0, text_tokens: 1151 }, output_tokens: 364 };
const okConUso = (usage) => ({ status: 200, body: { data: [{ b64_json: JPEG_B64 }], usage } });
const topups = () => called('/rpc/consume_credits').filter((c) => JSON.parse(c.init.body).p_action === 'image_topup');

test('liquidación: si el uso real supera lo cobrado se cobra la diferencia (consume_credits image_topup) y se informa el saldo', async () => {
  reset({ openai: okConUso(usoCaro), topup: { ok: true, remaining: 7 } });
  const r = await generate.POST(genReq());
  assert.equal(r.status, 200);
  const cobro = rpcBody('consume_credits');
  assert.ok(cobro.p_amount < 4, 'la prueba necesita que lo cobrado sea menor que lo real');
  assert.equal(topups().length, 1);
  const b = JSON.parse(topups()[0].init.body);
  assert.equal(b.p_amount, 4 - cobro.p_amount);
  assert.equal(b.p_meta.real, 4);
  assert.equal(b.p_meta.charged, cobro.p_amount);
  const text = await r.clone().text();
  assert.equal((await r.json()).remaining, 7);
  assert.ok(!text.includes(TOKEN));
});

test('liquidación: si no alcanza el saldo cobra lo que quede y la imagen sale igual', async () => {
  reset({ openai: okConUso(usoCaro), topup: [{ ok: false, remaining: 1 }, { ok: true, remaining: 0 }] });
  const r = await generate.POST(genReq());
  assert.equal(r.status, 200);
  const falta = 4 - rpcBody('consume_credits').p_amount;
  assert.ok(falta >= 2, 'la prueba necesita que falten al menos 2 créditos');
  assert.deepEqual(topups().map((c) => JSON.parse(c.init.body).p_amount), [falta, 1]);
  assert.equal((await r.json()).remaining, 0);
});

test('liquidación: sin saldo en absoluto no cobra más, no falla y no devuelve nada', async () => {
  reset({ openai: okConUso(usoCaro), topup: { ok: false, remaining: 0 } });
  const r = await generate.POST(genReq());
  assert.equal(r.status, 200);
  assert.equal((await r.json()).remaining, 9);
  assert.equal(called('refund_credits').length, 0);
});

test('liquidación: un fallo de red en el cobro extra NO rompe la imagen ya generada', async () => {
  reset({ openai: okConUso(usoCaro), topupThrows: true });
  const r = await generate.POST(genReq());
  assert.equal(r.status, 200);
  assert.match((await r.json()).imageUrl, /^data:image\//);
  assert.equal(called('refund_credits').length, 0);
});

test('liquidación: si el uso real es menor o igual, o no hay uso, NO se cobra nada extra (y nunca se devuelve de más)', async () => {
  for (const usage of [{ input_tokens_details: { text_tokens: 14 }, output_tokens: 196 }, undefined]) {
    reset({ openai: okConUso(usage) });
    const r = await generate.POST(genReq());
    assert.equal(r.status, 200);
    assert.equal(topups().length, 0);
    assert.equal((await r.json()).remaining, 9);
  }
});

test('liquidación: los admin no pagan, así que no hay cobro extra aunque el uso sea caro', async () => {
  reset({ consume: { ok: true, remaining: 0, log_id: 7, refund_token: null }, openai: okConUso(usoCaro) });
  const r = await generate.POST(genReq());
  assert.equal(r.status, 200);
  assert.equal(called('/rpc/consume_credits').length, 1);
  assert.equal((await r.json()).remaining, 0);
});
