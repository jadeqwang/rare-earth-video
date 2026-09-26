// Boot + per-frame entry point. window.renderFrame(f) draws frame f deterministically.
import * as THREE from 'three';
import { Core, W, H, FPS } from './core.js';
import { Post } from './post.js';
import { Sky } from './scenes/sky.js';
import { Timeline } from './timeline.js';
import { buildEDL } from './edl.js';
import { TypeEngine } from './type.js';

const q = new URLSearchParams(location.search);

async function loadJSON(u) { const r = await fetch(u); if (!r.ok) throw new Error('fetch ' + u); return r.json(); }

async function boot() {
  const canvas = document.getElementById('out');
  const core = new Core(canvas);
  const [timing, audio] = await Promise.all([loadJSON('assets/timing.json'), loadJSON('assets/audio.json')]);
  const tl = new Timeline(timing, audio);
  const type = new TypeEngine(core);
  await type.loadFonts();
  const ctx = { core, THREE, W, H, FPS, tl, post: new Post(core), sky: new Sky(core), type, q, cache: {} };
  const edl = await buildEDL(ctx);
  ctx.edl = edl;
  window.__ctx = ctx;

  window.renderFrame = async (f) => {
    const t = f / FPS;
    ctx.f = f; ctx.t = t;
    const { shot, next, mix } = edl.at(t);
    const A = core.rt('shotA', W, H, { depth: true });
    const grade = await renderShot(ctx, shot, t, A);
    let src = A;
    if (next && mix > 0) {
      const B = core.rt('shotB', W, H, { depth: true });
      const gradeB = await renderShot(ctx, next, t, B);
      const M = core.rt('mix');
      edl.transition(ctx, shot, next, mix, A, B, M);
      src = M;
      for (const k in gradeB) if (typeof gradeB[k] === 'number' && typeof grade[k] === 'number') grade[k] = grade[k] * (1 - mix) + gradeB[k] * mix;
    }
    ctx.post.run(src, { ...edl.globalGrade(ctx, t), ...grade }, t);
    core.gl.finish();
    return true;
  };
  window.READY = true;
  console.log('[r] ready', edl.shots.length, 'shots');
}

async function renderShot(ctx, shot, t, target) {
  const lt = t - shot.t0;
  const p = shot.dur > 0 ? lt / shot.dur : 0;
  ctx.core.clear(target, 0, 0, 0, 1);
  const g = (await shot.render(ctx, { t, lt, p, target, shot, dur: shot.dur, t0: shot.t0, t1: shot.t1 })) || {};
  return g;
}

boot().catch((e) => { console.error('BOOT FAILED', e.stack || e); window.BOOTERR = String(e); });
