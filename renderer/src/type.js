// Kinetic typography on the 2D overlay canvas.
//
// Three voices (see docs/STYLE_BIBLE.md):
//   hero    Archivo 800-900, caps, slams on the sung syllable
//   voice   Instrument Serif italic, for tender words
//   machine JetBrains Mono, terminals / labels / subtitles
//
// Every function takes the song time `t` and derives its animation from the word's own
// onset, so type is always locked to the vocal.

import { clamp, ease, lerp } from './util.js';

export const STRETCH = { 62: 'extra-condensed', 75: 'condensed', 87: 'semi-condensed', 100: 'normal', 112: 'semi-expanded', 125: 'expanded' };

export function setFont(o, { fam = 'hero', px = 100, wght = 900, ital = false, stretch = 100 } = {}) {
  const family = fam === 'hero' ? 'Archivo' : fam === 'voice' ? '"Instrument Serif"' : fam === 'mono' ? '"JetBrains Mono"' : fam;
  const w = fam === 'voice' ? 400 : wght;
  o.font = `${ital || fam === 'voice' ? 'italic ' : ''}${w} ${Math.max(1, px).toFixed(2)}px ${family}`;
  o.fontStretch = STRETCH[stretch] || 'normal';
  o.fontKerning = 'normal';
}

// Largest font size (px) for which `text` fits in maxW.
export function fitPx(o, text, maxW, f, maxPx = 2000) {
  setFont(o, { ...f, px: 100 });
  const w = o.measureText(text).width;
  return Math.min(maxPx, (100 * maxW) / Math.max(1, w));
}

// Slam-in envelope for a word that lands at t0: returns {a, s, flash}
export function slamEnv(t, t0, { dur = 0.16, from = 1.28, hold = Infinity, out = 0.12 } = {}) {
  const x = (t - t0) / dur;
  if (t < t0) return { a: 0, s: from, flash: 0 };
  const s = x >= 1 ? 1 : lerp(from, 1, ease.outBack(clamp(x), 2.2));
  let a = clamp((t - t0) / 0.05);
  if (t > t0 + hold) a *= 1 - clamp((t - t0 - hold) / out);
  const flash = clamp(1 - (t - t0) / 0.09);
  return { a, s, flash };
}

// Draw text centred on (x, y) with a scale about its centre.
export function drawText(o, text, x, y, { scale = 1, alpha = 1, fill = '#fff', stroke = null, lw = 0, align = 'center', base = 'alphabetic', rot = 0, shadow = null, tracking = 0 } = {}) {
  if (alpha <= 0.001) return;
  o.save();
  o.globalAlpha = alpha;
  o.translate(x, y);
  if (rot) o.rotate(rot);
  if (scale !== 1) o.scale(scale, scale);
  o.textAlign = align;
  o.textBaseline = base;
  o.letterSpacing = tracking ? `${tracking}px` : '0px';
  if (shadow) { o.shadowColor = shadow.c; o.shadowBlur = shadow.b; o.shadowOffsetX = shadow.x || 0; o.shadowOffsetY = shadow.y || 0; }
  if (stroke && lw) { o.lineWidth = lw; o.strokeStyle = stroke; o.lineJoin = 'round'; o.strokeText(text, 0, 0); o.shadowBlur = 0; }
  if (fill) { o.fillStyle = fill; o.fillText(text, 0, 0); }
  o.restore();
}

// A hero word that slams in on its onset. Returns the drawn width.
export function heroWord(o, word, t, t0, x, y, { px, fill = '#fff', stroke = null, lw = 0, align = 'center', hold = Infinity, stretch = 100, wght = 900, ital = false, flashCol = null, rot = 0, fam = 'hero', tracking = 0 } = {}) {
  const e = slamEnv(t, t0, { hold });
  if (e.a <= 0) return 0;
  setFont(o, { fam, px, wght, stretch, ital });
  const f = flashCol && e.flash > 0 ? flashCol : fill;
  drawText(o, word, x, y, { scale: e.s, alpha: e.a, fill: f, stroke, lw, align, rot, tracking });
  return o.measureText(word).width;
}

// Lyric line as a centred/left block of words, each popping in on its onset.
// words: [{w, t0}] ; opts.caps, opts.maxW, opts.px (or auto-fit), opts.lineGap
export function lyricBlock(o, words, t, x, y, opts = {}) {
  const { px = 90, fam = 'hero', wght = 900, caps = true, maxW = 1600, lineGap = 1.02, align = 'left', fill = '#fff', dim = null, current = null, stretch = 100, ital = false, pop = 1.18, stroke = null, lw = 0 } = opts;
  setFont(o, { fam, px, wght, stretch, ital });
  const space = o.measureText(' ').width;
  // layout into lines
  const lines = [[]]; let lw_ = 0;
  for (const w of words) {
    const txt = caps ? w.w.toUpperCase() : w.w;
    const ww = o.measureText(txt).width;
    if (lw_ > 0 && lw_ + space + ww > maxW) { lines.push([]); lw_ = 0; }
    lines[lines.length - 1].push({ ...w, txt, ww });
    lw_ += (lw_ > 0 ? space : 0) + ww;
  }
  let yy = y;
  for (const L of lines) {
    const total = L.reduce((s, w) => s + w.ww, 0) + space * (L.length - 1);
    let xx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    for (const w of L) {
      const e = slamEnv(t, w.t0, { from: pop, dur: 0.14 });
      if (e.a > 0) {
        const isCur = current && t >= w.t0 && t < (w.t1 ?? w.t0 + 0.4);
        setFont(o, { fam, px, wght, stretch, ital });
        drawText(o, w.txt, xx + w.ww / 2, yy, { scale: e.s, alpha: e.a, fill: isCur ? current : fill, align: 'center', stroke, lw });
      } else if (dim) {
        setFont(o, { fam, px, wght, stretch, ital });
        drawText(o, w.txt, xx + w.ww / 2, yy, { alpha: 1, fill: dim, align: 'center' });
      }
      xx += w.ww + space;
    }
    yy += px * lineGap;
  }
  return { lines: lines.length, height: lines.length * px * lineGap };
}

// Terminal-style typing. Characters appear at `cps`; a block cursor blinks.
export function typeOn(o, text, x, y, t, t0, { cps = 38, px = 30, fill = '#E8F0FF', cursor = true, wght = 500, align = 'left', prompt = '', promptFill = null } = {}) {
  if (t < t0) return 0;
  const n = Math.min(text.length, Math.floor((t - t0) * cps));
  setFont(o, { fam: 'mono', px, wght });
  o.textAlign = align; o.textBaseline = 'alphabetic';
  let xx = x;
  if (prompt) { o.fillStyle = promptFill || fill; o.fillText(prompt, xx, y); xx += o.measureText(prompt).width; }
  const shown = text.slice(0, n);
  o.fillStyle = fill; o.fillText(shown, xx, y);
  const w = o.measureText(shown).width;
  if (cursor && (Math.floor(t * 2.2) % 2 === 0 || n < text.length)) {
    o.fillRect(xx + w + px * 0.08, y - px * 0.78, px * 0.55, px * 0.95);
  }
  return n / text.length;
}

// Small mono subtitle for intimate moments; fades in/out.
export function subtitle(o, text, t, t0, t1, { x = 120, y = 980, px = 30, fill = '#F4F1EA', S = 1 } = {}) {
  const a = clamp((t - t0) / 0.12) * (1 - clamp((t - t1) / 0.2));
  if (a <= 0) return;
  setFont(o, { fam: 'mono', px: px * S, wght: 500 });
  o.save(); o.globalAlpha = a; o.fillStyle = 'rgba(0,0,0,0.35)';
  const w = o.measureText(text).width;
  o.fillRect(x - 12 * S, y - px * S * 0.95, w + 24 * S, px * S * 1.35);
  o.fillStyle = fill; o.textAlign = 'left'; o.textBaseline = 'alphabetic'; o.fillText(text, x, y);
  o.restore();
}

// Data label with a hairline leader: "GJ 1002 · 15.8 LY"
export function label(o, text, x, y, { px = 20, fill = '#DCE8FF', alpha = 1, align = 'left', lead = 0, leadAng = -0.6, S = 1, wght = 500 } = {}) {
  if (alpha <= 0) return;
  o.save(); o.globalAlpha = alpha;
  setFont(o, { fam: 'mono', px: px * S, wght });
  o.fillStyle = fill; o.strokeStyle = fill; o.lineWidth = 1.2 * S;
  o.textAlign = align; o.textBaseline = 'middle';
  if (lead) {
    const ex = x + Math.cos(leadAng) * lead, ey = y + Math.sin(leadAng) * lead;
    o.beginPath(); o.moveTo(x, y); o.lineTo(ex, ey); o.lineTo(ex + (align === 'right' ? -30 : 30) * S, ey); o.stroke();
    o.fillText(text, ex + (align === 'right' ? -38 : 38) * S, ey);
  } else o.fillText(text, x, y);
  o.restore();
}
