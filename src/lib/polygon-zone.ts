// ============================================
// Geometría de la selección de zona por puntos (polígono)
// ============================================
// Los polígonos se guardan en coordenadas NORMALIZADAS (0..1 sobre el ancho y el alto de la imagen), no en
// píxeles del lienzo: así no se desfasan si la ventana cambia de tamaño y se exportan a cualquier resolución.
// Funciones puras (sin DOM) para poder probarlas.

export interface Pt {
  x: number;
  y: number;
}

/** Mínimo de vértices para que una figura sea un área */
export const MIN_POLYGON_POINTS = 3;
/** Área mínima (fracción de la imagen) para no aceptar figuras degeneradas, p. ej. tres puntos casi alineados */
export const MIN_POLYGON_AREA = 0.0002;

export const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

export function clampPoint(p: Pt): Pt {
  return { x: clamp01(p.x), y: clamp01(p.y) };
}

/** Distancia en píxeles entre dos puntos normalizados, dado el tamaño en pantalla de la imagen */
export function distancePx(a: Pt, b: Pt, width: number, height: number): number {
  return Math.hypot((a.x - b.x) * width, (a.y - b.y) * height);
}

/** Área (fórmula del zapato) como fracción de la imagen; 0 si hay menos de 3 puntos */
export function polygonArea(points: readonly Pt[]): number {
  if (points.length < MIN_POLYGON_POINTS) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

export function isValidPolygon(points: readonly Pt[]): boolean {
  return points.length >= MIN_POLYGON_POINTS && polygonArea(points) >= MIN_POLYGON_AREA;
}

/** ¿El punto está dentro del polígono? (trazado de rayos) */
export function pointInPolygon(p: Pt, points: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i];
    const b = points[j];
    const crosses = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Índice del vértice más cercano a `p` dentro de `radiusPx`, o -1. Empata a favor del último (el de arriba). */
export function nearestVertex(points: readonly Pt[], p: Pt, radiusPx: number, width: number, height: number, skip = -1): number {
  let best = -1;
  let bestDistance = radiusPx;
  points.forEach((v, i) => {
    if (i === skip) return;
    const d = distancePx(v, p, width, height);
    if (d <= bestDistance) {
      best = i;
      bestDistance = d;
    }
  });
  return best;
}

/** Índice del polígono (el de más arriba) que contiene `p`, o -1 */
export function polygonAt(polygons: readonly (readonly Pt[])[], p: Pt): number {
  for (let i = polygons.length - 1; i >= 0; i--) {
    if (pointInPolygon(p, polygons[i])) return i;
  }
  return -1;
}

/** Subconjunto de CanvasRenderingContext2D que usamos para trazar (permite probar con un doble) */
export interface PathContext {
  beginPath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  closePath(): void;
}

/** Traza el polígono (normalizado) en un contexto de `width` x `height`; no pinta ni rellena */
export function tracePolygon(ctx: PathContext, points: readonly Pt[], width: number, height: number): void {
  if (points.length === 0) return;
  ctx.beginPath();
  ctx.moveTo(points[0].x * width, points[0].y * height);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x * width, points[i].y * height);
  ctx.closePath();
}

/** Se descartan las figuras inválidas y se acotan los puntos a la imagen (datos que vienen de la UI) */
export function sanitizePolygons(polygons: readonly (readonly Pt[])[]): Pt[][] {
  return polygons
    .map((poly) => poly.map(clampPoint))
    .filter(isValidPolygon);
}
