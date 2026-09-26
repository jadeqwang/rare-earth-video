// ACT III (42.63 - 57.90): instrumental — the search (array choreography, home screensavers, the 2011 gig, hibernation)
// ACT IV (57.90 - 80.72): bridge — the filter, the redaction, dawn, funding, Earth waits, the launch
import { plateLayer, layer2D, sky, beacon, words, push, glow, incoming, syncedPT, W, H } from './lib.js';
import { shared } from './act1.js';
import { screensaver, lineChart, panelFrame, waterfall } from '../scenes/data.js';
import { clamp, lerp, smooth, easeOutCubic, easeInOutCubic, easeOutExpo, easeOutBack, easeInExpo, hash, rng } from '../lib/util.js';

const BEACON_DIR = [-0.42, 0.5, -0.76];
// real radio observatories (lat, lon): FAST, Green Bank, ATA, VLA, Parkes, MeerKAT, GMRT, Effelsberg, Jodrell Bank, ALMA, Murchison
export const OBS = [[25.65, 106.86], [38.43, -79.84], [40.82, -121.47], [34.08, -107.62], [-33.0, 148.26], [-30.71, 21.44], [19.1, 74.05], [50.52, 6.88], [53.23, -2.31], [-23.03, -67.75], [-26.7, 116.67]];
const bar = (ctx, i) => ctx.tl.bar(i);

// shared look for the night array
export function nightArray(A) {
  A.setLook({ keyDir: [-0.55, 0.65, 0.5], dish: ['#8f9fd0', '#44518a', '#232b58'], body: ['#7d8cbc', '#3e4a80', '#20284f'],
    ground: ['#1a2350', '#161e46', '#121a3c'], fogCol: '#26336a', fogFar: 300, fogNear: 25, rim: '#bfe2ff', rimAmt: 0.55, ink: '#060918' });
}
export function dawnArray(A) {
  A.setLook({ keyDir: [0.7, 0.35, 0.5], dish: ['#e9cdb4', '#a07c80', '#584a70'], body: ['#d8bfaa', '#8e7282', '#4a3e62'],
    ground: ['#7a5a6a', '#5e465a', '#40344c'], fogCol: '#e8b08a', fogFar: 320, fogNear: 30, rim: '#ffe2b0', rimAmt: 0.6, ink: '#2a1a2e' });
}
export function drawFoci(g, foci, t, { col = [255, 212, 120], rings = true, k = 1 } = {}) {
  for (const f of foci) {
    if (f.glow <= 0.01) continue;
    const r = 2600 / f.dist;
    glow(g, f.x, f.y, r * 0.8, col, 0.85 * f.glow * k);
    if (rings && f.dist < 70) incoming(g, f.x, f.y, t, { r0: r * 2.2, n: 2, period: 0.95, w: 1.2, a: 0.4 * f.glow * k });
  }
}

// ======================================================================================== ACT III
const C1 = {
  id: 'C1_dance', t0: 42.63, t1: 46.45,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, A = shared.arr, k = s.lt / s.dur;
    nightArray(A);
    const bp = ctx.tl.beatPhase(t);
    // K-pop formation: each beat, the next row snaps up (easeOutBack); odd beats swing azimuth left/right
    A.pose((i, d) => {
      const row = d.home.r, col = d.home.c;
      const beatOf = bp.i - row;
      const snap = easeOutBack(clamp(bp.since / 0.28), 1.8);
      const up = ((bp.i + row) % 2 === 0);
      const el = up ? lerp(0.35, 0.95, snap) : lerp(0.95, 0.35, snap);
      const az = Math.PI + 0.3 * Math.sin((bp.i + col * 0.5) * 1.3);
      return { az, el, glow: up ? 1 : 0.3 };
    }, t);
    const foci = A.render(ctx, s.target, { pos: [lerp(-34, -20, k), lerp(10, 8, k), lerp(62, 52, k)], look: [8, 15, -60], fov: 56, time: t,
      sky: { preset: 'night', beacon: beacon(ctx, t, 0.7), beaconDir: BEACON_DIR } });
    layer2D(ctx, s.target, 'fx', (g) => drawFoci(g, foci, t, { rings: false }), { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const a = smooth(42.7, 43.2, t) * (1 - smooth(45.9, 46.4, t));
      T.label(g, 'RNA', 120, 150, { size: 26, color: '#ffcf5a', alpha: a, track: 0.3 });
      T.text(g, '「RARE EARTH」', 100, 270, { f: 'hero', size: 110, sx: 0.8, alpha: a });
      T.label(g, 'OFFICIAL M/V   ·   2011 / 2026', 120, 320, { size: 17, color: '#8ecbff', alpha: a });
      T.vertical(g, '聞き続けて', 1800, 140, { size: 30, color: '#8ecbff', alpha: a * 0.9 });
    });
    return { bloom: 0.6, thresh: 0.85 };
  },
};

const C2 = {
  id: 'C2_homes', t0: 46.45, t1: 50.27,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const bp = ctx.tl.beatPhase(t);
    const beatsIn = Math.max(0, bp.i - ctx.tl.beatIndex(46.46));
    const n = [1, 2, 4, 9, 16, 36, 64, 144][Math.min(7, beatsIn)];
    const cols = Math.ceil(Math.sqrt(n * 16 / 9)), rows = Math.ceil(n / cols);
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#05060d'; g.fillRect(0, 0, W, H);
      const cw = W / cols, ch = H / rows;
      let i = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (i++ >= n) break;
        const pad = Math.max(3, cw * 0.06);
        const x = c * cw + pad, y = r * ch + pad, w = cw - pad * 2, h = ch - pad * 2;
        // CRT bezel
        g.fillStyle = '#c9c2b0'; g.fillRect(x, y, w, h);
        const ix = x + w * 0.06, iy = y + h * 0.07, iw = w * 0.88, ih = h * 0.8;
        screensaver(g, { x: ix, y: iy, w: iw, h: ih, t: t + i * 0.37, hue: hash(i * 3.1) < 0.12 ? 'gold' : 'blue' });
        // scanlines
        g.fillStyle = 'rgba(0,0,0,0.18)';
        for (let yy = iy; yy < iy + ih; yy += Math.max(2, ih / 90)) g.fillRect(ix, yy, iw, 1);
      }
    });
    layer2D(ctx, s.target, 'type', (g) => {
      g.fillStyle = 'rgba(5,6,13,0.72)'; g.fillRect(0, H - 150, W, 150);
      T.text(g, 'SETI@home', 110, H - 62, { f: 'hero', size: 76, sx: 0.8, color: '#f4f1e8' });
      T.label(g, `1999–2020   ·   ${Math.floor(lerp(1, 5200000, easeOutCubic(clamp((t - 46.45) / 3.5)))).toLocaleString()} HOME COMPUTERS LISTENING FOR US`, 560, H - 78, { size: 20, color: '#ffcf5a' });
    });
    return { bloom: 0.45, thresh: 0.88, grain: 0.05 };
  },
};

const C3 = {
  id: 'C3_gig', t0: 50.27, t1: 54.08,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const b = (i) => bar(ctx, 26) + i * (bar(ctx, 27) - bar(ctx, 26)) / 4;
    // cut pattern: wide (2 beats) / charlie (1) / ricky (1) / wide (2) / jade-at-mic wide push (2)
    const cuts = [[b(0), 'wide'], [b(2), 'charlie'], [b(3), 'ricky'], [b(4), 'wide2'], [b(6), 'wide3']];
    let cur = cuts[0];
    for (const c of cuts) if (t >= c[0]) cur = c;
    const lt = t - cur[0];
    const kick = ctx.tl.kick(t, 0.1);
    if (cur[1] === 'charlie' || cur[1] === 'ricky') {
      sky(ctx, s.target, { preset: 'dusk', yaw: cur[1] === 'charlie' ? 0.6 : -0.6, pitch: 0.35, fov: 55, starAmt: 0.6 });
      layer2D(ctx, s.target, 'bokeh', (g) => {
        const R = rng(cur[1] === 'charlie' ? 3 : 4);
        for (let i = 0; i < 26; i++) { const x = R() * W, y = H * 0.25 + R() * H * 0.5; glow(g, x + lt * 20, y, 30 + R() * 50, [255, 200, 120], 0.35); }
      }, { mode: 'add' });
      const pid = cur[1] === 'charlie' ? 'P12_charlie' : 'P13_ricky';
      await plateLayer(ctx, s.target, { pid, pt: 0.6 + lt, place: 'cover', grade: 'lamp', cam: { s: 1.02 + 0.03 * kick },
        rim: { dir: cur[1] === 'charlie' ? [0.8, 0.4] : [-0.8, 0.4], col: [1.0, 0.8, 0.55], w: 6, amt: 0.8 } });
    } else {
      sky(ctx, s.target, { preset: 'dusk', yaw: 0, pitch: 0.28, fov: 58, starAmt: 0.55, beacon: beacon(ctx, t, 0.6) * 0.7, beaconDir: [-0.2, 0.62, -0.76] });
      const zoom = cur[1] === 'wide3' ? push(lt / 1.0, 1.0, 1.18) : 1.0 + 0.02 * kick;
      await plateLayer(ctx, s.target, { pid: 'P11_gig', pt: (cur[1] === 'wide2' ? 2.4 : 0.3) + lt, place: 'cover', grade: 'lamp',
        cam: { s: zoom, y: cur[1] === 'wide3' ? 60 * lt : 0 } });
    }
    layer2D(ctx, s.target, 'type', (g) => {
      T.label(g, 'RNA  ·  LIVE UNDER THE DISHES  ·  2011', 110, 1010, { size: 16, color: '#ffcf5a', alpha: 0.9 });
      if (cur[1] === 'charlie') T.label(g, 'CHARLIE — GUITAR', 1810, 1010, { size: 16, color: '#f4f1e8', align: 'right' });
      if (cur[1] === 'ricky') T.label(g, 'RICKY — GUITAR', 1810, 1010, { size: 16, color: '#f4f1e8', align: 'right' });
      if (cur[1] === 'wide3') T.label(g, 'JADE — VOCALS', 1810, 1010, { size: 16, color: '#f4f1e8', align: 'right' });
    });
    return { bloom: 0.6, thresh: 0.85, halation: 0.35 };
  },
};

const C4 = {
  id: 'C4_dark', t0: 54.08, t1: 57.90,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, A = shared.arr, k = s.lt / s.dur;
    nightArray(A);
    // one by one the receivers go dark and the dishes stow: they turn away and park pointing straight up
    A.pose((i, d) => {
      const off = 54.2 + (d.home.r * 7 + d.home.c) / 42 * 2.6;
      const u = easeInOutCubic(clamp((t - off) / 0.9));
      return { az: Math.PI + 0.25 - 1.2 * u, el: lerp(0.75, 1.52, u), glow: t < off ? 1 : 0 };
    }, t);
    const foci = A.render(ctx, s.target, { pos: [lerp(-10, -16, k), 4.5, 36], look: [10, 14, -50], fov: 56, time: t,
      sky: { preset: 'night', beacon: beacon(ctx, t, 0.6) * (1 - 0.6 * k), beaconDir: BEACON_DIR, exposure: lerp(1, 0.7, k) } });
    layer2D(ctx, s.target, 'fx', (g) => drawFoci(g, foci, t, { rings: false }), { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      // news ticker, brutalist
      const y = 930;
      g.fillStyle = '#f4f1e8'; g.fillRect(0, y, W, 72);
      g.fillStyle = '#ff2d3d'; g.fillRect(0, y, 230, 72);
      T.text(g, 'APRIL 2011', 115, y + 48, { f: 'monoB', size: 26, color: '#fff', align: 'center' });
      const msg = '42 DISHES GO DARK   ·   THE ALLEN TELESCOPE ARRAY GOES INTO HIBERNATION   ·   FUNDING SHORTFALL   ·   ';
      g.save(); g.beginPath(); g.rect(230, y, W - 230, 72); g.clip();
      const off = (t - 54.08) * 420;
      T.text(g, msg + msg, 260 - off + 700, y + 48, { f: 'monoB', size: 28, color: '#0a0a12' });
      g.restore();
    });
    return { bloom: 0.55, thresh: 0.85, exposure: lerp(1, 0.85, k) };
  },
};

// ======================================================================================== ACT IV (bridge)
const D1 = {
  id: 'D1_pad', t0: 57.90, t1: 59.24,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'dusk', yaw: 0.2, pitch: 0.25, fov: 55, starAmt: 0.5, zenith: [0.05, 0.02, 0.06], horizon: [0.45, 0.12, 0.16], glowCol: [1.0, 0.25, 0.2] });
    await plateLayer(ctx, s.target, { pid: 'P14_pad', pt: 0.4 + s.lt, place: 'cover', grade: { mul: [0.9, 0.62, 0.72], lift: [0.06, 0.02, 0.05], sat: 0.8 },
      cam: { s: push(k, 1.0, 1.1) } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 10);
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 170, sx: 0.8 }, { ...w[1], f: 'hero', size: 170, sx: 0.8 }], [{ ...w[2], f: 'six', size: 420 }]], { x: 110, y: 60, lead: 0.9 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
    });
    return { bloom: 0.55, thresh: 0.85 };
  },
};

function silo(g, x, y, w, h, t, open) {
  // missile silo: dark ground, doors sliding open, a warhead rising — flat red/black graphic
  g.fillStyle = '#12020a'; g.fillRect(x, y, w, h);
  const gy = y + h * 0.62;
  g.fillStyle = '#2a0610'; g.fillRect(x, gy, w, h - (gy - y));
  const cx = x + w / 2, dw = w * 0.36;
  g.fillStyle = '#050005'; g.fillRect(cx - dw / 2, gy - 6, dw, 18);
  const u = easeInOutCubic(open);
  const rise = u * h * 0.34;
  g.fillStyle = '#d8d0d4'; g.beginPath();
  g.moveTo(cx - dw * 0.16, gy + 10); g.lineTo(cx - dw * 0.16, gy - rise + dw * 0.2); g.quadraticCurveTo(cx, gy - rise - dw * 0.25, cx + dw * 0.16, gy - rise + dw * 0.2); g.lineTo(cx + dw * 0.16, gy + 10); g.fill();
  g.fillStyle = '#ff2d3d'; g.fillRect(cx - dw * 0.16, gy - rise + dw * 0.35, dw * 0.32, dw * 0.05);
  g.fillStyle = '#3a0a14'; g.fillRect(cx - dw / 2 - u * dw * 0.45, gy - 10, dw / 2, 12); g.fillRect(cx + u * dw * 0.45, gy - 10, dw / 2, 12);
}

const D2 = {
  id: 'D2_split', t0: 59.24, t1: 61.28,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'dusk', yaw: 0.2, pitch: 0.25, fov: 55, starAmt: 0.4, zenith: [0.05, 0.02, 0.06], horizon: [0.45, 0.12, 0.16], glowCol: [1.0, 0.25, 0.2] });
    await plateLayer(ctx, s.target, { pid: 'P14_pad', pt: 1.8 + s.lt, place: 'cover', grade: { mul: [0.9, 0.62, 0.72], lift: [0.06, 0.02, 0.05], sat: 0.8 },
      cam: { s: 1.1, x: -480 } });
    layer2D(ctx, s.target, 'right', (g) => {
      silo(g, W / 2, 0, W / 2, H, t, clamp((t - 59.9) / 1.0));
      g.fillStyle = '#ff2d3d'; g.fillRect(W / 2 - 3, 0, 6, H);
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 10);
      T.text(g, 'LAUNCH', W / 4, 980, { f: 'six', size: 190, align: 'center', color: '#f4f1e8' });
      if (t > w[3].t0) T.text(g, 'or', W / 2, 560, { f: 'ital', size: 120, align: 'center', color: '#ffcf5a' });
      if (t > w[4].t0) T.text(g, 'SELF-DESTRUCT', W * 0.75, 980, { f: 'six', size: 190, align: 'center', color: '#ff2d3d' });
    });
    return { bloom: 0.5, thresh: 0.85 };
  },
};

const D3 = {
  id: 'D3_wars', t0: 61.28, t1: 64.45,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const w = words(ctx, 11);
    const strobe = ctx.tl.kick(t, 0.07);
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = t < w[2].t0 ? '#0a0003' : '#070003'; g.fillRect(0, 0, W, H);
      // doomsday clock, hands creeping toward midnight on each beat
      const cx = 1420, cy = 540, R = 330;
      g.strokeStyle = 'rgba(255,45,61,0.8)'; g.lineWidth = 6; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
      for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.lineWidth = i % 3 === 0 ? 8 : 3; g.beginPath(); g.moveTo(cx + Math.sin(a) * R * 0.86, cy - Math.cos(a) * R * 0.86); g.lineTo(cx + Math.sin(a) * R * 0.97, cy - Math.cos(a) * R * 0.97); g.stroke(); }
      const bp = ctx.tl.beatPhase(t);
      const steps = bp.i - ctx.tl.beatIndex(61.28) + easeOutBack(clamp(bp.since / 0.12), 2);
      const mins = -9 + steps * 1.1;
      const am = mins / 60 * Math.PI * 2, ah = (mins / 60 / 12) * Math.PI * 2;
      g.strokeStyle = '#f4f1e8'; g.lineCap = 'round';
      g.lineWidth = 16; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(ah) * R * 0.5, cy - Math.cos(ah) * R * 0.5); g.stroke();
      g.lineWidth = 9; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(am) * R * 0.82, cy - Math.cos(am) * R * 0.82); g.stroke();
      g.fillStyle = '#ff2d3d'; g.beginPath(); g.arc(cx, cy, 14, 0, 7); g.fill();
    });
    layer2D(ctx, s.target, 'type', (g) => {
      if (t > w[0].t0) T.text(g, 'WEAPONS', 100, 430, { f: 'six', size: 470, color: '#ff2d3d', alpha: t < w[1].t0 ? 1 : 0.25 });
      if (t > w[1].t0) T.text(g, 'WARS', 100, 900, { f: 'six', size: 470, color: '#ff2d3d', alpha: t < w[2].t0 ? 1 : 0.25 });
      if (t > w[2].t0) T.text(g, 'and now we’re', 110, 1000, { f: 'ital', size: 96, color: '#f4f1e8' });
    });
    return { bloom: 0.5, thresh: 0.85, flash: 0.08 * strobe, flashCol: [1, 0.2, 0.25] };
  },
};

const D4 = {
  id: 'D4_redact', t0: 64.45, t1: 65.41,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const lt = t - 64.45;
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#f4f1e8'; g.fillRect(0, 0, W, H);
      T.label(g, 'DECLASSIFIED  ·  FILE 2011-RE-042  ·  PAGE 3 OF 3', 140, 120, { size: 18, color: '#0a0a12' });
      T.text(g, 'WEAPONS, WARS, AND NOW WE’RE', 140, 470, { f: 'monoB', size: 60, color: '#0a0a12' });
      // the bar slams in on the silence
      const slam = easeOutExpo(clamp(lt / 0.06));
      const bx = 140, by = 540, bw = 1320 * slam, bh = 150;
      g.fillStyle = '#050507'; g.fillRect(bx, by, bw, bh);
      // badly redacted: the word underneath ghosts through
      if (lt > 0.18 && lt < 0.62) T.text(g, 'COOKED', bx + 40, by + 118, { f: 'monoB', size: 118, color: '#1c1c22' });
      if (lt >= 0.62) T.text(g, 'SO BACK', bx + 40, by + 118, { f: 'monoB', size: 118, color: '#f4f1e8', glow: 12 });
      T.label(g, '[REDACTED]', bx + bw - 10, by + bh + 34, { size: 18, color: '#ff2d3d', align: 'right', alpha: slam });
      // stamp
      g.save(); g.translate(1500, 860); g.rotate(-0.18);
      g.strokeStyle = '#ff2d3d'; g.lineWidth = 6; g.strokeRect(-190, -60, 380, 110);
      T.text(g, 'CLASSIFIED', 0, 20, { f: 'monoB', size: 54, color: '#ff2d3d', align: 'center' });
      g.restore();
    });
    return { bloom: 0.2, thresh: 0.95, grain: 0.07, vig: 0.15 };
  },
};

const D5 = {
  id: 'D5_wake', t0: 65.41, t1: 67.34,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, A = shared.arr, k = s.lt / s.dur;
    dawnArray(A);
    A.pose((i, d) => {
      const off = 65.45 + (d.home.r * 0.08 + Math.abs(d.home.c - 3) * 0.05);
      const u = easeOutBack(clamp((t - off) / 0.6), 1.4);
      return { az: Math.PI + 0.2, el: lerp(0.08, 0.8, u), glow: t > off + 0.3 ? 1 : 0 };
    }, t);
    const foci = A.render(ctx, s.target, { pos: [lerp(-6, -2, k), 4.0, 34], look: [12, lerp(12, 18, k), -50], fov: 56, time: t,
      sky: { preset: 'dawn', beacon: 0.5, beaconDir: BEACON_DIR, starAmt: 0.2 } });
    layer2D(ctx, s.target, 'fx', (g) => drawFoci(g, foci, t, { col: [255, 230, 170] }), { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 12);
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 220, sx: 0.8, color: '#2a1a2e' }, { ...w[1], f: 'hero', size: 220, sx: 0.8, color: '#2a1a2e' }],
        [{ ...w[2], f: 'ital', size: 240, text: 'looking', color: '#2a1a2e' }]], { x: 110, y: 60, lead: 0.86 });
      T.drawBlock(g, runs, t, { anim: 'slam', hotCol: '#ffffff' });
    });
    return { bloom: 0.4, thresh: 0.93 };
  },
};

const D5b = {
  id: 'D5b_faith', t0: 67.34, t1: 69.00,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    await plateLayer(ctx, s.target, { pid: 'P15_dawn', pt: syncedPT('P15_dawn', t), place: 'cover', grade: 'dawn', cam: { s: push(k, 1.04, 1.1), x: 40 * k } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 12);
      T.karaoke(g, [w[3], w[4], w[5]].map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 110, y: 980, f: 'ital', size: 110, lit: '#fff4dc', dim: 0.25, glow: 10 });
    });
    return { bloom: 0.55, thresh: 0.88 };
  },
};

const D6 = {
  id: 'D6_funding', t0: 69.00, t1: 72.22,
  async render(ctx, s) {
    const t = s.t, T = ctx.type;
    const w = words(ctx, 13);
    layer2D(ctx, s.target, 'bg', (g) => {
      g.fillStyle = '#0b0a14'; g.fillRect(0, 0, W, H);
      // grid paper
      g.strokeStyle = 'rgba(255,207,90,0.07)'; g.lineWidth = 1;
      for (let x = 0; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      for (let y = 0; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
      const pts = [];
      for (let i = 0; i <= 40; i++) { const u = i / 40; pts.push(clamp(0.08 + 0.1 * Math.sin(u * 9) * (1 - u) + Math.pow(u, 2.2) * 0.82 + (hash(i) - 0.5) * 0.03)); }
      lineChart(g, { x: 760, y: 170, w: 1040, h: 620, t, t0: 69.4, dur: 2.4, pts, color: '#ffcf5a', label: 'KEEP LISTENING', yLabel: 'HOURS OF SKY SEARCHED' });
    });
    layer2D(ctx, s.target, 'type', (g) => {
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 200, sx: 0.8 }, { ...w[1], f: 'hero', size: 200, sx: 0.8 }], [{ ...w[2], f: 'six', size: 380, color: '#ffcf5a' }]], { x: 100, y: 80, lead: 0.9 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
      if (t > w[3].t0) T.karaoke(g, [w[3], w[4], w[5]].map((x) => ({ ...x, text: x.text.toLowerCase() })), t, { x: 110, y: 1000, f: 'ital', size: 84, dim: 0.25 });
    });
    return { bloom: 0.5, thresh: 0.88 };
  },
};

const D7 = {
  id: 'D7_waits', t0: 72.22, t1: 76.44,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    sky(ctx, s.target, { preset: 'deep', yaw: 2.0, pitch: 0.1, fov: 30, beacon: beacon(ctx, t, 0.5) * 0.8, beaconDir: [0.55, 0.25, -0.8], horizonY: -2 });
    const E = shared.earth;
    E.render(ctx.core, s.target, { pos: [0, 0, lerp(4.6, 4.2, easeInOutCubic(k))], look: [0, 0, 0], fov: 30, rotY: 3.5 + (t - 72.22) * 0.035, tilt: 0.35,
      sun: [0.75, 0.25, 0.6], at: [0.15, -0.62, 0], cloud: t * 0.004, dayGain: 0.7, lights: 1.3 });
    layer2D(ctx, s.target, 'fx', (g) => {
      // Earth's real radio observatories glow as the song's kicks arrive (receivers only: light flows IN)
      const kick = ctx.tl.kick(t, 0.2);
      OBS.forEach(([lat, lon], i) => {
        const p = E.project(lat, lon, 1.004);
        if (p.face < 0.08) return;
        const a = clamp(p.face * 4) * (0.55 + 0.45 * kick);
        glow(g, p.x, p.y, 26, [255, 214, 130], a);
        incoming(g, p.x, p.y, t + i * 0.13, { r0: 46, n: 2, period: 1.1, w: 1.2, a: 0.5 * a });
      });
    }, { mode: 'add' });
    layer2D(ctx, s.target, 'type', (g) => {
      const w13 = words(ctx, 13), w14 = words(ctx, 14);
      const A = T.slamAnim(t, w13[5].t0);
      if (A) T.text(g, 'OUR PLANET WAITS', 960, 190, { f: 'hero', size: 150, sx: 0.8, align: 'center', alpha: A.a });
      T.typewriter(g, 'for your transmission', t, w14[0].t0, { x: 960 - 330, y: 290, size: 46, cps: 14, color: '#ffcf5a' });
      T.label(g, 'LISTENING ONLY  ·  NO REPLY SENT', 960, 1010, { size: 16, color: '#8ecbff', align: 'center', alpha: smooth(74.5, 75.2, t) });
    });
    return { bloom: 0.6, thresh: 0.85 };
  },
};

const D8 = {
  id: 'D8_launch', t0: 76.44, t1: 78.35,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    const sh = ctx.tl.kick(t, 0.1);
    await plateLayer(ctx, s.target, { pid: 'P16_launch', pt: 0.2 + s.lt * 1.1, place: 'cover', grade: 'dawn',
      cam: { s: push(k, 1.02, 1.12) + 0.01 * sh, x: (Math.random() - 0.5) * 0, y: 8 * sh } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 15);
      const runs = T.layout(g, [[{ ...w[0], f: 'hero', size: 150, sx: 0.8, color: '#1c2552' }, { ...w[1], f: 'hero', size: 150, sx: 0.8, color: '#1c2552' }],
        [{ ...w[2], f: 'ital', size: 130, text: 'has a', color: '#1c2552' }]], { x: 100, y: 60, lead: 0.95 });
      T.drawBlock(g, runs, t, { anim: 'slam' });
    });
    return { bloom: 0.7, thresh: 0.82, halation: 0.4 };
  },
};

const D9 = {
  id: 'D9_vision', t0: 78.35, t1: 79.82,
  async render(ctx, s) {
    const t = s.t, T = ctx.type, k = s.lt / s.dur;
    await plateLayer(ctx, s.target, { pid: 'P17_crowd', pt: 0.5 + s.lt, place: 'cover', grade: 'dawn', cam: { s: push(k, 1.0, 1.06) } });
    layer2D(ctx, s.target, 'type', (g) => {
      const w = words(ctx, 15);
      const A = T.slamAnim(t, w[4].t0, { from: 1.25 });
      if (A) T.text(g, 'VISION', 960, 900, { f: 'six', size: 820, align: 'center', color: '#fff8ea', alpha: A.a * 0.95, glow: 30 * A.hot });
    });
    const flash = t > 78.56 && t < 78.7 ? 0.5 : 0;
    return { bloom: 0.35, thresh: 0.95, halation: 0.2, flash, flashCol: [1, 0.92, 0.75] };
  },
};

export const ACT3 = [C1, C2, C3, C4, D1, D2, D3, D4, D5, D5b, D6, D7, D8, D9];
