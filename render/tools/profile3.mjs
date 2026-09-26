// Micro-benchmarks of individual GPU operations with readPixels sync.
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
page.on('console', (m) => { if (m.text().startsWith('[p]')) console.log(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 600000 });
await page.evaluate(async () => {
  const ctx = window.__ctx, core = ctx.core, gl = core.gl;
  const px = new Uint8Array(4);
  const sync = () => { core.renderer.setRenderTarget(null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); };
  const A = core.rt('shotA', 1920, 1080, { depth: true });
  const time = (name, fn, n = 3) => { sync(); const a = performance.now(); for (let i = 0; i < n; i++) fn(i); sync(); console.log(`[p] ${name}: ${((performance.now() - a) / n).toFixed(0)} ms`); };
  ctx.t = 50;
  time('clear', () => core.clear(A, 0, 0, 0, 1));
  time('sky night', () => ctx.sky.render(A, { preset: 'night', yaw: 0, pitch: 0.3, fov: 50, time: 50 }));
  time('sky deep', () => ctx.sky.render(A, { preset: 'deep', yaw: 0, pitch: 0.3, fov: 50, time: 50, horizonY: -2 }));
  time('sky nostars nomw', () => ctx.sky.render(A, { preset: 'night', yaw: 0, pitch: 0.3, fov: 50, time: 50, starAmt: 0, mwAmt: 0 }));
  time('sky starAmt0', () => ctx.sky.render(A, { preset: 'night', yaw: 0, pitch: 0.3, fov: 50, time: 50, starAmt: 0, mwAmt: 0 }));
  const c = core.canvas('bench'); c.ctx.fillStyle = 'rgba(255,0,0,0.5)'; c.ctx.fillRect(100, 100, 500, 500);
  time('upload canvas', () => { core.upload(c); core.blit(c.tex, A, {}); });
  time('blit only', () => core.blit(c.tex, A, {}));
  time('upload only (texSubImage)', () => { core.upload(c); core.renderer.initTexture(c.tex); });
  time('post', () => ctx.post.run(A, { ...ctx.edl.globalGrade(ctx, 50) }, 50));
});
await browser.close(); srv.close();
