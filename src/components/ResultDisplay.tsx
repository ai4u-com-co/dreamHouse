import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Sparkles, Maximize2, LayoutGrid, Wand } from 'lucide-react';
import Image from 'next/image';
import { Button } from './ui/Button';
import clsx from 'clsx';
import { useLightbox } from '@/context/LightboxContext';

// Extensión del archivo según el tipo real de la imagen (el render puede ser jpeg o png)
function imageExtension(url: string): string {
  const match = /^data:image\/([a-z0-9+.-]+);/i.exec(url);
  const type = match?.[1]?.toLowerCase();
  if (type === 'jpeg') return 'jpg';
  return type || 'png';
}

// Mensajes para el estado de carga
const LOADING_MESSAGES = [
  { emoji: "○", main: "Analizando tu visión...", sub: "Interpretando cada detalle arquitectónico" },
  { emoji: "╱", main: "Dibujando los primeros trazos...", sub: "Como Le Corbusier con su lápiz" },
  { emoji: "□", main: "Calculando proporciones áureas...", sub: "La matemática de la belleza" },
  { emoji: "◼", main: "Eligiendo los mejores materiales...", sub: "Concreto, vidrio, madera" },
  { emoji: "◉", main: "Jugando con la luz y las sombras...", sub: "Tadao Ando estaría orgulloso" },
  { emoji: "⊡", main: "Colocando cada ventana estratégicamente...", sub: "Las vistas importan" },
  { emoji: "◇", main: "Diseñando espacios que respiran...", sub: "El aire también necesita su lugar" },
  { emoji: "◌", main: "Integrando arquitectura y naturaleza...", sub: "Frank Lloyd Wright lo aprobaría" },
  { emoji: "△", main: "Perfeccionando las líneas del techo...", sub: "Cada ángulo cuenta" },
  { emoji: "✦", main: "Añadiendo ese toque de magia...", sub: "Lo que hace único tu diseño" },
  { emoji: "◑", main: "Creando sombras cinematográficas...", sub: "Digno de una portada de ArchDaily" },
  { emoji: "⊙", main: "Plantando el jardín virtual...", sub: "Verde que te quiero verde" },
  { emoji: "◈", main: "Ajustando la paleta de colores...", sub: "Armonía cromática en proceso" },
  { emoji: "◐", main: "Capturando el golden hour perfecto...", sub: "La luz dorada lo cambia todo" },
  { emoji: "⊕", main: "Refinando cada pixel...", sub: "Los detalles hacen la diferencia" },
  { emoji: "⊞", main: "Consultando con la IA arquitecta...", sub: "Ella sabe lo que hace" },
  { emoji: "◎", main: "Imaginando quién vivirá aquí...", sub: "Cada casa cuenta una historia" },
  { emoji: "▲", main: "Verificando que Zaha estaría impresionada...", sub: "El listón está alto" },
  { emoji: "▷", main: "Casi listo...", sub: "Tu sueño arquitectónico está tomando forma" },
  { emoji: "◀", main: "Últimos retoques maestros...", sub: "La perfección está en los detalles" },
];

interface ResultDisplayProps {
  imageUrl: string | null;
  isLoading: boolean;
  onRegenerate: () => void;
  title?: string;
  subtitle?: string;
  vistasImages?: { type: string; url: string | null; loading?: boolean }[];
  activeVistaIndex?: number;
  houseName?: string | null;
  /** Usa el render mostrado como imagen base de otro módulo (sus parámetros viajan en el propio archivo) */
  onUseAsBase?: (target: 'vistas' | 'edit') => void;
}



export default function ResultDisplay({ 
  imageUrl, 
  isLoading, 
  onRegenerate,
  title = "Resultado Final",
  subtitle = "Generado con inteligencia artificial",
  vistasImages,
  activeVistaIndex = 0,
  houseName,
  onUseAsBase
}: ResultDisplayProps) {
  const [messageIndex, setMessageIndex] = useState(0);
  const { openLightbox } = useLightbox();

  // Rotate messages while loading
  useEffect(() => {
    if (!isLoading) {
      setMessageIndex(0);
      return;
    }

    // Start with a random message
    setMessageIndex(Math.floor(Math.random() * LOADING_MESSAGES.length));

    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!imageUrl && !isLoading && (!vistasImages || vistasImages.length === 0)) return null;

  const currentMessage = LOADING_MESSAGES[messageIndex];

  // Prepare images for lightbox
  const imagesForLightbox = vistasImages?.length 
    ? vistasImages.filter(v => v.url).map(v => ({ url: v.url!, type: v.type }))
    : imageUrl ? [{ url: imageUrl, type: title }] : [];

  return (
    <div className="space-y-6 animate-fade-in-up">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground tracking-tight">
                {title}
              </h3>
              <p className="text-xs text-muted-foreground">
                {subtitle}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {vistasImages && (
              <span className="text-[10px] font-mono text-muted-foreground">
                {vistasImages.filter(v => v.url).length} / {vistasImages.length} Vistas
              </span>
            )}
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground px-3 py-1.5 bg-card rounded-full border border-border">
              {isLoading ? 'Generando...' : 'Completado'}
            </span>
          </div>
        </div>

        {/* Vistas Gallery Grid */}
        {vistasImages && vistasImages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
            {vistasImages.map((vista, idx) => (
              <div 
                key={vista.type}
                className={clsx(
                  "relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer group",
                  vista.url ? "border-border hover:border-primary shadow-sm hover:shadow-md" : "border-dashed border-border bg-card/50",
                  activeVistaIndex === idx && vista.url && "border-primary ring-2 ring-primary/20"
                )}
                onClick={() => {
                   if (vista.url && !vista.loading) {
                     const urlIndex = vistasImages.filter(v => v.url).findIndex(v => v.url === vista.url);
                     openLightbox(imagesForLightbox, urlIndex >= 0 ? urlIndex : 0);
                   }
                }}
              >
                {vista.loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-[9px] uppercase font-bold text-muted-foreground leading-tight">Generando {vista.type}</span>
                  </div>
                ) : vista.url ? (
                  <>
                    <Image src={vista.url} alt={vista.type} fill className="object-cover transition-transform duration-500 group-hover:scale-110" unoptimized />
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 p-1.5 backdrop-blur-sm transform translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                      <p className="text-[9px] text-white font-bold uppercase truncate">{vista.type}</p>
                    </div>
                    <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                       <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2 text-center opacity-40">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground leading-tight">{vista.type}</span>
                    <span className="text-[8px] text-muted-foreground">En espera</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Main Result Display (Loading or Image) */}
        <div className="relative gradient-border p-[1px] rounded-2xl group overflow-hidden">
          <div className="relative aspect-video w-full bg-card rounded-2xl overflow-hidden">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-card">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full border-2 border-border" />
                  <div className="absolute inset-0 w-20 h-20 rounded-full border-2 border-transparent border-t-primary border-r-primary/50 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <span key={messageIndex} className="text-2xl animate-fade-in-up">{currentMessage.emoji}</span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 min-h-[60px] text-center px-4">
                  <p key={messageIndex} className="text-foreground font-medium text-lg animate-fade-in-up">{currentMessage.main}</p>
                  <p className="text-muted-foreground text-sm max-w-md">{currentMessage.sub}</p>
                </div>
                <div className="w-48 h-1 bg-border rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-primary to-transparent shimmer" />
                </div>
                <p className="text-[10px] text-muted uppercase tracking-wider mt-2">Esto puede tomar 30-60 segundos</p>
              </div>
            ) : imageUrl || (vistasImages && vistasImages[activeVistaIndex]?.url) ? (
              <>
                <Image 
                  src={imageUrl || vistasImages![activeVistaIndex]!.url!} 
                  alt={title} 
                  fill
                  className="w-full h-full object-contain bg-black/40 transition-transform duration-700 group-hover:scale-[1.01] cursor-zoom-in" 
                  onClick={() => {
                    if (vistasImages?.length) {
                      const url = vistasImages![activeVistaIndex]!.url;
                      const urlIndex = vistasImages.filter(v => v.url).findIndex(v => v.url === url);
                      openLightbox(imagesForLightbox, urlIndex >= 0 ? urlIndex : 0);
                    } else {
                      openLightbox(imagesForLightbox, 0);
                    }
                  }}
                  unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-[10px] font-medium text-white/80 flex items-center gap-1.5">
                    <Maximize2 className="w-3 h-3" />
                    Clic para ampliar
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-end gap-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 sm:translate-y-2 sm:group-hover:translate-y-0">
                  <Button
                    onClick={onRegenerate}
                    variant="outline"
                    className="bg-black/50 backdrop-blur-md border-white/20 text-white hover:bg-white/20"
                    size="sm"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerar
                  </Button>
                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => {
                        if (vistasImages?.length) {
                          const url = vistasImages![activeVistaIndex]!.url;
                          const urlIndex = vistasImages.filter(v => v.url).findIndex(v => v.url === url);
                          openLightbox(imagesForLightbox, urlIndex >= 0 ? urlIndex : 0);
                        } else {
                          openLightbox(imagesForLightbox, 0);
                        }
                      }}
                      variant="outline"
                      size="icon"
                      className="bg-black/50 backdrop-blur-md border-white/20 text-white hover:bg-white/20 w-10 h-10 rounded-full"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                    <a
                      href={imageUrl || vistasImages![activeVistaIndex]!.url!}
                      download={`${houseName ? houseName.replace(/\s+/g, '-') : "dreamhouse-render"}.${imageExtension(imageUrl || vistasImages![activeVistaIndex]!.url!)}`}
                      className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary rounded-lg hover:shadow-lg hover:shadow-primary/30 transition-all hover:scale-105"
                    >
                      <Download className="w-4 h-4" />
                      Descargar
                    </a>
                    {onUseAsBase && (
                      <>
                        <button
                          type="button"
                          onClick={() => onUseAsBase('vistas')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] text-sm font-semibold text-white bg-black/50 backdrop-blur-md border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <LayoutGrid className="w-4 h-4" aria-hidden="true" />
                          Crear vistas
                        </button>
                        <button
                          type="button"
                          onClick={() => onUseAsBase('edit')}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] text-sm font-semibold text-white bg-black/50 backdrop-blur-md border border-white/20 rounded-lg hover:bg-white/20 transition-colors"
                        >
                          <Wand className="w-4 h-4" aria-hidden="true" />
                          Editar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>
  );
}
