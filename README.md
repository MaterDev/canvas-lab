# Canvas Lab

A gallery of self-contained web-graphics pieces (WebGPU / WebGL / Canvas2D / SVG / CSS) for the
AYN Thor. No build step, no dependencies: `server.mjs` scans `pieces/` so the gallery is
automatic, serves the app, and saves per-piece notes.

## Run

```sh
node server.mjs        # or: npm start
```

```
http://127.0.0.1:4860/
```

The gallery lists every piece under `pieces/`; click one to load it full-viewport into the stage.
Content is full-viewport; the shell's controls overlay it (see the device app-layout rules).

## WebGPU pieces run on the real GPU — in the viewer

**WebGPU pieces render on the actual Adreno 740 GPU inside the Thor Viewer**, not on a software
rasterizer. This is not the default browser behaviour on this device; it is made possible by three
reversible runtime layers (a pass-through Vulkan ICD shim, a Dawn device-identity spoof, and an
`LD_PRELOAD` `dlopen` blocker) plus the presentation trick below.

- How and why it works, layer by layer: **`/code/projects/turnip-kgsl-shim`** (see its
  `docs/HOW-IT-WORKS.md`, `docs/REPRODUCE.md`, `docs/BLOG-DRAFT.md`).
- It only takes effect when the viewer runs through the `chromium-gpu` wrapper with
  `~/.config/thor-gpu/env` present. Without that, WebGPU pieces fall back gracefully (see below)
  and everything else is unaffected.
- Measured here: ~140 fps at 832x468, 60 fps fullscreen at 1280x633, 0 GPU crashes.

Because the GPU is deliberately disguised as SwiftShader to Chromium, `adapter.info` names and
`adapter.isFallbackAdapter` **cannot be trusted** — the adapter reports as software even though it
is hardware. `gpu.js` handles this for you; do not gate your own code on the adapter name or the
fallback flag.

## The piece contract

A piece is `pieces/<id>/index.js` exporting `create(stage)`:

```js
export async function create(stage) {
  // ... set up ...
  return { destroy() {/* free GPU/context */}, resize() {/* re-layout */} };
}
```

`stage` provides:

- `stage.canvas` — a `<canvas>` element for 2D / WebGL / WebGPU output.
- `stage.container` — the stage element; append SVG / HTML / DOM here.
- `stage.width` / `stage.height` — CSS pixel size of the stage.

Each piece also has `pieces/<id>/meta.json` (`title`, `type`, `tags`, `created`, `description`,
optional `home`) and an optional `notes.md`. Scaffold one with `npm run new <id> "Title"`.

## The `/gpu.js` contract WebGPU pieces MUST use

WebGPU pieces do **not** draw to a `webgpu` context (Chromium can't composite one from the
disguised adapter — it renders blank). Instead, use the two helpers exported from `/gpu.js`:

### 1. `getGPU({ label, powerPreference }) -> { adapter, device, desc }`

Requests an adapter and device, and — because the adapter's reported name is untrustworthy here —
**verifies the GPU is real by timing a probe** rather than reading the name. A real GPU finishes in
a few ms; a CPU rasterizer takes seconds, which would freeze the device, so `getGPU()` **throws**
if only a genuine software adapter is available (probe > 400 ms). Let that error propagate: the
gallery shows an "open in real Chrome" fallback card instead of a frozen black stage.

```js
import { getGPU, createPresenter, fpsMeter } from '/gpu.js';
const { device, desc } = await getGPU({ label: 'my-piece' });
```

### 2. `createPresenter(device, stage, { format }) -> presenter`

Owns `stage.canvas` as a **2D** canvas and makes GPU output visible in the viewer by rendering
offscreen, reading the pixels back, and blitting them in. Per frame:

```js
const present = createPresenter(device, stage);           // format defaults to 'rgba8unorm'
function frame() {
  const { encoder, view } = present.begin();              // draw into `view` (a GPUTextureView)
  const pass = encoder.beginRenderPass({ colorAttachments: [{ view, loadOp: 'clear', storeOp: 'store' }] });
  // ... set pipeline / bind groups / draw ...
  pass.end();
  present.present().then(() => requestAnimationFrame(frame)); // submit + readback + blit
}
requestAnimationFrame(frame);
```

- Build your render pipeline's color target with `format: present.format`.
- Use `present.width` / `present.height` for the current pixel size.
- In your returned object: `resize()` should call `present.resize()`; `destroy()` should call
  `present.destroy()` (and `device.destroy()`, and free your own buffers).

`fpsMeter(label, extra, every)` returns a `tick()` you call each frame; it logs `~N fps` to the
console periodically.

**Worked example:** `pieces/webgpu-gradient/index.js` (animated WGSL gradient using exactly this
contract).

## Testing on the GPU (isolated, watchdog-protected)

Harness scripts (in `~/.claude/skills/agent-browser/`) drive an isolated `gputest` session — never
the live viewer — with a watchdog that kills the browser if the device runs away:

- `gpu-probe.sh <label>` — adapter, render+readback smoke, perf, `chrome://gpu` dump.
- `gpu-piece-test.sh "<title regex>" [seconds]` — load one piece, capture console + screenshot.
- `gpu-soak.sh "<A>" "<B>" [rounds] [seconds]` — switch pieces repeatedly; report crashes + temp.

`npm test` runs the app's own smoke test (`test/smoke.mjs`).

## License

MIT.
