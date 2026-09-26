// Song timing: beats, lyrics (syllable-level), and per-frame audio curves.
// Source of truth is assets/timing.json, produced by pipeline/ from the stems.

import { clamp, lerp } from './util.js';

export class Timing {
  constructor(data) {
    this.d = data;
    this.fps = data.fps;
    this.beats = data.beats;
    this.downbeats = data.downbeats;
    this.lines = data.lines;
    this.words = [];
    data.lines.forEach((L, li) => L.words.forEach((w, wi) => this.words.push({ ...w, line: li, wi, sec: L.sec })));
    this.curves = data.curves;
    this.v100 = data.vocal100;
    this.spec = (data.spec64 || []).map((h) => { const a = new Float32Array(64); for (let i = 0; i < 64; i++) a[i] = parseInt(h.substr(i * 2, 2), 16) / 255; return a; });
  }

  // 64-band log spectrum (0..1) at time t
  spectrum(t) {
    const i = Math.max(0, Math.min(this.spec.length - 1, Math.round(t * this.fps)));
    return this.spec[i] || new Float32Array(64);
  }

  // Curve value at time t (linear interpolation of the 24 fps arrays).
  curve(name, t) {
    const a = this.curves[name];
    const x = t * this.fps, i = Math.floor(x), f = x - i;
    if (i < 0) return a[0];
    if (i >= a.length - 1) return a[a.length - 1];
    return lerp(a[i], a[i + 1], f);
  }

  // Smoothed curve (box average over +-w seconds).
  curveAvg(name, t, w = 0.1) {
    let s = 0, n = 0;
    for (let x = t - w; x <= t + w + 1e-9; x += 1 / this.fps) { s += this.curve(name, x); n++; }
    return s / n;
  }

  // Vocal envelope at 100 Hz resolution, with attack/release smoothing.
  vocal(t, attack = 0.03, release = 0.09) {
    const a = this.v100, rate = 100;
    const i1 = Math.floor(t * rate);
    let y = 0;
    for (let i = Math.max(0, i1 - 60); i <= i1 && i < a.length; i++) {
      const x = a[i];
      const k = x > y ? 1 - Math.exp(-1 / (attack * rate)) : 1 - Math.exp(-1 / (release * rate));
      y += (x - y) * k;
    }
    return clamp(y);
  }

  beatIndex(t) {
    const b = this.beats;
    let lo = 0, hi = b.length - 1;
    if (t < b[0]) return -1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (b[m] <= t) lo = m; else hi = m - 1; }
    return lo;
  }
  // 0..1 phase within the current beat, and time since the last beat.
  beatPhase(t) {
    const i = this.beatIndex(t), b = this.beats;
    if (i < 0) return { i, phase: 0, since: 1e9, len: 0.476 };
    const len = (b[i + 1] ?? b[i] + 0.476) - b[i];
    return { i, phase: (t - b[i]) / len, since: t - b[i], len };
  }
  // Exponential pulse that fires on every beat (1 at the beat, decays with tau).
  pulse(t, tau = 0.12, every = 1) {
    const { i, since } = this.beatPhase(t);
    if (i < 0 || i % every !== 0) return 0;
    return Math.exp(-since / tau);
  }
  downbeatPulse(t, tau = 0.2) {
    let last = -1;
    for (const d of this.downbeats) { if (d <= t) last = d; else break; }
    return last < 0 ? 0 : Math.exp(-(t - last) / tau);
  }
  kickPulse(t, tau = 0.1) {
    let last = -1e9;
    for (const k of this.d.kicks) { if (k <= t) last = k; else break; }
    return Math.exp(-(t - last) / tau);
  }

  // Lyric helpers
  line(sec, idx) { return this.lines.find((L) => L.sec === sec && L.idx === idx); }
  wordAt(t) {
    let cur = null;
    for (const w of this.words) { if (w.t0 <= t) cur = w; else break; }
    return cur;
  }
  // Syllable onset nearest before t (for mouth shapes).
  syllableAt(t) {
    let best = null;
    for (const w of this.words) {
      if (w.t0 > t) break;
      w.syl.forEach((s, k) => { if (s <= t) best = { word: w, k, t0: s }; });
    }
    return best;
  }
}
