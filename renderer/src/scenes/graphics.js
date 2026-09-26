// 2D graphic scenes: printouts, data plots, UI, typographic sequences.
// Each draws on the overlay canvas; the GL scene target is cleared (or given stars) first.

import { clamp, lerp, ease, smooth, hash, rng, noise1, COLORS } from '../util.js';
import { drawCues } from './common.js';
import { setFont, drawText, heroWord, label, typeOn, fitPx, slamEnv, lyricBlock } from '../type.js';

function clearScene(ctx, stars = 0) {
  ctx.e.space.stars(ctx.out, { t: ctx.t, density: stars ? 0.45 : 0, bright: stars, mw: 0 });
}
function bg(o, W, H, col) { o.fillStyle = col; o.fillRect(0, 0, W, H); }

// ---------------------------------------------------------------------------
// Wow! printout (1977 Big Ear code: 0-9 then A-Z for intensity), filled with this
// song's own vocal loudness; the red circle is drawn on "caught".
const CODE = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function wow(ctx, p) {
  const { o, W, H, S, t, lt, u, tim } = ctx;
  clearScene(ctx);
  const paper = '#EFEBDF';
  o.save();
  const cx = W * 0.5, cy = H * 0.5;
  const zoom = lerp(1.0, 1.35, ease.inOutCubic(u));
  o.translate(cx, cy); o.rotate(-0.06 + u * 0.015); o.scale(zoom, zoom); o.translate(-cx, -cy);
  const pw = W * 0.9, px0 = W * 0.05;
  bg(o, W, H, '#0c0c10');
  o.fillStyle = paper; o.fillRect(px0, -H, pw, H * 3);
  // green bars
  const rowH = 30 * S, scroll = (lt * 2.2 * rowH) % (rowH * 2);
  o.fillStyle = 'rgba(120,170,120,0.18)';
  for (let y = -H - scroll; y < H * 2; y += rowH * 2) o.fillRect(px0, y, pw, rowH);
  // tractor holes
  o.fillStyle = '#0c0c10';
  for (let y = -H - scroll; y < H * 2; y += rowH) { o.beginPath(); o.arc(px0 + 22 * S, y + rowH / 2, 7 * S, 0, 7); o.fill(); o.beginPath(); o.arc(px0 + pw - 22 * S, y + rowH / 2, 7 * S, 0, 7); o.fill(); }
  // columns of intensity characters
  setFont(o, { fam: 'mono', px: 22 * S, wght: 600 });
  o.fillStyle = '#2a2a33'; o.textAlign = 'center'; o.textBaseline = 'middle';
  const cols = 28, cw = (pw - 120 * S) / cols;
  const rows = Math.ceil(H * 2 / rowH);
  const hot = 17; // the column that carries the vocal
  const base = 26.24 - 0.9; // song time at the circled peak row region
  for (let r = 0; r < rows; r++) {
    const y = -H * 0.5 + r * rowH - scroll;
    const rowT = base + (r - rows / 2) * 0.12 + lt * 0.26;
    for (let c = 0; c < cols; c++) {
      let v;
      if (c === hot) v = Math.floor(tim.vocal(rowT) * 30);
      else v = Math.floor(hash(r * 31.7 + c * 7.3 + Math.floor(lt * 2.2)) * 2.4);
      const ch = v <= 0 ? ' ' : CODE[Math.min(35, v)];
      o.fillText(ch, px0 + 60 * S + (c + 0.5) * cw, y + rowH / 2);
    }
  }
  // red pen circle around the hot column's peak, drawn on "caught"
  const tc = p.circleT ?? 26.24;
  const k = clamp((t - tc) / 0.35);
  if (k > 0) {
    const ccx = px0 + 60 * S + (hot + 0.5) * cw, ccy = H * 0.5;
    o.strokeStyle = '#D8231F'; o.lineWidth = 5 * S; o.lineCap = 'round';
    o.beginPath();
    const n = 60;
    for (let i = 0; i <= n * ease.outCubic(k); i++) {
      const a = -1.2 + (i / n) * Math.PI * 2.15;
      const rx = cw * 1.4 + Math.sin(a * 3) * 3 * S, ry = rowH * 3.6 + Math.cos(a * 2) * 4 * S;
      const x = ccx + Math.cos(a) * rx, y = ccy + Math.sin(a) * ry;
      i ? o.lineTo(x, y) : o.moveTo(x, y);
    }
    o.stroke();
    const k2 = clamp((t - tc - 0.2) / 0.35);
    if (k2 > 0) {
      setFont(o, { fam: 'voice', px: 96 * S });
      o.fillStyle = '#D8231F'; o.globalAlpha = k2; o.textAlign = 'left';
      o.save(); o.translate(ccx + cw * 2.1, ccy - rowH * 2.4); o.rotate(-0.12); o.fillText('Wow!', 0, 0); o.restore();
      o.globalAlpha = 1;
    }
  }
  o.restore();
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.2; ctx.fx.grain = 0.035; ctx.fx.vignette = 0.55;
}

// ---------------------------------------------------------------------------
// CP 1919 ridgelines drawn from the song's spectrum (the Unknown Pleasures plot).
function pulsar(ctx, p) {
  const { o, W, H, S, t, lt, tim } = ctx;
  clearScene(ctx);
  bg(o, W, H, '#000');
  const N = p.lines ?? 56, x0 = W * 0.25, x1 = W * 0.75, top = H * 0.25, bot = H * 0.86;
  const dy = (bot - top) / N;
  const pts = 120;
  const beat = tim.pulse(t, 0.14);
  o.lineJoin = 'round';
  for (let i = 0; i < N; i++) {
    const tt = t - (N - 1 - i) * 0.045;
    const sp = tim.spectrum(tt);
    const yb = top + i * dy;
    o.beginPath();
    const xs = [];
    for (let k = 0; k <= pts; k++) {
      const x = lerp(x0, x1, k / pts);
      const c = (k / pts - 0.5) * 2; // -1..1
      const band = Math.min(63, Math.floor(Math.abs(c) * 40 + 4));
      const win = Math.exp(-c * c * 4.2);
      const jitter = (hash(i * 97 + k * 13.1 + Math.floor(tt * 24)) - 0.5) * 0.12;
      const amp = (sp[band] * 1.15 + jitter) * win * dy * (8 + beat * 4);
      const y = yb - Math.max(0, amp);
      xs.push([x, y]);
      k ? o.lineTo(x, y) : o.moveTo(x, y);
    }
    // occlude lines behind
    o.lineTo(x1, yb + dy * 3); o.lineTo(x0, yb + dy * 3); o.closePath();
    o.fillStyle = '#000'; o.fill();
    o.beginPath(); xs.forEach(([x, y], k) => (k ? o.lineTo(x, y) : o.moveTo(x, y)));
    o.strokeStyle = '#F4F1EA'; o.lineWidth = 2.3 * S; o.stroke();
  }
  // the blinking star above
  const blink = 0.35 + 0.65 * tim.pulse(t, 0.18);
  const gr = o.createRadialGradient(W / 2, top - 60 * S, 0, W / 2, top - 60 * S, 70 * S);
  gr.addColorStop(0, `rgba(255,255,255,${blink})`); gr.addColorStop(0.15, `rgba(180,210,255,${blink * 0.6})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  o.fillStyle = gr; o.fillRect(W / 2 - 80 * S, top - 140 * S, 160 * S, 160 * S);
  label(o, 'CP 1919 · FIRST PULSAR · 1967', W * 0.75, H * 0.885, { px: 18, S, fill: '#8A93A8', align: 'right' });
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.35;
}

// ---------------------------------------------------------------------------
// Twin transits: their star (red dwarf) and ours (the Sun), each with a light curve.
function transit(ctx, p) {
  const { o, W, H, S, t, lt, u, e } = ctx;
  const merge = p.merge ? ease.inOutCubic(clamp(u * 1.3)) : 0;
  // stars drawn in GL: two bodies
  e.space.stars(e.space.tmpA, { t, density: 0.3, bright: 0.5 });
  const cyGL = H * 0.555;
  const L = [W * lerp(0.27, 0.5, merge), cyGL], R = [W * lerp(0.73, 0.5, merge), cyGL];
  const rad = 172 * S * (1 - merge * 0.35);
  e.space.body(e.space.tmpA, e.space.tmpB === ctx.out ? ctx.out : ctx.out, {
    center: L, radius: rad, kind: 'star', t, colA: '#7A0F2B', colB: '#FF5A2E', flare: 0.8, atmo: 0.6, atmoCol: '#FF5A2E', cell: 6, alpha: 1 - merge * 0.2,
  });
  // second star needs another pass: copy result then add
  e.space.copy(ctx.out, e.space.tmpA);
  e.space.body(e.space.tmpA, ctx.out, { center: R, radius: rad * 1.08, kind: 'star', t, colA: '#B86A10', colB: '#FFE08A', flare: 0.4, atmo: 0.6, atmoCol: '#FFD27A', cell: 6, alpha: 1 - merge * 0.2 });
  // transiting planets (black discs) and light curves on the overlay
  const period = p.period ?? 3.9;
  const phaseL = ((t - (p.t0 ?? 30.97)) / period + 0.12) % 1, phaseR = ((t - (p.t0 ?? 30.97)) / period + 0.02) % 1;
  const drawPlanet = (c, r, ph, pr) => {
    const x = c[0] + lerp(-1.6, 1.6, ph) * r, y = H - c[1] + r * 0.18;
    o.fillStyle = '#000'; o.beginPath(); o.arc(x, y, pr, 0, 7); o.fill();
    return { x, y, inT: Math.abs(x - c[0]) < r };
  };
  const pl = drawPlanet(L, rad, phaseL, 16 * S), pr = drawPlanet(R, rad * 1.08, phaseR, 12 * S);
  // light curves
  const curve = (cx, ph, col, depth, yy) => {
    const w = 470 * S, x0 = cx - w / 2;
    o.strokeStyle = col; o.lineWidth = 2.4 * S; o.beginPath();
    for (let k = 0; k <= 160; k++) {
      const f = k / 160; const pp = ph - (1 - f) * 0.9;
      const px = lerp(-1.6, 1.6, ((pp % 1) + 1) % 1);
      const inside = Math.abs(px) < 1 ? 1 : 0;
      const dip = inside * depth * (1 - px * px * 0.25);
      const y = yy + dip * 66 * S + (hash(k * 3.1 + Math.floor(t * 12)) - 0.5) * 3 * S;
      k ? o.lineTo(x0 + f * w, y) : o.moveTo(x0 + f * w, y);
    }
    o.stroke();
    o.strokeStyle = 'rgba(220,230,255,0.25)'; o.lineWidth = 1 * S; o.strokeRect(x0, yy - 20 * S, w, 110 * S);
  };
  const cyTop = H - cyGL;
  curve(L[0], phaseL, '#FF6B4A', 1, cyTop + rad + 62 * S);
  curve(R[0], phaseR, '#FFD27A', 0.6, cyTop + rad + 62 * S);
  if (merge < 0.5) {
    label(o, 'GJ 1002 · RED DWARF · 15.8 LY', L[0], cyTop - rad - 36 * S, { px: 21, S, fill: '#FF8A6B', align: 'center', alpha: 1 - merge * 2 });
    label(o, 'THE SUN · AS SEEN FROM THERE', R[0], cyTop - rad - 36 * S, { px: 21, S, fill: '#FFD27A', align: 'center', alpha: 1 - merge * 2 });
  }
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.7; ctx.fx.thresh = 0.7;
}

// ---------------------------------------------------------------------------
// Brutalist red: "or self-destruct" / "weapons, wars" — tickers, countdown, slabs of type.
function brutal(ctx, p) {
  const { o, W, H, S, t, lt, tim } = ctx;
  clearScene(ctx);
  const inv = tim.pulse(t, 0.08, 2) > 0.6 && p.strobe;   // every other beat: stays well under 3 flashes/s
  bg(o, W, H, inv ? '#F2EFE8' : '#0A0406');
  const red = '#FF2A1F', fg = inv ? '#0A0406' : '#F2EFE8';
  // ticker bands
  const bands = p.bands || ['BREAKING', 'LAUNCH DETECTED', 'ALERT', 'WEAPONS', 'WARS', 'T-MINUS', 'NO SIGNAL'];
  setFont(o, { fam: 'hero', px: 64 * S, wght: 900, stretch: 75 });
  o.textBaseline = 'middle';
  for (let i = 0; i < 6; i++) {
    const y = H * (0.08 + i * 0.17);
    const dir = i % 2 ? 1 : -1;
    const speed = 380 * S * (1 + i * 0.13);
    o.fillStyle = i % 3 === 1 ? red : 'rgba(255,42,31,0.18)';
    if (i % 3 === 1) o.fillRect(0, y - 38 * S, W, 76 * S);
    const txt = (bands[i % bands.length] + '  ///  ').repeat(12);
    const w = o.measureText(txt).width / 12;
    const x = ((dir * lt * speed) % w) - w;
    o.fillStyle = i % 3 === 1 ? '#0A0406' : 'rgba(242,239,232,0.22)';
    o.fillText(txt, x, y);
  }
  // countdown
  if (p.countdown) {
    const left = Math.max(0, p.countdown - lt);
    setFont(o, { fam: 'mono', px: 44 * S, wght: 800 });
    o.fillStyle = red; o.textAlign = 'right';
    o.fillText(`T-00:00:${left.toFixed(2).padStart(5, '0')}`, W - 90 * S, H - 80 * S);
  }
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.25; ctx.fx.aberr = 0.6 + tim.pulse(t, 0.1) * 2; ctx.fx.grain = 0.04;
}

// ---------------------------------------------------------------------------
// The censored hole: black, empty brackets, a tiny carrier-lost line.
function hole(ctx, p) {
  const { o, W, H, S, t, lt } = ctx;
  clearScene(ctx);
  bg(o, W, H, '#000');
  const a = clamp(lt / 0.06);
  setFont(o, { fam: 'voice', px: 260 * S });
  drawText(o, '(      )', W / 2, H * 0.56, { fill: '#F4F1EA', alpha: a });
  setFont(o, { fam: 'mono', px: 18 * S, wght: 500 });
  if (Math.floor(t * 8) % 2 === 0) drawText(o, 'NO CARRIER', W / 2, H * 0.68, { fill: '#8C8C96', alpha: a, tracking: 6 * S });
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0; ctx.fx.grain = 0.05; ctx.fx.vignette = 0.8;
}

// ---------------------------------------------------------------------------
// 2011 crowdfunding page (web-2.0 gloss) — the Allen Telescope Array restart.
function crowdfund(ctx, p) {
  const { o, W, H, S, t, lt, u } = ctx;
  clearScene(ctx);
  bg(o, W, H, '#DADDE3');
  // browser chrome
  const bx = W * 0.08, by = H * 0.08, bw = W * 0.84, bh = H * 0.84;
  let g = o.createLinearGradient(0, by, 0, by + 70 * S); g.addColorStop(0, '#F4F5F7'); g.addColorStop(1, '#C9CDD4');
  o.fillStyle = g; o.fillRect(bx, by, bw, 70 * S);
  o.fillStyle = '#FFFFFF'; o.fillRect(bx, by + 70 * S, bw, bh - 70 * S);
  o.fillStyle = '#E9EBEF'; o.fillRect(bx + 16 * S, by + 16 * S, 300 * S, 38 * S);
  setFont(o, { fam: 'Arial', px: 17 * S, wght: 400 });
  o.fillStyle = '#333'; o.textAlign = 'left'; o.textBaseline = 'middle';
  o.fillText('Restart the Allen Telescope Array', bx + 30 * S, by + 35 * S);
  o.fillStyle = '#FFFFFF'; o.fillRect(bx + 340 * S, by + 18 * S, bw - 360 * S, 34 * S);
  o.fillStyle = '#6A6F78'; o.fillText('http://www.  /  keep-listening  /  2011', bx + 356 * S, by + 35 * S);
  // header band
  g = o.createLinearGradient(0, by + 70 * S, 0, by + 200 * S); g.addColorStop(0, '#1B2B55'); g.addColorStop(1, '#0B1430');
  o.fillStyle = g; o.fillRect(bx, by + 70 * S, bw, 130 * S);
  setFont(o, { fam: 'Georgia', px: 44 * S, wght: 700 });
  o.fillStyle = '#FFFFFF'; o.fillText('Help us keep listening.', bx + 50 * S, by + 135 * S);
  setFont(o, { fam: 'Arial', px: 19 * S, wght: 400 });
  o.fillStyle = '#AFC3E8'; o.fillText('The Allen Telescope Array went dark in April 2011. The public brought it back.', bx + 50 * S, by + 176 * S);
  // progress bar (glossy, 2011)
  const k = ease.inOutCubic(clamp((lt - 0.4) / (ctx.dur - 1.3)));
  const pbx = bx + 50 * S, pby = by + 290 * S, pbw = bw - 100 * S, pbh = 58 * S;
  o.fillStyle = '#E3E6EA'; roundRect(o, pbx, pby, pbw, pbh, 29 * S); o.fill();
  g = o.createLinearGradient(0, pby, 0, pby + pbh); g.addColorStop(0, '#9BE15D'); g.addColorStop(0.5, '#4CB82E'); g.addColorStop(0.51, '#39A21E'); g.addColorStop(1, '#5CC23A');
  o.fillStyle = g; roundRect(o, pbx, pby, Math.max(pbh, pbw * k), pbh, 29 * S); o.fill();
  o.fillStyle = 'rgba(255,255,255,0.35)'; roundRect(o, pbx + 6 * S, pby + 5 * S, Math.max(0, pbw * k - 12 * S), pbh * 0.38, 20 * S); o.fill();
  setFont(o, { fam: 'Georgia', px: 64 * S, wght: 700 });
  o.fillStyle = '#1A1A1A';
  const raised = Math.floor(204129 * k);
  o.fillText('$' + raised.toLocaleString('en-US'), pbx, pby + 140 * S);
  setFont(o, { fam: 'Arial', px: 20 * S, wght: 400 }); o.fillStyle = '#555';
  o.fillText('raised by the public · SETI Institute, 2011', pbx, pby + 190 * S);
  if (k >= 0.999) {
    o.save(); o.translate(bx + bw - 250 * S, by + bh - 150 * S); o.rotate(-0.12);
    o.strokeStyle = '#2E9A1C'; o.lineWidth = 6 * S; o.strokeRect(-150 * S, -55 * S, 300 * S, 110 * S);
    setFont(o, { fam: 'hero', px: 58 * S, wght: 900 }); o.fillStyle = '#2E9A1C'; o.textAlign = 'center';
    o.fillText('ONLINE', 0, 4 * S); o.restore();
  }
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.1; ctx.fx.grain = 0.022; ctx.fx.vignette = 0.3;
}
function roundRect(o, x, y, w, h, r) {
  o.beginPath(); o.moveTo(x + r, y); o.arcTo(x + w, y, x + w, y + h, r); o.arcTo(x + w, y + h, x, y + h, r); o.arcTo(x, y + h, x, y, r); o.arcTo(x, y, x + w, y, r); o.closePath();
}

// ---------------------------------------------------------------------------
// JWST primary mirror unfolding: 18 gold hexes, wings swing in, a star in the glass.
function jwst(ctx, p) {
  const { o, W, H, S, t, lt, u, tim } = ctx;
  clearScene(ctx, 0.5);
  const cx = W * (p.cx ?? 0.66), cy = H * 0.52, r = 58 * S * (p.scale ?? 1);
  const hexes = [];
  // axial coords for rings 1 and 2 (center removed)
  for (let q = -2; q <= 2; q++) for (let rr = -2; rr <= 2; rr++) {
    const s = -q - rr; if (Math.abs(s) > 2) continue; if (q === 0 && rr === 0) continue;
    hexes.push([q, rr]);
  }
  const fold = 1 - ease.inOutCubic(clamp((lt - 0.2) / 2.2));
  const shimmer = tim.vocal(t);
  hexes.forEach(([q, rr], i) => {
    let x = cx + r * 1.5 * q * 1.02, y = cy + r * Math.sqrt(3) * (rr + q / 2) * 1.02;
    // wings: outer columns fold behind
    if (Math.abs(q) === 2) {
      const side = Math.sign(q);
      const ang = fold * 1.35 * side;
      x = cx + side * r * 1.5 * (1.02 + Math.cos(ang) * 1.02);
      const sc = Math.max(0.05, Math.cos(ang));
      drawHex(o, x, y, r * 0.98, sc, i, t, shimmer, S);
    } else drawHex(o, x, y, r * 0.98, 1, i, t, shimmer, S);
  });
  // secondary mirror struts
  o.strokeStyle = 'rgba(230,200,140,0.5)'; o.lineWidth = 2 * S;
  const sy = cy - r * 4.2;
  o.beginPath(); o.moveTo(cx, sy); o.lineTo(cx - r * 2.6, cy + r * 2.2); o.moveTo(cx, sy); o.lineTo(cx + r * 2.6, cy + r * 2.2); o.moveTo(cx, sy); o.lineTo(cx, cy - r * 3.2); o.stroke();
  o.fillStyle = '#E8C77A'; o.beginPath(); o.arc(cx, sy, 10 * S, 0, 7); o.fill();
  label(o, 'JWST · 18 SEGMENTS · 6.5 M', cx, cy + r * 5.0, { px: 16, S, fill: '#E8C77A', align: 'center' });
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.8; ctx.fx.thresh = 0.6;
}
function drawHex(o, x, y, r, sx, i, t, sh, S) {
  o.save(); o.translate(x, y); o.scale(sx, 1);
  o.beginPath();
  for (let k = 0; k < 6; k++) { const a = Math.PI / 3 * k; const px = Math.cos(a) * r, py = Math.sin(a) * r; k ? o.lineTo(px, py) : o.moveTo(px, py); }
  o.closePath();
  const g = o.createLinearGradient(-r, -r, r, r);
  const b = 0.55 + 0.45 * Math.sin(t * 1.3 + i * 0.7) * 0.5 + sh * 0.3;
  g.addColorStop(0, `rgba(${Math.round(255 * b)},${Math.round(200 * b)},${Math.round(110 * b)},1)`);
  g.addColorStop(1, `rgba(${Math.round(150 * b)},${Math.round(100 * b)},${Math.round(40 * b)},1)`);
  o.fillStyle = g; o.fill();
  o.strokeStyle = 'rgba(40,24,6,0.8)'; o.lineWidth = 2.2 * S; o.stroke();
  o.restore();
}

// ---------------------------------------------------------------------------
// Radio bubble: the 2011 broadcast expanding across real neighbouring stars.
const NEIGHBOURS = [
  ['PROXIMA CENTAURI', 4.24, 0.3], ["BARNARD'S STAR", 5.96, 2.1], ['WOLF 359', 7.86, 4.0], ['SIRIUS', 8.6, 5.1],
  ['EPSILON ERIDANI', 10.5, 2.9], ['ROSS 128', 11.0, 1.2], ['TAU CETI', 11.9, 3.6], ["LUYTEN'S STAR", 12.2, 5.6],
  ["TEEGARDEN'S STAR", 12.5, 0.8], ['WOLF 1061', 14.0, 4.6], ['GLIESE 876', 15.2, 2.4], ['GJ 1002', 15.8, 5.95],
];
// The broadcast's epoch: spring 2011 (the SETI event). 15.8 ly later it reaches GJ 1002 in 2027.
const EPOCH = 2011.2;
function bubble(ctx, p) {
  const { o, W, H, S, t, lt, u, e } = ctx;
  e.space.stars(ctx.out, { t, density: 0.35, bright: 0.45, zoom: 1.2 });
  const years = lerp(p.y0 ?? 0, p.y1 ?? 16.4, p.ease === false ? u : ease.inOutQuad(u));
  const focus = clamp((years - 13) / 3);
  const scale = lerp(44, 52, focus) * S; // px per light-year
  const gj = NEIGHBOURS[NEIGHBOURS.length - 1];
  const gx = Math.cos(gj[2]) * gj[1] * scale, gy = Math.sin(gj[2]) * gj[1] * scale;
  const follow = clamp(years / 16);
  const cx = W * 0.5 - gx * lerp(0.15, 0.85, ease.inOutCubic(follow)), cy = H * 0.52 - gy * lerp(0.15, 0.85, ease.inOutCubic(follow));
  // distance rings
  o.save();
  o.strokeStyle = 'rgba(156,200,255,0.16)'; o.lineWidth = 1 * S; o.setLineDash([4 * S, 8 * S]);
  for (const d of [5, 10, 15]) { o.beginPath(); o.arc(cx, cy, d * scale, 0, 7); o.stroke(); }
  o.setLineDash([]);
  setFont(o, { fam: 'mono', px: 14 * S, wght: 500 }); o.fillStyle = 'rgba(156,200,255,0.5)'; o.textAlign = 'left';
  for (const d of [5, 10, 15]) o.fillText(`${d} LY`, cx + d * scale + 6 * S, cy - 6 * S);
  // the bubble
  const R = years * scale;
  const gr = o.createRadialGradient(cx, cy, Math.max(0, R - 60 * S), cx, cy, R);
  gr.addColorStop(0, 'rgba(156,200,255,0)'); gr.addColorStop(0.85, 'rgba(156,200,255,0.10)'); gr.addColorStop(1, 'rgba(200,225,255,0.55)');
  o.fillStyle = gr; o.beginPath(); o.arc(cx, cy, R, 0, 7); o.fill();
  o.strokeStyle = 'rgba(210,230,255,0.9)'; o.lineWidth = 2 * S; o.beginPath(); o.arc(cx, cy, R, 0, 7); o.stroke();
  // Sun / Earth
  o.fillStyle = '#9CC8FF'; o.beginPath(); o.arc(cx, cy, 5 * S, 0, 7); o.fill();
  label(o, 'EARTH · 2011', cx, cy + 22 * S, { px: 15, S, fill: '#9CC8FF', align: 'center' });
  // stars
  for (const [name, d, a] of NEIGHBOURS) {
    const x = cx + Math.cos(a) * d * scale, y = cy + Math.sin(a) * d * scale;
    const reached = years >= d;
    const since = years - d;
    const isGJ = name === 'GJ 1002';
    const col = isGJ ? '255,90,60' : '255,255,255';
    const pulse = reached ? Math.exp(-since * 3) : 0;
    o.fillStyle = `rgba(${col},${reached ? 1 : 0.45})`;
    o.beginPath(); o.arc(x, y, (reached ? 5 : 3) * S + pulse * 14 * S, 0, 7); o.fill();
    if (reached && since < 0.6) { // a ping ring as the wavefront passes the star
      o.strokeStyle = `rgba(${col},${(1 - since / 0.6) * 0.8})`; o.lineWidth = 2 * S;
      o.beginPath(); o.arc(x, y, (8 + since * 90) * S, 0, 7); o.stroke();
    }
    if (reached) label(o, `${name} · ${d} LY · ${Math.floor(EPOCH + d)}`, x + 12 * S, y, { px: isGJ ? 30 : 19, S, fill: isGJ ? '#FF8A6B' : '#DCE8FF', alpha: clamp(since * 4) * (isGJ ? 1 : 0.85), wght: isGJ ? 700 : 500 });
  }
  o.restore();
  // the year the wavefront has reached, big
  const yr = Math.floor(EPOCH + years);
  setFont(o, { fam: 'hero', px: 176 * S, wght: 900 });
  drawText(o, String(yr), 88 * S, 250 * S, { fill: yr >= 2027 ? '#FF8A6B' : '#9CC8FF', align: 'left', alpha: 0.95 });
  setFont(o, { fam: 'mono', px: 24 * S, wght: 600 }); o.fillStyle = '#9CC8FF'; o.textAlign = 'left';
  o.fillText(`THE 2011 BROADCAST · RADIUS ${years.toFixed(1)} LY`, 92 * S, 300 * S);
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.8;
}

// ---------------------------------------------------------------------------
// Their reply, decoded row by row (teal pixels, Arecibo-style).
function replyBitmap(tim) {
  const Wd = 31, Hd = 47, g = Array.from({ length: Hd }, () => new Array(Wd).fill(0));
  const set = (x, y, v = 1) => { if (x >= 0 && x < Wd && y >= 0 && y < Hd) g[y][x] = v; };
  // 1..10 in binary, columns of 4 bits with a marker below
  for (let n = 1; n <= 10; n++) { const x = 1 + (n - 1) * 3; for (let b = 0; b < 4; b++) if ((n >> b) & 1) set(x, 4 - b); set(x, 6, 2); }
  // their star (big) and two planets, c marked
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) if (x * x + y * y <= 17) set(5 + x, 13 + y, 3);
  set(15, 13, 1); set(22, 13, 4); set(22, 11, 2); set(22, 15, 2); set(21, 13, 2); set(23, 13, 2);
  // a waveform: the song, echoed back (vocal envelope of the first line)
  for (let x = 0; x < Wd; x++) { const v = tim.vocal(3.8 + x * 0.06); const h = Math.round(v * 5); for (let y = 0; y <= h; y++) { set(x, 24 - y, 1); set(x, 24 + y, 1); } }
  // our system: the Sun and eight planets, the third one marked
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) set(3 + x, 35 + y, 3);
  for (let k = 0; k < 8; k++) set(8 + k * 3, 35, k === 2 ? 5 : 1);
  set(14, 33, 2); set(14, 37, 2);
  // the link between the two marked worlds
  for (let y = 15; y <= 32; y += 2) set(y < 24 ? 22 : 14, y, 2);
  for (let x = 14; x <= 22; x += 2) set(x, 28, 2);
  // 15.8 light-years as a tally of 16 ticks (rounded), and a final full row
  for (let k = 0; k < 16; k++) set(7 + k, 41, 1);
  for (let x = 0; x < Wd; x++) set(x, 44, 2);
  return g;
}
function reply(ctx, p) {
  const { o, W, H, S, t, lt, u, tim } = ctx;
  clearScene(ctx, 0.35);
  const g = replyBitmap(tim);
  const Hd = g.length, Wd = g[0].length;
  const cell = Math.min((H * 0.84) / Hd, 26 * S);
  const x0 = W * (p.cx ?? 0.5) - (Wd * cell) / 2, y0 = H * 0.5 - (Hd * cell) / 2;
  const rowsShown = Hd * ease.inOutQuad(clamp(u * 1.08));
  const colors = { 1: '#2FE6D3', 2: '#1C8F86', 3: '#FF6A3D', 4: '#FFFFFF', 5: '#9CC8FF' };
  o.save(); o.globalCompositeOperation = 'lighter';
  for (let y = 0; y < Hd; y++) {
    if (y > rowsShown) break;
    const fresh = clamp(1 - (rowsShown - y) / 2);
    for (let x = 0; x < Wd; x++) {
      const v = g[y][x]; if (!v) continue;
      o.fillStyle = colors[v];
      o.globalAlpha = 0.85 + fresh * 0.15;
      o.fillRect(x0 + x * cell + 1.5 * S, y0 + y * cell + 1.5 * S, cell - 3 * S, cell - 3 * S);
      if (fresh > 0) { o.globalAlpha = fresh * 0.6; o.fillStyle = '#FFFFFF'; o.fillRect(x0 + x * cell, y0 + y * cell, cell, cell); }
    }
  }
  // scan line
  o.globalAlpha = 1; o.fillStyle = 'rgba(47,230,211,0.35)';
  o.fillRect(x0 - 20 * S, y0 + rowsShown * cell, Wd * cell + 40 * S, 2 * S);
  o.restore();
  label(o, 'INCOMING: GJ 1002 c  ·  1,457 BITS  ·  DECODING', W * 0.06, H * 0.08, { px: 24, S, fill: '#2FE6D3' });
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.9; ctx.fx.thresh = 0.5;
}

// The reply crossing back: a teal wavefront from GJ 1002 toward the pale blue dot.
function replyBeam(ctx, p) {
  const { o, W, H, S, t, lt, u, e } = ctx;
  e.space.stars(ctx.out, { t, density: 0.3, bright: 0.45, zoom: 1.1 + u * 0.2 });
  const a = [W * 0.14, H * 0.6], b = [W * 0.86, H * 0.4];
  const k = ease.inOutCubic(clamp(u * 1.1));
  o.save(); o.globalCompositeOperation = 'lighter';
  o.strokeStyle = 'rgba(200,220,255,0.22)'; o.setLineDash([6 * S, 10 * S]); o.lineWidth = 1.4 * S;
  o.beginPath(); o.moveTo(a[0], a[1]); o.lineTo(b[0], b[1]); o.stroke(); o.setLineDash([]);
  const hx = lerp(b[0], a[0], k), hy = lerp(b[1], a[1], k);
  // wavefront arcs expanding from GJ 1002, centred on the beam head
  const ang = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const dist = Math.hypot(hx - b[0], hy - b[1]);
  for (let i = 0; i < 7; i++) {
    const rr = dist - i * 26 * S; if (rr <= 0) continue;
    o.strokeStyle = `rgba(47,230,211,${0.85 * (1 - i / 7)})`; o.lineWidth = (5 - i * 0.6) * S;
    o.beginPath(); o.arc(b[0], b[1], rr, ang - 0.35, ang + 0.35); o.stroke();
  }
  const gr = o.createLinearGradient(b[0], b[1], hx, hy);
  gr.addColorStop(0, 'rgba(47,230,211,0.0)'); gr.addColorStop(1, 'rgba(180,255,248,1)');
  o.strokeStyle = gr; o.lineWidth = 6 * S; o.beginPath(); o.moveTo(b[0], b[1]); o.lineTo(hx, hy); o.stroke();
  for (const [pt, col, r] of [[a, '156,200,255', 1], [b, '255,90,60', 1.3], [[hx, hy], '180,255,248', 0.9]]) {
    const g2 = o.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], 60 * S * r);
    g2.addColorStop(0, `rgba(${col},1)`); g2.addColorStop(0.18, `rgba(${col},0.55)`); g2.addColorStop(1, `rgba(${col},0)`);
    o.fillStyle = g2; o.fillRect(pt[0] - 70 * S * r, pt[1] - 70 * S * r, 140 * S * r, 140 * S * r);
  }
  o.restore();
  label(o, 'EARTH', a[0], a[1] + 60 * S, { px: 22, S, fill: '#9CC8FF', align: 'center' });
  label(o, 'GJ 1002 c', b[0], b[1] - 60 * S, { px: 22, S, fill: '#FF8A6B', align: 'center' });
  const year = Math.floor(lerp(2027, 2043, k));
  setFont(o, { fam: 'hero', px: 150 * S, wght: 900, stretch: 112 }); o.fillStyle = '#2FE6D3'; o.textAlign = 'center';
  o.globalAlpha = clamp(lt / 0.3);
  o.fillText(String(year), W * 0.5, H * 0.22);
  o.globalAlpha = 1;
  setFont(o, { fam: 'mono', px: 24 * S, wght: 600 }); o.fillStyle = '#A8F3EA';
  o.fillText('REPLY SENT 2027  ·  ETA EARTH 2043', W * 0.5, H * 0.29);
  if (lt > ctx.dur - 0.3) ctx.fx.fade = clamp((lt - (ctx.dur - 0.3)) / 0.25);
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.9;
}

// End card.
function endCard(ctx, p) {
  const { o, W, H, S, t, lt, u } = ctx;
  clearScene(ctx, 0.2);
  const a = clamp(lt / 0.35) * (1 - clamp((lt - (ctx.dur - 0.5)) / 0.5));
  o.save(); o.globalAlpha = a;
  setFont(o, { fam: 'hero', px: 170 * S, wght: 900, stretch: 112 });
  drawText(o, 'RARE EARTH', W / 2, H * 0.5, { fill: '#FFFFFF' });
  setFont(o, { fam: 'mono', px: 32 * S, wght: 600 });
  drawText(o, 'RNA  —  ROBOT NINJA APOCALYPSE  —  2011', W / 2, H * 0.6, { fill: '#9CC8FF', tracking: 4 * S });
  setFont(o, { fam: 'voice', px: 70 * S });
  drawText(o, 'still here.', W / 2, H * 0.73, { fill: '#F4F1EA' });
  o.restore();
  drawCues(ctx, p.cues);
  ctx.fx.bloom = 0.6;
}

export const graphicScenes = {
  init(e) {},
  black: {
    async render(ctx, p) {
      ctx.e.space.stars(ctx.out, { t: ctx.t, density: p.stars ?? 0, bright: p.stars ? 0.6 : 0 });
      drawCues(ctx, p.cues);
      Object.assign(ctx.fx, p.fx || {});
    },
  },
  wow: { render: async (c, p) => wow(c, p) },
  pulsar: { render: async (c, p) => pulsar(c, p) },
  transit: { render: async (c, p) => transit(c, p) },
  brutal: { render: async (c, p) => brutal(c, p) },
  hole: { render: async (c, p) => hole(c, p) },
  crowdfund: { render: async (c, p) => crowdfund(c, p) },
  jwst: { render: async (c, p) => jwst(c, p) },
  bubble: { render: async (c, p) => bubble(c, p) },
  reply: { render: async (c, p) => reply(c, p) },
  replyBeam: { render: async (c, p) => replyBeam(c, p) },
  endCard: { render: async (c, p) => endCard(c, p) },
};
