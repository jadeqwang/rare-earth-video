// Screenshot a lab page served over http: node tools/lab.mjs lab/page.html out.png [w h] [query]
import { chromium } from 'playwright';
import { serve } from './serve.mjs';
const [,, page, out, w = '1920', h = '1080', query = ''] = process.argv;
const { srv, port } = await serve(0);
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking', '--disable-component-update', '--no-first-run'] });
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
p.on('console', (m) => console.log('[page]', m.text()));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
p.on('requestfailed', (r) => console.log('REQFAIL', r.url()));
p.on('response', (r) => { if (r.status() >= 400) console.log('HTTP', r.status(), r.url()); });
await p.goto(`http://127.0.0.1:${port}/${page}${query ? '?' + query : ''}`);
await p.waitForFunction(() => window.DONE === true, null, { timeout: 300000 });
await p.screenshot({ path: out });
await browser.close(); srv.close();
