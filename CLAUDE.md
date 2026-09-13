# Canvas Lab

A gallery of self-contained web-graphics pieces (WebGPU / WebGL2 / Canvas2D / SVG / CSS), watched
through the Thor Viewer or opened directly in top-screen Chrome.

## Dev

```
npm start        # node server.mjs
```

```
http://127.0.0.1:4860/
```

Port 4860 is fixed. `npm run new -- <id> "Title" [type]` scaffolds a piece. The server scans
`pieces/` (gallery is automatic), serves `/api/pieces`, GET/PUT `/api/notes/:id`, and SSE hot reload
at `/api/watch`.

## Piece contract

`pieces/<id>/index.js` exports `create(stage) -> { destroy?, resize? }` where `stage =
{ container, canvas, width, height, dpr }`. Also `meta.json` (title, type, tags, created,
description) and `notes.md`.

## WebGPU pieces

WebGPU runs on the real Adreno GPU in the viewer via `MaterDev/turnip-kgsl-shim` (the viewer's
`~/.config/thor-gpu/env` must be active). Because the GPU is disguised as SwiftShader there,
WebGPU pieces MUST use `/gpu.js`:
- `getGPU({label})` — returns `{ device, adapter, desc }`; measures GPU speed instead of trusting the
  adapter name (which reads "swiftshader" on purpose) and throws (→ fallback card) on a real CPU rasterizer.
- `createPresenter(device, stage)` — render into `present.begin().view` each frame, then
  `await present.present()`. It renders offscreen and blits to a 2D canvas, because Chromium can't
  composite the disguised adapter's `webgpu`-context canvas. See `pieces/webgpu-gradient` / `webgpu-raymarch`.

## Layout

Follows `~/.claude/rules/thor-app-layout.md`: amber launchers at bottom-left (gallery) and
bottom-right (notes), matching the shell's 40px button geometry; content stays full-viewport.
