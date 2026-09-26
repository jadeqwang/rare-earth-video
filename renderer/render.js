#!/usr/bin/env node
// Headless capture for the Rare Earth renderer.
//
//   node render.js stills --frames 0,100,240 [--w 1920 --h 1080] [--out dir]
//   node render.js stills --shots            (one still at the middle of every shot)
//   node render.js video --from 0 --to 4137 --out seg.mp4 [--w --h] [--q 0.95]
//   node render.js film --jobs 3 --out film.mp4 [--seg 240] [--resume] [--audio song.wav]
//                                                     (queued segments + concat + audio)
//
// Serves the repository root over HTTP so the page can fetch assets, drives
// window.RENDER.frame(n) and captures the canvas.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

function loadPlaywright() {
  for (const p of [process.env.PW, 'playwright', path.join(__dirname, 'node_modules', 'playwright'), path.join(__dirname, '..', 'work', 'bench', 'node_modules', 'playwright')]) {
    if (!p) continue;
    try { return require(p); } catch (e) { /* try the next location */ }
  }
  throw new Error('Playwright not found: run `npm install` in renderer/ (or set PW=/path/to/playwright)');
}
const { chromium } = loadPlaywright();

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const opt = {};
for (let i = 1; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
const W = +(opt.w || 1920), H = +(opt.h || 1080);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      const f = path.join(ROOT, u);
      if (!f.startsWith(ROOT)) { rsp.writeHead(403); return rsp.end(); }
      fs.readFile(f, (err, data) => {
        if (err) { rsp.writeHead(404); return rsp.end(); }
        rsp.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        rsp.end(data);
      });
    });
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

async function openPage(port) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-sandbox'] });
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  page.on('console', (m) => { if (m.type() === 'error' || opt.verbose) console.log('PAGE', m.type(), m.text().slice(0, 2000)); });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message.slice(0, 3000)));
  await page.goto(`http://127.0.0.1:${port}/renderer/index.html?w=${W}&h=${H}`);
  await page.waitForFunction(() => window.RENDER !== undefined, null, { timeout: 60000 });
  const info = await page.evaluate(() => window.RENDER.init());
  return { browser, page, info };
}

async function grab(page, n, q) {
  const shot = await page.evaluate((n) => window.RENDER.frame(n), n);
  const url = await page.evaluate((q) => document.getElementById('out').toDataURL('image/jpeg', q), q);
  return { shot, buf: Buffer.from(url.split(',')[1], 'base64') };
}

async function stills() {
  const srv = await serve();
  const { browser, page, info } = await openPage(srv.address().port);
  const out = opt.out || path.join(ROOT, 'work', 'stills');
  fs.mkdirSync(out, { recursive: true });
  let frames = [];
  if (opt.shots) {
    const shots = await page.evaluate(() => window.RENDER.shots());
    const which = opt.only ? new Set(String(opt.only).split(',')) : null;
    for (const s of shots) {
      if (which && !which.has(s.id)) continue;
      const pts = String(opt.at || '0.5').split(',').map(Number);
      for (const a of pts) frames.push(Math.floor((s.t0 + (s.t1 - s.t0) * a) * info.fps));
    }
  } else if (opt.frames) frames = String(opt.frames).split(',').map(Number);
  else if (opt.times) frames = String(opt.times).split(',').map((t) => Math.round(Number(t) * info.fps));
  for (const n of frames) {
    const t0 = Date.now();
    const { shot, buf } = await grab(page, n, +(opt.q || 0.9));
    const f = path.join(out, `f${String(n).padStart(5, '0')}_${shot}.jpg`);
    fs.writeFileSync(f, buf);
    console.log(`frame ${n} (${(n / info.fps).toFixed(2)}s) ${shot} ${Date.now() - t0}ms -> ${f}`);
  }
  await browser.close(); srv.close();
}

async function video(from, to, outFile, q = 0.95) {
  const srv = await serve();
  const { browser, page, info } = await openPage(srv.address().port);
  const ff = spawn(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(info.fps), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', opt.preset || 'medium', '-crf', String(opt.crf || 14), '-pix_fmt', 'yuv420p', '-tune', 'animation', outFile], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let n = from; n < to; n++) {
    const { buf } = await grab(page, n, q);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if ((n - from) % 48 === 0) console.log(`[${path.basename(outFile)}] ${n}/${to} ${(((Date.now() - t0) / 1000) / Math.max(1, n - from + 1)).toFixed(2)}s/frame`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close(); srv.close();
}

// Render the film as many short segments pulled from a queue by `jobs` workers (plate
// shots cost far more than graphics shots, so equal contiguous splits finish unevenly),
// then concatenate and mux the song.
async function film() {
  const jobs = +(opt.jobs || 3);
  const total = +(opt.to || 4137), from = +(opt.from || 0);
  const out = opt.out || path.join(ROOT, 'work', 'film.mp4');
  const segDir = opt.segdir || path.join(ROOT, 'work', 'segments', path.basename(out, '.mp4'));
  fs.mkdirSync(segDir, { recursive: true });
  const segLen = +(opt.seg || 240);
  const queue = [];
  for (let a = from, i = 0; a < total; a += segLen, i++) queue.push({ i, a, b: Math.min(total, a + segLen), f: path.join(segDir, `seg${String(i).padStart(3, '0')}.mp4`) });
  const all = queue.slice();
  const worker = async () => {
    while (queue.length) {
      const s = queue.shift();
      if (opt.resume && fs.existsSync(s.f) && fs.statSync(s.f).size > 1000) continue;
      await new Promise((res, rej) => {
        const k = spawn(process.execPath, [__filename, 'video', '--from', s.a, '--to', s.b, '--out', s.f, '--w', W, '--h', H, '--crf', opt.crf || 14, '--q', opt.q || 0.95, '--preset', opt.preset || 'medium'], { stdio: 'inherit' });
        k.on('close', (c) => (c === 0 ? res() : rej(new Error('segment failed ' + s.i))));
      });
    }
  };
  await Promise.all(Array.from({ length: jobs }, worker));
  const list = path.join(segDir, 'list.txt');
  fs.writeFileSync(list, all.map((s) => `file '${s.f}'`).join('\n'));
  const audio = opt.audio ? path.resolve(opt.audio) : path.join(ROOT, 'Rare Earth (Jade vocals re-added).mp3');
  const aStart = from / 24;
  await new Promise((res) => spawn(FFMPEG, ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(aStart), '-i', audio,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-shortest', '-movflags', '+faststart', out], { stdio: 'inherit' }).on('close', res));
  console.log('film ->', out);
}

(async () => {
  if (cmd === 'stills') await stills();
  else if (cmd === 'video') await video(+opt.from, +opt.to, opt.out, +(opt.q || 0.95));
  else if (cmd === 'film') await film();
  else console.log('usage: render.js stills|video|film');
})().catch((e) => { console.error(e); process.exit(1); });
