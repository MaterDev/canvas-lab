// WebGPU Gradient — webgpu. Animated WGSL shader, rendered on the GPU and presented via readback so
// it is visible in the Thor viewer (see /gpu.js createPresenter).
import { getGPU, createPresenter, fpsMeter } from '/gpu.js';
export async function create(stage) {
  const { device, desc } = await getGPU({ label: 'webgpu-gradient' });
  const present = createPresenter(device, stage);
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
  const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format: present.format }] }, primitive: { topology: 'triangle-list' } });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const tick = fpsMeter('webgpu-gradient', () => `@ ${present.width}x${present.height} (${desc || 'gpu'})`);
  let t = 0, dead = false;
  async function frame() {
    if (dead) return;
    device.queue.writeBuffer(ubuf, 0, new Float32Array([t, present.width, present.height]));
    const { encoder, view } = present.begin();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
    await present.present();
    t += 0.016; tick(); if (!dead) requestAnimationFrame(frame);
  }
  console.log(`[webgpu-gradient] ready ${present.width}x${present.height}`);
  requestAnimationFrame(frame);
  return {
    resize() { present.resize(); },
    destroy() { dead = true; try { ubuf.destroy(); present.destroy(); device.destroy(); } catch {} },
  };
}
