"""Lip-sync verification: correlate mouth openness with the isolated vocal envelope."""
import numpy as np, soundfile as sf, json, os
from scipy.signal import butter, sosfiltfilt

VOC = os.path.join(os.path.dirname(__file__), "..", "work", "audio", "stems", "vocals.wav")
_cache = {}


def vocal_env(rate=100):
    if rate in _cache:
        return _cache[rate]
    y, sr = sf.read(VOC)
    if y.ndim > 1:
        y = y.mean(1)
    sos = butter(4, [150, 4000], btype="band", fs=sr, output="sos")
    y = sosfiltfilt(sos, y)
    hop = sr // rate
    n = len(y) // hop
    e = np.sqrt((y[:n * hop].reshape(n, hop) ** 2).mean(1))
    e = e / (np.percentile(e, 99) + 1e-9)
    _cache[rate] = e
    return e


def score(mouth, song_t0, max_shift=1.0, rate=100, key="open"):
    """mouth: output of mouth_track; song_t0: song time of video t=0.
    Returns best shift (s, positive = video lags song), corr at best, corr at 0."""
    e = vocal_env(rate)
    t = np.array(mouth["t"]); m = np.array(mouth[key], dtype=float)
    ok = ~np.isnan(m)
    if ok.sum() < 10:
        return {"best_shift": None, "corr_best": 0, "corr0": 0, "found_frac": float(ok.mean())}
    m = np.interp(np.arange(0, t[-1], 1 / rate), t[ok], m[ok])
    # mouths lag the sound slightly; compare derivative-free, smoothed
    k = np.ones(5) / 5
    m = np.convolve(m, k, "same")
    res = []
    for s in np.arange(-max_shift, max_shift + 1e-9, 1 / rate):
        i0 = int(round((song_t0 + s) * rate))
        if i0 < 0 or i0 + len(m) > len(e):
            res.append(np.nan); continue
        seg = np.convolve(e[i0:i0 + len(m)], k, "same")
        a = m - m.mean(); b = seg - seg.mean()
        res.append(float((a * b).sum() / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9)))
    res = np.array(res)
    shifts = np.arange(-max_shift, max_shift + 1e-9, 1 / rate)
    bi = int(np.nanargmax(res))
    z = int(round(max_shift * rate))
    return {"best_shift": float(shifts[bi]), "corr_best": float(res[bi]), "corr0": float(res[z]),
            "found_frac": float(ok.mean()), "curve": res.tolist()}
