// Llamadas del NAVEGADOR a las rutas /api: añade la sesión de Google y publica el saldo.
// Cada llamada devuelve el `ownerId` de la cuenta que la PIDIÓ: lo que se guarde después (historial) es de esa cuenta,
// aunque la sesión cambie mientras la operación estaba en curso.
import { supabase } from '@/lib/supabase';
import { publishCredits } from '@/lib/credits-bus';

export class ApiError extends Error {
  status: number;
  code: string;
  remaining?: number;
  constructor(message: string, status: number, code: string, remaining?: number) {
    super(message);
    this.status = status;
    this.code = code;
    this.remaining = remaining;
  }
}

export async function callApi<T = Record<string, unknown>>(url: string, body: FormData | string): Promise<{ data: T; ownerId: string }> {
  const { data: s } = await supabase.auth.getSession();
  const token = s.session?.access_token;
  const ownerId = s.session?.user?.id;
  if (!token || !ownerId) throw new ApiError('Tu sesión venció. Vuelve a entrar con Google.', 401, 'UNAUTHENTICATED');

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}) },
      body,
    });
  } catch {
    throw new ApiError('No hay conexión con el servidor. Revisa tu red.', 0, 'NETWORK');
  }

  let out: Record<string, unknown> | null = null;
  try {
    out = await res.json();
  } catch {
    /* respuesta sin JSON (p. ej. una página de error de la plataforma) */
  }
  // El saldo llega como `remaining` (renders, errores) o `_remaining` (asistente: va aparte de los parámetros que devuelve el modelo)
  const remainingNow = typeof out?.remaining === 'number' ? out.remaining : typeof out?._remaining === 'number' ? out._remaining : undefined;
  if (remainingNow !== undefined) publishCredits(remainingNow, ownerId);
  if (out && '_remaining' in out) delete out._remaining;
  if (!res.ok) {
    const message =
      (typeof out?.message === 'string' && out.message) ||
      (res.status === 413 ? 'Los archivos son demasiado pesados. Reduce su tamaño o cantidad.' : `El servidor respondió ${res.status}.`);
    throw new ApiError(message, res.status, typeof out?.code === 'string' ? out.code : 'SERVER_ERROR', typeof out?.remaining === 'number' ? out.remaining : undefined);
  }
  if (!out) throw new ApiError('El servidor devolvió una respuesta inválida.', res.status, 'INVALID_RESPONSE');
  return { data: out as T, ownerId };
}
