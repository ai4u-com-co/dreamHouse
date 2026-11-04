'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { dbFor } from '@/lib/db';
import { useAuth } from '@/context/AuthContext';

interface ImageLightboxProps {
  images: { url: string; type?: string; id?: string }[];
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}

export default function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onIndexChange
}: ImageLightboxProps) {
  const [zoom, setZoom] = useState(1);
  const currentImage = images[currentIndex];
  const { userId } = useAuth(); // el historial es de UNA cuenta

  // Renders full-res cargados on-demand (object URLs), cacheados por id de generación.
  // Solo se mantiene en memoria la imagen visible y las ya visitadas; no las 20 a la vez.
  const [fullUrls, setFullUrls] = useState<Record<string, string>>({});
  const objectUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    const id = currentImage?.id;
    if (!id || !userId || fullUrls[id]) return;
    let cancelled = false;
    dbFor(userId).getFullImage(id).then((blob) => {
      if (cancelled || !blob) return;
      const url = URL.createObjectURL(blob);
      objectUrlsRef.current.push(url);
      setFullUrls((prev) => ({ ...prev, [id]: url }));
    }).catch(() => {/* fallback al thumbnail */});
    return () => { cancelled = true; };
  }, [currentImage?.id, fullUrls, userId]);

  // Liberar los object URLs al desmontar.
  useEffect(() => {
    const urls = objectUrlsRef.current;
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)); };
  }, []);

  const displayUrl = (currentImage?.id && fullUrls[currentImage.id]) || currentImage?.url;

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onIndexChange((currentIndex + 1) % images.length);
    setZoom(1);
  }, [currentIndex, images.length, onIndexChange]);

  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onIndexChange((currentIndex - 1 + images.length) % images.length);
    setZoom(1);
  }, [currentIndex, images.length, onIndexChange]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 4));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handleNext, handlePrev]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  if (!currentImage?.url) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center animate-fade-in"
      onClick={onClose}
    >
      {/* Top Bar: Counter & Actions */}
      <div className="absolute top-0 inset-x-0 h-20 flex items-center justify-between px-6 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="px-3 py-1.5 bg-white/10 rounded-full border border-white/10 backdrop-blur-md">
            <p className="text-white/90 text-xs font-mono uppercase tracking-widest leading-none">
              {currentImage.type || 'Vista'} · <span className="text-primary font-bold">{currentIndex + 1}</span> / {images.length}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 pointer-events-auto">
          <button
            onClick={onClose}
            className="p-3 text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/5"
            title="Cerrar (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      {images.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-6 z-10 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all group"
            title="Anterior (Flecha Izquierda)"
          >
            <ChevronLeft className="w-10 h-10 group-active:scale-90 transition-transform" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-6 z-10 p-4 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition-all group"
            title="Siguiente (Flecha Derecha)"
          >
            <ChevronRight className="w-10 h-10 group-active:scale-90 transition-transform" />
          </button>
        </>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 bg-black/40 backdrop-blur-xl rounded-2xl px-6 py-3 border border-white/10 shadow-2xl">
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.5)); }}
          className="p-2 text-white/70 hover:text-white transition-colors hover:bg-white/10 rounded-lg"
          title="Alejar (-)"
        >
          <ZoomOut className="w-6 h-6" />
        </button>
        <div className="w-px h-6 bg-white/10" />
        <span className="text-white/90 text-sm font-mono min-w-[5ch] text-center font-bold">
          {Math.round(zoom * 100)}%
        </span>
        <div className="w-px h-6 bg-white/10" />
        <button
          onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 4)); }}
          className="p-2 text-white/70 hover:text-white transition-colors hover:bg-white/10 rounded-lg"
          title="Acercar (+)"
        >
          <ZoomIn className="w-6 h-6" />
        </button>
      </div>

      {/* Image container */}
      <div 
        className="max-w-[85vw] max-h-[80vh] relative transition-transform duration-500 ease-out flex items-center justify-center overflow-auto custom-scrollbar"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={displayUrl}
          alt={currentImage.type || "Full screen view"}
          width={2560}
          height={1440}
          className="transition-transform duration-300 ease-out select-none"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
          draggable={false}
          unoptimized
        />
      </div>

      {/* Instructions */}
      <div className="absolute bottom-10 right-10 text-white/30 text-xs font-mono tracking-tighter hidden lg:block uppercase">
        Navegar: ← → · Zoom: + - · Cerrar: ESC
      </div>
    </div>
  );
}
