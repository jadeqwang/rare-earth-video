// Shared helpers for shot modules.
import { W, H } from '../core.js';
import { clamp, lerp, hash } from '../lib/util.js';

// 2D overlay layer drawn with a callback, composited over target.
export function layer2D(ctx, target, name, draw, blit = {}) {
  const c = ctx.core.canvas(name);
  draw(c.ctx, c);
  ctx.core.blit(ctx.core.upload(c), target, blit);
  return c;
}

// Word items for lyric line i (optionally override text per word)
export function lineWords(ctx, i, upper = true) {
  const l = ctx.tl.line(i);
  const disp = l.text.replace('██████', '').trim().split(/\s+/);
  // map display words onto sung words where counts match; else fall back to display words spread over the line
  const sung = l.words;
  return disp.map((w, k) => {
    const s = sung[Math.min(k, sung.length - 1)];
    return { text: upper ? w.toUpperCase() : w, t0: s.t0, t1: s.t1 };
  });
}

// Camera shake from the kick envelope
export function kickShake(ctx, t, amt = 6, tau = 0.1) {
  const k = ctx.tl.kick(t, tau);
  const f = Math.floor(t * 24);
  return { x: (hash(f * 1.3) - 0.5) * 2 * amt * k, y: (hash(f * 2.7 + 5) - 0.5) * 2 * amt * k, k };
}

export { W, H, clamp, lerp };
