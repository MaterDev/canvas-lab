// Hello / Liquid Space — webgl2 home piece.
// "hello world" as liquid glass refracting a starfield + nebula, with prismatic dispersion.
// Adaptive quality: full-res on a real GPU; low-res + light shader on a software renderer
// (the mirrored Thor Viewer), so it never trips the software watchdog and loses its context.
export function create(stage) {
  const log = (...a) => console.log('[hello-liquid]', ...a);
  const gl = stage.canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  if (!gl) throw new Error('WebGL2 not available');

  // detect software rendering (SwiftShader) -> low quality tier
  const dbg = gl.getExtension('WEBGL_debug_renderer_info');
  const renderer = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  const software = /swiftshader|llvmpipe|software/i.test(renderer);
  log('renderer:', renderer, software ? '(software)' : '(gpu)');
  if (software) { gl.getExtension('WEBGL_lose_context')?.loseContext(); throw new Error('This liquid-shader needs a real GPU. Open Canvas Lab in Chrome to see it live.'); }
  const Q = { cap: 1440, octaves: 4, lasers: 5, tag: 'gpu' };

  let contextLost = false;
  stage.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); contextLost = true; console.error('[hello-liquid] WebGL context lost'); stage.container.dispatchEvent(new CustomEvent('piece-error', { bubbles: true, detail: 'WebGL context lost (renderer too slow?)' })); });

  // crisp DOM caption over the shader
  const cap = document.createElement('div');
  cap.style.cssText = 'position:absolute;left:0;right:0;bottom:8%;text-align:center;pointer-events:none;font-family:ui-monospace,monospace;color:#dff6ff;text-shadow:0 0 12px rgba(94,224,255,.6);z-index:2';
  cap.innerHTML = '<div style="font-size:13px;letter-spacing:.4em;opacity:.95">CANVAS&nbsp;LAB</div>'
    + '<div style="font-size:11px;letter-spacing:.12em;opacity:.6;margin-top:6px">a living gallery of web-graphics experiments · open the menu ↙</div>';
  stage.container.appendChild(cap);

  // "hello world" -> mask texture
  const tc = document.createElement('canvas'), tctx = tc.getContext('2d');
  const tex = gl.createTexture();
  let textAspect = 2;
  function buildText() {
    const W = 1024, H = 512; tc.width = W; tc.height = H; textAspect = W / H;
    tctx.clearRect(0, 0, W, H);
    tctx.fillStyle = '#fff'; tctx.textAlign = 'center'; tctx.textBaseline = 'middle';
    tctx.font = '900 210px system-ui, sans-serif';
    tctx.fillText('hello', W / 2, H * 0.32);
    tctx.fillText('world', W / 2, H * 0.70);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  const vs = `#version 300 es
  void main(){ vec2 p=vec2((gl_VertexID<<1)&2, gl_VertexID&2); gl_Position=vec4(p*2.-1.,0.,1.); }`;

  const fs = `#version 300 es
  precision highp float;
  out vec4 O;
  uniform vec2 R; uniform float T; uniform sampler2D TXT; uniform float TA;
  #define OCT ${Q.octaves}
  #define NLASER ${Q.lasers}

  float hash(vec2 p){ p=fract(p*vec2(123.34,345.45)); p+=dot(p,p+34.345); return fract(p.x*p.y); }
  float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
  float fbm(vec2 p){ float s=0.,a=.5; for(int i=0;i<OCT;i++){ s+=a*noise(p); p=p*2.02+vec2(7.3,3.1); a*=.5; } return s; }

  vec3 space(vec2 uv){
    vec2 q=uv; q.x*=R.x/R.y;
    vec2 w=q*1.5 + vec2(fbm(q*1.2+T*.03), fbm(q*1.2-T*.025));
    float n=fbm(w*1.6);
    vec3 neb = mix(vec3(.015,.02,.07), vec3(.32,.07,.5), smoothstep(.35,.95,n));
    neb += vec3(.0,.22,.45)*smoothstep(.6,1.,n)*.7;
    vec2 g=q*vec2(R.x/R.y,1.)*80.; float h=hash(floor(g));
    float st=smoothstep(.985,1.,h)*smoothstep(.5,0.,length(fract(g)-.5))*(.6+.4*sin(T*3.+h*50.));
    return neb + vec3(st);
  }

  vec3 lasers(vec2 uv){
    vec2 p=(uv-.5); p.x*=R.x/R.y; vec3 col=vec3(0.);
    for(int i=0;i<NLASER;i++){ float fi=float(i);
      float a=T*.15 + fi*(6.2831/float(NLASER)); vec2 dir=vec2(cos(a),sin(a));
      float d=abs(dot(p,vec2(-dir.y,dir.x)) + .16*sin(T*.5+fi));
      vec3 hue=.5+.5*cos(6.2831*(fi/float(NLASER)+vec3(0.,.33,.67))+T*.2);
      col += hue*(0.005/(d+0.004));
    }
    return col*0.5;
  }

  void main(){
    vec2 uv=gl_FragCoord.xy/R;
    vec3 outc = space(uv) + lasers(uv);
    float scr=R.x/R.y; vec2 tuv=(uv-.5); tuv.x*=(scr/TA); tuv/=0.72; tuv+=.5;
    if(tuv.x>0.&&tuv.x<1.&&tuv.y>0.&&tuv.y<1.){
      vec2 rip=vec2(sin(tuv.y*26.+T*1.5),cos(tuv.x*26.-T*1.3))*0.004;
      float m=smoothstep(.35,.65, texture(TXT, vec2(tuv.x,1.-tuv.y)+rip).a);
      if(m>0.001){
        float e=0.004;
        vec2 nrm=vec2(texture(TXT,vec2(tuv.x+e,1.-tuv.y)).a-texture(TXT,vec2(tuv.x-e,1.-tuv.y)).a,
                      texture(TXT,vec2(tuv.x,1.-tuv.y-e)).a-texture(TXT,vec2(tuv.x,1.-tuv.y+e)).a);
        vec2 ro=nrm*0.35; float disp=0.03;
        vec3 refr=vec3(space(uv+ro+nrm*disp).r, space(uv+ro+nrm*disp*1.6).g, space(uv+ro+nrm*disp*2.2).b) + lasers(uv+ro);
        float fres=pow(clamp(length(nrm)*3.,0.,1.),1.5);
        vec3 liquid=refr*1.15 + fres*vec3(.4,.7,1.) + vec3(.05,.12,.2);
        outc=mix(outc, liquid, m);
      }
    }
    O=vec4(pow(clamp(outc,0.,1.),vec3(.9)),1.);
  }`;

  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('shader: ' + gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram(); gl.attachShader(prog, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(prog));
  gl.useProgram(prog);
  const uR = gl.getUniformLocation(prog, 'R'), uT = gl.getUniformLocation(prog, 'T'), uTA = gl.getUniformLocation(prog, 'TA');
  gl.uniform1i(gl.getUniformLocation(prog, 'TXT'), 0);
  gl.bindVertexArray(gl.createVertexArray());

  function resize() {
    const w = stage.width, h = stage.height, s = Math.min(1, Q.cap / Math.max(w, h)) * (software ? 1 : Math.min(stage.dpr, 2));
    stage.canvas.width = Math.max(1, Math.round(w * s)); stage.canvas.height = Math.max(1, Math.round(h * s));
    stage.canvas.style.width = w + 'px'; stage.canvas.style.height = h + 'px';
    gl.viewport(0, 0, stage.canvas.width, stage.canvas.height);
  }
  buildText(); resize();
  log('ready', stage.canvas.width + 'x' + stage.canvas.height, Q.tag);

  let raf, start = performance.now(), frames = 0, fpsT = start;
  function frame() {
    if (contextLost) return;
    gl.uniform2f(uR, stage.canvas.width, stage.canvas.height);
    gl.uniform1f(uT, (performance.now() - start) / 1000);
    gl.uniform1f(uTA, textAspect);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++; const now = performance.now();
    if (now - fpsT >= 5000) { log('~' + Math.round(frames * 1000 / (now - fpsT)) + ' fps @ ' + stage.canvas.width + 'x' + stage.canvas.height + ' (' + Q.tag + ')'); frames = 0; fpsT = now; }
    raf = requestAnimationFrame(frame);
  }
  frame();

  return {
    resize,
    destroy() { cancelAnimationFrame(raf); cap.remove(); if (!contextLost) gl.getExtension('WEBGL_lose_context')?.loseContext(); },
  };
}
