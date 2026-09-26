// Pure helpers. Every animation in the film is a function of time, never of
// frame history, so frames can be rendered in any order and in parallel.

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const invlerp = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = invlerp(a, b, x); return t * t * (3 - 2 * t); };
export const fract = (x) => x - Math.floor(x);

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inCubic: (t) => t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  outElastic: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1),
};

// Animate from a (at time t0) to b over dur seconds with easing e.
export const tween = (t, t0, dur, a, b, e = ease.outCubic) => lerp(a, b, e(clamp((t - t0) / dur)));

// Deterministic randomness
export function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
}
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => {
    s |= 0; s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u);
}

// Colours
export function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
export const rgba = (h, a = 1) => {
  const [r, g, b] = hex(h);
  return `rgba(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)},${a})`;
};
export const mixHex = (a, b, t) => {
  const A = hex(a), B = hex(b);
  return A.map((v, i) => lerp(v, B[i], t));
};

export const PALETTES = {
  inkRoom: ['#0B1026', '#2E3170', '#F29E4C', '#FFF1D6'],
  inkRoomCool: ['#070B1E', '#243064', '#7FA8E8', '#EAF2FF'],
  inkRoof: ['#0A0F2A', '#2B3272', '#E8A06A', '#FFF0D8'],
  inkDawn: ['#13183A', '#4B4C8C', '#FF8A6B', '#FFE9C7'],
  inkDesert: ['#0A1430', '#3B5B8F', '#E9B872', '#F6EEDC'],
  inkDay: ['#1B2A52', '#5A7FB5', '#F2C38B', '#FFF8EC'],
  inkLaunch: ['#0C0A18', '#3A2E5C', '#FF8A3D', '#FFF1C9'],
  inkPhone: ['#05070F', '#1C2A4A', '#8FB4FF', '#F4F8FF'],
  light2011: ['#000000', '#7A3CFF', '#FF2D95', '#FFFFFF'],
  lightSpace: ['#000000', '#1B2A5A', '#9CC8FF', '#FFFFFF'],
  lightAlien: ['#000000', '#7A0F2B', '#FF4B2B', '#FFE3C8'],
  lightTeal: ['#000000', '#0E3B4A', '#2FE6D3', '#E8FFFB'],
};

export const COLORS = {
  paleBlue: '#9CC8FF', magenta: '#FF2D95', mint: '#3DFFB2', amber: '#FFB547', teal: '#2FE6D3',
  red: '#FF4B2B', cream: '#FFF6E8', ink: '#0B1026', violet: '#7A3CFF', white: '#FFFFFF',
};
