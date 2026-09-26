// Shared scene helpers: plate rendering with camera moves, drawn mouths, and the
// declarative type-cue renderer used by every shot in the EDL.

import { clamp, lerp, ease, hex, PALETTES, COLORS, noise1 } from '../util.js';
import { setFont, drawText, heroWord, lyricBlock, typeOn, subtitle, label, fitPx, slamEnv } from '../type.js';

// Vowel -> mouth shape (open scale, wide, round) for the drawn anime mouth.
const VOWELS = {
  a: [1.0, 0.75, 0.1], e: [0.7, 0.9, 0.0], i: [0.45, 1.0, 0.0], o: [0.85, 0.25, 0.85], u: [0.5, 0.1, 1.0], n: [0.2, 0.5, 0.2], m: [0.0, 0.5, 0.0],
};
// syllable vowel per lyric word (per syllable), hand annotated
const WORD_VOWELS = {
  do: 'u', you: 'u', still: 'i', care: 'e', "you're": 'o', yearning: 'ei', to: 'u', see: 'i', the: 'a', life: 'a', out: 'a', there: 'e',
  searching: 'ei', for: 'o', me: 'i', are: 'a', a: 'a', rare: 'e', earth: 'e', looking: 'ui', friend: 'e', lived: 'i', my: 'a', on: 'o',
  pale: 'e', blue: 'u', dot: 'o', your: 'o', signal: 'ia', here: 'i', i: 'a', think: 'i', "i've": 'a', caught: 'o', beating: 'ii',
  blinking: 'ii', of: 'a', star: 'a', "planet's": 'ae', transit: 'ai', is: 'i', not: 'o', that: 'a', far: 'a', from: 'o', own: 'o',
  how: 'a', could: 'u', we: 'i', be: 'i', alone: 'ao',
};

export function mouthState(tim, t, opts = {}) {
  const env = tim.vocal(t + (opts.lead ?? 0.03), 0.025, 0.08);
  const syl = tim.syllableAt(t + 0.02);
  let shape = VOWELS.a;
  if (syl) {
    const key = syl.word.w.toLowerCase().replace(/[^a-z']/g, '');
    const v = (WORD_VOWELS[key] || 'a')[Math.min(syl.k, (WORD_VOWELS[key] || 'a').length - 1)];
    shape = VOWELS[v] || VOWELS.a;
  }
  const open = clamp((env - 0.12) * 1.6) * shape[0] * (opts.gain ?? 1);
  return { open, wide: shape[1], round: shape[2] };
}

// Camera over the plate: xf = [zoom, cx, cy, rot] in plate uv (cy measured from bottom).
export function camera(p, u) {
  const c = p.cam || {};
  const e = ease[c.ease || 'inOutCubic'] || ease.inOutCubic;
  const k = e(clamp(u));
  const z = lerp(c.z0 ?? 1, c.z1 ?? (c.z0 ?? 1), k);
  const x = lerp(c.x0 ?? 0.5, c.x1 ?? (c.x0 ?? 0.5), k);
  const y = lerp(c.y0 ?? 0.5, c.y1 ?? (c.y0 ?? 0.5), k);
  const r = lerp(c.r0 ?? 0, c.r1 ?? (c.r0 ?? 0), k);
  return [z, x, y, r];
}

// Render a plate with a material into `out`. Handles plate timing, masks and the mouth.
export async function renderPlate(ctx, p, out = ctx.out) {
  const { e, tim, t } = ctx;
  // plate-local time: song-locked (p.song = song time of plate t=0) or shot-relative
  let pt = p.song !== undefined ? t - p.song + (p.slip || 0) : (p.pt0 || 0) + ctx.lt * (p.speed ?? 1);
  if (p.hold !== undefined) pt = p.hold;
  const twos = p.twos ?? true;
  const img = p.photo ? await e.image('assets/photos/' + p.photo) : await e.plate(p.plate, pt, twos);
  if (!img) return false;
  const meta = (p.photo ? {} : e.plateMeta[p.plate]) || {};
  const hasMask = meta.mask && p.useMask !== false ? e.mat.setMask(await e.plateMask(p.plate, pt, twos)) : false;
  const T = e.mat.analyse(img, p.mat, p.analyse || {}, p.photo || p.plate);
  const xf = camera(p, ctx.u);
  // subtle handheld drift
  const sh = p.drift ? [noise1(t * 0.7, 1) * p.drift - p.drift / 2, noise1(t * 0.6, 2) * p.drift - p.drift / 2] : [0, 0];
  let mouth = null;
  if (p.mouth) {
    const data = await e.plateData(p.plate);
    // position follows the drawing (held on twos); the shape follows the song on ones.
    // Frames where detection dropped out use the smoothed, gap-filled track, so the drawn
    // mouth never pops back to the generated one.
    const fi = e.plateFrameIndex(p.plate, pt, twos);
    const f = data?.face?.[fi];
    if (f && (f.found || f.sx !== undefined)) {
      const ms = mouthState(tim, t, p.mouth);
      const mw = (f.sw ?? f.w) * (p.mouth.scale ?? 0.62);
      mouth = {
        x: (f.sx ?? f.x) + (p.mouth.dx || 0), y: 1 - (f.sy ?? f.y) + (p.mouth.dy || 0), a: -(f.sa ?? f.a), w: mw,
        open: ms.open, wide: ms.wide, round: ms.round, skin: f.skin || meta.skin || [0.93, 0.78, 0.68],
        ink: p.mouth.ink, inner: p.mouth.inner, tongue: p.mouth.tongue,
      };
    }
  }
  const pal = Array.isArray(p.palette) ? p.palette : PALETTES[p.palette || (p.mat === 'ink' ? 'inkRoom' : 'light2011')];
  const common = { palette: pal, xf, shake: sh, hasMask, mouth, t, plateAspect: img.width / img.height };
  if (p.mat === 'ink') e.mat.ink(out, T, { ...common, sparkle: p.sparkle ?? 0, ...(p.ink || {}) });
  else e.mat.light(out, T, { ...common, neon: p.neon ? hex(p.neon) : [1, 1, 1], ...(p.light || {}) });
  ctx._xf = xf; ctx._plateAspect = img.width / img.height;
  return true;
}

// Plate uv (y up) -> screen px (top-left origin), inverse of plateUV in the shader.
export function plateToScreen(ctx, px, py) {
  const [z, cx, cy, r] = ctx._xf || [1, 0.5, 0.5, 0];
  const pa = ctx._plateAspect || 16 / 9, outA = ctx.W / ctx.H;
  let x = (px - cx) * pa * z, y = (py - cy) * z;
  const c = Math.cos(-r), s = Math.sin(-r);
  [x, y] = [c * x - s * y, s * x + c * y];
  return [(x / outA + 0.5) * ctx.W, (1 - (y + 0.5)) * ctx.H];
}

// ---------------------------------------------------------------------------
// Declarative type cues
// ---------------------------------------------------------------------------
function wordsOf(tim, line) {
  if (!line) return [];
  const L = tim.line(line[0], line[1]);
  return L ? L.words.map((w) => ({ w: w.w, t0: w.t0, t1: w.t1 })) : [];
}
function pick(words, from = 0, to = 99) { return words.slice(from, to); }

export function drawCues(ctx, cues = []) {
  const { o, t, tim, S, W, H } = ctx;
  for (const c of cues) {
    if (c.until !== undefined && t > c.until) continue;
    if (c.after !== undefined && t < c.after) continue;
    const X = (v) => (v <= 1.5 ? v * W : v * S);
    const Y = (v) => (v <= 1.5 ? v * H : v * S);
    switch (c.k) {
      case 'stack': { // one word per row, big, each slams on its onset
        const ws = c.words || pick(wordsOf(tim, c.line), c.from, c.to);
        const x = X(c.x ?? 0.08), maxW = X(c.maxW ?? 0.5);
        let y = Y(c.y ?? 0.2);
        for (const w of ws) {
          const txt = c.caps === false ? w.w : w.w.toUpperCase().replace(/[,.]/g, c.keepPunct ? '$&' : '');
          const px = Math.min((c.px ?? 220) * S, fitPx(o, txt, maxW, { fam: c.fam || 'hero', wght: c.wght || 900, stretch: c.stretch || 100 }));
          y += px * (c.lead ?? 0.92);
          heroWord(o, txt, t, w.t0 + (c.dt || 0), x, y, { px, align: c.align || 'left', fill: c.fill || '#fff', stroke: c.stroke, lw: (c.lw || 0) * S, stretch: c.stretch || 100, fam: c.fam || 'hero', wght: c.wght || 900, flashCol: c.flash || null, hold: c.hold ?? Infinity });
        }
        break;
      }
      case 'single': { // one word/phrase at a time, replacing the previous (K-pop slam)
        const ws = c.words || pick(wordsOf(tim, c.line), c.from, c.to);
        let cur = null;
        for (const w of ws) if (t >= w.t0 + (c.dt || 0)) cur = w;
        if (!cur) break;
        const txt = c.caps === false ? cur.w : cur.w.toUpperCase().replace(/[,.]/g, '');
        const maxW = X(c.maxW ?? 0.86);
        const px = Math.min((c.px ?? 420) * S, fitPx(o, txt, maxW, { fam: c.fam || 'hero', wght: 900, stretch: c.stretch || 100 }));
        const pos = c.pos ? c.pos[ws.indexOf(cur) % c.pos.length] : [c.x ?? 0.5, c.y ?? 0.62];
        heroWord(o, txt, t, cur.t0 + (c.dt || 0), X(pos[0]), Y(pos[1]), { px, align: c.align || 'center', fill: c.fill || '#fff', stroke: c.stroke, lw: (c.lw || 0) * S, stretch: c.stretch || 100, fam: c.fam || 'hero', flashCol: c.flash || null, rot: c.rot || 0 });
        break;
      }
      case 'block': {
        const ws = c.words || pick(wordsOf(tim, c.line), c.from, c.to);
        if (c.band) { // dark band behind the lyric for legibility over busy / bright plates
          const bh = (c.px ?? 80) * S * (c.bandH ?? 1.6), by = Y(c.y ?? 0.8) - (c.px ?? 80) * S * 1.12;
          const g = o.createLinearGradient(0, by - bh * 0.5, 0, by + bh * 1.2);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.35, `rgba(4,5,12,${c.band})`); g.addColorStop(1, `rgba(4,5,12,${c.band})`);
          o.fillStyle = g; o.fillRect(0, by - bh * 0.5, W, H - (by - bh * 0.5));
        }
        lyricBlock(o, ws.map((w) => ({ ...w, t0: w.t0 + (c.dt || 0) })), t, X(c.x ?? 0.08), Y(c.y ?? 0.8), {
          px: (c.px ?? 80) * S, fam: c.fam || 'hero', wght: c.wght || 900, caps: c.caps !== false, maxW: X(c.maxW ?? 0.8),
          align: c.align || 'left', fill: c.fill || '#fff', current: c.current || null, stretch: c.stretch || 100, lineGap: c.gap ?? 1.0,
          stroke: c.stroke, lw: (c.lw || 0) * S, dim: c.dim || null,
        });
        break;
      }
      case 'voice': { // serif italic phrase, word by word
        const ws = c.words || pick(wordsOf(tim, c.line), c.from, c.to);
        lyricBlock(o, ws.map((w) => ({ ...w, t0: w.t0 + (c.dt || 0) })), t, X(c.x ?? 0.08), Y(c.y ?? 0.8), {
          px: (c.px ?? 110) * S, fam: 'voice', caps: false, maxW: X(c.maxW ?? 0.8), align: c.align || 'left', fill: c.fill || '#fff', pop: 1.06, lineGap: c.gap ?? 1.05,
        });
        break;
      }
      case 'sub': {
        const ws = wordsOf(tim, c.line);
        if (!ws.length) break;
        const txt = c.text || ws.map((w) => w.w).join(' ').toLowerCase();
        subtitle(o, txt, t, ws[0].t0 - 0.05, c.t1 ?? ws[ws.length - 1].t1 + 0.25, { x: X(c.x ?? 0.063), y: Y(c.y ?? 0.905), px: c.px ?? 40, S, fill: c.fill || '#F4F1EA' });
        break;
      }
      case 'termWords': { // terminal line whose words type out on their sung onsets
        const ws = c.words || pick(wordsOf(tim, c.line), c.from, c.to);
        setFont(o, { fam: 'mono', px: (c.px ?? 40) * S, wght: 500 });
        o.textAlign = 'left'; o.textBaseline = 'alphabetic';
        let x = X(c.x ?? 0.063); const y = Y(c.y ?? 0.5);
        const cps = c.cps ?? 55;
        if (t < ws[0].t0 - 0.35) break;
        if (c.prompt) { o.fillStyle = c.promptFill || c.fill || '#EAF2FF'; o.fillText(c.prompt, x, y); x += o.measureText(c.prompt).width; }
        let full = '';
        ws.forEach((w, i) => { full += (i ? ' ' : '') + (c.caps ? w.w.toUpperCase() : w.w.toLowerCase()); });
        if (c.suffix) full += c.suffix;
        // character i appears at the onset of the word that contains it (typed at cps)
        let shown = '', pos = 0;
        ws.forEach((w, i) => {
          const txt = (i ? ' ' : '') + (c.caps ? w.w.toUpperCase() : w.w.toLowerCase()) + (i === ws.length - 1 && c.suffix ? c.suffix : '');
          const n = Math.max(0, Math.min(txt.length, Math.floor((t - w.t0 + 0.02) * cps)));
          shown += txt.slice(0, n);
          pos += txt.length;
        });
        o.fillStyle = c.fill || '#EAF2FF'; o.fillText(shown, x, y);
        const cw = o.measureText(shown).width, px = (c.px ?? 40) * S;
        if (Math.floor(t * 2.4) % 2 === 0 || shown.length < full.length) o.fillRect(x + cw + px * 0.1, y - px * 0.8, px * 0.56, px * 0.98);
        break;
      }
      case 'term': {
        typeOn(o, c.text, X(c.x ?? 0.063), Y(c.y ?? 0.88), t, c.t0, { px: (c.px ?? 34) * S, fill: c.fill || '#E8F0FF', cps: c.cps ?? 40, prompt: c.prompt || '', promptFill: c.promptFill });
        break;
      }
      case 'label': {
        const a = clamp((t - (c.t0 ?? -1)) / 0.15) * (c.t1 !== undefined ? 1 - clamp((t - c.t1) / 0.15) : 1);
        label(o, c.text, X(c.x), Y(c.y), { px: c.px ?? 20, fill: c.fill || '#DCE8FF', alpha: a, align: c.align || 'left', lead: (c.lead || 0) * S, leadAng: c.leadAng ?? -0.6, S });
        break;
      }
      case 'text': { // static styled text with fade
        const a = clamp((t - (c.t0 ?? -1)) / (c.fin ?? 0.12)) * (c.t1 !== undefined ? 1 - clamp((t - c.t1) / (c.fout ?? 0.15)) : 1);
        if (a <= 0) break;
        const e = c.slam ? slamEnv(t, c.t0, {}) : { s: 1 };
        if (c.shade) { // soft dark pool behind the text for legibility on bright plates
          const gx = X(c.x ?? 0.5), gy = Y(c.y ?? 0.5) - (c.px ?? 60) * S * 0.35;
          const g = o.createRadialGradient(gx, gy, 0, gx, gy, W * 0.42);
          g.addColorStop(0, `rgba(4,5,14,${c.shade * a})`); g.addColorStop(1, 'rgba(4,5,14,0)');
          o.fillStyle = g; o.fillRect(0, 0, W, H);
        }
        let tpx = (c.px ?? 60) * S;
        if (c.maxW) tpx = Math.min(tpx, fitPx(o, c.text, X(c.maxW), { fam: c.fam || 'hero', wght: c.wght || 900, stretch: c.stretch || 100 }));
        setFont(o, { fam: c.fam || 'hero', px: tpx, wght: c.wght || 900, stretch: c.stretch || 100, ital: c.ital });
        drawText(o, c.text, X(c.x ?? 0.5), Y(c.y ?? 0.5), { fill: c.fill || '#fff', alpha: a * (c.alpha ?? 1), align: c.align || 'center', scale: e.s, tracking: (c.tracking || 0) * S, stroke: c.stroke, lw: (c.lw || 0) * S, rot: c.rot || 0 });
        break;
      }
    }
  }
}

export { COLORS, PALETTES };
