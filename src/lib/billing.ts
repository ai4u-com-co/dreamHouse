// Cobro de créditos en el SERVIDOR (rutas /api). La clave de OpenAI es de Mariano: el gasto lo controla la base de datos.
//
// Flujo (sin service_role: todo se llama con el JWT DEL USUARIO, que la base valida con auth.uid()):
//   authenticate → charge (ANTES de llamar a OpenAI, atómico; los admin no pagan) → refund si OpenAI falla.
// El refund_token solo vive en el servidor: JAMÁS se incluye en una respuesta al navegador.
//
// Vive aparte de las rutas para poder probarlo sin cargar Next (igual que openai-image-settings).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const APP_ID = 'dreamhouse';
const SUPABASE_URL = 'https://dmracybffqdvcltkarag.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_EP0yPI9NexntnxQ4_dG5jg_dH5z_zWU';

/** El asistente de texto (gpt-4o-mini) cuesta una fracción de centavo: 1 crédito, el mínimo que admite la base. */
export const ASSISTANT_CREDITS = 1;
// El costo de un render lo calcula el núcleo compartido (src/lib/openai-image-core.ts, `creditsFor`): tokens de salida × variantes
// + 1 crédito por imagen de entrada. Ver src/lib/render-options.ts.

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

/** ¿Es administrador ACTIVO de DreamHouse? Se consulta con el JWT de la persona y se filtra por su id verificado. */
export async function isAdmin(sb: SupabaseClient, userId: string): Promise<boolean> {
  try {
    const { data: m } = await sb.schema('core').from('app_memberships').select('role,is_active').eq('app_id', APP_ID).eq('user_id', userId).maybeSingle();
    return m?.is_active === true && m?.role === 'admin';
  } catch {
    return false;
  }
}

/** Registra el uso real de OpenAI en el cobro (para costos). NUNCA puede romper una generación: se ignora cualquier error. */
export async function recordUsage(sb: SupabaseClient, logId: number, token: string | null, usage: Record<string, number | string>): Promise<void> {
  try {
    await sb.schema('core').rpc('record_usage', { p_log_id: logId, p_token: token, p_usage: usage });
  } catch {
    /* no afecta la entrega */
  }
}

/**
 * Liquidación con el uso real: el precio previo es una ESTIMACIÓN. Si lo real (`real`) supera lo cobrado, cobra la diferencia con
 * consume_credits (`image_topup`); si el saldo no alcanza, cobra lo que quede. Los admin no pagan (sin refundToken no hay cobro extra).
 * NUNCA lanza ni devuelve créditos de más: una generación que ya salió bien no se rompe. Devuelve lo cobrado de más y el saldo actualizado.
 */
export async function topUp(sb: SupabaseClient, c: Extract<Charge, { ok: true }>, real: number): Promise<{ extra: number; remaining: number }> {
  let remaining = c.remaining;
  let extra = 0;
  const missing = real - c.amount;
  if (!c.refundToken || !(missing > 0)) return { extra, remaining };
  try {
    const ask = async (n: number) =>
      (await sb.schema('core').rpc('consume_credits', { p_app: APP_ID, p_amount: n, p_action: 'image_topup', p_meta: { log_id: c.logId, charged: c.amount, real } })).data;
    let asked = missing;
    let top = await ask(asked);
    if (!top?.ok && Number.isInteger(top?.remaining) && top.remaining >= 1 && top.remaining < missing) {
      asked = top.remaining; // no alcanza para todo: cobra lo que quede
      top = await ask(asked);
    }
    if (top?.ok) {
      extra = asked;
      remaining = Number.isInteger(top.remaining) ? top.remaining : remaining - asked;
    }
  } catch {
    /* la imagen ya salió: no se rompe; el uso real queda en record_usage */
  }
  return { extra, remaining };
}
