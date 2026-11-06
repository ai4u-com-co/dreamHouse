import React from 'react';
import Image from 'next/image';
import { Trash2, Download, RotateCcw, Clock, Layout, Home, Armchair, Wand, ZoomIn, FileJson } from 'lucide-react';
import { Button } from './ui/Button';
import { GenerationRecord, dbFor, MAX_HISTORY } from '../lib/db';
import { buildParamsFile } from '../lib/restore-params';
import { useLightbox } from '../context/LightboxContext';
import { useAuth } from '../context/AuthContext';

// Descarga el render full-res (Blob) on-demand. Si no existe (registro previo a v2),
// cae al thumbnail para no dejar al usuario sin descarga. El historial es de UNA cuenta (`ownerId`).
async function downloadGeneration(item: GenerationRecord, ownerId: string | null) {
  try {
    const blob = ownerId ? await dbFor(ownerId).getFullImage(item.id) : null;
    const ext = blob?.type === 'image/jpeg' ? 'jpg' : blob?.type === 'image/webp' ? 'webp' : 'png';
    const url = blob ? URL.createObjectURL(blob) : item.imageUrl;
    const a = document.createElement('a');
    a.href = url;
    a.download = `dreamhouse-${item.mode}-${item.id.slice(0, 8)}.${blob ? ext : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    if (blob) setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error('Failed to download generation:', err);
  }
}

/** Descarga un archivo de parámetros (.json) de la generación: se puede volver a subir con «Recuperar parámetros» */
function downloadParams(item: GenerationRecord) {
  const file = buildParamsFile({ mode: item.mode, params: item.params, houseName: item.houseName, timestamp: item.timestamp });
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `dreamhouse-parametros-${item.mode}-${item.id.slice(0, 8)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

interface HistoryGalleryProps {
  history: GenerationRecord[];
  onLoad: (record: GenerationRecord) => void;
  onDelete: (id: string) => void;
  onClear: () => void;
  isLoading: boolean;
}

export default function HistoryGallery({
  history,
  onLoad,
  onDelete,
  onClear,
  isLoading
}: HistoryGalleryProps) {
  const { openLightbox } = useLightbox();
  const { userId } = useAuth();

  const formatDate = (timestamp: number) => {
    try {
      // Fallback to native if date-fns is not available
      return Intl.DateTimeFormat('es-ES', { 
        day: '2-digit', 
        month: 'short', 
        hour: '2-digit', 
        minute: '2-digit' 
      }).format(new Date(timestamp));
    } catch {
      return new Date(timestamp).toLocaleDateString();
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'exterior': return <Home className="w-3 h-3" />;
      case 'interior': return <Armchair className="w-3 h-3" />;
      case 'edit': return <Wand className="w-3 h-3" />;
      default: return <Layout className="w-3 h-3" />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case 'exterior': return 'Exterior';
      case 'interior': return 'Interior';
      case 'edit': return 'Edición';
      default: return mode;
    }
  };

  if (history.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center opacity-40">
        <Clock className="w-12 h-12 mb-4" />
        <p className="text-sm font-medium uppercase tracking-widest">No hay generaciones guardadas</p>
        <p className="text-xs mt-2">Tus renders aparecerán aquí automáticamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col gap-1">
          <h3 className="text-sm font-mono text-primary uppercase tracking-[0.3em] font-bold">Historial de Generaciones</h3>
          <p className="text-xs text-muted-foreground">
            {history.length} de {MAX_HISTORY}: al llenarse, los más antiguos se borran. Se guarda solo en este navegador; cada imagen descargada conserva sus parámetros.
          </p>
        </div>
        {history.length > 0 && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onClear}
            className="text-xs uppercase font-bold tracking-tighter opacity-50 hover:opacity-100 transition-opacity"
          >
            Limpiar Todo
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {history.map((item, index) => (
          <div 
            key={item.id} 
            className="group relative bg-card border border-border overflow-hidden hover:border-primary/50 transition-all duration-300 flex flex-col"
          >
            {/* Image Preview */}
            <div 
              className="relative aspect-video overflow-hidden bg-black/20 cursor-pointer"
              onClick={() => {
                const images = history.map(h => ({
                  url: h.imageUrl,
                  type: getModeLabel(h.mode),
                  id: h.id
                }));
                openLightbox(images, index);
              }}
            >
              <Image
                src={item.imageUrl}
                alt={`Generación ${item.mode}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                unoptimized
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <ZoomIn className="w-8 h-8 text-white scale-90 group-hover:scale-100 transition-transform duration-300" />
              </div>

              {/* Mode Badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-xs font-bold uppercase tracking-tighter text-white border border-white/10">
                {getModeIcon(item.mode)}
                {getModeLabel(item.mode)}
              </div>

              {/* Quick Actions Overlay */}
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadGeneration(item, userId); }}
                  className="p-1.5 bg-primary text-primary-foreground rounded hover:scale-110 transition-transform"
                  title="Descargar en alta resolución"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    onDelete(item.id); 
                  }}
                  className="p-1.5 bg-destructive text-destructive-foreground rounded hover:scale-110 transition-transform"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>


            {/* Metadata */}
            <div className="p-4 flex-1 flex flex-col justify-between gap-4">
              <div className="space-y-1">
                <div className="flex justify-between items-start">
                  <span className="text-xs font-mono text-muted-foreground uppercase">{formatDate(item.timestamp)}</span>
                </div>
                {item.params.city && (
                  <p className="text-xs font-bold uppercase truncate">{item.params.city}</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.params.architecturalStyles.slice(0, 2).map((s, i) => (
                    <span key={i} className="text-xs px-1.5 py-0.5 bg-muted rounded font-medium text-muted-foreground uppercase truncate max-w-[80px]">
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => onLoad(item)}
                className="w-full py-4 text-xs font-black uppercase tracking-widest bg-foreground text-background hover:bg-primary hover:text-primary-foreground transition-colors mt-auto"
              >
                <RotateCcw className="w-3 h-3 mr-2" />
                Cargar Parámetros
              </Button>
              <button
                type="button"
                onClick={() => downloadParams(item)}
                className="inline-flex items-center justify-center gap-2 min-h-[44px] w-full border border-border text-xs font-bold uppercase tracking-widest text-muted-foreground hover:border-primary/60 hover:text-foreground transition-colors"
              >
                <FileJson className="w-3.5 h-3.5" />
                Descargar parámetros (.json)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
