"""Generation client for Rare Earth v3.

Only api.cloudflare.com is reachable from the sandbox, and requests through the session proxy are cut at ~30 s.
Short jobs use run_sync(). Long jobs use submit(): an AI Gateway background run whose webhook lands in the
relay Worker (pipeline/relay/relay_worker.js). The Worker stores the result and mirrors the media into KV,
and wait()/fetch_media() read them back through the KV API.

    from cf import submit, wait, fetch_media
    jid = submit("bytedance/seedance-2.5", {...}, tag="s12")
    rec = wait(jid)
    paths = fetch_media(jid, rec, "work/plates/s12")
"""
import base64
import io
import json
import mimetypes
import os
import re
import threading
import time
import uuid
import urllib.error
import urllib.request

ACC = "78885e7db58a4c34423a7e62c8471b75"
API = f"https://api.cloudflare.com/client/v4/accounts/{ACC}"
RELAY = "https://rare-earth-v3-relay.jadewang.workers.dev"
STATE = os.environ.get("RELAY_STATE", "/tmp/claude-0/-home-user-rare-earth-video/"
                       "2302fb46-aeb6-5e7c-afe1-2b25614cfe36/scratchpad/relay_state.json")
LEDGER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ledger.jsonl")
_lock = threading.Lock()


def _state():
    return json.load(open(STATE))


def _req(method, url, data=None, headers=None, timeout=60, raw=False):
    headers = dict(headers or {})
    body = None
    if data is not None:
        if isinstance(data, (bytes, bytearray)):
            body = data
        else:
            body = json.dumps(data).encode()
            headers.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            b = r.read()
            return (r.status, b) if raw else (r.status, json.loads(b.decode() or "null"))
    except urllib.error.HTTPError as e:
        b = e.read()
        if raw:
            return e.code, b
        try:
            return e.code, json.loads(b.decode())
        except Exception:
            return e.code, {"raw": b[:2000].decode(errors="replace")}


def data_uri(path, max_side=None, quality=92):
    """File -> data URI. Images can be downscaled (JPEG) to keep request bodies small."""
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    if path.endswith(".mp3"):
        mime = "audio/mpeg"
    elif path.endswith(".wav"):
        mime = "audio/wav"
    if max_side and mime.startswith("image/"):
        from PIL import Image
        im = Image.open(path).convert("RGB")
        im.thumbnail((max_side, max_side), Image.LANCZOS)
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=quality)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    return f"data:{mime};base64," + base64.b64encode(open(path, "rb").read()).decode()


def _clean(job_id):
    """Job ids travel in a URL path; the relay keeps only [A-Za-z0-9_.-]."""
    return re.sub(r"[^A-Za-z0-9_.-]", "", job_id)


def _summ(inp):
    def s(v):
        if isinstance(v, str) and v.startswith("data:"):
            return f"<data {len(v) // 1024}KB>"
        if isinstance(v, list):
            return [s(x) for x in v]
        if isinstance(v, dict):
            return {k: s(x) for k, x in v.items()}
        return v
    return s(inp)


def ledger(entry):
    entry = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **entry}
    with _lock, open(LEDGER, "a") as f:
        f.write(json.dumps(entry) + "\n")


def run_sync(model, inp, timeout=28, tag=""):
    """Direct call for fast models (finishes in < ~28 s)."""
    t0 = time.time()
    st, d = _req("POST", f"{API}/ai/run", {"model": model, "input": inp}, timeout=timeout)
    ledger({"kind": "sync", "tag": tag, "model": model, "input": _summ(inp), "status": st,
            "secs": round(time.time() - t0, 1), "err": None if st == 200 else json.dumps(d)[:500]})
    if st != 200 or (isinstance(d, dict) and d.get("success") is False):
        raise RuntimeError(f"{model} sync {st}: {json.dumps(d)[:1500]}")
    return d.get("result", d) if isinstance(d, dict) else d


def submit(model, inp, tag="", job_id=None):
    """Background run; the finished result arrives by webhook in KV res:<job_id>."""
    secret = _state()["secret"]
    job_id = _clean(job_id or f"{tag + '-' if tag else ''}{uuid.uuid4().hex[:10]}")
    body = {"model": model, "input": inp,
            "options": {"background": True, "webhookUrl": f"{RELAY}/hook/{secret}/{job_id}"}}
    st, d = _req("POST", f"{API}/ai/run", body, timeout=90)
    ledger({"kind": "bg", "tag": tag, "job": job_id, "model": model, "input": _summ(inp), "status": st,
            "resp": _summ(d) if isinstance(d, dict) else str(d)[:300]})
    if st not in (200, 202) or not (d or {}).get("success", False):
        raise RuntimeError(f"submit {model} failed {st}: {json.dumps(d)[:1500]}")
    return job_id


def submit_cron(model, inp, tag="", job_id=None, delay_min=2):
    """Fallback: queue for the relay's cron runner (runs about delay_min minutes from now)."""
    ns = _state()["ns"]
    job_id = _clean(job_id or f"{tag + '-' if tag else ''}{uuid.uuid4().hex[:10]}")
    bucket = int(time.time() // 60) + delay_min
    key = f"job:{bucket}:{job_id}"
    st, d = _req("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{key}",
                 json.dumps({"model": model, "input": inp}).encode(), {"Content-Type": "application/json"},
                 timeout=90)
    ledger({"kind": "cron", "tag": tag, "job": job_id, "model": model, "input": _summ(inp), "status": st})
    if st != 200:
        raise RuntimeError(f"kv put failed {st}: {d}")
    return job_id


def kv_get(key, raw=False, timeout=180):
    ns = _state()["ns"]
    for attempt in range(4):
        try:
            st, b = _req("GET", f"{API}/storage/kv/namespaces/{ns}/values/{key}", timeout=timeout, raw=True)
            break
        except Exception:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    if st == 404:
        return None
    if st != 200:
        raise RuntimeError(f"kv get {key} -> {st}: {b[:300]}")
    return b if raw else json.loads(b.decode())


def poll(job_id):
    return kv_get(f"res:{job_id}")


def refetch(job_id, url):
    """Queue a cron mirror of url into media:<job_id>:0 (used when the webhook mirror stalls)."""
    return submit_cron("fetch", {}, job_id=f"refetch-{job_id}", delay_min=1) if False else _queue_fetch(job_id, url)


def _queue_fetch(job_id, url, delay_min=1):
    ns = _state()["ns"]
    bucket = int(time.time() // 60) + delay_min
    key = f"job:{bucket}:rf{uuid.uuid4().hex[:8]}"
    st, d = _req("PUT", f"{API}/storage/kv/namespaces/{ns}/values/{key}",
                 json.dumps({"fetch_url": url, "media_id": job_id}).encode(), {"Content-Type": "application/json"}, timeout=90)
    ledger({"kind": "refetch", "job": job_id, "status": st})
    return st == 200


def wait(job_id, timeout=2400, every=8):
    t0 = time.time()
    stalled_since = None
    refetched = False
    while time.time() - t0 < timeout:
        rec = poll(job_id)
        if rec is not None:
            if rec.get("state") == "done" and rec.get("mirroring") and "media" not in rec:
                stalled_since = stalled_since or time.time()
                if not refetched and time.time() - stalled_since > 45:
                    url = _first_url(result_of(rec))
                    if url:
                        _queue_fetch(job_id, url)
                        refetched = True
                time.sleep(6)
                continue
            return rec
        time.sleep(every)
    raise TimeoutError(job_id)


def _first_url(v):
    if isinstance(v, str):
        return v if v.startswith("http") else None
    if isinstance(v, dict):
        for k in ("video", "image", "audio", "url"):
            if isinstance(v.get(k), str) and v[k].startswith("http"):
                return v[k]
        for x in v.values():
            r = _first_url(x)
            if r:
                return r
    if isinstance(v, list):
        for x in v:
            r = _first_url(x)
            if r:
                return r
    return None


def result_of(rec):
    """The model result inside a relay record (webhook payloads wrap it)."""
    if rec.get("via") == "cron":
        return rec.get("result")
    p = rec.get("payload") or {}
    return p.get("result", p)


def fetch_media(job_id, rec, out_base, ext=None):
    """Download mirrored media for a finished job. Returns the local paths."""
    paths = []
    for i, m in enumerate(rec.get("media") or []):
        if "key" not in m:
            continue
        e = ext or {"video/mp4": ".mp4", "video/quicktime": ".mov", "image/png": ".png", "image/jpeg": ".jpg",
                    "image/webp": ".webp", "audio/mpeg": ".mp3", "audio/wav": ".wav"}.get(
            (m.get("type") or "").split(";")[0], os.path.splitext(m["url"].split("?")[0])[1] or ".bin")
        n = m.get("chunks", 1)
        data = b"".join(kv_get(m["key"] if n == 1 else f"{m['key']}:{c}", raw=True) for c in range(n))
        p = f"{out_base}{'' if i == 0 else '_' + str(i)}{e}"
        os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
        open(p, "wb").write(data)
        paths.append(p)
    # inline base64 results (some image models return b64 instead of URLs)
    if not paths:
        res = result_of(rec)
        b64 = _find_b64(res)
        if b64:
            p = f"{out_base}{ext or '.png'}"
            os.makedirs(os.path.dirname(p) or ".", exist_ok=True)
            open(p, "wb").write(base64.b64decode(b64.split(",", 1)[-1]))
            paths.append(p)
    return paths


def _find_b64(v):
    if isinstance(v, str):
        if v.startswith("data:image") or (len(v) > 2000 and v[:4] in ("iVBO", "/9j/", "UklG")):
            return v
        return None
    if isinstance(v, dict):
        for k in ("b64_json", "image", "data", "images", "result", "output"):
            if k in v:
                r = _find_b64(v[k])
                if r:
                    return r
        for x in v.values():
            r = _find_b64(x)
            if r:
                return r
    if isinstance(v, list):
        for x in v:
            r = _find_b64(x)
            if r:
                return r
    return None


def generate(model, inp, out_base, tag="", timeout=2400):
    """submit + wait + fetch. Returns (paths, record)."""
    jid = submit(model, inp, tag=tag)
    rec = wait(jid, timeout=timeout)
    if rec.get("state") != "done":
        raise RuntimeError(f"{tag} {model} failed: {json.dumps(rec)[:1500]}")
    paths = fetch_media(jid, rec, out_base)
    ledger({"kind": "done", "tag": tag, "job": jid, "model": model, "paths": paths})
    return paths, rec
