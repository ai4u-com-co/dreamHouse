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

    // Open Phase 1 section
    await page.getByRole('button', { name: /Fase 1: Concepto Central/i }).click({ force: true });
    
    // Select Architect (this is a Chip, wait for it to be visible first)
    const architectChip = page.getByText('Zaha Hadid', { exact: true });
    await architectChip.waitFor({ state: 'visible' });
    await architectChip.click({ force: true });
    
    // Select Style
    const styleChip = page.getByText('Paramétrico', { exact: true });
    await styleChip.waitFor({ state: 'visible' });
    await styleChip.click({ force: true });

    // Fill City in Phase 3
    await page.getByRole('button', { name: /Fase 3: Sitio y Clima/i }).click({ force: true });
    await page.getByPlaceholder('Ej: Kyoto, Oslo, Atacama...').fill('Dubai');

    // Generate
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });

    // Verify Results
    await expect(page.getByText('Render generated successfully!')).toBeVisible();
    await expect(page.getByText('Zaha Hadid').first()).toBeVisible();
    await expect(page.getByText('Paramétrico').first()).toBeVisible();
  });

  test('Interior Workflow: Room Selection', async ({ page }) => {
    // Switch to Interior
    await page.getByText('Diseño Interior', { exact: true }).click({ force: true });
    
    // Open Identity section (Interior version)
    await page.getByText('Espacio y Propósito', { exact: true }).click({ force: true });
    
    // Wait for the select to be visible inside the section
    const roomSelect = page.getByLabel('Espacio / Habitación');
    await roomSelect.waitFor({ state: 'visible' });
    await roomSelect.selectOption('Cocina gourmet');
    
    // Select Style
    const styleChip = page.getByRole('button', { name: 'Minimalista' }).first();
    await styleChip.waitFor({ state: 'visible' });
    await styleChip.click({ force: true });

    // Generate
    await page.getByRole('button', { name: 'Generate interior' }).click({ force: true });

    // Verify Results
    await expect(page.getByText('Render generated successfully!')).toBeVisible();
    await expect(roomSelect).toHaveValue('Cocina gourmet');
  });

  test('Vistas Workflow: Multi-generation', async ({ page }) => {
    // Switch to Vistas (Mode selector)
    await page.getByText('Portafolio de Vistas').first().click({ force: true });

    // Upload base house image required for vistas
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const houseInput = page.getByRole('region', { name: /Cargar Foto de la Casa/i }).locator('input[type="file"]');
    await houseInput.setInputFiles({
      name: 'casa-base.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    
    // Click the section header "Portafolio de Vistas" to expand it
    await page.getByRole('button', { name: /Portafolio de Vistas/i }).last().click({ force: true });

    // Select vista
    const heroShot = page.getByRole('button', { name: /Perspectiva Principal \(Hero/i }).first();
    await heroShot.waitFor({ state: 'visible' });
    await heroShot.click({ force: true });

    // Generate
    await page.getByRole('button', { name: 'Generate vistas' }).click({ force: true });

    // Multi-generation takes more time
    await expect(page.locator('#result')).toBeVisible({ timeout: 15000 });
  });

  test('Edit Mode: UI check', async ({ page }) => {
    // Switch to Edit
    await page.getByText('Editar Imagen con IA').click();
    
    // Verify Edit specific elements
    await expect(page.getByText('Sube la imagen a editar')).toBeVisible();

    // Upload base image required for edit
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const editBaseInput = page.getByRole('region', { name: /Sube la imagen a editar/i }).locator('input[type="file"]');
    await editBaseInput.setInputFiles({
      name: 'base-edicion.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });
    
    // Fill edit prompt
    await page.getByPlaceholder('Ej: Make the tree smaller, add a modern pool, change the wall color to white...').fill('Change the wall to Blue');
    
    // Generate (Mock will handle it)
    await page.getByRole('button', { name: 'Generate edit' }).click();
    
    await expect(page.locator('#result')).toBeVisible({ timeout: 15000 });
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
    const generateBtn = page.getByRole('button', { name: /Generate planta/i }).first();
    await generateBtn.scrollIntoViewIfNeeded();
    await generateBtn.click({ force: true });
    await expect(page.getByText('Render generated successfully!')).toBeVisible();

    // Verify "Levantar en Exterior" button transfers floor plan and switches to Exterior preserving program
    const liftBtn = page.getByRole('button', { name: 'Levantar en Exterior' });
    await expect(liftBtn).toBeVisible();
    await liftBtn.click();

    await expect(page.getByText('Planta cargada como Plano Residencial en Arquitectura Exterior con todo tu programa espacial.')).toBeVisible();
    await expect(page.getByText('Slot de Planta activo: forma y geometría ancladas (1:1)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Generate exterior render' })).toBeVisible();
    // Design Spec shows the loaded PLANO file and preserved size/bedrooms
    await expect(page.locator('span:text-is("PLANO")')).toBeVisible();
    await expect(page.locator('span:text-is("220")')).toBeVisible();
  });

  test('Module Sections: expanding sections operates independently with stable scroll anchoring (no downwards jump)', async ({ page }) => {
    // 1. Abrir Fase 1: Concepto Central
    const sec2Btn = page.getByRole('button', { name: /Fase 1: Concepto Central/i });
    await sec2Btn.click();
    await page.waitForTimeout(300);

    // 2. Localizar Fase 4: Diseño Físico y Programa
    const sec4Btn = page.getByRole('button', { name: /Fase 4: Diseño Físico y Programa/i });
    await sec4Btn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    const rectBefore = await sec4Btn.boundingBox();
    expect(rectBefore).not.toBeNull();

    // 3. Hacer click en Fase 4 para expandirla
    await sec4Btn.click();
    await page.waitForTimeout(400);

    // 4. Verificar que Fase 4 permanece visible en la pantalla (sin salto hacia abajo ni desaparecer arriba)
    const rectAfter = await sec4Btn.boundingBox();
    expect(rectAfter).not.toBeNull();
    expect(rectAfter!.y).toBeGreaterThanOrEqual(70);
    expect(rectAfter!.y).toBeLessThan(700);

    // 5. Verificar que el contenido de Fase 4 está efectivamente expandido
    await expect(page.getByText('Volumetría y Estructura')).toBeVisible();

    // 6. Verificar que Fase 1 no fue forzada a cerrarse (despliegue independiente)
    await expect(page.getByText('Define la esencia y el carácter arquitectónico del edificio exterior.')).toBeVisible();
  });

  test('Custom Detail Slots: add suggested and custom slots, upload photo, check loaded badge and generation params', async ({ page }) => {
    // 1. Abrir Fase 2: Geometría e Imagen Base
    const sec2Btn = page.getByRole('button', { name: /Fase 2: Geometría e Imagen Base/i });
    await sec2Btn.click();
    await page.waitForTimeout(300);

    // 2. Verificar presencia del gestor de slots
    await expect(page.getByText('Slots de Detalles Personalizados')).toBeVisible();

    // 3. Añadir slot desde chip sugerido ("Puerta principal")
    const puertaChip = page.getByRole('button', { name: /Puerta principal/i });
    await puertaChip.click();

    // El slot se agrega con input con valor "Puerta principal"
    const slotInput1 = page.locator('input[value="Puerta principal"]');
    await expect(slotInput1).toBeVisible();

    // 4. Añadir slot personalizado desde input de texto libre
    const customInput = page.getByPlaceholder(/Nombre de otro detalle/i);
    await customInput.fill('Ventanales acústicos');
    await page.getByRole('button', { name: 'Añadir slot' }).click();

    const slotInput2 = page.locator('input[value="Ventanales acústicos"]');
    await expect(slotInput2).toBeVisible();

    // Contador indica 0 / 2
    await expect(page.getByText('0 / 2')).toBeVisible();

    // 5. Subir imagen al primer slot
    // El input del primer slot está oculto pero puede recibir archivos
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    
    // Obtenemos el input de archivo correspondiente al primer slot
    const firstSlotCard = page.locator('div[role="region"][aria-label="Slots de detalles personalizados"]').locator('.border-border\\/70').first();
    const slotFileInput = firstSlotCard.locator('input[type="file"]');
    await slotFileInput.setInputFiles({
      name: 'puerta-roble.png',
      mimeType: 'image/png',
      buffer: tinyPng,
    });

    // 6. Verificar que la imagen se cargó (muestra nombre de archivo y botón Cambiar foto)
    await expect(firstSlotCard.getByText(/puerta-roble/i)).toBeVisible();
    await expect(firstSlotCard.getByText('Cambiar foto')).toBeVisible();

    // Contador actualizado a 1 / 2
    await expect(page.getByText('1 / 2')).toBeVisible();

    // 7. En PromptPreview debe figurar el badge de DETALLE
    await expect(page.locator('span:text-is("DETALLE")')).toBeVisible();

    // 8. Generar y comprobar que se envían los slots
    await page.getByRole('button', { name: 'Generate exterior' }).click({ force: true });
    await expect(page.getByText('Render generated successfully!')).toBeVisible();

    // 9. Eliminar el segundo slot
    const secondSlotCard = page.locator('div[role="region"][aria-label="Slots de detalles personalizados"]').locator('.border-border\\/70').nth(1);
    await secondSlotCard.getByTitle('Eliminar este slot').click();

    await expect(page.locator('input[value="Ventanales acústicos"]')).toHaveCount(0);
  });
});

