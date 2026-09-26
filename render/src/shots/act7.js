// ACT VII (126.19 - 147.02): V5, confirmation — the catch repeats on every instrument, the control room, "how could we be alone"
// ACT VIII (147.02 - 162.18): climax — the dishes lift us up, the band at dawn, "oh", a galaxy of lighthouses
// ACT IX (162.18 - 172.36): outro — the pale blue dot among blinking lights; end card
import { plateLayer, layer2D, softLayer, sky, beacon, words, push, shake, glow, incoming, lighthouses, scissor, syncedPT, plates, W, H } from './lib.js';
import { shared } from './act1.js';
import { shared2 } from './act2.js';
import { nightArray, dawnArray, drawFoci } from './act3.js';
import { Galaxy, paleBlueDot } from '../scenes/cosmos.js';
import { drawTraced, placeFor, GRADES } from '../scenes/plate.js';
import { waterfall, lightCurve, panelFrame } from '../scenes/data.js';
import { clamp, lerp, smooth, easeOutCubic, easeInCubic, easeInOutCubic, easeOutExpo, easeInExpo, easeOutBack, hash, rng } from '../lib/util.js';

const EMBER = '#ff9a6a', GOLD = '#ffcf5a', PALE = '#8ecbff', PAPER = '#f4f1e8', NAVY = '#1c2552';
const BEACON_DIR = [-0.42, 0.5, -0.76];
let GAL = null;
export async function initAct7() { if (!GAL) GAL = new Galaxy(160000); }

// the six sung "oh"s of the climax land on these half-bars
const OHS = [153.65, 154.6, 155.55, 156.49, 157.44, 158.39, 159.34];
const ohCount = (t) => OHS.filter((x) => t >= x).length;

// ======================================================================================== ACT VII
const G1 = {
  id: 'G1_dot', t0: 126.19, t1: 129.42,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    const kick = ctx.tl.kick(t, 0.14);
    // behind her (keyed): the control room far out of focus, screens breathing with the signal
    softLayer(ctx, s.target, 'bokeh', 6, (g) => {
      g.fillStyle = '#060918'; g.fillRect(0, 0, W, H);
      const R = rng(41);
      for (let i = 0; i < 22; i++) {
        const x = R() * W, y = 80 + R() * 760, w = 160 + R() * 300, h = w * (0.5 + R() * 0.2), hot = R() < 0.3;
        const a = 0.16 + R() * 0.14 + (hot ? 0.3 * kick : 0);
        g.fillStyle = hot ? `rgba(255,190,90,${a})` : `rgba(90,150,235,${a})`;
        g.fillRect(x, y, w, h);
      }
      for (let i = 0; i < 30; i++) glow(g, R() * W, R() * H, 30 + R() * 70, R() < 0.3 ? [255, 207, 90] : [142, 203, 255], 0.18 + 0.12 * R());
    });
    await plateLayer(ctx, s.target, { pid: 'P21_v5cu', pt: syncedPT('P21_v5cu', t), place: 'cover', grade: 'night', cam: { s: push(k, 1.02, 1.07), x: -24 * k },
      rim: { dir: [-0.9, 0.2], col: [0.55, 0.8, 1.0], w: 7, amt: 0.9 + 0.5 * kick } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 21);
      T.karaoke(g, w.slice(0, 5).map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 110, y: 300, f: 'ital', size: 80, lit: PAPER, dim: 0.22, t1: 130 });
      const runs = T.layout(g, [[{ ...w[5], f: 'hero', size: 200, sx: 0.8, color: PALE }], [{ ...w[6], f: 'hero', size: 200, sx: 0.8, color: PALE }],
        [{ ...w[7], f: 'hero', size: 250, sx: 0.8, color: PAPER, text: 'DOT.' }]], { x: 104, y: 330, lead: 0.84 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
      T.label(g, '2026  ·  CONTROL ROOM  ·  03:12', 110, 1010, { size: 16, color: PALE, alpha: 0.8 });
    });
    return { bloom: 0.45, thresh: 0.9 };
  },
};

const G2 = {
  id: 'G2_signal', t0: 129.42, t1: 130.94,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const w = words(ctx, 22);
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#04050b'; g.fillRect(0, 0, W, H);
      waterfall(g, { x: 0, y: 0, w: W, h: H, t: t * 1.3, cols: 160, rows: 90, line: { on: true, f0: 0.64, drift: -0.05, snr: 1.15 }, palette: 'gold' });
      g.fillStyle = 'rgba(4,5,11,0.78)'; g.fillRect(0, 0, W, 290);
      // "HERE": an annotation box snaps around the drifting line
      const A = T.slamAnim(t, w[2].t0, { from: 1.5 });
      if (A) {
        const bx = 1150, by = 400, bw = 170, bh = 420;
        g.save(); g.translate(bx + bw / 2, by + bh / 2); g.scale(A.s, A.s); g.translate(-(bx + bw / 2), -(by + bh / 2));
        g.strokeStyle = GOLD; g.lineWidth = 8; g.globalAlpha = A.a; g.strokeRect(bx, by, bw, bh);
        g.fillStyle = GOLD; g.fillRect(bx, by + bh, 330, 110);
        T.text(g, 'HERE', bx + 18, by + bh + 92, { f: 'hero', size: 100, sx: 0.8, color: '#060a1a' });
        g.restore();
      }
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 200, sx: 0.8, color: PAPER }, { ...w[1], f: 'hero', size: 200, sx: 0.8, color: GOLD }]], { x: 104, y: 88 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
      T.label(g, 'LGM-2  ·  NARROWBAND  ·  SAME RHYTHM AS 2011 DATA  ·  SNR 41', 1810, 1030, { size: 16, color: GOLD, align: 'right' });
    });
    return { bloom: 0.45, thresh: 0.92 };
  },
};

const G3 = {
  id: 'G3_caught', t0: 130.94, t1: 133.16,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    const w = words(ctx, 22);
    const hitT = w[6].t0;
    const sh = shake(t, 12 * ctx.tl.kick(t, 0.1) + (t > hitT ? 16 * Math.exp(-(t - hitT) / 0.12) : 0));
    await plateLayer(ctx, s.target, { pid: 'P22_cheer', pt: 0.3 + s.lt, place: 'cover', grade: 'screen', cam: { s: push(k, 1.02, 1.1), x: sh.x, y: sh.y } });
    layer2D(ctx, s.target, 'type', (g) => {
      g.fillStyle = 'rgba(6,10,26,0.45)'; g.fillRect(0, 0, W, 230);
      T.karaoke(g, [w[3], w[4], w[5]].map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 110, y: 170, f: 'ital', size: 120, lit: '#fff4dc', dim: 0.3, glow: 10 });
      const A = T.slamAnim(t, hitT, { from: 1.7 });
      if (A) T.text(g, 'CAUGHT', 960, 1040, { f: 'six', size: 760, align: 'center', color: GOLD, alpha: A.a, stroke: 14, strokeCol: '#060a1a', glow: 50 * A.hot });
    });
    const impact = t >= hitT && t < hitT + 2 / 24 ? 1 : 0;
    return { bloom: 0.6, thresh: 0.85, impact };
  },
};

const G4 = {
  id: 'G4_beat', t0: 133.16, t1: 136.80,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur, A = shared.arr, B = shared2.beacon;
    const kick = ctx.tl.kick(t, 0.09);
    const bp = ctx.tl.beatPhase(t);
    // split screen, one beat: left = their star blinking, right = our dishes receiving on the same kick
    sky(ctx, s.target, { preset: 'deep', yaw: 1.3, pitch: 0.1, fov: 40, beacon: 0, horizonY: -2, starAmt: 0.7 });
    scissor(s.target, [0, 0, 960, H]);
    const st = B.render(ctx.core, s.target, { t, camPos: [1.52, 0.2, lerp(6.6, 6.0, k)], look: [1.52, 0.05, 0], fov: 30, phase: (bp.i + easeInOutCubic(bp.ph)) / 8, R: 1.55, bright: 0.95 - 0.45 * kick });
    scissor(s.target, [960, 0, 960, H]);
    nightArray(A);
    A.pose((i, d) => ({ az: Math.PI + 0.35, el: 0.72, glow: 0.25 + 0.75 * kick }), t);
    const foci = A.render(ctx, s.target, { pos: [lerp(-8, -4, k), 6, 40], look: [-40, 20, -70], fov: 58, time: t,
      sky: { preset: 'night', beacon: beacon(ctx, t, 0.8), beaconDir: BEACON_DIR, starAmt: 0.9 } });
    scissor(s.target, null);
    layer2D(ctx, s.target, 'fx', (g) => {
      g.save(); g.beginPath(); g.rect(0, 0, 960, H); g.clip();
      glow(g, st.x, st.y, st.r * 2.6, [255, 120, 60], 0.55 * (1 - 0.6 * kick)); glow(g, st.x, st.y, st.r * 1.5, [255, 170, 90], 0.35);
      g.restore();
      g.save(); g.beginPath(); g.rect(960, 0, 960, H); g.clip();
      drawFoci(g, foci.filter((f) => f.x > 960), t, { k: 0.6 + 0.8 * kick });
      g.restore();
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      g.fillStyle = GOLD; g.fillRect(958, 0, 4, H);
      const w = words(ctx, 23);
      if (t > w[1].t0) T.text(g, 'BEATING', 1440, 356, { f: 'six', size: 330, align: 'center', color: PAPER, alpha: clamp((t - w[1].t0) / 0.05) });
      if (t > w[2].t0) T.text(g, 'BLINKING', 480, 356, { f: 'six', size: 330, align: 'center', color: GOLD, alpha: clamp((t - w[2].t0) / 0.05) });
      if (t > w[3].t0) T.text(g, 'of a star', 960, 800, { f: 'ital', size: 100, align: 'center', color: PAPER, alpha: clamp((t - w[3].t0) / 0.2) });
      T.label(g, 'THEIR STAR  ·  LIGHT FROM 826 AD', 480, 1010, { size: 16, color: EMBER, align: 'center' });
      T.label(g, 'OUR DISHES  ·  TONIGHT', 1440, 1010, { size: 16, color: PALE, align: 'center' });
    });
    return { bloom: 0.7, thresh: 0.8, halation: 0.3 };
  },
};

const G5 = {
  id: 'G5_transit', t0: 136.80, t1: 139.22,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur, B = shared2.beacon;
    sky(ctx, s.target, { preset: 'deep', yaw: 1.3, pitch: 0.1, fov: 40, beacon: 0, horizonY: -2, starAmt: 0.4 });
    // right up against the star: its disk fills the frame; the planet's night side crosses it
    B.render(ctx.core, s.target, { t, camPos: [0, 0, lerp(1.55, 1.45, k)], look: [0, 0, 0], fov: 40, phase: 0, R: 9, shades: false, bright: 0.85 });
    layer2D(ctx, s.target, 'type', (g) => {
      const u = lerp(0.18, 0.78, easeInOutCubic(clamp((t - 136.8) / 2.5)));
      const px = u * W, py = 640, pr = 190;
      g.fillStyle = 'rgba(255,170,90,0.55)'; g.beginPath(); g.arc(px, py, pr + 5, 0, 7); g.fill();
      g.fillStyle = '#07050a'; g.beginPath(); g.arc(px, py, pr, 0, 7); g.fill();
      const w = words(ctx, 24);
      // the words are shadows on the star too
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 190, sx: 0.8, color: '#0a0608' }, { ...w[1], f: 'hero', size: 190, sx: 0.8, color: '#0a0608' }],
        [{ ...w[2], f: 'hero', size: 300, sx: 0.8, color: '#0a0608' }]], { x: 104, y: 86, lead: 0.86 });
      T.drawBlock(g, runs, t, { anim: 'slam', hotCol: '#3a1a0a' });
      if (t > w[3].t0) T.text(g, 'is', 1790, 980, { f: 'ital', size: 120, color: '#0a0608', align: 'right', alpha: clamp((t - w[3].t0) / 0.15) });
      T.label(g, 'LGM-2 b  ·  TRANSIT  ·  DEPTH 0.13%', 110, 1030, { size: 16, color: '#2a1206' });
    });
    return { bloom: 0.55, thresh: 0.9, halation: 0.25 };
  },
};

// two systems side by side, scaled so their habitable zones line up: "not that far from my own"
function systemRow(g, T, t, { y, star, starR, starCol, auPx, planets, hz, home, homeCol, name, label, pulse = 0, alpha = 1 }) {
  const sx = 170;
  g.save(); g.globalAlpha = alpha;
  g.beginPath(); g.rect(0, y - 200, 1300, 400); g.clip();
  // habitable zone band
  g.fillStyle = 'rgba(120,220,170,0.13)'; g.beginPath(); g.arc(sx, y, hz[1] * auPx, -0.55, 0.55); g.arc(sx, y, hz[0] * auPx, 0.55, -0.55, true); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(120,220,170,0.45)'; g.lineWidth = 1.2;
  for (const r of hz) { g.beginPath(); g.arc(sx, y, r * auPx, -0.55, 0.55); g.stroke(); }
  // orbits
  for (const a of planets) { g.strokeStyle = 'rgba(142,203,255,0.35)'; g.lineWidth = 1.2; g.beginPath(); g.arc(sx, y, a * auPx, -0.55, 0.55); g.stroke(); g.fillStyle = 'rgba(244,241,232,0.7)'; g.beginPath(); g.arc(sx + a * auPx, y, 5, 0, 7); g.fill(); }
  g.strokeStyle = homeCol; g.lineWidth = 2.2; g.beginPath(); g.arc(sx, y, home * auPx, -0.55, 0.55); g.stroke();
  // star
  glow(g, sx, y, starR * 3.2, starCol, 0.6 + 0.3 * pulse); g.fillStyle = `rgb(${starCol.join(',')})`; g.beginPath(); g.arc(sx, y, starR, 0, 7); g.fill();
  // home planet
  const hx = sx + home * auPx;
  glow(g, hx, y, 34 + 30 * pulse, homeCol === PALE ? [142, 203, 255] : [255, 154, 106], 0.8);
  g.fillStyle = homeCol; g.beginPath(); g.arc(hx, y, 11, 0, 7); g.fill();
  g.restore();
  g.save(); g.globalAlpha = alpha;
  T.label(g, name, sx - 60, y - 150, { size: 18, color: homeCol === PALE ? PAPER : EMBER });
  T.label(g, label, hx + 26, y + 60, { size: 16, color: homeCol });
  g.restore();
}

const G6 = {
  id: 'G6_orbits', t0: 139.22, t1: 143.68,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    const w = words(ctx, 24);
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#05060d'; g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(142,203,255,0.06)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      const own = t > w[9].t0 ? Math.exp(-(t - w[9].t0) / 0.4) : 0;
      const a1 = smooth(139.2, 139.5, t), a2 = smooth(139.6, 139.9, t);
      systemRow(g, T, t, { y: 330, star: 'SOL', starR: 26, starCol: [255, 236, 190], auPx: 700, planets: [0.39, 0.72, 1.52], hz: [0.95, 1.37], home: 1.0, homeCol: PALE,
        name: 'SOL  ·  G2V', label: 'EARTH  ·  1.00 AU  ·  365 d', pulse: own, alpha: a1 });
      systemRow(g, T, t, { y: 760, star: 'LGM-2', starR: 16, starCol: [255, 140, 80], auPx: 9900, planets: [0.03, 0.045, 0.13], hz: [0.067, 0.097], home: 0.0707, homeCol: EMBER,
        name: 'LGM-2  ·  M4V  ·  1,200 LY', label: 'LGM-2 b  ·  0.07 AU  ·  15 d', pulse: ctx.tl.kick(t, 0.1), alpha: a2 });
      // the two home worlds line up in the same column
      const c = smooth(140.4, 141.0, t);
      g.strokeStyle = `rgba(120,220,170,${0.6 * c})`; g.setLineDash([8, 10]); g.lineWidth = 2;
      g.beginPath(); g.moveTo(870, 380); g.lineTo(870, 700); g.stroke(); g.setLineDash([]);
      T.label(g, 'HABITABLE ZONE', 890, 545, { size: 16, color: 'rgba(120,220,170,1)', alpha: c });
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const runs = T.layout(g, [[{ ...w[4], f: 'hero', size: 170, sx: 0.8 }], [{ ...w[5], f: 'hero', size: 170, sx: 0.8 }], [{ ...w[6], f: 'hero', size: 280, sx: 0.8, color: GOLD }]], { x: 1810, y: 84, lead: 0.86, align: 'right' });
      T.drawBlock(g, runs, t, { anim: 'slam' });
      T.karaoke(g, [w[7], w[8], w[9]].map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 1810, y: 960, f: 'ital', size: 110, align: 'right', lit: PALE, dim: 0.2, glow: 8 });
    });
    return { bloom: 0.5, thresh: 0.85 };
  },
};

const G7 = {
  id: 'G7_alone', t0: 143.68, t1: 147.02,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'dawn', yaw: 0.9, pitch: 0.62, fov: 52, beacon: beacon(ctx, t, 0.6) * 1.3, beaconSize: 1.4, beaconDir: [0.38, 0.62, -0.69], starAmt: 0.5, exposure: 0.85 });
    await plateLayer(ctx, s.target, { pid: 'P23_rim26', pt: syncedPT('P23_rim26', t), place: 'cover', grade: 'dawn', cam: { s: push(k, 1.0, 1.05), x: 10 * k },
      rim: { dir: [0.85, 0.3], col: [1.0, 0.82, 0.55], w: 6, amt: 0.9 } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 25);
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 160, sx: 0.8, color: PAPER }, { ...w[1], f: 'hero', size: 160, sx: 0.8, color: PAPER }],
        [{ ...w[2], f: 'ital', size: 150, text: 'we', color: PAPER }, { ...w[3], f: 'hero', size: 160, sx: 0.8, color: PAPER }]], { x: 1810, y: 110, lead: 0.92, align: 'right' });
      T.drawBlock(g, runs, t, { anim: 'slam', hotCol: '#ffffff' });
      const A = T.slamAnim(t, w[4].t0);
      if (A) {
        T.text(g, 'ALONE', 1700, 700, { f: 'hero', size: 290, sx: 0.8, align: 'right', color: NAVY, alpha: A.a });
        // the question mark lets go and falls away: it stops being a question
        const f = clamp((t - (w[4].t0 + 0.5)) / 0.8);
        T.text(g, '?', 1712 + 60 * f, 700 + 1200 * f * f, { f: 'hero', size: 290, sx: 0.8, color: EMBER, alpha: A.a * (1 - f * f), rot: 1.6 * f });
      }
    });
    return { bloom: 0.55, thresh: 0.88 };
  },
};

// ======================================================================================== ACT VIII
const H1 = {
  id: 'H1_rise', t0: 147.02, t1: 148.92,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, A = shared.arr, k = s.lt / s.dur;
    dawnArray(A);
    const hit = ctx.tl.kick(t, 0.12);
    A.pose((i, d) => ({ az: Math.PI + 0.3, el: 1.02, glow: 1 }), t);
    const e = easeInOutCubic(k), e2 = easeInCubic(k);
    const foci = A.render(ctx, s.target, { pos: [lerp(-6, 4, e), lerp(2.5, 30, e2), lerp(30, 4, e)], look: [lerp(10, 14, e), lerp(16, 160, e2), lerp(-60, -150, e)], fov: lerp(58, 66, e), time: t,
      sky: { preset: 'predawn', beacon: beacon(ctx, t, 0.7) * 1.3, beaconSize: 1.3, beaconDir: BEACON_DIR, starAmt: 0.9 } });
    layer2D(ctx, s.target, 'fx', (g) => {
      drawFoci(g, foci, t, { col: [255, 226, 160], k: 0.8 + 0.6 * hit });
      lighthouses(ctx, g, t, { n: 40, seed: 11, on: smooth(147.4, 148.9, t), rect: [0, 0, W, 520], size: 10 });
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => { T.vertical(g, '聞こえる', 1820, 120, { size: 40, color: GOLD, alpha: smooth(147.1, 147.4, t) * (1 - smooth(148.5, 148.9, t)) }); });
    return { bloom: 0.75, thresh: 0.8, halation: 0.35, flash: t < 147.1 ? 0.6 * (1 - (t - 147.02) / 0.08) : 0, flashCol: [1, 0.95, 0.85] };
  },
};

const H2 = {
  id: 'H2_group', t0: 148.92, t1: 152.71, xin: { kind: 'flash', dur: 0.16 },
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'dawn', yaw: 0.2, pitch: 0.22, fov: 55, beacon: beacon(ctx, t, 0.6) * 1.2, beaconDir: [-0.1, 0.45, -0.89], beaconSize: 1.2, starAmt: 0.55 });
    layer2D(ctx, s.target, 'lh', (g) => lighthouses(ctx, g, t, { n: 70, seed: 21, on: lerp(0.15, 0.8, k), rect: [0, 0, W, 560], size: 9 }), { mode: 'add' });
    await plateLayer(ctx, s.target, { pid: 'P24_group', pt: 0.4 + s.lt, place: 'cover', grade: 'dawn', cam: { s: push(k, 1.0, 1.05), y: -10 * k } });
    layer2D(ctx, s.target, 'type', (g) => {
      const names = [['JADE', 640, 149.39], ['CHARLIE', 880, 149.86], ['RICKY', 1110, 150.34]];
      for (const [n, x, t0] of names) {
        const a = clamp((t - t0) / 0.12);
        if (a <= 0) continue;
        g.fillStyle = `rgba(6,10,26,${0.75 * a})`; T.font(g, 'monoB', 18); g.letterSpacing = '3px';
        const tw = g.measureText(n).width + 24;
        g.fillRect(x - tw / 2, 1000, tw, 34);
        T.label(g, n, x, 1024, { size: 18, color: PAPER, align: 'center', alpha: a, f: 'monoB', track: 0.16 });
      }
      T.label(g, 'RNA  ·  2011 → 2026  ·  STILL LISTENING', 110, 80, { size: 18, color: NAVY, alpha: smooth(150.8, 151.2, t) });
    });
    return { bloom: 0.55, thresh: 0.88 };
  },
};

const H3 = {
  id: 'H3_oh', t0: 152.71, t1: 157.44,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    const n = ohCount(t);
    sky(ctx, s.target, { preset: 'predawn', yaw: 0.8, pitch: 0.45, fov: 50, beacon: beacon(ctx, t, 0.6) * 1.3, beaconDir: [0.5, 0.6, -0.62], beaconSize: 1.3, starAmt: 0.8 });
    // behind her: each "oh" lights another handful of far-off blinking stars
    layer2D(ctx, s.target, 'lh', (g) => {
      lighthouses(ctx, g, t, { n: 160, seed: 5, on: clamp(0.08 + n * 0.14 + 0.1 * k), rect: [700, 0, 1220, 1080], size: 11 });
      const last = OHS[n - 1];
      if (last) incoming(g, 1500, 300, t - last, { r0: 520, n: 1, period: 1.0, col: '255,214,140', w: 2.5, a: 0.8 * Math.exp(-(t - last) / 0.8) });
    }, { mode: 'add' });
    await plateLayer(ctx, s.target, { pid: 'P25_oh', pt: syncedPT('P25_oh', t), place: 'cover', grade: 'dawn', cam: { s: push(k, 1.03, 1.1), x: -30 * k }, cut: [0],
      rim: { dir: [0.9, -0.2], col: [1.0, 0.85, 0.6], w: 7, amt: 1.0 } });
    layer2D(ctx, s.target, 'type', (g) => {
      T.label(g, `BLINKING STARS FOUND  ${String(Math.max(1, Math.round(Math.pow(3.2, n)))).padStart(5, ' ')}`, 1810, 1010, { size: 18, color: GOLD, align: 'right' });
    });
    return { bloom: 0.65, thresh: 0.84, halation: 0.3 };
  },
};

const H4 = {
  id: 'H4_galaxy', t0: 157.44, t1: 162.18,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    const e = easeInOutCubic(k);
    // pull back from our sun until the whole galaxy is lit with lighthouses (we stay the pale, steady one)
    const sun = [260, 2, 40];
    const camPos = [lerp(sun[0] + 30, 40, e), lerp(60, 640, e), lerp(sun[2] + 170, 540, e)];
    const look = [lerp(sun[0], 0, e), lerp(sun[1], 0, e), lerp(sun[2], 0, e)];
    const bt = lerp(0.12, 1.0, easeInCubic(clamp(k * 1.1)));
    const st = GAL.render(ctx.core, s.target, { t, camPos, look, fov: 55, beaconT: bt, beat: ctx.tl.kick(t, 0.12), rot: t * 0.01 });
    layer2D(ctx, s.target, 'type', (g) => {
      if (st.sun.vis) {
        g.strokeStyle = PALE; g.lineWidth = 2; g.beginPath(); g.arc(st.sun.x, st.sun.y, 18, 0, 7); g.stroke();
        g.beginPath(); g.moveTo(st.sun.x + 13, st.sun.y - 13); g.lineTo(st.sun.x + 70, st.sun.y - 60); g.stroke();
        T.label(g, 'YOU ARE HERE  ·  LISTENING', st.sun.x + 78, Math.max(40, st.sun.y - 62), { size: 16, color: PALE });
      }
      const N = Math.round(lerp(1, 22408, Math.pow(bt, 2.2)));
      T.label(g, 'BLINKING STARS FOUND', 110, 960, { size: 18, color: GOLD });
      T.text(g, N.toLocaleString(), 104, 1040, { f: 'monoB', size: 64, color: PAPER });
    });
    const fl = t > 161.9 ? smooth(161.9, 162.18, t) * 0.4 : 0;
    return { bloom: 0.45, thresh: 0.86, halation: 0.25, flash: fl, flashCol: [1, 0.9, 0.7] };
  },
};

// ======================================================================================== ACT IX
const I1 = {
  id: 'I1_dot', t0: 162.18, t1: 167.87, xin: { kind: 'fade', dur: 0.5 },
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    layer2D(ctx, s.target, 'bg', (g) => {
      paleBlueDot(g, t, { dot: [1186, 612], zoom: lerp(1.12, 1.0, easeOutCubic(k)) });
    });
    layer2D(ctx, s.target, 'lh', (g) => lighthouses(ctx, g, t, { n: 26, seed: 9, on: 1, rect: [0, 0, W, H], size: 5, depth: 0.5 }), { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const a = smooth(163.3, 164.2, t);
      T.text(g, 'keep listening.', 960, 900, { f: 'ital', size: 96, align: 'center', color: PAPER, alpha: a });
    });
    return { bloom: 0.4, thresh: 0.8, grain: 0.06 };
  },
};

const I2 = {
  id: 'I2_end', t0: 167.87, t1: 172.36, xin: { kind: 'dip', dur: 0.6 },
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const fr = await plates.frame('ROBOT', 0);
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#060a1a'; g.fillRect(0, 0, W, H);
      const a = smooth(168.1, 168.6, t);
      g.save(); g.globalAlpha = a;
      const size = 440, cx = 1420, cy = 540;
      const pl = { s: size / fr.m.w, x: cx - size / 2, y: cy - size / 2 };
      drawTraced(g, fr, pl, { grade: { mode: 'none', over: { 10: '#252a29' } } });
      g.restore();
      T.text(g, 'RARE EARTH', 180, 470, { f: 'hero', size: 150, sx: 0.8, color: PAPER, alpha: a });
      T.text(g, 'RNA', 184, 560, { f: 'monoB', size: 40, color: GOLD, alpha: a, track: 0.3 });
      T.label(g, 'ROBOT NINJA APOCALYPSE', 186, 604, { size: 18, color: PALE, alpha: a });
      T.label(g, 'WRITTEN 2011 FOR A NIGHT AT SETI  ·  VOCALS: JADE', 186, 690, { size: 18, color: PAPER, alpha: smooth(168.6, 169.1, t) });
      T.label(g, 'M/V 2026  ·  DRAWN IN JAVASCRIPT OVER SEEDANCE 2.5 PLATES', 186, 726, { size: 16, color: 'rgba(142,203,255,0.8)', alpha: smooth(168.9, 169.4, t) });
    });
    return { bloom: 0.35, thresh: 0.9, grain: 0.05 };
  },
};

export const ACT7 = [G1, G2, G3, G4, G5, G6, G7, H1, H2, H3, H4, I1, I2];
