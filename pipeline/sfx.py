"""Procedural sound-design layer: radio static, a tuning whistle, a dropped carrier.

The song itself is never edited. This script writes a separate stem (work/audio/sfx.wav)
that lives only in the quiet corners of the track:

  0.0 - 4.1   shortwave static and a heterodyne whistle "tuning in" under the fade-in,
              ducking out as the band enters (the pale-blue-dot zoom)
  64.48-65.38 the lyric hole "(     )": carrier drops, a burst of line noise, NO CARRIER
  165  - end  static returns under the fade-out, then one carrier blip on "keep listening."

and a preview mix (work/audio/song_sfx.wav). Everything is deterministic (fixed seeds).

  python3 pipeline/sfx.py
"""
import numpy as np
import soundfile as sf
from scipy import signal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AUD = ROOT / 'work' / 'audio'
SR = 48000


def db(x):
    return 10 ** (x / 20)


def env(n, a, r):
    """Linear attack/release envelope over n samples (a, r in samples)."""
    e = np.ones(n)
    if a > 0:
        e[:a] = np.linspace(0, 1, a)
    if r > 0:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def bandnoise(n, lo, hi, rng, order=4):
    x = rng.standard_normal(n)
    sos = signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos')
    y = signal.sosfilt(sos, x)
    return y / (np.std(y) + 1e-9)


def static(dur, rng, crackle=1.0):
    """AM-radio static: band-limited hiss with slow fading and sparse crackles."""
    n = int(dur * SR)
    hiss = bandnoise(n, 350, 3400, rng)
    # slow fading (ionospheric flutter)
    k = int(SR / 40)
    fl = np.repeat(rng.uniform(0.35, 1.0, n // k + 2), k)[:n]
    fl = signal.sosfilt(signal.butter(2, 6, fs=SR, output='sos'), fl)
    y = hiss * fl
    # crackles: short decaying clicks
    m = int(dur * 9 * crackle)
    for i in rng.integers(0, max(1, n - 800), m):
        L = int(rng.integers(60, 700))
        c = rng.standard_normal(L) * np.exp(-np.linspace(0, 7, L)) * rng.uniform(1.5, 4.0)
        y[i:i + L] += c
    return y


def whistle(dur, f0, f1, rng):
    """Heterodyne whistle gliding f0 -> f1 with a little wobble (tuning a dial)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    glide = f0 + (f1 - f0) * (0.5 - 0.5 * np.cos(np.pi * np.clip(t / dur, 0, 1)))
    wob = 1 + 0.004 * np.sin(2 * np.pi * 5.3 * t)
    ph = 2 * np.pi * np.cumsum(glide * wob) / SR
    return np.sin(ph) + 0.25 * np.sin(2 * ph + 0.3)


def place(buf, clip, t0, gain=1.0):
    i = int(t0 * SR)
    j = min(len(buf), i + len(clip))
    if j > i:
        buf[i:j] += clip[:j - i] * gain


def build(n_total):
    rng = np.random.default_rng(2011)
    out = np.zeros(n_total)

    # --- intro: tuning in (0 .. 4.1) -------------------------------------------------
    d = 4.3
    st = static(d, rng) * env(int(d * SR), int(0.25 * SR), int(0.9 * SR))
    place(out, st, 0.0, db(-34))
    wh = whistle(2.6, 2300, 1420, rng) * env(int(2.6 * SR), int(0.5 * SR), int(0.9 * SR))
    place(out, wh, 0.7, db(-42))
    # carrier locks: a soft 1420 Hz tone just before "Do" (3.82)
    tn = np.sin(2 * np.pi * 1420 * np.arange(int(0.55 * SR)) / SR) * env(int(0.55 * SR), 800, int(0.35 * SR))
    place(out, tn, 3.15, db(-40))

    # --- the hole: NO CARRIER (64.48 .. 65.38) ----------------------------------------
    t_h = 64.50
    click = np.zeros(int(0.03 * SR)); click[:40] = np.linspace(1, 0, 40)
    place(out, click, t_h, db(-20))
    burst = bandnoise(int(0.42 * SR), 900, 4200, rng) * env(int(0.42 * SR), 60, int(0.2 * SR))
    burst *= (np.sin(2 * np.pi * 31 * np.arange(len(burst)) / SR) > -0.2)  # gated, digital
    place(out, burst, t_h + 0.02, db(-27))
    # two short "busy" beeps, falling
    for k, (f, tt) in enumerate([(620, t_h + 0.46), (480, t_h + 0.66)]):
        L = int(0.12 * SR)
        b = np.sign(np.sin(2 * np.pi * f * np.arange(L) / SR)) * env(L, 120, 900)
        b = signal.sosfilt(signal.butter(2, 3000, fs=SR, output='sos'), b)
        place(out, b, tt, db(-29))

    # --- outro: static under the fade, one blip on "keep listening." ------------------
    d = 172.36 - 165.0
    st = static(d, rng, crackle=0.6)
    e = np.clip((np.arange(len(st)) / SR) / 4.0, 0, 1) ** 1.5
    e *= env(len(st), 0, int(0.6 * SR))
    place(out, st * e, 165.0, db(-36))
    L = int(0.16 * SR)
    blip = np.sin(2 * np.pi * 1420 * np.arange(L) / SR) * env(L, 300, int(0.1 * SR))
    place(out, blip, 170.2, db(-34))
    place(out, blip, 170.55, db(-37))

    # a touch of width: the right channel lags 0.4 ms
    dly = int(0.0004 * SR)
    R = np.concatenate([np.zeros(dly), out[:-dly]])
    return np.stack([out, R], 1)


def main():
    song, sr = sf.read(AUD / 'song48k.wav')
    assert sr == SR, sr
    if song.ndim == 1:
        song = np.stack([song, song], 1)
    sfx = build(len(song))
    sf.write(AUD / 'sfx.wav', sfx.astype(np.float32), SR)
    mix = song + sfx
    peak = np.abs(mix).max()
    if peak > 0.999:
        mix /= peak / 0.999
    sf.write(AUD / 'song_sfx.wav', mix.astype(np.float32), SR, subtype='FLOAT')
    for t0, t1 in [(0, 4.1), (64.4, 65.4), (165, 172.3)]:
        a, b = int(t0 * SR), int(t1 * SR)
        r = lambda x: 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
        print(f'{t0:6.1f}-{t1:6.1f}  song {r(song[a:b]):6.1f} dB   sfx {r(sfx[a:b]):6.1f} dB')
    print('peak', round(float(peak), 4))


if __name__ == '__main__':
    main()
