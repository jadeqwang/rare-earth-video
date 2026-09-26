// Kinetic typography on a 2D canvas layer. Everything is a pure function of song time t.
import { clamp, lerp, easeOutCubic, easeOutExpo, easeOutBack, easeInCubic, hash, rgba, smooth } from './lib/util.js';
import { W, H } from './core.js';

export const FONTS = {
  hero: { fam: 'NSD', weight: 900, stretch: 'extra-condensed' },          // Noto Serif Display, condensed black
  heroW: { fam: 'NSD', weight: 900, stretch: 'normal' },
  ital: { fam: 'BODI', weight: 500, style: 'italic' },                     // Bodoni Moda italic
  italB: { fam: 'BODI', weight: 800, style: 'italic' },
  six: { fam: 'SIX', weight: 400 },                                        // Six Caps
  mono: { fam: 'JBM', weight: 500 },
  monoB: { fam: 'JBM', weight: 700 },
  jp: { fam: 'NSJ', weight: 900 },
  sf: { fam: 'MICH', weight: 400 },                                        // Michroma
  ui: { fam: 'ITT', weight: 800 },                                         // Inter Tight
};

export class TypeEngine {
  constructor(core) { this.core = core; }

  async loadFonts() {
    const defs = [
      ['NSD', 'NotoSerifDisplay-VF.ttf', { weight: '100 900', stretch: '62.5% 100%' }],
      ['BODI', 'BodoniModa-Italic-VF.ttf', { weight: '400 900', style: 'italic' }],
      ['BOD', 'BodoniModa-VF.ttf', { weight: '400 900' }],
      ['SIX', 'SixCaps.ttf', {}],
      ['JBM', 'JetBrainsMono-VF.ttf', { weight: '100 800' }],
      ['NSJ', 'NotoSerifJP-sub.ttf', { weight: '200 900' }],
      ['MICH', 'Michroma-Regular.ttf', {}],
      ['ITT', 'InterTight-VF.ttf', { weight: '100 900' }],
    ];
    await Promise.all(defs.map(async ([fam, file, d]) => {
      const f = new FontFace(fam, `url(assets/fonts/${file})`, d);
      await f.load(); document.fonts.add(f);
    }));
  }

  font(ctx, key, size) {
    const F = FONTS[key] || FONTS.hero;
    ctx.font = `${F.style || 'normal'} ${F.weight} ${size}px ${F.fam}`;
    ctx.fontStretch = F.stretch || 'normal';
    ctx.fontKerning = 'normal';
  }

  measure(ctx, key, size, text, track = 0) {
    this.font(ctx, key, size);
    ctx.letterSpacing = `${track * size}px`;
    const m = ctx.measureText(text);
    return { w: m.width, asc: m.actualBoundingBoxAscent, desc: m.actualBoundingBoxDescent };
  }

  // Draw a single string with style options.
  text(ctx, str, x, y, o = {}) {
    const { f = 'hero', size = 100, color = '#f4f1e8', alpha = 1, align = 'left', base = 'alphabetic', track = 0,
      glow = 0, glowCol = null, stroke = 0, strokeCol = '#060a1a', sx = 1, sy = 1, rot = 0, blur = 0, skew = 0 } = o;
    if (alpha <= 0.001) return;
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (skew) ctx.transform(1, 0, skew, 1, 0, 0);
    ctx.scale(sx, sy);
    this.font(ctx, f, size);
    ctx.letterSpacing = `${track * size}px`;
    ctx.textAlign = align; ctx.textBaseline = base;
    ctx.globalAlpha = alpha;
    if (blur > 0.3) ctx.filter = `blur(${blur}px)`;
    if (glow > 0) { ctx.shadowColor = glowCol || color; ctx.shadowBlur = glow; }
    if (stroke > 0) { ctx.lineWidth = stroke; ctx.strokeStyle = strokeCol; ctx.lineJoin = 'round'; ctx.strokeText(str, 0, 0); }
    ctx.fillStyle = color;
    ctx.fillText(str, 0, 0);
    ctx.restore();
  }

  // Word "slam": appears at its onset t0 with a quick scale-down + brightness overshoot.
  slamAnim(t, t0, { dur = 0.16, from = 1.35, flash = true } = {}) {
    if (t < t0 - 0.001) return null;
    const k = clamp((t - t0) / dur);
    const s = lerp(from, 1, easeOutExpo(k));
    const a = clamp((t - t0) / 0.03);
    const hot = flash ? Math.exp(-(t - t0) / 0.09) : 0;
    return { s, a, hot };
  }

  // Lay out words into a stacked block. items: [{text, f, size, t0, color, ital?, dx?, dy?}] with row breaks '\n'
  // Returns positioned glyph runs; draw with drawBlock.
  layout(ctx, rows, { x = 120, y = 200, lead = 0.86, gap = 0.22, align = 'left' } = {}) {
    const out = [];
    let cy = y;
    for (const row of rows) {
      const maxSize = Math.max(...row.map((w) => w.size));
      cy += maxSize * lead * (out.length ? 1 : 0.8);
      const widths = row.map((w) => this.measure(ctx, w.f || 'hero', w.size, w.text, w.track || 0).w * (w.sx || 1));
      const total = widths.reduce((a, b) => a + b, 0) + gap * maxSize * (row.length - 1);
      let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
      row.forEach((w, i) => {
        out.push({ ...w, x: cx + (w.dx || 0), y: cy + (w.dy || 0), w: widths[i] });
        cx += widths[i] + gap * maxSize;
      });
    }
    return out;
  }

  drawBlock(ctx, runs, t, o = {}) {
    const { anim = 'slam', out = null, color = '#f4f1e8', hotCol = '#ffffff', glow = 0, dim = 0, alpha: A0 = 1 } = o;
    for (const r of runs) {
      let s = 1, a = 1, hot = 0, dy = 0;
      if (anim === 'slam') {
        const A = this.slamAnim(t, r.t0, r.anim || {});
        if (!A) { if (dim > 0) this.text(ctx, r.text, r.x, r.y, { f: r.f, size: r.size, color: r.color || color, alpha: dim * A0, track: r.track || 0, sx: r.sx || 1 }); continue; }
        s = A.s; a = A.a; hot = A.hot;
      } else if (anim === 'rise') {
        const k = clamp((t - r.t0) / 0.35);
        if (k <= 0) continue;
        a = easeOutCubic(k); dy = (1 - easeOutCubic(k)) * r.size * 0.35;
      } else if (anim === 'fade') {
        a = clamp((t - r.t0) / 0.2);
      }
      a *= A0;
      if (out) { const k = clamp((t - out.t0) / (out.dur || 0.2)); a *= 1 - k; if (out.dy) dy -= out.dy * easeInCubic(k); }
      if (a <= 0) continue;
      // scale around the word's centre-left baseline
      const cx = r.x + r.w / 2, cy = r.y - r.size * 0.35;
      ctx.save();
      ctx.translate(cx, cy + dy); ctx.scale(s, s); ctx.translate(-cx, -cy);
      const col = r.color || color;
      this.text(ctx, r.text, r.x, r.y, { f: r.f, size: r.size, color: col, alpha: a, track: r.track || 0, glow: glow + hot * 30, glowCol: r.glowCol, sx: r.sx || 1 });
      if (hot > 0.02) this.text(ctx, r.text, r.x, r.y, { f: r.f, size: r.size, color: hotCol, alpha: a * hot * 0.85, track: r.track || 0, sx: r.sx || 1 });
      ctx.restore();
    }
  }

  // Karaoke line: all words visible dim, each lights as sung (with a soft underline sweep)
  karaoke(ctx, words, t, { x, y, f = 'hero', size = 64, gap = 0.26, align = 'left', lit = '#f4f1e8', dimCol = '#f4f1e8',
    dim = 0.28, t0 = null, t1 = null, fadeIn = 0.25, fadeOut = 0.25, track = 0, glow = 0 } = {}) {
    const first = t0 ?? words[0].t0 - 0.25, last = t1 ?? words[words.length - 1].t1 + 0.35;
    const A = Math.min(clamp((t - first) / fadeIn), 1 - clamp((t - last) / fadeOut));
    if (A <= 0) return;
    const widths = words.map((w) => this.measure(ctx, f, size, w.text ?? w.w, track).w);
    const total = widths.reduce((a, b) => a + b, 0) + gap * size * (words.length - 1);
    let cx = align === 'left' ? x : align === 'right' ? x - total : x - total / 2;
    words.forEach((w, i) => {
      const txt = w.text ?? w.w;
      const k = clamp((t - w.t0) / Math.max(0.08, Math.min(0.3, (w.t1 - w.t0) * 0.6)));
      this.text(ctx, txt, cx, y, { f, size, color: dimCol, alpha: A * dim * (1 - k), track });
      if (k > 0) this.text(ctx, txt, cx, y, { f, size, color: lit, alpha: A * k, track, glow: glow * k });
      cx += widths[i] + gap * size;
    });
  }

  // Terminal typewriter with block cursor
  typewriter(ctx, str, t, t0, { x, y, cps = 28, size = 26, color = '#8ecbff', f = 'mono', cursor = true, alpha = 1, blink = true } = {}) {
    if (t < t0) { if (cursor && blink && Math.floor(t * 2.2) % 2 === 0) this.cursor(ctx, x, y, size, color, alpha); return 0; }
    const n = Math.min(str.length, Math.floor((t - t0) * cps));
    const s = str.slice(0, n);
    this.text(ctx, s, x, y, { f, size, color, alpha });
    const w = this.measure(ctx, f, size, s).w;
    const done = n >= str.length;
    if (cursor && (!done || !blink || Math.floor(t * 2.2) % 2 === 0)) this.cursor(ctx, x + w + size * 0.12, y, size, color, alpha);
    return n / str.length;
  }
  cursor(ctx, x, y, size, color, alpha = 1) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.fillRect(x, y - size * 0.82, size * 0.55, size * 0.98); ctx.restore(); }

  subtitle(ctx, str, t, t0, t1, { y = H - 86, size = 30, color = '#f4f1e8', f = 'mono', bg = false } = {}) {
    const a = Math.min(clamp((t - t0) / 0.12), 1 - clamp((t - t1) / 0.18));
    if (a <= 0) return;
    if (bg) { this.font(ctx, f, size); const w = ctx.measureText(str).width; ctx.save(); ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#000'; ctx.fillRect(W / 2 - w / 2 - 14, y - size - 6, w + 28, size * 1.5); ctx.restore(); }
    this.text(ctx, str, W / 2, y, { f, size, color, alpha: a, align: 'center' });
  }

  // Small metadata label (K-pop MV style corner text)
  label(ctx, str, x, y, { size = 17, color = '#8ecbff', alpha = 1, align = 'left', f = 'mono', track = 0.12 } = {}) {
    this.text(ctx, str, x, y, { f, size, color, alpha, align, track });
  }

  vertical(ctx, str, x, y, { size = 30, color = '#8ecbff', alpha = 1, f = 'jp', step = 1.08 } = {}) {
    [...str].forEach((ch, i) => this.text(ctx, ch, x, y + i * size * step, { f, size, color, alpha, align: 'center' }));
  }
}
