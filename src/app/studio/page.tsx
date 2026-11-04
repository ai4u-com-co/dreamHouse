'use client';

import React, { useState } from 'react';
import Header from '@/components/Header';
import ReferenceUploader from '@/components/ReferenceUploader';
import LotUploader from '@/components/LotUploader';
import FloorPlanUploader from '@/components/FloorPlanUploader';
import ExteriorForm from '@/modules/exterior/components/ExteriorForm';
import InteriorForm from '@/modules/interior/components/InteriorForm';
import EditForm from '@/modules/edit/components/EditForm';
import VistasForm from '@/modules/vistas/components/VistasForm';
import ResultDisplay from '@/components/ResultDisplay';
import PromptPreview, { type LoadedFile } from '@/components/PromptPreview';
import { DreamHouseParams, DEFAULT_PARAMS } from '@/types';
import { Wand2, AlertCircle, RotateCcw, Dices, CheckCircle2, Home, Armchair, Maximize2, Camera, PenLine, Wand, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/ui/Section';
import * as SC from '@/modules/shared/constants';
import * as EC from '@/modules/exterior/constants';
import * as IC from '@/modules/interior/constants';
import clsx from 'clsx';
import { useHistory } from '@/lib/hooks/useHistory';
import HistoryGallery from '@/components/HistoryGallery';
import { GenerationRecord } from '@/lib/db';
import { LightboxProvider } from '@/context/LightboxContext';
import MemoryGuard from '@/components/MemoryGuard';
import type { EditMaskPayload } from '@/components/SketchCanvas';
import { readImageMetadataFromFile } from '@/lib/image-metadata';
import { sanitizeAssistantParams, sanitizeSourceParams, cleanLabel } from '@/lib/assistant-params';
import type { DreamHouseImageMetadata } from '@/lib/image-metadata';
import { useAuth } from '@/context/AuthContext';
import { ApiError, callApi } from '@/lib/api-client';
import AuthGate from '@/components/AuthGate';

/** Respuesta de /api/generate (el saldo `remaining` lo publica callApi en el encabezado). */
interface GenerateResponse {
  imageUrl: string;
  houseName: string;
}

// Errores que no se arreglan reintentando la siguiente vista: no tiene sentido seguir llamando al servidor.
const STOP_CODES = new Set(['INSUFFICIENT_CREDITS', 'UNAUTHENTICATED', 'NO_ACCESS']);

export default function StudioPage() {
  return (
    <AuthGate>
      <LightboxProvider>
        <StudioContent />
        <MemoryGuard />
      </LightboxProvider>
    </AuthGate>
  );
}

function StudioContent() {
  const [files, setFiles] = useState<File[]>([]);
  const [lotFile, setLotFile] = useState<File | null>(null);
  const [exteriorReferenceFile, setExteriorReferenceFile] = useState<File | null>(null);
  const [floorPlanFile, setFloorPlanFile] = useState<File | null>(null);
  const [editCompositeFile, setEditCompositeFile] = useState<File | null>(null);
  const [editMask, setEditMask] = useState<EditMaskPayload | null>(null);
  const [objectFiles, setObjectFiles] = useState<File[]>([]);
  const [params, setParams] = useState<DreamHouseParams>(DEFAULT_PARAMS);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [houseName, setHouseName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [vistasResults, setVistasResults] = useState<{ type: string, url: string | null, loading: boolean }[]>([]);
  const [activeVistaIndex, setActiveVistaIndex] = useState(0);

  // El historial es de CADA cuenta: se ata al usuario activo
  const { userId } = useAuth();
  const { history, saveToHistory, deleteFromHistory, clearHistory, isLoading: isHistoryLoading } = useHistory(userId);




  // Accordion state - 'mode' open by default to guide new users
  const [activeSection, setActiveSection] = useState<string | null>('mode');

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleSection = (id: string) => {
    setActiveSection(prev => prev === id ? null : id);
  };

  // El mismo archivo "principal" (lotFile) significa cosas distintas en cada módulo
  const MODE_NAMES: Record<DreamHouseParams['mode'], string> = {
    exterior: 'Arquitectura Exterior', interior: 'Diseño Interior', edit: 'Edición', vistas: 'Vistas',
  };
  const LOT_ROLE: Record<DreamHouseParams['mode'], string> = {
    exterior: 'la foto del terreno', interior: 'la foto del espacio actual', vistas: 'la casa a fotografiar', edit: 'la imagen base a editar',
  };
  const FIRST_SECTION: Record<DreamHouseParams['mode'], string> = {
    exterior: 'concept', interior: 'context', vistas: 'context', edit: 'sketch',
  };

  /** Cambia de módulo: abre su primera sección y avisa qué se conserva y con qué rol */
  const switchMode = (mode: DreamHouseParams['mode']) => {
    if (mode === params.mode) return;
    setParams(prev => ({ ...prev, mode }));
    setActiveSection(FIRST_SECTION[mode]);
    // Un solo estado para todos los módulos: lo compartido se conserva y lo exclusivo queda guardado por si se vuelve
    const shared = mode === 'exterior' || mode === 'interior'
      ? 'Se conservan tu esencia (tipo, mood, estilo, arquitecto), el sitio y la luz: lo que cambies aquí también cambia en el otro módulo.'
      : '';
    const photo = lotFile ? `La foto cargada se usará como ${LOT_ROLE[mode]}.` : '';
    const message = [shared, photo].filter(Boolean).join(' ');
    if (message) showToast(message);
  };

  /** Metadatos de una imagen -> render de origen. Vienen de un archivo, así que se validan y se acotan. */
  const toSourceRender = (meta: DreamHouseImageMetadata | null): DreamHouseParams['sourceRender'] => {
    if (!meta) return undefined;
    const safeParams = sanitizeSourceParams(meta.params);
    if (Object.keys(safeParams).length === 0) return undefined;
    return {
      id: cleanLabel(meta.id, 64) ?? 'desconocido',
      mode: meta.mode,
      houseName: cleanLabel(meta.houseName),
      model: cleanLabel(meta.model, 60),
      params: safeParams,
    };
  };

  /** Si la imagen subida fue generada por DreamHouse, recupera los parámetros con los que se creó */
  const applySourceRender = async (file: File | null) => {
    if (!file) {
      setParams(prev => (prev.sourceRender ? { ...prev, sourceRender: undefined } : prev));
      return;
    }
    const meta = await readImageMetadataFromFile(file);
    const source = toSourceRender(meta);
    setParams(prev => ({ ...prev, sourceRender: source }));
    if (source) showToast(`Detectamos los parámetros de "${source.houseName || 'tu render'}": se usarán para mantener la fidelidad.`);
  };

  // Los metadatos se leen del archivo ORIGINAL (onOriginalSelected): el que llega aquí ya fue
  // recomprimido en un canvas y no los conserva.
  const handleLotFileChange = (file: File | null) => {
    setLotFile(file);
    if (!file) void applySourceRender(null);
  };

  /** En edición, al cambiar o quitar la base se descarta el boceto y la máscara de la imagen anterior */
  const handleEditBaseChange = (file: File | null) => {
    setLotFile(file);
    setEditCompositeFile(null);
    setEditMask(null);
    if (!file) void applySourceRender(null);
  };

  /** Convierte el render mostrado en la imagen base de otro módulo (sus parámetros viajan en el archivo) */
  const handleUseResultAsBase = async (target: 'vistas' | 'edit') => {
    const url = params.mode === 'vistas' ? (vistasResults[activeVistaIndex]?.url ?? imageUrl) : imageUrl;
    if (!url) return;
    try {
      const blob = await (await fetch(url)).blob();
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const file = new File([blob], `${(houseName || 'render').replace(/\s+/g, '-')}.${ext}`, { type: blob.type });
      setLotFile(file);
      setEditCompositeFile(null);
      setEditMask(null);
      const source = toSourceRender(await readImageMetadataFromFile(file));
      setParams(prev => ({ ...prev, mode: target, sourceRender: source }));
      setActiveSection(FIRST_SECTION[target]);
      showToast(source
        ? `Render cargado como base de ${MODE_NAMES[target]} con sus parámetros originales.`
        : `Render cargado como base de ${MODE_NAMES[target]}.`);
      setTimeout(() => document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    } catch (err) {
      console.error('No se pudo usar el render como base:', err);
      setError('No se pudo cargar el render como imagen base. Descárgalo y súbelo manualmente.');
    }
  };

  /** Archivos cargados y si el módulo actual los usa (para el resumen) */
  const buildLoadedFiles = (): LoadedFile[] => {
    const m = params.mode;
    const list: LoadedFile[] = [];
    if (lotFile) {
      list.push({ label: m === 'exterior' ? 'TERRENO' : m === 'interior' ? 'ESPACIO' : m === 'vistas' ? 'CASA' : 'BASE', name: lotFile.name, used: true });
    }
    if (exteriorReferenceFile) list.push({ label: 'CASA ACT.', name: exteriorReferenceFile.name, used: m === 'exterior' });
    if (floorPlanFile) list.push({ label: 'PLANO', name: floorPlanFile.name, used: m === 'exterior' || m === 'interior' });
    if (files.length) list.push({ label: 'REFERENC.', name: `${files.length} imagen${files.length > 1 ? 'es' : ''}`, used: m === 'exterior' || m === 'interior' });
    if (objectFiles.length) list.push({ label: 'OBJETOS', name: `${objectFiles.length} pieza${objectFiles.length > 1 ? 's' : ''}`, used: m === 'interior' });
    if (m === 'edit' && editMask) list.push({ label: 'MÁSCARA', name: 'zona pintada', used: true });
    return list;
  };

  const handleReset = () => {
    setParams({
      ...DEFAULT_PARAMS,
      city: "",
      technicalNotes: "",
      artDirection: "",
      negativePrompt: "",
      editPrompt: "",
      mode: params.mode // Keep current mode on reset
    });
    setFiles([]);
    setLotFile(null);
    setExteriorReferenceFile(null);
    setFloorPlanFile(null);
    setEditCompositeFile(null);
    setEditMask(null);
    setObjectFiles([]);
    setHouseName(null);
    setImageUrl(null);
    setError(null);
    setVistasResults([]);
    showToast("Parameters reset to default");
  };

  const handleRandomize = () => {
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const pickMulti = (arr: string[], maxRandom: number = 3): string[] => {
      const count = Math.floor(Math.random() * maxRandom) + 1;
      const shuffled = [...arr].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    };

    const isExt = params.mode === 'exterior';
    const isInt = params.mode === 'interior';
    const isExtOrInt = isExt || isInt; // esencia y sitio se comparten entre exterior e interior (ver PARAM_MODES)
    const randomProjectType = pick(EC.PROJECT_TYPES);
    // Metros cuadrados coherentes con el tipo: una tiny house no puede ser una mansión
    const randomSize = randomProjectType === 'Tiny house' ? '35' : String(60 + Math.floor(Math.random() * 740));

    const randomParams: DreamHouseParams = {
      ...params,
      // Shared
      architecturalStyles: pickMulti(SC.STYLES, 3),
      architect: pickMulti(SC.ARCHITECTS, 2),
      mood: pick(SC.MOODS),
      cameraAngle: pick(SC.ANGLES),
      composition: pick(SC.COMPOSITIONS),
      timeOfDay: pick(SC.TIMES_OF_DAY),
      season: pick(SC.SEASONS),
      lighting: pick(SC.LIGHTING_TYPES),
      humanContext: pick(SC.HUMAN_CONTEXT),
      renderStyle: pick(SC.RENDER_STYLES),

      // Exterior
      projectType: isExtOrInt ? randomProjectType : params.projectType,
      city: params.city,
      climate: isExtOrInt ? pick(EC.CLIMATES) : params.climate,
      environment: isExtOrInt ? pick(EC.ENVIRONMENTS) : params.environment,
      waterBody: isExtOrInt ? pick(EC.WATER_BODIES) : params.waterBody,
      weatherCondition: isExtOrInt ? pick(EC.WEATHER_CONDITIONS) : params.weatherCondition,
      size: isExt ? randomSize : params.size,
      levels: isExt ? Math.floor(Math.random() * 5) + 1 : params.levels,
      roofType: isExt ? pick(EC.ROOF_TYPES) : params.roofType,
      layoutType: isExt ? pick(EC.LAYOUT_TYPES) : params.layoutType,
      parkingSpots: isExt ? Math.floor(Math.random() * 3) : params.parkingSpots,
      parkingType: isExt ? pick(EC.PARKING_TYPES) : params.parkingType,
      socialAreas: isExt ? pickMulti(EC.SOCIAL_AREAS, 2) : params.socialAreas,
      exteriorElements: isExt ? pickMulti(EC.EXTERIOR_ELEMENTS, 4) : params.exteriorElements,
      vegetation: isExt ? pickMulti(EC.VEGETATION, 3) : params.vegetation,
      architecturalDetails: isExt ? pickMulti(EC.ARCHITECTURAL_DETAILS, 2) : params.architecturalDetails,

      // Interior
      roomType: isInt ? pick(IC.ROOM_TYPES) : params.roomType,
      furnitureStyle: isInt ? pickMulti(IC.FURNITURE_STYLES, 2) : params.furnitureStyle,
      interiorLighting: isInt ? pickMulti(IC.INTERIOR_LIGHTING_TYPES, 2) : params.interiorLighting,
      flooringMaterial: isInt ? pick(IC.FLOORING_MATERIALS) : params.flooringMaterial,
      ceilingDetail: isInt ? pick(IC.CEILING_DETAILS) : params.ceilingDetail,
      bedrooms: isExtOrInt ? Math.floor(Math.random() * 4) + 1 : params.bedrooms,
      bathrooms: isExtOrInt ? Math.floor(Math.random() * 3) + 1 : params.bathrooms,
      kitchenType: isInt ? pick(IC.KITCHEN_TYPES) : params.kitchenType,
      livingAreaType: isInt ? pick(IC.LIVING_AREA_TYPES) : params.livingAreaType,
      
      // Edición: no se toca lo que el usuario escribió
      editPrompt: params.editPrompt,
    };

    setParams(randomParams);
    showToast(`Se ha generado un diseño ${params.mode} aleatorio.`);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    setImageUrl(null);
    setHouseName(null);

    const isVistasMode = params.mode === 'vistas';

    try {
      if (params.mode === 'edit') {
        if (!lotFile) throw new Error('Sube la imagen que quieres editar.');
        if (!params.editPrompt.trim()) throw new Error('Describe qué quieres cambiar en la imagen.');
      }
      if (params.mode === 'vistas' && !lotFile) {
        throw new Error('Sube la foto de la casa para generar sus vistas.');
      }

      if (isVistasMode) {
        if (params.selectedVistas.length === 0) {
          throw new Error('Por favor, selecciona al menos una vista para generar.');
        }
        
        // Initialize results with loading state
        const initialResults = params.selectedVistas.map(v => ({ type: v, url: null, loading: true }));
        setVistasResults(initialResults);
        
        // Generate one by one
        let okCount = 0;
        let failCount = 0;
        let lastVistaError = '';
        for (let i = 0; i < params.selectedVistas.length; i++) {
          const viewType = params.selectedVistas[i];
          setActiveVistaIndex(i);
          
          try {
            const formData = new FormData();
            files.forEach((file) => formData.append('files', file));
            if (lotFile) formData.append('lotImage', lotFile);
            if (exteriorReferenceFile) formData.append('exteriorReferenceImage', exteriorReferenceFile);
            if (floorPlanFile) formData.append('floorPlanImage', floorPlanFile);
            
            // Add viewType to params for the API
            const currentParams = { ...params, viewType, hasExteriorReference: !!exteriorReferenceFile };
            formData.append('params', JSON.stringify(currentParams));

            // Con la sesión de Google (el servidor cobra los créditos); `ownerId` = la cuenta que pidió esta vista
            const { data, ownerId } = await callApi<GenerateResponse>('/api/generate', formData);
            okCount++;
            
            // Update individual result
            setVistasResults(prev => prev.map((v, idx) => 
              idx === i ? { ...v, url: data.imageUrl, loading: false } : v
            ));
            
            // Also set as main image for the preview
            setImageUrl(data.imageUrl);
            setHouseName(data.houseName);

            // Save to history
            await saveToHistory({
              mode: 'vistas',
              params: currentParams,
              imageUrl: data.imageUrl,
              houseName: data.houseName
            }, ownerId);

          } catch (err) {
            console.error(`Error generating vista ${viewType}:`, err);
            failCount++;
            lastVistaError = err instanceof Error ? err.message : String(err);
            if (err instanceof ApiError && STOP_CODES.has(err.code)) {
              // Sin saldo o sin sesión: las vistas que faltan fallarían igual. Se corta aquí (y no se cobra nada más).
              setVistasResults(prev => prev.map(v => ({ ...v, loading: false })));
              break;
            }
            setVistasResults(prev => prev.map((v, idx) =>
              idx === i ? { ...v, loading: false } : v
            ));
          }
        }
        
        if (okCount === 0) {
          throw new Error(lastVistaError || 'No se pudo generar ninguna vista. Revisa la imagen e inténtalo de nuevo.');
        }
        showToast(failCount > 0
          ? `Portafolio parcial: ${okCount} de ${okCount + failCount} vistas (${failCount} fallaron: ${lastVistaError}).`
          : 'Portafolio generado con éxito');
      } else {
        const formData = new FormData();
        files.forEach((file) => {
          formData.append('files', file);
        });
        if (lotFile) {
          formData.append('lotImage', lotFile);
        }
        if (exteriorReferenceFile) {
          formData.append('exteriorReferenceImage', exteriorReferenceFile);
        }
        if (floorPlanFile) {
          formData.append('floorPlanImage', floorPlanFile);
        }
        if (params.mode === 'edit' && editCompositeFile) {
          formData.append('editCompositeFile', editCompositeFile);
          if (editMask) {
            // Base limpia + máscara: el servidor las usa solo con OpenAI (inpainting por zona)
            formData.append('editBaseFile', editMask.base);
            formData.append('editMaskFile', editMask.mask);
          }
        }
        if (params.mode === 'interior') {
          objectFiles.forEach((file) => formData.append('objectImages', file));
        }
        
        const finalParams = { ...params, hasExteriorReference: !!exteriorReferenceFile };
        formData.append('params', JSON.stringify(finalParams));

        // Con la sesión de Google (el servidor cobra los créditos); `ownerId` = la cuenta que pidió este render
        const { data, ownerId } = await callApi<GenerateResponse>('/api/generate', formData);
        setImageUrl(data.imageUrl);
        setHouseName(data.houseName);
        
        // Save to local history
        try {
          await saveToHistory({
            mode: params.mode as 'exterior' | 'interior' | 'edit' | 'vistas',
            params: params,
            imageUrl: data.imageUrl,
            houseName: data.houseName
          }, ownerId);
        } catch (historyErr) {
          console.error("Failed to save to history:", historyErr);
        }

        showToast("Render generated successfully!");
      }

      setTimeout(() => {
        document.getElementById('result')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Ocurrió un error inesperado.');
      }
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadHistory = (record: GenerationRecord) => {
    // Se mezcla con los valores por defecto: un registro anterior a un campo nuevo no deja undefined
    setParams({ ...DEFAULT_PARAMS, ...record.params });
    setActiveSection(FIRST_SECTION[record.mode] ?? 'mode');
    setVistasResults([]);
    setImageUrl(record.imageUrl);
    setHouseName(record.houseName || null);
    // Reset files since we don't store them in history (only the params)
    setFiles([]);
    setLotFile(null);
    setExteriorReferenceFile(null);
    setFloorPlanFile(null);
    setEditCompositeFile(null);
    setEditMask(null);
    setObjectFiles([]);
    
    showToast(`Cargado diseño ${record.mode} de ${new Date(record.timestamp).toLocaleDateString()}. Los archivos subidos no se guardan en el historial: vuelve a cargarlos si quieres regenerar.`);
    
    setTimeout(() => {
      document.getElementById('studio')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };


  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-300">
      <Header />

      <main id="studio" className="relative px-6 sm:px-8 lg:px-12 pb-32 bg-background">
        {/* Main Form Area */}
        <div id="form" className="max-w-[1400px] mx-auto pt-32 space-y-12">
            <div className="flex flex-col gap-4 mb-12">
                <h2 className="text-sm font-mono text-primary uppercase tracking-[0.4em] font-bold">El Estudio</h2>
                <h3 className="text-4xl md:text-6xl font-black uppercase tracking-tighter">Diseña tu <span className="text-outline">Propia</span> Obra Maestra.</h3>
            </div>

            {/* Asistente IA NLP Panel */}
            {params.mode !== 'edit' && params.mode !== 'vistas' && (
              <AIAssistantPanel
                mode={params.mode}
                onParseSuccess={(parsedData) => {
                  const { params: safe, dropped } = sanitizeAssistantParams(parsedData);
                  setParams(prev => ({ ...prev, ...safe }));
                  if (dropped.length) showToast(`El asistente propuso ${dropped.length} valor(es) que el formulario no ofrece; se ignoraron.`);
                  if (params.mode === 'exterior') {
                    setActiveSection('concept');
                  } else if (params.mode === 'interior') {
                    setActiveSection('identity');
                  }
                }}
                onError={setError}
                onToast={showToast}
              />
            )}
           {/* Global Actions - Reset & Randomize */}
           <div className="flex justify-end gap-3 sticky top-20 z-20 pointer-events-none mb-8">
            <div className="pointer-events-auto flex gap-0 border border-border bg-background shadow-lg">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isLoading}
                  className="group flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider text-muted-foreground bg-transparent hover:bg-foreground hover:text-background transition-colors"
                  aria-label="Restablecer todos los parámetros a sus valores predeterminados"
                  title="Restablecer formulario"
                >
                  <RotateCcw className="w-4 h-4 group-hover:-rotate-180 transition-transform duration-500" aria-hidden="true" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
                <div className="w-px bg-border" aria-hidden="true" />
                <button
                  type="button"
                  onClick={handleRandomize}
                  disabled={isLoading}
                  className="group flex items-center gap-2 px-6 py-3 text-sm font-bold uppercase tracking-wider text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
                  aria-label="Generar una combinación aleatoria de parámetros para inspiración"
                  title="Generar diseño aleatorio"
                >
                  <Dices className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" aria-hidden="true" />
                  <span>Surprise Me</span>
                </button>
            </div>
          </div>

          {/* Toast Notification */}
          {toastMessage && (
            <div className="fixed top-24 right-6 z-50 animate-fade-in-up">
              <div className="bg-foreground text-background px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-sm font-bold uppercase tracking-wide">{toastMessage}</span>
              </div>
            </div>
          )}

          {/* 01: Módulo de Trabajo (Selector) */}
          <Section
            title="Módulo de Trabajo"
            number="01"
            icon={<PenLine className="w-5 h-5" />}
            badge="MODO"
            isOpen={activeSection === 'mode'}
            onToggle={() => toggleSection('mode')}
            summary={
              params.mode === 'exterior' ? "Arquitectura Exterior" :
              params.mode === 'interior' ? "Diseño Interior" :
              params.mode === 'edit' ? "Editar Imagen con IA" :
              "Portafolio de Vistas"
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => switchMode('exterior')}
                className={clsx(
                  "flex flex-col items-center gap-3 p-6 border transition-all",
                  params.mode === "exterior" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                )}
              >
                <Home className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-widest">Arquitectura Exterior</span>
              </button>
              <button
                onClick={() => switchMode('interior')}
                className={clsx(
                  "flex flex-col items-center gap-3 p-6 border transition-all",
                  params.mode === "interior" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                )}
              >
                <Armchair className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-widest">Diseño Interior</span>
              </button>
              <button
                onClick={() => switchMode('edit')}
                className={clsx(
                  "flex flex-col items-center gap-3 p-6 border transition-all col-span-2 sm:col-span-1",
                  params.mode === "edit" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                )}
              >
                <Wand className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-widest">Editar Imagen con IA</span>
              </button>
              <button
                onClick={() => switchMode('vistas')}
                className={clsx(
                  "flex flex-col items-center gap-3 p-6 border transition-all col-span-2 sm:col-span-1",
                  params.mode === "vistas" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"
                )}
              >
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs font-bold uppercase tracking-widest">Portafolio de Vistas</span>
              </button>
            </div>
          </Section>

          {/* 02: Referencias Visuales (Shared) */}
          {params.mode !== 'edit' && params.mode !== 'vistas' && params.mode !== 'exterior' && (
          <Section
            title="Referencias Visuales"
            number="02"
            icon={<Maximize2 className="w-5 h-5" />}
            badge="INSPIRACIÓN"
            isOpen={activeSection === 'references'}
            onToggle={() => toggleSection('references')}
          >
            <ReferenceUploader files={files} onFilesChange={setFiles} />
          </Section>
          )}

          {/* 03: Contexto (Mode-specific: Lote vs Espacio vs Base) */}
          {params.mode !== 'edit' && params.mode !== 'exterior' && (
          <Section
            title={
                params.mode === 'interior' ? "Foto del Espacio Actual" : 
                "Imagen Base de la Casa"
            }
            number="03"
            icon={<Camera className="w-5 h-5" />}
            badge="BASE"
            isOpen={activeSection === 'context'}
            onToggle={() => toggleSection('context')}
          >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <LotUploader 
              file={lotFile} 
              onFileChange={handleLotFileChange}
              onOriginalSelected={(original) => void applySourceRender(original)} 
              title={
                  params.mode === 'interior' ? "Espacio Principal (Foto Actual)" :
                  "Cargar Foto de la Casa"
              }
              description={
                  params.mode === 'interior' ? "Sube una foto de tu espacio actual. La IA lo usará como base para el rediseño." :
                  "Sube la foto principal de la casa. Generaremos el portafolio de vistas basado en este diseño."
              }
              icon={params.mode === 'vistas' ? <ImageIcon className="w-5 h-5 text-primary" /> : params.mode === 'interior' ? <Armchair className="w-5 h-5 text-primary" /> : undefined}
            />
            {params.sourceRender && (params.mode === 'vistas' || params.mode === 'interior') && (
              <div className="md:col-span-2 border border-primary/40 bg-primary/5 p-4 text-sm" role="status">
                <p className="font-bold uppercase tracking-wider text-xs text-primary mb-1">Render DreamHouse detectado</p>
                <p className="text-muted-foreground">
                  {params.sourceRender.houseName ? `“${params.sourceRender.houseName}”` : 'Esta imagen'} trae los parámetros con los que se generó
                  {params.sourceRender.model ? ` (${params.sourceRender.model})` : ''}. Lo que no elijas de nuevo se hereda de ahí para que las vistas
                  mantengan el mismo diseño.
                </p>
              </div>
            )}
          </div>
          </Section>
          )}

          {/* 04: Estructura (Mode-specific: Plano vs Layout) */}
          {params.mode !== 'edit' && params.mode !== 'vistas' && params.mode !== 'exterior' && (
          <Section
            title="Distribución / Layout"
            number="04"
            icon={<Maximize2 className="w-5 h-5" />}
            badge="GUÍA"
            isOpen={activeSection === 'structure'}
            onToggle={() => toggleSection('structure')}
          >
            <FloorPlanUploader 
              file={floorPlanFile} 
              onFileChange={setFloorPlanFile} 
              title="Layout del Área"
              description="Sube un croquis o plano de la estancia. La IA respetará la zonificación."
            />
          </Section>
          )}

          {/* Dinamically Rendered Module Form */}
          {params.mode === 'exterior' ? (
            <ExteriorForm
              params={params}
              onChange={setParams}
              disabled={isLoading}
              activeSection={activeSection}
              onSectionChange={toggleSection}
              files={files}
              onFilesChange={setFiles}
              lotFile={lotFile}
              onLotFileChange={handleLotFileChange}
              exteriorReferenceFile={exteriorReferenceFile}
              onExteriorReferenceFileChange={setExteriorReferenceFile}
              floorPlanFile={floorPlanFile}
              onFloorPlanFileChange={setFloorPlanFile}
            />
          ) : params.mode === 'interior' ? (
            <InteriorForm
              params={params}
              onChange={setParams}
              disabled={isLoading}
              activeSection={activeSection}
              onSectionChange={toggleSection}
              objectFiles={objectFiles}
              onObjectFilesChange={setObjectFiles}
            />
          ) : params.mode === 'edit' ? (
            <EditForm
              params={params}
              onChange={setParams}
              disabled={isLoading}
              activeSection={activeSection}
              onSectionChange={toggleSection}
              baseImage={lotFile}
              onBaseImageUpdate={handleEditBaseChange}
              onBaseOriginalSelected={(original) => void applySourceRender(original)}
              onCompositeImageUpdate={setEditCompositeFile}
              onMaskUpdate={setEditMask}
            />
          ) : (
            <VistasForm
              params={params}
              onChange={setParams}
              disabled={isLoading}
              activeSection={activeSection}
              onSectionChange={toggleSection}
            />
          )}

          {/* Error Message */}
          {error && (
            <div className="p-6 bg-destructive text-destructive-foreground flex items-center gap-4">
              <AlertCircle className="w-6 h-6" />
              <div>
                <p className="font-bold uppercase">Generation Error</p>
                <p className="opacity-90">{error}</p>
              </div>
            </div>
          )}

          {/* Floating Generate Button */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
            <Button
              onClick={handleGenerate}
              isLoading={isLoading}
              size="lg"
              className="rounded-full shadow-2xl hover:shadow-primary/40 active:scale-95 transition-all text-base font-bold uppercase tracking-widest px-10 py-8 bg-primary text-primary-foreground border-4 border-background focus:ring-4 focus:ring-primary/30 outline-none"
              aria-label={`Generate ${params.mode} render`}
            >
              {isLoading ? 'Generating...' : `Generate ${params.mode}`}
              {!isLoading && <Wand2 className="ml-3 w-5 h-5" />}
            </Button>
          </div>

          {/* Result Section with Prompt Preview */}
          <div id="result" className="scroll-mt-24 pb-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Prompt DNA (Tags) */}
              <div className="lg:col-span-3 lg:order-1 order-2">
                <div className="bg-card border border-border rounded-xl p-4 h-full max-h-[600px] overflow-hidden sticky top-24">
                  <PromptPreview params={params} loadedFiles={buildLoadedFiles()} />
                </div>
              </div>

              {/* Right Column: Result Image */}
              <div className="lg:col-span-9 lg:order-2 order-1">
                <ResultDisplay
                  imageUrl={imageUrl}
                  isLoading={isLoading}
                  onRegenerate={handleGenerate}
                  title={houseName || (params.mode === 'vistas' ? "Portafolio de Vistas" : `Final ${params.mode}`)}
                  subtitle={params.mode === 'vistas' ? "Set de visualizaciones arquitectónicas" : `Photorealistic ${params.mode} visualization`}
                  vistasImages={params.mode === 'vistas' ? vistasResults : undefined}
                  activeVistaIndex={activeVistaIndex}
                  houseName={houseName}
                  onUseAsBase={handleUseResultAsBase}
                />
              </div>
            </div>
          </div>

          {/* History Section */}
          <div id="history" className="pt-20 border-t border-border/50">
            <HistoryGallery
              history={history}
              isLoading={isHistoryLoading}
              onLoad={handleLoadHistory}
              onDelete={deleteFromHistory}
              onClear={clearHistory}
            />
          </div>

        </div>
      </main>


      {/* Footer */}
      <footer className="border-t border-border py-20 bg-foreground text-background">
        <div className="max-w-[1400px] mx-auto px-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-10">
          <div>
            <h2 className="text-4xl font-bold uppercase tracking-tighter mb-6">DreamHouse AI</h2>
            <div className="flex gap-8 text-sm font-medium uppercase tracking-wide opacity-80">
              <a href="#" className="inline-flex items-center min-h-11 hover:text-primary transition-colors">Terms</a>
              <a href="#" className="inline-flex items-center min-h-11 hover:text-primary transition-colors">Privacy</a>
              <a href="#" className="inline-flex items-center min-h-11 hover:text-primary transition-colors">Contact</a>
            </div>
          </div>
          <div className="text-right">
            <p className="text-primary font-bold mb-2">Architecture Studio</p>
            <p className="text-sm opacity-50 font-mono">© 2025 DreamHouse Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface AIAssistantPanelProps {
  mode: string;
  onParseSuccess: (data: Partial<DreamHouseParams>) => void;
  onError: (msg: string) => void;
  onToast: (msg: string) => void;
}

function AIAssistantPanel({ mode, onParseSuccess, onError, onToast }: AIAssistantPanelProps) {
  const [nlpText, setNlpText] = useState("");
  const [isParsingNlp, setIsParsingNlp] = useState(false);

  const handleParseNlp = async () => {
    if (!nlpText.trim()) return;
    setIsParsingNlp(true);
    onError("");
    try {
      // Con la sesión de Google (el servidor cobra 1 crédito y devuelve el cobro si falla)
      const { data: parsedData } = await callApi<Partial<DreamHouseParams>>(
        '/api/parse-prompt',
        JSON.stringify({ textPrompt: nlpText, mode })
      );
      onParseSuccess(parsedData);
      onToast("¡Parámetros configurados por IA!");
      setNlpText("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ocurrió un error al procesar tu idea.';
      onError(msg);
    } finally {
      setIsParsingNlp(false);
    }
  };

  return (
    <div className="border border-border bg-card p-6 md:p-8 space-y-4">
      <div className="flex items-center gap-2">
        <Wand className="text-primary w-5 h-5 animate-pulse" />
        <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">Asistente IA: Generar desde una Idea</h4>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Escribe tu idea de diseño en lenguaje natural (español o inglés) y la IA configurará automáticamente todas las secciones del Studio.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 items-stretch">
        <input
          type="text"
          value={nlpText}
          onChange={(e) => setNlpText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleParseNlp();
            }
          }}
          placeholder={
            mode === 'exterior' 
              ? "Ej: Una villa de lujo minimalista frente al mar de Tadao Ando con concreto y madera, piscina infinity en atardecer..."
              : "Ej: Una cocina gourmet con isla central y vigas de madera expuestas en el techo, madera clara y mármol..."
          }
          disabled={isParsingNlp}
          className="flex-grow bg-background border border-border px-4 py-3 text-sm focus:ring-1 focus:ring-primary outline-none transition-all"
        />
        <Button
          onClick={handleParseNlp}
          isLoading={isParsingNlp}
          disabled={isParsingNlp}
          className="bg-primary text-primary-foreground font-bold px-6 py-3 text-sm uppercase tracking-wider shrink-0"
        >
          {isParsingNlp ? 'Interpretando...' : 'Interpretar Idea'}
        </Button>
      </div>
      {isParsingNlp && (
        <div className="h-0.5 w-full bg-border overflow-hidden">
          <div className="h-full bg-primary animate-[pulse_1.5s_infinite_ease-in-out]" style={{ width: '100%' }} />
        </div>
      )}
    </div>
  );
}
