// Cargador de pruebas: permite importar el código TypeScript de src/ desde Node sin dependencias nuevas.
//   - resuelve el alias "@/" → src/ y los imports relativos sin extensión
//   - transpila .ts con el propio paquete `typescript` (ya instalado por Next)
// Uso: node --import ./tests/unit/register.mjs --test "tests/unit/*.test.mjs"
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import ts from 'typescript';

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../src');

function withExtension(file) {
  for (const candidate of [file, `${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')]) {
    if (existsSync(candidate) && /\.(ts|tsx)$/.test(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  // Las rutas /api importan 'next/server' (CJS sin mapa de exports): en ESM de Node hay que pedirlo con extensión.
  if (specifier === 'next/server') return nextResolve('next/server.js', context);
  if (specifier.startsWith('@/')) {
    const found = withExtension(path.join(SRC, specifier.slice(2)));
    if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const parent = fileURLToPath(context.parentURL);
    if (/\.(ts|tsx)$/.test(parent)) {
      const found = withExtension(path.resolve(path.dirname(parent), specifier));
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (/\.(ts|tsx)$/.test(url)) {
    const source = await readFile(fileURLToPath(url), 'utf8');
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: fileURLToPath(url),
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  return nextLoad(url, context);
}
