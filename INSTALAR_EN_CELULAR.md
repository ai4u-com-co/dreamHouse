# Instalar DreamHouse en el celular

DreamHouse es una **PWA**: se instala desde el navegador, sin tienda de apps, y se abre a pantalla completa.

## Android (Chrome)
1. Abre la URL de DreamHouse en Chrome.
2. Toca el botón **Instalar** (ícono de celular con flecha) en la barra superior, o el menú ☰ → **Instalar DreamHouse**.
   Si no aparece, usa el menú ⋮ de Chrome → **Instalar app**.
3. Confirma. Queda un ícono en tu pantalla de inicio; abre directo en el Studio.

## iPhone / iPad (Safari)
1. Abre la URL en **Safari** (no en Chrome).
2. Toca **Compartir** → **Añadir a pantalla de inicio** → **Añadir**.

## Primer uso
- Pega tu **clave de OpenAI** (y la de Gemini si la usas) en el menú ☰ → se guarda solo en tu teléfono.
- Hace falta internet para generar y editar imágenes. Sin conexión la app abre y muestra un aviso; tus parámetros se conservan.

## Requisito para el equipo: la URL debe ser pública
Si el despliegue tiene **Vercel Deployment Protection (SSO)** activo, el teléfono pide iniciar sesión en Vercel antes de ver la app y la
instalación se vuelve incómoda. Para usar la app instalada, el dominio de producción debe abrir sin ese inicio de sesión
(Vercel → proyecto `dream-house` → Settings → Deployment Protection) o tener un dominio propio.

## Para desarrolladores
- Manifest: `src/app/manifest.ts` · Service worker: `public/sw.js` (solo se registra en producción) · Página sin conexión: `src/app/offline`.
- Íconos: `node scripts/generate-pwa-icons.mjs` regenera `public/icons/*` desde una sola fuente vectorial.
- El service worker **nunca** guarda `/api/*` ni peticiones que no sean GET. Al cambiarlo, sube `VERSION` en `public/sw.js`.
- Prueba: `npm run build && npx next start`, abrir en Chrome → DevTools → Application → Manifest / Service Workers.
- Reglas móviles: 375 px sin scroll horizontal, áreas táctiles ≥ 44 px, texto ≥ 12 px.
