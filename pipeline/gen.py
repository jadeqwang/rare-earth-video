"""Thin client for Cloudflare AI partner + Workers AI models.

run(model, input, out_dir, tag) posts to /ai/run, waits for completion,
downloads any output URLs, and appends a line to the cost ledger.
Local files can be passed as references with as_data_uri(path).
"""
import base64, json, mimetypes, os, sys, time, urllib.request, urllib.error, urllib.parse

ACC = "78885e7db58a4c34423a7e62c8471b75"
BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACC}"
LEDGER = os.path.join(os.path.dirname(__file__), "..", "work", "ledger.jsonl")


def as_data_uri(path):
    mt = mimetypes.guess_type(path)[0] or "application/octet-stream"
    if path.endswith(".mp3"):
        mt = "audio/mpeg"
    return f"data:{mt};base64," + base64.b64encode(open(path, "rb").read()).decode()


def _post(url, body, timeout):
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "cf-aig-request-timeout": str(int(timeout * 1000)),
                                          "cf-aig-max-attempts": "1"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        txt = e.read().decode(errors="replace")
        try:
            return json.loads(txt)
        except Exception:
            return {"success": False, "errors": [{"message": txt[:500], "code": e.code}]}


def _get(url, timeout=120):
    with urllib.request.urlopen(url, timeout=timeout) as r:
        return json.load(r)


def _strip(obj):
    """Copy of a request with base64 payloads shortened, for logging."""
    if isinstance(obj, dict):
        return {k: _strip(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_strip(v) for v in obj]
    if isinstance(obj, str) and obj.startswith("data:") and len(obj) > 200:
        return obj[:60] + f"...<{len(obj)} chars>"
    return obj


def _urls(obj):
    if isinstance(obj, dict):
        for v in obj.values():
            yield from _urls(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _urls(v)
    elif isinstance(obj, str) and obj.startswith("https://"):
        yield obj


def download(url, path):
    for attempt in range(2):
        try:
            with urllib.request.urlopen(url, timeout=600) as r, open(path, "wb") as f:
                while True:
                    b = r.read(1 << 20)
                    if not b:
                        break
                    f.write(b)
            return path
        except Exception as e:
            print("download retry", attempt, e, file=sys.stderr)
            time.sleep(2 ** attempt)
    raise RuntimeError("download failed: " + url)


def run(model, inp, out_dir, tag, timeout=1800, ext_hint=None, meta=None):
    os.makedirs(out_dir, exist_ok=True)
    t0 = time.time()
    body = {"model": model, "input": inp}
    json.dump(_strip(body), open(os.path.join(out_dir, f"{tag}.request.json"), "w"), indent=1)
    resp = _post(f"{BASE}/ai/run", body, timeout)
    # async jobs: poll if the platform hands back a pending state
    for _ in range(400):
        res = resp.get("result") or {}
        state = res.get("state") if isinstance(res, dict) else None
        if state in (None, "Completed", "Failed", "Error") or not resp.get("success", True):
            break
        poll = res.get("poll_url") or res.get("status_url")
        if not poll:
            break
        time.sleep(5)
        resp = _get(poll)
    json.dump(resp, open(os.path.join(out_dir, f"{tag}.response.json"), "w"), indent=1)
    files = []
    if resp.get("success"):
        for i, u in enumerate(_urls(resp.get("result"))):
            ext = ext_hint or os.path.splitext(u.split("?")[0])[1] or ".bin"
            if not ext.startswith("."):
                ext = "." + ext
            p = os.path.join(out_dir, f"{tag}{'' if i == 0 else '_' + str(i)}{ext}")
            download(u, p)
            files.append(p)
        # inline base64 images (Workers AI style)
        r = resp.get("result") or {}
        if isinstance(r, dict) and isinstance(r.get("image"), str) and not r["image"].startswith("http"):
            p = os.path.join(out_dir, f"{tag}.jpg")
            open(p, "wb").write(base64.b64decode(r["image"]))
            files.append(p)
    dt = time.time() - t0
    entry = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "model": model, "tag": tag, "ok": bool(resp.get("success")),
             "secs": round(dt, 1), "duration": inp.get("duration"), "resolution": inp.get("resolution"),
             "files": files, "err": None if resp.get("success") else resp.get("errors"), "meta": meta}
    os.makedirs(os.path.dirname(LEDGER), exist_ok=True)
    with open(LEDGER, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return resp, files


# ---------------------------------------------------------------------------
# Background jobs via the relay Worker (rare-earth-video-relay).
# /ai/run requests through the sandbox are cut at ~30 s, so long generations are
# submitted with options.background=true and a webhook that lands in KV.
# ---------------------------------------------------------------------------
KV_NS = "9b9940d60c39464b96123a348ac6d798"
RELAY = "https://rare-earth-video-relay.jadewang.workers.dev"
# The webhook path secret (the Worker's HOOK_SECRET) is never stored in the repo:
# pass it as RELAY_SECRET, or point RELAY_SECRET_FILE at a file that holds it.
_SECRET_PATH = os.environ.get("RELAY_SECRET_FILE", os.path.expanduser("~/.rare_earth_relay_secret"))


def _secret():
    return os.environ.get("RELAY_SECRET") or open(_SECRET_PATH).read().strip()


def kv_get(key, as_json=True):
    url = f"{BASE}/storage/kv/namespaces/{KV_NS}/values/{urllib.parse.quote(key, safe='')}"
    try:
        with urllib.request.urlopen(url, timeout=120) as r:
            data = r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise
    return json.loads(data) if as_json else data


def submit(model, inp, job_id, out_dir=None, meta=None):
    """Fire a background run; returns the immediate response."""
    import urllib.parse  # noqa
    body = {"model": model, "input": inp,
            "options": {"background": True, "webhookUrl": f"{RELAY}/hook/{_secret()}/{job_id}"}}
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
        json.dump(_strip(body | {"options": {"background": True}}),
                  open(os.path.join(out_dir, f"{job_id}.request.json"), "w"), indent=1)
    resp = _post(f"{BASE}/ai/run", body, 60)
    entry = {"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "model": model, "tag": job_id, "submitted": True,
             "ok": bool(resp.get("success")), "duration": inp.get("duration"),
             "resolution": inp.get("resolution"), "err": None if resp.get("success") else resp.get("errors"),
             "meta": meta}
    with open(LEDGER, "a") as f:
        f.write(json.dumps(entry) + "\n")
    return resp


def wait(job_id, out_dir, timeout=1800, every=10, ext_hint=None, quiet=False):
    """Poll KV for the webhook result, download media, return (record, files)."""
    t0 = time.time()
    while time.time() - t0 < timeout:
        rec = kv_get("res:" + job_id)
        if rec and rec.get("via") == "webhook" and rec.get("state") == "done" and "media" not in rec and time.time() - t0 < timeout:
            # the relay mirrors media right after writing the record; give it a moment
            waited = getattr(wait, "_mw", {}).get(job_id, 0)
            if waited < 12:
                wait._mw = getattr(wait, "_mw", {}); wait._mw[job_id] = waited + 1
                time.sleep(10)
                continue
        if rec:
            json.dump(rec, open(os.path.join(out_dir, f"{job_id}.result.json"), "w"), indent=1)
            files = []
            payload = rec.get("payload") or {}
            res = payload.get("result") if rec.get("via") == "webhook" else rec.get("result")
            if rec.get("state") == "done":
                for i, u in enumerate(_urls(res)):
                    ext = ext_hint or os.path.splitext(u.split("?")[0])[1] or ".bin"
                    p = os.path.join(out_dir, f"{job_id}{'' if i == 0 else '_' + str(i)}{ext}")
                    try:
                        download(u, p)
                    except Exception:
                        # fall back to the KV mirror (possibly chunked)
                        info = next((m for m in (rec.get("media") or []) if m.get("key") == f"media:{job_id}:{i}"), None)
                        data = fetch_media(f"media:{job_id}:{i}", info)
                        if data is None:
                            raise
                        open(p, "wb").write(data)
                    files.append(p)
            with open(LEDGER, "a") as f:
                f.write(json.dumps({"t": time.strftime("%Y-%m-%dT%H:%M:%S"), "tag": job_id, "done": True,
                                    "state": rec.get("state"), "secs": round(time.time() - t0, 1),
                                    "files": files, "err": payload.get("error") or rec.get("error")}) + "\n")
            return rec, files
        if not quiet:
            print(f"  waiting {job_id} {int(time.time()-t0)}s", flush=True)
        time.sleep(every)
    return None, []


def batch(jobs, out_dir, timeout=1800, every=8):
    """jobs: list of dicts {id, model, input, ext}. Submits all, then waits for all."""
    import concurrent.futures as cf
    ids = []
    for j in jobs:
        r = submit(j["model"], j["input"], j["id"], out_dir=out_dir, meta=j.get("meta"))
        if not r.get("success"):
            print("SUBMIT FAIL", j["id"], r.get("errors"))
        else:
            ids.append(j)
    results = {}
    with cf.ThreadPoolExecutor(max_workers=min(16, max(1, len(ids)))) as ex:
        futs = {ex.submit(wait, j["id"], out_dir, timeout, every, j.get("ext"), True): j for j in ids}
        for f in cf.as_completed(futs):
            j = futs[f]
            try:
                rec, files = f.result()
            except Exception as e:
                rec, files = {"state": "error", "error": str(e)}, []
            state = (rec or {}).get("state")
            err = None
            if rec and rec.get("via") == "webhook":
                err = (rec.get("payload") or {}).get("error")
            print(f"  {j['id']}: {state} {files} {err or ''}", flush=True)
            results[j["id"]] = (rec, files)
    return results


def kv_put(key, value):
    url = f"{BASE}/storage/kv/namespaces/{KV_NS}/values/{urllib.parse.quote(key, safe='')}"
    data = value if isinstance(value, (bytes, bytearray)) else json.dumps(value).encode()
    req = urllib.request.Request(url, data=data, method="PUT", headers={"Content-Type": "application/octet-stream"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def fetch_media(key, info=None):
    """Read a mirrored media value from KV, reassembling chunked values."""
    chunks = (info or {}).get("chunks", 1)
    if chunks <= 1:
        data = kv_get(key, as_json=False)
        if data is not None:
            return data
        chunks = 0
        while kv_get(f"{key}:c{chunks}", as_json=False) is not None and chunks < 64:
            chunks += 1
    if chunks == 0:
        return None
    parts = [kv_get(f"{key}:c{k}", as_json=False) for k in range(chunks)]
    if any(p is None for p in parts):
        return None
    return b"".join(parts)


def mirror_url(url, job_id, out_path, timeout=600):
    """Ask the relay's cron to fetch `url` into KV (chunked), then download it to out_path."""
    bucket = int(time.time() // 60) + 1
    kv_put(f"job:{bucket}:{job_id}", {"type": "mirror", "url": url})
    t0 = time.time()
    while time.time() - t0 < timeout:
        rec = kv_get("res:" + job_id)
        if rec:
            m = (rec.get("media") or [{}])[0]
            if m.get("error"):
                raise RuntimeError(f"mirror failed: {m}")
            data = fetch_media(m["key"], m)
            open(out_path, "wb").write(data)
            return out_path
        time.sleep(10)
    raise TimeoutError(job_id)
