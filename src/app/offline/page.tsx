import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sin conexión | DreamHouse',
  robots: { index: false },
};

// Página que el service worker muestra cuando no hay red. Es estática y no depende de nada externo.
export default function OfflinePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
      <div className="max-w-md text-center space-y-6">
        <p className="text-xs font-mono font-bold uppercase tracking-[0.4em] text-primary">Sin conexión</p>
        <h1 className="text-4xl font-black uppercase tracking-tighter">No hay internet</h1>
        <p className="text-base text-muted-foreground leading-relaxed">
          DreamHouse necesita conexión para generar y editar imágenes con IA. Revisa tu red y vuelve a intentarlo: tus
          parámetros siguen donde los dejaste.
        </p>
        <a
          href="/studio"
          className="inline-flex items-center justify-center min-h-11 px-8 text-sm font-bold uppercase tracking-widest bg-primary text-primary-foreground"
        >
          Reintentar
        </a>
      </div>
    </main>
  );
}
