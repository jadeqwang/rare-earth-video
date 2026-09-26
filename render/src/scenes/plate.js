// Traced plates: loads per-frame vector data (pipeline/trace.py) and redraws it as flat cel art on a 2D canvas.
import { clamp, lerp, hex } from '../lib/util.js';

const cache = new Map();     // url -> data
const order = [];
const MAX = 90;

async function getJSON(url) {
  if (cache.has(url)) return cache.get(url);
  const r = await fetch(url);
  if (!r.ok) throw new Error('plate fetch ' + url);
  const d = await r.json();
  cache.set(url, d); order.push(url);
  while (order.length > MAX) cache.delete(order.shift());
  return d;
}

export class Plates {
  constructor(base = '') { this.meta = new Map(); this.base = base; }
  async meta_(pid) {
    if (!this.meta.has(pid)) this.meta.set(pid, await getJSON(`${this.base}assets/plates/${pid}/meta.json`));
    return this.meta.get(pid);
  }
  // plate-local time (s) -> traced frame data (held on twos, clamped to the clip)
  async frame(pid, pt) {
    const m = await this.meta_(pid);
    const fi = clamp(Math.floor(pt * m.fps), 0, m.n - 1);
    let best = m.frames[0];
    for (const f of m.frames) if (f <= fi) best = f;
    const d = await getJSON(`${this.base}assets/plates/${pid}/f${String(best).padStart(4, '0')}.json`);
    return { m, d, fi: best };
  }
}

// ---- colour grading of source colours --------------------------------------------------------
// grade: {mode:'night'|'dawn'|'warm'|'none'|'ramp', mul:[r,g,b], lift:[r,g,b], sat, gamma, ramp:[hex...], over:{label:hex}}
export function gradeColor(rgb, g, label) {
  if (g.over && g.over[label] !== undefined) {
    const o = g.over[label];
    return typeof o === 'string' ? hex(o).map((x) => x * 255) : o;
  }
  let [r, gg, b] = rgb.map((x) => x / 255);
  const L = 0.2126 * r + 0.7152 * gg + 0.0722 * b;
  if (g.mode === 'ramp') {
    const stops = g.ramp.map(hex);
    const x = clamp(Math.pow(L, g.gamma ?? 1)) * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
    const c = stops[i].map((v, k) => lerp(v, stops[i + 1][k], f));
    return c.map((v) => v * 255);
  }
  const sat = g.sat ?? 1;
  r = lerp(L, r, sat); gg = lerp(L, gg, sat); b = lerp(L, b, sat);
  const mul = g.mul || [1, 1, 1], lift = g.lift || [0, 0, 0], gam = g.gamma ?? 1;
  const f = (v, k) => clamp(Math.pow(clamp(v * mul[k] + lift[k] * (1 - v)), 1 / gam)) * 255;
  return [f(r, 0), f(gg, 1), f(b, 2)];
}

export const GRADES = {
  none: { mode: 'none' },
  night: { mul: [0.62, 0.72, 1.0], lift: [0.03, 0.045, 0.11], sat: 0.85, gamma: 0.95 },
  nightDeep: { mul: [0.45, 0.55, 0.9], lift: [0.02, 0.03, 0.09], sat: 0.8, gamma: 0.9 },
  lamp: { mul: [1.0, 0.9, 0.78], lift: [0.03, 0.02, 0.06], sat: 1.0, gamma: 1.0 },
  dawn: { mul: [1.05, 0.88, 0.72], lift: [0.06, 0.03, 0.05], sat: 0.95, gamma: 1.05 },
  screen: { mul: [0.7, 0.88, 1.05], lift: [0.02, 0.05, 0.1], sat: 0.8, gamma: 1.0 },
  insta2011: { mul: [1.02, 0.92, 0.78], lift: [0.12, 0.08, 0.06], sat: 0.7, gamma: 1.12 },
  signal: { mode: 'ramp', ramp: ['#05070f', '#3a2a10', '#ffcf5a', '#fff4d6'], gamma: 0.9 },
  bluedot: { mode: 'ramp', ramp: ['#050814', '#16306a', '#8ecbff', '#f4f8ff'], gamma: 0.95 },
};

// ---- drawing --------------------------------------------------------------------------------------
function ring(p, pts, s, ox, oy) {
  const n = pts.length >> 1;
  if (n < 3) return;
  const X = (i) => pts[(i % n) * 2] * s + ox, Y = (i) => pts[(i % n) * 2 + 1] * s + oy;
  p.moveTo((X(0) + X(1)) / 2, (Y(0) + Y(1)) / 2);
  for (let i = 1; i <= n; i++) p.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
  p.closePath();
}

function polyArea(pts) {
  let a = 0; const n = pts.length >> 1;
  for (let i = 0, j = n - 1; i < n; j = i++) a += (pts[j * 2] + pts[i * 2]) * (pts[j * 2 + 1] - pts[i * 2 + 1]);
  return a / 2;
}

// Draw one traced frame into ctx. place: {x, y, s} maps trace-grid px -> canvas px (x,y = top-left)
// o: {grade, ink:'#hex', inkAlpha, lineScale (unused), fillStroke, alpha, hide:[labels], only:[labels], jitter}
export function drawTraced(ctx, frame, place, o = {}) {
  const { d, m } = frame;
  const s = place.s, ox = place.x, oy = place.y;
  const grade = o.grade || GRADES.night;
  const cols = m.colors.map((c, i) => gradeColor(c, grade, i));
  ctx.save();
  ctx.globalAlpha = o.alpha ?? 1;
  // dark base under the mosaic so pinholes between regions never show what is behind the plate
  if (o.base !== false) {
    ctx.fillStyle = o.baseCol || o.ink || '#0d1026';
    if ((d.key || []).length) { const bp = new Path2D(); for (const g of d.key) for (const r of g) ring(bp, r, s, ox, oy); ctx.fill(bp, 'evenodd'); }
    else ctx.fillRect(ox, oy, m.w * s, m.h * s);
  }
  // group regions by label for fewer fills
  const byL = new Map();
  for (const rg of d.regions) {
    const L = rg[0];
    if (o.hide && o.hide.includes(L)) continue;
    if (o.only && !o.only.includes(L)) continue;
    if (!byL.has(L)) byL.set(L, new Path2D());
    const p = byL.get(L);
    for (let k = 1; k < rg.length; k++) ring(p, rg[k], s, ox, oy);
  }
  const seam = o.fillStroke ?? Math.max(0.8, s * 1.1);
  for (const [L, p] of byL) {
    const c = cols[L];
    const css = `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
    ctx.fillStyle = css; ctx.strokeStyle = css; ctx.lineWidth = seam; ctx.lineJoin = 'round';
    ctx.fill(p, 'evenodd');
    ctx.stroke(p);
  }
  if ((o.inkAlpha ?? 1) > 0 && d.lines.length) {
    const lp = new Path2D();
    // drop ink specks (tiny closed blobs from plate grain) - they read as dirt, not drawing
    const minInk = o.minInk ?? 45;
    if (!d._inkArea) d._inkArea = d.lines.map((g) => Math.abs(polyArea(g[0])));
    d.lines.forEach((g, gi) => { if (d._inkArea[gi] < minInk) return; for (const r of g) ring(lp, r, s, ox, oy); });
    ctx.globalAlpha = (o.alpha ?? 1) * (o.inkAlpha ?? 1);
    ctx.fillStyle = o.ink || '#0d1026';
    ctx.fill(lp, 'evenodd');
  }
  ctx.restore();
}

// Silhouette path of the keyed foreground (for masks, rim light, occlusion)
export function silhouette(frame, place) {
  const p = new Path2D();
  for (const g of frame.d.key || []) for (const r of g) ring(p, r, place.s, place.x, place.y);
  return p;
}

// Fit a plate into the output frame: mode 'cover' | 'contain' | {cx, cy, h} (h = displayed height in px)
export function placeFor(m, how = 'cover', W = 1920, H = 1080) {
  const pw = m.w, ph = m.h;
  if (how === 'cover') { const s = Math.max(W / pw, H / ph); return { s, x: (W - pw * s) / 2, y: (H - ph * s) / 2 }; }
  if (how === 'contain') { const s = Math.min(W / pw, H / ph); return { s, x: (W - pw * s) / 2, y: (H - ph * s) / 2 }; }
  const s = how.h / ph;
  return { s, x: how.cx - (pw * s) / 2, y: how.cy - (ph * s) / 2 };
}
