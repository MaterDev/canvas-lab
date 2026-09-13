// Canvas Lab: a gallery of self-contained web-graphics pieces (WebGPU / WebGL / Canvas2D / SVG / CSS).
// No dependencies. Scans pieces/ so the gallery is automatic; serves and saves per-piece notes.
// Run: node server.mjs   (serves http://127.0.0.1:4860/)
import { createServer } from 'node:http';
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { watch } from 'node:fs';

const PORT = Number(process.env.PORT || 4860);
const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PUBLIC = join(ROOT, 'public');
const PIECES = join(ROOT, 'pieces');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.glsl': 'text/plain', '.wgsl': 'text/plain',
};
const send = (res, code, type, body) => { res.writeHead(code, { 'content-type': type, 'cache-control': 'no-cache' }); res.end(body); };
const ID = /^[a-z0-9][a-z0-9-]*$/; // safe piece id (also blocks path traversal)

// hot reload: fan out file-change events to connected clients (debounced per path)
const watchers = new Set();
const pending = new Map();
function changed(prefix, file) {
  const key = prefix + '/' + (file || '').replace(/\\/g, '/');
  clearTimeout(pending.get(key));
  pending.set(key, setTimeout(() => { pending.delete(key); for (const res of watchers) res.write('data: ' + key + '\n\n'); }, 150));
}
for (const [prefix, dir] of [['pieces', PIECES], ['public', PUBLIC]]) {
  try { watch(dir, { recursive: true }, (_, f) => changed(prefix, f)); } catch (e) { console.warn('watch failed for', prefix, e.message); }
}

async function listPieces() {
  let dirs = [];
  try { dirs = await readdir(PIECES, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const d of dirs) {
    if (!d.isDirectory() || !ID.test(d.name)) continue;
    let meta = {};
    try { meta = JSON.parse(await readFile(join(PIECES, d.name, 'meta.json'), 'utf8')); } catch { continue; }
    let hasNotes = false;
    try { hasNotes = (await stat(join(PIECES, d.name, 'notes.md'))).size > 0; } catch {}
    out.push({ id: d.name, title: meta.title || d.name, type: meta.type || 'other', tags: meta.tags || [], created: meta.created || '', description: meta.description || '', home: !!meta.home, hasNotes });
  }
  out.sort((a, b) => (b.home?1:0)-(a.home?1:0) || (b.created || '').localeCompare(a.created || '') || a.title.localeCompare(b.title));
  return out;
}

async function serveFile(res, base, rel) {
  const path = normalize(join(base, rel));
  if (!path.startsWith(base)) return send(res, 403, 'text/plain', 'forbidden');
  try {
    if ((await stat(path)).isDirectory()) return send(res, 403, 'text/plain', 'forbidden');
    send(res, 200, TYPES[extname(path)] || 'application/octet-stream', await readFile(path));
  } catch { send(res, 404, 'text/plain', 'not found'); }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let path = decodeURIComponent(url.pathname);

  if (path === '/api/pieces') return send(res, 200, 'application/json', JSON.stringify(await listPieces()));

  if (path === '/api/watch') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(': connected\n\n'); watchers.add(res);
    req.on('close', () => watchers.delete(res));
    return;
  }

  const notes = path.match(/^\/api\/notes\/([a-z0-9-]+)$/);
  if (notes && ID.test(notes[1])) {
    const file = join(PIECES, notes[1], 'notes.md');
    if (req.method === 'GET') { try { return send(res, 200, 'text/markdown', await readFile(file, 'utf8')); } catch { return send(res, 200, 'text/markdown', ''); } }
    if (req.method === 'PUT') {
      let body = ''; for await (const c of req) { body += c; if (body.length > 1e6) return send(res, 413, 'text/plain', 'too large'); }
      try { await writeFile(file, body); return send(res, 204, 'text/plain', ''); } catch { return send(res, 500, 'text/plain', 'write failed'); }
    }
  }

  if (path.startsWith('/pieces/')) return serveFile(res, PIECES, path.slice('/pieces/'.length));
  if (path === '/') path = '/index.html';
  return serveFile(res, PUBLIC, path.slice(1));
}).listen(PORT, '127.0.0.1', () => console.log(`Canvas Lab running at http://127.0.0.1:${PORT}/`));
