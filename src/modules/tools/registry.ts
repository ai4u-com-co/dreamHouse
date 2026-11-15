/** Herramientas de DreamHouse Tools. Para añadir una: nueva entrada aquí + su página en src/app/tools/<id>/page.tsx. */
export interface ToolInfo {
  id: string;
  title: string;
  description: string;
  href: string;
}

export const TOOLS: readonly ToolInfo[] = [
  {
    id: 'paleta',
    title: 'Paleta de colores',
    description: 'Sube un espacio y una paleta: recibes el mismo espacio —misma arquitectura, ambiente y paisajismo— pintado con esos colores.',
    href: '/tools/paleta',
  },
];
