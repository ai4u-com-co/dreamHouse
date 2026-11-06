// Cableado de la interfaz y del historial para recuperar parámetros. Ejecutar con: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');

test('historial: el tope es holgado y se avisa antes de perder renders', async () => {
  const { MAX_HISTORY } = await import('@/lib/db');
  assert.ok(MAX_HISTORY >= 60, 'una tanda de 20 vistas no debe vaciar el historial');
  const studio = src('src/app/studio/page.tsx');
  assert.ok((studio.match(/warnPruned\(pruned\)/g) ?? []).length >= 2, 'aviso tanto en renders como en vistas');
  assert.match(src('src/lib/db.ts'), /pruned/);
});

test('historial: se guarda lo que de verdad se envió y el id de cada imagen', () => {
  const studio = src('src/app/studio/page.tsx');
  assert.match(studio, /params: finalParams/, 'el registro guarda los parámetros finales (con hasExteriorReference)');
  assert.ok((studio.match(/imageId: data\.metadataIds\?\.\[k\]/g) ?? []).length >= 2, 'cada imagen guarda su id (renders y vistas)');
});

test('la interfaz ofrece recuperar parámetros (imagen o .json) y descargar los de cada generación', () => {
  assert.match(src('src/app/studio/page.tsx'), /<RestoreParamsButton onRestore=\{handleRestoreParams\}/);
  assert.match(src('src/components/RestoreParamsButton.tsx'), /image\/webp/);
  assert.match(src('src/components/HistoryGallery.tsx'), /downloadParams\(item\)/);
  assert.match(src('src/components/HistoryGallery.tsx'), /image\/webp/, 'una descarga WebP no debe llamarse .png');
});

test('recuperar no cambia el módulo actual ni la genealogía', () => {
  assert.match(src('src/app/studio/page.tsx'), /mode: prev\.mode, sourceRender: prev\.sourceRender/);
});
