"""Recover finished jobs whose webhook media mirror stalled: queue cron re-fetch, then download into work/plates/raw."""
import json, os, sys, time
import cf
st = cf._state()
code, d = cf._req("GET", f"{cf.API}/storage/kv/namespaces/{st['ns']}/keys?prefix=res:&limit=1000")
todo = []
for k in d.get("result", []):
    jid = k["name"][4:]
    if not jid.startswith("P"):
        continue
    pid_take = jid.rsplit("-", 1)[0]  # e.g. P02_care_t0
    out = f"/home/user/rare-earth-video/work/plates/raw/{pid_take}.mp4"
    if os.path.exists(out):
        continue
    rec = cf.poll(jid)
    if rec is None:
        continue
    if rec.get("state") != "done":
        print(jid, "state", rec.get("state"), str(rec.get("payload", {}).get("error"))[:200]); continue
    if "media" not in rec and "--queue" in sys.argv:
        url = cf._first_url(cf.result_of(rec))
        cf._queue_fetch(jid, url)
        print("queued refetch", jid)
    todo.append((jid, out))
t0 = time.time()
while todo and time.time() - t0 < 900:
    rest = []
    for jid, out in todo:
        rec = cf.poll(jid) or {}
        if rec.get("media"):
            paths = cf.fetch_media(jid, rec, out[:-4])
            if paths and paths[0] != out: os.replace(paths[0], out)
            print("recovered", out, os.path.getsize(out)); continue
        rest.append((jid, out))
    todo = rest
    if todo: time.sleep(10)
print("remaining", todo)
