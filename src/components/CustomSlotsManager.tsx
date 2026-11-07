'use client';

import React, { useCallback, useState, useRef } from 'react';
import { Plus, Trash2, AlertCircle, Sparkles, Layers, Image as ImageIcon, X, ZoomIn, RefreshCw, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import Image from 'next/image';
import { CustomDetailSlot } from '@/types';
import { validateImageFiles } from '@/lib/image-validation';
import { compressImage } from '@/lib/image-compression';
import { useLightbox } from '@/context/LightboxContext';
import { useObjectUrl } from '@/lib/hooks/useObjectUrl';

interface CustomSlotsManagerProps {
  mode: 'exterior' | 'interior';
  slots: CustomDetailSlot[];
  onSlotsChange: (slots: CustomDetailSlot[]) => void;
  disabled?: boolean;
}

const EXTERIOR_SUGGESTIONS = [
  'Puerta principal',
  'Ventanales',
  'Fachada / Revestimiento',
  'Pérgola / Celosía',
  'Portón / Acceso',
  'Balcón / Baranda',
  'Iluminación exterior',
  'Cubierta / Alero',
];

const INTERIOR_SUGGESTIONS = [
  'Puerta interior',
  'Ventanales',
  'Lámpara / Iluminación',
  'Grifería',
  'Mueble a medida',
  'Muro de acento',
  'Escalera',
  'Mesa / Sillas',
];

const MAX_CUSTOM_SLOTS = 10;

function SlotCard({
  slot,
  index,
  onUpdateLabel,
  onUpdateFile,
  onRemove,
  disabled,
}: {
  slot: CustomDetailSlot;
  index: number;
  onUpdateLabel: (id: string, label: string) => void;
  onUpdateFile: (id: string, file: File | null) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { openLightbox } = useLightbox();
  const previewUrl = useObjectUrl(slot.file);

  const processFile = useCallback(async (rawFile: File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const compressed = await compressImage(rawFile);
      const validation = validateImageFiles([compressed], `Detalle: ${slot.label || 'Personalizado'}`);
      if (!validation.valid) {
        setError(validation.error || 'Error al validar la imagen');
        return;
      }
      onUpdateFile(slot.id, compressed);
    } catch (err) {
      console.error('Error processing slot image:', err);
      setError('Error al procesar la imagen.');
    } finally {
      setIsProcessing(false);
    }
  }, [slot.id, slot.label, onUpdateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isProcessing) return;
    const file = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/'));
    if (file) {
      void processFile(file);
    }
  }, [disabled, isProcessing, processFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  return (
    <div className="border border-border/70 bg-card/60 rounded-lg p-3 sm:p-4 space-y-3 transition-colors hover:border-primary/40">
      {/* Cabecera del Slot: etiqueta editable y botón de eliminar */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-xs font-mono font-medium text-muted-foreground shrink-0">
            #{index + 1}
          </span>
          <input
            type="text"
            value={slot.label}
            onChange={(e) => onUpdateLabel(slot.id, e.target.value)}
            placeholder="Ej: Puerta principal de madera..."
            disabled={disabled}
            className="flex-1 min-w-0 px-2.5 py-1 text-xs sm:text-sm font-medium bg-background/80 border border-border/60 rounded focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={() => onRemove(slot.id)}
          disabled={disabled}
          title="Eliminar este slot"
          className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-destructive bg-destructive/10 px-2.5 py-1.5 rounded">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Área de la imagen */}
      {slot.file && previewUrl ? (
        <div className="flex items-center gap-3 bg-background/50 border border-border/50 rounded p-2">
          <div
            onClick={() => openLightbox([{ url: previewUrl, type: `Detalle: ${slot.label || 'Personalizado'}` }], 0)}
            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded overflow-hidden border border-border shrink-0 cursor-pointer group"
          >
            <Image
              src={previewUrl}
              alt={slot.label || 'Detalle personalizado'}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-200"
              sizes="80px"
              unoptimized
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ZoomIn className="w-4 h-4 text-white" />
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs font-medium text-foreground truncate">{slot.file.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {(slot.file.size / 1024).toFixed(0)} KB
            </p>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled || isProcessing}
                className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
              >
                <RefreshCw className="w-3 h-3" />
                Cambiar foto
              </button>
              <span className="text-muted-foreground/40">•</span>
              <button
                type="button"
                onClick={() => onUpdateFile(slot.id, null)}
                disabled={disabled}
                className="text-[11px] font-medium text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Quitar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { e.preventDefault(); setIsDragging(false); }}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={clsx(
            "border border-dashed rounded-lg p-3 sm:p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5",
            isDragging
              ? "border-primary bg-primary/10"
              : "border-border/70 hover:border-primary/50 hover:bg-primary/5 bg-background/40",
            disabled && "opacity-50 cursor-not-allowed pointer-events-none"
          )}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span>Procesando imagen...</span>
            </div>
          ) : (
            <>
              <div className="p-1.5 rounded-full bg-primary/10 text-primary">
                <ImageIcon className="w-4 h-4" />
              </div>
              <p className="text-xs font-medium text-foreground">
                Subir foto de referencia para <span className="text-primary font-semibold">{slot.label || 'este detalle'}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Arrastra o haz clic para seleccionar (JPEG, PNG, WebP)
              </p>
            </>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        disabled={disabled || isProcessing}
        className="hidden"
      />
    </div>
  );
}

export default function CustomSlotsManager({
  mode,
  slots,
  onSlotsChange,
  disabled,
}: CustomSlotsManagerProps) {
  const [customInputText, setCustomInputText] = useState('');
  const suggestions = mode === 'exterior' ? EXTERIOR_SUGGESTIONS : INTERIOR_SUGGESTIONS;

  const handleAddSlot = useCallback((label: string) => {
    if (slots.length >= MAX_CUSTOM_SLOTS) return;
    const trimmed = label.trim() || `Detalle #${slots.length + 1}`;
    const newSlot: CustomDetailSlot = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `slot-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      label: trimmed,
      file: null,
    };
    onSlotsChange([...slots, newSlot]);
  }, [slots, onSlotsChange]);

  const handleUpdateLabel = useCallback((id: string, newLabel: string) => {
    onSlotsChange(slots.map(s => s.id === id ? { ...s, label: newLabel } : s));
  }, [slots, onSlotsChange]);

  const handleUpdateFile = useCallback((id: string, file: File | null) => {
    onSlotsChange(slots.map(s => s.id === id ? { ...s, file } : s));
  }, [slots, onSlotsChange]);

  const handleRemoveSlot = useCallback((id: string) => {
    onSlotsChange(slots.filter(s => s.id !== id));
  }, [slots, onSlotsChange]);

  const handleAddFromInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInputText.trim()) return;
    handleAddSlot(customInputText.trim());
    setCustomInputText('');
  };

  const activeFilesCount = slots.filter(s => s.file !== null).length;

  return (
    <div className="space-y-4" role="region" aria-label="Slots de detalles personalizados">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 border border-primary/20 rounded-md text-primary">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">Slots de Detalles Personalizados</h4>
              <span className="px-1.5 py-0.5 text-[10px] font-mono font-medium bg-primary/10 text-primary border border-primary/20 rounded">
                Nuevo
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Sube fotos de puertas, ventanas, celosías, lámparas o acabados específicos que la IA integrará fielmente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto font-mono text-xs">
          <span className="text-muted-foreground">Slots con foto:</span>
          <span className={clsx(
            "px-2 py-0.5 rounded font-bold border",
            activeFilesCount > 0
              ? "bg-primary/15 text-primary border-primary/30"
              : "bg-muted text-muted-foreground border-border"
          )}>
            {activeFilesCount} / {slots.length}
          </span>
        </div>
      </div>

      {/* Sugerencias rápidas (Chips) */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>Sugerencias rápidas para añadir un slot:</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((suggestion) => {
            const alreadyAdded = slots.some(s => s.label.toLowerCase() === suggestion.toLowerCase());
            return (
              <button
                key={suggestion}
                type="button"
                disabled={disabled || slots.length >= MAX_CUSTOM_SLOTS || alreadyAdded}
                onClick={() => handleAddSlot(suggestion)}
                className={clsx(
                  "text-xs px-2.5 py-1 rounded-full border transition-all text-left flex items-center gap-1",
                  alreadyAdded
                    ? "opacity-40 border-border bg-muted/40 text-muted-foreground cursor-default"
                    : "border-border hover:border-primary/60 hover:bg-primary/5 text-foreground bg-card active:scale-95"
                )}
              >
                <Plus className="w-3 h-3 text-primary opacity-80" />
                <span>{suggestion}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input de texto para slot con nombre libre */}
      <form onSubmit={handleAddFromInput} className="flex gap-2">
        <input
          type="text"
          value={customInputText}
          onChange={(e) => setCustomInputText(e.target.value)}
          placeholder="Nombre de otro detalle (ej: Portón metálico microperforado)..."
          disabled={disabled || slots.length >= MAX_CUSTOM_SLOTS}
          className="flex-1 px-3 py-1.5 text-xs sm:text-sm bg-background border border-border rounded-md focus:outline-none focus:border-primary text-foreground placeholder:text-muted-foreground/60"
        />
        <button
          type="submit"
          disabled={disabled || !customInputText.trim() || slots.length >= MAX_CUSTOM_SLOTS}
          className="px-3.5 py-1.5 bg-primary text-primary-foreground font-medium text-xs sm:text-sm rounded-md hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Añadir slot</span>
        </button>
      </form>

      {/* Lista de slots activos */}
      {slots.length > 0 ? (
        <div className="space-y-2.5 pt-1">
          {slots.map((slot, index) => (
            <SlotCard
              key={slot.id}
              slot={slot}
              index={index}
              onUpdateLabel={handleUpdateLabel}
              onUpdateFile={handleUpdateFile}
              onRemove={handleRemoveSlot}
              disabled={disabled}
            />
          ))}
        </div>
      ) : (
        <div className="p-4 border border-dashed border-border/80 rounded-lg text-center bg-card/30">
          <p className="text-xs text-muted-foreground">
            No has agregado ningún slot de detalle aún. Haz clic en las sugerencias arriba o escribe un nombre para comenzar.
          </p>
        </div>
      )}
    </div>
  );
}
