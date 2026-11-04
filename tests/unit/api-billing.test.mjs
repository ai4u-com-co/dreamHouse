// Rutas /api con Supabase y OpenAI simulados a nivel de fetch (sin red ni secretos). La clave de OpenAI es de Mariano:
// aquí se prueba que NADA se genera sin sesión y saldo, que el cobro va ANTES de OpenAI, que se devuelve si falla y que el
// token de devolución y los errores crudos de OpenAI jamás llegan al navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { DEFAULT_PARAMS } from '@/types';
import { renderCredits, ASSISTANT_CREDITS } from '@/lib/billing';

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
  if (url.includes('/rest/v1/rpc/consume_credits')) return world.consumeError ? j(world.consumeError.http, world.consumeError.body) : j(200, world.consume);
  if (url.includes('/rest/v1/rpc/refund_credits')) return j(200, world.refund);
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
test('precios: calidad × (2 en 2K/4K y en edición)', () => {
  assert.equal(renderCredits('low', '', 'exterior'), 1);
  assert.equal(renderCredits('medium', '1K', 'exterior'), 4);
  assert.equal(renderCredits('high', '', 'exterior'), 15);
  assert.equal(renderCredits('high', '2K', 'exterior'), 30);
  assert.equal(renderCredits('low', '4K', 'exterior'), 2);
  assert.equal(renderCredits('low', '', 'edit'), 2);
  assert.equal(renderCredits('xhigh', '2K', 'exterior'), 60);
  assert.equal(renderCredits('constructor', '', 'exterior'), 1, 'una clave heredada no es una calidad: cae en la más barata, nunca en NaN');
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
  assert.equal(cobro.p_amount, 1);
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

test('generate: calidad Alta en 2K cuesta 30; Máxima en 4K se acota a 2K (60); Borrador en 4K cuesta 2', async () => {
  reset();
  await generate.POST(genReq({ renderQuality: 'Alta', renderOutputResolution: '2K' }));
  assert.equal(rpcBody('consume_credits').p_amount, 30);
  reset();
  await generate.POST(genReq({ renderQuality: 'Máxima', renderOutputResolution: '4K' }));
  assert.equal(rpcBody('consume_credits').p_amount, 60);
  reset();
  await generate.POST(genReq({ renderQuality: 'Borrador', renderOutputResolution: '4K' }));
  assert.equal(rpcBody('consume_credits').p_amount, 2);
  const size = JSON.parse(called('api.openai.com/v1/images')[0].init.body).size;
  const [w, h] = size.split('x').map(Number);
  assert.ok(w * h <= 2560 * 1440 + 16 * 16 * 100, `4K debe acotarse a 2K, llegó ${size}`);
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
