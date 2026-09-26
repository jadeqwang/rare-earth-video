// Plate-based scenes: single plate, split-screen duet, two-material duo, triptych.

import { clamp, lerp, ease, hex, PALETTES, COLORS } from '../util.js';
import { renderPlate, drawCues, plateToScreen } from './common.js';
import { setFont, drawText, label } from '../type.js';

const MIX = `
uniform sampler2D a; uniform sampler2D b; uniform float split; uniform float feather; uniform float angle; uniform float seamGlow; uniform vec3 seamCol;
uniform vec4 winA; uniform vec4 winB; // x,y,w,h in uv for each panel (optional reframe)
void main(){
  vec2 p = uv - vec2(split, 0.5);
  p = rot(angle) * p;
  float m = smoothstep(-feather, feather, p.x);
  vec3 ca = texture(a, uv).rgb, cb = texture(b, uv).rgb;
  vec3 col = mix(ca, cb, m);
  float seam = exp(-abs(p.x) * res.x / 3.0) * seamGlow;
  col += seamCol * seam;
  o = vec4(col, 1.0);
}`;

const ADD = `
uniform sampler2D a; uniform sampler2D b; uniform float k; uniform float mode;
void main(){ vec3 ca = texture(a, uv).rgb, cb = texture(b, uv).rgb;
  o = vec4(mode < 0.5 ? ca + cb * k : mix(ca, cb, k), 1.0); }`;

let MIXP, ADDP, T2, T3;

export const plateScenes = {
  init(e) {
    MIXP = e.g.program('mix2', MIX);
    ADDP = e.g.program('add2', ADD);
    T2 = e.g.target(e.W, e.H);
    T3 = e.g.target(e.W, e.H);
  },

  // A single plate with a material, camera move and type cues.
  plate: {
    async render(ctx, p) {
      await renderPlate(ctx, p);
      if (p.ghost) { // a second plate composited additively (e.g. 2011 hologram beside 2026 Jade)
        await renderPlate(ctx, { ...p.ghost, song: p.ghost.song }, T2);
        ctx.g.pass(ADDP, T3, { a: ctx.out, b: T2 }, { k: p.ghost.k ?? 0.8, mode: 0 });
        ctx.g.pass(ADDP, ctx.out, { a: T3, b: T3 }, { k: 0, mode: 0 });
      }
      if (p.pinch) pinchDot(ctx, p.pinch);
      if (p.beam) beam(ctx);
      if (p.stamp) stamp(ctx, p.stamp);
      drawCues(ctx, p.cues);
      Object.assign(ctx.fx, p.fx || {});
      if (p.mat === 'light') { ctx.fx.bloom = p.fx?.bloom ?? 0.45; ctx.fx.thresh = p.fx?.thresh ?? 0.8; }
      if (p.impact !== undefined) {
        const d = ctx.t - p.impact;
        if (d >= 0 && d < 2 / 24) ctx.fx.invert = 1;
        else if (d >= 2 / 24 && d < 5 / 24) ctx.fx.flash = 0.55 * (1 - (d - 2 / 24) / (3 / 24));
        ctx.fx.aberr = Math.max(ctx.fx.aberr, 2.5 * Math.exp(-Math.max(0, d) / 0.25));
      }
    },
  },

  // Split-screen duet: left plate | right plate, seam glows; seam can close (merge).
  split: {
    async render(ctx, p) {
      await renderPlate(ctx, p.left, T2);
      await renderPlate(ctx, p.right, T3);
      const u = ctx.u;
      const seam = typeof p.seam === 'function' ? p.seam(ctx) : 0.5;
      ctx.g.pass(MIXP, ctx.out, { a: T2, b: T3 }, {
        split: seam, feather: p.feather ?? 0.0015, angle: p.angle ?? 0, seamGlow: (p.glow ?? 1.2) * (1 + ctx.tim.pulse(ctx.t, 0.15) * 1.5),
        seamCol: hex(p.seamCol || COLORS.paleBlue),
      });
      if (p.stamp) stamp(ctx, p.stamp, 0.03);
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 0.45; ctx.fx.thresh = 0.8;
      Object.assign(ctx.fx, p.fx || {});
    },
  },

  // Three panels side by side (member intro cards).
  triptych: {
    async render(ctx, p) {
      const { o, W, H, S, t } = ctx;
      // render each panel plate full-frame, then composite thirds with a mask via MIX twice
      await renderPlate(ctx, p.panels[0], T2);
      await renderPlate(ctx, p.panels[1], T3);
      ctx.g.pass(MIXP, ctx.out, { a: T2, b: T3 }, { split: 1 / 3, feather: 0.0008, angle: 0, seamGlow: 0.8, seamCol: hex('#ffffff') });
      ctx.g.pass(ADDP, T2, { a: ctx.out, b: ctx.out }, { k: 0, mode: 0 });
      await renderPlate(ctx, p.panels[2], T3);
      ctx.g.pass(MIXP, ctx.out, { a: T2, b: T3 }, { split: 2 / 3, feather: 0.0008, angle: 0, seamGlow: 0.8, seamCol: hex('#ffffff') });
      // name cards
      p.names.forEach((n, i) => {
        const t0 = p.cardT[i];
        const a = clamp((t - t0) / 0.1);
        if (a <= 0) return;
        const x = (i + 0.5) * W / 3, y = H * 0.84;
        o.save(); o.globalAlpha = a;
        o.fillStyle = n.col; o.fillRect(x - 170 * S, y - 58 * S, 340 * S, 92 * S);
        setFont(o, { fam: 'hero', px: 52 * S, wght: 900, stretch: 112 });
        drawText(o, n.name, x, y - 6 * S, { fill: '#0b0b12' });
        setFont(o, { fam: 'mono', px: 18 * S, wght: 700 });
        drawText(o, n.role, x, y + 24 * S, { fill: '#0b0b12', tracking: 3 * S });
        o.restore();
      });
      if (p.stamp) stamp(ctx, p.stamp);
      drawCues(ctx, p.cues);
      ctx.fx.bloom = 0.45; ctx.fx.thresh = 0.8;
    },
  },
};

// 2011 camcorder stamp (orange LCD digits, bottom-right) + REC dot.
export function stamp(ctx, s, blinkOff = 0) {
  const { o, W, H, S, t } = ctx;
  const text = typeof s === 'string' ? s : "● REC  2011";
  setFont(o, { fam: 'mono', px: 30 * S, wght: 700 });
  o.save();
  o.shadowColor = 'rgba(255,140,40,0.8)'; o.shadowBlur = 10 * S;
  o.fillStyle = '#FF9A2E';
  o.textAlign = 'right'; o.textBaseline = 'alphabetic';
  const blink = Math.floor((t + blinkOff) * 1.5) % 2 === 0;
  o.fillText(blink ? text : text.replace('●', ' '), W - 70 * S, H - 64 * S);
  o.restore();
}

// A pale-blue point of light held between two fingers (plate-anchored).
function pinchDot(ctx, pp) {
  const { o, S, t, tim } = ctx;
  const [x, y] = plateToScreen(ctx, pp.x, pp.y);
  const k = clamp((t - (pp.t0 ?? 21.9)) / 0.4);
  if (k <= 0) return;
  const r = (6 + 2 * tim.pulse(t, 0.2)) * S * (pp.scale ?? 1.6) * k;
  o.save(); o.globalCompositeOperation = 'lighter';
  const g = o.createRadialGradient(x, y, 0, x, y, r * 7);
  g.addColorStop(0, 'rgba(235,245,255,1)'); g.addColorStop(0.12, 'rgba(156,200,255,0.9)'); g.addColorStop(0.4, 'rgba(120,170,255,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = g; o.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
  o.restore();
}

// The broadcast leaving the array: a vertical beam and rising rings.
function beam(ctx) {
  const { o, W, H, S, lt, t } = ctx;
  const x = W * 0.21, y0 = H * 0.62;
  const k = clamp((lt - 0.25) / 0.5);
  if (k <= 0) return;
  o.save(); o.globalCompositeOperation = 'lighter';
  const g = o.createLinearGradient(0, y0, 0, 0);
  g.addColorStop(0, 'rgba(200,225,255,0.9)'); g.addColorStop(1, 'rgba(156,200,255,0)');
  o.fillStyle = g; o.fillRect(x - 3 * S * k, 0, 6 * S * k, y0);
  o.fillStyle = 'rgba(156,200,255,0.12)'; o.fillRect(x - 26 * S * k, 0, 52 * S * k, y0);
  for (let i = 0; i < 5; i++) {
    const ph = ((lt * 1.2) + i / 5) % 1;
    const yy = y0 - ph * y0;
    o.strokeStyle = `rgba(200,225,255,${(1 - ph) * 0.7 * k})`; o.lineWidth = 2 * S;
    o.beginPath(); o.ellipse(x, yy, (30 + ph * 220) * S, (8 + ph * 40) * S, 0, 0, 7); o.stroke();
  }
  o.restore();
}
