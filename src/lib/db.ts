import { DreamHouseParams, GenerationMode } from '../types';

export interface GenerationRecord {
  id: string;
  timestamp: number;
  mode: GenerationMode;
  params: DreamHouseParams;
  imageUrl: string; // thumbnail (320px JPEG) — usado solo para la grilla del historial
  prompt?: string;
  houseName?: string;
  hasFullImage?: boolean; // true si existe el render full-res en el store `fullImages`
  /** Id de la imagen (el de sus metadatos incrustados): enlaza un render con las vistas y ediciones que salieron de él */
  imageId?: string;
}

// El historial vive en el navegador. Cada persona tiene su PROPIA base (`DreamHouseDB-<user_id>`): en un navegador compartido,
// otra cuenta de Google no ve los renders de la anterior. Toda operación recibe el DUEÑO de forma explícita (dbFor(ownerId)):
// una operación que empezó con una cuenta se guarda en la de ESA cuenta, aunque la sesión cambie mientras tanto.
//
// `DreamHouseDB` (sin sufijo) es la base de la versión anterior, sin dueño: NO se adopta sola; la interfaz le pregunta
// a la persona si quiere importarla (hasLegacyHistory / importLegacyHistory).
export const LEGACY_DB_NAME = 'DreamHouseDB';
const DB_VERSION = 2;
const STORE_NAME = 'generations';
const IMAGES_STORE = 'fullImages'; // blobs full-res, keyed por el id de la generación
// Tope de renders guardados por cuenta. Antes eran 20: una sola tanda de vistas (hasta 20) o 5 renders con 4 variantes vaciaba
// todo lo anterior sin avisar. Cada render full-res pesa ~1-3 MB; 60 caben de sobra en IndexedDB.
export const MAX_HISTORY = 60;

export class DreamHouseDB {
  private db: IDBDatabase | null = null;

  constructor(private readonly dbName: string) {}

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('mode', 'mode', { unique: false });
        }
        // v2: store separado para los renders full-res (out-of-line keys = id de la generación).
        // Va aparte para que getAllGenerations() NO materialice 20 imágenes full-res en memoria.
        if (!db.objectStoreNames.contains(IMAGES_STORE)) {
          db.createObjectStore(IMAGES_STORE);
        }
      };
    });
  }

  /** Cierra la conexión (se reabre sola en la siguiente operación). */
  close(): void {
    this.db?.close();
    this.db = null;
  }

  async saveGeneration(
    record: Omit<GenerationRecord, 'id' | 'timestamp'>,
    fullImage?: Blob
  ): Promise<{ id: string; pruned: number }> {
    await this.init();
    const id = crypto.randomUUID();
    const timestamp = Date.now();
    const fullRecord: GenerationRecord = { ...record, id, timestamp, hasFullImage: !!fullImage };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME, IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const imagesStore = transaction.objectStore(IMAGES_STORE);
      let pruned = 0;

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => resolve({ id, pruned });

      // Add the new record + its full-res blob
      store.add(fullRecord);
      if (fullImage) imagesStore.put(fullImage, id);

      // After adding, prune oldest records (and their blobs) beyond MAX_HISTORY
      const index = store.index('timestamp');
      const countRequest = index.getAll();
      countRequest.onsuccess = () => {
        const all = (countRequest.result as GenerationRecord[]).sort(
          (a, b) => a.timestamp - b.timestamp
        );
        const toDelete = all.slice(0, Math.max(0, all.length - MAX_HISTORY));
        pruned = toDelete.length;
        toDelete.forEach(r => {
          store.delete(r.id);
          imagesStore.delete(r.id);
        });
      };
    });
  }

  /**
   * Importa registros (con su render full-res) de otra base. FUSIONA por id: lo que ya existe se conserva, no se sobrescribe.
   * Idempotente: importar dos veces lo mismo no duplica nada. Respeta el tope de MAX_HISTORY (descarta los más viejos).
   */
  async importGenerations(items: Array<{ record: GenerationRecord; full: Blob | null }>): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME, IMAGES_STORE], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const imagesStore = transaction.objectStore(IMAGES_STORE);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      const existing = store.getAllKeys();
      existing.onsuccess = () => {
        const known = new Set(existing.result as string[]);
        for (const { record, full } of items) {
          if (known.has(record.id)) continue; // ya la tiene esta cuenta
          store.put({ ...record, hasFullImage: !!full });
          if (full) imagesStore.put(full, record.id);
        }
        const all = store.getAll();
        all.onsuccess = () => {
          const sorted = (all.result as GenerationRecord[]).sort((a, b) => a.timestamp - b.timestamp);
          sorted.slice(0, Math.max(0, sorted.length - MAX_HISTORY)).forEach((r) => {
            store.delete(r.id);
            imagesStore.delete(r.id);
          });
        };
      };
    });
  }

  /** Carga el render full-res (Blob) de una generación, on-demand. null si no existe (registros previos a v2). */
  async getFullImage(id: string): Promise<Blob | null> {
    await this.init();
    if (!this.db!.objectStoreNames.contains(IMAGES_STORE)) return null;
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([IMAGES_STORE], 'readonly');
      const store = transaction.objectStore(IMAGES_STORE);
      const request = store.get(id);
      request.onsuccess = () => resolve((request.result as Blob) ?? null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllGenerations(): Promise<GenerationRecord[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.getAll(); // By default this might not be sorted, we'll sort manually or use a cursor if needed

      request.onsuccess = () => {
        const results = request.result as GenerationRecord[];
        // Sort descending by timestamp
        resolve(results.sort((a, b) => b.timestamp - a.timestamp));
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteGeneration(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME, IMAGES_STORE], 'readwrite');
      transaction.objectStore(STORE_NAME).delete(id);
      transaction.objectStore(IMAGES_STORE).delete(id);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async clearAll(): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME, IMAGES_STORE], 'readwrite');
      transaction.objectStore(STORE_NAME).clear();
      transaction.objectStore(IMAGES_STORE).clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

const instances = new Map<string, DreamHouseDB>();

/** Historial de UNA cuenta. Siempre con el dueño explícito: no hay base «activa» global. */
export function dbFor(ownerId: string): DreamHouseDB {
  let instance = instances.get(ownerId);
  if (!instance) {
    instance = new DreamHouseDB(`${LEGACY_DB_NAME}-${ownerId}`);
    instances.set(ownerId, instance);
  }
  return instance;
}

// ---------- Historial anterior (sin dueño) ----------
const legacyExists = async (): Promise<boolean> =>
  ((await indexedDB.databases?.()) ?? []).some((d) => d.name === LEGACY_DB_NAME); // sin soporte: no se ofrece (y no se crea vacía)

const deleteLegacy = (): Promise<void> =>
  new Promise((resolve, reject) => {
    const del = indexedDB.deleteDatabase(LEGACY_DB_NAME);
    del.onsuccess = () => resolve();
    del.onerror = () => reject(del.error);
    del.onblocked = () => reject(new Error('El historial anterior está abierto en otra pestaña.'));
  });

/** ¿Hay renders anteriores sin dueño en este navegador? Si la base anterior está vacía se borra sola (no hay nada que importar). */
export async function hasLegacyHistory(): Promise<boolean> {
  try {
    if (!(await legacyExists())) return false;
    const legacy = new DreamHouseDB(LEGACY_DB_NAME);
    try {
      if ((await legacy.getAllGenerations()).length > 0) return true;
    } finally {
      legacy.close();
    }
    await deleteLegacy().catch(() => {});
    return false;
  } catch {
    return false;
  }
}

/**
 * Importa (fusiona) el historial anterior en el de `ownerId` y lo borra. Idempotente: si el borrado falla lanza el error,
 * el anterior queda intacto y reintentar no duplica nada (fusión por id).
 */
export async function importLegacyHistory(ownerId: string): Promise<void> {
  const legacy = new DreamHouseDB(LEGACY_DB_NAME);
  let items: Array<{ record: GenerationRecord; full: Blob | null }>;
  try {
    const records = await legacy.getAllGenerations();
    items = [];
    for (const record of records) items.push({ record, full: record.hasFullImage ? await legacy.getFullImage(record.id) : null });
  } finally {
    legacy.close();
  }
  await dbFor(ownerId).importGenerations(items);
  await deleteLegacy();
}
