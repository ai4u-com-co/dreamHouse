'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// ============================================
// PWA: registro del service worker + instalación en el celular
// ============================================
// - Android/Chrome/Edge: el navegador dispara `beforeinstallprompt`; lo guardamos y lo lanzamos desde un botón.
// - iPhone/iPad (Safari): no existe ese evento; solo se puede "Añadir a pantalla de inicio" a mano, así que
//   mostramos la guía.
// - Ya instalada (modo standalone): no se muestra nada.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface PwaState {
  /** El navegador puede instalar la app con un clic (Android/desktop) */
  canInstall: boolean;
  /** iPhone/iPad en Safari, sin instalar: toca explicar el paso manual */
  needsIosInstructions: boolean;
  /** Ya corre como app instalada */
  isStandalone: boolean;
  /** Lanza el aviso de instalación del navegador. Devuelve true si el usuario aceptó */
  promptInstall: () => Promise<boolean>;
}

const PwaContext = createContext<PwaState>({
  canInstall: false,
  needsIosInstructions: false,
  isStandalone: false,
  promptInstall: async () => false,
});

export const usePwa = () => useContext(PwaContext);

function detectStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone;
}

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ se presenta como Mac: se distingue por la pantalla táctil
  const iPadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    setIsStandalone(detectStandalone());
    setIsIos(detectIos());

    // Service worker: solo en producción (en desarrollo una caché vieja confunde más de lo que ayuda)
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const register = () => {
        navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
          console.error('No se pudo registrar el service worker:', error);
        });
      };
      if (document.readyState === 'complete') register();
      else window.addEventListener('load', register, { once: true });
    }

    const onBeforeInstall = (event: Event) => {
      event.preventDefault(); // evita la mini-barra automática: la lanzamos nosotros desde un botón
      setDeferred(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferred(null);
      setIsStandalone(true);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null); // el evento solo sirve una vez
    return outcome === 'accepted';
  }, [deferred]);

  const value = useMemo<PwaState>(
    () => ({
      canInstall: !!deferred && !isStandalone,
      needsIosInstructions: isIos && !isStandalone,
      isStandalone,
      promptInstall,
    }),
    [deferred, isIos, isStandalone, promptInstall],
  );

  return <PwaContext.Provider value={value}>{children}</PwaContext.Provider>;
}
