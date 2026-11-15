import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import sharp from 'sharp';
import { embedImageMetadata, pickEmbeddableParams, METADATA_APP, METADATA_VERSION, type DreamHouseImageMetadata } from '@/lib/image-metadata';
import { DreamHouseParams } from '@/types';
import { quoteRender } from '@/lib/render-options';
import { FALLBACK_MODEL, creditsFromUsage, mimeFor, promptCostUnits, usageForLog } from '@/lib/openai-image-core.ts';
import { openaiImageFields } from '@/lib/openai-image-server.ts';
import { normalizeRenderSettings } from '@/lib/render-settings';
import { buildFullPalettePrompt } from '@/modules/tools/paleta/lib/prompt-builder';
import { APP_ID, authenticate, charge, chargeFailure, isAdmin, noChargeNote, recordUsage, refund, topUp, type Charge } from '@/lib/billing';

// Tools · Paleta de colores. Mismo cobro y mismas garantías que /api/generate (sesión, cobro atómico, reembolso si falla).
export const maxDuration = 300;

const MAX_IMAGE_SIZE = 100 * 1024 * 1024;

function validateImage(file: File | null, label: string): string | null {
  if (!file || file.size === 0) return `Falta la imagen: ${label}.`;
  if (!file.type.startsWith('image/')) return `${label} debe ser una imagen. Recibido: ${file.type || 'desconocido'}`;
  if (file.size > MAX_IMAGE_SIZE) return `${label} supera el máximo de ${MAX_IMAGE_SIZE / 1024 / 1024} MB.`;
  return null;
}

// Píxeles reales de la imagen (solo cabecera): el costo depende de ellos y el servidor no confía en el navegador.
async function imagePixels(file: File): Promise<number | undefined> {
  try {
    const meta = await sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: false }).metadata();
    return meta.width && meta.height ? meta.width * meta.height : undefined;
  } catch {
    return undefined;
  }
}

function embedMetadataInDataUrl(dataUrl: string, meta: DreamHouseImageMetadata): string {
  const match = /^data:(image\/[a-z]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match) return dataUrl;
  const embedded = embedImageMetadata(new Uint8Array(Buffer.from(match[2], 'base64')), meta);
  return `data:${match[1]};base64,${Buffer.from(embedded).toString('base64')}`;
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHENTICATED', message: 'Inicia sesión para generar renders.' }, { status: 401 });
  }
  let charged: Extract<Charge, { ok: true }> | null = null;
  let delivered = false;
  try {
    const formData = await req.formData();
    const paramsJson = formData.get('params');
    if (typeof paramsJson !== 'string' || !paramsJson) {
      return NextResponse.json({ message: 'Faltan los parámetros.' }, { status: 400 });
    }
    const rawParams: unknown = JSON.parse(paramsJson);
    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) {
      return NextResponse.json({ message: 'Parámetros inválidos.' }, { status: 400 });
    }
    // Este endpoint solo hace paleta: el modo no lo decide el cliente
    const params = normalizeRenderSettings({ ...(rawParams as DreamHouseParams), mode: 'paleta' });

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ code: 'SERVER_MISCONFIGURED', message: 'El servicio de imágenes no está configurado todavía.' }, { status: 500 });
    }
    const openaiClient = new OpenAI({ apiKey: openaiApiKey });

    const spaceImage = formData.get('spaceImage') as File | null;
    const paletteImage = formData.get('paletteImage') as File | null;
    const spaceError = validateImage(spaceImage, 'La imagen del espacio');
    if (spaceError) return NextResponse.json({ message: spaceError }, { status: 400 });
    const paletteError = validateImage(paletteImage, 'La imagen de la paleta de colores');
    if (paletteError) return NextResponse.json({ message: paletteError }, { status: 400 });
    const imageFiles = [spaceImage as File, paletteImage as File];

    const fullPrompt = buildFullPalettePrompt(params);

    const inputImagePixels: number[] = [];
    for (const file of imageFiles) {
      const px = await imagePixels(file);
      if (!px) return NextResponse.json({ code: 'BAD_OPTIONS', option: 'bad_input_image', message: 'No se pudo leer una de las imágenes. Súbela de nuevo (JPG, PNG o WebP).' }, { status: 400 });
      inputImagePixels.push(px);
    }
    const wantsAdminOption = (rawParams as Record<string, unknown>).renderModeration === 'low';
    const callerIsAdmin = wantsAdminOption ? await isAdmin(auth.sb, auth.userId) : false;
    const quote = quoteRender({ ...(rawParams as Record<string, unknown>), mode: 'paleta' }, { inputImagePixels, isAdmin: callerIsAdmin, promptChars: promptCostUnits(fullPrompt) });
    if (!quote.ok) {
      if (quote.code === 'forbidden_moderation') {
        return NextResponse.json({ code: 'ADMIN_ONLY', message: quote.message }, { status: 403 });
      }
      return NextResponse.json({ code: 'BAD_OPTIONS', option: quote.code, message: quote.message }, { status: 400 });
    }
    const v = quote.value.options;
    const apiSize = quote.value.apiSize;

    const c = await charge(auth.sb, v.credits, 'render', {
      mode: 'paleta', model: v.modelId, quality: v.quality, size: apiSize, n: v.n, format: v.format, background: v.background, inputs: imageFiles.length, chars: promptCostUnits(fullPrompt),
    });
    if (!c.ok) {
      const failure = chargeFailure(c);
      return NextResponse.json(failure.body, { status: failure.status });
    }
    charged = c;

    type ImageResult = { data?: Array<{ b64_json?: string; url?: string }>; usage?: unknown };
    const callOpenAI = async (modelId: string): Promise<ImageResult> => {
      const fields = openaiImageFields({ ...v, size: apiSize }, { appId: APP_ID, userId: auth.userId }, modelId);
      return await openaiClient.images.edit({
        ...fields,
        image: imageFiles,
        prompt: fullPrompt,
      } as unknown as Parameters<typeof openaiClient.images.edit>[0]) as unknown as ImageResult;
    };

    let usedModel: string = v.modelId;
    let result: ImageResult;
    try {
      result = await callOpenAI(v.modelId);
    } catch (err) {
      const e = err as { status?: number; code?: string | null };
      if (e?.status === 404 || e?.code === 'model_not_found') {
        usedModel = FALLBACK_MODEL;
        result = await callOpenAI(FALLBACK_MODEL);
      } else {
        throw err;
      }
    }

    const mime = mimeFor(v.format);
    const imageUrls: string[] = [];
    for (const item of result?.data ?? []) {
      if (item?.b64_json) imageUrls.push(`data:${mime};base64,${item.b64_json}`);
      else if (item?.url) imageUrls.push(item.url);
    }
    if (imageUrls.length === 0) throw new Error('No image data or URL returned from OpenAI');
    await recordUsage(auth.sb, c.logId, c.refundToken, usageForLog(result?.usage, { model: usedModel, quality: v.quality, size: apiSize, n: v.n }));

    const houseName = 'Paleta de colores';
    const metadataIds: string[] = [];
    const images = imageUrls.map((url) => {
      const metadataId = crypto.randomUUID();
      metadataIds.push(metadataId);
      if (params.embedMetadata === false) return url;
      return embedMetadataInDataUrl(url, {
        app: METADATA_APP,
        version: METADATA_VERSION,
        id: metadataId,
        createdAt: new Date().toISOString(),
        mode: 'paleta',
        model: usedModel,
        quality: v.quality,
        size: apiSize,
        houseName,
        params: pickEmbeddableParams(params, !!params.embedDetails),
        prompt: params.embedDetails ? fullPrompt : undefined,
      });
    });

    delivered = true;
    const settled = await topUp(auth.sb, c, creditsFromUsage(result?.usage));
    return NextResponse.json({
      imageUrl: images[0],
      image: images[0],
      images,
      houseName,
      metadataId: metadataIds[0],
      metadataIds,
      remaining: settled.remaining,
      model: usedModel,
      options: { size: apiSize, quality: v.quality, format: v.format, n: v.n, background: v.background, model: v.model },
      usage: usageForLog(result?.usage),
    });
  } catch (error: unknown) {
    console.error('API Error (tools/paleta):', error);

    let remaining: number | undefined;
    let refunded = true;
    if (charged && !delivered) {
      const r = await refund(auth.sb, charged);
      remaining = r.remaining;
      refunded = r.refunded;
    }
    const note = charged ? noChargeNote(refunded) : '';

    let errorMessage = 'Ocurrió un error inesperado al generar la imagen.';
    let statusCode = 500;
    let errorCode = 'UNKNOWN_ERROR';

    if (error instanceof Error) {
      const sdkError = error as { status?: number; code?: string | number | null };
      const text = error.message;
      if (text.includes('Deadline expired') || text.includes('timeout') || text.includes('TIMEOUT') || text.includes('Timed out')) {
        errorMessage = 'El tiempo de espera expiró: la generación tardó más de lo esperado.';
        statusCode = 504;
        errorCode = 'TIMEOUT';
      } else if (text.includes('payload') || text.includes('too large')) {
        errorMessage = 'El tamaño de los archivos es demasiado grande. Reduce el tamaño de las imágenes.';
        statusCode = 413;
        errorCode = 'PAYLOAD_TOO_LARGE';
      } else if (sdkError.code === 'moderation_blocked' || text.includes('safety system')) {
        errorMessage = 'Los filtros de seguridad de OpenAI bloquearon la solicitud; ajusta la descripción o las imágenes.';
        statusCode = 422;
        errorCode = 'MODERATION_BLOCKED';
      } else if (sdkError.status === 401 || sdkError.status === 403) {
        errorMessage = 'El servicio de imágenes no está disponible por ahora. Avisa al administrador.';
        statusCode = 502;
        errorCode = 'UPSTREAM_AUTH';
      } else if (sdkError.status === 429 || sdkError.status === 503 || text.includes('Service Unavailable')) {
        errorMessage = 'El servicio de imágenes está saturado en este momento; inténtalo de nuevo en un minuto.';
        statusCode = 503;
        errorCode = 'SERVICE_UNAVAILABLE';
      } else if (charged) {
        errorMessage = 'No se pudo generar la imagen.';
        statusCode = 502;
        errorCode = 'GENERATION_FAILED';
      } else {
        errorMessage = text;
        statusCode = sdkError.status && sdkError.status >= 400 && sdkError.status < 500 && sdkError.status !== 401 ? sdkError.status : 500;
      }
    }

    return NextResponse.json(
      { message: `${errorMessage}${note}`, code: errorCode, ...(remaining !== undefined ? { remaining } : {}) },
      { status: statusCode },
    );
  }
}
