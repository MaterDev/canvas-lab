// Shared WebGPU bootstrap for Canvas Lab pieces.
// Usage:  const { device, adapter, desc } = await getGPU({ label: 'my-piece' });
//
// Why not just requestAdapter()? Chromium masks adapter names, and in the Thor viewer the Adreno GPU
// is deliberately presented to WebGPU as "swiftshader" (see turnip-kgsl-shim), so names can't be
// trusted. When the adapter *claims* to be software we measure instead: a real GPU finishes the probe
// in a few ms, a CPU rasterizer takes seconds and would freeze this device.
export async function getGPU({ label = 'piece', powerPreference } = {}) {
  if (!navigator.gpu) throw new Error('WebGPU is not available in this browser');
  const adapter = await navigator.gpu.requestAdapter(powerPreference ? { powerPreference } : undefined);
  if (!adapter) throw new Error('No WebGPU adapter');
  const info = adapter.info || {};
  const desc = [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(' ');
  const claimsSoftware = /swiftshader|llvmpipe|software/i.test(desc) && !/turnip|adreno|mali|nvidia|amd|radeon|intel|apple/i.test(desc);
  const device = await withTimeout(adapter.requestDevice(), 8000, 'requestDevice');
  device.lost.then((l) => console.warn(`[${label}] WebGPU device lost: ${l.reason} ${l.message}`));
  let verdict = 'gpu';
  if (claimsSoftware) {
    const ms = await withTimeout(timeProbe(device), 8000, 'gpu probe');
    if (ms > 400) { device.destroy(); throw new Error(`Only a software WebGPU adapter is available here (probe ${ms.toFixed(0)}ms); it would freeze this viewer. Open Canvas Lab in real Chrome.`); }
    verdict = `gpu-speed (probe ${ms.toFixed(0)}ms)`;
  }
  console.log(`[${label}] webgpu adapter: ${desc || '(masked)'} -> ${verdict}`);
  return { adapter, device, desc };
}

// Small fps meter: call tick() every frame; logs "~N fps" every `every` ms.
export function fpsMeter(label, extra = () => '', every = 2000) {
  let frames = 0, last = performance.now();
  return function tick() {
    frames++; const now = performance.now();
    if (now - last >= every) { console.log(`[${label}] ~${Math.round(frames * 1000 / (now - last))} fps ${extra()}`); frames = 0; last = now; }
  };
}

function withTimeout(p, ms, what) {
  return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(`${what} timed out after ${ms}ms`)), ms))]);
}

async function timeProbe(device) {
  const N = 512;
  const tex = device.createTexture({ size: [N, N], format: 'rgba8unorm', usage: GPUTextureUsage.RENDER_ATTACHMENT });
  const sh = device.createShaderModule({ code: `
    @vertex fn vs(@builtin(vertex_index) i:u32)->@builtin(position) vec4f{var p=array<vec2f,3>(vec2f(-1,-3),vec2f(-1,1),vec2f(3,1));return vec4f(p[i],0,1);}
    @fragment fn fs(@builtin(position) p:vec4f)->@location(0) vec4f{var c=p.xy/512.0*3.0-1.5; var z=vec2f(0.0); var i=0u; loop{ if(i>=100u||dot(z,z)>4.0){break;} z=vec2f(z.x*z.x-z.y*z.y,2.0*z.x*z.y)+c; i=i+1u;} return vec4f(f32(i)/100.0,0.0,0.0,1.0);}` });
  const pl = device.createRenderPipeline({ layout: 'auto', vertex: { module: sh, entryPoint: 'vs' }, fragment: { module: sh, entryPoint: 'fs', targets: [{ format: 'rgba8unorm' }] } });
  const t0 = performance.now();
  const enc = device.createCommandEncoder();
  for (let k = 0; k < 10; k++) { const ps = enc.beginRenderPass({ colorAttachments: [{ view: tex.createView(), loadOp: 'clear', storeOp: 'store' }] }); ps.setPipeline(pl); ps.draw(3); ps.end(); }
  device.queue.submit([enc.finish()]);
  await device.queue.onSubmittedWorkDone();
  tex.destroy();
  return performance.now() - t0;
}
