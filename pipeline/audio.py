"""Build the final soundtrack: pre-roll room + foley, the 'old recording' small-speaker bloom, REC click, post-roll."""
import numpy as np, soundfile as sf, subprocess, os, json
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SR = 48000
PRE = 10.0          # pre-roll length (s) before the song's 0:00
POST = 3.2          # post-roll on the 2011 photo
import shots as _shots
SONG = _shots.SONG_FILE
rng = np.random.default_rng(11)


def load_song():
    out = subprocess.run(["ffmpeg", "-v", "error", "-i", SONG, "-map", "0:a", "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(out, np.float32).reshape(-1, 2).copy()


def bp(x, lo, hi, order=4):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="low", fs=SR, output="sos"), x, axis=0)


def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype="high", fs=SR, output="sos"), x, axis=0)


def env(n, a, d):
    t = np.arange(n) / SR
    return (1 - np.exp(-t / max(a, 1e-4))) * np.exp(-t / d)


def place(buf, x, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if x.ndim == 1:
        x = np.stack([x * (1 - max(pan, 0)), x * (1 + min(pan, 0))], -1)
    j = min(len(buf), i + len(x))
    if j > i >= 0:
        buf[i:j] += x[: j - i] * gain


def click(kind="play"):
    """Mechanical button click: two transients (press + latch) through a small resonant body."""
    n = int(0.09 * SR)
    x = np.zeros(n)
    for dt, amp in ([(0, 1.0), (0.022, 0.55)] if kind != "rec" else [(0, 1.0), (0.012, 0.8), (0.031, 0.4)]):
        k = int(dt * SR)
        burst = rng.standard_normal(int(0.004 * SR)) * np.exp(-np.arange(int(0.004 * SR)) / (0.0009 * SR))
        x[k:k + len(burst)] += burst * amp
    body = bp(x, 1800, 6500, 2) * 0.8 + bp(x, 400, 1200, 2) * 0.5
    return body / np.abs(body).max()


def card_insert():
    n = int(0.35 * SR)
    slide = bp(rng.standard_normal(n), 2500, 9000, 2) * env(n, 0.08, 0.12) * 0.25
    c = np.zeros(n); k = int(0.21 * SR)
    snap = click("play")[: n - k]
    c[k:k + len(snap)] = snap
    return slide + c


def rustle(dur, density=18.0, bright=(900, 7000)):
    n = int(dur * SR)
    x = np.zeros(n)
    t = 0.0
    while t < dur - 0.05:
        t += rng.exponential(1 / density)
        L = int(rng.uniform(0.01, 0.07) * SR)
        i = int(t * SR)
        if i + L >= n: break
        x[i:i + L] += rng.standard_normal(L) * env(L, 0.003, rng.uniform(0.01, 0.03)) * rng.uniform(0.2, 1)
    y = bp(x, *bright, 2)
    return y / (np.abs(y).max() + 1e-9)


def thump(f=70, d=0.18):
    n = int(0.5 * SR); t = np.arange(n) / SR
    s = np.sin(2 * np.pi * f * t * (1 + 0.6 * np.exp(-t / 0.02))) * env(n, 0.002, d)
    s += bp(rng.standard_normal(n), 200, 1500, 2) * env(n, 0.001, 0.03) * 0.4
    return s / np.abs(s).max()


def tick_on_rug():
    n = int(0.12 * SR)
    x = bp(rng.standard_normal(n), 1200, 5000, 2) * env(n, 0.0005, 0.012)
    return x / np.abs(x).max()


def power_blip():
    n = int(0.16 * SR); t = np.arange(n) / SR
    f = 2600 + 900 * (t > 0.06)
    s = np.sin(2 * np.pi * np.cumsum(f) / SR) * env(n, 0.003, 0.05) * (t < 0.14)
    return s * 0.25


def room_tone(n):
    b = np.cumsum(rng.standard_normal((n, 2)), axis=0)
    b = hp(b, 25, 2)
    b = lp(b, 400, 2)
    b /= np.abs(b).max() + 1e-9
    air = lp(hp(rng.standard_normal((n, 2)), 3000, 2), 9000, 2) * 0.05
    return b * 0.6 + air


def tape_hiss(n):
    h = hp(rng.standard_normal((n, 2)) * 0.5, 2500, 2)
    h = lp(h, 11000, 2)
    return h


def small_speaker(x):
    """A 2011 handheld recorder playing back: mono, 300 Hz-5 kHz, a little boxy and gritty."""
    m = x.mean(axis=1)
    y = bp(m, 320, 5000, 3)
    y += bp(m, 900, 1400, 2) * 0.35           # boxy mid resonance
    y = np.tanh(y * 2.2) / 2.2                 # tiny speaker saturation
    return np.stack([y, y], -1)


def fade_curve(n, t0, t1, a, b, shape="cos"):
    t = np.arange(n) / SR
    u = np.clip((t - t0) / max(t1 - t0, 1e-6), 0, 1)
    if shape == "cos":
        u = 0.5 - 0.5 * np.cos(np.pi * u)
    return (a + (b - a) * u)[:, None]


def build(out_wav, grid):
    song = load_song()
    ns = len(song)
    total = PRE + ns / SR + POST
    N = int(total * SR)
    mix = np.zeros((N, 2))

    # --- room + foley (whole film, very low; it's what the silence sounds like)
    rt = room_tone(N) * 10 ** (-52 / 20)
    mix += rt
    # P1 (0-4): box flaps, hat lifted, book set down, card slips and ticks on the rug
    place(mix, rustle(1.4, 22), 0.15, 10 ** (-24 / 20), 0.2)
    place(mix, rustle(0.8, 14, (600, 4000)), 1.4, 10 ** (-27 / 20), -0.1)
    place(mix, thump(75, 0.12), 2.35, 10 ** (-21 / 20))
    place(mix, tick_on_rug(), 3.25, 10 ** (-23 / 20), 0.1)
    place(mix, tick_on_rug(), 3.36, 10 ** (-32 / 20), 0.1)
    # P2 (4-6): fingertips pick it up
    place(mix, rustle(0.4, 30, (1500, 8000)), 4.9, 10 ** (-30 / 20))
    # P3 (6-10): rummage, card slides in and clicks, screen lights
    place(mix, rustle(0.9, 18), 6.1, 10 ** (-27 / 20), -0.2)
    place(mix, card_insert(), 7.85, 10 ** (-19 / 20))
    place(mix, power_blip(), 8.9, 10 ** (-28 / 20))

    # --- the song, first as the old recording on a small speaker, blooming to the full mix in shot 4
    s0 = int(PRE * SR)
    full = song.copy()
    small = small_speaker(song)
    B2, B2m = _shots.BY_ID["4"].start, _shots.BY_ID["5"].start          # the old recording blooms into the room across shot 4
    g_small = fade_curve(ns, B2, B2m, 1.0, 0.0) * 10 ** (5 / 20)
    g_full = fade_curve(ns, _shots.BY_ID["2"].start, B2, 0.0, 0.28) * (np.arange(ns)[:, None] / SR < B2) + \
             fade_curve(ns, B2, B2m, 0.28, 1.0) * (np.arange(ns)[:, None] / SR >= B2)
    hiss = tape_hiss(ns) * 10 ** (-44 / 20) * fade_curve(ns, B2, B2m + 2, 1.0, 0.0)
    songmix = small * g_small + full * g_full + hiss
    mix[s0:s0 + ns] += songmix
    # PLAY click as the song's 0:00 held tone starts
    place(mix, click("play"), PRE - 0.04, 10 ** (-20 / 20))
    # REC click in the hard stop at 2:26.5
    place(mix, click("rec"), PRE + _shots.BY_ID["38"].start + 0.02, 10 ** (-17 / 20))

    # post-roll: room tone lifts slightly under the 2011 photo, then out
    mix *= fade_curve(N, total - 1.2, total, 1.0, 0.0)
    peak = np.abs(mix).max()
    if peak > 0.99:
        mix *= 0.99 / peak
    sf.write(out_wav, mix.astype(np.float32), SR, subtype="FLOAT")
    return total


if __name__ == "__main__":
    grid = json.load(open(os.path.join(HERE, "grid.json")))
    out = os.path.join(ROOT, "gen", "soundtrack.wav")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    print("total", build(out, grid))
