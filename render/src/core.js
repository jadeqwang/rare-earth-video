// GL core: render-target pool, full-screen passes, 2D-canvas layers, blend/blit with 2D transforms.
import * as THREE from 'three';

export const W = 1920, H = 1080, FPS = 24;

const VS = /* glsl */`
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

export class Core {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true,
      powerPreference: 'high-performance', stencil: false, depth: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(W, H, false);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.scene = new THREE.Scene();
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);
    this.rts = new Map();
    this.mats = new Map();
    this.canvases = new Map();
    this.gl = this.renderer.getContext();
  }

  // --- render targets ---------------------------------------------------------------
  rt(name, w = W, h = H, { depth = false, float = true, filter = THREE.LinearFilter, samples = 0 } = {}) {
    const key = `${name}:${w}x${h}`;
    let r = this.rts.get(key);
    if (!r) {
      r = new THREE.WebGLRenderTarget(w, h, { type: float ? THREE.HalfFloatType : THREE.UnsignedByteType,
        format: THREE.RGBAFormat, minFilter: filter, magFilter: filter, depthBuffer: depth, stencilBuffer: false,
        samples, generateMipmaps: false });
      r.texture.colorSpace = THREE.NoColorSpace;
      this.rts.set(key, r);
    }
    return r;
  }

  clear(target, r = 0, g = 0, b = 0, a = 1) {
    this.renderer.setRenderTarget(target);
    this.renderer.setClearColor(new THREE.Color(r, g, b), a);
    this.renderer.clear(true, true, false);
  }

  // --- shader passes ------------------------------------------------------------------
  material(name, fs, uniforms = {}, blending = 'none') {
    let m = this.mats.get(name);
    if (!m) {
      const u = {};
      for (const k in uniforms) u[k] = { value: uniforms[k] };
      m = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, glslVersion: THREE.GLSL3,
        depthTest: false, depthWrite: false, transparent: blending !== 'none' });
      setBlend(m, blending);
      this.mats.set(name, m);
    }
    return m;
  }

  pass(mat, target, uniforms = {}, blending) {
    for (const k in uniforms) {
      if (!mat.uniforms[k]) mat.uniforms[k] = { value: uniforms[k] };
      else mat.uniforms[k].value = uniforms[k];
    }
    if (blending) setBlend(mat, blending);
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.cam);
  }

  // --- 2D canvases (type, vector plates, UI) -----------------------------------------
  canvas(name, w = W, h = H) {
    let c = this.canvases.get(name);
    if (!c) {
      const el = document.createElement('canvas');
      el.width = w; el.height = h;
      const ctx = el.getContext('2d', { alpha: true, willReadFrequently: true });
      const tex = new THREE.CanvasTexture(el);
      tex.colorSpace = THREE.NoColorSpace;
      tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = false;
      tex.premultiplyAlpha = true;
      c = { el, ctx, tex };
      this.canvases.set(name, c);
    }
    c.ctx.setTransform(1, 0, 0, 1, 0, 0);
    c.ctx.globalAlpha = 1; c.ctx.globalCompositeOperation = 'source-over'; c.ctx.filter = 'none';
    c.ctx.clearRect(0, 0, c.el.width, c.el.height);
    return c;
  }

  upload(c) { c.tex.needsUpdate = true; return c.tex; }

  // Composite a texture onto target with a 2D transform (in output pixels) and blend mode.
  // opts: {x,y (center offset px), s (scale), r (rot rad), a (alpha), mode: 'over'|'add'|'screen'|'mult', tint:[r,g,b], premult}
  blit(tex, target, opts = {}) {
    const mat = this.material('blit', BLIT_FS, { tex: null, m: new THREE.Matrix3(), alpha: 1, tint: new THREE.Vector3(1, 1, 1),
      premult: 1, aspect: new THREE.Vector2(1, 1), texAspect: 1, fit: 0, clampEdge: 1 }, 'premult');
    const { x = 0, y = 0, s = 1, sx = 1, sy = 1, r = 0, a = 1, tint = [1, 1, 1], premult = 1, texAspect = W / H, fit = 0,
      clampEdge = 1, mode = 'over' } = opts;
    // inverse transform: output uv -> texture uv (both centred, in output pixel space)
    const c = Math.cos(-r), sn = Math.sin(-r);
    const m3 = new THREE.Matrix3();
    // p_tex = R(-r) * (p_out - t) / s
    const kx = 1 / (s * sx), ky = 1 / (s * sy);
    m3.set(c * kx, -sn * kx, -(c * x - sn * y) * kx,
      sn * ky, c * ky, -(sn * x + c * y) * ky,
      0, 0, 1);
    this.pass(mat, target, { tex, m: m3, alpha: a, tint: new THREE.Vector3(...tint), premult, texAspect, fit, clampEdge,
      aspect: new THREE.Vector2(W, H) }, mode === 'over' ? 'premult' : mode);
  }
}

function setBlend(m, mode) {
  m.transparent = mode !== 'none';
  m.blending = THREE.CustomBlending;
  m.blendEquation = THREE.AddEquation;
  if (mode === 'none') { m.blending = THREE.NoBlending; }
  else if (mode === 'premult') { m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcAlphaFactor; m.blendSrcAlpha = THREE.OneFactor; m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor; }
  else if (mode === 'add') { m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
  else if (mode === 'screen') { m.blendSrc = THREE.OneFactor; m.blendDst = THREE.OneMinusSrcColorFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
  else if (mode === 'mult') { m.blendSrc = THREE.DstColorFactor; m.blendDst = THREE.ZeroFactor; m.blendSrcAlpha = THREE.ZeroFactor; m.blendDstAlpha = THREE.OneFactor; }
  m.needsUpdate = true;
}

const BLIT_FS = /* glsl */`
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D tex;
uniform mat3 m;
uniform float alpha, premult, texAspect, fit, clampEdge;
uniform vec3 tint;
uniform vec2 aspect;
void main() {
  vec2 p = (vUv - 0.5) * aspect;                 // output px, centred
  vec2 q = (m * vec3(p, 1.0)).xy;                // texture px, centred (output-sized frame)
  vec2 frame = aspect;
  if (fit > 0.5) frame = vec2(aspect.y * texAspect, aspect.y);   // keep texture aspect, fit height
  vec2 uv = q / frame + 0.5;
  if (clampEdge > 0.5 && (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0)) { o = vec4(0.0); return; }
  vec4 c = texture(tex, uv);
  if (premult < 0.5) c.rgb *= c.a;
  c.rgb *= tint;
  o = c * alpha;
}`;
