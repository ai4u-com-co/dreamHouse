'use client';

import React, { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { GenerationRecord } from '@/lib/db';

/**
 * Biblioteca de renders ya generados (el historial de la cuenta activa), visible para todos los selectores de foto.
 * Es opcional: fuera del proveedor `useRenderLibrary()` devuelve null y los selectores no muestran el botón.
 */
export interface RenderLibrary {
  items: GenerationRecord[];
  /** Render a resolución completa (Blob). null si no existe (registros muy antiguos): se usará la miniatura. */
  getBlob: (id: string) => Promise<Blob | null>;
}

const RenderLibraryContext = createContext<RenderLibrary | null>(null);

export function useRenderLibrary(): RenderLibrary | null {
  return useContext(RenderLibraryContext);
}

export function RenderLibraryProvider({
  items,
  getBlob,
  children,
}: {
  items: GenerationRecord[];
  getBlob: RenderLibrary['getBlob'];
  children: ReactNode;
}) {
  const value = useMemo(() => ({ items, getBlob }), [items, getBlob]);
  return <RenderLibraryContext.Provider value={value}>{children}</RenderLibraryContext.Provider>;
}
