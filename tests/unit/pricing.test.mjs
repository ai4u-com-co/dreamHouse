// El cobro NUNCA puede quedar por debajo de lo que OpenAI cuenta de verdad (hallazgos de subcobro, 5-nov-2026).
// Los puntos viven en tests/fixtures/medido-2026-11-05.json: son llamadas reales a la API (calidad low).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { estimateOutputTokens, promptCostUnits, textTokens, creditsFor } = await import('@/lib/openai-image-core.ts');
const medido = JSON.parse(readFileSync(new URL('./fixtures/medido-2026-11-05.json', import.meta.url), 'utf8'));

test('tokens de salida: ningún tamaño medido se cobra por debajo de lo real', () => {
  for (const s of medido.sizes) {
    const est = estimateOutputTokens('low', s.width, s.height);
    assert.ok(est >= s.outputTokens, `${s.width}x${s.height}: se cobra ${est} y la API contó ${s.outputTokens}`);
  }
});

test('borde 1792x1280 (ratio 1,4): antes se cobraban 157 tokens y la API cuenta 189', () => {
  assert.ok(estimateOutputTokens('low', 1792, 1280) >= 189);
  assert.ok(estimateOutputTokens('low', 1680, 1120) >= 171); // ratio exacto 1,5
  assert.ok(estimateOutputTokens('low', 2048, 1408) >= 215);
});

test('la curva es monótona entre los puntos medidos de la banda 1,25–1,5 (sin escalones hacia abajo)', () => {
  let prev = 0;
  for (const [w, h] of [[1024, 768], [1152, 864], [1280, 960], [1280, 1024], [1408, 1024], [1536, 1152], [1600, 1120], [1664, 1152], [1792, 1280], [2048, 1408]]) {
    const e = estimateOutputTokens('low', w, h);
    assert.ok(e >= prev, `${w}x${h}: ${e} < ${prev}`);
    prev = e;
  }
});

test('ratios sin medir caen a la curva cuadrada (la más cara), nunca a una más barata', () => {
  const cuadrada = estimateOutputTokens('low', 1280, 1280);
  assert.ok(estimateOutputTokens('low', 1280, 1152) >= 196); // ratio 1,11
  assert.ok(estimateOutputTokens('low', 1440, 1152) >= 155); // ratio 1,25, 1,66 Mpx: banda medida
  assert.ok(cuadrada >= 196);
  // banda 1,25–1,5 por encima del último punto medido (2,88 Mpx): cae a la cuadrada
  assert.ok(estimateOutputTokens('low', 2112, 1584) >= estimateOutputTokens('low', 2048, 1408));
});

test('verticales cuestan igual que su apaisado', () => {
  assert.equal(estimateOutputTokens('low', 1024, 1536), estimateOutputTokens('low', 1536, 1024));
  assert.equal(estimateOutputTokens('low', 720, 1280), estimateOutputTokens('low', 1280, 720));
});

test('tokens de texto: ningún prompt medido (natural, dígitos, signos, CJK, emoji) se cobra por debajo de lo real', () => {
  for (const p of medido.prompts) {
    const cobrado = textTokens(promptCostUnits(p.text));
    assert.ok(cobrado >= p.textTokens, `${p.name}: se cobra ${cobrado} y la API contó ${p.textTokens}`);
  }
});

test('promptCostUnits: el CJK y los emojis ya no valen bytes/3', () => {
  const cjk = '設'.repeat(600); // 1800 bytes -> bytes/3 = 600; la API contó ~1151 para 600 caracteres CJK
  assert.ok(textTokens(promptCostUnits(cjk)) >= 1151);
  assert.equal(promptCostUnits(''), 0);
});

test('un prompt de texto natural de 1000 caracteres cuesta 3 créditos a 1024² calidad low (la cota cobra ~3× el texto real)', () => {
  const natural = medido.prompts.find((p) => p.name === 'espanol_natural').text.slice(0, 1000);
  const c = creditsFor({ quality: 'low', width: 1024, height: 1024, n: 1, promptChars: promptCostUnits(natural) });
  assert.equal(c, 3);
});
