// Relay: runs long AI jobs (video generation) inside a Durable Object and keeps the result for polling.
// POST /submit {id, model, input}  -> starts the job (idempotent per id)
// GET  /result/:id                 -> {state: "running"|"done"|"error", result?, error?}
import { DurableObject } from "cloudflare:workers";

export class Runs extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url);
    if (req.method === "POST") {
      const cur = await this.ctx.storage.get("state");
      if (cur === "running" || cur === "done") return Response.json({ state: cur });
      const body = await req.json();
      await this.ctx.storage.put("state", "running");
      await this.ctx.storage.put("started", Date.now());
      this.ctx.waitUntil(this.go(body));
      return Response.json({ state: "running" });
    }
    const state = (await this.ctx.storage.get("state")) || "unknown";
    const out = { state, started: await this.ctx.storage.get("started") };
    if (state === "done") out.result = await this.ctx.storage.get("result");
    if (state === "error") out.error = await this.ctx.storage.get("error");
    return Response.json(out);
  }
  async go(body) {
    try {
      const r = await this.env.AI.run(body.model, body.input);
      await this.ctx.storage.put("result", r);
      await this.ctx.storage.put("state", "done");
    } catch (e) {
      await this.ctx.storage.put("error", String(e && (e.stack || e.message) || e));
      await this.ctx.storage.put("state", "error");
    }
  }
}

export default {
  async fetch(req, env) {
    if (req.headers.get("x-key") !== env.KEY) return new Response("no", { status: 403 });
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/submit") {
      const body = await req.json();
      const stub = env.RUNS.get(env.RUNS.idFromName(body.id));
      return stub.fetch("https://do/submit", { method: "POST", body: JSON.stringify(body) });
    }
    const m = url.pathname.match(/^\/result\/(.+)$/);
    if (m) return env.RUNS.get(env.RUNS.idFromName(m[1])).fetch("https://do/result");
    return new Response("rare earth relay", { status: 200 });
  },
};
