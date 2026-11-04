import type { MetadataRoute } from 'next';

// Manifest de la PWA: lo que el navegador necesita para ofrecer "Instalar app" / "Añadir a pantalla de inicio".
// Colores = marca DreamHouse (tinta #050505). La app abre directo en el Studio, que es lo que se usa en el celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/studio',
    name: 'DreamHouse | AI Architecture Studio',
    short_name: 'DreamHouse',
    description: 'Genera y edita renders arquitectónicos (exterior, interior, vistas y edición) con IA.',
    lang: 'es',
    dir: 'ltr',
    start_url: '/studio',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#050505',
    theme_color: '#050505',
    categories: ['design', 'productivity', 'photo'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Abrir el Studio', short_name: 'Studio', url: '/studio', icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }] },
    ],
  };
}
