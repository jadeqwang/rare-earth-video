// Frame engine. `RENDER.frame(n)` draws frame n of the film deterministically:
//   1. find the active shot in the EDL,
//   2. let its scene draw into the GL scene target + the 2D overlay canvas,
//   3. composite with bloom and the global FX pass onto the output canvas.

import { GL } from './gl.js';
import { Materials } from './materials.js';
import { Timing } from './timing.js';
import { clamp, lerp, hex } from './util.js';
import { buildEDL } from './edl.js';
let EDL = [];
import { SCENES } from './scenes/index.js';

const params = new URLSearchParams(location.search);
const W = +(params.get('w') || 1920), H = +(params.get('h') || 1080);
const FPS = 24;

const BRIGHT = `
uniform sampler2D src; uniform float thresh;
void main(){ vec3 c = texture(src, uv).rgb; float l = max(c.r, max(c.g, c.b));
  o = vec4(c * smoothstep(thresh, thresh + 0.35, l), 1.0); }`;
const DOWN = `
uniform sampler2D src;
void main(){ vec2 px = 1.0 / vec2(textureSize(src, 0));
  vec3 s = texture(src, uv + px * vec2(-1,-1)).rgb + texture(src, uv + px * vec2(1,-1)).rgb
         + texture(src, uv + px * vec2(-1, 1)).rgb + texture(src, uv + px * vec2(1, 1)).rgb;
  o = vec4(s * 0.25, 1.0); }`;
const BLUR = `
uniform sampler2D src; uniform vec2 dir; uniform float sigma;
void main(){ vec2 px = dir / vec2(textureSize(src, 0)); vec4 s = vec4(0); float w = 0.0;
  int R = min(10, int(ceil(sigma * 3.0)));
  for (int i = -R; i <= R; i++){ float fi = float(i); float k = exp(-fi*fi/(2.0*sigma*sigma)); s += texture(src, uv + px*fi) * k; w += k; }
  o = s / w; }`;
const COMP = `
uniform sampler2D scene; uniform sampler2D over; uniform sampler2D bloom1; uniform sampler2D bloom2;
uniform float bloomAmt; uniform float flash; uniform vec3 flashCol; uniform float invert; uniform float aberr;
uniform float grain; uniform float vignette; uniform float frame; uniform float overAdd; uniform float fade; uniform float letterbox;
uniform float overMul; uniform float bump;
void main(){
  vec2 d = uv - 0.5;
  // beat bump: the picture (not the type) punches in on kicks
  vec2 su = 0.5 + d / (1.0 + bump);
  vec3 col;
  if (aberr > 0.0) {
    vec2 off = d * aberr * 0.012;
    col = vec3(texture(scene, su + off).r, texture(scene, su).g, texture(scene, su - off).b);
  } else col = texture(scene, su).rgb;
  col += (texture(bloom1, su).rgb * 0.6 + texture(bloom2, su).rgb * 0.9) * bloomAmt;
  vec4 ov = texture(over, vec2(uv.x, uv.y));
  col = mix(col, ov.rgb * overMul, ov.a * (1.0 - overAdd)) + ov.rgb * ov.a * overAdd;
  col = mix(col, 1.0 - clamp(col, 0.0, 1.0), invert);
  col = mix(col, flashCol, flash);
  float v = smoothstep(0.95, 0.25, length(d * vec2(1.0, 0.85)));
  col *= mix(1.0, v, vignette);
  // film grain, refreshed on twos (per-frame noise costs the encoder more than it adds)
  float n = hash21(uv * res + floor(frame / 2.0) * 17.13) - 0.5;
  col += n * grain;
  col *= (1.0 - fade);
  float lb = step(abs(d.y), 0.5 - letterbox);
  col *= lb;
  // soft shoulder
  col = col / (1.0 + max(col - 1.0, 0.0));
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

// Kick-driven punch-in, by section (song seconds, amount). Quiet passages stay still.
const BUMPS = [
  [57.9, 64.45, 0.014],   // V3: launches, alerts
  [65.4, 80.4, 0.008],    // V3 turn
  [133.5, 146.0, 0.012],  // V5 montages
  [147.006, 162.2, 0.02], // the drop
];
function bumpAt(t) {
  for (const [a, b, k] of BUMPS) if (t >= a && t < b) return k;
  return 0;
}

class Engine {
  async init() {
    this.canvas = document.getElementById('out');
    this.canvas.width = W; this.canvas.height = H;
    this.g = new GL(this.canvas);
    this.mat = new Materials(this.g);
    this.W = W; this.H = H; this.S = H / 1080; // layout scale
    this.tim = new Timing(await (await fetch('assets/timing.json')).json());
    EDL = buildEDL(this.tim);
    this.ovCanvas = document.createElement('canvas');
    this.ovCanvas.width = W; this.ovCanvas.height = H;
    this.o2d = this.ovCanvas.getContext('2d');
    this.ovTex = this.g.texture(W, H);
    this.sceneA = this.g.target(W, H);
    this.sceneB = this.g.target(W, H);
    this.tmp = this.g.target(W, H);
    this.b1 = this.g.target(W >> 2, H >> 2); this.b1b = this.g.target(W >> 2, H >> 2);
    this.b2 = this.g.target(W >> 3, H >> 3); this.b2b = this.g.target(W >> 3, H >> 3);
    this.pBright = this.g.program('bright', BRIGHT);
    this.pDown = this.g.program('down', DOWN);
    this.pBlur = this.g.program('blurc', BLUR);
    this.pComp = this.g.program('comp', COMP);
    this.cache = new Map();
    this.plateMeta = {};
    try { this.plateMeta = await (await fetch('assets/plates/index.json')).json(); } catch (e) { /* no plates yet */ }
    this.dataCache = new Map();
    const fams = ['900 100px Archivo', 'italic 400 100px "Instrument Serif"', '400 100px "Instrument Serif"', '500 100px "JetBrains Mono"', '800 100px "JetBrains Mono"', 'italic 900 100px Archivo'];
    await Promise.all(fams.map((f) => document.fonts.load(f)));
    for (const s of Object.values(SCENES)) if (s.init) await s.init(this);
    return { W, H, frames: this.tim.d.frames, fps: FPS };
  }

  // ---- assets -------------------------------------------------------------
  async image(url) {
    if (this.cache.has(url)) return this.cache.get(url);
    const p = (async () => {
      const r = await fetch(url);
      if (!r.ok) throw new Error('missing ' + url);
      return await createImageBitmap(await r.blob(), { imageOrientation: 'flipY' });
    })();
    this.cache.set(url, p);
    if (this.cache.size > 400) { const k = this.cache.keys().next().value; this.cache.delete(k); }
    return p;
  }
  // Plate frame at plate-local time pt (seconds). `twos` holds each drawing for 2 frames.
  plateFrameIndex(id, pt, twos = true) {
    const meta = this.plateMeta[id];
    if (!meta) return null;
    let i = Math.floor(pt * FPS + 1e-6);
    if (twos) i -= i % 2;
    return clamp(i, 0, meta.frames - 1);
  }
  async plate(id, pt, twos = true) {
    const i = this.plateFrameIndex(id, pt, twos);
    if (i === null) return null;
    return this.image(`assets/plates/${id}/f${String(i).padStart(5, '0')}.jpg`);
  }
  async plateMask(id, pt, twos = true) {
    const meta = this.plateMeta[id];
    if (!meta || !meta.mask) return null;
    const i = this.plateFrameIndex(id, pt, twos);
    return this.image(`assets/plates/${id}/m${String(i).padStart(5, '0')}.png`).catch(() => null);
  }
  async plateData(id) {
    if (!this.dataCache.has(id)) this.dataCache.set(id, fetch(`assets/plates/${id}/data.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null));
    return this.dataCache.get(id);
  }

  // ---- frame --------------------------------------------------------------
  shotAt(t) {
    let s = null;
    for (const sh of EDL) if (t >= sh.t0 && t < sh.t1) s = sh;
    return s || EDL[EDL.length - 1];
  }

  makeCtx(shot, t, n, target) {
    const lt = t - shot.t0, dur = shot.t1 - shot.t0;
    return {
      e: this, g: this.g, mat: this.mat, tim: this.tim, o: this.o2d, W, H, S: this.S,
      t, lt, dur, u: clamp(lt / dur), n, shot, p: shot.p || {}, out: target,
      fx: { bloom: 0.55, flash: 0, flashCol: [1, 0.965, 0.91], invert: 0, aberr: 0, grain: 0.022, vignette: 0.35, overAdd: 0, fade: 0, letterbox: 0, thresh: 0.62, overMul: 1,
        bump: (shot.p?.bump ?? bumpAt(t)) * this.tim.kickPulse(t, 0.11) },
    };
  }

  async drawShot(shot, t, n, target) {
    const ctx = this.makeCtx(shot, t, n, target);
    const scene = SCENES[shot.scene];
    if (!scene) throw new Error('unknown scene ' + shot.scene);
    await scene.render(ctx, ctx.p);
    return ctx;
  }

  async frame(n) {
    const t = n / FPS;
    const shot = this.shotAt(t);
    const o = this.o2d;
    o.setTransform(1, 0, 0, 1, 0, 0);
    o.clearRect(0, 0, W, H);
    const ctx = await this.drawShot(shot, t, n, this.sceneA);
    // global layers (lyrics captions, stamps) drawn after the scene
    if (SCENES.__global) await SCENES.__global.render(ctx, {});
    this.composite(ctx);
    return shot.id;
  }

  composite(ctx) {
    const g = this.g, fx = ctx.fx;
    g.upload(this.ovTex, this.ovCanvas, true);
    // bloom chain
    g.pass(this.pBright, this.tmp, { src: this.sceneA }, { thresh: fx.thresh });
    g.pass(this.pDown, this.b1, { src: this.tmp });
    g.pass(this.pBlur, this.b1b, { src: this.b1 }, { dir: [1, 0], sigma: 3 });
    g.pass(this.pBlur, this.b1, { src: this.b1b }, { dir: [0, 1], sigma: 3 });
    g.pass(this.pDown, this.b2, { src: this.b1 });
    g.pass(this.pBlur, this.b2b, { src: this.b2 }, { dir: [1, 0], sigma: 5 });
    g.pass(this.pBlur, this.b2, { src: this.b2b }, { dir: [0, 1], sigma: 5 });
    g.pass(this.pComp, null, { scene: this.sceneA, over: this.ovTex, bloom1: this.b1, bloom2: this.b2 }, {
      bloomAmt: fx.bloom, flash: fx.flash, flashCol: fx.flashCol, invert: fx.invert, aberr: fx.aberr, grain: fx.grain,
      vignette: fx.vignette, frame: ctx.n, overAdd: fx.overAdd, fade: fx.fade, letterbox: fx.letterbox, overMul: fx.overMul, bump: fx.bump,
    });
    g.gl.finish();
  }
}

const engine = new Engine();
window.RENDER = {
  init: () => engine.init(),
  frame: (n) => engine.frame(n),
  shots: () => EDL.map((s) => ({ id: s.id, t0: s.t0, t1: s.t1, scene: s.scene })),
  engine,
};
window.dispatchEvent(new Event('render-ready'));
