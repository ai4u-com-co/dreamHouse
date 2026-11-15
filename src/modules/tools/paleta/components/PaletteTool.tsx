'use client';

import React, { useState } from 'react';
import { AlertCircle, Palette, Home, Wand2 } from 'lucide-react';
import LotUploader from '@/components/LotUploader';
import ResultDisplay from '@/components/ResultDisplay';
import ModelOptionsPanel, { durationNote, type QuoteState } from '@/components/ModelOptionsPanel';
import { CreativeFields } from '@/components/FormExtras';
import { Button } from '@/components/ui/Button';
import { ApiError, callApi } from '@/lib/api-client';
import type { GenerationRecord } from '@/lib/db';
import { normalizeRenderSettings } from '@/lib/render-settings';
import type { DreamHouseParams } from '@/types';

interface PaletteResponse {
  imageUrl: string;
  images?: string[];
  metadataIds?: string[];
  houseName: string;
}

interface PaletteToolProps {
  /** Estado compartido del Studio: la dirección creativa y el prompt negativo viven en los mismos campos que los demás módulos */
  params: DreamHouseParams;
  onChange: <K extends keyof DreamHouseParams>(key: K, value: DreamHouseParams[K]) => void;
  spaceFile: File | null;
  onSpaceChange: (file: File | null) => void;
  paletteFile: File | null;
  onPaletteChange: (file: File | null) => void;
  /** Cotización calculada por el Studio con las dos imágenes (el servidor la vuelve a calcular) */
  quote: QuoteState;
  isAdmin: boolean;
  credits: number;
  /** Guarda en el historial del Studio (así aparece de inmediato en la galería) */
  saveToHistory: (record: Omit<GenerationRecord, 'id' | 'timestamp'>, owner: string | null) => Promise<{ pruned: number }>;
  onNotice: (message: string) => void;
}

/** Tools · Paleta de colores. Vive dentro del módulo de trabajo «Tools» del Studio. */
export default function PaletteTool({
  params, onChange, spaceFile, onSpaceChange, paletteFile, onPaletteChange, quote, isAdmin, credits, saveToHistory, onNotice,
}: PaletteToolProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cost = quote.ok ? quote.value.options.credits : 0;
  const ready = !!spaceFile && !!paletteFile && quote.ok;

  const handleGenerate = async () => {
    setError(null);
    if (!spaceFile) { setError('Sube la imagen del espacio que quieres recolorear.'); return; }
    if (!paletteFile) { setError('Sube la imagen de la paleta de colores.'); return; }
    setIsLoading(true);
    setImageUrl(null);
    setVariants([]);
    try {
      const formData = new FormData();
      formData.append('spaceImage', spaceFile);
      formData.append('paletteImage', paletteFile);
      const sent = normalizeRenderSettings({ ...params, mode: 'paleta' });
      formData.append('params', JSON.stringify(sent));

      // Con la sesión de Google (el servidor cobra los créditos); `ownerId` = la cuenta que pidió esta imagen
      const { data, ownerId } = await callApi<PaletteResponse>('/api/tools/paleta', formData);
      const all = data.images?.length ? data.images : [data.imageUrl];
      setImageUrl(all[0]);
      setVariants(all);

      try {
        for (const [k, url] of all.entries()) {
          const { pruned } = await saveToHistory({
            mode: 'paleta',
            params: sent,
            imageUrl: url,
            houseName: data.houseName,
            imageId: data.metadataIds?.[k],
          }, ownerId);
          if (pruned > 0) onNotice('Historial lleno: se borró lo más antiguo. Descarga lo que quieras conservar.');
        }
      } catch (historyErr) {
        console.error('Failed to save to history:', historyErr);
        onNotice('La imagen se generó, pero no se pudo guardar en el historial. Descárgala ahora para no perderla.');
      }

      setTimeout(() => document.getElementById('paleta-result')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Ocurrió un error inesperado.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-10" data-testid="tool-paleta">
      <div className="space-y-2">
        <h4 className="text-xs font-mono font-bold uppercase tracking-[0.3em] text-primary">Tool · Paleta de colores</h4>
        <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
          Sube un espacio y una paleta de colores. Recibes el mismo espacio —misma arquitectura, mismo ambiente y mismo paisajismo— pero pintado y vestido con esa paleta.
        </p>
      </div>

      {/* Los dos slots: espacio y paleta */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-border bg-card/40" data-testid="slot-espacio">
          <LotUploader
            file={spaceFile}
            onFileChange={onSpaceChange}
            title="Espacio"
            description="Foto o render del interior o exterior que quieres recolorear."
            icon={<Home className="w-5 h-5 text-green-500" />}
            optional={false}
            loadedLabel="Espacio cargado"
            altLabel="el espacio"
            skipSizeValidation
          />
        </div>
        <div className="border border-border bg-card/40" data-testid="slot-paleta">
          <LotUploader
            file={paletteFile}
            onFileChange={onPaletteChange}
            title="Paleta de colores"
            description="Una imagen con los colores: muestras, un moodboard o una foto de referencia."
            icon={<Palette className="w-5 h-5 text-pink-500" />}
            optional={false}
            loadedLabel="Paleta cargada"
            altLabel="la paleta de colores"
            skipSizeValidation
          />
        </div>
      </div>

      {/* Dirección creativa + prompt negativo */}
      <section aria-label="Dirección creativa y prompt negativo" className="space-y-3">
        <CreativeFields params={params} onChange={onChange} disabled={isLoading} />
        <p className="text-xs text-muted-foreground">
          La arquitectura, el ambiente y el paisajismo no cambian: la dirección creativa solo orienta cómo se usa la paleta (por ejemplo, «el color más fuerte solo en la pared del fondo»).
        </p>
      </section>

      <ModelOptionsPanel params={params} onChange={onChange} disabled={isLoading} isAdmin={isAdmin} quote={quote} credits={credits} />

      {error && (
        <div role="alert" className="p-5 bg-destructive text-destructive-foreground flex items-center gap-4">
          <AlertCircle className="w-6 h-6 shrink-0" />
          <p className="opacity-95">{error}</p>
        </div>
      )}

      <div className="flex flex-col items-center gap-2">
        <Button
          onClick={handleGenerate}
          isLoading={isLoading}
          disabled={!ready || isLoading}
          size="lg"
          className="rounded-full px-10 py-6 shadow-xl"
          aria-label="Aplicar paleta de colores"
          data-testid="generate-paleta"
        >
          <span className="flex flex-col items-center leading-tight">
            <span>{isLoading ? (durationNote(params.renderQuality) ? 'Generando… puede tardar' : 'Generando...') : 'Aplicar paleta'}</span>
            {quote.ok && (
              <span className="text-xs font-mono normal-case tracking-normal opacity-90" data-testid="generate-cost">
                {isAdmin ? `Admin · ${cost} ${cost === 1 ? 'crédito' : 'créditos'} de referencia` : `${cost} ${cost === 1 ? 'crédito' : 'créditos'}`}
              </span>
            )}
          </span>
          {!isLoading && <Wand2 className="ml-3 w-5 h-5" />}
        </Button>
        {!spaceFile || !paletteFile ? (
          <p className="text-xs text-muted-foreground">Faltan {[!spaceFile && 'el espacio', !paletteFile && 'la paleta'].filter(Boolean).join(' y ')}.</p>
        ) : null}
      </div>

      <div id="paleta-result" className="scroll-mt-24">
        <ResultDisplay
          imageUrl={imageUrl}
          isLoading={isLoading}
          onRegenerate={handleGenerate}
          title="Espacio con la nueva paleta"
          subtitle="Misma arquitectura, ambiente y paisajismo; colores de tu paleta"
          houseName="Paleta de colores"
          mode="paleta"
        />
        {variants.length > 1 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2" data-testid="variants-strip">
            {variants.map((url, i) => (
              <button key={i} type="button" onClick={() => setImageUrl(url)} className="shrink-0 w-32 aspect-video border border-border overflow-hidden" aria-label={`Variante ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Variante ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
