import { test, expect } from '@playwright/test';
import { initSession, mockGenerate, mockSupabase, newMockState } from './auth-mock';

test.describe('DreamHouse Studio E2E MVP', () => {
  test.beforeEach(async ({ page, context }) => {
    // El Studio exige sesión de Google y membresía: Supabase y la generación van simulados (sin red, sin secretos)
    await mockSupabase(context, newMockState());
    await mockGenerate(context, { calls: [], remaining: 9, delayMs: 0 });
    await initSession(page);

    // Go to the studio page
    await page.goto('/studio');
    await expect(page.getByRole('button', { name: 'Generate exterior' })).toBeVisible();
  });

  test('Global Actions: Surprise Me and Reset', async ({ page }) => {
    // Initially city should be empty
    const cityInput = page.getByPlaceholder('Ej: Kyoto, Oslo, Atacama...');
    await expect(cityInput).toHaveValue('');

    // Click Surprise Me using its aria-label
    await page.getByLabel('Generar una combinación aleatoria de parámetros para inspiración').click({ force: true });
    
    // Toast should appear (Spanish)
    await expect(page.getByText('Se ha generado un diseño exterior aleatorio.')).toBeVisible();

    // Click Reset using its aria-label
    await page.getByLabel('Restablecer todos los parámetros a sus valores predeterminados').click({ force: true });
    
    // City should be empty again
    await expect(cityInput).toHaveValue('');
    await expect(page.getByText('Parameters reset to default')).toBeVisible();
  });

  test('Exterior Workflow: Advanced Selection', async ({ page }) => {
    // Ensure we are in Exterior mode
    await expect(page.getByText('Arquitectura Exterior')).toBeVisible();

    // Open Identity section
    await page.getByText('Identidad del Proyecto', { exact: true }).click({ force: true });
    
    // Select Architect (this is a Chip, wait for it to be visible first)
    const architectChip = page.getByText('Zaha Hadid', { exact: true });
    await architectChip.waitFor({ state: 'visible' });
    await architectChip.click({ force: true });
    
    // Select Style
    const styleChip = page.getByText('Paramétrico', { exact: true });
    await styleChip.waitFor({ state: 'visible' });
    await styleChip.click({ force: true });

    // Fill City
    await page.getByPlaceholder('Ej: Kyoto, Oslo, Atacama...').fill('Dubai');

    // Generate
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });

    // Verify Results
    await expect(page.getByText('Render generated successfully!')).toBeVisible();
    
    // Check if Prompt DNA reflects our choices
    await expect(page.locator('span:text-is("ARQUITECTO")')).toBeVisible();
    await expect(page.getByText('Zaha Hadid', { exact: true }).nth(1)).toBeVisible(); 
    await expect(page.locator('span:text-is("ESTILO")')).toBeVisible();
    await expect(page.getByText('Paramétrico', { exact: true }).nth(1)).toBeVisible();
  });

  test('Interior Workflow: Room Selection', async ({ page }) => {
    // Switch to Interior
    await page.getByText('Diseño Interior', { exact: true }).click({ force: true });
    
    // Open Identity section (Interior version)
    await page.getByText('Espacio y Propósito', { exact: true }).click({ force: true });
    
    // Wait for the select to be visible inside the section
    const roomSelect = page.getByLabel('Espacio / Habitación');
    await roomSelect.waitFor({ state: 'visible' });
    await roomSelect.selectOption('Cocina');
    
    // Select Style
    const styleChip = page.getByText('Minimalista', { exact: true });
    await styleChip.waitFor({ state: 'visible' });
    await styleChip.click({ force: true });

    // Generate
    await page.getByRole('button', { name: 'Generate interior' }).click({ force: true });

    // Verify Results
    await expect(page.getByText('Render generated successfully!')).toBeVisible();
    
    // Check Prompt DNA
    await expect(page.locator('span:text-is("TIPO")')).toBeVisible();
    await expect(page.getByText('Cocina', { exact: true })).toBeVisible();
  });

  test('Vistas Workflow: Multi-generation', async ({ page }) => {
    // Switch to Vistas (Mode selector)
    await page.getByText('Portafolio de Vistas').first().click({ force: true });
    
    // Click the section header "Portafolio de Vistas" to expand it
    await page.getByText('Portafolio de Vistas').nth(1).click({ force: true });

    // Select some vistas from constants (wait for them to be visible)
    const heroShot = page.getByText('Perspectiva Principal (Hero Shot)');
    await heroShot.waitFor({ state: 'visible' });
    await heroShot.click({ force: true });
    
    const elevation = page.getByText('Fachada Frontal (Elevación)');
    await elevation.waitFor({ state: 'visible' });
    await elevation.click({ force: true });

    // Generate
    await page.getByRole('button', { name: 'Generate vistas' }).click({ force: true });

    // Multi-generation takes more time
    await expect(page.getByText('Portafolio generado con éxito')).toBeVisible({ timeout: 15000 });
    
    // Verify we have the result section
    await expect(page.getByText('Portafolio de Vistas').last()).toBeVisible();
  });

  test('Edit Mode: UI check', async ({ page }) => {
    // Switch to Edit
    await page.getByText('Editar Imagen con IA').click();
    
    // Verify Edit specific elements
    await expect(page.getByText('Sube la imagen a editar')).toBeVisible();
    
    // Fill edit prompt
    await page.getByPlaceholder('Ej: Make the tree smaller, add a modern pool, change the wall color to white...').fill('Change the wall to Blue');
    
    // Generate (Mock will handle it)
    await page.getByRole('button', { name: 'Generate edit' }).click();
    
    await expect(page.getByText('Render generated successfully!')).toBeVisible();
  });

  test('Planta Workflow: Optional fields, Lot Photo + Zone Selection, Responsive (375/768/1024/1440) and Lift to Exterior', async ({ page }) => {
    // Switch to Planta module
    await page.getByRole('button', { name: 'Planta', exact: true }).click();
    await expect(page.getByText('Fase 1: Programa y Dimensiones')).toBeVisible();
    await expect(page.getByText(/Nada es obligatorio: todos los campos son opcionales/i)).toBeVisible();

    // Verify lot photo uploader is immediately visible in Fase 1 and allows uploading + selecting zone
    const lotInput = page.getByLabel('Subir foto del lote');
    await expect(lotInput).toBeAttached();
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mNk+M9Qz0AEYBxVSF+FAAhKDveksOjmAAAAAElFTkSuQmCC',
      'base64',
    );
    await lotInput.setInputFiles({ name: 'mi-lote.png', mimeType: 'image/png', buffer: tinyPng });

    const selectZoneBtn = page.getByRole('button', { name: 'Seleccionar zona para la planta' });
    await expect(selectZoneBtn).toBeVisible();
    await selectZoneBtn.click();

    // PolygonZoneModal opens: place 3 points and apply zone
    const dialog = page.getByRole('dialog', { name: 'Seleccionar zona por puntos' });
    await expect(dialog).toBeVisible();
    const canvas = dialog.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.2);
      await page.mouse.click(box.x + box.width * 0.8, box.y + box.height * 0.2);
      await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.8);
    }
    await dialog.getByRole('button', { name: 'Aplicar zona' }).click();
    await expect(page.getByText('Zona marcada (1)')).toBeVisible();

    // Fill spatial division program (optional fields)
    await page.getByLabel('Área Construida (m²)').fill('220');
    await page.getByLabel('Niveles / Pisos').fill('2');
    await page.getByLabel('Frente del Lote (m)').fill('12');
    await page.getByLabel('Fondo del Lote (m)').fill('25');
    await page.getByLabel('Dormitorios').fill('4');
    await page.getByLabel('Baños').fill('3');
    await page.getByText('Estudio / Home Office', { exact: true }).click();

    // Check responsive viewports (no horizontal overflow at 375, 768, 1024, 1440)
    for (const [width, height] of [[375, 812], [768, 1024], [1024, 768], [1440, 900]] as const) {
      await page.setViewportSize({ width, height });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      expect(overflow, `No debe haber scroll horizontal a ${width}px`).toBe(false);
    }

    // Generate floor plan
    await page.getByRole('button', { name: 'Generate planta render' }).click();
    await expect(page.getByText('Render generated successfully!')).toBeVisible();

    // Verify "Levantar en Exterior" button transfers floor plan and switches to Exterior preserving program
    const liftBtn = page.getByRole('button', { name: 'Levantar en Exterior' });
    await expect(liftBtn).toBeVisible();
    await liftBtn.click();

    await expect(page.getByText('Planta cargada como Plano Residencial en Arquitectura Exterior con todo tu programa espacial.')).toBeVisible();
    await expect(page.getByText('Slot de Planta activo: límites geométricos fijados')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate exterior render' })).toBeVisible();
    // Design Spec shows the loaded PLANO file and preserved size/bedrooms
    await expect(page.locator('span:text-is("PLANO")')).toBeVisible();
    await expect(page.locator('span:text-is("220")')).toBeVisible();
  });
});

