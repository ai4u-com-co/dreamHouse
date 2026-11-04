// Ayudante de las pruebas e2e: Supabase simulado a nivel de red (sin secretos ni datos reales) y sesiones de Google falsas.
// El SDK real de Supabase corre en la página; aquí solo se responde lo que Supabase respondería.
import type { BrowserContext, Page, Route } from '@playwright/test';

export const REF = 'dmracybffqdvcltkarag';
const STORAGE_KEY = `sb-${REF}-auth-token`;

export interface Membership {
  role: 'user' | 'admin';
  credits: number;
  is_active: boolean;
}

export interface MockState {
  /** null = la cuenta no tiene membresía de DreamHouse (y la app está cerrada: join_app se rechaza). */
  membership: Membership | null;
  /** Parámetros con los que la página pidió Google (provider, code_challenge_method…). */
  authorize: Record<string, string> | null;
  requests: string[];
}

export const newMockState = (membership: Membership | null = { role: 'user', credits: 10, is_active: true }): MockState => ({
  membership,
  authorize: null,
  requests: [],
});

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': '*',
  'access-control-allow-methods': '*',
  'access-control-expose-headers': 'content-range',
};

const b64u = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function session(id = 'u1') {
  const now = Math.floor(Date.now() / 1000);
  const user = {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email: `${id}@prueba.test`,
    app_metadata: { provider: 'google' },
    user_metadata: {},
    created_at: '2026-11-01T00:00:00Z',
  };
  const jwt = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: id, role: 'authenticated', exp: now + 86400 })}.firma`;
  return { access_token: jwt, token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, refresh_token: 'refresh-prueba', user };
}

export async function mockSupabase(context: BrowserContext, state: MockState): Promise<void> {
  await context.route(
    (url) => url.hostname.endsWith('supabase.co'),
    async (route: Route) => {
      const request = route.request();
      const url = new URL(request.url());
      const json = (status: number, body?: unknown) =>
        route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body) });
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
      state.requests.push(`${request.method()} ${url.pathname}`);

      if (url.pathname === '/auth/v1/authorize') {
        state.authorize = Object.fromEntries(url.searchParams.entries());
        const back = url.searchParams.get('redirect_to') ?? '/';
        return route.fulfill({ status: 302, headers: { location: `${back}${back.includes('?') ? '&' : '?'}code=codigo-prueba` } });
      }
      if (url.pathname === '/auth/v1/token') return json(200, session());
      if (url.pathname === '/auth/v1/user') return json(200, session().user);
      if (url.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
      if (url.pathname === '/rest/v1/app_memberships') {
        const wantsObject = (request.headers()['accept'] ?? '').includes('vnd.pgrst.object');
        const m = state.membership;
        if (!m) return wantsObject ? json(406, { code: 'PGRST116', message: 'sin filas' }) : json(200, []);
        return wantsObject ? json(200, m) : json(200, [m]);
      }
      if (url.pathname === '/rest/v1/rpc/join_app') return json(403, { code: '42501', message: 'app not open for signup' });
      return json(404, { message: 'no simulado' });
    }
  );
}

/** Deja una sesión iniciada ANTES de que cargue la página. */
export async function initSession(page: Page, id = 'u1'): Promise<void> {
  await page.addInitScript(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(session(id))] as const);
}

/** Cambia la sesión guardada en el navegador (para recargar como otra cuenta). */
export async function setSession(page: Page, id: string): Promise<void> {
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [STORAGE_KEY, JSON.stringify(session(id))] as const);
}

/** Simula el aviso entre pestañas del SDK (cambio de cuenta o refresco de sesión) SIN recargar la página. */
export async function broadcastAuth(page: Page, event: 'SIGNED_IN' | 'TOKEN_REFRESHED', id: string): Promise<void> {
  await page.evaluate(
    ([name, ev, ses]) => {
      const channel = new BroadcastChannel(name);
      channel.postMessage({ event: ev, session: JSON.parse(ses) });
      channel.close();
    },
    [STORAGE_KEY, event, JSON.stringify(session(id))] as const
  );
}

/** JPEG real de 16×16 para las respuestas simuladas de /api/generate. */
export const TINY_JPEG =
  'data:image/jpeg;base64,/9j/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAQABADASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAVAQEBAAAAAAAAAAAAAAAAAAACA//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AACRv//Z';

/** Simula /api/generate: devuelve la imagen y el saldo, y registra con qué encabezados llamó la página. */
export interface GenerateMock {
  calls: Array<{ authorization: string | null; hasKeyHeaders: boolean; params: Record<string, unknown> }>;
  /** Saldo que devolverá la siguiente llamada. */
  remaining: number;
  /** Milisegundos de espera antes de responder (para probar un cambio de cuenta durante la generación). */
  delayMs: number;
}

export async function mockGenerate(context: BrowserContext, mock: GenerateMock): Promise<void> {
  await context.route('**/api/generate', async (route: Route) => {
    const request = route.request();
    const headers = request.headers();
    const raw = request.postData() ?? '';
    const match = raw.match(/name="params"\r\n\r\n([\s\S]*?)\r\n--/);
    mock.calls.push({
      authorization: headers['authorization'] ?? null,
      hasKeyHeaders: 'x-openai-api-key' in headers || 'x-api-key' in headers,
      params: match ? (JSON.parse(match[1]) as Record<string, unknown>) : {},
    });
    if (mock.delayMs > 0) await new Promise((r) => setTimeout(r, mock.delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ imageUrl: TINY_JPEG, houseName: 'Villa Test', groundingMetadata: null, metadataId: 'm1', remaining: mock.remaining }),
    });
  });
}
