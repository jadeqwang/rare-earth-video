"""Lip-sync verification for Seedance singing plates.

For each take: track the mouth (template matching seeded by a hand-marked mouth point), measure mouth openness per frame
(dark interior blob area after a morphological opening, so thin ink lines don't count), and cross-correlate it with the
vocal stem's vowel-band energy over the reference-audio window. Reports the best lag (frames) and Pearson r.

    python3 pipeline/syncscore.py            # all takes in MOUTH
    python3 pipeline/syncscore.py P02_care   # takes for one plate
Writes work/plates/sync.json and a plot per take in work/plates/review/sync_<take>.png
"""
import json, os, sys
import numpy as np, cv2, librosa, scipy.signal as ss

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from plates import PLATES

ROOT = "/home/user/rare-earth-video"
RAW = f"{ROOT}/work/plates/raw"
FPS = 24

# hand-marked mouth centre in the first frame (x, y, half-size of the openness window)
MOUTH = {
    "P02_care_t0": (910, 310, 34), "P02_care_t1": (910, 310, 34),
    "P03_there_t0": (810, 304, 34), "P03_there_t1": (880, 236, 26),
    "P10_alone_t0": (956, 290, 30), "P10_alone_t1": (640, 406, 60),
    "P09_catch_t0": (820, 350, 24), "P09_catch_t1": (820, 340, 24),
    "P05_guitar_t0": (644, 212, 18), "P05_guitar_t1": (530, 212, 14),
    "P15_dawn_t0": (860, 146, 16), "P15_dawn_t1": (860, 146, 16),
    "P18_jade26_t0": (524, 200, 18), "P18_jade26_t1": (526, 200, 18),
    "P21_v5cu_t0": (650, 456, 44), "P21_v5cu_t1": (650, 456, 44),
    "P23_rim26_t0": (384, 86, 8), "P23_rim26_t1": (410, 76, 8),
    "P25_oh_t0": (490, 286, 44), "P25_oh_t1": (490, 286, 44),
}


def vocal_env(a0, dur, n):
    y, sr = librosa.load(f"{ROOT}/work/audio/stem_vocals.wav", sr=22050, mono=True, offset=max(0, a0 - 0.5), duration=dur + 1.0)
    sos = ss.butter(4, [300, 3500], btype="band", fs=sr, output="sos")
    y = ss.sosfiltfilt(sos, y)
    hop = sr // FPS
    rms = librosa.feature.rms(y=y, frame_length=hop * 2, hop_length=hop, center=True)[0]
    off = int(round((a0 - max(0, a0 - 0.5)) * FPS))
    e = rms[off:off + n]
    if len(e) < n:
        e = np.pad(e, (0, n - len(e)))
    e = np.log1p(e / (np.median(rms) + 1e-6))
    return e


def mouth_series(path, mx, my, r):
    cap = cv2.VideoCapture(path)
    frames = []
    while True:
        ok, f = cap.read()
        if not ok:
            break
        frames.append(f)
    H, W = frames[0].shape[:2]
    P = int(r * 3.2)  # template half-size (face patch around the mouth)
    def patch(img, x, y, s):
        x0, y0 = int(max(0, x - s)), int(max(0, y - s))
        return img[y0:int(min(H, y + s)), x0:int(min(W, x + s))], x0, y0
    g0 = cv2.cvtColor(frames[0], cv2.COLOR_BGR2GRAY)
    tpl, tx0, ty0 = patch(g0, mx, my, P)
    offx, offy = mx - tx0, my - ty0
    x, y = mx, my
    opens, pos = [], []
    for i, f in enumerate(frames):
        g = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
        if i > 0:
            S = P + int(r * 2)
            win, wx0, wy0 = patch(g, x, y, S)
            if win.shape[0] > tpl.shape[0] and win.shape[1] > tpl.shape[1]:
                res = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
                _, mv, _, ml = cv2.minMaxLoc(res)
                if mv > 0.35:
                    x, y = wx0 + ml[0] + offx, wy0 + ml[1] + offy
            if i % 6 == 0:  # slow template refresh
                nt, ntx0, nty0 = patch(g, x, y, P)
                if nt.shape == tpl.shape:
                    tpl = cv2.addWeighted(tpl, 0.6, nt, 0.4, 0)
        roi = f[int(max(0, y - r)):int(min(H, y + r)), int(max(0, x - r * 1.3)):int(min(W, x + r * 1.3))]
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV).astype(np.float32)
        skinV = np.percentile(hsv[..., 2], 80)
        dark = (hsv[..., 2] < skinV * 0.62).astype(np.uint8)
        k = max(2, int(r / 12))
        dark = cv2.morphologyEx(dark, cv2.MORPH_OPEN, np.ones((k, k), np.uint8))
        # teeth / inner highlights inside the dark blob also count as "open"
        opens.append(dark.mean())
        pos.append((x, y))
    return np.array(opens), pos, frames


MAN = f"{ROOT}/work/plates/manifest.json"


def take_audio(take):
    pid, k = take.rsplit("_t", 1)
    m = json.load(open(MAN)) if os.path.exists(MAN) else {}
    for rec in m.get(pid, []):
        if str(rec.get("take")) == k and rec.get("audio"):
            return tuple(rec["audio"])
    return tuple(PLATES[pid]["audio"]) if PLATES[pid].get("audio") else None


def mouth_for(take):
    if take in MOUTH:
        return MOUTH[take]
    pid = take.rsplit("_t", 1)[0]
    return MOUTH.get(pid + "_t0") or MOUTH.get(pid + "_t1")


def score(take):
    pid = take.rsplit("_t", 1)[0]
    p = dict(PLATES[pid])
    path = f"{RAW}/{take}.mp4"
    aud = take_audio(take)
    if not os.path.exists(path) or not mouth_for(take) or not aud:
        return None
    p["audio"] = aud
    mx, my, r = mouth_for(take)
    op, pos, frames = mouth_series(path, mx, my, r)
    n = len(op)
    a0, a1 = p["audio"]
    ve = vocal_env(a0, a1 - a0, n)
    op_s = ss.savgol_filter(op, 5, 2) if n > 7 else op
    def z(v):
        return (v - v.mean()) / (v.std() + 1e-9)
    best = (-2, 0)
    rs = {}
    for lag in range(-12, 13):  # video lags audio by `lag` frames
        if lag >= 0:
            a, b = op_s[lag:], ve[:n - lag]
        else:
            a, b = op_s[:n + lag], ve[-lag:]
        if len(a) < 24:
            continue
        rr = float(np.corrcoef(z(a), z(b))[0, 1])
        rs[lag] = rr
        if rr > best[0]:
            best = (rr, lag)
    res = {"take": take, "r_best": round(best[0], 3), "lag_frames": best[1], "lag_s": round(best[1] / FPS, 3),
           "r0": round(rs.get(0, 0), 3), "open_range": round(float(op.max() - op.min()), 4), "n": n}
    # plot
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(12, 5))
    t = np.arange(n) / FPS
    ax[0].plot(t, z(op_s), label="mouth open (z)")
    ax[0].plot(t, z(ve), label="vocal energy (z)", alpha=0.7)
    ax[0].set_title(f"{take}: r_best={best[0]:.2f} at lag {best[1]} frames ({best[1] / FPS:+.2f}s), r0={rs.get(0, 0):.2f}")
    ax[0].legend(loc="upper right")
    ax[1].plot(list(rs.keys()), list(rs.values()), "o-"); ax[1].set_xlabel("lag (frames, + = video late)"); ax[1].grid(True)
    plt.tight_layout(); plt.savefig(f"{ROOT}/work/plates/review/sync_{take}.png", dpi=70); plt.close()
    # mouth-track debug strip (every 12th frame with the ROI box)
    strip = []
    for i in range(0, n, max(1, n // 8)):
        f = frames[i].copy(); x, y = pos[i]
        cv2.rectangle(f, (int(x - r * 1.3), int(y - r)), (int(x + r * 1.3), int(y + r)), (0, 255, 0), 2)
        c = f[int(max(0, y - r * 4)):int(y + r * 4), int(max(0, x - r * 4)):int(x + r * 4)]
        if c.size:
            strip.append(cv2.resize(c, (160, 160)))
    if strip:
        cv2.imwrite(f"{ROOT}/work/plates/review/track_{take}.jpg", np.hstack(strip))
    return res


if __name__ == "__main__" and "--lag" not in sys.argv:
    only = sys.argv[1:]
    out_path = f"{ROOT}/work/plates/sync.json"
    allres = json.load(open(out_path)) if os.path.exists(out_path) else {}
    import glob
    takes = sorted(os.path.basename(f)[:-4] for f in glob.glob(f"{RAW}/*_t*.mp4"))
    for take in takes:
        if only and not any(take.startswith(o) for o in only):
            continue
        r = score(take)
        if r:
            allres[take] = r
            print(json.dumps(r))
    json.dump(allres, open(out_path, "w"), indent=1)


# ---- renderer-semantics lag curve (v2) ---------------------------------------------------------------
# Song-time window each plate is actually shown in the edit.
USE = {"P02_care": (3.86, 7.64), "P03_there": (11.70, 13.46), "P05_guitar": (19.55, 21.2), "P09_catch": (23.10, 26.60),
       "P10_alone": (38.33, 41.3), "P15_dawn": (65.41, 68.72), "P18_jade26": (87.54, 92.74), "P21_v5cu": (126.19, 129.42),
       "P23_rim26": (144.87, 147.14), "P25_oh": (152.76, 157.5)}


def openness_color(frames, pos, r):
    """Second metric: dark-red mouth-interior pixels (hue red, some saturation, darker than skin) in the ROI."""
    out = []
    for f, (x, y) in zip(frames, pos):
        H, W = f.shape[:2]
        roi = f[int(max(0, y - r)):int(min(H, y + r)), int(max(0, x - r * 1.3)):int(min(W, x + r * 1.3))]
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)
        h, s_, v = hsv[..., 0].astype(int), hsv[..., 1].astype(int), hsv[..., 2].astype(int)
        skinV = np.percentile(v, 80)
        red = ((h < 12) | (h > 165)) & (s_ > 70) & (v < skinV * 0.85)
        out.append(red.mean())
    return np.array(out)


def lag_curve(take, use=None):
    pid = take.rsplit("_t", 1)[0]
    aud = take_audio(take)
    if not aud or not mouth_for(take):
        return None
    a0, a1 = aud
    u0, u1 = use or USE.get(pid, aud)
    mx, my, r = mouth_for(take)
    op, pos, frames = mouth_series(f"{RAW}/{take}.mp4", mx, my, r)
    oc = openness_color(frames, pos, r)
    n = len(op)
    ts = np.arange(u0, u1, 1 / FPS)
    ve_full = vocal_env(a0, max(a1, u1 + 0.6) - a0, int((max(a1, u1 + 0.6) - a0) * FPS) + 2)
    ve = np.interp(ts, a0 + np.arange(len(ve_full)) / FPS, ve_full)
    def zz(v): return (v - v.mean()) / (v.std() + 1e-9)
    res = {}
    for L in np.arange(-0.5, 0.5001, 1 / 48):
        pt = ts - a0 + L
        ok = (pt >= 0) & (pt <= (n - 1) / FPS)
        if ok.mean() < 0.9:
            continue
        m1 = np.interp(pt, np.arange(n) / FPS, op)
        m2 = np.interp(pt, np.arange(n) / FPS, oc)
        r1 = float(np.corrcoef(zz(m1[ok]), zz(ve[ok]))[0, 1]) if m1[ok].std() > 1e-6 else 0.0
        r2 = float(np.corrcoef(zz(m2[ok]), zz(ve[ok]))[0, 1]) if m2[ok].std() > 1e-6 else 0.0
        res[round(float(L), 4)] = (r1, r2)
    if not res:
        return None
    Ls = np.array(sorted(res))
    comb = np.array([0.5 * (res[l][0] + res[l][1]) for l in Ls])
    k = int(np.argmax(comb))
    r0 = res.get(0.0, (0, 0))
    return {"take": take, "use": [u0, u1], "lag": float(Ls[k]), "r_dark": round(res[Ls[k]][0], 3), "r_red": round(res[Ls[k]][1], 3),
            "r_comb": round(float(comb[k]), 3), "r0_comb": round(0.5 * (r0[0] + r0[1]), 3),
            "curve": {str(l): round(float(c), 3) for l, c in zip(Ls, comb)}}


def lagmain(only):
    import glob
    out_path = f"{ROOT}/work/plates/lags.json"
    allres = json.load(open(out_path)) if os.path.exists(out_path) else {}
    takes = sorted(os.path.basename(f)[:-4] for f in glob.glob(f"{RAW}/*_t*.mp4"))
    for take in takes:
        pid = take.rsplit("_t", 1)[0]
        if pid not in USE or (only and not any(take.startswith(o) for o in only)):
            continue
        r = lag_curve(take)
        if r:
            allres[take] = r
            print(f"{take:16s} lag={r['lag']:+.3f}s r_comb={r['r_comb']:+.2f} (dark {r['r_dark']:+.2f}, red {r['r_red']:+.2f}) r0={r['r0_comb']:+.2f}", flush=True)
    json.dump(allres, open(out_path, "w"), indent=1)


if __name__ == "__main__" and "--lag" in sys.argv:
    lagmain([a for a in sys.argv[1:] if not a.startswith("--")])
