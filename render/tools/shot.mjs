// usage: node tools/shot.mjs page.html out.png [width height]
import { chromium } from 'playwright';
import path from 'path';
const [,, page, out, w='1920', h='1080'] = process.argv;
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files'] });
const p = await browser.newPage({ viewport: { width: +w, height: +h } });
await p.goto('file://' + path.resolve(page));
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(500);
await p.screenshot({ path: out, fullPage: true });
await browser.close();
