'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, Image as ImageIcon, Plus, Sparkles, Trash2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { validateImageFiles } from '@/lib/image-validation';
import { compressImage } from '@/lib/image-compression';
import { useLightbox } from '@/context/LightboxContext';
import { useObjectUrls } from '@/lib/hooks/useObjectUrl';
import { Loader2 } from 'lucide-react';
import SlotInputActions from './SlotInputActions';
import { extractImageFilesFromClipboardEvent } from '@/lib/clipboard';

interface ReferenceUploaderProps {
  files: File[];
  onFilesChange: (files: File[]) => void;
}

export default function ReferenceUploader({ files, onFilesChange }: ReferenceUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openLightbox } = useLightbox();
  const previewUrls = useObjectUrls(files);

  const processIncomingFiles = useCallback(async (incomingFiles: File[]) => {
    if (incomingFiles.length === 0) return;
    const remainingSlots = Math.max(0, 5 - files.length);
    if (remainingSlots === 0) {
      setError('Ya has alcanzado el máximo de 5 imágenes de referencia.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const filesToProcess = incomingFiles.slice(0, remainingSlots);
      const compressedFiles = await Promise.all(
        filesToProcess.map((file) => compressImage(file))
      );

      const validation = validateImageFiles(compressedFiles, 'Imagen de referencia');
      if (!validation.valid) {
        setError(validation.error || 'Error al validar imágenes');
        return;
      }

      const newFiles = [...files, ...compressedFiles].slice(0, 5);
      onFilesChange(newFiles);
    } catch (err) {
      console.error("Compression error:", err);
      setError("Error al procesar las imágenes.");
    } finally {
      setIsProcessing(false);
    }
  }, [files, onFilesChange]);

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
    
    const droppedFiles = Array.from(e.dataTransfer.files).filter(file => 
      file.type.startsWith('image/')
    );
    
    if (droppedFiles.length > 0) {
      void processIncomingFiles(droppedFiles);
    }
  }, [processIncomingFiles]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/')
      );
      if (selectedFiles.length > 0) {
        void processIncomingFiles(selectedFiles);
      }
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
    const newFiles = files.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  }, [files, onFilesChange]);

  return (
    <div
      className="space-y-6 p-5 sm:p-6 outline-none"
      role="region"
      aria-labelledby="uploader-title"
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
        aria-label="Subir imágenes de referencia (máximo 5 archivos)"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative" aria-hidden="true">
            <div className="p-3 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl border border-primary/20">
              <ImageIcon className="w-5 h-5 text-primary" />
            </div>
            {files.length === 0 && (
              <div className="absolute inset-0 rounded-xl border-2 border-primary/30 animate-[pulse-ring_2s_ease-out_infinite]" />
            )}
          </div>
          <div>
            <h3 id="uploader-title" className="text-lg font-semibold text-foreground flex items-center gap-2">
              Referentes Visuales
              {files.length > 0 && (
                <Sparkles className="w-4 h-4 text-primary animate-pulse" aria-hidden="true" />
              )}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Sube imágenes de casas o estilos que te inspiren. La IA las usará como referencia visual.
            </p>
          </div>
        </div>
        
        {/* Counter & Quick Actions */}
        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          <div className={clsx(
            "relative px-4 py-2 rounded-full border text-sm font-mono font-medium transition-all duration-300",
            files.length === 5 
              ? "bg-primary/10 border-primary/30 text-primary" 
              : "bg-card-elevated border-border text-muted-foreground"
          )}>
            <span className="text-foreground font-bold">{files.length}</span>
            <span className="text-muted-foreground">/5</span>
          </div>

          {files.length < 5 && (
            <SlotInputActions
              compact
              onFileSelected={(file) => void processIncomingFiles([file])}
              onError={(msg) => setError(msg)}
              onUploadClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              isProcessing={isProcessing}
              modalTitle="Tomar foto de referencia"
              uploadLabel="Subir"
              pasteLabel="Pegar"
              cameraLabel="Cámara"
            />
          )}
        </div>
      </div>
      
      {/* Upload Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {files.map((file, index) => (
          <div
            key={index}
            className="group relative aspect-square rounded-2xl overflow-hidden border border-border bg-card-elevated transition-all duration-300 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 cursor-zoom-in"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            onClick={() => {
              const items = previewUrls.map((url, i) => ({
                url,
                type: `Referencia ${i + 1}`,
              }));
              openLightbox(items, index);
            }}
          >
            {previewUrls[index] && (
              <Image
                src={previewUrls[index]}
                alt={`Referencia ${index + 1}`}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-110"
                unoptimized
              />
            )}
            
            {/* Overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center p-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile(index);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-destructive text-white rounded-full text-xs font-medium transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 hover:scale-105 shadow-lg"
                title="Eliminar esta imagen"
              >
                <Trash2 className="w-4 h-4" aria-hidden="true" />
                Eliminar
              </button>
            </div>
            
            {/* Index Badge */}
            <div className={clsx(
              "absolute top-3 left-3 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all duration-300",
              hoveredIndex === index 
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/30" 
                : "bg-black/70 backdrop-blur-sm text-white border-white/20"
            )}>
              {index + 1}
            </div>
          </div>
        ))}
        
        {/* Upload Zone */}
        {files.length < 5 && (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={clsx(
              "relative aspect-square rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center p-3 overflow-hidden group cursor-pointer",
              isDragging 
                ? "border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20" 
                : "border-border hover:border-primary/50 hover:bg-card-elevated"
            )}
          >
            {/* Icon */}
            <div className={clsx(
              "relative p-3 rounded-2xl mb-2 transition-all duration-300",
              isDragging || isProcessing
                ? "bg-primary/20 scale-110" 
                : "bg-card group-hover:bg-primary/10 group-hover:scale-105"
            )}>
              {isProcessing ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
              ) : isDragging ? (
                <Plus className="w-5 h-5 text-primary animate-pulse" />
              ) : (
                <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>
            
            <span className={clsx(
              "text-xs font-medium transition-colors",
              isDragging || isProcessing
                ? "text-primary" 
                : "text-muted-foreground group-hover:text-foreground"
            )}>
              {isProcessing ? 'Procesando...' : isDragging ? 'Suelta aquí' : 'Añadir referencia'}
            </span>
            
            <span className="text-[10px] text-muted-foreground mt-1">
              Subir, pegar (Ctrl+V) o cámara
            </span>
          </div>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-destructive/10 border border-destructive/20 rounded-xl">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      
      {/* Empty State Tip */}
      {files.length === 0 && (
        <div className="flex items-center justify-center gap-3 py-4 px-6 bg-card-elevated/50 rounded-xl border border-border" role="note">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">
            <span className="text-foreground font-medium">Tip:</span> Puedes subir fotos de tu equipo, pegarlas con <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[11px] font-mono">Ctrl+V</kbd> o tomar fotos directamente con tu cámara.
          </p>
        </div>
      )}
    </div>
  );
}
