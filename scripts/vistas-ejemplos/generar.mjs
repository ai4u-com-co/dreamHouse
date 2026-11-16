// Genera el ejemplo visual de cada vista con el MISMO prompt que arma /api/generate (constructor + guía de imágenes + mandato),
// usando una casa de muestra como Imagen 1. Calidad baja (miniaturas). No se ejecuta en la app: es una herramienta de mantenimiento.
//
// Uso (desde la raíz del repo; necesita OPENAI_API_KEY o ~/.config/openai/api_key y el skill gpt-image):
//   node --experimental-strip-types --disable-warning=ExperimentalWarning --import ./tests/unit/register.mjs \
//     scripts/vistas-ejemplos/generar.mjs <casa.jpg> <carpeta-salida> [vista-slug ...]
// Deja <carpeta-salida>/raw/<slug>.png y <carpeta-salida>/prompts/<slug>.txt; luego `convertir.py` los pasa a webp.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { DEFAULT_PARAMS } from '@/types';
import { ARCHITECTURAL_VISTAS, VISTA_EXAMPLES } from '@/modules/vistas/constants';
import { buildVistasPrompt } from '@/modules/vistas/lib/prompt-builder';

const [casa, out, ...only] = process.argv.slice(2);
if (!casa || !out) { console.error('uso: generar.mjs <casa.jpg> <carpeta-salida> [slug ...]'); process.exit(1); }

const OPENAI = 'GPT Image 2.5 Sunburst (OpenAI)';
// Estos dos textos son los de src/app/api/generate/route.ts para el módulo vistas: si cambian allá, cambiarlos aquí.
const LOT_ROLE = 'the house to photograph (reference): the SAME house must appear, identical in form, materials and design; only the camera changes';
const MANDATE = `ARCHITECTURAL PORTFOLIO MANDATE:
- House anchor: Image 1 is the house. In every view repeat its massing, number of floors, roof, window and door rhythm, materials and colors exactly; only the camera changes.
- Do not restyle, redesign or add elements that are not implied by the reference.`;

const slugOf = (vista) => VISTA_EXAMPLES[vista].split('/').pop().replace(/\.webp$/, '');
const script = join(homedir(), '.claude/skills/gpt-image/scripts/gptimage.py');
mkdirSync(join(out, 'raw'), { recursive: true });
mkdirSync(join(out, 'prompts'), { recursive: true });

const jobs = ARCHITECTURAL_VISTAS.filter((v) => !only.length || only.includes(slugOf(v))).map((vista) => {
  const params = { ...DEFAULT_PARAMS, mode: 'vistas', aiModel: OPENAI, selectedVistas: [vista] };
  const narrative = buildVistasPrompt(params, vista, OPENAI);
  const prompt = `INPUT IMAGES:\n- Image 1: ${LOT_ROLE}.\n\n${narrative}\n\n[MANDATES & CONSTRAINTS]\n${MANDATE}\n- No extra text, no watermarks, no unrelated logos.`;
  const slug = slugOf(vista);
  writeFileSync(join(out, 'prompts', `${slug}.txt`), prompt);
  return { slug, prompt };
});

const run = ({ slug, prompt }) => new Promise((resolve) => {
  const dest = join(out, 'raw', `${slug}.png`);
  if (existsSync(dest)) return resolve(`${slug}: ya existe`);
  const p = spawn('python3', [script, prompt, '-i', casa, '-o', dest, '--size', '1536x1024'], { stdio: ['ignore', 'pipe', 'pipe'] });
  let log = '';
  p.stdout.on('data', (d) => { log += d; });
  p.stderr.on('data', (d) => { log += d; });
  p.on('close', (code) => resolve(code === 0 ? `${slug}: ok` : `${slug}: FALLO ${log.trim().slice(-300)}`));
});

// 4 en paralelo
const queue = [...jobs];
await Promise.all(Array.from({ length: 4 }, async () => {
  for (let j = queue.shift(); j; j = queue.shift()) console.log(await run(j));
}));
