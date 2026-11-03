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
  const { openLightbox } = useLightbox();
  const previewUrls = useObjectUrls(files);

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
    if (droppedFiles.length === 0) return;
    if (droppedFiles.length === 0) return;
    
    const processFiles = async () => {
      setIsProcessing(true);
      setError(null);
      try {
        const compressedFiles = await Promise.all(
          droppedFiles.map(file => compressImage(file))
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
    };
    processFiles();
  }, [files, onFilesChange]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (!e.target.files) return;
    const selectedFiles = Array.from(e.target.files).filter(f => f.type.startsWith('image/'));
    if (selectedFiles.length > 0) {
      const processFiles = async () => {
        setIsProcessing(true);
        setError(null);
        try {
          const compressedFiles = await Promise.all(
            selectedFiles.map(file => compressImage(file))
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
      };
      processFiles();
    }
    e.target.value = '';
  }, [files, onFilesChange]);

  const removeFile = useCallback((index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  }, [files, onFilesChange]);

  return (
    <div className="space-y-5" role="region" aria-labelledby="object-uploader-title">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
            <Armchair className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p id="object-uploader-title" className="text-sm font-semibold text-foreground">Objetos a incluir en la escena</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
              Silla, cama, lámpara, mesa… la IA los integrará fielmente.
            </p>
          </div>
        </div>
        <div className={clsx(
          "px-3 py-1.5 border text-xs font-mono font-medium transition-all",
          files.length === MAX_OBJECTS
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-card border-border text-muted-foreground"
        )}>
          <span className="text-foreground font-bold">{files.length}</span>
          <span className="opacity-60">/{MAX_OBJECTS}</span>
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
                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-white bg-destructive/80 backdrop-blur-sm hover:bg-destructive transition-colors"
                aria-label={`Eliminar objeto ${index + 1}`}
              >
                <Trash2 className="w-2.5 h-2.5" />
                Quitar
              </button>
            </div>
            <div className={clsx(
              "absolute top-1 left-1 w-5 h-5 flex items-center justify-center text-[9px] font-bold border transition-all",
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
            className={clsx(
              "relative aspect-square border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center overflow-hidden group cursor-pointer",
              disabled && "opacity-40 pointer-events-none",
              isDragging
                ? "border-primary bg-primary/10 scale-[1.03]"
                : "border-border hover:border-primary/50 hover:bg-card/60"
            )}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileInput}
              disabled={disabled}
              aria-label="Subir imágenes de objetos"
            />
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
              "text-[9px] font-medium mt-0.5 transition-colors",
              (isDragging || isProcessing) ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
            )}>
              {isProcessing ? 'Bajando...' : isDragging ? 'Suelta' : 'Agregar'}
            </span>
            <span className="text-[8px] text-muted opacity-0 group-hover:opacity-60 transition-opacity mt-0.5">
              Optimización automática
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
        <p className="text-[11px] text-muted-foreground/60 text-center font-mono tracking-tight">
          Hasta {MAX_OBJECTS} piezas · La IA las colocará en el espacio según el layout.
        </p>
      )}
    </div>
  );
}
