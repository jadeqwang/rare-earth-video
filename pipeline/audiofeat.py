"""Per-frame (24 fps) audio features for the renderer: band envelopes, onset impulses, vocal energy.

Writes render/assets/audio.json:
  fps, n, kick[], snare[], hat[], bass[], vocal[], loud[]   (0..1 per frame)
  kick_t[], snare_t[]                                       (onset times in seconds)
"""
import json, numpy as np, librosa, scipy.signal as ss

FPS = 24
DUR = 172.36
N = int(np.ceil(DUR * FPS))
SR = 22050


def band_env(y, lo, hi, sr=SR):
    sos = ss.butter(4, [lo, min(hi, sr / 2 - 100)], btype="band", fs=sr, output="sos")
    x = ss.sosfiltfilt(sos, y)
    hop = 256
    e = librosa.feature.rms(y=x, frame_length=1024, hop_length=hop)[0]
    t = np.arange(len(e)) * hop / sr
    return t, e


def to_frames(t, e, reducer=np.max):
    out = np.zeros(N, np.float32)
    idx = np.clip((t * FPS).astype(int), 0, N - 1)
    for i in range(N):
        pass
    # vectorised max per frame
    np.maximum.at(out, idx, e.astype(np.float32))
    return out


def onsets(t, e, min_gap, pct=96, rel=0.45):
    le = np.log1p(e / (np.median(e) + 1e-9))
    fl = np.maximum(0, np.diff(le, prepend=le[0]))
    fl = ss.savgol_filter(fl, 5, 2)
    thr = np.percentile(fl, pct) * rel
    pk, _ = ss.find_peaks(fl, height=thr, distance=max(1, int(min_gap / (t[1] - t[0]))))
    return t[pk], fl[pk]


def norm(x, p=99.0):
    s = np.percentile(x, p)
    return np.clip(x / max(s, 1e-9), 0, 1)


inst, _ = librosa.load("work/audio/stem_instrumental.wav", sr=SR, mono=True)
voc, _ = librosa.load("work/audio/stem_vocals.wav", sr=SR, mono=True)
mix, _ = librosa.load("work/audio/song.wav", sr=SR, mono=True)
_, inst_p = librosa.effects.hpss(inst, margin=1.5)

tk, ek = band_env(inst_p, 35, 120)
ts, es = band_env(inst_p, 1500, 5000)
th, eh = band_env(inst_p, 7000, 11000)
tb, eb = band_env(inst, 40, 250)
tv, ev = band_env(voc, 150, 5000)
tl, el = band_env(mix, 30, 11000)

kick_t, kick_s = onsets(tk, ek, 0.22)
snare_t, snare_s = onsets(ts, es, 0.22)

feat = dict(fps=FPS, n=N,
            kick=norm(to_frames(tk, ek)).round(3).tolist(),
            snare=norm(to_frames(ts, es)).round(3).tolist(),
            hat=norm(to_frames(th, eh)).round(3).tolist(),
            bass=norm(to_frames(tb, eb)).round(3).tolist(),
            vocal=norm(to_frames(tv, ev)).round(3).tolist(),
            loud=norm(to_frames(tl, el)).round(3).tolist(),
            kick_t=kick_t.round(3).tolist(), snare_t=snare_t.round(3).tolist())
json.dump(feat, open("render/assets/audio.json", "w"))
T = json.load(open("work/timing.json"))
json.dump(T, open("render/assets/timing.json", "w"))
print("frames", N, "kicks", len(kick_t), "snares", len(snare_t))
