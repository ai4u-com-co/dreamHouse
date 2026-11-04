import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from './ui/Button';
import { Undo, Trash2, Pencil, ImagePlus, Pentagon } from 'lucide-react';
import PolygonZoneModal from './PolygonZoneModal';
import { tracePolygon, type Pt } from '@/lib/polygon-zone';

export interface EditMaskPayload {
  /** Imagen original limpia (sin trazos), en PNG, del mismo tamaño que la máscara */
  base: File;
  /** PNG con canal alfa: la zona transparente es la que el modelo puede cambiar */
  mask: File;
}

interface SketchCanvasProps {
  baseImage: File | null;
  onCompositeImageUpdate: (file: File | null) => void;
  /** Se llama con base + máscara cuando hay zona pintada, o con null si no hay */
  onMaskUpdate?: (payload: EditMaskPayload | null) => void;
}

type DrawMode = 'notas' | 'zona';

// Lado máximo de la base y la máscara enviadas al modelo (mantiene el PNG por debajo de los límites de carga)
const MASK_EXPORT_MAX_SIDE = 2048;
// El pincel de zona es más grueso que el de notas: se pinta un área, no una línea
const ZONE_BRUSH_FACTOR = 10;
const ZONE_BRUSH_MIN = 40;

interface Point {
  x: number;
  y: number;
}

interface Line {
  /** 'zona' y 'notas': píxeles del lienzo. 'poligono': coordenadas normalizadas 0..1 (ver lib/polygon-zone) */
  points: Point[];
  color: string;
  size: number;
  kind: DrawMode | 'poligono';
}

function zoneLineWidth(size: number): number {
  return Math.max(size * ZONE_BRUSH_FACTOR, ZONE_BRUSH_MIN);
}

function canvasToPngFile(canvas: HTMLCanvasElement, name: string): Promise<File | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob ? new File([blob], name, { type: 'image/png' }) : null), 'image/png');
  });
}

export default function SketchCanvas({ baseImage, onCompositeImageUpdate, onMaskUpdate }: SketchCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [lines, setLines] = useState<Line[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#EF4444'); // Red by default for notes
  const [brushSize, setBrushSize] = useState(3);
  const [mode, setMode] = useState<DrawMode>('notas');
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [polygonOpen, setPolygonOpen] = useState(false);

  // Load the image object when baseImage changes
  useEffect(() => {
    if (baseImage) {
      const url = URL.createObjectURL(baseImage);
      const img = new window.Image();
      img.src = url;
      img.onload = () => {
        setImageObj(img);
        setLines([]); // Reset lines on new image
      };
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setImageObj(null);
      setLines([]);
    }
  }, [baseImage]);

  // Redraw canvas whenever lines, image, or container size changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust canvas size to match image aspect ratio but fit in container
    const container = containerRef.current;
    if (container) {
      const maxWidth = container.clientWidth;
      const maxHeight = 600; // fixed max height for edit view
      
      let newWidth = imageObj.width;
      let newHeight = imageObj.height;
      const ratio = Math.min(maxWidth / newWidth, maxHeight / newHeight);
      
      if (ratio < 1) {
        newWidth *= ratio;
        newHeight *= ratio;
      }
      
      if (canvas.width !== newWidth || canvas.height !== newHeight) {
        canvas.width = newWidth;
        canvas.height = newHeight;
      }
    }

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // Draw all lines
    lines.forEach((line) => {
      if (line.points.length === 0) return;
      if (line.kind === 'poligono') {
        tracePolygon(ctx, line.points, canvas.width, canvas.height);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
        ctx.lineJoin = 'round';
        ctx.stroke();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(line.points[0].x, line.points[0].y);
      for (let i = 1; i < line.points.length; i++) {
        ctx.lineTo(line.points[i].x, line.points[i].y);
      }
      if (line.kind === 'zona') {
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
        ctx.lineWidth = zoneLineWidth(line.size);
      } else {
        ctx.strokeStyle = line.color;
        ctx.lineWidth = line.size;
      }
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    });
  }, [lines, imageObj]);

  const generateCompositeFile = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !baseImage) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'edited_image.png', { type: 'image/png' });
        onCompositeImageUpdate(file);
      }
    }, 'image/png', 0.95);
  }, [baseImage, onCompositeImageUpdate]);

  // Exporta la base limpia y la máscara (alfa) a partir de los trazos de "zona".
  // Las notas no entran en la máscara: siguen yendo solo en la imagen compuesta.
  const generateMaskFiles = useCallback(async () => {
    const canvas = canvasRef.current;
    const zoneLines = lines.filter((l) => (l.kind === 'zona' || l.kind === 'poligono') && l.points.length > 0);
    if (!onMaskUpdate) return;
    if (!canvas || !imageObj || zoneLines.length === 0) {
      onMaskUpdate(null);
      return;
    }

    const scale = Math.min(1, MASK_EXPORT_MAX_SIDE / Math.max(imageObj.width, imageObj.height));
    const w = Math.round(imageObj.width * scale);
    const h = Math.round(imageObj.height * scale);
    const toExport = w / canvas.width; // del canvas visible al tamaño de exportación

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = w;
    baseCanvas.height = h;
    baseCanvas.getContext('2d')?.drawImage(imageObj, 0, 0, w, h);

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = w;
    maskCanvas.height = h;
    const mctx = maskCanvas.getContext('2d');
    if (!mctx) { onMaskUpdate(null); return; }
    // Todo opaco = se conserva; lo pintado se vuelve transparente = editable
    mctx.fillStyle = '#000000';
    mctx.fillRect(0, 0, w, h);
    mctx.globalCompositeOperation = 'destination-out';
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    mctx.strokeStyle = '#000000';
    mctx.fillStyle = '#000000';
    zoneLines.forEach((line) => {
      if (line.kind === 'poligono') {
        // Figura por puntos: ya viene normalizada, se rellena a la resolución de exportación (destination-out = editable)
        tracePolygon(mctx, line.points, w, h);
        mctx.fill();
        return;
      }
      const width = zoneLineWidth(line.size) * toExport;
      mctx.lineWidth = width;
      if (line.points.length === 1) {
        mctx.beginPath();
        mctx.arc(line.points[0].x * toExport, line.points[0].y * toExport, width / 2, 0, Math.PI * 2);
        mctx.fill();
        return;
      }
      mctx.beginPath();
      mctx.moveTo(line.points[0].x * toExport, line.points[0].y * toExport);
      for (let i = 1; i < line.points.length; i++) {
        mctx.lineTo(line.points[i].x * toExport, line.points[i].y * toExport);
      }
      mctx.stroke();
    });

    const [base, mask] = await Promise.all([
      canvasToPngFile(baseCanvas, 'edit_base.png'),
      canvasToPngFile(maskCanvas, 'edit_mask.png'),
    ]);
    onMaskUpdate(base && mask ? { base, mask } : null);
  }, [lines, imageObj, onMaskUpdate]);

  // Export the composite only when the user finishes a stroke or changes lines
  // while not drawing (undo, clear). Never during active drawing.
  useEffect(() => {
    if (!isDrawing) {
      generateCompositeFile();
      void generateMaskFiles();
    }
  }, [lines, isDrawing, generateCompositeFile, generateMaskFiles]);

  // Drawing event handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!imageObj) return;
    setIsDrawing(true);
    const coords = getCoordinates(e);
    if (coords) {
      setLines([...lines, { points: [coords], color, size: brushSize, kind: mode }]);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !imageObj) return;
    e.preventDefault(); // Prevent scrolling on touch
    const coords = getCoordinates(e);
    if (coords) {
      setLines((prev) => {
        const newLines = [...prev];
        const currentLine = newLines[newLines.length - 1];
        if (currentLine) {
          currentLine.points.push(coords);
        }
        return newLines;
      });
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  /** Reemplaza todas las figuras por puntos por las que devuelve el modal (las demás marcas no se tocan) */
  const applyPolygons = (polygons: Pt[][]) => {
    setLines((prev) => [
      ...prev.filter((l) => l.kind !== 'poligono'),
      ...polygons.map((points): Line => ({ points, color: '#EF4444', size: brushSize, kind: 'poligono' })),
    ]);
    setPolygonOpen(false);
  };

  const handleUndo = () => {
    setLines((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setLines([]);
  };

  if (!baseImage) {
    return (
      <div className="w-full min-h-[300px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center p-8 text-center bg-card">
        <ImagePlus className="w-12 h-12 text-muted-foreground mb-4" />
        <h4 className="text-lg font-bold uppercase tracking-wider mb-2">No Image Selected</h4>
        <p className="text-sm text-muted-foreground max-w-sm">
          Please upload a base image to start editing and drawing your notes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-xl border border-border">
        <div className="flex items-center gap-2 pr-4 border-r border-border">
          <Pencil className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Herramientas</span>
        </div>
        
        {/* Modo de dibujo */}
        <div className="flex items-center gap-1 rounded-lg border border-border p-1" role="group" aria-label="Modo de dibujo">
          {([['notas', 'Notas'], ['zona', 'Zona a cambiar']] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              aria-pressed={mode === value}
              className={`min-h-[44px] px-3 text-xs font-semibold rounded-md cursor-pointer transition-colors ${mode === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Zona por puntos: abre el modal para trazar un polígono punto a punto */}
        <button
          type="button"
          onClick={() => { setMode('zona'); setPolygonOpen(true); }}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 text-xs font-semibold rounded-md border border-primary text-foreground hover:bg-primary hover:text-primary-foreground transition-colors cursor-pointer"
        >
          <Pentagon className="w-4 h-4" aria-hidden="true" />
          Zona por puntos
        </button>

        <div className="h-6 w-px bg-border" />

        {/* Colors */}
        <div className={`flex items-center gap-2 ${mode === 'zona' ? 'opacity-40 pointer-events-none' : ''}`}>
          {['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#000000', '#FFFFFF'].map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${color === c ? 'scale-125 ring-2 ring-primary ring-offset-2 ring-offset-background' : 'hover:scale-110'}`}
              style={{ backgroundColor: c, border: c === '#FFFFFF' ? '1px solid #ccc' : 'none' }}
              aria-label={`Select color ${c}`}
            />
          ))}
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Brush Size */}
        <div className="flex items-center gap-3">
          <span className="text-xs uppercase font-medium mt-0.5">Size:</span>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24 accent-primary"
          />
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={handleUndo} disabled={lines.length === 0} className="h-8 px-3">
            <Undo className="w-4 h-4 mr-2" />
            <span className="text-xs">Undo</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleClear} disabled={lines.length === 0} className="h-8 px-3 text-destructive hover:text-destructive hover:bg-destructive/10">
            <Trash2 className="w-4 h-4 mr-2" />
            <span className="text-xs">Clear</span>
          </Button>
        </div>
      </div>

      {/* Canvas Container */}
      <div 
        ref={containerRef} 
        className="relative w-full bg-black/5 rounded-xl border border-border overflow-hidden flex items-center justify-center min-h-[400px]"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseOut={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ touchAction: 'none', cursor: 'crosshair' }}
          className="max-w-full outline-none"
        />
      </div>
      <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-2">
        <Pencil className="w-3 h-3" />
        {mode === 'zona'
          ? 'Pinta la zona que quieres cambiar o usa «Zona por puntos» para marcarla con puntos, como en un mapa. Con OpenAI solo se modificará esa zona; el resto de la imagen se conserva.'
          : 'Dibuja sobre la imagen para señalar exactamente qué quieres modificar.'}
      </p>

      {polygonOpen && imageObj && (
        <PolygonZoneModal
          image={imageObj}
          initial={lines.filter((l) => l.kind === 'poligono').map((l) => l.points)}
          onApply={applyPolygons}
          onClose={() => setPolygonOpen(false)}
        />
      )}
    </div>
  );
}
