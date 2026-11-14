/**
 * Utilidades para interactuar con el portapapeles de manera segura
 * y extraer imágenes tanto por evento (Ctrl+V) como por la API nativa de Clipboard.
 */

export interface ClipboardImageResult {
  file: File | null;
  error?: string;
}

/**
 * Intenta leer una imagen directamente desde el portapapeles del sistema
 * usando la API asíncrona navigator.clipboard.read().
 */
export async function readImageFromClipboard(): Promise<ClipboardImageResult> {
  if (typeof window === 'undefined') {
    return { file: null, error: 'Entorno de servidor sin portapapeles' };
  }

  if (!navigator?.clipboard) {
    return {
      file: null,
      error: 'Tu navegador no soporta lectura directa de portapapeles. Usa Ctrl+V para pegar.',
    };
  }

  if (typeof navigator.clipboard.read !== 'function') {
    return {
      file: null,
      error: 'Presiona Ctrl+V (o Cmd+V) para pegar la imagen directamente.',
    };
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (imageType) {
        const blob = await item.getType(imageType);
        const extension = imageType.split('/')[1]?.replace('+xml', '') || 'png';
        const file = new File([blob], `portapapeles-${Date.now()}.${extension}`, {
          type: imageType,
          lastModified: Date.now(),
        });
        return { file };
      }
    }
    return {
      file: null,
      error: 'No se encontró ninguna imagen en el portapapeles. Copia una imagen y vuelve a intentarlo.',
    };
  } catch (err: unknown) {
    const errorName = err instanceof Error ? err.name : '';
    if (errorName === 'NotAllowedError' || errorName === 'SecurityError') {
      return {
        file: null,
        error: 'Permiso denegado para acceder al portapapeles. Presiona Ctrl+V para pegar.',
      };
    }
    return {
      file: null,
      error: 'No se pudo leer el portapapeles. Presiona Ctrl+V para pegar la imagen.',
    };
  }
}

/**
 * Extrae todas las imágenes presentes en un evento de pegado (React.ClipboardEvent o ClipboardEvent).
 */
export function extractImageFilesFromClipboardEvent(
  e: React.ClipboardEvent | ClipboardEvent
): File[] {
  const clipboardData = 'clipboardData' in e ? e.clipboardData : null;
  if (!clipboardData) return [];

  const foundFiles: File[] = [];

  // 1. Probar items (DataTransferItemList)
  if (clipboardData.items && clipboardData.items.length > 0) {
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          foundFiles.push(file);
        }
      }
    }
  }

  // 2. Si no hubo en items, probar files
  if (foundFiles.length === 0 && clipboardData.files && clipboardData.files.length > 0) {
    for (let i = 0; i < clipboardData.files.length; i++) {
      const f = clipboardData.files[i];
      if (f.type.startsWith('image/')) {
        foundFiles.push(f);
      }
    }
  }

  return foundFiles;
}
