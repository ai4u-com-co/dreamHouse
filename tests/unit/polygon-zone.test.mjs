// Geometría de la selección de zona por puntos. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  polygonArea, isValidPolygon, pointInPolygon, nearestVertex, polygonAt, tracePolygon, sanitizePolygons, distancePx, MIN_POLYGON_POINTS,
} from '@/lib/polygon-zone';

const square = [{ x: 0.2, y: 0.2 }, { x: 0.6, y: 0.2 }, { x: 0.6, y: 0.6 }, { x: 0.2, y: 0.6 }];
// Forma en L (cóncava): el hueco está en la esquina superior derecha
const ele = [{ x: 0.1, y: 0.1 }, { x: 0.4, y: 0.1 }, { x: 0.4, y: 0.5 }, { x: 0.9, y: 0.5 }, { x: 0.9, y: 0.9 }, { x: 0.1, y: 0.9 }];

test('el área de un cuadrado de 0,4 x 0,4 es 0,16 (sin importar el sentido del giro)', () => {
  assert.ok(Math.abs(polygonArea(square) - 0.16) < 1e-9);
  assert.ok(Math.abs(polygonArea([...square].reverse()) - 0.16) < 1e-9);
});

test('menos de 3 puntos o puntos alineados no son un área válida', () => {
  assert.equal(MIN_POLYGON_POINTS, 3);
  assert.equal(isValidPolygon(square.slice(0, 2)), false);
  assert.equal(isValidPolygon([{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }]), false, 'tres puntos en línea recta');
  assert.equal(isValidPolygon(square), true);
});

test('punto dentro/fuera, también en una forma cóncava', () => {
  assert.equal(pointInPolygon({ x: 0.4, y: 0.4 }, square), true);
  assert.equal(pointInPolygon({ x: 0.7, y: 0.4 }, square), false);
  assert.equal(pointInPolygon({ x: 0.2, y: 0.7 }, ele), true, 'brazo vertical de la L');
  assert.equal(pointInPolygon({ x: 0.7, y: 0.7 }, ele), true, 'brazo horizontal de la L');
  assert.equal(pointInPolygon({ x: 0.7, y: 0.2 }, ele), false, 'el hueco de la L');
});

test('el vértice más cercano se mide en píxeles, no en fracciones', () => {
  // Imagen de 1000 x 500 px: 0,01 de ancho = 10 px, 0,01 de alto = 5 px
  const near = { x: 0.2 + 0.01, y: 0.2 };
  assert.equal(nearestVertex(square, near, 12, 1000, 500), 0);
  assert.equal(nearestVertex(square, near, 8, 1000, 500), -1, 'a 10 px queda fuera de un radio de 8');
  assert.equal(nearestVertex(square, { x: 0.2, y: 0.2 }, 12, 1000, 500, 0), -1, 'se puede ignorar un vértice (el primero, al cerrar)');
  assert.ok(Math.abs(distancePx({ x: 0, y: 0 }, { x: 0.1, y: 0.2 }, 1000, 500) - Math.hypot(100, 100)) < 1e-9);
});

test('al tocar donde hay varias figuras se elige la de arriba (la última)', () => {
  const small = [{ x: 0.3, y: 0.3 }, { x: 0.5, y: 0.3 }, { x: 0.5, y: 0.5 }, { x: 0.3, y: 0.5 }];
  assert.equal(polygonAt([square, small], { x: 0.4, y: 0.4 }), 1);
  assert.equal(polygonAt([square, small], { x: 0.55, y: 0.25 }), 0);
  assert.equal(polygonAt([square, small], { x: 0.9, y: 0.9 }), -1);
});

test('tracePolygon escala a la resolución pedida y cierra la figura', () => {
  const calls = [];
  const ctx = {
    beginPath: () => calls.push(['begin']),
    moveTo: (x, y) => calls.push(['move', x, y]),
    lineTo: (x, y) => calls.push(['line', x, y]),
    closePath: () => calls.push(['close']),
  };
  tracePolygon(ctx, square, 2000, 1000);
  assert.deepEqual(calls[0], ['begin']);
  assert.deepEqual(calls[1], ['move', 400, 200]);
  assert.deepEqual(calls[2], ['line', 1200, 200]);
  assert.deepEqual(calls.at(-1), ['close']);
  assert.equal(calls.filter((c) => c[0] === 'line').length, 3);
});

test('sanitizePolygons acota los puntos a la imagen y descarta las figuras inválidas', () => {
  const out = sanitizePolygons([
    [{ x: -0.5, y: -0.5 }, { x: 1.5, y: -0.5 }, { x: 1.5, y: 1.5 }, { x: -0.5, y: 1.5 }],
    [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }],
    [{ x: 0.1, y: 0.1 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.9 }],
  ]);
  assert.equal(out.length, 1);
  assert.deepEqual(out[0], [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
});
