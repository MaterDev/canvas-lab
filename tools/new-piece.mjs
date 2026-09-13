// Scaffold a new piece: node tools/new-piece.mjs <id> "Title" [type]
// type: canvas2d | webgl | webgpu | svg | css | other  (default canvas2d)
import { mkdir, writeFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const [, , id, title, type = 'canvas2d'] = process.argv;
if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) { console.error('usage: npm run new -- <id-kebab-case> "Title" [type]'); process.exit(1); }
const dir = join(fileURLToPath(new URL('../pieces/', import.meta.url)), id);
try { await access(dir); console.error(`piece "${id}" already exists`); process.exit(1); } catch {}

const meta = { title: title || id, type, tags: [], created: new Date().toISOString().slice(0, 10), description: '' };
const template = `// ${meta.title} — ${type}
// create(stage) runs when the piece is opened. Return { destroy?, resize? }.
// stage: { container, canvas, width, height, dpr }
export function create(stage) {
  const ctx = stage.canvas.getContext('2d');
  let raf, t = 0;
  function frame() {
    const { width: w, height: h, dpr } = stage;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#05080c'; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#5ee0ff';
    ctx.font = '16px ui-monospace, monospace';
    ctx.fillText('${meta.title}', 24, 40);
    t += 0.016;
    raf = requestAnimationFrame(frame);
  }
  frame();
  return { destroy() { cancelAnimationFrame(raf); } };
}
`;
await mkdir(dir, { recursive: true });
await writeFile(join(dir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
await writeFile(join(dir, 'index.js'), template);
await writeFile(join(dir, 'notes.md'), `# ${meta.title}\n\n`);
console.log(`created pieces/${id}/ (${type}). Edit pieces/${id}/index.js — it appears in the gallery on refresh.`);
