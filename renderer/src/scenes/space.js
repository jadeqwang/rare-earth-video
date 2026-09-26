// Space scenes in the LIGHT material.

import { clamp, lerp, ease, hex, invlerp, smooth, hash, COLORS } from '../util.js';
import { Space } from '../space.js';
import { drawCues } from './common.js';
import { setFont, drawText, label, typeOn, heroWord, fitPx } from '../type.js';

let SP;
const D2R = Math.PI / 180;
export const SF = { lat: 37.77, lon: -122.42 };

// Screen position (top-left px) of a geographic point on a globe drawn with (lon, tilt) at centerGL/radius.
export function geoToScreen(e, lat, lon, gLon, gTilt, centerGL, radius) {
  const f = lat * D2R, l = lon * D2R;
  let q = [Math.cos(f) * Math.sin(l), Math.sin(f), Math.cos(f) * Math.cos(l)];
  const cl = Math.cos(gLon), sl = Math.sin(gLon), ct = Math.cos(gTilt), st = Math.sin(gTilt);
  q = [cl * q[0] - sl * q[2], q[1], sl * q[0] + cl * q[2]];
  q = [q[0], ct * q[1] + st * q[2], -st * q[1] + ct * q[2]];
  return { x: centerGL[0] + radius * q[0], y: e.H - (centerGL[1] + radius * q[1]), vis: q[2] > 0 };
}

export const spaceScenes = {
  async init(e) { SP = new Space(e); await SP.init(); e.space = SP; },

  // 0.00-3.82: Voyager's pale blue dot, then a continuous zoom into Earth's night side,
  // ending on one light (San Francisco) that becomes the recorder's LED.
  paleDot: {
    async render(ctx, p) {
      const { e, g, lt, W, H, S, o, t } = ctx;
      const dotP = [0.64, 0.40]; // uv (y up)
      const z0 = 1.0, z1 = 3.15; // zoom window (shot-local seconds)
      const k = clamp((lt - z0) / (z1 - z0));
      const kz = k < 0.5 ? 2 * k * k : k; // gentle start, then constant exponential zoom
      // radius grows exponentially; capped while city lights are still crisp dots
      const radius = 2.2 * S * Math.pow(1150, kz);
      const cx = lerp(dotP[0] * W, W * 0.5, ease.inOutCubic(clamp(k * 1.6)));
      const cy = lerp(dotP[1] * H, H * 0.5, ease.inOutCubic(clamp(k * 1.6)));
      const gLon = (SF.lon * D2R) + lerp(0.55, 0.0, ease.outCubic(clamp(k * 1.3)));
      const gTilt = -SF.lat * D2R + lerp(0.25, 0, ease.outCubic(clamp(k * 1.3)));
      const endFade = smooth(3.3, 3.62, lt); // everything but one light fades
      SP.paleDot(SP.tmpA, { t, dotR: lerp(2.6, 0.1, clamp(k * 5)) * (1 + 0.25 * Math.sin(t * 5)), dotP, bands: 1 - smooth(0.0, 0.35, k), grain: 0.03 });
      if (k > 0) {
        SP.body(SP.tmpA, ctx.out, {
          center: [cx, cy], radius: Math.max(1.5 * S, radius), lon: gLon, tilt: gTilt, kind: 'earth',
          sun: [-0.9, 0.35, -0.2], colA: '#163E86', colB: '#8FB6F0', colC: '#FFB14A', city: 1.3, atmo: 1.0, cell: 6,
          alpha: smooth(0, 0.05, k) * (1 - endFade),
        });
      } else SP.copy(SP.tmpA, ctx.out);
      // labels
      const a0 = 1 - smooth(0.85, 1.15, lt);
      if (a0 > 0) {
        o.save(); o.globalAlpha = a0;
        typeOn(o, 'PALE BLUE DOT — VOYAGER 1 — 14 FEB 1990 — 6 BILLION KM', 120 * S, H - 110 * S, t, 0.1, { px: 22 * S, cps: 60, fill: '#C9D8F2', cursor: false });
        o.restore();
      }
      // the hook: a hero-sized "YOU ARE HERE" pointing at the dot, gone as the zoom starts
      // (on screen from frame 0: the first frame is the feed thumbnail)
      const hk = { a: 1, s: lerp(1.05, 1.0, ease.outCubic(clamp(lt / 0.35))) };
      const hA = hk.a * (1 - smooth(1.05, 1.4, lt));
      if (hA > 0) {
        const dx = dotP[0] * W, dy = (1 - dotP[1]) * H;
        const tx = dx - 120 * S, ty = dy + 118 * S;
        const hpx = fitPx(o, 'YOU ARE HERE', tx - 26 * S - 96 * S, { fam: 'hero', wght: 900 }, 132 * S);
        o.save(); o.globalAlpha = hA;
        o.strokeStyle = '#C9D8F2'; o.lineWidth = 2.5 * S;
        o.beginPath(); o.moveTo(dx - 12 * S, dy + 12 * S); o.lineTo(tx + 20 * S, ty - 58 * S); o.lineTo(tx - 12 * S, ty - 58 * S); o.stroke();
        o.restore();
        setFont(o, { fam: 'hero', px: hpx, wght: 900, stretch: 100 });
        drawText(o, 'YOU ARE HERE', tx - 26 * S, ty, { scale: hk.s, alpha: hA, fill: '#F4F1EA', align: 'right' });
      }
      // final beat: one light (San Francisco) survives, turns red, and becomes the recorder's LED
      if (lt > 3.1) {
        const u2 = clamp((lt - 3.1) / 0.5);
        const col = [Math.round(lerp(255, 255, u2)), Math.round(lerp(190, 60, u2)), Math.round(lerp(90, 50, u2))];
        const r = lerp(8, 22, ease.outCubic(u2)) * S;
        o.save(); o.globalCompositeOperation = 'lighter';
        const gr = o.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, r * 5);
        gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${0.4 + 0.6 * u2})`); gr.addColorStop(0.22, `rgba(${col[0]},${col[1]},${col[2]},${0.25 + 0.4 * u2})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = gr; o.fillRect(W / 2 - r * 5, H / 2 - r * 5, r * 10, r * 10);
        o.restore();
      }
      ctx.fx.bloom = Math.max(ctx.fx.bloom, 0.8); ctx.fx.vignette = 0.5;
      drawCues(ctx, p.cues);
    },
  },

  // A single LED dot on black with the first sung word.
  ledDot: {
    async render(ctx, p) {
      const { o, W, H, S, t, lt } = ctx;
      SP.stars(ctx.out, { t, density: 0.0, bright: 0 });
      const r = 22 * S;
      const gr = o.createRadialGradient(W * 0.5, H * 0.5, 0, W * 0.5, H * 0.5, r * 5);
      gr.addColorStop(0, 'rgba(255,80,70,1)'); gr.addColorStop(0.2, 'rgba(255,40,40,0.7)'); gr.addColorStop(1, 'rgba(255,0,0,0)');
      o.fillStyle = gr; o.fillRect(0, 0, W, H);
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 1.1;
    },
  },

  // Earth globe (title / pale blue dot moments).
  globe: {
    async render(ctx, p) {
      const { e, t, lt, u, W, H, S, o } = ctx;
      SP.stars(SP.tmpA, { t, density: 0.35, bright: 0.8, zoom: 1 + u * 0.1, mw: p.mw ?? 0.3, mwAng: 0.6 });
      const rr = typeof p.radius === 'function' ? p.radius(ctx) : (p.radius ?? 330) * S;
      const c = typeof p.center === 'function' ? p.center(ctx) : [W * (p.cx ?? 0.5), H * (p.cy ?? 0.5)];
      const lon = (p.lon ?? -100) * D2R + (p.spin ?? 0.12) * lt;
      SP.body(SP.tmpA, ctx.out, {
        center: c, radius: rr, lon, tilt: (p.tilt ?? -25) * D2R, kind: 'earth', sun: p.sun || [0.75, 0.25, 0.6],
        colA: '#123A80', colB: '#9CC8FF', colC: '#FFB14A', city: 1.2, atmo: 1.1, cell: p.cell ?? 6,
      });
      if (p.rings) signalRings(ctx, c, rr, p.rings);
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 0.9;
    },
  },

  // Star field / Milky Way (zoom out on "how could we be alone").
  galaxy: {
    async render(ctx, p) {
      const { t, u, W, H, S, o, lt } = ctx;
      const zoom = lerp(p.z0 ?? 3.0, p.z1 ?? 0.8, ease.inOutCubic(u));
      SP.stars(ctx.out, { t, zoom, density: 0.42, bright: 0.85, mw: 0.9, mwAng: 0.45 + u * 0.1, rot: u * 0.1, twinkle: 1 });
      if (p.dots) { // the two dots: Earth (pale blue) and GJ 1002 (red), connected
        const k = 1 / zoom;
        const a = [W * 0.5 - 260 * S * k * 3, H * 0.52], b = [W * 0.5 + 260 * S * k * 3, H * 0.47];
        drawLinkedDots(o, a, b, S, 1 - smooth(0.4, 0.9, u), t);
      }
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 1.0;
    },
  },

  // Warp through interstellar space with distance/year counters.
  warp: {
    async render(ctx, p) {
      const { t, lt, u, W, H, S, o, dur } = ctx;
      const speed = ease.inOutCubic(clamp(u * 1.2));
      SP.stars(ctx.out, { t, zoom: 1 + u * 2, density: 0.45, bright: 0.9, warp: 0.25 + speed * 1.2, warpT: lt * (0.8 + speed * 2.5), mw: 0.3 });
      // counters
      const ly = lerp(p.ly0 ?? 0.0, p.ly1 ?? 15.8, ease.inOutCubic(u));
      const yr = 2011 + ly;
      setFont(o, { fam: 'mono', px: 22 * S, wght: 600 });
      o.fillStyle = '#9CC8FF'; o.textAlign = 'left';
      o.fillText(`DISTANCE  ${ly.toFixed(2).padStart(6, ' ')} LY`, 120 * S, H - 150 * S);
      o.fillText(`YEAR      ${Math.floor(yr)}`, 120 * S, H - 116 * S);
      o.fillText(`SIGNAL    RARE EARTH (RNA, 2011)`, 120 * S, H - 82 * S);
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 1.1; ctx.fx.aberr = speed * 0.6;
    },
  },

  // Solar-system flyby of the outgoing broadcast: bodies sweep past with light-time labels.
  flyby: {
    async render(ctx, p) {
      const { t, lt, u, W, H, S, o, dur } = ctx;
      const stops = [
        { name: 'MOON', note: '1.3 LIGHT-SECONDS', kind: 'moon', colA: '#5E6470', colB: '#E6E8EE' },
        { name: 'MARS', note: '~12 LIGHT-MINUTES', kind: 'moon', colA: '#6B2A18', colB: '#E8835A' },
        { name: 'JUPITER', note: '~43 LIGHT-MINUTES', kind: 'giant', colA: '#8A5A36', colB: '#F2DDB8' },
        { name: 'SATURN', note: '~80 LIGHT-MINUTES', kind: 'giant', colA: '#9A7A48', colB: '#F6E6BE', ring: true },
      ];
      const seg = dur / (stops.length + 1);
      const i = Math.min(stops.length, Math.floor(lt / seg));
      const k = (lt - i * seg) / seg;
      SP.stars(SP.tmpA, { t, zoom: 1 + lt * 0.3, density: 0.45, bright: 0.8, warp: 0.15, warpT: lt * 0.6 });
      if (i < stops.length) {
        const st = stops[i];
        // constant-speed pass that is on screen for its whole slot (each body gets ~0.75 s)
        const r = (st.kind === 'giant' ? 400 : 290) * S * lerp(0.85, 1.2, k);
        const x = lerp(W + r * (st.ring ? 1.5 : 1.0), -r * (st.ring ? 1.5 : 1.0), k);
        SP.body(SP.tmpA, ctx.out, { center: [x, H * 0.46], radius: r, kind: st.kind, lon: lt * 0.3, tilt: 0.25, sun: [0.9, 0.2, 0.35],
          colA: st.colA, colB: st.colB, atmo: 0.25, atmoCol: '#FFFFFF', cell: 7, t });
        if (st.ring) {
          o.save(); o.translate(x, H - H * 0.46); o.rotate(-0.25); o.strokeStyle = 'rgba(246,230,190,0.55)';
          for (let q = 0; q < 6; q++) { o.lineWidth = (5 - q * 0.6) * S; o.beginPath(); o.ellipse(0, 0, r * (1.45 + q * 0.07), r * (0.28 + q * 0.014), 0, 0, 7); o.stroke(); }
          o.restore();
        }
        label(o, `${st.name} · ${st.note}`, clamp(x, W * 0.2, W * 0.8), H - H * 0.46 - r - 40 * S, { px: 24, S, fill: '#DCE8FF', align: 'center', alpha: clamp(1 - Math.abs(k - 0.5) * 1.6) });
      } else {
        SP.copy(SP.tmpA, ctx.out);
        // Voyager 1, drawn as a line figure
        const x = lerp(W * 1.1, W * 0.2, ease.inOutCubic(k)), y = H * 0.48, s2 = 2.2 * S;
        voyager(o, x, y, s2, t);
        label(o, 'VOYAGER 1 · ~23 LIGHT-HOURS · LAUNCHED 1977', x, y + 120 * S, { px: 18, S, fill: '#DCE8FF', align: 'center' });
      }
      // the broadcast: a line of light racing ahead
      o.save(); o.globalCompositeOperation = 'lighter';
      const gy = H * 0.84;
      const gr = o.createLinearGradient(0, 0, W, 0);
      gr.addColorStop(0, 'rgba(156,200,255,0)'); gr.addColorStop(0.7, 'rgba(156,200,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0.95)');
      o.strokeStyle = gr; o.lineWidth = 3 * S; o.beginPath(); o.moveTo(0, gy); o.lineTo(W * 0.92, gy); o.stroke();
      o.restore();
      setFont(o, { fam: 'mono', px: 20 * S, wght: 600 }); o.fillStyle = '#9CC8FF'; o.textAlign = 'left';
      o.fillText('BROADCAST: RARE EARTH · RNA · 2011 · 299,792 KM/S', 90 * S, H * 0.84 - 18 * S);
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 0.8;
    },
  },

  // Approach to GJ 1002: the red dwarf, flares, two planets.
  redDwarf: {
    async render(ctx, p) {
      const { t, lt, u, W, H, S, o } = ctx;
      SP.stars(SP.tmpA, { t, zoom: 1.2 + u * 0.3, density: 0.4, bright: 0.7, tint: [1.0, 0.85, 0.85] });
      const r = lerp(p.r0 ?? 120, p.r1 ?? 420, ease.inOutCubic(u)) * S;
      const c = [W * lerp(0.62, 0.66, u), H * 0.5];
      SP.body(SP.tmpA, ctx.out, { center: c, radius: r, kind: 'star', t, colA: '#5A0A1E', colB: '#FF5230', flare: 1.2, atmo: 0.8, atmoCol: '#FF4B2B', cell: 7 });
      // planets b and c on their orbits
      o.save(); o.globalCompositeOperation = 'lighter';
      for (const [name, ar, per, ph] of [['b', 1.7, 10.3, 0.2], ['c', 2.7, 21.2, 0.63]]) {
        const a = (t / per) * 6.2 + ph * 6.28;
        const ox = c[0] + Math.cos(a) * r * ar, oy = H - c[1] + Math.sin(a) * r * ar * 0.28;
        o.strokeStyle = 'rgba(255,120,90,0.18)'; o.lineWidth = 1 * S; o.beginPath(); o.ellipse(c[0], H - c[1], r * ar, r * ar * 0.28, 0, 0, 7); o.stroke();
        o.fillStyle = name === 'c' ? '#7FF0E0' : '#E0C8C0'; o.beginPath(); o.arc(ox, oy, (name === 'c' ? 7 : 5) * S, 0, 7); o.fill();
        label(o, `GJ 1002 ${name}`, ox + 10 * S, oy - 10 * S, { px: 15, S, fill: name === 'c' ? '#7FF0E0' : '#E0C8C0', alpha: 0.9 });
      }
      o.restore();
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 1.0; ctx.fx.thresh = 0.55;
    },
  },

  // GJ 1002 c from orbit: an eyeball world, a ring of lights on the terminator.
  alienOrbit: {
    async render(ctx, p) {
      const { t, lt, u, W, H, S, o, tim } = ctx;
      SP.stars(SP.tmpA, { t, zoom: 1.1, density: 0.45, bright: 0.7, rot: u * 0.05 });
      const r = (p.r ?? 360) * S * lerp(p.z0 ?? 0.95, p.z1 ?? 1.1, ease.inOutCubic(u));
      const listen = p.listen ? (0.35 + 1.4 * tim.vocal(t)) : 1;
      const city = (p.city ?? 1) * listen * (p.fadeLights ? lerp(1, 0.15, smooth(0.0, 0.4, u)) + smooth(0.45, 1.0, u) * listen : 1);
      SP.body(SP.tmpA, ctx.out, { center: [W * (p.cx ?? 0.5), H * 0.5], radius: r, kind: 'eyeball', lon: lt * 0.08 + (p.lon0 ?? 0.4), tilt: 0.35,
        sun: [0.95, 0.15, 0.15], colA: '#FF6A3D', colB: '#C23A2A', colC: '#2FE6D3', city, atmo: 0.9, atmoCol: '#FF7A5A', cell: 6, t });
      if (p.incoming) { // Earth's signal arriving from the left: wavefronts sweep across the planet
        const pc = [W * (p.cx ?? 0.5), H * 0.5], far = W * 2.2, period = p.incoming.period ?? 1.9;
        o.save(); o.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) {
          const ph = ((lt / period) + i / 4) % 1;
          const x = lerp(-W * 0.15, W * 1.15, ph);
          const R = far + (x - pc[0]);
          const hit = Math.exp(-Math.pow((x - pc[0]) / (r * 0.9), 2));
          o.strokeStyle = `rgba(156,200,255,${(0.18 + 0.5 * hit) * (1 - ph * 0.5)})`;
          o.lineWidth = (2 + 3 * hit) * S;
          o.beginPath(); o.arc(pc[0] - far, pc[1], R, -0.45, 0.45); o.stroke();
        }
        o.restore();
      }
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 1.0; ctx.fx.thresh = 0.55;
    },
  },

  // Tail: pull back from Earth to the pale blue dot; the two dots, linked; the ledger.
  tail: {
    async render(ctx, p) {
      const { t, lt, u, W, H, S, o, dur } = ctx;
      SP.stars(SP.tmpA, { t, zoom: lerp(1.0, 1.6, ease.inOutCubic(u)), density: 0.3, bright: 0.55, mw: 0.35, mwAng: 0.5 });
      const k = ease.inOutCubic(clamp(lt / 3.4));
      const r = lerp(300, 3.2, k) * S;
      const c = [lerp(W * 0.5, W * 0.24, k), lerp(H * 0.5, H * 0.56, k)];
      SP.body(SP.tmpA, ctx.out, { center: c, radius: r, kind: 'earth', lon: (-100 * Math.PI / 180) + lt * 0.08, tilt: -0.38,
        sun: [0.75, 0.25, 0.6], colA: '#123A80', colB: '#9CC8FF', colC: '#FFB14A', city: 1.2, atmo: 1.1, cell: 6 });
      const a2 = smooth(3.0, 3.8, lt);
      if (a2 > 0) {
        const a = [c[0], H - c[1]], b = [W * 0.8, H * 0.36];
        drawLinkedDots(o, a, b, S * 1.6, a2, t);
        label(o, 'EARTH', a[0], a[1] + 44 * S, { px: 26, S, fill: '#9CC8FF', align: 'center', alpha: a2 });
        label(o, 'GJ 1002', b[0], b[1] - 44 * S, { px: 26, S, fill: '#FF8A6B', align: 'center', alpha: a2 });
        // the ledger is the film's last line of plot: sized to read on a phone
        const lines = ['DEPARTED EARTH ····· 2011', 'ARRIVES GJ 1002 ···· 2027', 'REPLY ETA ·········· 2043'];
        lines.forEach((L, i) => typeOn(o, L, W * 0.4, H * (0.6 + i * 0.085), t, ctx.shot.t0 + 3.6 + i * 0.9, { px: 46 * S, cps: 34, fill: '#DCE8FF', cursor: i === lines.length - 1 && lt < 7.0 }));
        const kk = clamp((lt - 7.0) / 0.4);
        if (kk > 0) { setFont(o, { fam: 'voice', px: 96 * S }); drawText(o, 'keep listening.', W * 0.4, H * 0.93, { fill: '#FFFFFF', alpha: kk, align: 'left' }); }
      }
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 0.9;
    },
  },
};

// Expanding signal rings from a point (Earth broadcasting).
export function signalRings(ctx, c, r0, o2 = {}) {
  const { o, t, S, tim, H } = ctx;
  const period = o2.period ?? 0.95, n = o2.n ?? 5;
  o.save();
  o.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const ph = ((t / period) + i / n) % 1;
    const r = r0 * (1.02 + ph * (o2.spread ?? 2.8));
    o.strokeStyle = `rgba(156,200,255,${(1 - ph) * 0.55})`;
    o.lineWidth = (2.2 - ph * 1.6) * S;
    o.beginPath(); o.arc(c[0], H - c[1], r, 0, Math.PI * 2); o.stroke();
  }
  o.restore();
}

export function drawLinkedDots(o, a, b, S, alpha, t) {
  if (alpha <= 0) return;
  o.save(); o.globalAlpha = alpha; o.globalCompositeOperation = 'lighter';
  o.strokeStyle = 'rgba(200,220,255,0.35)'; o.lineWidth = 1.2 * S; o.setLineDash([6 * S, 6 * S]);
  o.beginPath(); o.moveTo(a[0], a[1]); o.lineTo(b[0], b[1]); o.stroke(); o.setLineDash([]);
  for (const [p, col] of [[a, '156,200,255'], [b, '255,90,60']]) {
    const gr = o.createRadialGradient(p[0], p[1], 0, p[0], p[1], 18 * S);
    gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.3, `rgba(${col},0.4)`); gr.addColorStop(1, `rgba(${col},0)`);
    o.fillStyle = gr; o.fillRect(p[0] - 20 * S, p[1] - 20 * S, 40 * S, 40 * S);
  }
  o.restore();
}

function voyager(o, x, y, s, t) {
  o.save(); o.translate(x, y); o.rotate(-0.15); o.strokeStyle = '#E8EEF8'; o.fillStyle = 'rgba(232,238,248,0.12)'; o.lineWidth = 1.6 * s / 2.2;
  o.beginPath(); o.ellipse(0, 0, 36 * s, 36 * s * 0.35, 0, 0, 7); o.fill(); o.stroke();          // high-gain antenna
  o.beginPath(); o.moveTo(0, 0); o.lineTo(0, -14 * s); o.stroke();
  o.strokeRect(-9 * s, 6 * s, 18 * s, 10 * s);                                                     // bus
  o.beginPath(); o.moveTo(9 * s, 10 * s); o.lineTo(70 * s, 34 * s); o.stroke();                    // magnetometer boom
  o.beginPath(); o.moveTo(-9 * s, 12 * s); o.lineTo(-44 * s, 30 * s); o.stroke();                  // RTG boom
  o.fillStyle = '#E8C77A'; o.beginPath(); o.arc(-3 * s, 20 * s, 4 * s, 0, 7); o.fill();            // golden record
  o.restore();
}
