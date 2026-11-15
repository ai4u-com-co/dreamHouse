'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { X, Loader2, Images } from 'lucide-react';
import { useRenderLibrary } from '@/context/RenderLibraryContext';
import type { GenerationRecord } from '@/lib/db';

interface RenderLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Recibe la imagen elegida como File, igual que si se hubiera subido desde el equipo */
  onPick: (file: File) => void;
  onError?: (message: string) => void;
}

const MODE_LABELS: Record<string, string> = {
  planta: 'Planta',
  exterior: 'Exterior',
  interior: 'Interior',
  vistas: 'Vistas',
  edit: 'Edición',
};

function formatDate(ts: number): string {
  try {
    return Intl.DateTimeFormat('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(ts));
  } catch {
    return '';
  }
}

async function recordToFile(record: GenerationRecord, blob: Blob | null): Promise<File> {
  // Sin render completo (registros muy antiguos) se usa la miniatura guardada.
  const source = blob ?? (await (await fetch(record.imageUrl)).blob());
  const type = source.type && source.type.startsWith('image/') ? source.type : 'image/png';
  const ext = type.split('/')[1]?.replace('jpeg', 'jpg') || 'png';
  return new File([source], `dreamhouse-${record.mode}-${record.id}.${ext}`, { type });
}

export default function RenderLibraryModal({ isOpen, onClose, onPick, onError }: RenderLibraryModalProps) {
  const library = useRenderLibrary();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const handlePick = useCallback(
    async (record: GenerationRecord) => {
      if (!library || loadingId) return;
      setLoadingId(record.id);
      try {
        const blob = record.hasFullImage ? await library.getBlob(record.id) : null;
        const file = await recordToFile(record, blob);
        onPick(file);
        onClose();
      } catch (err) {
        console.warn('No se pudo cargar el render guardado:', err);
        onError?.('No se pudo cargar esa imagen del historial. Intenta con otra.');
      } finally {
        setLoadingId(null);
      }
    },
    [library, loadingId, onPick, onClose, onError],
  );

  if (!isOpen || !mounted || !library) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="render-library-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-4xl max-h-[90vh] flex flex-col bg-background border border-border sm:rounded-2xl rounded-t-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 p-4 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <Images className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="min-w-0">
              <h3 id="render-library-title" className="text-base font-semibold text-foreground">Mis renders</h3>
              <p className="text-xs text-muted-foreground">Elige una imagen que ya generaste para usarla aquí.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {library.items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void handlePick(item)}
                disabled={!!loadingId}
                className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-black/20 hover:border-primary focus-visible:border-primary transition-colors disabled:opacity-60 text-left"
                title={`${MODE_LABELS[item.mode] ?? item.mode} · ${formatDate(item.timestamp)}`}
              >
                <Image src={item.imageUrl} alt={`Render ${MODE_LABELS[item.mode] ?? item.mode}`} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover" unoptimized />
                <span className="absolute left-1.5 top-1.5 px-1.5 py-0.5 rounded bg-black/65 text-white text-xs font-semibold">
                  {MODE_LABELS[item.mode] ?? item.mode}
                </span>
                <span className="absolute inset-x-0 bottom-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent text-white text-xs truncate">
                  {item.houseName || item.params?.city || formatDate(item.timestamp)}
                </span>
                {loadingId === item.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
