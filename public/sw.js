/* Service worker de DreamHouse (PWA).
 *
 * Alcance deliberadamente pequeño: que la app se abra rápido y no muestre el dinosaurio sin conexión.
 *   - Archivos estáticos (JS/CSS/fuentes/íconos/imágenes del propio sitio): caché primero.
 *   - Páginas (navegación): red primero; si no hay red, la última copia guardada o la página /offline.
 *   - NUNCA se toca /api/* ni peticiones que no sean GET ni otros orígenes: las generaciones con IA y las
 *     claves de API siempre van directo a la red, sin copias intermedias.
 * Al cambiar este archivo, sube VERSION para que se limpien las cachés viejas.
 */
const VERSION = 'v1';
const STATIC_CACHE = `dh-static-${VERSION}`;
const PAGES_CACHE = `dh-pages-${VERSION}`;
const OFFLINE_URL = '/offline';
const PRECACHE = [OFFLINE_URL, '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PAGES_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGES_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith('/_next/static/') ||
  url.pathname.startsWith('/icons/') ||
  url.pathname.startsWith('/images/') ||
  /\.(?:woff2?|ttf|otf|css|js|png|jpg|jpeg|webp|avif|svg|ico)$/i.test(url.pathname);

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // otros orígenes (p. ej. Google Fonts, APIs de IA): al navegador
  if (url.pathname.startsWith('/api/')) return; // generaciones y claves: nunca por caché

  // Páginas: red primero, con respaldo
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Solo se guardan respuestas buenas (no redirecciones a un login ni errores)
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(PAGES_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match(OFFLINE_URL)) || Response.error()),
    );
    return;
  }

  // Estáticos: caché primero; si no está, red y se guarda
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok && response.type === 'basic') {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
