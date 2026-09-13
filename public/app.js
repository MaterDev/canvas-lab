// Canvas Lab gallery shell: lists pieces, loads one into the full-viewport stage, edits notes.
// A "piece" is pieces/<id>/index.js exporting `create(stage)` -> { destroy?, resize? }.
const $ = id => document.getElementById(id);
const stageEl = $('stage'), emptyEl = $('empty');
const nav = $('nav'), notes = $('notes');

let pieces = [], activeId = null, active = null, stage = null, activeType = new Set();

// ---------- stage handed to each piece ----------
function buildStage() {
  stageEl.textContent = '';
  const canvas = document.createElement('canvas');
  stageEl.appendChild(canvas);
  const s = {
    container: stageEl,        // append SVG / HTML / DOM here
    canvas,                    // 2D / WebGL / WebGPU context source
    get dpr() { return Math.min(devicePixelRatio || 1, 2); },
    get width() { return stageEl.clientWidth; },
    get height() { return stageEl.clientHeight; },
  };
  sizeCanvas(s);
  return s;
}
function sizeCanvas(s) {
  const w = s.width, h = s.height, dpr = s.dpr;
  s.canvas.width = Math.round(w * dpr); s.canvas.height = Math.round(h * dpr);
  s.canvas.style.width = w + 'px'; s.canvas.style.height = h + 'px';
}
addEventListener('resize', () => { if (stage) { sizeCanvas(stage); try { active && active.resize && active.resize(stage); } catch (e) { console.error(e); } } });

// ---------- load / unload pieces ----------
async function loadPiece(id) {
  if (id === activeId) { closePanels(); return; }
  try { active && active.destroy && active.destroy(); } catch (e) { console.error(e); }
  active = null; activeId = id;
  stage = buildStage(); emptyEl.classList.add('hidden');
  try {
    const mod = await import(`/pieces/${id}/index.js?t=${Date.now()}`); // cache-bust so edits show on reload
    active = (await mod.create(stage)) || {};
  } catch (e) { console.error(`piece "${id}" failed:`, e); showFallback(id, e && e.message ? e.message : String(e)); }
  renderList(); loadNotes(id);
  $('notesToggle').classList.remove('hidden');
  closePanels();
}

// A piece that can't run here (no WebGL/WebGPU, context lost) shows a message instead of a black stage.
function showFallback(id, reason) {
  emptyEl.innerHTML = '';
  const box = document.createElement('div');
  box.style.cssText = 'text-align:center;max-width:520px;padding:0 24px;line-height:1.6';
  const gpuNote = /webgpu|webgl|context|gpu|chrome/i.test(reason) ? '<div style="margin-top:10px;color:var(--ink)">This piece needs a GPU. Open the lab in real Chrome:</div><div style="margin-top:6px;color:var(--accent);font-size:14px;letter-spacing:.04em">' + location.origin + '/</div>' : '';
  box.innerHTML = '<div style="color:var(--accent);letter-spacing:.2em">"' + id + '" COULD NOT RUN HERE</div><div style="margin-top:8px;color:var(--ink-dim);font-size:12px">' + reason.replace(/</g, '&lt;') + '</div>' + gpuNote;
  emptyEl.appendChild(box); emptyEl.classList.remove('hidden');
}
stageEl.addEventListener('piece-error', e => showFallback(activeId || '?', e.detail || 'runtime error'));

// ---------- hot reload: the server pushes an event when pieces/ or public/ change ----------
(function hotReload() {
  let es;
  const connect = () => {
    es = new EventSource('/api/watch');
    es.onmessage = ev => {
      const file = ev.data || '';
      if (/^public\//.test(file)) { location.reload(); return; }                   // shell changed -> full reload
      const m = file.match(/^pieces\/([a-z0-9-]+)\//);
      if (m && m[1] === activeId) { const id = activeId; activeId = null; loadPiece(id); }  // active piece changed -> re-mount it
      else if (m) fetchPieces();                                                    // another piece's meta/notes changed -> refresh list
    };
    es.onerror = () => { es.close(); setTimeout(connect, 2000); };
  };
  connect();
})();

// ---------- gallery list ----------
async function fetchPieces() {
  try { pieces = await (await fetch('/api/pieces')).json(); } catch { pieces = []; }
  renderFilters(); renderList();
  if (!activeId && pieces.length) loadPiece((pieces.find(p => p.home) || pieces[0]).id);
}
function renderFilters() {
  const types = [...new Set(pieces.map(p => p.type))].sort();
  const box = $('filters'); box.textContent = '';
  for (const t of types) {
    const b = document.createElement('button'); b.className = 'chip' + (activeType.has(t) ? ' on' : ''); b.textContent = t;
    b.onclick = () => { activeType.has(t) ? activeType.delete(t) : activeType.add(t); renderFilters(); renderList(); };
    box.appendChild(b);
  }
}
function renderList() {
  const q = $('search').value.trim().toLowerCase();
  const items = pieces.filter(p => {
    if (activeType.size && !activeType.has(p.type)) return false;
    if (!q) return true;
    return (p.title + ' ' + p.type + ' ' + (p.tags || []).join(' ') + ' ' + p.description).toLowerCase().includes(q);
  });
  $('count').textContent = items.length + '/' + pieces.length;
  const list = $('list'); list.textContent = '';
  if (!items.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = pieces.length ? 'no matches' : 'no pieces yet — run: npm run new <id> "Title"'; list.appendChild(li); return; }
  for (const p of items) {
    const li = document.createElement('li'); if (p.id === activeId) li.classList.add('active');
    const row = document.createElement('div'); row.className = 't';
    const type = document.createElement('span'); type.className = 'type'; type.textContent = p.type;
    const title = document.createElement('span'); title.className = 'title'; title.textContent = p.title;
    row.append(type, title); li.appendChild(row);
    if (p.tags && p.tags.length) { const tg = document.createElement('div'); tg.className = 'tags'; tg.textContent = p.tags.join(' · '); li.appendChild(tg); }
    li.onclick = () => loadPiece(p.id);
    list.appendChild(li);
  }
}
$('search').addEventListener('input', renderList);

// ---------- notes ----------
async function loadNotes(id) {
  const p = pieces.find(x => x.id === id) || {};
  $('notesTitle').textContent = (p.title || id).toUpperCase();
  $('meta').textContent = `${p.type || ''}  ·  ${(p.tags || []).join(', ') || 'no tags'}  ·  ${p.created || ''}`;
  $('notesState').textContent = '';
  try { $('notesText').value = await (await fetch(`/api/notes/${id}`)).text(); } catch { $('notesText').value = ''; }
}
$('notesSave').onclick = async () => {
  if (!activeId) return;
  $('notesState').textContent = 'saving…';
  try {
    const r = await fetch(`/api/notes/${activeId}`, { method: 'PUT', headers: { 'content-type': 'text/markdown' }, body: $('notesText').value });
    $('notesState').textContent = r.ok ? 'saved' : 'error';
    fetchPieces();
  } catch { $('notesState').textContent = 'error'; }
};

// ---------- panels (bottom-left, open upward) ----------
function openPanel(el, btn) {
  closePanels();
  el.classList.remove('hidden'); btn.classList.add('on');
}
function closePanels() {
  nav.classList.add('hidden'); notes.classList.add('hidden');
  $('navToggle').classList.remove('on'); $('notesToggle').classList.remove('on');
}
$('navToggle').onclick = () => nav.classList.contains('hidden') ? openPanel(nav, $('navToggle')) : closePanels();
$('notesToggle').onclick = () => notes.classList.contains('hidden') ? openPanel(notes, $('notesToggle')) : closePanels();

fetchPieces();
