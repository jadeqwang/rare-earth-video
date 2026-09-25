"""Generation driver: start frames (image model) and motion clips (video model), parallel and resumable.

  python3 gen.py frames [ids...] [--n 2] [--model nano|seedream]
  python3 gen.py clips  [ids...] [--n 1] [--model seedance|h3] [--res 720p]
  python3 gen.py pick ID K        # choose frame candidate K as the shot's start frame

Outputs: gen/frames/{id}_{k}.jpg, gen/frames/{id}.jpg (picked), gen/clips/{id}_{k}.mp4
"""
import argparse, io, json, os, sys, time, traceback
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image, ImageOps

import cf
from shots import SHOTS, BY_ID, REF, ROOT

GEN = os.path.join(ROOT, "gen")
FR = os.path.join(GEN, "frames")
CL = os.path.join(GEN, "clips")
os.makedirs(FR, exist_ok=True); os.makedirs(CL, exist_ok=True)


def ref_uri(key, max_side=1536):
    im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, REF[key]))).convert("RGB")
    im.thumbnail((max_side, max_side))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=92)
    import base64
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def img_uri(path, max_side=None):
    im = Image.open(path).convert("RGB")
    if max_side: im.thumbnail((max_side, max_side))
    buf = io.BytesIO(); im.save(buf, "JPEG", quality=94)
    import base64
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def gen_frame(shot, k, model="nano", extra=""):
    out = os.path.join(FR, f"{shot.id}_{k}.jpg")
    if os.path.exists(out):
        return out, "exists"
    prompt = shot.prompt + (" " + extra if extra else "")
    refs = shot.refs
    if model == "nano":
        inp = {"prompt": prompt, "aspect_ratio": "16:9", "image_size": "2K", "output_format": "jpg"}
        if refs:
            inp["image_input"] = [ref_uri(r) for r in refs[:3]]
        res = cf.run("google/nano-banana-pro", inp, timeout=600, tag=f"frame {shot.id}_{k}")
    elif model == "seedream":
        inp = {"prompt": prompt, "size": "2560x1440", "watermark": False}
        if refs:
            inp["image"] = [ref_uri(r) for r in refs[:10]]
        res = cf.run("bytedance/seedream-5-pro", inp, timeout=600, tag=f"frame {shot.id}_{k}")
    else:
        raise ValueError(model)
    url = cf.find_media(res)
    tmp = out + ".tmp"
    cf.download(url, tmp)
    Image.open(tmp).convert("RGB").save(out, "JPEG", quality=95)
    os.remove(tmp)
    return out, "ok"


def gen_clip(shot, k, model="seedance", res="720p", frame=None, dur=None, last=None, ref_audio=None, prompt=None):
    out = os.path.join(CL, f"{shot.id}_{k}.mp4")
    if os.path.exists(out):
        return out, "exists"
    frame = frame or os.path.join(FR, f"{shot.id}.jpg")
    dur = dur or shot.gen_dur
    prompt = prompt or shot.motion
    if model == "seedance":
        inp = {"prompt": prompt, "image": img_uri(frame, 1920), "duration": max(4, int(dur)), "resolution": res,
               "aspect_ratio": "adaptive", "fps": 24, "camera_fixed": False, "watermark": False,
               "output_format": "mp4", "use_virtual_avatar": False, "generate_audio": False}
        if last:
            inp["last_frame_image"] = img_uri(last, 1920)
        if ref_audio:
            inp["reference_audios"] = [ref_audio]
        r = cf.run("bytedance/seedance-2.5", inp, timeout=1200, tag=f"clip {shot.id}_{k}")
    elif model == "h3":
        content = [{"type": "text", "text": prompt},
                   {"type": "image_url", "image_url": {"url": img_uri(frame, 1920)}, "role": "first_frame"}]
        if last:
            content.append({"type": "image_url", "image_url": {"url": img_uri(last, 1920)}, "role": "last_frame"})
        r = cf.run("minimax/h3", {"content": content, "resolution": "2K", "duration": max(4, int(dur)), "ratio": "16:9"},
                   timeout=1200, tag=f"clip {shot.id}_{k}")
        r = poll_h3(r)
    else:
        raise ValueError(model)
    url = cf.find_media(r)
    if not url:
        raise RuntimeError(f"no media in result: {json.dumps(r)[:500]}")
    cf.download(url, out)
    return out, "ok"


def poll_h3(r):
    # H3 returns a task; if not finished synchronously, there is no documented poll route via /ai/run,
    # so we surface the state for inspection.
    task = r.get("task", r) if isinstance(r, dict) else r
    if isinstance(task, dict) and task.get("status") not in (None, "succeeded"):
        raise RuntimeError(f"h3 task not complete: {json.dumps(task)[:400]}")
    return r


def run_parallel(jobs, workers=6):
    results = {}
    with ThreadPoolExecutor(workers) as ex:
        futs = {ex.submit(fn, *a, **kw): name for name, fn, a, kw in jobs}
        for f in as_completed(futs):
            name = futs[f]
            try:
                p, st = f.result()
                print(f"[{time.strftime('%H:%M:%S')}] {name}: {st} {p}", flush=True)
                results[name] = p
            except Exception as e:
                print(f"[{time.strftime('%H:%M:%S')}] {name}: FAIL {str(e)[:300]}", flush=True)
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("stage")
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--n", type=int, default=2)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--model", default=None)
    ap.add_argument("--res", default="720p")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--extra", default="")
    a = ap.parse_args()
    if a.stage == "pick":
        sid, k = a.ids
        src = os.path.join(FR, f"{sid}_{k}.jpg")
        Image.open(src).save(os.path.join(FR, f"{sid}.jpg"), quality=95)
        print("picked", src); return
    shots = [BY_ID[i] for i in a.ids] if a.ids else [s for s in SHOTS if s.model != "none" and s.prompt]
    jobs = []
    for s in shots:
        for k in range(a.start, a.start + a.n):
            if a.stage == "frames":
                jobs.append((f"{s.id}_{k}", gen_frame, (s, k), {"model": a.model or "nano", "extra": a.extra}))
            elif a.stage == "clips":
                if not os.path.exists(os.path.join(FR, f"{s.id}.jpg")):
                    print("no picked frame for", s.id); continue
                jobs.append((f"{s.id}_{k}", gen_clip, (s, k), {"model": a.model or "seedance", "res": a.res}))
    run_parallel(jobs, a.workers)


if __name__ == "__main__" and sys.argv[1:2] != ["zoom"]:
    main()


# ----------------------------------------------------------------------------- shot 44: nested zoom-out plates
ZOOM_LEVELS = [
    ("zoom_0", None, "Hand-painted anime film still, 16:9. Exterior of a small old two-storey house at night, seen from just "
     "outside: one study window glows warm gold with soft pale blue light inside, among dark low tiled rooftops, under a clear "
     "sky full of stars. Detailed painted background art, soft film grain. No text."),
    ("zoom_1", "zoom_0", "Zoom out: this exact image must appear unchanged, small, at the exact centre of the new frame, "
     "occupying the middle quarter of the width. Around it, extend the scene: a quiet sleeping neighbourhood of dark tiled "
     "rooftops at night seen from above, scattered warm windows, the one glowing window at the centre, starry sky at the top. "
     "Hand-painted anime film style, 16:9. No text."),
    ("zoom_2", "zoom_1", "Zoom out: this exact image must appear unchanged, small, at the exact centre of the new frame, "
     "occupying the middle quarter of the width. Around it, extend the scene: high above a sleeping hillside town at night, "
     "looking down through thin moonlit clouds at the scattered warm lights; the town is at the centre. Hand-painted anime "
     "film style, 16:9. No text."),
    ("zoom_3", "zoom_2", "Zoom out: this exact image must appear unchanged, small, at the exact centre of the new frame, "
     "occupying the middle quarter of the width. Around it, extend the scene: the night side of planet Earth seen from orbit, "
     "swirls of cloud, a thin blue atmosphere glowing along the curved horizon, the lit town at the centre among dark "
     "continents. Hand-painted anime film style, 16:9. No text."),
    ("zoom_4", "zoom_3", "Zoom out: this exact image must appear unchanged, small, at the exact centre of the new frame, "
     "occupying the middle quarter of the width. Around it: Earth as a whole blue marble in black space, partly lit, a few "
     "stars. Hand-painted anime film style, 16:9. No text."),
    ("zoom_5", "zoom_4", "Zoom out: this exact image must appear unchanged, tiny, at the exact centre of the new frame. "
     "Deep space: Earth is now just a pale blue speck resting inside a faint vertical band of scattered golden sunlight, "
     "like the Voyager 'pale blue dot' photograph, surrounded by darkness and a few stars. Hand-painted anime style, 16:9. No text."),
]


def gen_zoom():
    for name, prev, prompt in ZOOM_LEVELS:
        out = os.path.join(FR, name + ".jpg")
        if os.path.exists(out):
            continue
        inp = {"prompt": prompt, "aspect_ratio": "16:9", "image_size": "2K", "output_format": "jpg"}
        if prev:
            inp["image_input"] = [img_uri(os.path.join(FR, prev + ".jpg"), 1536)]
        r = cf.run("google/nano-banana-pro", inp, timeout=600, tag=f"zoom {name}")
        cf.download(cf.find_media(r), out)
        print("zoom plate", out, flush=True)


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "zoom":
    gen_zoom()
