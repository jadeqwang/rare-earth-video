// Instrument / data graphics drawn on a 2D canvas: waterfall, light curve, screensaver, maps, charts.
import { clamp, lerp, hash, hash2, rng, easeOutCubic, smooth } from '../lib/util.js';

const MONO = (px, w = 500) => `${w} ${px}px JBM`;

// Waterfall (time x frequency spectrogram) with an optional narrowband drifting line: the technosignature look.
// o: {x,y,w,h, t, rows, cols, line:{on, f0, drift, snr}, palette:'ice'|'gold'}
export function waterfall(g, o) {
  const { x, y, w, h, t, cols = 180, rows = 110, line = null, palette = 'ice', speed = 22, alpha = 1 } = o;
  const cw = w / cols, rh = h / rows;
  const off = Math.floor(t * speed);
  g.save(); g.globalAlpha = alpha;
  g.fillStyle = '#03060f'; g.fillRect(x, y, w, h);
  for (let r = 0; r < rows; r++) {
    const row = off - r;
    for (let c = 0; c < cols; c++) {
      let v = Math.pow(hash2(c * 1.13 + 7, row * 0.77 + 3), 3.2) * 0.55;
      v += 0.08 * Math.sin(c * 0.05 + row * 0.02);
      if (line && line.on) {
        const fc = line.f0 + line.drift * r / rows;
        const d = Math.abs(c - fc * cols);
        v += Math.exp(-d * d / 1.2) * line.snr * (0.6 + 0.4 * hash2(row, 9));
      }
      v = clamp(v);
      if (v < 0.05) continue;
      if (palette === 'gold') g.fillStyle = `rgba(${255 * Math.min(1, v * 1.5) | 0},${200 * v | 0},${90 * v | 0},${0.25 + 0.75 * v})`;
      else g.fillStyle = `rgba(${140 * v | 0},${205 * v | 0},${255 * Math.min(1, v * 1.4) | 0},${0.25 + 0.75 * v})`;
      g.fillRect(x + c * cw, y + r * rh, cw + 0.5, rh + 0.5);
    }
  }
  g.strokeStyle = 'rgba(142,203,255,0.5)'; g.lineWidth = 1; g.strokeRect(x, y, w, h);
  g.fillStyle = 'rgba(142,203,255,0.8)'; g.font = MONO(14);
  g.fillText('1420.405 MHz', x, y + h + 20); g.textAlign = 'right'; g.fillText('+2.4 kHz', x + w, y + h + 20); g.textAlign = 'left';
  g.restore();
}

// Light curve: flux vs time with transit dips placed at given times (seconds, song clock). The trace draws on as time passes.
// o: {x,y,w,h, t, t0, span, dips:[times], depth, width, color, label}
export function lightCurve(g, o) {
  const { x, y, w, h, t, t0, span = 4, dips = [], depth = 0.35, width = 0.09, color = '#ffcf5a', alpha = 1, grid = true, noise = 0.02, lw = 2.5 } = o;
  g.save(); g.globalAlpha = alpha;
  if (grid) {
    g.strokeStyle = 'rgba(142,203,255,0.18)'; g.lineWidth = 1;
    for (let i = 0; i <= 8; i++) { g.beginPath(); g.moveTo(x + w * i / 8, y); g.lineTo(x + w * i / 8, y + h); g.stroke(); }
    for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x, y + h * i / 4); g.lineTo(x + w, y + h * i / 4); g.stroke(); }
  }
  const flux = (tt) => {
    let f = 1;
    for (const d of dips) { const u = (tt - d) / width; if (Math.abs(u) < 1.2) f -= depth * (Math.abs(u) < 0.7 ? 1 : (1.2 - Math.abs(u)) / 0.5); }
    return f + (hash(Math.floor(tt * 200)) - 0.5) * noise;
  };
  const tEnd = Math.min(t, t0 + span);
  g.strokeStyle = color; g.lineWidth = lw; g.lineJoin = 'round'; g.shadowColor = color; g.shadowBlur = 8;
  g.beginPath();
  const N = 420;
  let started = false;
  for (let i = 0; i <= N; i++) {
    const tt = t0 + span * i / N;
    if (tt > tEnd) break;
    const px = x + w * i / N, py = y + h * 0.18 + (1 - flux(tt)) * h * 1.6;
    started ? g.lineTo(px, py) : g.moveTo(px, py); started = true;
  }
  g.stroke();
  // head dot
  if (tEnd > t0) { const px = x + w * (tEnd - t0) / span, py = y + h * 0.18 + (1 - flux(tEnd)) * h * 1.6; g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); }
  g.shadowBlur = 0;
  if (o.label) { g.fillStyle = 'rgba(142,203,255,0.85)'; g.font = MONO(15); g.fillText(o.label, x, y - 10); }
  g.restore();
}

// "Home screensaver" 1999-2011 style spectrum graph (own design; no logos): 3D bar landscape of power vs frequency vs time.
export function screensaver(g, o) {
  const { x, y, w, h, t, alpha = 1, hue = 'blue' } = o;
  g.save(); g.globalAlpha = alpha;
  const bg = g.createLinearGradient(x, y, x, y + h); bg.addColorStop(0, '#060c2e'); bg.addColorStop(1, '#0c1d52');
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  const rows = 22, cols = 34;
  const ox = x + w * 0.12, oy = y + h * 0.82, cw = w * 0.022, dz = h * 0.022, dx = w * 0.009;
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = 0; c < cols; c++) {
      const ph = t * 1.5 - r * 0.35;
      let v = Math.pow(hash2(c, Math.floor(ph * 3) - r), 2.4) * 0.6 + 0.08 * Math.sin(c * 0.4 + ph);
      if (c === 21) v += 0.35 * (0.5 + 0.5 * Math.sin(t * 3 + r * 0.5));
      v = clamp(v, 0.02, 1);
      const bx = ox + c * cw + r * dx, by = oy - r * dz, bh = v * h * 0.4;
      const k = r / rows;
      const col = hue === 'blue' ? [lerp(60, 140, v), lerp(110, 230, v), 255] : [255, lerp(150, 220, v), 90];
      g.fillStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${0.9 - k * 0.5})`;
      g.fillRect(bx, by - bh, cw * 0.72, bh);
      g.fillStyle = `rgba(255,255,255,${0.25 * (1 - k)})`; g.fillRect(bx, by - bh, cw * 0.72, 2);
    }
  }
  g.fillStyle = '#cfe3ff'; g.font = MONO(Math.max(10, h * 0.035), 700); g.fillText('DATA ANALYSIS', x + w * 0.05, y + h * 0.09);
  g.font = MONO(Math.max(9, h * 0.028)); g.fillStyle = '#8ecbff';
  g.fillText(`chirp rate  ${(hash(Math.floor(t * 4)) * 50 - 25).toFixed(4)} Hz/s`, x + w * 0.05, y + h * 0.15);
  g.fillText(`best gaussian  power ${(1 + hash(Math.floor(t * 2)) * 4).toFixed(3)}`, x + w * 0.05, y + h * 0.2);
  g.fillStyle = '#ffcf5a'; g.fillText(`${(12 + (t * 7) % 80).toFixed(3)}% done`, x + w * 0.62, y + h * 0.09);
  g.restore();
}

// World map made of dots (land from a lat/lon mask image), with volunteer lights popping in over time.
export function dotMap(g, o, landMask) {
  const { x, y, w, h, t, t0 = 0, rate = 400, alpha = 1, col = '142,203,255', lit = '255,207,90' } = o;
  g.save(); g.globalAlpha = alpha;
  const step = Math.max(6, w / 150);
  const R = rng(4);
  let n = 0;
  for (let py = 0; py < h; py += step) for (let px = 0; px < w; px += step) {
    const u = px / w, v = py / h;
    if (!landMask(u, v)) continue;
    const r = R();
    const born = t0 + r * 3.2 + (1 - v) * 0.2;
    const on = t > born;
    g.fillStyle = on ? `rgba(${lit},${0.55 + 0.45 * Math.sin(t * 5 + r * 20) ** 2})` : `rgba(${col},0.28)`;
    const s = on ? step * 0.55 : step * 0.35;
    g.fillRect(x + px - s / 2, y + py - s / 2, s, s);
    n += on ? 1 : 0;
  }
  g.restore();
  return n;
}

// Rising line chart (e.g. listening hours / funding) with an annotated end point.
export function lineChart(g, o) {
  const { x, y, w, h, t, t0, dur = 2.0, pts, color = '#ffcf5a', alpha = 1, label = '', yLabel = '' } = o;
  g.save(); g.globalAlpha = alpha;
  g.strokeStyle = 'rgba(244,241,232,0.35)'; g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h); g.lineTo(x + w, y + h); g.stroke();
  const k = easeOutCubic(clamp((t - t0) / dur));
  const n = Math.max(2, Math.floor(pts.length * k));
  g.strokeStyle = color; g.lineWidth = 5; g.lineJoin = 'round'; g.lineCap = 'round';
  g.beginPath();
  for (let i = 0; i < n; i++) { const px = x + w * i / (pts.length - 1), py = y + h - pts[i] * h; i ? g.lineTo(px, py) : g.moveTo(px, py); }
  g.stroke();
  const i = n - 1, px = x + w * i / (pts.length - 1), py = y + h - pts[i] * h;
  g.fillStyle = color; g.beginPath(); g.arc(px, py, 9, 0, 7); g.fill();
  g.font = MONO(18, 700); g.fillStyle = '#f4f1e8'; if (label) g.fillText(label, px + 16, py + 6);
  g.font = MONO(15); g.fillStyle = 'rgba(142,203,255,0.8)'; if (yLabel) g.fillText(yLabel, x, y - 12);
  g.restore();
}

export function panelFrame(g, x, y, w, h, title, { col = 'rgba(142,203,255,0.55)', alpha = 1 } = {}) {
  g.save(); g.globalAlpha = alpha;
  g.strokeStyle = col; g.lineWidth = 1.2; g.strokeRect(x, y, w, h);
  const c = 14; g.lineWidth = 3;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    g.beginPath(); g.moveTo(cx, cy + sy * c); g.lineTo(cx, cy); g.lineTo(cx + sx * c, cy); g.stroke();
  }
  if (title) { g.font = MONO(14, 700); g.fillStyle = col; g.fillText(title, x + 10, y - 8); }
  g.restore();
}
