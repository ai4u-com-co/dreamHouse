// Genera los íconos de la PWA a partir de una sola fuente vectorial (marca DreamHouse: fondo tinta,
// casa en lima y el punto lima del logotipo). Ejecutar con: node scripts/generate-pwa-icons.mjs
// Salida: public/icons/{icon.svg, icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png}
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const INK = '#050505';
const LIME = '#D4F200';

// Todo el dibujo vive dentro de la "zona segura" central (60 %), así el mismo arte sirve como ícono
// maskable: Android puede recortarlo en círculo, cuadrado redondeado, etc. sin cortar la casa.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="${INK}"/>
  <path d="M256 138 L366 226 V366 H146 V226 Z" fill="none" stroke="${LIME}" stroke-width="22" stroke-linejoin="miter"/>
  <rect x="228" y="290" width="56" height="76" fill="${LIME}"/>
  <circle cx="398" cy="398" r="20" fill="${LIME}"/>
</svg>`;

await mkdir('public/icons', { recursive: true });
await writeFile('public/icons/icon.svg', svg);

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['icon-maskable-512.png', 512],
  ['apple-touch-icon.png', 180],
];
for (const [file, size] of targets) {
  await sharp(Buffer.from(svg)).resize(size, size).png({ compressionLevel: 9 }).toFile(`public/icons/${file}`);
  console.log('✓', file, `${size}x${size}`);
}
