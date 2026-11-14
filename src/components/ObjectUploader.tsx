'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, Plus, Trash2, AlertCircle, Armchair } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { validateImageFiles } from '@/lib/image-validation';
import { compressImage } from '@/lib/image-compression';
import { useLightbox } from '@/context/LightboxContext';
import { useObjectUrls } from '@/lib/hooks/useObjectUrl';
import { Loader2 } from 'lucide-react';
import SlotInputActions from './SlotInputActions';
import { extractImageFilesFromClipboardEvent } from '@/lib/clipboard';

const MAX_OBJECTS = 13;

interface ObjectUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
  disabled?: boolean;
}

export default function ObjectUploader({ files, onFilesChange, disabled }: ObjectUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openLightbox } = useLightbox();
  const previewUrls = useObjectUrls(files);

  const processIncomingFiles = useCallback(async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0 || disabled) return;
    const remainingSlots = Math.max(0, MAX_OBJECTS - files.length);
    if (remainingSlots === 0) {
      setError(`Ya has alcanzado el máximo de ${MAX_OBJECTS} objetos.`);
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const filesToProcess = incomingFiles.slice(0, remainingSlots);
      const compressedFiles = await Promise.all(
        filesToProcess.map((file) => compressImage(file))
      );

      const validation = validateImageFiles(compressedFiles, 'Imagen de objeto');
      if (!validation.valid) {
        setError(validation.error || 'Error al validar imágenes');
        return;
      }
      onFilesChange([...files, ...compressedFiles].slice(0, MAX_OBJECTS));
    } catch (err) {
      console.error("Compression error:", err);
      setError("Error al procesar los objetos.");
    } finally {
      setIsProcessing(false);
    }
  }, [disabled, files, onFilesChange]);

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
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (droppedFiles.length > 0) {
      void processIncomingFiles(droppedFiles);
    }
  }, [processIncomingFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (selectedFiles.length > 0) {
      void processIncomingFiles(selectedFiles);
    }
    e.target.value = '';
  }, [processIncomingFiles]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const images = extractImageFilesFromClipboardEvent(e);
    if (images.length > 0) {
      e.preventDefault();
      void processIncomingFiles(images);
    }
  }, [processIncomingFiles]);

  const removeFile = useCallback((index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  }, [files, onFilesChange]);

  return (
    <div
      className="space-y-5 outline-none"
      role="region"
      aria-labelledby="object-uploader-title"
      tabIndex={0}
      onPaste={handlePaste}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        className="sr-only"
        onChange={handleFileInput}
        disabled={disabled}
        aria-label="Subir imágenes de objetos"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Armchair className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p id="object-uploader-title" className="text-sm font-semibold text-foreground">Objetos a incluir en la escena</p>
            <p className="text-xs text-muted-foreground mt-0.5 font-mono">
              Silla, cama, lámpara, mesa… la IA los integrará fielmente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <div className={clsx(
            "px-3 py-1.5 border text-xs font-mono font-medium transition-all",
            files.length === MAX_OBJECTS
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-card border-border text-muted-foreground"
          )}>
            <span className="text-foreground font-bold">{files.length}</span>
            <span className="opacity-60">/{MAX_OBJECTS}</span>
          </div>

          {files.length < MAX_OBJECTS && (
            <SlotInputActions
              compact
              onFileSelected={(file) => void processIncomingFiles([file])}
              onError={(msg) => setError(msg)}
              onUploadClick={() => fileInputRef.current?.click()}
              disabled={disabled || isProcessing}
              isProcessing={isProcessing}
              modalTitle="Tomar foto de objeto"
              uploadLabel="Subir"
              pasteLabel="Pegar"
              cameraLabel="Cámara"
            />
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-7 gap-2">
        {files.map((file, index) => (
          <div
            key={`${file.name}-${index}`}
            className={clsx(
              "relative group aspect-square overflow-hidden border-2 transition-all duration-300 cursor-pointer",
              hoveredIndex === index
                ? "border-primary scale-[1.03] shadow-md shadow-primary/10"
                : "border-border hover:border-primary/40"
            )}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => {
              const imageUrls = previewUrls.map((url, i) => ({ url, type: `Objeto ${i + 1}` }));
              openLightbox(imageUrls, index);
            }}
          >
            <Image
              src={previewUrls[index] ?? ''}
              alt={`Objeto ${index + 1}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-110"
              unoptimized
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute inset-0 flex items-end justify-center pb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button
                onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                disabled={disabled}
                className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-white bg-destructive/80 backdrop-blur-sm hover:bg-destructive transition-colors"
                aria-label={`Eliminar objeto ${index + 1}`}
              >
                <Trash2 className="w-2.5 h-2.5" />
                Quitar
              </button>
            </div>
            <div className={clsx(
              "absolute top-1 left-1 w-5 h-5 flex items-center justify-center text-xs font-bold border transition-all",
              hoveredIndex === index
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-black/60 text-white border-white/20"
            )}>
              {index + 1}
            </div>
          </div>
        ))}

        {/* Upload slot */}
        {files.length < MAX_OBJECTS && (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "relative aspect-square border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden group cursor-pointer",
              disabled && "opacity-40 pointer-events-none",
              isDragging
                ? "border-primary bg-primary/10 scale-[1.03]"
                : "border-border hover:border-primary/50 hover:bg-card/60"
            )}
          >
            <div className={clsx(
              "p-2 transition-all",
              (isDragging || isProcessing) ? "scale-110" : "group-hover:scale-105"
            )}>
              {isProcessing ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : isDragging ? (
                <Plus className="w-4 h-4 text-primary animate-pulse" />
              ) : (
                <Upload className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>
            <span className={clsx(
              "text-xs font-medium mt-0.5 transition-colors",
              (isDragging || isProcessing) ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}>
              {isProcessing ? 'Procesando...' : isDragging ? 'Suelta' : 'Agregar'}
            </span>
            <span className="text-[9px] text-muted-foreground opacity-70 group-hover:opacity-100 transition-opacity mt-0.5">
              Subir, pegar o cámara
            </span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 p-3 bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Tip */}
      {files.length === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center font-mono tracking-tight">
          Hasta {MAX_OBJECTS} piezas · Puedes subir fotos, pegarlas con Ctrl+V o capturarlas con la cámara.
        </p>
      )}
    </div>
  );
}
