// Profile per-frame cost: renderFrame (with gl.finish) vs screenshot, for a list of frames.
//   node tools/profile.mjs 100,101,102 [--noshot]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const frames = process.argv[2].split(',').map(Number);
const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--js-flags=--max-old-space-size=6000'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
let t = Date.now();
await page.goto(`http://127.0.0.1:${port}/index.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 600000 });
console.log('boot', Date.now() - t, 'ms');
for (const f of frames) {
  t = Date.now();
  const inner = await page.evaluate(async (f) => { const a = performance.now(); await window.renderFrame(f); return performance.now() - a; }, f);
  const t1 = Date.now();
  if (!process.argv.includes('--noshot')) await page.screenshot({ path: '/tmp/claude-0/prof.jpg', type: 'jpeg', quality: 95, timeout: 180000 });
  console.log(`f${f} render ${inner.toFixed(0)} ms  shot ${Date.now() - t1} ms`);
}
await browser.close(); srv.close();
