"""Client for the KV + cron relay: submit long jobs, poll for results. All traffic is short calls to api.cloudflare.com."""
import json, os, time, uuid
import requests
from cf import ACCOUNT

BASE = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}"
HERE = os.path.dirname(os.path.abspath(__file__))
STATE = os.path.join(HERE, "relay", "relay_state.json")
NAME = "rare-earth-cron-relay"


def _state():
    return json.load(open(STATE)) if os.path.exists(STATE) else {}


def ns_id():
    return _state()["ns"]


def deploy():
    st = _state()
    if "ns" not in st:
        r = requests.post(f"{BASE}/storage/kv/namespaces", json={"title": "rare-earth-jobs"}, timeout=60).json()
        if not r.get("success"):
            r2 = requests.get(f"{BASE}/storage/kv/namespaces", params={"per_page": 100}, timeout=60).json()
            st["ns"] = [n["id"] for n in r2["result"] if n["title"] == "rare-earth-jobs"][0]
        else:
            st["ns"] = r["result"]["id"]
        json.dump(st, open(STATE, "w"))
    meta = {"main_module": "cron_worker.js", "compatibility_date": "2026-09-01",
            "bindings": [{"type": "ai", "name": "AI"}, {"type": "kv_namespace", "name": "JOBS", "namespace_id": st["ns"]}]}
    files = {"metadata": (None, json.dumps(meta), "application/json"),
             "cron_worker.js": ("cron_worker.js", open(os.path.join(HERE, "relay", "cron_worker.js"), "rb"), "application/javascript+module")}
    r = requests.put(f"{BASE}/workers/scripts/{NAME}", files=files, timeout=120)
    print("deploy", r.status_code, r.text[:300])
    r = requests.put(f"{BASE}/workers/scripts/{NAME}/schedules", json=[{"cron": "* * * * *"}], timeout=60)
    print("schedule", r.status_code, r.text[:300])


def kv_put(key, value):
    r = requests.put(f"{BASE}/storage/kv/namespaces/{ns_id()}/values/{key}", data=value.encode() if isinstance(value, str) else value,
                     headers={"Content-Type": "text/plain"}, timeout=120)
    r.raise_for_status()


def kv_get(key, binary=False):
    r = requests.get(f"{BASE}/storage/kv/namespaces/{ns_id()}/values/{key}", timeout=300)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.content if binary else r.text


def fetch_media(result, dest):
    """Write a relay result's media to dest (from the KV mirror)."""
    key = result.get("kv_media")
    if not key:
        raise RuntimeError(f"no kv media: {result.get('kv_error')}")
    data = kv_get(key, binary=True)
    with open(dest, "wb") as f:
        f.write(data)
    return dest


def submit(model, inp, jid=None):
    jid = jid or uuid.uuid4().hex[:16]
    kv_put("job:" + jid, json.dumps({"model": model, "input": inp}))
    return jid


def submit_fetch(url, jid=None):
    jid = jid or uuid.uuid4().hex[:16]
    kv_put("job:" + jid, json.dumps({"fetch_url": url}))
    return jid


def result(jid):
    v = kv_get("res:" + jid)
    return json.loads(v) if v else None


def wait(jid, timeout=1800, every=20):
    t0 = time.time()
    while time.time() - t0 < timeout:
        r = result(jid)
        if r:
            return r
        time.sleep(every)
    raise TimeoutError(jid)
