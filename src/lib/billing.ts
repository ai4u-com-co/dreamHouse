// Cobro de créditos en el SERVIDOR (rutas /api). La clave de OpenAI es de Mariano: el gasto lo controla la base de datos.
//
// Flujo (sin service_role: todo se llama con el JWT DEL USUARIO, que la base valida con auth.uid()):
//   authenticate → charge (ANTES de llamar a OpenAI, atómico; los admin no pagan) → refund si OpenAI falla.
// El refund_token solo vive en el servidor: JAMÁS se incluye en una respuesta al navegador.
//
// Vive aparte de las rutas para poder probarlo sin cargar Next (igual que openai-image-settings).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { OpenAIImageQuality } from '@/lib/openai-image-settings';

export const APP_ID = 'dreamhouse';
const SUPABASE_URL = 'https://dmracybffqdvcltkarag.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EP0yPI9NexntnxQ4_dG5jg_dH5z_zWU';

/** Créditos por render según la calidad (×2 en 2K/4K y en edición). */
const QUALITY_CREDITS: Record<OpenAIImageQuality, number> = { low: 1, medium: 4, high: 15, xhigh: 30 };
/** El asistente de texto (gpt-4o-mini) cuesta una fracción de centavo: 1 crédito, el mínimo que admite la base. */
export const ASSISTANT_CREDITS = 1;

export function renderCredits(quality: OpenAIImageQuality, resolution: string, mode: string): number {
  const base = Object.hasOwn(QUALITY_CREDITS, quality) ? QUALITY_CREDITS[quality] : QUALITY_CREDITS.low;
  const big = resolution === '2K' || resolution === '4K' || mode === 'edit'; // edición: el tamaño lo decide la imagen de entrada
  return base * (big ? 2 : 1);
}

export interface Authenticated {
  sb: SupabaseClient;
  userId: string;
}

/** Valida el JWT de Supabase del encabezado Authorization. null si falta o no es válido. */
export async function authenticate(authorization: string | null): Promise<Authenticated | null> {
  const jwt = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!jwt) return null;
  const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
  const { data, error } = await sb.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return { sb, userId: data.user.id };
}

export type Charge =
  | { ok: true; amount: number; remaining: number; logId: number; refundToken: string | null }
  | { ok: false; reason: 'insufficient'; remaining: number; needed: number }
  | { ok: false; reason: 'no_access' | 'unauthenticated' | 'error' };

/** Cobra `amount` créditos de forma atómica. Los admin no pagan (sin refundToken). */
export async function charge(sb: SupabaseClient, amount: number, action: string, meta: Record<string, unknown>): Promise<Charge> {
  if (!Number.isInteger(amount) || amount < 1) return { ok: false, reason: 'error' };
  const { data, error } = await sb.schema('core').rpc('consume_credits', { p_app: APP_ID, p_amount: amount, p_action: action, p_meta: meta });
  if (error) {
    if (error.code === '42501') return { ok: false, reason: 'no_access' };
    if (error.code === '28000') return { ok: false, reason: 'unauthenticated' };
    return { ok: false, reason: 'error' };
  }
  if (!data?.ok) return { ok: false, reason: 'insufficient', remaining: data?.remaining ?? 0, needed: amount };
  return { ok: true, amount, remaining: data.remaining, logId: data.log_id, refundToken: data.refund_token ?? null };
}

/** Devuelve el cobro (si lo hubo). `refunded` es false solo si había cobro y no se pudo devolver (caso raro). */
export async function refund(sb: SupabaseClient, c: Extract<Charge, { ok: true }>): Promise<{ remaining: number; refunded: boolean }> {
  if (!c.refundToken) return { remaining: c.remaining, refunded: true }; // admin: no hubo cobro
  try {
    const { data } = await sb.schema('core').rpc('refund_credits', { p_log_id: c.logId, p_token: c.refundToken });
    if (data?.ok) return { remaining: data.remaining, refunded: true };
  } catch {
    /* se informa abajo */
  }
  return { remaining: c.remaining, refunded: false };
}

/** Respuesta HTTP para un cobro que no pasó (status + cuerpo listo para el navegador; nunca el token). */
export function chargeFailure(c: Exclude<Charge, { ok: true }>): { status: number; body: Record<string, unknown> } {
  switch (c.reason) {
    case 'insufficient':
      return { status: 402, body: { code: 'INSUFFICIENT_CREDITS', message: `No te quedan créditos suficientes (necesitas ${c.needed}, tienes ${c.remaining}).`, remaining: c.remaining, needed: c.needed } };
    case 'no_access':
      return { status: 403, body: { code: 'NO_ACCESS', message: 'Tu cuenta no tiene acceso a DreamHouse.' } };
    case 'unauthenticated':
      return { status: 401, body: { code: 'UNAUTHENTICATED', message: 'Tu sesión venció. Vuelve a entrar con Google.' } };
    default:
      return { status: 500, body: { code: 'BILLING_ERROR', message: 'No se pudo verificar tu saldo. Inténtalo de nuevo.' } };
  }
}

/** Sufijo honesto: promete «no se te cobró» solo si de verdad se devolvió el cobro. */
export const noChargeNote = (refunded: boolean) =>
  refunded ? ' No se te cobró; inténtalo de nuevo.' : ' No pudimos devolverte los créditos automáticamente: escríbenos y lo corregimos.';
