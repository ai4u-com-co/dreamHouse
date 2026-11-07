'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, RefreshCw, X, Check, RotateCcw, AlertCircle } from 'lucide-react';
import clsx from 'clsx';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

export default function CameraCaptureModal({
  isOpen,
  onClose,
  onCapture,
  title = 'Tomar foto',
}: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Detener la cámara y liberar recursos
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Iniciar stream de video
  const startCamera = useCallback(async (facing: 'environment' | 'user') => {
    stopStream();
    setCameraError(null);
    setIsLoading(true);

    if (
      typeof window === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setCameraError('Tu navegador o dispositivo no soporta acceso directo a la cámara.');
      setIsLoading(false);
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      // Detectar si hay más de una cámara de video
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter((d) => d.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch {
        setHasMultipleCameras(false);
      }
    } catch (err: unknown) {
      console.warn('Error accessing camera:', err);
      const errName = err instanceof Error ? err.name : '';
      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError(
          'Permiso para usar la cámara denegado. Permite el acceso a la cámara en tu navegador o usa la captura del sistema.'
        );
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError('No se encontró ninguna cámara conectada en tu dispositivo.');
      } else {
        setCameraError('No se pudo iniciar la cámara en este dispositivo.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [stopStream]);

  // Manejar apertura/cierre del modal
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      setCapturedBlob(null);
      setCapturedUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setCameraError(null);
      return;
    }

    void startCamera(facingMode);

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, startCamera, stopStream]);

  // Cerrar con Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Capturar foto del video stream actual
  const handleCaptureSnapshot = useCallback(() => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Si la cámara es frontal ('user'), podemos voltearla horizontalmente para que coincida con el espejo
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCapturedBlob(blob);
        const url = URL.createObjectURL(blob);
        setCapturedUrl(url);
      },
      'image/jpeg',
      0.92
    );
  }, [facingMode]);

  // Confirmar y usar la foto tomada
  const handleConfirmPhoto = useCallback(() => {
    if (!capturedBlob) return;
    const file = new File([capturedBlob], `foto-camara-${Date.now()}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
    onCapture(file);
    onClose();
  }, [capturedBlob, onCapture, onClose]);

  // Repetir / Descartar captura y volver al video
  const handleRetakePhoto = useCallback(() => {
    if (capturedUrl) {
      URL.revokeObjectURL(capturedUrl);
      setCapturedUrl(null);
    }
    setCapturedBlob(null);
    void startCamera(facingMode);
  }, [capturedUrl, facingMode, startCamera]);

  // Cambiar entre cámara trasera y frontal
  const handleToggleFacingMode = useCallback(() => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  }, []);

  // Fallback con input capture nativo
  const handleFallbackFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        onCapture(file);
        onClose();
      }
      e.target.value = '';
    },
    [onCapture, onClose]
  );

  if (!isOpen) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="camera-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-card border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border bg-card-elevated">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Camera className="w-4 h-4" />
            </div>
            <div>
              <h2 id="camera-modal-title" className="text-sm sm:text-base font-semibold text-foreground">
                {title}
              </h2>
              <p className="text-xs text-muted-foreground font-mono">
                {capturedBlob ? 'Revisa la foto antes de usarla' : 'Apunta y dispara'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar cámara"
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Área del visor o vista previa de captura */}
        <div className="relative flex-1 bg-black aspect-[4/3] sm:aspect-[16/9] min-h-[260px] flex items-center justify-center overflow-hidden">
          {capturedUrl ? (
            /* Vista de la foto tomada */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={capturedUrl}
              alt="Foto capturada"
              className="w-full h-full object-contain"
            />
          ) : cameraError ? (
            /* Vista de error / fallback */
            <div className="p-6 text-center max-w-xs space-y-4">
              <div className="w-12 h-12 rounded-full bg-destructive/15 text-destructive mx-auto flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Acceso a cámara</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{cameraError}</p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => fallbackInputRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                >
                  <Camera className="w-4 h-4" />
                  Abrir cámara del dispositivo
                </button>
                <input
                  ref={fallbackInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFallbackFileChange}
                />
              </div>
            </div>
          ) : (
            /* Visor en vivo con video */
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={clsx(
                  'w-full h-full object-cover',
                  facingMode === 'user' && 'scale-x-[-1]'
                )}
              />

              {isLoading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-xs text-white">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    Iniciando cámara...
                  </div>
                </div>
              )}

              {/* Botón para alternar cámaras si hay múltiples disponibles */}
              {hasMultipleCameras && (
                <button
                  type="button"
                  onClick={handleToggleFacingMode}
                  title="Cambiar de cámara"
                  className="absolute top-3 right-3 p-2.5 bg-black/60 hover:bg-black/80 text-white rounded-full backdrop-blur-md border border-white/20 transition-all hover:scale-105"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}

              {/* Guía visual sutil de encuadre */}
              <div className="absolute inset-6 border border-white/20 rounded-xl pointer-events-none" />
            </>
          )}
        </div>

        {/* Pie de controles */}
        <div className="p-4 bg-card-elevated border-t border-border flex items-center justify-between gap-3">
          {capturedBlob ? (
            /* Opciones post-disparo: Repetir o Confirmar */
            <>
              <button
                type="button"
                onClick={handleRetakePhoto}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card text-foreground hover:bg-muted text-xs sm:text-sm font-medium transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Tomar de nuevo
              </button>

              <button
                type="button"
                onClick={handleConfirmPhoto}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-xs sm:text-sm hover:opacity-90 shadow-md transition-all"
              >
                <Check className="w-4 h-4" />
                Usar esta foto
              </button>
            </>
          ) : !cameraError ? (
            /* Botón de disparo central */
            <div className="w-full flex items-center justify-between">
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Cámara nativa
              </button>
              <input
                ref={fallbackInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFallbackFileChange}
              />

              <button
                type="button"
                onClick={handleCaptureSnapshot}
                disabled={isLoading}
                aria-label="Tomar foto"
                className="group relative flex items-center justify-center w-16 h-16 rounded-full border-4 border-primary/40 hover:border-primary transition-all p-1 active:scale-95"
              >
                <div className="w-full h-full rounded-full bg-primary group-hover:scale-95 transition-transform flex items-center justify-center shadow-lg">
                  <Camera className="w-6 h-6 text-primary-foreground" />
                </div>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancelar
              </button>
            </div>
          ) : (
            /* En caso de error, botón para cerrar */
            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
