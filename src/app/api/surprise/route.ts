import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { ASSISTANT_CREDITS, authenticate, charge, chargeFailure, noChargeNote, refund, type Charge } from '@/lib/billing';
import { cleanLabel, sanitizeAssistantParams } from '@/lib/assistant-params';
import { isSurpriseMode, pickAnchors, surpriseFields, surpriseSystemPrompt } from '@/lib/surprise-schema';

export const maxDuration = 30;

const MAX_CITY = 80;

/**
 * «Surprise Me» con IA: el modelo inventa UN concepto coherente (lugar, clima, estilo, escala, luz…) y rellena los campos del módulo.
 * Mismo cobro que el asistente (1 crédito, los admin no pagan; se devuelve si algo falla). La clave de OpenAI vive solo en el servidor.
 * Lo que el modelo inventa se valida de nuevo contra los catálogos del formulario (deny-by-default): nada fuera de catálogo llega al navegador.
 */
export async function POST(req: NextRequest) {
  const auth = await authenticate(req.headers.get('authorization'));
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHENTICATED', message: 'Inicia sesión para usar Surprise Me con IA.' }, { status: 401 });
  }
  let charged: Extract<Charge, { ok: true }> | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    const { mode, city } = (body && typeof body === 'object' ? body : {}) as { mode?: unknown; city?: unknown };
    if (!isSurpriseMode(mode)) {
      return NextResponse.json({ message: 'Módulo no válido.' }, { status: 400 });
    }
    // La ciudad es texto de la persona: se limpia y se acota; va al modelo como DATO entre comillas
    const cleanCity = typeof city === 'string' ? (cleanLabel(city, MAX_CITY) ?? '') : '';

    const openaiApiKey = process.env.OPENAI_API_KEY;
    if (!openaiApiKey) {
      return NextResponse.json({ code: 'SERVER_MISCONFIGURED', message: 'El asistente no está configurado todavía.' }, { status: 500 });
    }

    const c = await charge(auth.sb, ASSISTANT_CREDITS, 'surprise', { mode });
    if (!c.ok) {
      const failure = chargeFailure(c);
      return NextResponse.json(failure.body, { status: failure.status });
    }
    charged = c;

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 1,
      messages: [
        { role: 'system', content: surpriseSystemPrompt(mode, { city: cleanCity, anchors: pickAnchors(mode, !!cleanCity) }) },
        { role: 'user', content: 'Invent the concept now and return the JSON object.' },
      ],
      response_format: { type: 'json_object' },
    });

    const outputText = response.choices[0]?.message?.content;
    if (!outputText) throw new Error('Empty response from OpenAI');
    const raw = JSON.parse(outputText.trim()) as Record<string, unknown>;

    const { concept: rawConcept, ...fields } = raw;
    const { params: valid, dropped } = sanitizeAssistantParams(fields);
    // Solo las claves que ESTE módulo pidió: el filtro del asistente admite también textos libres de máxima prioridad (dirección creativa,
    // exclusiones) y un campo que nadie pidió no debe colarse. Con ciudad de la persona, la ciudad no se pide y por tanto no se pisa.
    const asked = new Set<string>(surpriseFields(mode, !cleanCity).map((f) => f.key));
    const params = Object.fromEntries(Object.entries(valid).filter(([k]) => asked.has(k))) as typeof valid;
    if (Object.keys(params).length === 0) throw new Error('El modelo no devolvió ningún campo válido');

    return NextResponse.json({ params, concept: cleanLabel(rawConcept, 160) ?? '', dropped: dropped.length, _remaining: charged.remaining });
  } catch (error: unknown) {
    console.error('Surprise API Error:', error);
    let remaining: number | undefined;
    let refunded = true;
    if (charged) {
      const r = await refund(auth.sb, charged);
      remaining = r.remaining;
      refunded = r.refunded;
    }
    const sdkError = error as { status?: number };
    const unavailable = sdkError?.status === 401 || sdkError?.status === 403 || sdkError?.status === 404;
    const base = unavailable ? 'El asistente de texto no está habilitado para la clave del servidor todavía.' : 'No se pudo generar la idea con IA.';
    return NextResponse.json(
      { code: unavailable ? 'ASSISTANT_UNAVAILABLE' : 'SURPRISE_FAILED', message: `${base}${charged ? noChargeNote(refunded) : ''}`, ...(remaining !== undefined ? { remaining } : {}) },
      { status: unavailable ? 502 : 500 },
    );
  }
}
