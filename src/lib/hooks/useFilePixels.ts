'use client';

import { useEffect, useState } from 'react';
import { MAX_INPUT_IMAGE_PIXELS } from '@/lib/openai-image-core.ts';

// Píxeles reales de cada imagen que se enviará (para mostrar el costo ANTES de generar). El servidor las vuelve a medir:
// esto solo es la vista previa del costo. Mientras no se conoce una medida (o si no se puede leer) se usa el tope, que es
// lo más caro posible: nunca se promete un costo menor al real.
const cache = new WeakMap<File, number>();

async function measure(file: File): Promise<number> {
  const known = cache.get(file);
  if (known) return known;
  try {
    const bitmap = await createImageBitmap(file);
    const px = bitmap.width * bitmap.height;
    bitmap.close?.();
    if (px > 0) {
      cache.set(file, px);
      return px;
    }
  } catch {
    /* formato que el navegador no decodifica: se usa el tope */
  }
  cache.set(file, MAX_INPUT_IMAGE_PIXELS);
  return MAX_INPUT_IMAGE_PIXELS;
}

export function useFilePixels(files: File[]): number[] {
  const [, bump] = useState(0);
  useEffect(() => {
    let alive = true;
    const pending = files.filter((f) => !cache.has(f));
    if (pending.length === 0) return;
    void Promise.all(pending.map(measure)).then(() => {
      if (alive) bump((n) => n + 1);
    });
    return () => {
      alive = false;
    };
  }, [files]);
  return files.map((f) => cache.get(f) ?? MAX_INPUT_IMAGE_PIXELS);
}
