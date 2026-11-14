'use client';

import React, { useCallback, useState } from 'react';
import { Upload, ClipboardPaste, Camera, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { readImageFromClipboard } from '@/lib/clipboard';
import CameraCaptureModal from './CameraCaptureModal';

export interface SlotInputActionsProps {
  /** Callback cuando se recibe un archivo de imagen (desde subir, pegar o cámara) */
  onFileSelected: (file: File) => void;
  /** Callback para notificar errores al usuario */
  onError?: (errorMessage: string) => void;
  /** Ref opcional al input file para disparar el selector nativo */
  onUploadClick?: () => void;
  /** Estado de deshabilitado */
  disabled?: boolean;
  /** Estado de procesamiento activo */
  isProcessing?: boolean;
  /** Título del modal de la cámara */
  modalTitle?: string;
  /** Versión compacta para tarjetas pequeñas o slots individuales */
  compact?: boolean;
  /** Estilos adicionales para el contenedor */
  className?: string;
  /** Texto personalizado para el botón de subir */
  uploadLabel?: string;
  /** Texto personalizado para el botón de pegar */
  pasteLabel?: string;
  /** Texto personalizado para el botón de cámara */
  cameraLabel?: string;
}

export default function SlotInputActions({
  onFileSelected,
  onError,
  onUploadClick,
  disabled = false,
  isProcessing = false,
  modalTitle = 'Tomar foto',
  compact = false,
  className,
  uploadLabel = 'Subir',
  pasteLabel = 'Pegar',
  cameraLabel = 'Tomar foto',
}: SlotInputActionsProps) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  // Manejador del botón Pegar
  const handlePasteClick = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || isProcessing || isPasting) return;

      setIsPasting(true);
      try {
        const result = await readImageFromClipboard();
        if (result.file) {
          onFileSelected(result.file);
        } else if (result.error) {
          onError?.(result.error);
        }
      } catch (err: unknown) {
        console.warn('Paste error:', err);
        onError?.('Error al leer el portapapeles. Usa Ctrl+V para pegar.');
      } finally {
        setIsPasting(false);
      }
    },
    [disabled, isProcessing, isPasting, onFileSelected, onError]
  );

  // Manejador del botón Cámara
  const handleCameraClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || isProcessing) return;
      setIsCameraOpen(true);
    },
    [disabled, isProcessing]
  );

  // Manejador del botón Subir
  const handleUploadBtnClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || isProcessing) return;
      onUploadClick?.();
    },
    [disabled, isProcessing, onUploadClick]
  );

  return (
    <>
      <div
        className={clsx(
          'flex items-center gap-2 flex-wrap',
          compact ? 'text-xs' : 'text-xs sm:text-sm',
          className
        )}
      >
        {/* Botón Subir */}
        {onUploadClick && (
          <button
            type="button"
            onClick={handleUploadBtnClick}
            disabled={disabled || isProcessing}
            title="Seleccionar archivo desde tu dispositivo"
            className={clsx(
              'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors border',
              compact
                ? 'px-2.5 py-1.5 bg-card hover:bg-muted text-foreground border-border'
                : 'px-3 py-2 bg-card hover:bg-muted text-foreground border-border shadow-sm',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Upload className={compact ? 'w-3.5 h-3.5 text-primary' : 'w-4 h-4 text-primary'} />
            <span>{uploadLabel}</span>
          </button>
        )}

        {/* Botón Pegar */}
        <button
          type="button"
          onClick={handlePasteClick}
          disabled={disabled || isProcessing || isPasting}
          title="Pegar imagen desde el portapapeles (o presiona Ctrl+V)"
          className={clsx(
            'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors border',
            compact
              ? 'px-2.5 py-1.5 bg-card hover:bg-muted text-foreground border-border'
              : 'px-3 py-2 bg-card hover:bg-muted text-foreground border-border shadow-sm',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isPasting ? (
            <Loader2 className={clsx('animate-spin', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          ) : (
            <ClipboardPaste
              className={compact ? 'w-3.5 h-3.5 text-blue-500' : 'w-4 h-4 text-blue-500'}
            />
          )}
          <span>{pasteLabel}</span>
        </button>

        {/* Botón Cámara */}
        <button
          type="button"
          onClick={handleCameraClick}
          disabled={disabled || isProcessing}
          title="Tomar foto con la cámara de tu equipo o móvil"
          className={clsx(
            'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors border',
            compact
              ? 'px-2.5 py-1.5 bg-card hover:bg-muted text-foreground border-border'
              : 'px-3 py-2 bg-card hover:bg-muted text-foreground border-border shadow-sm',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <Camera
            className={compact ? 'w-3.5 h-3.5 text-emerald-500' : 'w-4 h-4 text-emerald-500'}
          />
          <span>{cameraLabel}</span>
        </button>
      </div>

      {/* Modal de captura de cámara */}
      <CameraCaptureModal
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={onFileSelected}
        title={modalTitle}
      />
    </>
  );
}
