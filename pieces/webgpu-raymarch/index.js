// WebGPU Raymarch — webgpu. A signed-distance raymarched scene (rotating torus + ground, soft
// shadows, ambient occlusion), heavy per-pixel work to exercise the GPU. Rendered offscreen and
// presented via readback so it shows in the Thor viewer. See /gpu.js.
import { getGPU, createPresenter, fpsMeter } from '/gpu.js';
export async function create(stage) {
  const { device, desc } = await getGPU({ label: 'webgpu-raymarch' });
  const present = createPresenter(device, stage);
  const shader = device.createShaderModule({ code: `
    struct U { t:f32, w:f32, h:f32, _p:f32 };
    @group(0) @binding(0) var<uniform> u: U;
    @vertex fn vs(@builtin(vertex_index) i:u32) -> @builtin(position) vec4f {
      var p = array<vec2f,3>(vec2f(-1.,-3.), vec2f(-1.,1.), vec2f(3.,1.));
      return vec4f(p[i], 0., 1.);
    }
    fn rot(a:f32) -> mat2x2f { let c=cos(a); let s=sin(a); return mat2x2f(c,-s,s,c); }
    fn sdTorus(p:vec3f, t:vec2f) -> f32 { let q=vec2f(length(p.xz)-t.x, p.y); return length(q)-t.y; }
    fn map(pp:vec3f) -> f32 {
      var p = pp;
      let xz = rot(u.t*0.5) * p.xz; p.x=xz.x; p.z=xz.y;
      let xy = rot(u.t*0.3) * p.xy; p.x=xy.x; p.y=xy.y;
      let torus = sdTorus(p, vec2f(1.0, 0.4));
      let ground = pp.y + 1.2;
      return min(torus, ground);
    }
    fn calcN(p:vec3f) -> vec3f { let e=vec2f(0.001,0.0); return normalize(vec3f(
      map(p+e.xyy)-map(p-e.xyy), map(p+e.yxy)-map(p-e.yxy), map(p+e.yyx)-map(p-e.yyx))); }
    fn ao(p:vec3f, n:vec3f) -> f32 { var o=0.0; var s=1.0; for(var i=0;i<5;i++){ let d=0.05+0.12*f32(i); o+=(d-map(p+n*d))*s; s*=0.6; } return clamp(1.0-1.5*o,0.0,1.0); }
    fn shadow(ro:vec3f, rd:vec3f) -> f32 { var r=1.0; var t=0.05; for(var i=0;i<24;i++){ let h=map(ro+rd*t); if(h<0.001){return 0.0;} r=min(r,10.0*h/t); t+=h; if(t>8.0){break;} } return clamp(r,0.0,1.0); }
    @fragment fn fs(@builtin(position) c: vec4f) -> @location(0) vec4f {
      let uv = (c.xy - 0.5*vec2f(u.w,u.h)) / u.h * vec2f(1.,-1.);
      let ro = vec3f(0.0, 0.6, 4.0);
      let rd = normalize(vec3f(uv, -1.4));
      var t = 0.0; var hit = false; var p = ro;
      for(var i=0;i<90;i++){ p = ro+rd*t; let d = map(p); if(d<0.001){ hit=true; break; } t+=d; if(t>20.0){break;} }
      var col = vec3f(0.02,0.03,0.05) + 0.15*rd.y;
      if(hit){ let n=calcN(p); let l=normalize(vec3f(0.6,0.8,0.4));
        let dif=max(dot(n,l),0.0)*shadow(p+n*0.01,l); let a=ao(p,n);
        let base = select(vec3f(0.9,0.5,0.2), vec3f(0.3,0.32,0.35), p.y < -1.15);
        col = base*(0.2*a + dif) + vec3f(0.4,0.6,1.0)*pow(max(dot(n,vec3f(0,1,0)),0.0),2.0)*0.1*a;
      }
      col = pow(col, vec3f(0.4545));
      return vec4f(col, 1.0);
    }` });
  const ubuf = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const pipeline = device.createRenderPipeline({ layout: 'auto', vertex: { module: shader, entryPoint: 'vs' }, fragment: { module: shader, entryPoint: 'fs', targets: [{ format: present.format }] }, primitive: { topology: 'triangle-list' } });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }] });
  const tick = fpsMeter('webgpu-raymarch', () => `@ ${present.width}x${present.height} (${desc || 'gpu'})`);
  let t = 0, dead = false;
  async function frame() {
    if (dead) return;
    device.queue.writeBuffer(ubuf, 0, new Float32Array([t, present.width, present.height, 0]));
    const { encoder, view } = present.begin();
    const pass = encoder.beginRenderPass({ colorAttachments: [{ view, clearValue: { r: 0, g: 0, b: 0, a: 1 }, loadOp: 'clear', storeOp: 'store' }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
    await present.present();
    t += 0.016; tick(); if (!dead) requestAnimationFrame(frame);
  }
  console.log(`[webgpu-raymarch] ready ${present.width}x${present.height}`);
  requestAnimationFrame(frame);
  return { resize() { present.resize(); }, destroy() { dead = true; try { ubuf.destroy(); present.destroy(); device.destroy(); } catch {} } };
}
