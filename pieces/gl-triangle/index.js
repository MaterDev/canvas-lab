// GL Gradient Triangle — webgl (WebGL2). Minimal shader pipeline + proper teardown.
export function create(stage) {
  const gl = stage.canvas.getContext('webgl2', { antialias: true });
  if (!gl) throw new Error('WebGL2 not available');
  const vs = `#version 300 es
  in vec2 p; in vec3 c; out vec3 vc; uniform float a;
  void main(){ float s=sin(a),co=cos(a); vec2 r=vec2(p.x*co-p.y*s,p.x*s+p.y*co); vc=c; gl_Position=vec4(r,0.,1.); }`;
  const fs = `#version 300 es
  precision highp float; in vec3 vc; out vec4 o; void main(){ o=vec4(vc,1.); }`;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog); gl.useProgram(prog);
  const data = new Float32Array([0, .8, 1, .2, .3, -.8, -.7, .2, 1, .4, .8, -.7, .3, .5, 1]);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  const pl = gl.getAttribLocation(prog, 'p'), cl = gl.getAttribLocation(prog, 'c');
  gl.enableVertexAttribArray(pl); gl.vertexAttribPointer(pl, 2, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(cl); gl.vertexAttribPointer(cl, 3, gl.FLOAT, false, 20, 8);
  const aLoc = gl.getUniformLocation(prog, 'a');
  const resize = () => gl.viewport(0, 0, stage.canvas.width, stage.canvas.height);
  resize();
  let raf, a = 0;
  function frame() { gl.clearColor(.02, .03, .05, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.uniform1f(aLoc, a); gl.drawArrays(gl.TRIANGLES, 0, 3); a += .01; raf = requestAnimationFrame(frame); }
  frame();
  return { resize, destroy() { cancelAnimationFrame(raf); gl.getExtension('WEBGL_lose_context')?.loseContext(); } };
}
