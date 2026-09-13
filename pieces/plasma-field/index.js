// Plasma Field — canvas2d. Renders at a downscaled buffer for speed, then stretches to the stage.
export function create(stage) {
  const ctx = stage.canvas.getContext('2d', { alpha: false });
  const buf = document.createElement('canvas');
  const bctx = buf.getContext('2d', { alpha: false });
  let raf, t = 0, img, W = 0, H = 0;
  function fit() {
    W = Math.max(1, Math.floor(stage.width / 6)); H = Math.max(1, Math.floor(stage.height / 6));
    buf.width = W; buf.height = H; img = bctx.createImageData(W, H);
  }
  fit();
  function frame() {
    const d = img.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const v = Math.sin(x / 8 + t) + Math.sin(y / 6 - t) + Math.sin((x + y) / 10 + t) + Math.sin(Math.hypot(x - W / 2, y - H / 2) / 8 - t);
      const i = (y * W + x) * 4, a = v * Math.PI;
      d[i] = 128 + 127 * Math.sin(a); d[i + 1] = 128 + 127 * Math.sin(a + 2.1); d[i + 2] = 128 + 127 * Math.sin(a + 4.2); d[i + 3] = 255;
    }
    bctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(buf, 0, 0, stage.canvas.width, stage.canvas.height);
    t += 0.04; raf = requestAnimationFrame(frame);
  }
  frame();
  return { resize: fit, destroy() { cancelAnimationFrame(raf); } };
}
