// Render one frame and report console output + a few pixel samples: node tools/probe.mjs <seconds>
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const t = +process.argv[2];
const { srv, port } = await serve(0);
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', (m) => console.log('[c]', m.type(), m.text()));
p.on('pageerror', (e) => console.log('[PAGEERROR]', e.message, e.stack));
await p.goto(`http://127.0.0.1:${port}/index.html`);
await p.waitForFunction(() => window.READY === true || window.BOOTERR, null, { timeout: 300000 });
console.log('booterr', await p.evaluate(() => window.BOOTERR || null));
try { await p.evaluate((f) => window.renderFrame(f), Math.round(t * 24)); } catch (e) { console.log('RENDER THREW', e.message); }
const info = await p.evaluate(() => { const c = document.getElementById('out'); const gl = c.getContext('webgl2'); const px = new Uint8Array(4); const out = [];
  for (const [x, y] of [[960, 540], [300, 300], [1500, 800], [960, 900]]) { gl.readPixels(x, 1080 - y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push([x, y, ...px]); } return { out, err: gl.getError() }; });
console.log(JSON.stringify(info));
await b.close(); srv.close();
