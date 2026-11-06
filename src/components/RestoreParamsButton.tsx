'use client';

import React, { useRef, useState } from 'react';
import { FileUp } from 'lucide-react';
import { restoreParamsFromFile, type RestoreResult } from '@/lib/restore-params';

interface RestoreParamsButtonProps {
  /** Recibe lo recuperado ya validado; la pantalla decide cómo volcarlo al formulario */
  onRestore: (result: RestoreResult) => void;
  disabled?: boolean;
}

/**
 * «Recuperar parámetros de una generación»: la persona sube una imagen hecha con DreamHouse (JPG, PNG o WebP: los
 * parámetros viajan dentro del archivo) o un archivo de parámetros (.json) descargado del historial, y el formulario se rellena.
 */
export default function RestoreParamsButton({ onRestore, disabled }: RestoreParamsButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await restoreParamsFromFile(file);
      if (result.ok) onRestore(result);
      else setMessage(result.message);
    } catch (error) {
      console.error('No se pudieron recuperar los parámetros:', error);
      setMessage('No se pudo leer el archivo. Prueba con otra imagen.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = ''; // permite volver a elegir el mismo archivo
    }
  };

  return (
    <div className="mt-6 border border-dashed border-border p-4 flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Recuperar parámetros de una generación</p>
      <p className="text-xs text-muted-foreground">
        Sube un render hecho con DreamHouse (JPG, PNG o WebP) o un archivo de parámetros (.json) del historial: el formulario se rellena con lo que se usó.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,.json,application/json"
        className="sr-only"
        id="restore-params-input"
        onChange={(e) => void handleFile(e.target.files?.[0])}
        disabled={disabled || busy}
      />
      <label
        htmlFor="restore-params-input"
        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 border border-border bg-card text-xs font-bold uppercase tracking-widest cursor-pointer hover:border-primary/60 transition-colors aria-disabled:opacity-50"
        aria-disabled={disabled || busy}
      >
        <FileUp className="w-4 h-4" />
        {busy ? 'Leyendo…' : 'Elegir imagen o archivo'}
      </label>
      {message && <p role="alert" className="text-xs text-destructive">{message}</p>}
    </div>
  );
}
