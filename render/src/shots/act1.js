// ACT 0-I (0.00 - 17.69): cold open + verse 1 ("Do you still care ... a rare earth looking for a friend")
import * as THREE from 'three';
import { plateLayer, layer2D, sky, beacon, words, push, shake, glow, incoming, syncedPT, W, H } from './lib.js';
import { DishArray } from '../scenes/array.js';
import { Planet, makeEarthTextures } from '../scenes/planet.js';
import { clamp, lerp, smooth, easeOutCubic, easeInOutCubic, easeOutExpo, easeOutBack, hash } from '../lib/util.js';

const BEACON_DIR = [-0.42, 0.5, -0.76];
let ARR = null, EARTH = null;
export const shared = { get arr() { return ARR; }, get earth() { return EARTH; } };

export async function initAct1(ctx) {
  if (!ARR) ARR = new DishArray(ctx.core);
  if (!EARTH) EARTH = new Planet(await makeEarthTextures(''), { rim: '#7fb8ff', lightsAmt: 1.2, termAmt: 0.22 });
}

// ---------------------------------------------------------------------------------------------------
const A1 = {
  id: 'A1_cold', t0: 0.0, t1: 3.86,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'night', yaw: 0.35, pitch: 0.42 + 0.03 * k, fov: 64, beacon: 0.75 + 0.25 * Math.sin(t * 2.2), beaconDir: BEACON_DIR, beaconSize: 1.1 });
    await plateLayer(ctx, s.target, { pid: 'P01_rim', pt: 0.4 + s.lt * 0.9, place: 'cover', grade: 'night',
      cam: { s: push(k, 1.0, 1.06), x: -20 * k, y: 12 * k }, rim: { dir: [-0.8, 0.6], col: [0.55, 0.78, 1.0], w: 5, amt: 0.9 } });
    layer2D(ctx, s.target, 'type', (g) => {
      const out = 1 - smooth(3.3, 3.8, t);
      const a = out;
      T.label(g, 'RNA  ·  ROBOT NINJA APOCALYPSE', 118, 150, { size: 17, color: '#ffcf5a', alpha: 0.9 * a });
      T.text(g, 'RARE', 104, 360, { f: 'hero', size: 250, sx: 0.8, color: '#f4f1e8', alpha: a });
      T.text(g, 'EARTH', 104, 575, { f: 'hero', size: 250, sx: 0.8, color: '#f4f1e8', alpha: a });
      T.vertical(g, 'レア・アース', 640, 170, { size: 30, color: '#8ecbff', alpha: 0.85 * a });
      T.label(g, '2011 → 2026', 118, 640, { size: 18, color: '#8ecbff', alpha: 0.8 * a });
      T.typewriter(g, '> are you still there?', t, 0.35, { x: 118, y: 960, size: 30, cps: 17, color: '#ffcf5a', alpha: a });
    });
    return { bloom: 0.5, thresh: 0.9, vig: 0.35, fade: 0 };
  },
};

// ---------------------------------------------------------------------------------------------------
const A2 = {
  id: 'A2_care', t0: 3.86, t1: 7.64,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const kick = ctx.tl.kick(t, 0.12);
    const punch = 1 + 0.035 * kick + 0.05 * Math.exp(-Math.max(0, t - 4.19) / 0.25) * (t > 4.19 ? 1 : 0);
    sky(ctx, s.target, { preset: 'night', yaw: 0.1 - 0.02 * s.lt, pitch: 0.55, fov: 58, beacon: beacon(ctx, t, 0.7), beaconDir: [-0.3, 0.62, -0.72] });
    // type BEHIND the singer
    const w0 = words(ctx, 0);
    layer2D(ctx, s.target, 'typeBack', (g) => {
      const out1 = smooth(5.78, 5.95, t);
      const runs = T.layout(g, [
        [{ ...w0[0], f: 'hero', size: 300, sx: 0.8 }, { ...w0[1], f: 'hero', size: 300, sx: 0.8 }],
        [{ ...w0[2], text: 'still', f: 'ital', size: 250, dx: 10 }],
        [{ ...w0[3], f: 'hero', size: 420, sx: 0.8 }],
      ], { x: 96, y: 72, lead: 0.8 });
      if (out1 < 1) T.drawBlock(g, runs, t, { anim: 'slam', glow: 0, alpha: 1 - out1 });
      // "you're yearning to see" rises as the block leaves
      const w1 = words(ctx, 1);
      if (t > 5.9) {
        const r2 = T.layout(g, [[{ ...w1[0], f: 'hero', size: 150, sx: 0.8 }], [{ ...w1[1], text: 'yearning', f: 'ital', size: 190 }],
          [{ ...w1[2], f: 'hero', size: 150, sx: 0.8 }, { ...w1[3], f: 'hero', size: 150, sx: 0.8 }]], { x: 110, y: 200, lead: 0.95 });
        T.drawBlock(g, r2, t, { anim: 'rise' });
      }
    }, { s: 1 + 0.01 * kick });
    await plateLayer(ctx, s.target, { pid: 'P02_care', pt: syncedPT('P02_care', t), place: { cx: 1180, cy: 560, h: 1130 }, grade: 'night',
      cam: { s: punch, x: -8 * kick, y: 0 }, rim: { dir: [-0.85, 0.5], col: [0.6, 0.82, 1.0], w: 7, amt: 1.0 } });
    layer2D(ctx, s.target, 'typeFront', (g) => {
      T.label(g, 'RARE EARTH', 1810, 70, { size: 16, color: '#8ecbff', align: 'right', alpha: 0.8 });
      T.label(g, '04.19 / 172.36', 1810, 1022, { size: 16, color: '#ffcf5a', align: 'right', alpha: 0.7 });
    });
    const flash = t > 4.19 && t < 4.32 ? 0.35 * (1 - (t - 4.19) / 0.13) : 0;
    return { bloom: 0.5, thresh: 0.9, flash, vig: 0.3 };
  },
};

// ---------------------------------------------------------------------------------------------------
const A3 = {
  id: 'A3_array', t0: 7.64, t1: 9.56,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, A = ARR;
    const k = clamp(s.lt / s.dur);
    // dishes swing from low to the beacon in a ripple, locking on "there" (8.58)
    const lockT = 8.58;
    A.setLook({ keyDir: [-0.55, 0.65, 0.5], dish: ['#8f9fd0', '#44518a', '#232b58'], body: ['#7d8cbc', '#3e4a80', '#20284f'],
      ground: ['#1a2350', '#161e46', '#121a3c'], fogCol: '#26336a', fogFar: 300, fogNear: 25, rim: '#bfe2ff', rimAmt: 0.55, ink: '#060918' });
    A.pose((i, d) => {
      const delay = (d.home.r * 0.06 + Math.abs(d.home.c - 3) * 0.03);
      const u = easeOutBack(clamp((t - 7.64 - delay) / 0.75), 1.3);
      return { az: lerp(Math.PI + 1.1, Math.PI + 0.25, u), el: lerp(0.12, 0.75, u), glow: t > lockT + delay ? 1 : 0 };
    }, t);
    const cam = { pos: [lerp(-8, -4, k), lerp(3.0, 4.0, k), 34], look: [12, lerp(14, 20, k), -50], fov: 58, time: t,
      sky: { preset: 'night', beacon: beacon(ctx, t, 0.7), beaconDir: BEACON_DIR } };
    const foci = A.render(ctx, s.target, cam);
    layer2D(ctx, s.target, 'fx', (g) => {
      for (const f of foci) {
        if (!f.glow) continue;
        const r = 2600 / f.dist;
        glow(g, f.x, f.y, r * 0.8, [255, 212, 120], 0.85);
        if (f.dist < 60) incoming(g, f.x, f.y, t, { r0: r * 2.2, n: 2, period: 0.95, w: 1.2, a: 0.45 });
      }
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 1);
      const runs = T.layout(g, [[{ ...w[4], f: 'hero', size: 170, sx: 0.8 }, { ...w[5], f: 'hero', size: 170, sx: 0.8 }],
        [{ ...w[6], f: 'hero', size: 250, sx: 0.8 }, { ...w[7], f: 'ital', size: 230, text: 'there' }]], { x: 960, y: 70, lead: 0.9, align: 'center' });
      T.drawBlock(g, runs, t, { anim: 'slam' });
    });
    const flash = t > lockT && t < lockT + 0.1 ? 0.25 : 0;
    return { bloom: 0.65, thresh: 0.85, flash };
  },
};

// ---------------------------------------------------------------------------------------------------
const A4 = {
  id: 'A4_search', t0: 9.56, t1: 11.70,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 0.9 + 0.08 * k, pitch: 1.05, roll: 0.2 * k, fov: 38, beacon: beacon(ctx, t, 0.6), beaconSize: 0.8,
      beaconDir: [0.25, 0.93, -0.27], starAmt: 1.25, mwAmt: 1.3 });
    // reticle hops between stars on each beat
    const bp = ctx.tl.beatPhase(t);
    const hopIdx = bp.i;
    const targets = [[620, 380], [1180, 300], [860, 700], [1420, 560], [520, 640], [1080, 480]];
    const cur = targets[((hopIdx % targets.length) + targets.length) % targets.length];
    const prev = targets[(((hopIdx - 1) % targets.length) + targets.length) % targets.length];
    const u = easeOutExpo(clamp(bp.since / 0.16));
    const x = lerp(prev[0], cur[0], u), y = lerp(prev[1], cur[1], u);
    layer2D(ctx, s.target, 'hud', (g) => {
      g.strokeStyle = 'rgba(142,203,255,0.9)'; g.lineWidth = 2;
      const r = 46 + 10 * (1 - u);
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
      for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2; g.beginPath(); g.moveTo(x + Math.cos(a) * (r + 8), y + Math.sin(a) * (r + 8)); g.lineTo(x + Math.cos(a) * (r + 30), y + Math.sin(a) * (r + 30)); g.stroke(); }
      g.strokeStyle = 'rgba(142,203,255,0.25)'; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      const id = `HIP ${(41000 + ((hopIdx * 7919) % 9000))}`;
      T.label(g, `${id}   1420.405 MHz   SNR 0.${(hopIdx * 37) % 9}   NO SIGNAL`, x + r + 40, y - 12, { size: 16, color: '#8ecbff' });
      T.label(g, `RA ${(10 + (hopIdx % 12))}h ${(hopIdx * 13) % 60}m   DEC +${(hopIdx * 7) % 70}°`, x + r + 40, y + 14, { size: 16, color: '#8ecbff', alpha: 0.7 });
      // every star already checked keeps a small bracket + NO SIGNAL (the search is exhaustive, and so far empty)
      const b0 = ctx.tl.beatIndex(9.56);
      for (let j = b0; j < hopIdx; j++) {
        const p = targets[((j % targets.length) + targets.length) % targets.length];
        const jx = p[0] + ((j * 131) % 90) - 45, jy = p[1] + ((j * 71) % 70) - 35;
        g.strokeStyle = 'rgba(142,203,255,0.45)'; g.lineWidth = 1.2;
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.beginPath(); g.moveTo(jx + sx * 16, jy + sy * 8); g.lineTo(jx + sx * 16, jy + sy * 16); g.lineTo(jx + sx * 8, jy + sy * 16); g.stroke(); }
        T.label(g, 'NO SIGNAL', jx + 22, jy + 5, { size: 12, color: 'rgba(142,203,255,0.6)' });
      }
      // scrolling target catalogue
      const rowsN = 26, sc = (t - 9.56) * 22;
      g.save(); g.beginPath(); g.rect(W - 420, 130, 340, 800); g.clip();
      for (let r = 0; r < rowsN + 1; r++) {
        const n = Math.floor(sc) + r, yy = 150 + (r - (sc % 1)) * 31;
        T.label(g, `HIP ${40000 + (n * 7919) % 60000}  ·  1420 MHz  ·  –`, W - 410, yy, { size: 13, color: 'rgba(142,203,255,0.55)' });
      }
      g.restore();
      // frame HUD
      g.strokeStyle = 'rgba(142,203,255,0.35)'; g.lineWidth = 1; g.strokeRect(60, 60, W - 120, H - 120);
      T.label(g, 'ARRAY  ·  BEAM 07  ·  SEARCHING', 80, 92, { size: 16, color: '#8ecbff' });
      T.label(g, `T+${(t - 9.56).toFixed(2)}s`, W - 80, 92, { size: 16, color: '#8ecbff', align: 'right' });
    });
    layer2D(ctx, s.target, 'typeBack', (g) => {
      T.text(g, 'SEARCHING', 960, 1060, { f: 'six', size: 1150, align: 'center', color: '#8ecbff', alpha: 0.055 });
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 2);
      T.text(g, 'SEARCHING', 960, 1000, { f: 'hero', size: 150, sx: 0.8, align: 'center', color: '#f4f1e8', alpha: clamp((t - w[0].t0) / 0.06) });
      if (t > w[1].t0) T.text(g, 'for me', 960, 850, { f: 'ital', size: 120, align: 'center', color: '#ffcf5a', alpha: clamp((t - w[1].t0) / 0.1) });
    });
    return { bloom: 0.6, thresh: 0.85 };
  },
};

// ---------------------------------------------------------------------------------------------------
const A5 = {
  id: 'A5_there', t0: 11.70, t1: 13.46,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'night', yaw: -0.2, pitch: 0.6, fov: 56, beacon: beacon(ctx, t, 0.7), beaconDir: [-0.5, 0.66, -0.56] });
    const w = words(ctx, 3);
    layer2D(ctx, s.target, 'typeBack', (g) => {
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 250, sx: 0.8 }, { ...w[1], f: 'hero', size: 250, sx: 0.8 }],
        [{ ...w[2], f: 'ital', size: 220, text: 'still' }], [{ ...w[3], f: 'hero', size: 330, sx: 0.8, text: 'THERE?' }]], { x: 100, y: 96, lead: 0.82 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
    });
    await plateLayer(ctx, s.target, { pid: 'P03_there', pt: syncedPT('P03_there', t), place: { cx: 1150, cy: 540, h: 1100 }, grade: 'night',
      cam: { s: push(k, 1.0, 1.05) }, rim: { dir: [-0.8, 0.6], col: [0.6, 0.82, 1.0], w: 7 } });
    layer2D(ctx, s.target, 'typeFront', (g) => { T.typewriter(g, '> are you still there?', t, 11.7, { x: 1240, y: 1010, size: 24, cps: 30, color: '#ffcf5a' }); });
    return { bloom: 0.5, thresh: 0.9 };
  },
};

// ---------------------------------------------------------------------------------------------------
const A6 = {
  id: 'A6_earth', t0: 13.46, t1: 15.29,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 2.2, pitch: 0.1, fov: 30, beacon: beacon(ctx, t, 0.5) * 0.7, beaconSize: 0.7, beaconDir: [0.5, 0.2, -0.84], horizonY: -2 });
    EARTH.render(ctx.core, s.target, { pos: [0, 0, lerp(6.2, 5.6, easeInOutCubic(k))], look: [0, 0, 0], fov: 30, rotY: 2.5 + t * 0.05, tilt: 0.35,
      sun: [0.9, 0.3, 0.55], cloud: t * 0.004, lights: 1.2, at: [0.9, -0.02, 0], dayGain: 0.72 });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 4);
      T.text(g, 'a', 118, 250, { f: 'ital', size: 130, color: '#8ecbff', alpha: clamp((t - w[0].t0) / 0.08) });
      const A = T.slamAnim(t, w[1].t0), B = T.slamAnim(t, w[2].t0);
      if (A) T.text(g, 'RARE', 110, 520, { f: 'hero', size: 300, sx: 0.8, alpha: A.a, sy: A.s, glow: A.hot * 30 });
      if (B) T.text(g, 'EARTH', 110, 790, { f: 'hero', size: 300, sx: 0.8, alpha: B.a, sy: B.s, glow: B.hot * 30 });
      T.label(g, 'SOL III  ·  1 AU  ·  PALE BLUE', 122, 860, { size: 17, color: '#8ecbff', alpha: clamp((t - w[2].t0) / 0.3) });
    });
    return { bloom: 0.6, thresh: 0.85 };
  },
};

const A7 = {
  id: 'A7_eye', t0: 15.29, t1: 17.69,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const k = s.lt / s.dur;
    await plateLayer(ctx, s.target, { pid: 'P04_eye', pt: 0.2 + s.lt, place: 'cover', grade: 'night', cam: { s: push(k, 1.05, 1.14), y: 30 * k } });
    const w = words(ctx, 4);
    layer2D(ctx, s.target, 'fx', (g) => {
      const f = Math.exp(-Math.max(0, t - w[6].t0) / 0.5) * (t > w[6].t0 ? 1 : 0) + 0.25;
      glow(g, 1160, 470, 90 * f + 20, [255, 214, 130], 0.8 * f);
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      T.karaoke(g, [w[3], w[4], w[5]], t, { x: 120, y: 980, f: 'mono', size: 44, lit: '#f4f1e8', dim: 0.3 });
      const A = T.slamAnim(t, w[6].t0, { from: 1.15 });
      if (A) T.text(g, 'friend', 600, 990, { f: 'ital', size: 150, color: '#ffcf5a', alpha: A.a * (1 - smooth(17.3, 17.69, t)), glow: 20 });
    });
    return { bloom: 0.55, thresh: 0.88, fade: smooth(17.4, 17.69, t) * 0.0 };
  },
};

export const ACT1 = [A1, A2, A3, A4, A5, A6, A7];
