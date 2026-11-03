'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Upload, Map, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { validateImageFile } from '@/lib/image-validation';
import { compressImage } from '@/lib/image-compression';
import { useLightbox } from '@/context/LightboxContext';
import { useObjectUrl } from '@/lib/hooks/useObjectUrl';
import { Loader2 } from 'lucide-react';

interface LotUploaderProps {
  file: File | null;
  onFileChange: (file: File | null) => void;
  /** Se llama con el archivo original, ANTES de recomprimirlo (la recompresión en canvas borra los metadatos) */
  onOriginalSelected?: (file: File) => void;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  skipSizeValidation?: boolean;
}

export default function LotUploader({ 
  file, 
  onFileChange, 
  onOriginalSelected,
  title = "Foto del Lote / Terreno",
  description = "Sube una foto real del lugar donde se construirá. La IA adaptará el diseño al entorno.",
  icon = <Map className="w-5 h-5 text-green-500" />,
  skipSizeValidation = false
}: LotUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { openLightbox } = useLightbox();
  const previewUrl = useObjectUrl(file);

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
      // First validate basic type
      if (!droppedFile.type.startsWith('image/')) {
        setError('El archivo debe ser una imagen');
        return;
      }

      const processFile = async () => {
        setIsProcessing(true);
        setError(null);
        try {
          // Compress image before further validation/upload
          onOriginalSelected?.(droppedFile);
          const processedFile = await compressImage(droppedFile);
          
          // Re-validate size just in case (though it should be much smaller now)
          const validation = validateImageFile(processedFile, 'Imagen del lote', skipSizeValidation);
          if (!validation.valid) {
            setError(validation.error || 'Error al validar imagen');
            return;
          }
          onFileChange(processedFile);
        } catch (err) {
          console.error("Compression error:", err);
          setError("Error al procesar la imagen.");
        } finally {
          setIsProcessing(false);
        }
      };

      processFile();
    }
  }, [onFileChange, onOriginalSelected, skipSizeValidation]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type.startsWith('image/')) {
        const processFile = async () => {
          setIsProcessing(true);
          setError(null);
          try {
            // Compress image
            onOriginalSelected?.(selectedFile);
            const processedFile = await compressImage(selectedFile);
            
            const validation = validateImageFile(processedFile, 'Imagen del lote', skipSizeValidation);
            if (!validation.valid) {
              setError(validation.error || 'Error al validar imagen');
              return;
            }
            onFileChange(processedFile);
          } catch (err) {
            console.error("Compression error:", err);
            setError("Error al procesar la imagen.");
          } finally {
            setIsProcessing(false);
          }
        };
        processFile();
      }
    }
  }, [onFileChange, onOriginalSelected, skipSizeValidation]);

  const removeFile = useCallback(() => {
    onFileChange(null);
  }, [onFileChange]);

  return (
    <div className="space-y-4 p-5 sm:p-6" role="region" aria-labelledby="lot-uploader-title">
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="p-3 bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl border border-green-500/20">
            {icon}
          </div>
        </div>
        <div>
          <h3 id="lot-uploader-title" className="text-lg font-semibold text-foreground flex items-center gap-2">
            {title}
            <span className="text-xs font-normal text-muted-foreground border border-border px-2 py-0.5 rounded-full">Opcional</span>
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4">
        {!file ? (
          <div
            ref={dropZoneRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={clsx(
              "relative h-40 rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center overflow-hidden group cursor-pointer bg-card/50",
              isDragging 
                ? "border-green-500 bg-green-500/10" 
                : "border-border hover:border-green-500/50 hover:bg-card-elevated"
            )}
          >
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleFileInput}
              aria-label="Subir foto del lote"
            />
            
            {isProcessing ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 text-green-500 animate-spin mb-2" />
                <p className="text-sm font-medium text-foreground">Procesando imagen...</p>
                <p className="text-[10px] text-muted-foreground mt-1">Reduciendo tamaño para un envío óptimo</p>
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
                  <span className="text-green-500 font-semibold">Haz clic para subir</span> o arrastra la foto aquí
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Cualquier tamaño · Optimización automática
                </p>
              </>
            )}
          </div>
        ) : (
          <div 
            className="relative group rounded-2xl overflow-hidden border border-border bg-card h-64 sm:h-80 transition-all hover:border-green-500/50 hover:shadow-lg cursor-zoom-in"
            onClick={() => {
              if (previewUrl) {
                openLightbox([{ url: previewUrl, type: title }]);
              }
            }}
          >
            <Image
              src={previewUrl ?? ''}
              alt="Vista previa del lote"
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-700"
              unoptimized
            />
            
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
              <button
                onClick={removeFile}
                className="flex items-center gap-2 px-4 py-2 bg-destructive text-white rounded-full font-medium transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 hover:scale-105"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar foto
              </button>
            </div>

            <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 shadow-lg">
              <CheckCircle2 className="w-3 h-3" />
              Lote cargado
            </div>
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
    </div>
  );
}

