"""DTW lip-sync retiming. For a singing take, find a smooth monotonic time warp (song time -> plate time) that
aligns the plate's mouth openings with the vocal's syllables, then verify by re-scoring the warped take.

    python3 pipeline/syncwarp.py P02_care_t3 [--use 3.86:9.2]     # use = song range the edit actually shows
Writes render/assets/warps/<take>.json  {"take","song_t0","song_t1","fps", "pt":[plate time per song frame], "r_before","r_after"}
"""
import json, os, sys
import numpy as np
from scipy.interpolate import UnivariateSpline

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import syncscore as S

ROOT = S.ROOT
FPS = 24


def z(v):
    return (v - v.mean()) / (v.std() + 1e-9)


def dtw_path(a, b, band=10, slope_pen=0.35):
    """a: plate signal (len n), b: song signal (len m). returns list of (i, j)."""
    n, m = len(a), len(b)
    INF = 1e18
    D = np.full((n + 1, m + 1), INF)
    D[0, 0] = 0
    for i in range(1, n + 1):
        jc = int(round(i * m / n))
        for j in range(max(1, jc - band), min(m, jc + band) + 1):
            c = (a[i - 1] - b[j - 1]) ** 2
            D[i, j] = c + min(D[i - 1, j - 1], D[i - 1, j] + slope_pen, D[i, j - 1] + slope_pen)
    i, j = n, m
    path = [(i - 1, j - 1)]
    while i > 1 or j > 1:
        opts = [(D[i - 1, j - 1], i - 1, j - 1), (D[i - 1, j], i - 1, j), (D[i, j - 1], i, j - 1)]
        _, i, j = min(opts, key=lambda x: x[0])
        i, j = max(i, 1), max(j, 1)
        path.append((i - 1, j - 1))
        if i == 1 and j == 1:
            break
    return path[::-1]


def corr(a, b):
    return float(np.corrcoef(z(a), z(b))[0, 1])


def main():
    take = sys.argv[1]
    use = None
    if "--use" in sys.argv:
        use = tuple(map(float, sys.argv[sys.argv.index("--use") + 1].split(":")))
    pid = take.rsplit("_t", 1)[0]
    a0, a1 = S.take_audio(take)
    mx, my, r = S.mouth_for(take)
    op, pos, frames = S.mouth_series(f"{S.RAW}/{take}.mp4", mx, my, r)
    n = len(op)
    ve = S.vocal_env(a0, a1 - a0, n)
    import scipy.signal as ss
    ops = ss.savgol_filter(op, 5, 2)
    # restrict to the song range the edit uses (plus margin)
    u0, u1 = use if use else (a0, a1)
    j0, j1 = max(0, int((u0 - a0) * FPS) - 6), min(n, int((u1 - a0) * FPS) + 6)
    b = z(ve[j0:j1])
    a = z(ops)
    r_before = corr(ops[j0:j1], ve[j0:j1])
    path = dtw_path(a, b, band=int(0.45 * FPS))
    # path gives plate frame i for song frame j (song frames offset by j0); take median i per j
    jm = {}
    for i, j in path:
        jm.setdefault(j, []).append(i)
    js = np.array(sorted(jm))
    iv = np.array([np.median(jm[j]) for j in js], float)
    # smooth + clamp slope to [0.7, 1.4] (plate frames per song frame)
    sp = UnivariateSpline(js, iv, k=3, s=len(js) * 2.5)
    J = np.arange(0, j1 - j0)
    I = sp(J)
    for k in range(1, len(I)):
        I[k] = np.clip(I[k], I[k - 1] + 0.7, I[k - 1] + 1.4)
    I = np.clip(I, 0, n - 1)
    warped = np.interp(I, np.arange(n), ops)
    r_after = corr(warped, ve[j0:j1])
    # identity baseline in the same window
    out = {"take": take, "song_t0": a0 + j0 / FPS, "song_t1": a0 + j1 / FPS, "fps": FPS,
           "pt": [round(float(x) / FPS, 4) for x in I], "r_before": round(r_before, 3), "r_after": round(r_after, 3),
           "slope_min": round(float(np.min(np.diff(I))), 3), "slope_max": round(float(np.max(np.diff(I))), 3)}
    os.makedirs(f"{ROOT}/render/assets/warps", exist_ok=True)
    json.dump(out, open(f"{ROOT}/render/assets/warps/{take}.json", "w"))
    import matplotlib; matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    fig, ax = plt.subplots(2, 1, figsize=(12, 5))
    t = (J + j0) / FPS
    ax[0].plot(t, z(ops[j0:j1]), label="mouth (original timing)", alpha=0.6)
    ax[0].plot(t, z(ve[j0:j1]), label="vocal", alpha=0.8)
    ax[0].set_title(f"{take} before r={r_before:.2f}")
    ax[0].legend(loc="upper right")
    ax[1].plot(t, z(warped), label="mouth (warped)")
    ax[1].plot(t, z(ve[j0:j1]), label="vocal", alpha=0.8)
    ax[1].set_title(f"after DTW r={r_after:.2f}  slope {out['slope_min']}..{out['slope_max']}")
    ax[1].legend(loc="upper right")
    plt.tight_layout(); plt.savefig(f"{ROOT}/work/plates/review/warp_{take}.png", dpi=70); plt.close()
    print(json.dumps({k: v for k, v in out.items() if k != "pt"}))


if __name__ == "__main__":
    main()
