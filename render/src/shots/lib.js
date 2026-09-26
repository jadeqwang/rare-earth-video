// Shot-building toolkit: layers (sky, traced plates with rim light, 2D type/fx), cameras, plate timing.
import * as THREE from 'three';
import { W, H } from '../core.js';
import { Plates, drawTraced, placeFor, GRADES, silhouette } from '../scenes/plate.js';
import { clamp, lerp, hash, rng, easeInOutCubic, easeOutCubic } from '../lib/util.js';

export const plates = new Plates('');

// Chosen takes: which traced plate id to use and its audio alignment (a0 = song time of plate frame 0; lag in frames).
// Filled from pipeline/syncscore.py results; lag>0 means the take's mouth is late -> advance plate time.
export const TAKES = {
  P01_rim: { a0: null }, P02_care: { a0: 3.35, L: -0.021, take: 't3' }, P03_there: { a0: 11.3, L: -0.083, take: 't1' }, P04_eye: { a0: null },
  P05_guitar: { a0: 19.1, L: 0.271, take: 't2' }, P06_rehearsal: { a0: null }, P07_rooftop: { a0: null }, P08_notebook: { a0: null },
  P09_catch: { a0: 22.6, L: -0.229, take: 't5' }, P10_alone: { a0: 37.9, L: 0.458, take: 't1' }, P11_gig: { a0: null }, P12_charlie: { a0: null },
  P13_ricky: { a0: null }, P14_pad: { a0: null }, P15_dawn: { a0: 65.1, L: 0.083, take: 't5' }, P16_launch: { a0: null }, P17_crowd: { a0: null },
  P18_jade26: { a0: 87.2, L: -0.104, take: 't0' }, P20_room26: { a0: null }, P21_v5cu: { a0: 125.8, L: -0.458, take: 't1' }, P22_cheer: { a0: null },
  P23_rim26: { a0: 143.6, L: 0, take: 't4' }, P24_group: { a0: null }, P25_oh: { a0: 152.5, L: 0, take: 't5' },
};
// renderer semantics (matches pipeline/syncscore.py lag_curve): plate time = t - a0 + L
export function syncedPT(pid, t) { const k = TAKES[pid]; return (t - k.a0) + (k.L || 0); }

// ---------------------------------------------------------------------------------------------------
const RIM_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D src; uniform vec2 dir; uniform float width; uniform vec3 col; uniform vec2 res; uniform float amt;
void main(){
  float a = texture(src, vUv).a;
  if (a < 0.5) { o = vec4(0.0); return; }
  vec2 d = normalize(dir) / res;
  float edge = 0.0;
  for (int i = 1; i <= 6; i++) { float s = texture(src, vUv + d * width * float(i) / 6.0).a; edge = max(edge, (1.0 - s) * (1.0 - float(i - 1) / 7.0)); }
  float e2 = 1.0 - texture(src, vUv + d * width * 0.35).a;
  float r = max(edge * 0.75, e2);
  o = vec4(col * r * amt, 0.0);
}`;

// Draw a traced plate as a layer onto target.
// o: {pid, pt, place:'cover'|'contain'|{cx,cy,h}, grade, ink, cam:{s,x,y,r}, rim:{dir:[x,y],col:[r,g,b],w,amt}, alpha, layerName, pre(g), post(g)}
export async function plateLayer(ctx, target, o) {
  const fr = await plates.frame(o.pid, Math.max(0, o.pt));
  const c = ctx.core.canvas(o.layerName || 'plate');
  const place = typeof o.place === 'object' || o.place === 'cover' || o.place === 'contain' ? placeFor(fr.m, o.place || 'cover') : placeFor(fr.m, 'cover');
  if (o.pre) o.pre(c.ctx, fr, place);
  drawTraced(c.ctx, fr, place, { grade: typeof o.grade === 'string' ? GRADES[o.grade] : (o.grade || GRADES.night), ink: o.ink, inkAlpha: o.inkAlpha, hide: o.hide, only: o.only });
  if (o.post) o.post(c.ctx, fr, place);
  const tex = ctx.core.upload(c);
  const cam = o.cam || {};
  const blit = { x: cam.x || 0, y: cam.y || 0, s: cam.s || 1, r: cam.r || 0, a: o.alpha ?? 1 };
  ctx.core.blit(tex, target, blit);
  if (o.rim) {
    // rim from the clean keyed silhouette (not the region mosaic, whose tiny gaps would sparkle)
    const mc = ctx.core.canvas('rimmask');
    const sil = silhouette(fr, place);
    mc.ctx.fillStyle = '#fff';
    if ((fr.d.key || []).length) mc.ctx.fill(sil, 'evenodd'); else { mc.ctx.fillRect(0, 0, W, H); }
    const mtex = ctx.core.upload(mc);
    const tmp = ctx.core.rt('rimtmp', W, H);
    ctx.core.clear(tmp, 0, 0, 0, 0);
    ctx.core.blit(mtex, tmp, { ...blit, a: 1 });
    const m = ctx.core.material('rim', RIM_FS, { src: null, dir: new THREE.Vector2(), width: 6, col: new THREE.Vector3(), res: new THREE.Vector2(W, H), amt: 1 }, 'add');
    ctx.core.pass(m, target, { src: tmp.texture, dir: new THREE.Vector2(...(o.rim.dir || [-0.7, 0.7])), width: o.rim.w || 7,
      col: new THREE.Vector3(...(o.rim.col || [0.6, 0.8, 1.0])), amt: (o.rim.amt ?? 1) * (o.alpha ?? 1) });
  }
  return { fr, place };
}

export function layer2D(ctx, target, name, draw, blit = {}) {
  const c = ctx.core.canvas(name);
  draw(c.ctx, c);
  ctx.core.blit(ctx.core.upload(c), target, blit);
  return c;
}

export function sky(ctx, target, o) { ctx.sky.render(target, { time: ctx.t, ...o }); }

// beacon brightness: blinks (dims) on each kick of the song = "the beating blinking of a star"
export function beacon(ctx, t, depth = 0.8, tau = 0.09) { return 1 - depth * ctx.tl.kick(t, tau); }

// Word items for lyric line i (display words mapped onto sung onsets)
export function words(ctx, i, { upper = true, map = null } = {}) {
  const l = ctx.tl.line(i);
  const disp = l.text.replace('██████', '').trim().split(/\s+/);
  const sung = l.words;
  return disp.map((w, k) => {
    const s = sung[map ? map[k] : Math.min(k, sung.length - 1)];
    return { text: upper ? w.toUpperCase() : w, t0: s.t0, t1: s.t1 };
  });
}

// 2.5D camera helpers
export function push(p, s0 = 1, s1 = 1.08, ease = easeInOutCubic) { return lerp(s0, s1, ease(clamp(p))); }
export function shake(t, amt, seed = 1) { const f = Math.floor(t * 24); return { x: (hash(f * 1.31 + seed) - 0.5) * 2 * amt, y: (hash(f * 2.71 + seed * 3) - 0.5) * 2 * amt }; }

// receiver/beacon glow blobs on an fx canvas (additive)
export function glow(g, x, y, r, col = [255, 210, 120], a = 1) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.95 * a})`);
  gr.addColorStop(0.18, `rgba(${col[0]},${col[1]},${col[2]},${0.4 * a})`);
  gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
  g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
}

// converging rings: signal arriving INTO a point (never outgoing)
export function incoming(g, x, y, t, { r0 = 160, n = 3, period = 0.9, col = '255,215,130', w = 2, a = 0.9 } = {}) {
  for (let i = 0; i < n; i++) {
    const ph = ((t / period + i / n) % 1);
    const r = r0 * (1 - ph);
    const al = a * Math.sin(ph * Math.PI) * 0.9;
    g.strokeStyle = `rgba(${col},${al})`; g.lineWidth = w * (0.5 + ph);
    g.beginPath(); g.arc(x, y, Math.max(1, r), 0, Math.PI * 2); g.stroke();
  }
}

// restrict 3D/2D passes into target to a screen rect [x, y, w, h] (top-left px); null to reset
export function scissor(target, r) {
  if (!r) { target.scissorTest = false; target.scissor.set(0, 0, W, H); return; }
  target.scissor.set(r[0], H - r[1] - r[3], r[2], r[3]); target.scissorTest = true;
}

// soft layer: drawn on a small canvas in full-res coordinates, upscaled on blit (cheap natural defocus)
export function softLayer(ctx, target, name, div, draw, blit = {}) {
  const c = ctx.core.canvas(name, Math.round(W / div), Math.round(H / div));
  c.ctx.setTransform(1 / div, 0, 0, 1 / div, 0, 0);
  draw(c.ctx, c);
  ctx.core.blit(ctx.core.upload(c), target, blit);
  return c;
}

// long-exposure star trails as arcs about a (screen-space) celestial pole
export function starTrails(g, t, { pole = [260, -160], n = 2200, len = 0.2, spin = 0.02, seed = 5, alpha = 1, rMax = 2600 } = {}) {
  const R = rng(seed);
  g.save(); g.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const r = 60 + Math.pow(R(), 0.75) * rMax, a0 = R() * Math.PI * 2, b = Math.pow(R(), 3);
    const c = R() < 0.14 ? '255,214,160' : (R() < 0.5 ? '190,215,255' : '235,240,255');
    const a = a0 + t * spin;
    g.strokeStyle = `rgba(${c},${(0.12 + 0.88 * b) * alpha})`;
    g.lineWidth = 0.7 + b * 2.0;
    g.beginPath(); g.arc(pole[0], pole[1], r, a, a + len + 0.002); g.stroke();
  }
  g.restore();
}

// many far-off "lighthouses": gold points that switch on over time and blink with the kicks (different phases)
export function lighthouses(ctx, g, t, { n = 60, seed = 3, on = 1, rect = [0, 0, W, H], size = 16, depth = 0.7 } = {}) {
  const R = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = rect[0] + R() * rect[2], y = rect[1] + R() * rect[3], th = R(), ph = R(), sz = size * (0.5 + R());
    if (th > on) continue;
    const fadeIn = clamp((on - th) * 12);
    const blink = 1 - depth * ctx.tl.kick(t + ph * 0.25, 0.1);
    glow(g, x, y, sz * 2.4, [255, 200, 110], 0.55 * fadeIn * blink);
    glow(g, x, y, sz * 0.7, [255, 240, 200], 0.9 * fadeIn * blink);
  }
}

export { W, H, clamp, lerp };
