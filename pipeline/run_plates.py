"""Generate Seedance 2.5 base plates.

    python3 pipeline/run_plates.py [PID ...] [--takes N] [--res 720p]

Keyframe choice per plate is in PICK (model, vertical crop anchor for 3:2 -> 16:9). Singing plates get the vocal stem
window plates.PLATES[pid]['audio'] as reference audio. Outputs: work/plates/raw/<pid>_t<k>.mp4 and a manifest.
"""
import base64, json, os, subprocess, sys, threading, time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cf
from plates import PLATES
from PIL import Image

ROOT = "/home/user/rare-earth-video"
KF = f"{ROOT}/work/kf"
OUT = f"{ROOT}/work/plates/raw"
MAN = f"{ROOT}/work/plates/manifest.json"
os.makedirs(OUT, exist_ok=True)
_lock = threading.Lock()

PICK = {  # pid: (model, anchor)
    "P01_rim": ("gpt", 0.4), "P02_care": ("gpt", 0.35), "P03_there": ("gpt", 0.35), "P04_eye": ("nano", 0.5),
    "P05_guitar": ("nano", 0.5), "P06_rehearsal": ("nano", 0.5), "P07_rooftop": ("nano", 0.5), "P08_notebook": ("nano", 0.5),
    "P09_catch": ("nano", 0.5), "P10_alone": ("gpt", 0.35), "P11_gig": ("nano", 0.5), "P12_charlie": ("gpt", 0.45),
    "P13_ricky": ("nano", 0.5), "P14_pad": ("gpt", 0.5), "P15_dawn": ("gpt", 0.4), "P16_launch": ("gpt", 0.45),
    "P17_crowd": ("gpt", 0.5), "P18_jade26": ("gpt", 0.45), "P20_room26": ("gpt", 0.4), "P21_v5cu": ("nano", 0.5),
    "P22_cheer": ("gpt", 0.45), "P23_rim26": ("gpt", 0.4), "P24_group": ("gpt", 0.5), "P25_oh": ("gpt", 0.35),
}


def keyframe(pid):
    model, anchor = PICK[pid]
    src = [f"{KF}/{pid}_{model}{e}" for e in (".png", ".jpg") if os.path.exists(f"{KF}/{pid}_{model}{e}")][0]
    im = Image.open(src).convert("RGB")
    w, h = im.size
    th = round(w * 9 / 16)
    if th < h:
        y0 = round((h - th) * anchor)
        im = im.crop((0, y0, w, y0 + th))
    elif th > h:
        tw = round(h * 16 / 9)
        x0 = (w - tw) // 2
        im = im.crop((x0, 0, x0 + tw, h))
    im = im.resize((1536, 864), Image.LANCZOS)
    out = f"{ROOT}/work/plates/kf/{pid}.jpg"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    im.save(out, quality=95)
    return out


def audio_clip(pid, t0, t1):
    out = f"{ROOT}/work/plates/audio/{pid}.mp3"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", f"{t1 - t0:.3f}", "-i",
                    f"{ROOT}/work/audio/stem_vocals.wav", "-ac", "1", "-ar", "44100", "-b:a", "160k", out], check=True)
    return out


def load_man():
    return json.load(open(MAN)) if os.path.exists(MAN) else {}


def save_take(pid, rec):
    with _lock:
        m = load_man()
        m.setdefault(pid, []).append(rec)
        json.dump(m, open(MAN, "w"), indent=1)


LYRIC = {
    "P02_care": "The lyrics she sings are: \"Do you still care? You're yearning to see the life out there.\"",
    "P03_there": "The lyrics she sings are: \"Are you still there? A rare earth looking for a friend.\"",
    "P09_catch": "The lyrics she sings are: \"Your signal here I think I've caught, the beating blinking...\"",
    "P10_alone": "The lyrics she sings are: \"How could we be alone?\"",
    "P15_dawn": "The lyrics she sings are: \"Keep on looking, keep the faith, keep up...\"",
    "P18_jade26": "The lyrics she sings are: \"Are you still there? A rare earth looking for a friend.\"",
    "P21_v5cu": "The lyrics she sings are: \"Lived my life on a pale blue dot. Your signal...\"",
    "P23_rim26": "The lyrics she sings are: \"How could we be alone?\"",
    "P25_oh": "She sings long sustained open vowels: \"Oh... oh... oh...\", mouth open wide and round on each held note, closing briefly between notes.",
    "P05_guitar": "The lyrics she sings are: \"Lived my life on a pale blue dot.\"",
}


def run(pid, take, res="720p", prompt_extra="", audio=None):
    p = dict(PLATES[pid])
    if audio:
        p["audio"] = audio
        p["dur"] = max(4, int(round(audio[1] - audio[0])))
    out = f"{OUT}/{pid}_t{take}.mp4"
    if os.path.exists(out):
        return pid, take, "exists"
    kf = keyframe(pid)
    if take >= 6 or (pid in ("P09_catch", "P15_dawn", "P25_oh", "P23_rim26") and take >= 4):
        prompt_extra = (prompt_extra + " " + LYRIC.get(pid, "")).strip()
    inp = {"prompt": (p["motion"] + " " + prompt_extra).strip(), "image": cf.data_uri(kf), "duration": int(p["dur"]),
           "resolution": res, "aspect_ratio": "adaptive", "fps": 24, "camera_fixed": False, "watermark": False,
           "output_format": "mp4", "use_virtual_avatar": False, "generate_audio": False}
    if p.get("audio"):
        a0, a1 = p["audio"]
        inp["reference_audios"] = [cf.data_uri(audio_clip(f"{pid}_t{take}", a0, a1))]
    t0 = time.time()
    try:
        paths, rec = cf.generate("bytedance/seedance-2.5", inp, out[:-4], tag=f"{pid}_t{take}", timeout=3000)
    except Exception as e:  # noqa: BLE001
        return pid, take, f"ERR {str(e)[:400]}"
    if paths and paths[0] != out:
        os.replace(paths[0], out)
    save_take(pid, {"take": take, "file": out, "res": res, "secs": round(time.time() - t0), "audio": p.get("audio"), "dur": p["dur"],
                    "prompt": inp["prompt"], "kf": kf})
    return pid, take, out


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    takes = int(next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--takes=")), 0))
    res = next((a.split("=")[1] for a in sys.argv[1:] if a.startswith("--res=")), "720p")
    # spec: PID or PID@k0-k1 (take range) or PID@k0-k1@a0:a1 (audio window override)
    jobs = []
    for spec in (args or list(PICK)):
        parts = spec.split("@")
        pid = parts[0]
        if len(parts) > 1:
            k0, k1 = map(int, parts[1].split("-"))
        else:
            k0, k1 = 0, (takes or (2 if PLATES[pid].get("audio") else 1)) - 1
        aw = tuple(map(float, parts[2].split(":"))) if len(parts) > 2 else None
        for k in range(k0, k1 + 1):
            jobs.append((pid, k, aw))
    print("jobs", len(jobs), flush=True)
    with ThreadPoolExecutor(10) as ex:
        futs = [ex.submit(run, pid, k, res, "", aw) for pid, k, aw in jobs]
        from concurrent.futures import as_completed
        for f in as_completed(futs):
            pid, take, r = f.result()
            print(f"{pid} t{take}: {r}", flush=True)
