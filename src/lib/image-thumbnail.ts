/**
 * Crea la miniatura de la grilla del historial a partir de un data URL.
 * 720 px al 82 %: se ve nítida en las tarjetas (también en pantallas de alta densidad) y sigue siendo ligera (~80-150 KB),
 * así que listar 60 no agota la memoria. El render completo se guarda aparte, sin tocar (ver `fullImages` en db.ts).
 */
export const THUMBNAIL_MAX_SIDE = 720;
export const THUMBNAIL_QUALITY = 0.82;
/** Versión de la miniatura: 1 = la de 320 px al 60 % (antigua, sin campo), 2 = la de 720 px al 82 % con fondo blanco */
export const THUMBNAIL_VERSION = 2;

/** ¿Este registro tiene una miniatura antigua que se puede rehacer desde su render completo? */
export function needsThumbnailUpgrade(record: { hasFullImage?: boolean; thumbV?: number }): boolean {
  return !!record.hasFullImage && (record.thumbV ?? 1) < THUMBNAIL_VERSION;
}

export async function createThumbnail(
  dataUrl: string,
  maxWidth = THUMBNAIL_MAX_SIDE,
  quality = THUMBNAIL_QUALITY
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve(dataUrl); return; }

      // JPEG no tiene transparencia: sin esto, un render con fondo transparente (PNG/WebP) quedaba NEGRO en la grilla
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, w, h);
      const thumb = canvas.toDataURL('image/jpeg', quality);
      resolve(thumb);
    };
    img.onerror = () => resolve(dataUrl); // fallback: store original
    img.src = dataUrl;
  });
}
