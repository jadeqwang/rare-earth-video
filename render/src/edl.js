// Edit decision list. Each shot: {id, t0, t1, render(ctx, s) -> grade}. Built from src/shots/*.js
import { clamp } from './lib/util.js';
import { SHOTS } from './shots/index.js';

export async function buildEDL(ctx) {
  const shots = [];
  for (const def of SHOTS) {
    const s = typeof def === 'function' ? await def(ctx) : def;
    if (!s) continue;
    (Array.isArray(s) ? s : [s]).forEach((x) => shots.push(x));
  }
  shots.sort((a, b) => a.t0 - b.t0);
  shots.forEach((s) => { s.dur = s.t1 - s.t0; if (s.init) s.init(ctx); });
  const DUR = 172.36;
  return {
    shots,
    at(t) {
      // latest-starting shot covering t wins; its "xin" transition overlaps the previous shot
      let idx = -1;
      for (let i = 0; i < shots.length; i++) if (shots[i].t0 <= t && t < shots[i].t1) idx = i;
      if (idx < 0) return { shot: shots[Math.min(shots.length - 1, Math.max(0, shots.findIndex((s) => s.t0 > t) - 1))] || shots[0], next: null, mix: 0 };
      const cur = shots[idx];
      if (cur.xin && t < cur.t0 + cur.xin.dur) {
        const prev = [...shots.slice(0, idx)].reverse().find((s) => s.t1 >= cur.t0 - 1e-6 && s !== cur);
        if (prev) return { shot: prev, next: cur, mix: clamp((t - cur.t0) / cur.xin.dur) };
      }
      return { shot: cur, next: null, mix: 0 };
    },
    transition(ctx, a, b, mix, A, B, M) {
      const kind = (b.xin && b.xin.kind) || 'fade';
      const mat = ctx.core.material('xfade', XFADE_FS, { a: null, b: null, mix: 0, kind: 0, dir: 0 });
      const K = { fade: 0, flash: 1, wipe: 2, whip: 3, iris: 4, dip: 5 }[kind] ?? 0;
      ctx.core.pass(mat, M, { a: A.texture, b: B.texture, mix, kind: K, dir: (b.xin && b.xin.dir) || 0 });
    },
    globalGrade(ctx, t) {
      return { grain: 0.04, vig: 0.3, bloom: 0.55, halation: 0.22, fade: t > DUR - 1.0 ? clamp((t - (DUR - 1.0)) / 0.95) : 0,
        fadeCol: [0, 0, 0] };
    },
  };
}

const XFADE_FS = /* glsl */`
precision highp float; in vec2 vUv; out vec4 o;
uniform sampler2D a, b; uniform float mix, kind, dir;
void main(){
  vec4 A = texture(a, vUv), B = texture(b, vUv);
  float m = mix;
  if (kind < 0.5) { o = mix(A, B, m); return; }
  if (kind < 1.5) { vec4 w = vec4(1.6, 1.5, 1.35, 1.0); o = m < 0.5 ? mix(A, w, m * 2.0) : mix(w, B, (m - 0.5) * 2.0); return; }
  if (kind < 2.5) { float e = dir > 0.5 ? 1.0 - vUv.x : vUv.x; float s = smoothstep(m - 0.04, m + 0.04, e * 1.08 - 0.04); o = mix(B, A, s); return; }
  if (kind < 3.5) { float sh = (m < 0.5 ? m : m - 1.0) * 0.6 * (dir > 0.5 ? -1.0 : 1.0); vec4 acc = vec4(0.0);
    for (int i = 0; i < 9; i++) { float k = float(i) / 8.0 - 0.5; vec2 uv = vec2(fract(vUv.x + sh + k * 0.06 * sin(m * 3.14)), vUv.y); acc += (m < 0.5 ? texture(a, uv) : texture(b, uv)); }
    o = acc / 9.0; return; }
  if (kind < 4.5) { vec2 d = (vUv - 0.5) * vec2(1.777, 1.0); float r = length(d); float s = smoothstep(m * 1.1 - 0.02, m * 1.1 + 0.02, r); o = mix(B, A, s); return; }
  { vec4 k = vec4(0.0, 0.0, 0.0, 1.0); o = m < 0.5 ? mix(A, k, m * 2.0) : mix(k, B, (m - 0.5) * 2.0); }
}`;
