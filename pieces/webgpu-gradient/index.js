// WebGPU Gradient — webgpu. Full-screen triangle + animated WGSL fragment shader.
import { getGPU, fpsMeter } from '/gpu.js';
export async function create(stage) {
  const { device, desc } = await getGPU({ label: 'webgpu-gradient' });
  const ctx = stage.canvas.getContext('webgpu');
  const format = navigator.gpu.getPreferredCanvasFormat();
  const configure = () => ctx.configure({ device, format, alphaMode: 'opaque' });
  configure();
  const shader = device.createShaderModule({ code: `
    @vertex fn vs(@builtin(vertex_index) i:u32) -> @builtin(position) vec4f {
      var p = array<vec2f,3>(vec2f(-1.,-3.), vec2f(-1.,1.), vec2f(3.,1.));
      return vec4f(p[i], 0., 1.);
    }
    struct U { t: f32, w: f32, h: f32 };
    @group(0) @binding(0) var<uniform> u: U;
    @fragment fn fs(@builtin(position) c: vec4f) -> @location(0) vec4f {
      let uv = c.xy / vec2f(u.w, u.h);
      let r = 0.5 + 0.5*sin(u.t + uv.x*6.0);
      let g = 0.5 + 0.5*sin(u.t*1.3 + uv.y*6.0 + 2.0);
      let b = 0.5 + 0.5*sin(u.t*0.7 + (uv.x+uv.y)*6.0 + 4.0);
      return vec4f(r, g, b, 1.0);
    }` });
  const ubuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' } });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const tick = fpsMeter('webgpu-gradient', () => `@ ${stage.canvas.width}x${stage.canvas.height} (${desc || 'gpu'})`);
  let raf, t = 0, dead = false;
  function frame() {
    if (dead) return;
    device.queue.writeBuffer(ubuf, 0, new Float32Array([t, stage.canvas.width, stage.canvas.height]));
    const enc = device.createCommandEncoder();
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: ctx.getCurrentTexture().createView(), clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
    device.queue.submit([enc.finish()]);
    t += 0.016; tick(); raf = requestAnimationFrame(frame);
  }
  console.log(`[webgpu-gradient] ready ${stage.canvas.width}x${stage.canvas.height}`);
  raf = requestAnimationFrame(frame);
  return {
    resize() { configure(); },
    destroy() { dead = true; cancelAnimationFrame(raf); try { ubuf.destroy(); device.destroy(); } catch {} },
  };
}
