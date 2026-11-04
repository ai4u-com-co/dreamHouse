// Acceso con Google, créditos y datos por cuenta. Supabase y /api/generate van simulados (sin red, sin secretos).
import { test, expect, type Page } from '@playwright/test';
import { broadcastAuth, initSession, mockGenerate, mockSupabase, newMockState, setSession, TINY_JPEG, type GenerateMock, type MockState } from './auth-mock';

const imgs = (page: Page) => page.locator('img[alt^="Generación"]');
const creditos = (page: Page) => page.getByTestId('credits').first();
const sinDesborde = (page: Page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
const bases = (page: Page) => page.evaluate(async () => (await indexedDB.databases()).map((d) => d.name ?? '').sort());

/** Deja un historial ANTERIOR (sin dueño, `DreamHouseDB`) con un render y su imagen completa. */
async function sembrarHistorialViejo(page: Page): Promise<void> {
  await page.evaluate(async (jpeg) => {
    const blob = await (await fetch(jpeg)).blob();
    await new Promise<void>((resolve, reject) => {
      const open = indexedDB.open('DreamHouseDB', 2);
      open.onupgradeneeded = () => {
        const db = open.result;
        const store = db.createObjectStore('generations', { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('mode', 'mode', { unique: false });
        db.createObjectStore('fullImages');
      };
      open.onsuccess = () => {
        const tx = open.result.transaction(['generations', 'fullImages'], 'readwrite');
        // Un render real siempre trae sus parámetros de diseño (la galería lee city y architecturalStyles)
        tx.objectStore('generations').put({ id: 'viejo-1', timestamp: 1000, mode: 'exterior', params: { city: 'Oslo', architecturalStyles: ['Moderno'] }, imageUrl: jpeg, houseName: 'Casa vieja', hasFullImage: true });
        tx.objectStore('fullImages').put(blob, 'viejo-1');
        tx.oncomplete = () => {
          open.result.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
      open.onerror = () => reject(open.error);
    });
  }, TINY_JPEG);
}

let estado: MockState;
let gen: GenerateMock;

test.beforeEach(async ({ context }) => {
  estado = newMockState();
  gen = { calls: [], remaining: 9, delayMs: 0 };
  await mockSupabase(context, estado);
  await mockGenerate(context, gen);
});

test.describe('puerta de acceso', () => {
  for (const ruta of ['/', '/studio']) {
    test(`${ruta} sin sesión: no hay campos de clave de API (ni Gemini ni OpenAI)`, async ({ page }) => {
      await page.goto(ruta);
      await expect(page.getByRole('button', { name: 'Entrar con Google' }).first()).toBeVisible();
      await expect(page.locator('input[type="password"]')).toHaveCount(0);
      await expect(page.getByText(/API Key|Gemini|OpenAI Required|Gemini Optional/i)).toHaveCount(0);
    });
  }

  test('/studio sin sesión muestra la puerta y esconde el Studio; a 375 px no hay scroll horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/studio');
    await expect(page.getByTestId('auth-gate')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate exterior' })).toHaveCount(0);
    const d = await sinDesborde(page);
    expect(d.sw).toBeLessThanOrEqual(d.iw);
  });

  test('entra con Google por PKCE y vuelve con la sesión', async ({ page }) => {
    await page.goto('/studio');
    await page.getByTestId('auth-gate').getByRole('button', { name: 'Entrar con Google' }).click();
    await expect(page.getByRole('button', { name: 'Generate exterior' })).toBeVisible();
    expect(estado.authorize?.provider).toBe('google');
    expect(estado.authorize?.code_challenge_method).toBe('s256');
    await expect.poll(() => page.url(), { message: 'el código de Google debe salir de la dirección' }).not.toContain('code=');
    await expect(creditos(page)).toContainText(/10 créditos/i);
  });

  test('cuenta sin membresía: mensaje claro con el correo y sin Studio', async ({ page }) => {
    estado.membership = null;
    await initSession(page);
    await page.goto('/studio');
    await expect(page.getByTestId('auth-gate')).toContainText('u1@prueba.test');
    await expect(page.getByTestId('auth-gate')).toContainText(/no tiene acceso/i);
    await expect(page.getByRole('button', { name: 'Generate exterior' })).toHaveCount(0);
  });

  test('admin: «Admin · sin límite»', async ({ page }) => {
    estado.membership = { role: 'admin', credits: 0, is_active: true };
    await initSession(page);
    await page.goto('/studio');
    await expect(creditos(page)).toContainText(/admin/i);
  });

  test('cerrar sesión devuelve a la puerta', async ({ page }) => {
    await initSession(page);
    await page.goto('/studio');
    await expect(page.getByRole('button', { name: 'Generate exterior' })).toBeVisible();
    await page.getByRole('button', { name: /Cerrar sesión/ }).first().click();
    await expect(page.getByTestId('auth-gate')).toBeVisible();
  });
});

test.describe('generación con créditos', () => {
  test('envía la sesión (Bearer), NO envía claves del navegador y actualiza el saldo', async ({ page }) => {
    await initSession(page);
    await page.goto('/studio');
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });
    await expect(page.getByText('Render generated successfully!')).toBeVisible();
    expect(gen.calls).toHaveLength(1);
    expect(gen.calls[0].authorization).toMatch(/^Bearer /);
    expect(gen.calls[0].hasKeyHeaders).toBe(false);
    await expect(creditos(page)).toContainText(/9 créditos/i);
    await expect(imgs(page)).toHaveCount(1);
  });

  test('sin saldo: muestra el mensaje del servidor y no guarda nada en el historial', async ({ page, context }) => {
    await context.unroute('**/api/generate');
    await context.route('**/api/generate', (route) =>
      route.fulfill({ status: 402, contentType: 'application/json', body: JSON.stringify({ code: 'INSUFFICIENT_CREDITS', message: 'No te quedan créditos suficientes (necesitas 4, tienes 0).', remaining: 0 }) })
    );
    await initSession(page);
    await page.goto('/studio');
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });
    await expect(page.getByText(/No te quedan créditos suficientes/)).toBeVisible();
    await expect(creditos(page)).toContainText(/0 créditos/i);
    await expect(imgs(page)).toHaveCount(0);
  });

  test('un refresco de sesión (evento repetido del SDK) NO desmonta el Studio ni borra lo escrito', async ({ page }) => {
    await initSession(page);
    await page.goto('/studio');
    const ciudad = page.getByPlaceholder('Ej: Kyoto, Oslo, Atacama...');
    await ciudad.fill('Oslo');
    await broadcastAuth(page, 'TOKEN_REFRESHED', 'u1');
    await broadcastAuth(page, 'SIGNED_IN', 'u1');
    await page.waitForTimeout(1200);
    await expect(ciudad).toHaveValue('Oslo');
  });
});

test.describe('historial por cuenta', () => {
  test('otra cuenta en el mismo navegador NO ve los renders de la primera, y la primera los recupera', async ({ page }) => {
    // OJO: initSession usaría un script de arranque que repone la sesión de u1 en CADA recarga; aquí se cambia de cuenta de verdad
    await page.goto('/studio');
    await setSession(page, 'u1');
    await page.reload();
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });
    await expect(imgs(page)).toHaveCount(1);

    await setSession(page, 'u2');
    await page.reload();
    await expect(page.getByRole('button', { name: 'Generate exterior' })).toBeVisible();
    await expect(imgs(page)).toHaveCount(0);
    await expect.poll(() => bases(page)).toEqual(expect.arrayContaining(['DreamHouseDB-u1', 'DreamHouseDB-u2'])); // cada cuenta, su base

    await setSession(page, 'u1');
    await page.reload();
    await expect(imgs(page)).toHaveCount(1);
  });

  test('si la sesión cambia MIENTRAS se genera, el render se guarda en la cuenta que lo pidió y el saldo no salta a la nueva', async ({ page }) => {
    gen.delayMs = 2500;
    gen.remaining = 3; // saldo que dejará la cuenta u1; u2 sigue con 10
    await initSession(page, 'u1');
    await page.goto('/studio');
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });
    await expect.poll(() => gen.calls.length).toBe(1);

    await broadcastAuth(page, 'SIGNED_IN', 'u2'); // cambia de cuenta con la generación en curso
    await expect(creditos(page)).toContainText(/10 créditos/i);
    await page.waitForTimeout(3200); // termina la generación de u1
    await expect(creditos(page)).toContainText(/10 créditos/i); // el saldo de u1 (3) NO se muestra en u2
    await expect(imgs(page)).toHaveCount(0); // y su render no aparece en el historial de u2

    await setSession(page, 'u1');
    await page.reload();
    await expect(imgs(page)).toHaveCount(1); // está en la colección de u1
  });
});

test.describe('historial anterior (sin dueño)', () => {
  test('NO se adopta solo: se pregunta; «Ahora no» no toca nada; importar lo trae; importar otra vez no duplica', async ({ page }) => {
    await page.goto('/studio');
    await sembrarHistorialViejo(page);
    await setSession(page, 'u1');
    await page.reload();

    const dialogo = page.getByTestId('legacy-dialog');
    await expect(dialogo).toBeVisible();
    await expect(imgs(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Ahora no' }).click();
    await expect(dialogo).toBeHidden();
    expect(await bases(page)).toContain('DreamHouseDB');

    await page.reload();
    await expect(dialogo).toBeVisible(); // se vuelve a preguntar
    await page.getByRole('button', { name: 'Importar a mi cuenta' }).click();
    await expect(dialogo).toBeHidden();
    await expect(imgs(page)).toHaveCount(1);
    const tras = await bases(page);
    expect(tras).not.toContain('DreamHouseDB');
    expect(tras).toContain('DreamHouseDB-u1');

    await sembrarHistorialViejo(page); // mismo id otra vez
    await page.reload();
    await page.getByRole('button', { name: 'Importar a mi cuenta' }).click();
    await expect(dialogo).toBeHidden();
    await expect(imgs(page)).toHaveCount(1);
  });

  test('una cuenta sin acceso no recibe oferta ni toca el historial anterior', async ({ page }) => {
    estado.membership = null;
    await page.goto('/studio');
    await sembrarHistorialViejo(page);
    await setSession(page, 'u3');
    await page.reload();
    await expect(page.getByTestId('auth-gate')).toContainText(/no tiene acceso/i);
    await page.waitForTimeout(800);
    await expect(page.getByTestId('legacy-dialog')).toHaveCount(0);
    expect(await bases(page)).toContain('DreamHouseDB');
  });

  test('una cuenta distinta no ve el historial anterior de otra: el diálogo solo ofrece importar al usuario activo', async ({ page }) => {
    await page.goto('/studio');
    await sembrarHistorialViejo(page);
    await setSession(page, 'u2');
    await page.reload();
    await expect(page.getByTestId('legacy-dialog')).toContainText('u2@prueba.test');
    await expect(imgs(page)).toHaveCount(0);
  });
});
