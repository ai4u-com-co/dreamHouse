'use client';

import React, { useCallback, useEffect, useState, useRef } from 'react';
import { Upload, Map, Trash2, CheckCircle2, AlertCircle, Pentagon } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { validateImageFile } from '@/lib/image-validation';
import { compressImage } from '@/lib/image-compression';
import { useLightbox } from '@/context/LightboxContext';
import { useObjectUrl } from '@/lib/hooks/useObjectUrl';
import { Loader2 } from 'lucide-react';
import PolygonZoneModal from './PolygonZoneModal';
import { tracePolygon, type Pt } from '@/lib/polygon-zone';
import SlotInputActions from './SlotInputActions';
import { extractImageFilesFromClipboardEvent } from '@/lib/clipboard';

interface LotUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Se llama con el archivo original, ANTES de recomprimirlo (la recompresión en canvas borra los metadatos) */
  onOriginalSelected?: (file: File) => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  skipSizeValidation?: boolean;
  /** Permite seleccionar opcionalmente sobre la foto del lote la zona donde se quiere crear la planta/proyecto */
  enableZoneSelection?: boolean;
  /** Polígonos normalizados (0..1) actualmente seleccionados sobre el lote */
  zonePolygons?: Pt[][];
  /** Se invoca al aplicar o limpiar la zona sobre el lote, entregando los polígonos y la imagen compuesta */
  onZoneChange?: (polygons: Pt[][], compositeFile: File | null) => void;
  /** Etiqueta del botón para abrir el selector de zona */
  zoneButtonLabel?: string;
}

const ZONE_EXPORT_MAX_SIDE = 2048;

function renderLotWithZone(image: HTMLImageElement, polygons: Pt[][]): Promise<File | null> {
  if (polygons.length === 0) return Promise.resolve(null);
  const scale = Math.min(1, ZONE_EXPORT_MAX_SIDE / Math.max(image.width, image.height));
  const w = Math.max(1, Math.round(image.width * scale));
  const h = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.resolve(null);

  ctx.drawImage(image, 0, 0, w, h);
  polygons.forEach((poly) => {
    if (poly.length < 3) return;
    tracePolygon(ctx, poly, w, h);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.38)';
    ctx.fill();
    ctx.lineWidth = Math.max(2, Math.round(Math.min(w, h) * 0.004));
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.lineJoin = 'round';
    ctx.stroke();
  });

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ? new File([blob], 'lote_zona_planta.png', { type: 'image/png' }) : null),
      'image/png',
    );
  });
}

export default function LotUploader({ 
  file, 
  onFileChange, 
  onOriginalSelected,
  title = "Foto del Lote / Terreno",
  description = "Sube una foto real del lugar donde se construirá. La IA adaptará el diseño al entorno.",
  icon = <Map className="w-5 h-5 text-green-500" />,
  skipSizeValidation = false,
  enableZoneSelection = false,
  zonePolygons,
  onZoneChange,
  zoneButtonLabel = "Seleccionar zona para la planta",
}: LotUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [internalPolygons, setInternalPolygons] = useState<Pt[][]>([]);
  const [zoneCompositeFile, setZoneCompositeFile] = useState<File | null>(null);
  const [polygonModalOpen, setPolygonModalOpen] = useState(false);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openLightbox } = useLightbox();
  const previewUrl = useObjectUrl(file);
  const zonePreviewUrl = useObjectUrl(zoneCompositeFile);

  const activePolygons = zonePolygons ?? internalPolygons;

  useEffect(() => {
    if (!enableZoneSelection || !previewUrl) {
      setImageObj(null);
      setZoneCompositeFile(null);
      setInternalPolygons([]);
      return;
    }
    const img = new window.Image();
    img.src = previewUrl;
    img.onload = () => {
      setImageObj(img);
    };
  }, [enableZoneSelection, previewUrl]);

  // Si el padre resetea los polígonos desde afuera, limpiamos también la vista compuesta
  useEffect(() => {
    if (zonePolygons && zonePolygons.length === 0) {
      setZoneCompositeFile(null);
    }
  }, [zonePolygons]);

  const handleApplyZone = useCallback(async (newPolygons: Pt[][]) => {
    setInternalPolygons(newPolygons);
    setPolygonModalOpen(false);
    if (!imageObj || newPolygons.length === 0) {
      setZoneCompositeFile(null);
      onZoneChange?.([], null);
      return;
    }
    const composite = await renderLotWithZone(imageObj, newPolygons);
    setZoneCompositeFile(composite);
    onZoneChange?.(newPolygons, composite);
  }, [imageObj, onZoneChange]);

  const handleClearZone = useCallback(() => {
    setInternalPolygons([]);
    setZoneCompositeFile(null);
    onZoneChange?.([], null);
  }, [onZoneChange]);

  // Proceso unificado para procesar cualquier archivo entrante (subido, pegado o tomado con cámara)
  const processSelectedFile = useCallback(async (rawFile: File) => {
    if (!rawFile.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      onOriginalSelected?.(rawFile);
      const processedFile = await compressImage(rawFile);
      
      const validation = validateImageFile(processedFile, 'Imagen del lote', skipSizeValidation);
      if (!validation.valid) {
        setError(validation.error || 'Error al validar imagen');
        return;
      }
      setInternalPolygons([]);
      setZoneCompositeFile(null);
      onZoneChange?.([], null);
      onFileChange(processedFile);
    } catch (err) {
      console.error("Compression error:", err);
      setError("Error al procesar la imagen.");
    } finally {
      setIsProcessing(false);
    }
  }, [onFileChange, onOriginalSelected, onZoneChange, skipSizeValidation]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    
    const droppedFile = Array.from(e.dataTransfer.files).find(f => 
      f.type.startsWith('image/')
    );
    
    if (droppedFile) {
      void processSelectedFile(droppedFile);
    }
  }, [processSelectedFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      void processSelectedFile(selectedFile);
    }
    e.target.value = '';
  }, [processSelectedFile]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const images = extractImageFilesFromClipboardEvent(e);
    if (images.length > 0) {
      e.preventDefault();
      void processSelectedFile(images[0]);
    }
  }, [processSelectedFile]);

  const removeFile = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setInternalPolygons([]);
    setZoneCompositeFile(null);
    onZoneChange?.([], null);
    onFileChange(null);
  }, [onFileChange, onZoneChange]);

  const displayUrl = (enableZoneSelection && activePolygons.length > 0 && zonePreviewUrl) ? zonePreviewUrl : previewUrl;

  return (
    <div
      className="space-y-4 p-5 sm:p-6 outline-none"
      role="region"
      aria-labelledby="lot-uploader-title"
      tabIndex={0}
      onPaste={handlePaste}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="p-3 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl border border-green-500/20">
            {icon}
          </div>
        </div>
        <div>
          <h3 id="lot-uploader-title" className="text-lg font-semibold text-foreground flex items-center gap-2 flex-wrap">
            {title}
            <span className="text-xs font-normal text-muted-foreground border border-border px-2 py-0.5 rounded-full">Opcional</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {/* Input accesible oculto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileInput}
          aria-label="Subir foto del lote"
        />

        {!file ? (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "relative min-h-[170px] py-6 px-4 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center overflow-hidden group cursor-pointer bg-card/50",
              isDragging 
                ? "border-green-500 bg-green-500/10" 
                : "border-border hover:border-green-500/50 hover:bg-card-elevated"
            )}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-2" />
                <p className="text-sm font-medium text-foreground">Procesando imagen...</p>
                <p className="text-xs text-muted-foreground mt-1">Reduciendo tamaño para un envío óptimo</p>
              </div>
            ) : (
              <>
                <div className={clsx(
                  "p-3 rounded-full mb-2 transition-all duration-300",
                  isDragging ? "bg-green-500/20" : "bg-card group-hover:bg-green-500/10"
                )}>
                  <Upload className={clsx("w-6 h-6", isDragging ? "text-green-500" : "text-muted-foreground group-hover:text-green-500")} />
                </div>
                
                <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  <span className="text-green-500 font-semibold">Haz clic para explorar</span> o arrastra la foto aquí
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  O puedes pegar directamente con <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[11px] font-mono">Ctrl+V</kbd>
                </p>

                {/* Acciones universales: Subir, Pegar, Tomar foto */}
                <div className="mt-4" onClick={(e) => e.stopPropagation()}>
                  <SlotInputActions
                    onFileSelected={processSelectedFile}
                    onError={(msg) => setError(msg)}
                    onUploadClick={() => fileInputRef.current?.click()}
                    disabled={isProcessing}
                    isProcessing={isProcessing}
                    modalTitle={`Tomar foto - ${title}`}
                    uploadLabel="Subir archivo"
                    pasteLabel="Pegar foto"
                    cameraLabel="Tomar foto"
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            <div 
              className="relative group rounded-2xl overflow-hidden border border-border bg-card h-64 sm:h-80 transition-all hover:border-green-500/50 hover:shadow-lg cursor-zoom-in"
              onClick={() => {
                if (displayUrl) {
                  openLightbox([{ url: displayUrl, type: title }]);
                }
              }}
            >
              <Image
                src={displayUrl ?? ''}
                alt="Vista previa del lote"
                fill
                className={clsx(
                  "transition-transform duration-700",
                  enableZoneSelection && activePolygons.length > 0 ? "object-contain bg-black/20" : "object-cover group-hover:scale-105"
                )}
                unoptimized
              />
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                <button
                  type="button"
                  onClick={removeFile}
                  className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-full font-medium transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:scale-105"
                >
                  <Trash2 className="w-4 h-4" />
                  Eliminar foto
                </button>
              </div>

              {enableZoneSelection && activePolygons.length > 0 && (
                <div className="absolute top-4 left-4 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-lg">
                  <Pentagon className="w-3.5 h-3.5" />
                  Zona marcada ({activePolygons.length})
                </div>
              )}

              <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
                <CheckCircle2 className="w-3 h-3" />
                Lote cargado
              </div>
            </div>

            {/* Barra de opciones para reemplazar foto o gestionar zonas */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-border bg-card/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">Cambiar foto:</span>
                <SlotInputActions
                  compact
                  onFileSelected={processSelectedFile}
                  onError={(msg) => setError(msg)}
                  onUploadClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  isProcessing={isProcessing}
                  modalTitle={`Cambiar foto - ${title}`}
                  uploadLabel="Subir"
                  pasteLabel="Pegar"
                  cameraLabel="Cámara"
                />
              </div>

              {enableZoneSelection && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={!imageObj}
                    onClick={() => setPolygonModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity shadow-sm"
                  >
                    <Pentagon className="w-3.5 h-3.5" />
                    {activePolygons.length > 0 ? `Editar zona (${activePolygons.length})` : zoneButtonLabel}
                  </button>
                  {activePolygons.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearZone}
                      title="Quitar la zona seleccionada"
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-border bg-card hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                    >
                      Quitar zona
                    </button>
                  )}
                </div>
              )}
            </div>

            {enableZoneSelection && activePolygons.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">
                Opcional: puedes marcar sobre la foto la zona exacta donde quieres proyectar la planta.
              </p>
            )}
          </>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-xl">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {polygonModalOpen && imageObj && (
        <PolygonZoneModal
          image={imageObj}
          initial={activePolygons}
          onApply={handleApplyZone}
          onClose={() => setPolygonModalOpen(false)}
        />
      )}
    </div>
  );
}
