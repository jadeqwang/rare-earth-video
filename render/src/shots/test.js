import { layer2D, lineWords, W, H } from './common.js';
import { DishArray, CHOREO } from '../scenes/array.js';
import { clamp, easeInOutCubic } from '../lib/util.js';
let A = null;
export default {
  id: 'TEST', t0: 0, t1: 172.36,
  render(ctx, s) {
    const t = s.t;
    if (!A) A = new DishArray(ctx.core);
    A.pose(CHOREO.wave(t, 1.0, 0.3, 2.5), t);
    const foci = A.render(ctx, s.target, { pos: [-38, 5, 18], look: [0, 9, -30], fov: 50, time: t,
      sky: { preset: 'night', beacon: 1 - 0.7 * ctx.tl.kick(t, 0.08), beaconDir: [-0.3, 0.55, -0.78] } });
    layer2D(ctx, s.target, 'fx', (g) => {
      for (const f of foci) {
        const r = 30 * 60 / f.dist;
        const gr = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
        gr.addColorStop(0, 'rgba(255,215,120,0.9)'); gr.addColorStop(0.2, 'rgba(255,190,90,0.35)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(f.x, f.y, r, 0, 7); g.fill();
      }
    }, { mode: 'add' });
    return { bloom: 0.5, thresh: 0.85 };
  },
};
