// ACT V (79.82 - 97.79): the mirror — the other world, zoomed out; Jade 2026 listening; light from 1,200 years ago
// ACT VI (97.79 - 126.20): the years 2011 -> 2026; the far-side dish; the archive; confirmation builds
import * as THREE from 'three';
import { plateLayer, layer2D, sky, beacon, words, push, glow, incoming, syncedPT, starTrails, W, H } from './lib.js';
import { shared } from './act1.js';
import { shared2 } from './act2.js';
import { lightCurve, panelFrame, waterfall } from '../scenes/data.js';
import { clamp, lerp, smooth, easeOutCubic, easeInOutCubic, easeOutExpo, easeOutBack, hash, rng } from '../lib/util.js';

const EMBER = '#ff9a6a';
const kicksIn = (ctx, a, b) => ctx.tl.kicks.filter((k) => k >= a && k <= b);

// ======================================================================================== ACT V
const E1 = {
  id: 'E1_otherstar', t0: 79.82, t1: 82.18,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 3.6, pitch: -0.05, fov: 40, horizonY: -2, starAmt: 0.8, beacon: 0 });
    const B = shared2.beacon, O = shared2.other;
    const kick = ctx.tl.kick(t, 0.09);
    const bp = ctx.tl.beatPhase(t);
    const st = B.render(ctx.core, s.target, { t, camPos: [lerp(2.2, 1.6, k), 0.6, 9.5], look: [0.8, 0, 0], fov: 32, phase: (bp.i + easeInOutCubic(bp.ph)) / 8, R: 1.55, bright: 0.9 - 0.35 * kick });
    O.render(ctx.core, s.target, { pos: [0, 0, 6], look: [0, 0, 0], fov: 30, rotY: -1.57 + 0.3, tilt: 0.05, sun: [1, 0.05, -0.3], at: [-1.7, -0.6, 1.2], scale: 0.62, lights: 2.4, cloud: t * 0.01 });
    layer2D(ctx, s.target, 'fx', (g) => { glow(g, st.x, st.y, st.r * 2.6, [255, 120, 60], 0.5 * (1 - 0.5 * kick)); }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 16);
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 230, sx: 0.8, color: EMBER }, { ...w[1], f: 'hero', size: 230, sx: 0.8, color: EMBER }],
        [{ ...w[2], f: 'ital', size: 200, text: 'still', color: '#ffe0c8' }], [{ ...w[3], f: 'hero', size: 300, sx: 0.8, color: EMBER }]], { x: 1820, y: 40, lead: 0.84, align: 'right' });
      T.drawBlock(g, runs, t, { anim: 'slam' });
      T.label(g, 'LGM-2  ·  1,200 LIGHT-YEARS  ·  THEIR SIDE', 110, 1010, { size: 16, color: EMBER });
    });
    return { bloom: 0.7, thresh: 0.8, halation: 0.35 };
  },
};

const E2 = {
  id: 'E2_ring', t0: 82.18, t1: 85.76,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 3.9, pitch: 0.1, fov: 34, horizonY: -2, starAmt: 0.9, beacon: 0 });
    const O = shared2.other;
    const kick = ctx.tl.kick(t, 0.12);
    // the terminator ring faces us: their cities pulse gently on the beat
    O.render(ctx.core, s.target, { pos: [0, 0, lerp(3.6, 3.1, easeInOutCubic(k))], look: [0, 0, 0], fov: 30, rotY: -1.57 + 0.15 + k * 0.12, tilt: 0.25,
      sun: [1, 0.05, -0.1], at: [0.35, 0, 0], scale: 1.0, lights: 2.4 + 1.2 * kick, pulse: 0.2 * kick, cloud: t * 0.01 });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 17);
      T.karaoke(g, w.slice(0, 4), t, { x: 110, y: 820, f: 'hero', size: 90, lit: '#ffe0c8', dim: 0.18, gap: 0.22, t1: 86.2 });
      const A = T.slamAnim(t, w[4].t0);
      if (A) T.text(g, 'the life out there', 110, 960, { f: 'ital', size: 120, color: EMBER, alpha: A.a, glow: 20 * A.hot });
    });
    return { bloom: 0.65, thresh: 0.82 };
  },
};

const E3 = {
  id: 'E3_lighthouse', t0: 85.76, t1: 87.54,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 3.2, pitch: 0.0, fov: 40, horizonY: -2, starAmt: 0.8, beacon: 0 });
    const B = shared2.beacon;
    const kick = ctx.tl.kick(t, 0.09);
    const bp = ctx.tl.beatPhase(t);
    // edge-on view of the shade ring: the lighthouse mechanism turning
    const st = B.render(ctx.core, s.target, { t, camPos: [lerp(-3.5, -2.5, k), 1.2, 5.0], look: [0, 0, 0], fov: 38, phase: (bp.i + easeInOutCubic(bp.ph)) / 8, R: 1.8, bright: 0.9 - 0.3 * kick });
    layer2D(ctx, s.target, 'fx', (g) => { glow(g, st.x, st.y, st.r * 2.8, [255, 120, 60], 0.5); }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 18);
      if (t > w[0].t0) T.text(g, 'SEARCHING', 110, 250, { f: 'hero', size: 170, sx: 0.8, color: '#ffe0c8' });
      if (t > w[1].t0) T.text(g, 'for me', 120, 380, { f: 'ital', size: 130, color: EMBER });
      T.label(g, 'TRANSIT BEACON  ·  8 SHADES  ·  PERIOD = ONE BEAT', 110, 1010, { size: 16, color: EMBER });
    });
    return { bloom: 0.7, thresh: 0.8, halation: 0.35 };
  },
};

const E4 = {
  id: 'E4_jade26', t0: 87.54, t1: 89.86,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    // what shows through her (keyed) window: the night sky with LGM-2 blinking
    sky(ctx, s.target, { preset: 'night', yaw: -0.8, pitch: 0.35, fov: 45, beacon: beacon(ctx, t, 0.75) * 1.1, beaconSize: 1.1, beaconDir: [0.1, 0.45, -0.89] });
    await plateLayer(ctx, s.target, { pid: 'P18_jade26', pt: syncedPT('P18_jade26', t), place: 'cover', grade: 'night', cam: { s: push(k, 1.02, 1.07), x: -20 * k } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 19);
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 150, sx: 0.8 }, { ...w[1], f: 'hero', size: 150, sx: 0.8 }], [{ ...w[2], f: 'ital', size: 140, text: 'still' }, { ...w[3], f: 'hero', size: 150, sx: 0.8, text: 'THERE?' }]], { x: 1810, y: 610, lead: 0.95, align: 'right' });
      T.drawBlock(g, runs, t, { anim: 'slam' });
      T.label(g, '2026', 110, 1010, { size: 20, color: '#ffcf5a' });
    });
    return { bloom: 0.55, thresh: 0.88 };
  },
};

const E5 = {
  id: 'E5_mirror', t0: 89.86, t1: 92.74,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 2.9, pitch: 0.05, fov: 36, beacon: 0, horizonY: -2, starAmt: 0.8 });
    const E = shared.earth, O = shared2.other;
    E.render(ctx.core, s.target, { pos: [0, 0, 7.4], look: [0, 0, 0], fov: 30, rotY: 1.4 + t * 0.05, tilt: 0.35, sun: [0.8, 0.3, 0.6], at: [-1.45, 0, 0], cloud: t * 0.004, dayGain: 0.72, scale: 0.9 });
    O.render(ctx.core, s.target, { pos: [0, 0, 7.4], look: [0, 0, 0], fov: 30, rotY: -1.3, tilt: 0.1, sun: [-0.85, 0.2, 0.5], at: [1.45, 0, 0], scale: 0.9, lights: 2.6, cloud: t * 0.01 });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 20);
      const A = T.slamAnim(t, w[1].t0), B = T.slamAnim(t, w[2].t0);
      if (A) T.text(g, 'RARE', 960, 250, { f: 'hero', size: 210, sx: 0.8, align: 'center', alpha: A.a });
      if (B) { T.text(g, 'EARTH', 520, 980, { f: 'hero', size: 150, sx: 0.8, align: 'center', color: '#8ecbff', alpha: B.a }); T.text(g, 'EARTH', 1400, 980, { f: 'hero', size: 150, sx: 0.8, align: 'center', color: EMBER, alpha: B.a }); }
      T.karaoke(g, w.slice(3, 7).map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 960, y: 560, f: 'ital', size: 70, align: 'center', dim: 0.2 });
    });
    return { bloom: 0.6, thresh: 0.85 };
  },
};

const E6 = {
  id: 'E6_journey', t0: 92.74, t1: 97.79,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 1.2 + k * 0.1, pitch: 0.02, fov: 60, beacon: 0, horizonY: -2, starAmt: 1.0, mwAmt: 1.3 });
    layer2D(ctx, s.target, 'fx', (g) => {
      // their light travels toward us (right -> left), a gold thread arriving at a tiny blue Earth
      const ex = 260, ey = 560, sx = 1720, sy = 470;
      glow(g, sx, sy, 60, [255, 130, 70], 0.8); glow(g, ex, ey, 26, [120, 180, 255], 0.9);
      g.strokeStyle = 'rgba(255,207,90,0.25)'; g.lineWidth = 1.5; g.setLineDash([6, 10]);
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke(); g.setLineDash([]);
      for (let i = 0; i < 7; i++) {
        const u = ((k * 1.4 + i / 7) % 1);
        const x = lerp(sx, ex, u), y = lerp(sy, ey, u);
        glow(g, x, y, 22 * (1 - u * 0.4), [255, 214, 130], 0.9 * Math.sin(u * Math.PI));
      }
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const yr = Math.floor(lerp(826, 2026, easeInOutCubic(k)));
      T.text(g, 'friend', 960, 300, { f: 'ital', size: 170, align: 'center', color: '#ffcf5a', alpha: 1 - smooth(96.8, 97.7, t), glow: 12 });
      T.label(g, `LIGHT LEFT LGM-2 IN 826 AD   ·   1,200 LIGHT-YEARS   ·   NOW ${yr}`, 960, 820, { size: 20, color: '#f4f1e8', align: 'center' });
      T.label(g, 'ARE THEY STILL THERE?', 960, 870, { size: 20, color: EMBER, align: 'center', alpha: smooth(94.5, 95.5, t) });
    });
    return { bloom: 0.6, thresh: 0.82 };
  },
};

// ======================================================================================== ACT VI
// the years: 2012 .. 2026 — one milestone every two beats under wheeling star trails
const YEARS = [
  [2012, 'A ROVER LANDS ON MARS BY SKY CRANE', 'crane'], [2013, 'VOYAGER 1 CONFIRMED IN INTERSTELLAR SPACE', 'voyager'],
  [2014, 'WE LAND ON A COMET', 'comet'], [2015, 'A ROCKET BOOSTER LANDS ITSELF  ·  PLUTO HAS A HEART', 'booster'],
  [2016, 'THE BIGGEST SEARCH YET STARTS LISTENING', 'dish'], [2017, 'SEVEN EARTH-SIZED WORLDS AROUND ONE STAR', 'seven'],
  [2018, 'TWO BOOSTERS LAND SIDE BY SIDE', 'twin'], [2019, 'FIRST IMAGE OF A BLACK HOLE', 'blackhole'],
  [2020, 'A COMET OVER EVERY ROOFTOP', 'neowise'], [2021, 'A HELICOPTER FLIES ON MARS', 'heli'],
  [2022, 'THE GOLDEN MIRROR SENDS ITS FIRST PICTURES', 'jwst'], [2023, 'THE BIGGEST ROCKET EVER FLIES', 'starship'],
  [2024, 'THE TOWER CATCHES THE BOOSTER', 'catch'], [2025, 'A NEW TELESCOPE OPENS ITS EYE', 'rubin'],
];

function icon(g, kind, cx, cy, s, u) {
  g.save(); g.translate(cx, cy); g.scale(s, s);
  g.strokeStyle = '#f4f1e8'; g.fillStyle = '#f4f1e8'; g.lineWidth = 3; g.lineCap = 'round'; g.lineJoin = 'round';
  const e = easeOutCubic(u);
  const rocket = (x, y, h, flame) => { g.fillRect(x - 6, y - h, 12, h); g.beginPath(); g.moveTo(x - 6, y - h); g.lineTo(x, y - h - 14); g.lineTo(x + 6, y - h); g.fill(); if (flame) { g.fillStyle = '#ffcf5a'; g.beginPath(); g.moveTo(x - 5, y); g.lineTo(x, y + 18 + 8 * Math.sin(u * 40)); g.lineTo(x + 5, y); g.fill(); g.fillStyle = '#f4f1e8'; } };
  switch (kind) {
    case 'crane': { const y = lerp(-80, 0, e); g.strokeRect(-24, y - 12, 48, 24); g.beginPath(); g.moveTo(-10, y - 12); g.lineTo(-10, y - 50); g.moveTo(10, y - 12); g.lineTo(10, y - 50); g.stroke(); g.fillRect(-22, y - 64, 44, 14); g.beginPath(); g.moveTo(-60, 30); g.lineTo(60, 30); g.stroke(); break; }
    case 'voyager': { const x = lerp(-60, 60, e); g.beginPath(); g.arc(x, 0, 14, 0, 7); g.stroke(); g.beginPath(); g.moveTo(x, 0); g.lineTo(x - 30, 18); g.moveTo(x, 0); g.lineTo(x + 24, -26); g.stroke(); g.setLineDash([4, 6]); g.beginPath(); g.arc(-20, 0, 70, -1.2, 1.2); g.stroke(); g.setLineDash([]); break; }
    case 'comet': { g.beginPath(); g.ellipse(0, 0, 34, 22, 0.3, 0, 7); g.stroke(); const y = lerp(-70, -20, e); g.fillRect(-6, y - 6, 12, 12); break; }
    case 'booster': { const y = lerp(-80, 0, e); rocket(0, 30 + y, 70, u < 0.9); g.beginPath(); g.moveTo(-50, 32); g.lineTo(50, 32); g.stroke(); g.beginPath(); g.arc(70, -40, 16, 0, 7); g.stroke(); g.fillStyle = '#ffb0c0'; g.beginPath(); g.moveTo(70, -34); g.bezierCurveTo(60, -44, 64, -50, 70, -44); g.bezierCurveTo(76, -50, 80, -44, 70, -34); g.fill(); break; }
    case 'dish': { g.beginPath(); g.arc(0, 0, 44, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 40); g.stroke(); for (let i = 0; i < 3; i++) { g.globalAlpha = 1 - ((u * 2 + i / 3) % 1); g.beginPath(); g.arc(0, -40, 60 - ((u * 2 + i / 3) % 1) * 50, Math.PI * 1.25, Math.PI * 1.75); g.stroke(); } g.globalAlpha = 1; break; }
    case 'seven': { g.fillStyle = '#ff9a6a'; g.beginPath(); g.arc(-70, 0, 12, 0, 7); g.fill(); g.fillStyle = '#f4f1e8'; for (let i = 0; i < 7; i++) { const x = -40 + i * 20 * e; g.beginPath(); g.arc(x, 0, 5, 0, 7); g.fill(); } break; }
    case 'twin': { const y = lerp(-80, 0, e); rocket(-24, 30 + y, 64, u < 0.9); rocket(24, 30 + y, 64, u < 0.9); g.beginPath(); g.moveTo(-60, 32); g.lineTo(60, 32); g.stroke(); break; }
    case 'blackhole': { g.strokeStyle = '#ffb347'; g.lineWidth = 14 * e + 2; g.beginPath(); g.arc(0, 0, 40, 0, 7); g.stroke(); g.fillStyle = '#05060d'; g.beginPath(); g.arc(0, 0, 32, 0, 7); g.fill(); break; }
    case 'neowise': { g.fillStyle = '#f4f1e8'; g.beginPath(); g.arc(30, -40, 6, 0, 7); g.fill(); const L = 40 + 60 * e; const gr = g.createLinearGradient(30, -40, 30 - L, -40 - L * 0.5); gr.addColorStop(0, 'rgba(244,241,232,0.9)'); gr.addColorStop(1, 'rgba(244,241,232,0)'); g.strokeStyle = gr; g.lineWidth = 6; g.beginPath(); g.moveTo(30, -40); g.lineTo(30 - L, -40 - L * 0.5); g.stroke(); g.strokeStyle = '#f4f1e8'; g.lineWidth = 3; g.beginPath(); g.moveTo(-70, 40); g.lineTo(-40, 40); g.lineTo(-40, 14); g.lineTo(-20, 0); g.lineTo(0, 14); g.lineTo(0, 40); g.lineTo(70, 40); g.stroke(); break; }
    case 'heli': { const y = lerp(0, -40, e); g.fillRect(-10, y - 6, 20, 16); g.beginPath(); g.moveTo(-40, y - 16); g.lineTo(40, y - 16); g.moveTo(-10, y + 10); g.lineTo(-18, y + 26); g.moveTo(10, y + 10); g.lineTo(18, y + 26); g.stroke(); g.beginPath(); g.moveTo(-60, 30); g.lineTo(60, 30); g.stroke(); break; }
    case 'jwst': { g.fillStyle = '#ffcf5a'; const n = Math.floor(18 * e) + 1; for (let i = 0; i < n; i++) { const q = i < 1 ? [0, 0] : [Math.cos(i / 6 * Math.PI * 2) * (i < 7 ? 18 : 36), Math.sin(i / 6 * Math.PI * 2) * (i < 7 ? 18 : 36)]; g.beginPath(); for (let v = 0; v < 6; v++) { const a = v / 6 * Math.PI * 2 + Math.PI / 6; g.lineTo(q[0] + Math.cos(a) * 9, q[1] + Math.sin(a) * 9); } g.fill(); } break; }
    case 'dart': { g.beginPath(); g.arc(20, 0, 26, 0, 7); g.stroke(); const x = lerp(-90, -8, e); g.fillRect(x - 5, -3, 10, 6); if (u > 0.95) { g.fillStyle = '#ffcf5a'; g.beginPath(); g.arc(-6, 0, 16, 0, 7); g.fill(); } break; }
    case 'starship': { rocket(0, 40 - e * 60, 110, true); g.beginPath(); g.moveTo(-60, 42); g.lineTo(60, 42); g.stroke(); break; }
    case 'catch': { g.fillRect(34, -80, 12, 120); const y = lerp(-110, -20, e); rocket(0, y + 60, 90, u < 0.85); g.fillRect(8, -34, 30, 5); g.fillRect(8, -18, 30, 5); break; }
    case 'rubin': { g.beginPath(); g.arc(0, 10, 40, Math.PI, 0); g.lineTo(40, 30); g.lineTo(-40, 30); g.closePath(); g.stroke(); g.fillStyle = '#ffcf5a'; g.fillRect(-6 * e, -30, 12 * e, 30); break; }
  }
  g.restore();
}

const F1 = {
  id: 'F1_years', t0: 97.79, t1: 111.05,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, A = shared.arr, k = s.lt / s.dur;
    // the array keeps listening while the sky wheels (star trails) — years compress into beats
    A.setLook({ keyDir: [-0.55, 0.65, 0.5], dish: ['#7d8cc0', '#3e4a80', '#20284f'], body: ['#6c7aac', '#384476', '#1d2549'], ground: ['#141b40', '#11183a', '#0e1432'], fogCol: '#1c2656', fogFar: 300, fogNear: 25, rim: '#bfe2ff', rimAmt: 0.4, ink: '#050716' });
    A.pose((i, d) => ({ az: Math.PI + 0.25, el: 0.78, glow: 0.6 }), t);
    sky(ctx, s.target, { preset: 'night', yaw: -0.2, pitch: 0.3, fov: 60, beacon: 0, starAmt: 0, mwAmt: 0.35 });
    layer2D(ctx, s.target, 'trails', (g) => starTrails(g, t, { pole: [420, -120], len: 0.04 + 0.9 * easeInOutCubic(k), spin: 0.05, alpha: 0.95 }), { mode: 'add' });
    A.render(ctx, s.target, { pos: [-2, 4.0, 36], look: [12, 16, -50], fov: 60, time: t, sky: false });
    const bi = ctx.tl.beatIndex(t) - ctx.tl.beatIndex(97.8);
    const yi = clamp(Math.floor(bi / 2), 0, YEARS.length - 1);
    const y0 = ctx.tl.beat(ctx.tl.beatIndex(97.8) + yi * 2);
    const u = clamp((t - y0) / 0.9);
    layer2D(ctx, s.target, 'type', (g) => {
      g.fillStyle = 'rgba(5,7,18,0.38)'; g.fillRect(0, 0, W, H);
      const [yr, cap, kind] = YEARS[yi];
      const A2 = T.slamAnim(t, y0, { from: 1.12 });
      T.text(g, String(yr), 960, 560, { f: 'six', size: 560, align: 'center', color: '#f4f1e8', alpha: (A2 ? A2.a : 1) * 0.95 });
      icon(g, kind, 960, 720, 1.6, u);
      T.label(g, cap, 960, 900, { size: 22, color: '#ffcf5a', align: 'center' });
      // ticker of all years
      YEARS.forEach(([y2], i) => T.label(g, String(y2), 160 + i * 115, 1010, { size: 16, color: i === yi ? '#ffcf5a' : '#8ecbff', alpha: i <= yi ? 1 : 0.3 }));
      T.label(g, 'STILL LISTENING', 1760, 1010, { size: 16, color: '#f4f1e8', align: 'right', alpha: 0.7 });
    });
    return { bloom: 0.5, thresh: 0.88 };
  },
};

const F2 = {
  id: 'F2_farside', t0: 111.05, t1: 114.84,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 0.6, pitch: 0.28, fov: 56, beacon: beacon(ctx, t, 0.5), beaconDir: [-0.3, 0.6, -0.74], starAmt: 1.2, mwAmt: 1.3, horizonY: 0.0 });
    layer2D(ctx, s.target, 'moon', (g) => {
      // grey lunar horizon, crater rim, and a wire dish slung inside the crater
      const R = rng(31);
      g.fillStyle = '#6d6a72'; g.beginPath(); g.moveTo(0, 720);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, 700 + Math.sin(x / 260) * 26 + (R() - 0.5) * 8);
      g.lineTo(W, H); g.lineTo(0, H); g.fill();
      g.fillStyle = '#4b4852'; g.beginPath(); g.ellipse(980, 830, 720, 170, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#2e2c33'; g.beginPath(); g.ellipse(980, 850, 640, 130, 0, 0, Math.PI * 2); g.fill();
      // dish mesh unfolding
      const u = easeInOutCubic(clamp((t - 111.2) / 2.6));
      g.strokeStyle = `rgba(210,220,240,${0.4 + 0.5 * u})`; g.lineWidth = 1.2;
      for (let i = 0; i <= 24; i++) { const a = i / 24; g.beginPath(); g.ellipse(980, 850, 600 * a * u + 1, 118 * a * u + 1, 0, 0, Math.PI * 2); g.stroke(); }
      for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; g.beginPath(); g.moveTo(980, 850); g.lineTo(980 + Math.cos(a) * 600 * u, 850 + Math.sin(a) * 118 * u); g.stroke(); }
      g.strokeStyle = '#d8dde8'; g.lineWidth = 3;
      for (const sx of [-1, 1]) { g.beginPath(); g.moveTo(980 + sx * 560, 760); g.lineTo(980, 520); g.stroke(); }
      g.fillStyle = '#f4f1e8'; g.fillRect(960, 505, 40, 26);
      glow(g, 980, 518, 30 * u, [255, 214, 130], u);
      // boulders
      for (let i = 0; i < 26; i++) { const x = R() * W, y = 740 + R() * 320; g.fillStyle = '#4a4751'; g.beginPath(); g.ellipse(x, y, 6 + R() * 22, 4 + R() * 10, 0, 0, 7); g.fill(); }
    });
    layer2D(ctx, s.target, 'type', (g) => {
      T.text(g, '2026', 110, 200, { f: 'six', size: 260, color: '#f4f1e8' });
      T.label(g, 'FAR SIDE OF THE MOON  ·  THE QUIETEST PLACE WE KNOW  ·  LISTENING ONLY', 118, 250, { size: 18, color: '#ffcf5a' });
    });
    return { bloom: 0.55, thresh: 0.86 };
  },
};

const F3 = {
  id: 'F3_archive', t0: 114.84, t1: 118.63,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#0c0f1c'; g.fillRect(0, 0, W, H);
      // a plain mail archive list (generic UI, no brand)
      const x = 260, y = 150, w = 1400;
      panelFrame(g, x - 20, y - 60, w + 40, 800, 'ARCHIVE  ·  SEARCH: rare earth', { col: 'rgba(142,203,255,0.6)' });
      const rows = [['RNA', 'rehearsal thursday?', 'May 2011'], ['jade', 'rare earth (demo) — recorded tonight', 'May 31 2011'], ['charlie', 're: set list for the SETI night', 'Jun 2011'],
        ['ricky', 'photos from the show', 'Jun 2011'], ['jade', 'lyrics v3 — "keep up funding" stays', 'Jun 2011'], ['jade', 'rare earth (demo).m4a', '2011']];
      rows.forEach(([from, subj, d], i) => {
        const yy = y + i * 110;
        const hi = i === 1 && t > 115.6;
        if (hi) { g.fillStyle = 'rgba(255,207,90,0.14)'; g.fillRect(x, yy - 50, w, 96); g.strokeStyle = '#ffcf5a'; g.lineWidth = 2; g.strokeRect(x, yy - 50, w, 96); }
        T.text(g, from, x + 30, yy + 6, { f: 'monoB', size: 26, color: hi ? '#ffcf5a' : '#cfd8ee' });
        T.text(g, subj, x + 260, yy + 6, { f: 'mono', size: 26, color: hi ? '#fff4dc' : '#9fb0d6' });
        T.text(g, d, x + w - 30, yy + 6, { f: 'mono', size: 22, color: '#6f7fa8', align: 'right' });
      });
      if (t > 116.4) { const a = smooth(116.4, 116.8, t); g.fillStyle = `rgba(255,207,90,${a})`; g.fillRect(x + 260, y + 110 + 30, 780 * smooth(116.4, 118.4, t), 6); T.label(g, '▶ PLAYING  00:0' + Math.floor((t - 116.4) % 10), x + 260, y + 110 + 70, { size: 16, color: '#ffcf5a', alpha: a }); }
    });
    layer2D(ctx, s.target, 'type', (g) => { T.label(g, 'FIFTEEN YEARS LATER', 960, 1010, { size: 18, color: '#8ecbff', align: 'center' }); });
    return { bloom: 0.4, thresh: 0.9 };
  },
};

const F4 = {
  id: 'F4_confirm', t0: 118.63, t1: 122.41,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#04050b'; g.fillRect(0, 0, W, H);
      const inst = [['OPTICAL  ·  PHOTOMETRY', '#ffcf5a'], ['RADIO  ·  ARRAY', '#8ecbff'], ['FAR SIDE  ·  LUNAR DISH', '#cfe8ff'], ['ARCHIVE  ·  2011 DATA', '#ff9a6a']];
      inst.forEach(([name, col], i) => {
        const x = 110 + (i % 2) * 870, y = 140 + Math.floor(i / 2) * 420, w = 830, h = 330;
        const on = t > 118.7 + i * 0.47;
        panelFrame(g, x, y, w, h, name, { col, alpha: on ? 1 : 0.3 });
        if (on) lightCurve(g, { x: x + 20, y: y + 40, w: w - 40, h: h - 80, t, t0: 118.63, span: 3.8, dips: kicksIn(ctx, 118.6, 122.5), depth: 0.3, width: 0.05, color: col, grid: false });
      });
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const a = smooth(121.2, 121.6, t);
      g.fillStyle = `rgba(4,5,11,${0.7 * a})`; g.fillRect(0, 440, W, 200);
      T.text(g, 'SAME RHYTHM. FOUR INSTRUMENTS.', 960, 560, { f: 'hero', size: 110, sx: 0.8, align: 'center', alpha: a });
    });
    return { bloom: 0.55, thresh: 0.85 };
  },
};

const F5 = {
  id: 'F5_room', t0: 122.41, t1: 126.19,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    await plateLayer(ctx, s.target, { pid: 'P20_room26', pt: 0.3 + s.lt, place: 'cover', grade: 'screen', cam: { s: push(k, 1.0, 1.12), y: -20 * k } });
    layer2D(ctx, s.target, 'type', (g) => {
      T.label(g, 'CONTROL ROOM  ·  2026', 110, 1010, { size: 16, color: '#8ecbff' });
      const a = smooth(124.4, 124.9, t);
      T.typewriter(g, '> confirm? y', t, 124.6, { x: 1400, y: 1000, size: 28, cps: 9, color: '#ffcf5a', alpha: a });
    });
    const fade = smooth(125.6, 126.19, t) * 0.9;
    return { bloom: 0.5, thresh: 0.88, flash: fade, flashCol: [1, 1, 1] };
  },
};

export const ACT5 = [E1, E2, E3, E4, E5, E6, F1, F2, F3, F4, F5];
