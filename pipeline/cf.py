"""Thin client for Cloudflare's universal /ai/run endpoint (auth is injected by the session proxy)."""
import base64, json, mimetypes, os, sys, time, pathlib
import requests

ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "78885e7db58a4c34423a7e62c8471b75")
URL = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/ai/run"
LOG = pathlib.Path(__file__).resolve().parent.parent / "gen" / "ledger.jsonl"


def data_uri(path, max_side=None):
    path = str(path)
    if max_side:
        from PIL import Image
        import io
        im = Image.open(path).convert("RGB")
        im.thumbnail((max_side, max_side))
        buf = io.BytesIO(); im.save(buf, "JPEG", quality=92)
        return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()
    mt = mimetypes.guess_type(path)[0] or "application/octet-stream"
    return f"data:{mt};base64," + base64.b64encode(open(path, "rb").read()).decode()


def run(model, inp, timeout=900, tag=None, retries=2):
    body = {"model": model, "input": inp}
    for attempt in range(retries + 1):
        t0 = time.time()
        try:
            r = requests.post(URL, json=body, timeout=timeout)
        except requests.RequestException as e:
            err = f"net: {e}"
            if attempt < retries:
                time.sleep(5 * (attempt + 1)); continue
            _log(tag, model, inp, None, err, time.time() - t0)
            raise
        dt = time.time() - t0
        try:
            j = r.json()
        except Exception:
            j = {"raw": r.text[:2000]}
        if r.status_code != 200 or not j.get("success", True) or j.get("errors"):
            err = f"{r.status_code}: {json.dumps(j)[:1500]}"
            _log(tag, model, inp, None, err, dt)
            if r.status_code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(15 * (attempt + 1)); continue
            raise RuntimeError(err)
        res = j.get("result", j)
        _log(tag, model, inp, res, None, dt)
        return res


def _log(tag, model, inp, res, err, dt):
    LOG.parent.mkdir(parents=True, exist_ok=True)
    slim = {k: (v[:80] + "…" if isinstance(v, str) and len(v) > 200 else v) for k, v in inp.items()
            if k not in ("reference_images",)}
    if "reference_images" in inp:
        slim["n_reference_images"] = len(inp["reference_images"])
    with open(LOG, "a") as f:
        f.write(json.dumps({"t": time.strftime("%H:%M:%S"), "tag": tag, "model": model, "input": slim,
                            "result": res, "error": err, "secs": round(dt, 1)}) + "\n")


def download(url, dest):
    dest = pathlib.Path(dest); dest.parent.mkdir(parents=True, exist_ok=True)
    if url.startswith("data:"):
        dest.write_bytes(base64.b64decode(url.split(",", 1)[1])); return dest
    with requests.get(url, stream=True, timeout=300) as r:
        r.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    return dest


def find_media(res):
    """Pull the first URL/data-URI out of a model result, whatever its shape."""
    if isinstance(res, str):
        return res if res.startswith(("http", "data:")) else None
    if isinstance(res, dict):
        for k in ("video", "image", "url", "audio"):
            if k in res and isinstance(res[k], str):
                return res[k]
        for v in res.values():
            u = find_media(v)
            if u: return u
    if isinstance(res, list):
        for v in res:
            u = find_media(v)
            if u: return u
    return None
