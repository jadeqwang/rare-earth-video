// Cron relay for long AI jobs. The client queues jobs in KV ("job:<id>" -> {model, input});
// every minute this Worker claims queued jobs, runs them with the AI binding (no 30 s client limit here),
// and writes "res:<id>" -> {state, result | error}. The client polls KV through the Cloudflare API.
export default {
  async scheduled(event, env, ctx) {
    const list = await env.JOBS.list({ prefix: "job:" });
    const claimed = [];
    for (const k of list.keys) {
      const id = k.name.slice(4);
      const st = await env.JOBS.get("state:" + id);
      if (st) continue;                       // already running or finished
      await env.JOBS.put("state:" + id, "running", { expirationTtl: 86400 });
      claimed.push(id);
      if (claimed.length >= 12) break;
    }
    ctx.waitUntil(Promise.all(claimed.map(async (id) => {
      const job = await env.JOBS.get("job:" + id, "json");
      try {
        const r = await env.AI.run(job.model, job.input);
        await env.JOBS.put("res:" + id, JSON.stringify({ state: "done", result: r }), { expirationTtl: 604800 });
      } catch (e) {
        await env.JOBS.put("res:" + id, JSON.stringify({ state: "error", error: String((e && e.message) || e) }), { expirationTtl: 604800 });
      }
      await env.JOBS.put("state:" + id, "finished", { expirationTtl: 604800 });
      await env.JOBS.delete("job:" + id);
    })));
  },
  async fetch() { return new Response("rare earth cron relay"); },
};
