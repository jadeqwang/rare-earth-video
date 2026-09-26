// Stage-level GPU profile with readPixels sync points.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const frames = process.argv[2].split(',').map(Number);
const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--js-flags=--max-old-space-size=6000'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.text().startsWith('[p]')) console.log(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 600000 });
for (const f of frames) {
  await page.evaluate(async (f) => {
    const ctx = window.__ctx, core = ctx.core, gl = core.gl;
    const px = new Uint8Array(4);
    const sync = () => { const r = core.renderer; r.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
    // wrap core methods to accumulate time
    const T = { canvas2d: 0, upload: 0 };
    const t = f / 24; ctx.f = f; ctx.t = t;
    const { shot } = ctx.edl.at(t);
    const A = core.rt('shotA', 1920, 1080, { depth: true });
    sync();
    let a = performance.now();
    core.clear(A, 0, 0, 0, 1);
    const grade = (await shot.render(ctx, { t, lt: t - shot.t0, p: 0, target: A, shot, dur: shot.dur, t0: shot.t0, t1: shot.t1 })) || {};
    const b = performance.now();
    sync();
    const c = performance.now();
    ctx.post.run(A, { ...ctx.edl.globalGrade(ctx, t), ...grade }, t);
    sync();
    const d = performance.now();
    console.log(`[p] f${f} ${shot.id}: shot-cpu ${(b - a).toFixed(0)} ms, shot-gpu ${(c - b).toFixed(0)} ms, post ${(d - c).toFixed(0)} ms`);
  }, f);
  const t1 = Date.now();
  await page.screenshot({ path: '/tmp/claude-0/prof.jpg', type: 'jpeg', quality: 95, timeout: 180000 });
  console.log(`    screenshot ${Date.now() - t1} ms`);
}
await browser.close(); srv.close();
