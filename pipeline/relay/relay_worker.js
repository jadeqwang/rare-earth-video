// Rare Earth v3 generation relay.
//
// The sandbox can only reach api.cloudflare.com, and requests through it are cut at ~30 s, so long
// generations (Seedance video, image models at high quality) cannot be awaited directly. Two paths,
// both reporting into KV, which the client reads back through the Cloudflare KV API:
//
// 1. Webhook sink: /ai/run is called with options.background=true and
//    webhookUrl=https://<this worker>/hook/<HOOK_SECRET>/<jobId>. The finished run is POSTed here;
//    it is stored as "res:<jobId>" and its media are mirrored into "media:<jobId>:<n>[:<chunk>]".
// 2. Cron queue (fallback): the client writes "job:<minuteBucket>:<jobId>" -> {model, input}; the cron
//    invocation for exactly that minute runs it, so overlapping cron runs never claim a job twice.

const CHUNK = 20 * 1024 * 1024;
const TTL = 21 * 86400;

function mediaUrls(r) {
  const out = [];
  const visit = (v) => {
    if (!v) return;
    if (typeof v === "string") { if (/^https?:\/\//.test(v)) out.push(v); return; }
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (typeof v === "object") {
      for (const k of ["video", "image", "images", "audio", "url", "data", "result", "output"]) visit(v[k]);
    }
  };
  visit(r);
  return [...new Set(out)];
}

async function mirror(env, jobId, result) {
  const urls = mediaUrls(result);
  const mirrored = [];
  for (let i = 0; i < urls.length; i++) {
    try {
      const resp = await fetch(urls[i]);
      if (!resp.ok) { mirrored.push({ url: urls[i], error: "fetch " + resp.status }); continue; }
      const buf = await resp.arrayBuffer();
      const type = resp.headers.get("content-type") || "";
      const n = Math.max(1, Math.ceil(buf.byteLength / CHUNK));
      const key = `media:${jobId}:${i}`;
      for (let c = 0; c < n; c++) {
        await env.JOBS.put(n === 1 ? key : `${key}:${c}`, buf.slice(c * CHUNK, (c + 1) * CHUNK), { expirationTtl: TTL });
      }
      mirrored.push({ url: urls[i], key, chunks: n, bytes: buf.byteLength, type });
    } catch (e) {
      mirrored.push({ url: urls[i], error: String((e && e.message) || e) });
    }
  }
  return mirrored;
}

async function runJob(env, jobKey, jobId) {
  const job = await env.JOBS.get(jobKey, "json");
  if (!job) return;
  await env.JOBS.delete(jobKey);
  const t0 = Date.now();
  await env.JOBS.put("state:" + jobId, JSON.stringify({ state: "running", t0 }), { expirationTtl: TTL });
  let rec;
  try {
    if (job.fetch_url) {
      // mirror-only job (the webhook's waitUntil ran out of time for a large file)
      const media = await mirror(env, job.media_id || jobId, { video: job.fetch_url });
      const prev = await env.JOBS.get("res:" + (job.media_id || jobId), "json");
      rec = { ...(prev || { state: "done", via: "cron" }), media, mirroring: false, refetched: Date.now() };
      await env.JOBS.put("res:" + (job.media_id || jobId), JSON.stringify(rec), { expirationTtl: TTL });
      return;
    }
    const r = await env.AI.run(job.model, job.input);
    const media = await mirror(env, jobId, r);
    rec = { state: "done", via: "cron", model: job.model, result: r, media, t0, t1: Date.now() };
  } catch (e) {
    rec = { state: "error", via: "cron", model: job.model, error: String((e && e.message) || e), t0, t1: Date.now() };
  }
  await env.JOBS.put("res:" + jobId, JSON.stringify(rec), { expirationTtl: TTL });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);
    if (request.method === "POST" && parts[0] === "hook" && parts[1] === env.HOOK_SECRET && parts[2]) {
      const jobId = parts[2].replace(/[^A-Za-z0-9_.-]/g, "");
      const body = await request.text();
      let payload;
      try { payload = JSON.parse(body); } catch { payload = { raw: body }; }
      const bad = payload.error || payload.errors?.length || payload.success === false;
      const rec = { state: bad ? "error" : "done", via: "webhook", payload, t1: Date.now() };
      await env.JOBS.put("res:" + jobId, JSON.stringify({ ...rec, mirroring: !bad }), { expirationTtl: TTL });
      ctx.waitUntil((async () => {
        if (!bad) {
          const media = await mirror(env, jobId, payload.result ?? payload);
          await env.JOBS.put("res:" + jobId, JSON.stringify({ ...rec, media }), { expirationTtl: TTL });
        }
      })());
      return new Response("ok");
    }
    return new Response("rare earth v3 relay", { status: parts.length ? 404 : 200 });
  },

  async scheduled(event, env, ctx) {
    const bucket = Math.floor(event.scheduledTime / 60000);
    const list = await env.JOBS.list({ prefix: `job:${bucket}:` });
    ctx.waitUntil(Promise.all(list.keys.map((k) => runJob(env, k.name, k.name.split(":")[2]))));
  },
};
