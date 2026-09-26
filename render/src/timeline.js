// Song timing: beats, bars, words, audio envelopes. All lookups are pure functions of t (seconds).
import { clamp } from './lib/util.js';

export class Timeline {
  constructor(timing, audio) {
    this.T = timing;
    this.A = audio;
    this.beats = timing.beats;
    this.fps = audio.fps;
    this.lines = timing.lines;
    this.words = [];
    timing.lines.forEach((l, li) => l.words.forEach((w, wi) => this.words.push({ ...w, li, wi })));
    this.kicks = audio.kick_t;
    this.snares = audio.snare_t;
  }
  // index of the beat at or before t
  beatIndex(t) { const b = this.beats; let lo = 0, hi = b.length - 1; if (t < b[0]) return -1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b[m] <= t) lo = m; else hi = m - 1; } return lo; }
  beat(i) { const b = this.beats; if (i < 0) return b[0] + i * (b[1] - b[0]); if (i >= b.length) return b[b.length - 1] + (i - b.length + 1) * (b[b.length - 1] - b[b.length - 2]); return b[i]; }
  bar(i) { return this.beat(i * 4); }                       // downbeat of bar i (phase 0)
  beatPhase(t) { const i = this.beatIndex(t); const a = this.beat(i), b = this.beat(i + 1); return { i, ph: clamp((t - a) / (b - a)), since: t - a, period: b - a }; }
  // envelopes sampled per frame (linear interp)
  env(name, t) { const a = this.A[name]; const x = t * this.fps; const i = Math.floor(x); if (i < 0) return a[0]; if (i >= a.length - 1) return a[a.length - 1]; const f = x - i; return a[i] * (1 - f) + a[i + 1] * f; }
  // decaying impulse after the most recent event in list (seconds) -> exp(-dt/tau)
  impulse(list, t, tau = 0.12, lookback = 1.0) { let best = 1e9; for (let i = lower(list, t - lookback); i < list.length && list[i] <= t; i++) best = t - list[i]; return best > lookback ? 0 : Math.exp(-best / tau); }
  kick(t, tau = 0.12) { return this.impulse(this.kicks, t, tau); }
  snare(t, tau = 0.12) { return this.impulse(this.snares, t, tau); }
  beatPulse(t, tau = 0.14) { const { since } = this.beatPhase(t); return Math.exp(-Math.max(0, since) / tau); }
  // words overlapping [a,b]
  wordsIn(a, b) { return this.words.filter((w) => w.t0 < b && w.t1 > a); }
  line(i) { return this.lines[i]; }
}
function lower(arr, x) { let lo = 0, hi = arr.length; while (lo < hi) { const m = (lo + hi) >> 1; if (arr[m] < x) lo = m + 1; else hi = m; } return lo; }
