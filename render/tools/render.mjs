// Deterministic frame renderer.
//   node tools/render.mjs --from 0 --to 4137 --workers 4 --out ../work/frames [--scale 1] [--every 1] [--mux out.mp4]
//   node tools/render.mjs --stills 3.9,12.0,40.1 --out ../work/stills
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { serve } from './serve.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, x, i, arr) => {
  if (x.startsWith('--')) a.push([x.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
  return a; }, []));
const FPS = 24, W = 1920, H = 1080;
const out = path.resolve(args.out || '../work/frames');
fs.mkdirSync(out, { recursive: true });
const workers = +(args.workers || 3);
const quality = +(args.quality || 95);
const { srv, port } = await serve(0);
const CHROME = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

let frames = [];
if (args.stills) frames = String(args.stills).split(',').map((s) => Math.round(parseFloat(s) * FPS));
else {
  const from = +(args.from || 0), to = +(args.to || Math.ceil(172.36 * FPS)), every = +(args.every || 1);
  for (let f = from; f < to; f += every) frames.push(f);
}
if (args.skipExisting) frames = frames.filter((f) => !fs.existsSync(path.join(out, `f${String(f).padStart(5, '0')}.jpg`)));
console.log(`rendering ${frames.length} frames with ${workers} workers -> ${out}`);

async function worker(id, list) {
  const browser = await chromium.launch({ executablePath: CHROME,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-networking', '--disable-component-update', '--no-first-run', '--ignore-gpu-blocklist',
           '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--js-flags=--max-old-space-size=6000'] });
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('[r]')) console.log(`[w${id}]`, m.text()); });
  page.on('pageerror', (e) => console.log(`[w${id}] PAGEERROR`, e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html${args.query ? '?' + args.query : ''}`);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 600000 });
  let t0 = Date.now(), n = 0;
  for (const f of list) {
    await page.evaluate((f) => window.renderFrame(f), f);
    const file = path.join(out, `f${String(f).padStart(5, '0')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality, clip: { x: 0, y: 0, width: W, height: H }, timeout: 180000 });
    n++;
    if (n % 24 === 0) console.log(`[w${id}] ${n}/${list.length}  ${((Date.now() - t0) / n).toFixed(0)} ms/frame  (f${f})`);
  }
  await browser.close();
}
const lists = Array.from({ length: workers }, () => []);
// interleave in chunks so each worker keeps asset locality
const CH = 12;
frames.forEach((f, i) => lists[Math.floor(i / CH) % workers].push(f));
const t0 = Date.now();
await Promise.all(lists.map((l, i) => l.length ? worker(i, l) : null));
console.log(`done in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
srv.close();

if (args.mux) {
  const audio = path.resolve('../work/audio/song.wav');
  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(out, 'f%05d.jpg'),
    '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(args.crf || 17),
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', path.resolve(args.mux)],
    { stdio: 'inherit' });
  await new Promise((r) => ff.on('close', r));
  console.log('muxed', args.mux);
}
