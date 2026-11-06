'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, Trash2, Undo2, X, MousePointerClick } from 'lucide-react';
import {
  type Pt, MIN_POLYGON_POINTS, clampPoint, distancePx, isValidPolygon, nearestVertex, polygonAt, sanitizePolygons, tracePolygon,
} from '@/lib/polygon-zone';

// ============================================
// Modal "Zona por puntos"
// ============================================
// Como en un mapa: se toca un punto, luego otro, y se forma una figura. Se cierra tocando el primer punto
// (o con «Cerrar figura» / Enter). Los puntos se pueden arrastrar para ajustar y puede haber varias figuras.
// Entrega polígonos NORMALIZADOS (0..1): ver src/lib/polygon-zone.ts.

interface PolygonZoneModalProps {
  image: HTMLImageElement;
  /** Figuras que ya existen (normalizadas) para seguir editándolas */
  initial: Pt[][];
  onApply: (polygons: Pt[][]) => void;
  onClose: () => void;
}

const ZONE_FILL = 'rgba(239, 68, 68, 0.35)';
const ZONE_STROKE = '#EF4444';
const ACCENT = '#D4F200'; // lima de la marca
const MAX_UPSCALE = 2;

const isCoarsePointer = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

export default function PolygonZoneModal({ image, initial, onApply, onClose }: PolygonZoneModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [polygons, setPolygons] = useState<Pt[][]>(() => initial.map((poly) => poly.map((p) => ({ ...p }))));
  const [current, setCurrent] = useState<Pt[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const [forceNew, setForceNew] = useState(false);
  const [notice, setNotice] = useState('');
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Arrastre de un vértice: poly = -1 es la figura en curso
  const drag = useRef<{ poly: number; vertex: number } | null>(null);

  const hitRadius = isCoarsePointer() ? 22 : 14;

  // ── Tamaño: la imagen ocupa todo el espacio disponible, sin deformarse ──
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const fit = () => {
      const cw = stage.clientWidth;
      const ch = stage.clientHeight;
      if (!cw || !ch) return;
      const fitScale = Math.min(cw / image.width, ch / image.height);
      const minComfortableScale = 360 / Math.max(1, Math.min(image.width, image.height));
      const scale = Math.min(fitScale, Math.max(MAX_UPSCALE, minComfortableScale));
      setSize({ w: Math.floor(image.width * scale), h: Math.floor(image.height * scale) });
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [image]);

  // ── Foco y scroll: el modal se comporta como un diálogo ──
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // ── Acciones ──
  const closeCurrent = useCallback(() => {
    if (current.length < MIN_POLYGON_POINTS) {
      setNotice(`Necesitas al menos ${MIN_POLYGON_POINTS} puntos para formar una figura.`);
      return false;
    }
    if (!isValidPolygon(current)) {
      setNotice('Esos puntos casi están en línea recta: sepáralos para formar un área.');
      return false;
    }
    setSelected(polygons.length);
    setPolygons((prev) => [...prev, current]);
    setCurrent([]);
    setNotice('');
    return true;
  }, [current, polygons.length]);

  const undo = useCallback(() => {
    setNotice('');
    if (current.length > 0) setCurrent((prev) => prev.slice(0, -1));
    else if (polygons.length > 0) {
      setPolygons((prev) => prev.slice(0, -1));
      setSelected(null);
    }
  }, [current.length, polygons.length]);

  const deleteSelected = useCallback(() => {
    if (selected === null) return;
    setPolygons((prev) => prev.filter((_, i) => i !== selected));
    setSelected(null);
    setNotice('');
  }, [selected]);

  const clearAll = () => {
    setPolygons([]);
    setCurrent([]);
    setSelected(null);
    setNotice('');
  };

  const apply = () => {
    let finalPolygons = polygons;
    // Una figura a medias con 3+ puntos se cierra sola; con menos se descarta
    if (current.length >= MIN_POLYGON_POINTS && isValidPolygon(current)) finalPolygons = [...polygons, current];
    onApply(sanitizePolygons(finalPolygons));
  };

  // ── Teclado ──
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        if (current.length > 0) closeCurrent();
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        if (current.length > 0) undo();
        else deleteSelected();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        undo();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        if (current.length > 0) { setCurrent([]); setNotice(''); }
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current.length, closeCurrent, undo, deleteSelected, onClose]);

  // ── Puntero (mouse, dedo o lápiz con la misma lógica) ──
  const toNormalized = (event: React.PointerEvent<HTMLCanvasElement>): Pt => {
    const rect = event.currentTarget.getBoundingClientRect();
    return clampPoint({ x: (event.clientX - rect.left) / rect.width, y: (event.clientY - rect.top) / rect.height });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const p = toNormalized(event);
    const { w, h } = size;
    setNotice('');

    if (current.length > 0) {
      // Cerrar: tocar el primer punto (con 3 o más)
      if (current.length >= MIN_POLYGON_POINTS && distancePx(p, current[0], w, h) <= hitRadius) {
        closeCurrent();
        return;
      }
      // Ajustar un punto ya colocado de la figura en curso
      const grabbed = nearestVertex(current, p, hitRadius, w, h, 0);
      if (grabbed >= 0) {
        drag.current = { poly: -1, vertex: grabbed };
        return;
      }
      setCurrent((prev) => [...prev, p]);
      return;
    }

    if (selected !== null) {
      const grabbed = nearestVertex(polygons[selected] ?? [], p, hitRadius, w, h);
      if (grabbed >= 0) {
        drag.current = { poly: selected, vertex: grabbed };
        return;
      }
    }
    if (!forceNew) {
      const hit = polygonAt(polygons, p);
      if (hit >= 0) {
        setSelected(hit);
        return;
      }
    }
    setSelected(null);
    setForceNew(false);
    setCurrent([p]);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p = toNormalized(event);
    setHover(p);
    const active = drag.current;
    if (!active) return;
    if (active.poly === -1) {
      setCurrent((prev) => prev.map((v, i) => (i === active.vertex ? p : v)));
    } else {
      setPolygons((prev) => prev.map((poly, pi) => (pi === active.poly ? poly.map((v, vi) => (vi === active.vertex ? p : v)) : poly)));
    }
  };

  const endPointer = () => {
    drag.current = null;
  };

  // ── Dibujo ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.w || !size.h) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { w, h } = size;
    const vertexRadius = isCoarsePointer() ? 9 : 6;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(image, 0, 0, w, h);

    polygons.forEach((poly, index) => {
      const isSelected = index === selected;
      tracePolygon(ctx, poly, w, h);
      ctx.fillStyle = ZONE_FILL;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.strokeStyle = isSelected ? ACCENT : ZONE_STROKE;
      ctx.stroke();
      if (isSelected) {
        poly.forEach((v) => {
          ctx.beginPath();
          ctx.arc(v.x * w, v.y * h, vertexRadius, 0, Math.PI * 2);
          ctx.fillStyle = '#fff';
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = ACCENT;
          ctx.stroke();
        });
      }
    });

    if (current.length > 0) {
      // Líneas ya colocadas + hilo elástico hasta el cursor
      ctx.beginPath();
      ctx.moveTo(current[0].x * w, current[0].y * h);
      for (let i = 1; i < current.length; i++) ctx.lineTo(current[i].x * w, current[i].y * h);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = ACCENT;
      ctx.setLineDash([]);
      ctx.stroke();
      if (hover) {
        const last = current[current.length - 1];
        ctx.beginPath();
        ctx.moveTo(last.x * w, last.y * h);
        ctx.lineTo(hover.x * w, hover.y * h);
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = ACCENT;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (current.length >= MIN_POLYGON_POINTS) {
        // Vista previa del relleno
        tracePolygon(ctx, current, w, h);
        ctx.fillStyle = 'rgba(212, 242, 0, 0.18)';
        ctx.fill();
      }
      current.forEach((v, i) => {
        const closable = i === 0 && current.length >= MIN_POLYGON_POINTS;
        ctx.beginPath();
        ctx.arc(v.x * w, v.y * h, closable ? vertexRadius + 4 : vertexRadius, 0, Math.PI * 2);
        ctx.fillStyle = closable ? ACCENT : '#fff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = closable ? '#000' : ACCENT;
        ctx.stroke();
      });
    }
  }, [size, image, polygons, current, selected, hover]);

  // ── Textos de ayuda según el estado ──
  const instruction = useMemo(() => {
    if (current.length === 0 && polygons.length === 0) return 'Toca la imagen para colocar el primer punto de la zona.';
    if (current.length > 0 && current.length < MIN_POLYGON_POINTS) return `Sigue colocando puntos (${current.length}). Necesitas al menos ${MIN_POLYGON_POINTS}.`;
    if (current.length >= MIN_POLYGON_POINTS) return `${current.length} puntos. Toca el primer punto (el grande y verde) o «Cerrar figura» para terminar.`;
    return 'Toca una figura para ajustarla (arrastra sus puntos) o crea otra con «Nueva figura».';
  }, [current.length, polygons.length]);

  const canApply = polygons.length > 0 || (current.length >= MIN_POLYGON_POINTS && isValidPolygon(current));
  const buttonBase = 'inline-flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 min-h-11 px-1 sm:px-4 text-xs font-bold uppercase tracking-normal sm:tracking-wider border border-border transition-colors disabled:opacity-40 disabled:cursor-not-allowed';

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar zona por puntos"
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex flex-col bg-background text-foreground outline-none"
    >
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4 px-4 sm:px-6 pt-4 pb-3 border-b border-border">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm sm:text-base font-black uppercase tracking-tight">
            <MousePointerClick className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            Seleccionar zona por puntos
          </h2>
          <p role="status" aria-live="polite" className="mt-1 text-xs sm:text-sm text-muted-foreground">
            {notice || instruction}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar sin aplicar" className="inline-flex items-center justify-center w-11 h-11 shrink-0 border border-border hover:bg-foreground hover:text-background">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Imagen */}
      <div ref={stageRef} className="relative flex-1 min-h-0 flex items-center justify-center p-2 sm:p-4 bg-black/10">
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onPointerLeave={() => setHover(null)}
          style={{ width: size.w, height: size.h, touchAction: 'none', cursor: 'crosshair' }}
          className="block border border-border"
          aria-label="Imagen: toca para colocar los puntos de la zona"
        />
      </div>

      {/* Acciones: en celular, herramientas en una fila de 5 y Cancelar/Aplicar debajo a ancho completo */}
      <div className="border-t border-border px-3 sm:px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-2 sm:space-y-0">
        <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <button type="button" onClick={undo} disabled={current.length === 0 && polygons.length === 0} aria-label="Deshacer" className={buttonBase}>
            <Undo2 className="w-4 h-4" aria-hidden="true" /> <span>Deshacer</span>
          </button>
          <button type="button" onClick={closeCurrent} disabled={current.length < MIN_POLYGON_POINTS} aria-label="Cerrar figura" className={buttonBase}>
            <Check className="w-4 h-4" aria-hidden="true" /> <span>Cerrar<span className="hidden sm:inline"> figura</span></span>
          </button>
          <button
            type="button"
            onClick={() => { setForceNew(true); setSelected(null); setNotice('Toca la imagen para empezar otra figura.'); }}
            disabled={current.length > 0 || polygons.length === 0}
            aria-label="Nueva figura"
            className={buttonBase}
          >
            <Plus className="w-4 h-4" aria-hidden="true" /> <span>Nueva<span className="hidden sm:inline"> figura</span></span>
          </button>
          <button type="button" onClick={deleteSelected} disabled={selected === null} aria-label="Borrar figura" className={buttonBase}>
            <Trash2 className="w-4 h-4" aria-hidden="true" /> <span>Borrar<span className="hidden sm:inline"> figura</span></span>
          </button>
          <button type="button" onClick={clearAll} disabled={polygons.length === 0 && current.length === 0} aria-label="Limpiar todo" className={buttonBase}>
            <span>Limpiar<span className="hidden sm:inline"> todo</span></span>
          </button>
          <div className="hidden sm:block flex-1" />
          <span className="hidden sm:inline text-xs text-muted-foreground sm:mr-2">
            {polygons.length} {polygons.length === 1 ? 'figura' : 'figuras'}
          </span>
          <div className="hidden sm:flex gap-2">
            <button type="button" onClick={onClose} className={buttonBase}>Cancelar</button>
            <button type="button" onClick={apply} disabled={!canApply} className={`${buttonBase} bg-primary text-primary-foreground border-primary hover:opacity-90`}>
              Aplicar zona
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:hidden">
          <button type="button" onClick={onClose} className={buttonBase}>Cancelar</button>
          <button type="button" onClick={apply} disabled={!canApply} className={`${buttonBase} bg-primary text-primary-foreground border-primary hover:opacity-90`}>
            Aplicar zona
          </button>
        </div>
        <p className="sr-only">Atajos: Enter cierra la figura, Retroceso quita el último punto, Escape cancela.</p>
      </div>
    </div>,
    document.body,
  );
}

