// ACT II (17.69 - 42.63): "Lived my life on a pale blue dot ... how could we be alone"
import { plateLayer, layer2D, sky, beacon, words, push, glow, incoming, syncedPT, plates, W, H } from './lib.js';
import { drawTraced, placeFor, GRADES } from '../scenes/plate.js';
import { Planet, makeEarthTextures, makeOtherTextures } from '../scenes/planet.js';
import { Beacon, Orrery, paleBlueDot } from '../scenes/cosmos.js';
import { waterfall, lightCurve, panelFrame } from '../scenes/data.js';
import { clamp, lerp, smooth, easeOutCubic, easeInOutCubic, easeOutExpo, easeInExpo } from '../lib/util.js';
import { shared } from './act1.js';

let BEACON = null, ORR = null, OTHER = null;
export async function initAct2(ctx) {
  if (!BEACON) BEACON = new Beacon();
  if (!ORR) ORR = new Orrery(520);
  if (!OTHER) OTHER = new Planet(await makeOtherTextures(), { rim: '#ff9a6a', nightTint: '#1a1030', term: '#ffcf5a', lightsAmt: 2.2, cloudAmt: 0.28 });
}
export const shared2 = { get beacon() { return BEACON; }, get other() { return OTHER; }, get orr() { return ORR; } };

// kick times inside a window -> transit dip times (the beacon blinks on the song's kicks)
const kicksIn = (ctx, a, b) => ctx.tl.kicks.filter((k) => k >= a && k <= b);

// ---------------------------------------------------------------------------------------------------
const B1 = {
  id: 'B1_pbd', t0: 17.69, t1: 19.55,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    layer2D(ctx, s.target, 'bg', (g) => {
      paleBlueDot(g, t, { dot: [1186, 612], zoom: lerp(1.0, 1.12, easeInOutCubic(k)) });
      g.strokeStyle = `rgba(142,203,255,${0.75 * smooth(0.2, 0.7, k)})`; g.lineWidth = 1.5;
      g.beginPath(); g.arc(1186, 612, 26, 0, 7); g.stroke();
      g.beginPath(); g.moveTo(1212, 612); g.lineTo(1330, 560); g.stroke();
      T.label(g, 'THAT’S HERE.', 1340, 556, { size: 18, color: '#8ecbff', alpha: smooth(0.3, 0.8, k) });
      T.label(g, 'VOYAGER 1  ·  6,000,000,000 KM  ·  14 FEB 1990', 120, 1010, { size: 15, color: '#8ecbff', alpha: 0.7 });
    });
    return { bloom: 0.35, thresh: 0.8, grain: 0.06 };
  },
};

// ---------------------------------------------------------------------------------------------------
// 2011 life montage: square "early phone photo" frames, one per two beats
function squareFrame(ctx, g, fr, { cx, cy, size, rot = 0, grade = 'insta2011', border = 26, pt = 0 }) {
  g.save();
  g.translate(cx, cy); g.rotate(rot);
  g.fillStyle = '#f3efe6'; g.fillRect(-size / 2 - border, -size / 2 - border, size + border * 2, size + border * 2 + border * 2.2);
  g.beginPath(); g.rect(-size / 2, -size / 2, size, size); g.clip();
  const s = size / Math.min(fr.m.w, fr.m.h);
  drawTraced(g, fr, { s, x: -fr.m.w * s / 2, y: -fr.m.h * s / 2 }, { grade: GRADES[grade] });
  // lomo vignette
  const v = g.createRadialGradient(0, 0, size * 0.25, 0, 0, size * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,10,0,0.55)');
  g.fillStyle = v; g.fillRect(-size / 2, -size / 2, size, size);
  g.restore();
}

const B2 = {
  id: 'B2_life', t0: 19.55, t1: 23.10,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const b = (i) => ctx.tl.bar(10) + i * (ctx.tl.bar(11) - ctx.tl.bar(10)) / 4;   // beats of bar 10..
    const slots = [
      { pid: 'P05_guitar', t0: 19.55, pt: syncedPT('P05_guitar', t), rot: -0.04 },
      { pid: 'P06_rehearsal', t0: b(2), pt: 0.5 + (t - b(2)) },
      { pid: 'P07_rooftop', t0: b(4), pt: 1.6 + (t - b(4)) * 1.1, rot: 0.03 },
      { pid: 'P08_notebook', t0: b(6), pt: 0.8 + (t - b(6)) },
    ];
    let cur = slots[0];
    for (const sl of slots) if (t >= sl.t0) cur = sl;
    const fr = await plates.frame(cur.pid, Math.max(0, cur.pt));
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#0a0d1c'; g.fillRect(0, 0, W, H);
      // previous frames stacked behind (feed)
      const since = t - cur.t0;
      const pop = easeOutExpo(clamp(since / 0.22));
      squareFrame(ctx, g, fr, { cx: 1260, cy: 520 + (1 - pop) * 40, size: 760, rot: (cur.rot || 0) * pop });
      T.label(g, '2011', 1640, 1000, { size: 22, color: '#ffcf5a' });
      T.label(g, '♥ 11   ·   #rna #rehearsal #pale_blue_dot', 900, 1000, { size: 16, color: '#f4f1e8', alpha: 0.6 });
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 5, { upper: false });
      const rows = [[w[0], w[1], w[2]], [w[3], w[4]], [w[5], w[6], w[7]]];
      let y = 330;
      rows.forEach((row, ri) => {
        let x = 110;
        row.forEach((wd) => {
          const on = t >= wd.t0;
          const pale = ri === 2;
          const f = pale ? 'ital' : 'hero', size = pale ? 118 : 110;
          const txt = pale ? wd.text : wd.text.toUpperCase();
          const m = T.measure(g, f, size, txt).w * (pale ? 1 : 0.8);
          T.text(g, txt, x, y, { f, size, sx: pale ? 1 : 0.8, color: pale ? '#8ecbff' : '#f4f1e8', alpha: on ? 1 : 0.18 });
          x += m + size * 0.22;
        });
        y += 140;
      });
    });
    return { bloom: 0.4, thresh: 0.9, grain: 0.05 };
  },
};

// ---------------------------------------------------------------------------------------------------
const B3 = {
  id: 'B3_catch', t0: 23.10, t1: 26.60,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    // screen content first (the plate's monitor is keyed, so this shows through it)
    layer2D(ctx, s.target, 'screen', (g) => {
      g.fillStyle = '#02040a'; g.fillRect(0, 0, W, H);
      const lineOn = t > 24.44;
      waterfall(g, { x: 40, y: 40, w: 760, h: 720, t, cols: 120, rows: 100, line: { on: lineOn, f0: 0.62, drift: -0.08, snr: smooth(24.44, 25.6, t) * 1.2 } });
      if (lineOn) { g.fillStyle = '#ffcf5a'; g.font = '700 22px JBM'; g.fillText('CANDIDATE  ·  NARROWBAND  ·  DRIFT −0.33 Hz/s', 60, 820); }
    });
    await plateLayer(ctx, s.target, { pid: 'P09_catch', pt: syncedPT('P09_catch', t), place: 'cover', grade: 'screen',
      cam: { s: push(k, 1.02, 1.08), x: -30 * k } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 6);
      const A = T.slamAnim(t, w[0].t0), B = T.slamAnim(t, w[1].t0);
      if (A) T.text(g, 'YOUR', 1860, 150, { f: 'hero', size: 130, sx: 0.8, alpha: A.a, align: 'right' });
      if (B) T.text(g, 'SIGNAL', 1860, 300, { f: 'hero', size: 170, sx: 0.8, alpha: B.a, color: '#ffcf5a', glow: B.hot * 30, align: 'right' });
      g.fillStyle = 'rgba(4,6,16,0.55)'; g.fillRect(0, 975, W, 105);
      T.karaoke(g, [w[2], w[3], w[4], w[5], w[6]].map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 960, y: 1045, f: 'ital', size: 60, dim: 0.25, align: 'center' });
    });
    return { bloom: 0.55, thresh: 0.85 };
  },
};

// ---------------------------------------------------------------------------------------------------
const B4 = {
  id: 'B4_beating', t0: 26.60, t1: 30.38,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 1.3, pitch: 0.1, fov: 40, beacon: 0, horizonY: -2, starAmt: 0.7 });
    const kick = ctx.tl.kick(t, 0.09);
    // the ring advances so a shade crosses the disk on every beat
    const bp = ctx.tl.beatPhase(t);
    const phase = (bp.i + easeInOutCubic(bp.ph)) / 8;
    const st = BEACON.render(ctx.core, s.target, { t, camPos: [0, 0.2, lerp(6.4, 5.6, k)], look: [0, 0.05, 0], fov: 30, phase, R: 1.55, bright: 0.95 - 0.4 * kick });
    layer2D(ctx, s.target, 'fx', (g) => {
      glow(g, st.x, st.y, st.r * 2.6, [255, 120, 60], 0.55 * (1 - 0.6 * kick));
      glow(g, st.x, st.y, st.r * 1.5, [255, 170, 90], 0.35);
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      lightCurve(g, { x: 120, y: 860, w: 1680, h: 150, t, t0: 26.6, span: 3.9, dips: kicksIn(ctx, 26.6, 30.6), depth: 0.3, width: 0.06, label: 'LGM-2   ·   RELATIVE FLUX' });
      const w = words(ctx, 7);
      const beatOn = (t - w[1].t0);
      if (t > w[1].t0) T.text(g, 'BEATING', 110, 356, { f: 'six', size: 330, color: '#f4f1e8', alpha: t < w[2].t0 ? 1 : 0.22 });
      if (t > w[2].t0) T.text(g, 'BLINKING', 1810, 356, { f: 'six', size: 330, align: 'right', color: '#ffcf5a', alpha: 1 - 0.8 * kick * 0 });
      if (t > w[3].t0) T.text(g, 'of a star', 960, 780, { f: 'ital', size: 96, align: 'center', color: '#f4f1e8', alpha: clamp((t - w[3].t0) / 0.2) });
    });
    return { bloom: 0.75, thresh: 0.8, halation: 0.35 };
  },
};

// ---------------------------------------------------------------------------------------------------
const B5 = {
  id: 'B5_transit', t0: 30.38, t1: 33.53,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 1.3, pitch: 0.1, fov: 40, beacon: 0, horizonY: -2, starAmt: 0.6 });
    const u = easeInOutCubic(clamp((t - 30.9) / 2.4));
    const st = BEACON.render(ctx.core, s.target, { t, camPos: [0, 0, 6.2], look: [0, 0, 0], fov: 30, phase: 0.03, R: 3.2, shades: false,
      planetU: lerp(0.05, 0.95, u), planetY: -0.12, planetR: 1.1, bright: 0.95 });
    layer2D(ctx, s.target, 'fx', (g) => { glow(g, st.x, st.y, st.r * 2.6, [255, 120, 60], 0.5); }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      lightCurve(g, { x: 120, y: 880, w: 1680, h: 130, t, t0: 30.38, span: 3.3, dips: [32.1], depth: 0.2, width: 0.9, color: '#8ecbff', label: 'TRANSIT  ·  DEPTH 0.13%  ·  PERIOD 15.1 d  ·  HABITABLE ZONE' });
      const w = words(ctx, 8);
      T.karaoke(g, [w[0], w[1], w[2]], t, { x: 110, y: 240, f: 'hero', size: 150, lit: '#f4f1e8', dim: 0.15 });
    });
    return { bloom: 0.7, thresh: 0.8, halation: 0.3 };
  },
};

// ---------------------------------------------------------------------------------------------------
const B6 = {
  id: 'B6_mirror', t0: 33.53, t1: 38.33,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 2.9, pitch: 0.05, fov: 36, beacon: 0, horizonY: -2, starAmt: 0.8 });
    const E = shared.earth;
    const sep = lerp(1.7, 1.5, easeInOutCubic(k));
    E.render(ctx.core, s.target, { pos: [0, 0, 7.2], look: [0, 0, 0], fov: 30, rotY: 1.2 + t * 0.06, tilt: 0.35, sun: [0.8, 0.3, 0.6], at: [-sep, 0, 0], cloud: t * 0.004, dayGain: 0.72, scale: 0.95 });
    OTHER.render(ctx.core, s.target, { pos: [0, 0, 7.2], look: [0, 0, 0], fov: 30, rotY: -1.3, tilt: 0.1, sun: [-0.85, 0.2, 0.5], at: [sep, 0, 0], cloud: 0, scale: 0.95, lights: 2.6 });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 8);
      const A = T.slamAnim(t, w[4].t0), B = T.slamAnim(t, w[5].t0), C = T.slamAnim(t, w[6].t0);
      if (A) T.text(g, 'NOT', 960, 200, { f: 'hero', size: 150, sx: 0.8, align: 'center', alpha: A.a });
      if (B) T.text(g, 'THAT', 960, 340, { f: 'hero', size: 150, sx: 0.8, align: 'center', alpha: B.a });
      if (C) T.text(g, 'FAR', 960, 520, { f: 'hero', size: 170, sx: 0.8, align: 'center', alpha: C.a, glow: C.hot * 30 });
      if (t > w[7].t0) T.text(g, 'from my own', 960, 900, { f: 'ital', size: 110, align: 'center', color: '#8ecbff', alpha: clamp((t - w[7].t0) / 0.25) * (1 - smooth(37.9, 38.3, t)) });
      T.label(g, 'SOL III', 330, 1000, { size: 16, color: '#8ecbff', alpha: 0.8 });
      T.label(g, 'LGM-2 b', 1590, 1000, { size: 16, color: '#ff9a6a', alpha: 0.8, align: 'right' });
    });
    return { bloom: 0.6, thresh: 0.85 };
  },
};

// ---------------------------------------------------------------------------------------------------
const B7 = {
  id: 'B7_alone_cu', t0: 38.33, t1: 39.90,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'night', yaw: 0.4, pitch: 0.75, fov: 50, beacon: beacon(ctx, t, 0.6), beaconDir: [-0.4, 0.8, -0.44] });
    const w = words(ctx, 9);
    layer2D(ctx, s.target, 'typeBack', (g) => {
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 130, sx: 0.8 }], [{ ...w[1], f: 'hero', size: 130, sx: 0.8 }], [{ ...w[2], f: 'ital', size: 120, text: 'we' }], [{ ...w[3], f: 'hero', size: 130, sx: 0.8 }]], { x: 70, y: 70, lead: 0.9 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
    });
    await plateLayer(ctx, s.target, { pid: 'P10_alone', pt: syncedPT('P10_alone', t), place: { cx: 1380, cy: 540, h: 1090 }, grade: 'night',
      cam: { s: push(k, 1.0, 1.06) }, rim: { dir: [-0.6, 0.8], col: [0.62, 0.84, 1.0], w: 7 } });
    return { bloom: 0.5, thresh: 0.9 };
  },
};

const B8 = {
  id: 'B8_alone_orrery', t0: 39.90, t1: 42.63,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#03040b'; g.fillRect(0, 0, W, H);
      const zoom = Math.exp(lerp(Math.log(900), Math.log(64), easeInOutCubic(clamp(k * 1.1))));
      ORR.draw(g, t, { zoom, focus: [13.3, 10.2], highlight: 13 + 10 * 26, speed: 1.4 });
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const a = clamp((t - 39.9) / 0.08);
      T.text(g, 'ALONE?', 960, lerp(760, 720, easeOutCubic(k)), { f: 'six', size: lerp(760, 620, easeOutCubic(k)), align: 'center', color: '#f4f1e8', alpha: a * 0.92, track: lerp(0, 0.06, easeOutCubic(k)) });
      const n = Math.floor(lerp(1, 6000, easeOutCubic(clamp(k * 1.3))));
      T.label(g, `${n.toLocaleString()}${n >= 6000 ? '+' : ''} CONFIRMED EXOPLANETS`, 960, 1010, { size: 20, color: '#ffcf5a', align: 'center' });
    });
    return { bloom: 0.55, thresh: 0.85 };
  },
};

export const ACT2 = [B1, B2, B3, B4, B5, B6, B7, B8];
