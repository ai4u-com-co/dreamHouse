import { useState, useEffect, useCallback, useRef } from 'react';
import { dbFor, GenerationRecord } from '../db';
import { createThumbnail } from '../image-thumbnail';

/** Aviso de que el historial de una cuenta cambió por fuera del hook (p. ej. se importó el historial anterior). */
export const HISTORY_CHANGED_EVENT = 'dh-history-changed';

/**
 * Historial de UNA cuenta (`ownerId`). Toda operación se ata a su dueño: si la sesión cambia mientras una operación está en curso,
 * se guarda en la colección de la cuenta que la pidió y la pantalla de la cuenta activa no se toca.
 */
export function useHistory(ownerId: string | null) {
  const [history, setHistory] = useState<GenerationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Cuenta activa AHORA: las operaciones asíncronas comparan contra ella al terminar.
  const currentOwner = useRef<string | null>(ownerId);
  currentOwner.current = ownerId;

  const refreshFor = useCallback(async (owner: string | null) => {
    if (!owner) {
      setHistory([]);
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const data = await dbFor(owner).getAllGenerations();
      if (owner === currentOwner.current) {
        setHistory(data);
        setError(null);
      }
    } catch (err) {
      if (owner === currentOwner.current) setError(err instanceof Error ? err : new Error('Failed to fetch history'));
    } finally {
      if (owner === currentOwner.current) setIsLoading(false);
    }
  }, []);

  const refreshHistory = useCallback(() => refreshFor(currentOwner.current), [refreshFor]);

  // Al cambiar de cuenta (o cerrar sesión) se vacía lo que había en pantalla y se carga el historial de la nueva.
  useEffect(() => {
    setHistory([]);
    setError(null);
    refreshFor(ownerId);
  }, [ownerId, refreshFor]);

  useEffect(() => {
    const onChanged = () => refreshFor(currentOwner.current);
    window.addEventListener(HISTORY_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(HISTORY_CHANGED_EVENT, onChanged);
  }, [refreshFor]);

  /** `forOwner` = la cuenta que pidió la imagen (por defecto, la activa). */
  const saveToHistory = async (record: Omit<GenerationRecord, 'id' | 'timestamp'>, forOwner: string | null = ownerId): Promise<{ pruned: number }> => {
    if (!forOwner) throw new Error('Sin sesión: no hay historial activo.');
    try {
      // La grilla del historial usa un thumbnail de 320px (ligero, evita memory crashes
      // al listar). El render full-res se persiste aparte como Blob para el lightbox y la descarga.
      const thumbnailUrl = await createThumbnail(record.imageUrl, 320, 0.6);
      let fullImage: Blob | undefined;
      try {
        fullImage = await (await fetch(record.imageUrl)).blob();
      } catch (e) {
        console.warn('No se pudo convertir el render a Blob; se guardará solo el thumbnail.', e);
      }
      const { pruned } = await dbFor(forOwner).saveGeneration({ ...record, imageUrl: thumbnailUrl }, fullImage);
      await refreshFor(forOwner); // solo repinta si `forOwner` sigue siendo la cuenta activa
      return { pruned };
    } catch (err) {
      console.error('Failed to save to history:', err);
      throw err;
    }
  };

  /** Devuelve un object URL del render full-res (on-demand), o null si no existe (registros antiguos). */
  const getFullImageUrl = async (id: string): Promise<string | null> => {
    if (!ownerId) return null;
    try {
      const blob = await dbFor(ownerId).getFullImage(id);
      return blob ? URL.createObjectURL(blob) : null;
    } catch (err) {
      console.error('Failed to load full image:', err);
      return null;
    }
  };

  const deleteFromHistory = async (id: string) => {
    if (!ownerId) return;
    try {
      await dbFor(ownerId).deleteGeneration(id);
      await refreshFor(ownerId);
    } catch (err) {
      console.error('Failed to delete from history:', err);
      throw err;
    }
  };

  const clearHistory = async () => {
    if (!ownerId) return;
    try {
      await dbFor(ownerId).clearAll();
      await refreshFor(ownerId);
    } catch (err) {
      console.error('Failed to clear history:', err);
      throw err;
    }
  };

  return {
    history,
    isLoading,
    error,
    saveToHistory,
    deleteFromHistory,
    clearHistory,
    refreshHistory,
    getFullImageUrl
  };
}
