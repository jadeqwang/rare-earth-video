"""Per-shot VFX and procedural plates.

Each shot gets `ctx` with: t (local s), T (song s), dur, f (global frame), plate (float32 HxWx3),
L (vfx.Light), fin (finish kwargs), clip (bool: generated clip vs still), src.
Anchors: `kf(ctx, x, y)` maps keyframe pixel coords to screen for still plates; for generated clips the
per-shot ANCHORS dict (screen coords) is used instead once the clip exists.
"""
import json, math, os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageOps

import vfx
from vfx import (W, H, Light, Motes, Staff, FloatingNote, Equation, EQUATIONS, BLUE, BLUE_CORE, BLUE_DEEP,
                 GOLD, GOLD_CORE, RED, ease, ease_out, ease_in, hash01, smooth_noise, glyph_sprite, SERIF)
from shots import GRID, PRE, ROOT, REF, BAR, BEAT, B

HERE = os.path.dirname(os.path.abspath(__file__))
ENV = json.load(open(os.path.join(HERE, "envelope.json")))
FONTS = os.path.join(HERE, "fonts")
ANCHORS = {}   # shot id -> dict of screen-space anchors for generated clips (filled after review)
_ap = os.path.join(HERE, "anchors.json")
if os.path.exists(_ap):
    ANCHORS = json.load(open(_ap))


# ----------------------------------------------------------------------------- helpers

def env(T, band="rms"):
    a = ENV[band]
    i = T * 24
    i0 = int(np.clip(math.floor(i), 0, len(a) - 1)); i1 = min(i0 + 1, len(a) - 1)
    return a[i0] + (a[i1] - a[i0]) * (i - math.floor(i))


def beat_phase(T):
    p = (T - GRID["t0"]) / BEAT
    return p - math.floor(p), int(math.floor(p))


def beat_pulse(T, decay=0.14):
    ph, _ = beat_phase(T)
    return math.exp(-ph * BEAT / decay)


def kf(ctx, x, y):
    """Keyframe px -> screen px for still plates (current crop)."""
    c = ctx.src.crop_at(ctx.t)
    s = W / c[2]
    return (x - c[0]) * s, (y - c[1]) * s


def kfs(ctx):
    if ctx.clip and not hasattr(ctx.src, "map_pt"):
        return 1.0
    c = ctx.src.crop_at(ctx.t)
    return W / c[2] if not hasattr(ctx.src, "map_pt") else 1.0


def anchor(ctx, name, default):
    """Screen-space anchor: from anchors.json when a clip is in use, else the KF-mapped default."""
    if ctx.clip:
        a = ANCHORS.get(ctx.shot.id, {}).get(name)
        if a is not None:
            if isinstance(a[0], (list, tuple)):   # keyframed [[t, x, y], ...]
                arr = np.array(a, np.float64)
                p = float(np.interp(ctx.t, arr[:, 0], arr[:, 1])), float(np.interp(ctx.t, arr[:, 0], arr[:, 2]))
            else:
                p = tuple(a)
            if hasattr(ctx.src, "map_pt"):     # living painting: anchors ride the camera move
                return ctx.src.map_pt(p[0], p[1], ctx.t)
            return p
    return kf(ctx, *default) if ctx.src.__class__.__name__ == "StillSource" else default


def radial_gain(cx, cy, r, gain, soft=1.0):
    yy, xx = np.ogrid[0:H, 0:W]
    d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2) / r
    m = np.exp(-(d ** 2) * soft).astype(np.float32)
    return (1 + (gain - 1) * m)[..., None]


def blue_mask(img, thresh=0.08):
    """Soft mask of 'past' pixels: pale blue light (blue well above red, reasonably bright)."""
    r, g, b = img[..., 0], img[..., 1], img[..., 2]
    m = np.clip((b - r - thresh) * 6, 0, 1) * np.clip((b - 0.25) * 3, 0, 1)
    return cv2.GaussianBlur(m, (0, 0), 1.5)


def paste(dst, src, x0, y0, mask=None):
    h, w = src.shape[:2]
    X0, Y0, X1, Y1 = max(0, x0), max(0, y0), min(W, x0 + w), min(H, y0 + h)
    if X1 <= X0 or Y1 <= Y0:
        return
    s = src[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
    if mask is None:
        dst[Y0:Y1, X0:X1] = s
    else:
        m = mask[Y0 - y0:Y1 - y0, X0 - x0:X1 - x0]
        m = m[..., None] if m.ndim == 2 else m
        dst[Y0:Y1, X0:X1] = dst[Y0:Y1, X0:X1] * (1 - m) + s * m


def red_light(ctx, x, y, r, a):
    ctx.L.dot(x, y, r, RED, a)


def zoom_layer(buf, cx, cy, s):
    M = np.array([[s, 0, cx * (1 - s)], [0, s, cy * (1 - s)]], np.float32)
    return cv2.warpAffine(buf, M, (W, H), flags=cv2.INTER_LINEAR)


def ambient(ctx, n=40, seed=5, a=0.7, color=BLUE, region=(0, 0, W, H), size=(0.8, 2.6), rise=6):
    Motes(n, region, seed=seed, color=color, size=size, rise=rise, speed=30).draw(ctx.L, ctx.T, a=a)


def gold_dust(ctx, n=26, seed=2, a=0.45, region=(0, 0, W, H)):
    Motes(n, region, seed=seed, color=GOLD, size=(0.6, 2.2), rise=-3, speed=12, twinkle=0.6).draw(ctx.L, ctx.T, a=a)


# ----------------------------------------------------------------------------- recorder LCD

def lcd_image(w, h, counter_s, levels, title=None, date=None, stutter=0.0, glow=1.0, seed=0):
    """Backlit mono LCD (pale cyan-white) with a time counter and level meter. Returns float32 RGB."""
    base = np.array([0.38, 0.55, 0.62]) * glow
    img = np.ones((h, w, 3), np.float32) * base
    im = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(im)
    big = ImageFont.truetype(os.path.join(FONTS, "VT323-Regular.ttf"), int(h * 0.36))
    small = ImageFont.truetype(os.path.join(FONTS, "VT323-Regular.ttf"), int(h * 0.13))
    m, s = divmod(max(counter_s, 0), 60)
    txt = f"{int(m):02d}:{int(s):02d}"
    if stutter > 0 and hash01(int(counter_s * 7), seed) < stutter:
        txt = txt[:-1] + "-"
    d.text((w * 0.08, h * 0.10), txt, font=big, fill=255)
    if title:
        d.text((w * 0.08, h * 0.02), title, font=small, fill=200)
    if date:
        d.text((w * 0.60, h * 0.18), date, font=small, fill=170)
    # level meter: two channels of segmented bars
    nseg = 16
    for ch, yb in enumerate((0.62, 0.78)):
        lv = levels[ch] if hasattr(levels, "__len__") else levels
        for i in range(nseg):
            on = i / nseg < lv
            x0 = w * 0.08 + i * (w * 0.84 / nseg)
            d.rectangle([x0, h * yb, x0 + w * 0.84 / nseg * 0.72, h * (yb + 0.1)], fill=255 if on else 28)
    ink = np.asarray(im).astype(np.float32)[..., None] / 255.0
    ink_col = np.array([0.03, 0.06, 0.1], np.float32)
    img = img * (1 - ink * 0.92) + ink_col * ink * 0.92
    # pixel grid + slight vignette of the backlight
    yy, xx = np.mgrid[0:h, 0:w]
    grid = 1 - 0.08 * ((xx % 3) == 0) - 0.08 * ((yy % 3) == 0)
    vg = 1 - 0.35 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    return np.clip(img * grid[..., None] * vg[..., None], 0, 1)


def levels_at(T):
    e = env(T, "rms"); hi = env(T, "mid")
    return (np.clip(e * 0.95 + 0.05 * math.sin(T * 17), 0, 1), np.clip(e * 0.9 + 0.08 * hi, 0, 1))


# ----------------------------------------------------------------------------- procedural plates

class ProcSource:
    def __init__(self, shot):
        self.shot = shot
        self.kind = shot.still[1]
        self.cache = {}

    def crop_at(self, t):
        return np.array([0, 0, W], np.float64)

    def get(self, t):
        fn = PROC.get(self.kind)
        return fn(self, t) if fn else np.zeros((H, W, 3), np.float32)


def _bg_gradient(top, bottom):
    g = np.linspace(0, 1, H, dtype=np.float32)[:, None, None]
    return np.broadcast_to(np.array(top, np.float32) * (1 - g) + np.array(bottom, np.float32) * g, (H, W, 3)).copy()


def proc_black(src, t):
    return np.zeros((H, W, 3), np.float32)


def proc_dust_beam(src, t):
    """Shot 6: gold dust in a lamp beam, one pale blue speck inside a faint band -- the pale blue dot."""
    if "bg" not in src.cache:
        bg = _bg_gradient((0.015, 0.02, 0.05), (0.03, 0.025, 0.04))
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        # diagonal beam from upper-left
        d = (xx * 0.42 - yy * 0.91 + 300) / 260.0
        beam = np.exp(-d ** 2) * (0.35 + 0.65 * np.clip(1 - yy / H, 0, 1))
        beam += 0.45 * np.exp(-((xx * 0.42 - yy * 0.91 + 330) / 90.0) ** 2)
        beam = cv2.GaussianBlur(beam.astype(np.float32), (0, 0), 6)
        src.cache["bg"] = bg + beam[..., None] * np.array([0.42, 0.26, 0.10], np.float32)
        src.cache["beam"] = beam
        # soft out-of-focus bokeh discs (foreground dust)
        rng = np.random.default_rng(3)
        bk = np.zeros((H, W), np.float32)
        for _ in range(26):
            x, y = rng.uniform(0, W), rng.uniform(0, H)
            r = rng.uniform(20, 70)
            cv2.circle(bk, (int(x), int(y)), int(r), float(rng.uniform(0.2, 0.6)) * float(np.exp(-((x * 0.42 - y * 0.91 + 300) / 380) ** 2)), -1, cv2.LINE_AA)
        src.cache["bokeh"] = cv2.GaussianBlur(bk, (0, 0), 5)
    img = src.cache["bg"].copy()
    sh = int(t * 6) % 40
    bk = np.roll(src.cache["bokeh"], sh, axis=0)
    img += bk[..., None] * np.array([0.35, 0.22, 0.09], np.float32)
    return img


def proc_journal(src, t):
    """Shot 17 fallback: top-down journal page on a rug."""
    if "bg" not in src.cache:
        rng = np.random.default_rng(5)
        rug = (rng.random((H // 8, W // 8, 3)) * np.array([0.35, 0.12, 0.08]) + np.array([0.12, 0.04, 0.03])).astype(np.float32)
        rug = cv2.resize(rug, (W, H), interpolation=cv2.INTER_NEAREST)
        rug = cv2.GaussianBlur(rug, (0, 0), 2)
        page = np.ones((H, W, 3), np.float32) * np.array([0.93, 0.86, 0.72], np.float32)
        noise = cv2.GaussianBlur(rng.standard_normal((H, W)).astype(np.float32), (0, 0), 2) * 0.02
        page += noise[..., None]
        mask = np.zeros((H, W), np.float32)
        cv2.rectangle(mask, (230, 60), (1690, 1040), 1.0, -1)
        cv2.line(mask, (960, 60), (960, 1040), 0.0, 6)
        mask = cv2.GaussianBlur(mask, (0, 0), 2)
        img = rug * (1 - mask[..., None]) + page * mask[..., None]
        for y in range(180, 1020, 62):
            cv2.line(img, (250, y), (1670, y), (0.55, 0.66, 0.85), 2, cv2.LINE_AA)
        # gutter shadow
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        img *= (1 - 0.35 * np.exp(-((xx - 960) / 40) ** 2))[..., None]
        # lamp falloff from upper-left, warm
        lamp = np.exp(-(((xx - 200) / 1500) ** 2 + ((yy + 100) / 1100) ** 2))
        img = img * (0.25 + 0.95 * lamp[..., None]) * np.array([1.0, 0.86, 0.62], np.float32)
        src.cache["bg"] = np.clip(img, 0, 1)
    return src.cache["bg"].copy()


def _brushed_metal(seed=0):
    rng = np.random.default_rng(seed)
    n = rng.standard_normal((H, W)).astype(np.float32)
    n = cv2.GaussianBlur(n, (0, 0), sigmaX=40, sigmaY=0.8)
    n = n / (n.std() + 1e-6)
    return n


def proc_led(src, t):
    """LED macro (8a, 35, 36): dark brushed silver with a lens-lit edge; the LED itself is drawn as light."""
    if "bg" not in src.cache:
        n = _brushed_metal(4)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        base = 0.05 + 0.03 * n
        edge = 0.10 * np.exp(-((yy - 80) / 160) ** 2) * (0.6 + 0.4 * n)   # moonlit top edge
        img = np.stack([base + edge * 0.7, base + edge * 0.8, base + edge * 1.0], -1)
        # recessed LED well
        cv2.circle(img, (W // 2, int(H * 0.45)), 60, (0.02, 0.018, 0.018), -1, cv2.LINE_AA)
        cv2.circle(img, (W // 2, int(H * 0.45)), 60, (0.16, 0.16, 0.17), 3, cv2.LINE_AA)
        img = cv2.GaussianBlur(img.astype(np.float32), (0, 0), 1.2)
        # shallow depth of field toward the bottom
        blur = cv2.GaussianBlur(img, (0, 0), 9)
        wgt = np.clip((yy - H * 0.62) / (H * 0.3), 0, 1)[..., None]
        src.cache["bg"] = (img * (1 - wgt) + blur * wgt).astype(np.float32)
    return src.cache["bg"].copy()


def proc_lcd_sink(src, t):
    """31a: macro of the recorder screen in the dark; level bars sink, counter stutters."""
    img = proc_led(src, t) * 0.7
    T = src.shot.start + t
    w, h = 1180, 620
    lv = max(0.0, 0.85 - t / 1.5) * (0.8 + 0.2 * math.sin(t * 23))
    fl = 1.0 if hash01(int(t * 24), 3) > 0.12 else 0.55
    lcd = lcd_image(w, h, T, (lv, lv * 0.92), title="rare earth - jade late night solo", date="05/31/11 23:54",
                    stutter=0.35 + t * 0.2, glow=fl, seed=int(t * 5))
    x0, y0 = (W - w) // 2, (H - h) // 2 - 20
    img[y0:y0 + h, x0:x0 + w] = lcd
    cv2.rectangle(img, (x0 - 14, y0 - 14), (x0 + w + 14, y0 + h + 14), (0.10, 0.10, 0.11), 12, cv2.LINE_AA)
    return img


def proc_hands(src, t):
    """28 fallback: bokeh field, gold on the left, blue on the right."""
    if "bg" not in src.cache:
        img = _bg_gradient((0.02, 0.02, 0.05), (0.03, 0.02, 0.03))
        rng = np.random.default_rng(9)
        for _ in range(60):
            x, y = rng.uniform(0, W), rng.uniform(0, H)
            gold = x < W / 2
            col = (0.5, 0.33, 0.12) if gold else (0.15, 0.3, 0.6)
            cv2.circle(img, (int(x), int(y)), int(rng.uniform(15, 55)), tuple(c * rng.uniform(0.2, 0.7) for c in col), -1, cv2.LINE_AA)
        src.cache["bg"] = cv2.GaussianBlur(img, (0, 0), 8)
    return src.cache["bg"].copy()


def proc_photo(src, t):
    """Post-roll: the real 2011 photo, printed, on black, with a slow push."""
    if "img" not in src.cache:
        im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, REF["PHOTO"]))).convert("RGB")
        a = np.asarray(im).astype(np.float32) / 255.0
        src.cache["img"] = a
    a = src.cache["img"]
    h0, w0 = a.shape[:2]
    s = (H * 0.70) / h0 * (1 + 0.03 * t / 3.2)
    M = np.array([[s, 0, W / 2 - w0 * s / 2], [0, s, H * 0.44 - h0 * s / 2]], np.float32)
    img = cv2.warpAffine(a, M, (W, H), flags=cv2.INTER_CUBIC, borderValue=(0, 0, 0))
    # print border
    x0, y0 = W / 2 - w0 * s / 2, H * 0.44 - h0 * s / 2
    cv2.rectangle(img, (int(x0) - 3, int(y0) - 3), (int(x0 + w0 * s) + 3, int(y0 + h0 * s) + 3), (0.85, 0.83, 0.78), 5, cv2.LINE_AA)
    return img


def proc_zoomout(src, t):
    return zoomout_plate(src, t)


PROC = {"black": proc_black, "dust_beam": proc_dust_beam, "journal": proc_journal, "led": proc_led,
        "lcd_sink": proc_lcd_sink, "hands": proc_hands, "photo": proc_photo, "zoomout": proc_zoomout}


# ----------------------------------------------------------------------------- 44: powers-of-ten pull back

ZOOM_PLATES = [f"zoom_{i}.jpg" for i in range(6)]  # see ZOOM_NEST   # generated nested plates (each contains the previous at centre, 1/ZF size)
ZF = 4.0


# Nested plates: (file, anchor (u,v) of the previous plate inside this one, width of previous plate as a fraction of this one)
ZOOM_NEST = [("zoom_0.jpg", None, None),
             ("zoom_1.jpg", (0.495, 0.47), 0.20),
             ("zoom_2.jpg", (0.50, 0.55), 0.30),
             ("zoom_3.jpg", (0.49, 0.59), 0.05),
             ("zoom_4.jpg", (0.50, 0.50), 0.09),
             ("zoom_5.jpg", (0.50, 0.50), 0.022)]


def _zoom_world(src):
    """World = outermost plate's pixel space (W x H). Returns per-plate world rects (x0, y0, w)."""
    if "rects" in src.cache:
        return src.cache["rects"]
    n = len(ZOOM_NEST)
    rects = [None] * n
    rects[-1] = (0.0, 0.0, float(W))
    for k in range(n - 1, 0, -1):
        x0, y0, w = rects[k]
        (u, v), frac = ZOOM_NEST[k][1], ZOOM_NEST[k][2]
        cw = w * frac
        cx, cy = x0 + u * w, y0 + v * w * 9 / 16
        rects[k - 1] = (cx - cw / 2, cy - cw * 9 / 32, cw)
    src.cache["rects"] = rects
    return rects


def zoomout_plate(src, t):
    """Powers-of-ten pull back through nested generated plates; fallback: the room shrinking into the dot."""
    dur = src.shot.dur
    gdir = os.path.join(ROOT, "gen", "frames")
    if all(os.path.exists(os.path.join(gdir, p[0])) for p in ZOOM_NEST):
        if "plates" not in src.cache:
            src.cache["plates"] = [np.asarray(Image.open(os.path.join(gdir, p[0])).convert("RGB")).astype(np.float32) / 255
                                   for p in ZOOM_NEST]
        P = src.cache["plates"]
        rects = _zoom_world(src)
        # camera keyframes: tight on her window in plate 0, then each plate's full rect
        x0, y0, w = rects[0]
        keys = [(x0 + 0.36 * w - 0.2 * w, y0 + 0.58 * w * 9 / 16 - 0.2 * w * 9 / 16, 0.4 * w)] + list(rects)
        logs = np.log([k[2] for k in keys])
        # time: ease in/out over the move, hold on the pale blue dot for the last 1.2 s
        u = vfx.ease(np.clip(t / (dur - 1.2), 0, 1))
        L = logs[0] + (logs[-1] - logs[0]) * u
        i = int(np.clip(np.searchsorted(logs, L) - 1, 0, len(keys) - 2))
        f = (L - logs[i]) / max(logs[i + 1] - logs[i], 1e-9)
        cw = math.exp(L)
        c0 = np.array([keys[i][0] + keys[i][2] / 2, keys[i][1] + keys[i][2] * 9 / 32])
        c1 = np.array([keys[i + 1][0] + keys[i + 1][2] / 2, keys[i + 1][1] + keys[i + 1][2] * 9 / 32])
        cc = c0 + (c1 - c0) * f
        camx, camy = cc[0] - cw / 2, cc[1] - cw * 9 / 32
        sc = W / cw
        out = np.zeros((H, W, 3), np.float32)
        for k in range(len(P) - 1, -1, -1):
            rx, ry, rw = rects[k]
            sw = rw * sc
            if sw < 3 or sw > W * 80:
                continue
            ph, pw = P[k].shape[:2]
            s = sw / pw
            M = np.array([[s, 0, (rx - camx) * sc], [0, s, (ry - camy) * sc]], np.float32)
            img = cv2.warpAffine(P[k], M, (W, H), flags=cv2.INTER_LINEAR if s > 0.5 else cv2.INTER_AREA,
                                 borderMode=cv2.BORDER_CONSTANT)
            if k == len(P) - 1:
                out = img
                continue
            m = np.zeros((H, W), np.float32)
            sx0, sy0 = (rx - camx) * sc, (ry - camy) * sc
            sh = sw * 9 / 16
            fe = 0.14 * sw
            cv2.rectangle(m, (int(sx0 + fe), int(sy0 + fe * 9 / 16)), (int(sx0 + sw - fe), int(sy0 + sh - fe * 9 / 16)), 1.0, -1)
            m = cv2.GaussianBlur(m, (0, 0), max(1.0, fe * 0.45))[..., None]
            out = out * (1 - m) + img * m
        return out
    # fallback: KF-A night room shrinks into a mote of light inside a band of scattered sunlight
    if "room" not in src.cache:
        src.cache["room"] = cv2.resize(np.asarray(Image.open(os.path.join(ROOT, REF["KF-A"])).convert("RGB")).astype(np.float32) / 255, (W, H), interpolation=cv2.INTER_AREA)
        rng = np.random.default_rng(1)
        stars = np.zeros((H, W), np.float32)
        for _ in range(900):
            cv2.circle(stars, (int(rng.uniform(0, W)), int(rng.uniform(0, H))), 1, float(rng.uniform(0.05, 0.5) ** 2), -1, cv2.LINE_AA)
        xx = np.arange(W, dtype=np.float32)
        band = np.exp(-((xx - W * 0.56) / 90) ** 2)[None, :] * np.linspace(0.6, 1.0, H, dtype=np.float32)[:, None]
        src.cache["space"] = np.stack([stars] * 3, -1) + band[..., None] * np.array([0.23, 0.17, 0.12], np.float32)
    u = vfx.ease(t / dur)
    s = math.exp(math.log(0.0025) * u)
    cx = W / 2 + (W * 0.56 - W / 2) * u
    room = zoom_layer(src.cache["room"], cx, H / 2, s)
    m = np.zeros((H, W), np.float32)
    cv2.rectangle(m, (int(cx - W * s / 2), int(H / 2 - H * s / 2)), (int(cx + W * s / 2), int(H / 2 + H * s / 2)), 1.0, -1)
    m = cv2.GaussianBlur(m, (0, 0), max(1.0, W * s * 0.03))[..., None]
    return src.cache["space"] * (1 - m) + room * m


# ----------------------------------------------------------------------------- handwriting

def handwriting_sprite(text, font="Caveat[wght].ttf", size=110, reveal=1.0, slant=0.0, jitter_seed=0):
    """Alpha mask of handwritten text revealed left-to-right with a soft pen edge."""
    f = ImageFont.truetype(os.path.join(FONTS, font), size)
    l, tp, r, b = f.getbbox(text)
    asc, desc = f.getmetrics()
    pad = 20
    im = Image.new("L", (r - l + 2 * pad, asc + desc + 2 * pad), 0)
    ImageDraw.Draw(im).text((pad - l, pad), text, font=f, fill=255)
    a = np.asarray(im).astype(np.float32) / 255
    if reveal < 1:
        xs = np.arange(a.shape[1], dtype=np.float32)
        edge = pad + (a.shape[1] - 2 * pad) * reveal
        a = a * np.clip((edge - xs) / 6, 0, 1)[None, :]
    return a


def ink_on(img, mask, x, y, color=(0.08, 0.12, 0.35), opacity=0.9, angle=0.0):
    """Composite an ink mask (float 0..1) onto a plate at (x, y) top-left, multiply-style."""
    h, w = mask.shape
    if angle:
        M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
        mask = cv2.warpAffine(mask, M, (w, h))
    x0, y0 = int(x), int(y)
    x1, y1 = min(W, x0 + w), min(H, y0 + h)
    if x1 <= max(x0, 0) or y1 <= max(y0, 0):
        return
    sub = mask[max(0, -y0):y1 - y0, max(0, -x0):x1 - x0][..., None] * opacity
    reg = img[max(y0, 0):y1, max(x0, 0):x1]
    img[max(y0, 0):y1, max(x0, 0):x1] = reg * (1 - sub) + np.array(color, np.float32) * sub * (0.4 + 0.6 * reg)


def scribble_mask(w, h, progress, seed=1):
    rng = np.random.default_rng(seed)
    im = np.zeros((h, w), np.float32)
    pts = []
    n = 26
    for i in range(n):
        x = w * (0.05 + 0.9 * i / n) + rng.uniform(-8, 8)
        y = h * (0.25 if i % 2 else 0.75) + rng.uniform(-10, 10)
        pts.append((x, y))
    k = int(len(pts) * np.clip(progress, 0, 1))
    if k >= 2:
        cv2.polylines(im, [np.array(pts[:k], np.int32).reshape(-1, 1, 2)], False, 1.0, 5, cv2.LINE_AA)
    return cv2.GaussianBlur(im, (0, 0), 0.8)


# ----------------------------------------------------------------------------- figure particles

def mask_points(mask, n, seed=0, thresh=0.3):
    ys, xs = np.nonzero(mask > thresh)
    if len(xs) == 0:
        return np.zeros((0, 2))
    idx = np.random.default_rng(seed).choice(len(xs), size=min(n, len(xs)), replace=False)
    return np.stack([xs[idx], ys[idx]], -1).astype(np.float64)


# ============================================================================ per-shot effects

def fx_pre(ctx):
    gold_dust(ctx, 22, seed=ctx.f // 1000 + 1, a=0.35)
    if ctx.shot.id == "P3":
        # the little screen lights up after the card clicks in (at ~7.9 s film time -> P3 local 1.9)
        on = ease((ctx.t - 2.9) / 0.4)
        if on > 0:
            x, y = anchor(ctx, "screen", (1225, 905))
            ctx.L.dot(x, y, 22 * kfs(ctx) / 6, np.array([150, 200, 230]), 0.35 * on)


def fx_1(ctx):
    gold_dust(ctx, 14, seed=3, a=0.3)
    x, y = anchor(ctx, "led", (1197, 948))
    # LED switches on exactly on the beat at 2.67
    on = 1.0 if ctx.T >= GRID["t0"] - 0.01 else 0.0
    if on:
        pulse = 0.85 + 0.15 * beat_pulse(ctx.T)
        ctx.L.dot(x, y, 5, RED, pulse)
        ctx.L.dot(x, y, 16, RED, 0.35 * pulse)
    if ctx.clip and "screen" in ANCHORS.get("1", {}):
        pass  # counter composited by overlay_lcd below
    overlay_lcd(ctx, "1", counter=ctx.T)


def overlay_lcd(ctx, sid, counter, title=None, date=None, stutter=0.0):
    """Warp an LCD render into a tracked quad (anchors[sid]['lcd_quad'] = [[t, x0,y0, x1,y1, x2,y2, x3,y3],...])."""
    q = ANCHORS.get(sid, {}).get("lcd_quad") if ctx.clip else None
    if not q:
        return
    arr = np.array(q, np.float64)
    quad = np.array([np.interp(ctx.t, arr[:, 0], arr[:, i]) for i in range(1, 9)], np.float32).reshape(4, 2)
    w, h = 480, 280
    lcd = lcd_image(w, h, counter, levels_at(ctx.T), title=title, date=date, stutter=stutter)
    M = cv2.getPerspectiveTransform(np.float32([[0, 0], [w, 0], [w, h], [0, h]]), quad)
    warped = cv2.warpPerspective(lcd, M, (W, H), flags=cv2.INTER_LINEAR)
    m = cv2.warpPerspective(np.ones((h, w), np.float32), M, (W, H))
    m = cv2.GaussianBlur(m, (0, 0), 0.8)[..., None]
    ctx.plate = ctx.plate * (1 - m) + warped * m


def fx_2(ctx):
    gold_dust(ctx, 10, seed=4, a=0.25)
    # the first note of light rises out of the grille (below frame) and her eyes follow it
    fn = FloatingNote([(0, 1480, 1150, 0.55), (1.2, 1380, 880, 0.62), (3.9, 1180, 330, 0.8)], seed=11)
    a = ease(ctx.t / 0.6)
    fn.draw(ctx.L, ctx.t, a=a)
    ambient(ctx, 8, seed=21, a=0.4 * a, region=(1000, 300, 1900, 1080), size=(0.6, 1.6))


def fx_3(ctx):
    fn = FloatingNote([(0, 1700, 330, 0.75), (3.9, 350, 260, 0.8)], seed=12, ch="♫")
    fn.draw(ctx.L, ctx.t, a=1.0)
    ambient(ctx, 10, seed=22, a=0.35, size=(0.6, 1.6))


def fx_4(ctx):
    # staff lines on the page shimmer, then peel up and fly out into the room
    px, py = anchor(ctx, "page", (866, 310))
    s = kfs(ctx) if not ctx.clip else 1.0
    shimmer = ease(ctx.t / 0.8) * (1 - ease((ctx.t - 1.4) / 0.8))
    for k in range(5):
        yk = py - 40 * s + k * 9 * s
        ctx.L.polyline([(px - 60 * s, yk), (px + 60 * s, yk)], BLUE, 1, 0.5 * shimmer * (0.6 + 0.4 * math.sin(ctx.t * 9 + k)))
    for j, (to, amp, ph) in enumerate([((-200, 80), 90, 0.0), ((700, -250), 70, 1.7), ((2100, 150), 110, 3.1)]):
        u = ease((ctx.t - 0.7 - j * 0.35) / 2.4)
        if u <= 0:
            continue
        st = Staff({"from": (px + (j - 1) * 30 * s, py), "to": to, "amp": amp, "waves": 1.1, "gap": 5 + 2 * u,
                    "phase": ph, "note_speed": 0.08}, seed=30 + j, n_notes=4)
        st.draw(ctx.L, ctx.T, a=0.9, reveal=u, width=0.8 + 0.4 * u)
    ambient(ctx, 18, seed=23, a=0.5 * ease(ctx.t / 2))


def fx_5(ctx):
    cx, cy = anchor(ctx, "her", (840, 470))
    s = kfs(ctx) if not ctx.clip else 1.0
    a = ease(ctx.t / 0.8)
    for j in range(3):
        cfg = {"kind": "orbit", "center": (cx, cy - 40 * s + j * 50 * s), "radii": ((360 + 60 * j) * s, (90 + 20 * j) * s),
               "a0": j * 2.1, "span": 2.2, "spin": 0.45 + 0.08 * j, "amp": 40 * s, "gap": 6 * s, "note_speed": 0.06}
        Staff(cfg, seed=40 + j, n_notes=4).draw(ctx.L, ctx.T, a=0.85 * a, width=1.0)
    ambient(ctx, 40, seed=24, a=0.6)


def fx_6(ctx):
    beam = ctx.src.cache.get("beam") if hasattr(ctx.src, "cache") else None
    Motes(140, (0, -200, W, H + 200), seed=6, color=GOLD, size=(0.6, 3.2), rise=-18, speed=20, twinkle=0.5).draw(ctx.L, ctx.T, a=0.8)
    # the pale blue dot: hangs, then drifts across the beam
    x = 1240 - 420 * ease((ctx.t - 1.2) / 2.7)
    y = 520 + 40 * math.sin(ctx.t * 0.9)
    ctx.L.dot(x, y, 3.2, BLUE_CORE, 1.0)
    ctx.L.dot(x, y, 12, BLUE, 0.35)
    ctx.fin["halate"] = 0.1


def fx_7(ctx):
    x, y = anchor(ctx, "grille", (1215, 880))
    s = kfs(ctx) if not ctx.clip else 1.0
    vol = ease((ctx.t - 0.5) / 2.0)
    n = 2 + int(5 * vol)
    for j in range(n):
        cfg = {"from": (x + (j - n / 2) * 12 * s, y), "to": (x + (j - n / 2) * 140 - 200 + 80 * j, -100), "amp": 40 + 30 * j,
               "waves": 1.3, "gap": 3 + 3 * vol, "phase": j * 1.3, "note_speed": 0.1}
        Staff(cfg, seed=50 + j, n_notes=2).draw(ctx.L, ctx.T, a=0.6 + 0.4 * vol, reveal=min(1, 0.4 + vol), width=0.6 + 0.5 * vol)
    ambient(ctx, int(10 + 30 * vol), seed=25, a=0.7)
    overlay_lcd(ctx, "7", counter=ctx.T)


def led_macro(ctx, blink_every=1, dim=1.0, extra_dip=1.0):
    """The LED at the frame's 'star position' (centre, 45% down) -- matched to shot 8b's star."""
    x, y = anchor(ctx, "led", (W / 2, H * 0.45)) if ctx.clip else (W / 2, H * 0.45)
    ph, n = beat_phase(ctx.T)
    on = (n % blink_every == 0) and ph < 0.55
    lvl = (1.0 if on else 0.08) * dim * extra_dip
    ctx.L.dot(x, y, 30, RED, lvl)
    ctx.L.dot(x, y, 12, np.array([255, 190, 170]), lvl)
    ctx.L.dot(x, y, 110, RED * 0.6, 0.5 * lvl)
    ctx.fin["glow_amt"] = 1.6


def fx_8a(ctx):
    led_macro(ctx)


def fx_8b(ctx):
    x, y = anchor(ctx, "star", (W / 2, H * 0.45)) if ctx.clip else (W / 2, H * 0.45)
    ph, n = beat_phase(ctx.T)
    lvl = 0.35 + 0.65 * math.exp(-ph * BEAT / 0.18)
    ctx.L.dot(x, y, 5, BLUE_CORE, lvl)
    ctx.L.dot(x, y, 18, BLUE, 0.4 * lvl)
    L = 90 * lvl
    ctx.L.polyline([(x - L, y), (x + L, y)], BLUE_CORE, 1, 0.6 * lvl)
    ctx.L.polyline([(x, y - L), (x, y + L)], BLUE_CORE, 1, 0.6 * lvl)


def transit_depth(t, t0, t1, ingress=0.35, depth=0.45):
    """Flat-bottomed transit light curve."""
    if t < t0 or t > t1:
        return 1.0
    u = min(t - t0, t1 - t) / ingress
    return 1 - depth * ease(u)


def light_curve_sprite(w, h, progress, t0f, t1f, depth):
    im = np.ones((h, w, 3), np.float32) * np.array([0.92, 0.9, 0.84], np.float32)
    pts = []
    for i in range(200):
        u = i / 199
        yv = transit_depth(u, t0f, t1f, 0.06, depth) + 0.012 * math.sin(i * 1.7) * hash01(i, 3)
        pts.append((w * 0.08 + u * w * 0.84, h * 0.3 + (1 - yv) / depth * h * 0.42))
    cv2.polylines(im, [np.array(pts, np.int32).reshape(-1, 1, 2)], False, (0.15, 0.18, 0.3), 3, cv2.LINE_AA)
    cv2.line(im, (int(w * 0.08), int(h * 0.85)), (int(w * 0.92), int(h * 0.85)), (0.3, 0.3, 0.3), 2, cv2.LINE_AA)
    cv2.line(im, (int(w * 0.08), int(h * 0.12)), (int(w * 0.08), int(h * 0.85)), (0.3, 0.3, 0.3), 2, cv2.LINE_AA)
    k = int(progress * 199)
    px, py = pts[k]
    cv2.circle(im, (int(px), int(py)), 7, (0.85, 0.2, 0.15), -1, cv2.LINE_AA)
    return im, (px, py)


def fx_9(ctx):
    # the cat crosses the lamp: the light dips like a star during a transit
    lx, ly = anchor(ctx, "lamp", (525, 400))
    t0, t1 = 1.1, 2.9
    d = transit_depth(ctx.t, t0, t1)
    if not ctx.clip:
        ctx.plate = ctx.plate * (1 - (1 - d) * 0.75 * (radial_gain(lx, ly, 700, 0.0, 1.0) * -1 + 1))
        ctx.fin["halate"] = 0.28 * d
    # the printed Kepler light curve pinned by the window reads the lamp live
    gx, gy = anchor(ctx, "graph", (720, 170))
    gw, gh = 300, 190
    prog = np.clip(ctx.t / ctx.dur, 0, 0.999)
    spr, (px, py) = light_curve_sprite(gw, gh, prog, t0 / ctx.dur, t1 / ctx.dur, 0.45)
    if not ctx.clip or "graph" in ANCHORS.get("9", {}):
        lit = 0.55 * d + 0.1
        paste(ctx.plate, spr * lit * np.array([1.0, 0.85, 0.62], np.float32), int(gx - gw / 2), int(gy - gh / 2))
    ambient(ctx, 12, seed=26, a=0.4)


def fx_10(ctx):
    for j in range(2):
        cfg = {"from": (-100, 250 + 220 * j), "to": (900, 150 + 180 * j), "amp": 60, "waves": 0.8, "gap": 6, "phase": j * 2}
        Staff(cfg, seed=60 + j, n_notes=3).draw(ctx.L, ctx.T, a=0.55)
    ambient(ctx, 16, seed=27, a=0.45)


def fx_11(ctx):
    """Freeze (band drops out) then everything surges outward when the band returns at 40.5."""
    T_surge = 40.5
    frozen = ctx.T < T_surge
    Tf = (B(5) + BAR + BAR / 3) + 0.2 if frozen else ctx.T
    L2 = Light()
    cx, cy = anchor(ctx, "her", (840, 470))
    s = kfs(ctx) if not ctx.clip else 1.0
    for j in range(5):
        cfg = {"kind": "orbit", "center": (cx, cy - 80 * s + j * 45 * s), "radii": ((300 + 90 * j) * s, (80 + 30 * j) * s),
               "a0": j * 1.3, "span": 2.0, "spin": 0.4, "amp": 40 * s, "gap": 6 * s}
        Staff(cfg, seed=70 + j, n_notes=4).draw(L2, Tf, a=0.85)
    for j in range(7):
        ang = j * 0.9
        FloatingNote([(0, cx + math.cos(ang) * (380 + 60 * j), cy - 200 + math.sin(ang) * 220, 0.5 + 0.05 * j)], seed=80 + j,
                     ch=vfx.NOTE_CHARS[j % 4], wobble=0 if frozen else 6).draw(L2, Tf, a=0.9, trail=False)
    Motes(70, (200, 50, 1700, 1000), seed=28, rise=0 if frozen else 8).draw(L2, Tf, a=0.7)
    if frozen:
        # held breath: everything hangs; the lights shimmer only very faintly
        buf = L2.buf
        ctx.fin["exposure"] = 0.96
    else:
        u = ctx.T - T_surge
        sc = 1 + 1.1 * ease_out(u / 1.2)
        acc = np.zeros((H, W, 3), np.float32)
        for k in range(6):   # radial motion blur
            acc += zoom_layer(L2.buf, cx, cy, 1 + (sc - 1) * (0.7 + 0.06 * k)).astype(np.float32)
        buf = np.clip(cv2.GaussianBlur(acc / 6, (0, 0), 1 + 3 * ease(u / 1.0)) * (1.4 - 1.2 * ease(u / 1.8)), 0, 255).astype(np.uint8)
        ctx.fin["exposure"] = 1.0 + 0.08 * math.exp(-u / 0.25)
    cv2.add(ctx.L.buf, buf, dst=ctx.L.buf)


def fx_12(ctx):
    bx, by = anchor(ctx, "book", (1400, 330))
    s = kfs(ctx) if not ctx.clip else 1.0
    for j, tex in enumerate(EQUATIONS[:4]):
        tj = ctx.t - j * BAR / 2
        if tj < 0:
            continue
        u = ease(tj / 1.6)
        ang = -0.6 + j * 0.9 + tj * 0.35
        x = bx + (1 - u) * (j - 1.5) * 40 * s + u * math.cos(ang) * (380 + 80 * j)
        y = by - (1 - u) * 10 + u * (math.sin(ang) * 200 - 160)
        Equation(tex, [(0, x, y, 0.55 + 0.25 * u, -8 + 16 * u)], seed=90 + j).draw(ctx.L, ctx.T, a=0.95, peel=min(1, tj / 0.5))
    ambient(ctx, 24, seed=29, a=0.5)


def brain_panel(w, h, T, lit):
    """3x4 light box of axial brain slices; regions light pale blue on the beat."""
    img = np.zeros((h, w, 3), np.float32) + 0.03
    cw, ch = w / 4, h / 3
    rng = np.random.default_rng(12)
    for r in range(3):
        for c in range(4):
            cx, cy = (c + 0.5) * cw, (r + 0.5) * ch
            back = 0.10 + 0.25 * lit
            cv2.rectangle(img, (int(c * cw + 3), int(r * ch + 3)), (int((c + 1) * cw - 3), int((r + 1) * ch - 3)), (back * 0.8, back * 0.85, back), -1)
            ax, ay = cw * 0.36, ch * 0.4
            cv2.ellipse(img, (int(cx), int(cy)), (int(ax), int(ay)), 0, 0, 360, (0.45, 0.45, 0.47), -1, cv2.LINE_AA)
            for g in range(14):
                a0 = rng.uniform(0, 360)
                cv2.ellipse(img, (int(cx + rng.uniform(-ax, ax) * 0.5), int(cy + rng.uniform(-ay, ay) * 0.5)),
                            (int(ax * rng.uniform(0.1, 0.4)), int(ay * rng.uniform(0.05, 0.2))), a0, 0, 200, (0.25, 0.25, 0.27), 2, cv2.LINE_AA)
            idx = r * 4 + c
            ph, n = beat_phase(T)
            on = lit * math.exp(-((n - idx) % 12) * 0.9) * (0.6 + 0.4 * math.exp(-ph * BEAT / 0.2))
            cv2.ellipse(img, (int(cx + ax * 0.25 * math.cos(idx)), int(cy + ay * 0.3 * math.sin(idx * 1.7))),
                        (int(ax * 0.28), int(ay * 0.22)), idx * 30, 0, 360, (0.3 * on, 0.6 * on, 1.0 * on), -1, cv2.LINE_AA)
    img = cv2.GaussianBlur(img, (0, 0), 1.0)
    f = ImageFont.truetype(os.path.join(FONTS, "VT323-Regular.ttf"), int(h * 0.09))
    im = Image.new("L", (w, h), 0); ImageDraw.Draw(im).text((8, 4), "Subject: A.", font=f, fill=255)
    ink = np.asarray(im).astype(np.float32)[..., None] / 255 * (0.3 + 0.6 * lit)
    return np.clip(img + ink * np.array([0.7, 0.85, 1.0], np.float32), 0, 1)


def fx_13(ctx):
    lit = ease((ctx.t - 0.3) / 0.25) * (0.85 + 0.15 * (hash01(int(ctx.t * 24), 7) > 0.2 if ctx.t < 0.9 else 1))
    if not ctx.clip:
        px, py = kf(ctx, 1470, 40)
        w, h = int(560 * kfs(ctx) / 3.0), int(330 * kfs(ctx) / 3.0)
        panel = brain_panel(w, h, ctx.T, lit)
        x0, y0 = int(px - w / 2), int(max(py, 20))
        x1, y1 = min(W, x0 + w), min(H, y0 + h)
        ctx.plate[y0:y1, x0:x1] = panel[: y1 - y0, : x1 - x0]
        ctx.L.dot(px, y0 + h / 2, w * 0.12, BLUE_DEEP, 0.12 * lit)
    for j, tex in enumerate(EQUATIONS[1:4]):
        x = -300 + (ctx.t / ctx.dur) * (W + 600) * (0.6 + 0.2 * j) + j * 400
        Equation(tex, [(0, x, 650 + 120 * j, 0.6, -4)], seed=100 + j).draw(ctx.L, ctx.T, a=0.8)
    ambient(ctx, 20, seed=30, a=0.5)


def fx_14(ctx):
    ambient(ctx, 30, seed=31, a=0.6)
    if not ctx.clip:
        vx, vy = kf(ctx, 380, 620)
        ctx.L.dot(vx, vy, 90 * kfs(ctx) / 3, BLUE_DEEP, 0.25 + 0.1 * beat_pulse(ctx.T))


def fx_15(ctx):
    ambient(ctx, 30, seed=32, a=0.6)


def lerp_color(a, b, u):
    return np.asarray(a, np.float32) * (1 - u) + np.asarray(b, np.float32) * u


def fx_16(ctx):
    flick = 0.5 + 0.5 * math.sin(ctx.t * 30) * (hash01(int(ctx.t * 12), 4) > 0.3)
    u = ease(ctx.t / 1.5) * (0.6 + 0.4 * flick)
    col = lerp_color(BLUE, RED, u)
    Motes(40, (0, 200, W, H), seed=33, color=col, rise=0, speed=4).draw(ctx.L, 60.0, a=0.7)
    for j, tex in enumerate(EQUATIONS[:2]):
        Equation(tex, [(0, 1300 + 200 * j, 700 + 120 * j, 0.6, -5 + 10 * j)], seed=110 + j,
                 color=tuple(lerp_color((190, 222, 255), (255, 120, 100), u))).draw(ctx.L, 60.0, a=0.7)
    # two pale flashes on the horizon
    for tf in (1.0, 2.46):
        fl = math.exp(-max(ctx.t - tf, 0) / 0.12) * (ctx.t >= tf)
        if fl > 0.01:
            hx, hy = anchor(ctx, "horizon", (330, 290))
            ctx.plate = ctx.plate + (radial_gain(hx, hy, 520, 1.0 + 0.9 * fl, 1.2) - 1) * 0.35
            ctx.L.dot(hx, hy, 60, np.array([230, 235, 255]), 0.4 * fl)


def fx_17(ctx):
    """Handwriting in sync with the vocal: 'Weapons, wars, and now we're f' -- scribble -- 'd'."""
    words = [("Weapons,", 61.76, 62.9), ("wars,", 63.26, 63.62), ("and", 63.82, 64.1), ("now", 64.12, 64.6),
             ("we're", 64.74, 65.25), ("f", 65.32, 65.4)]
    q = ANCHORS.get("17", {}) if ctx.clip else {}
    x, y = q.get("line", (300, 450)) if ctx.clip else (300, 450)
    scale = q.get("scale", 1.0)
    fsz = int(96 * scale)
    font = ImageFont.truetype(os.path.join(FONTS, "Caveat[wght].ttf"), fsz)
    cx = x
    for w, a, b in words:
        rv = np.clip((ctx.T - a) / max(b - a, 0.08), 0, 1)
        wpx = font.getlength(w + " ")
        if rv > 0:
            m = handwriting_sprite(w, size=fsz, reveal=rv)
            ink_on(ctx.plate, m, cx - 20, y - fsz * 0.9, color=(0.06, 0.1, 0.32))
        cx += wpx
    # the muted middle: a hard scribble exactly where the voice cuts out
    sc = np.clip((ctx.T - 65.40) / 0.2, 0, 1)
    if sc > 0:
        m = scribble_mask(int(150 * scale), int(80 * scale), sc, seed=3)
        ink_on(ctx.plate, m, cx - 25, y - fsz * 0.55, color=(0.03, 0.05, 0.2), opacity=0.95)
    rv = np.clip((ctx.T - 65.62) / 0.18, 0, 1)
    if rv > 0:
        m = handwriting_sprite("d", size=fsz, reveal=rv)
        ink_on(ctx.plate, m, cx + 130 * scale, y - fsz * 0.9, color=(0.06, 0.1, 0.32))
    ctx.fin["halate"] = 0.0


def fx_18(ctx):
    u = ease((ctx.t - 0.3) / 1.4)
    col = lerp_color(RED, BLUE, u)
    Motes(50, (0, 0, W, H), seed=34, color=col, rise=6 * u, speed=4 + 26 * u).draw(ctx.L, ctx.T, a=0.7)
    for j, tex in enumerate(EQUATIONS[:3]):
        Equation(tex, [(0, 300 + 600 * j, 200 + 90 * j, 0.55, -6 + 6 * j)], seed=120 + j,
                 color=tuple(lerp_color((255, 120, 100), (190, 222, 255), u))).draw(ctx.L, 60.0 + u * (ctx.t), a=0.75)


def fx_19(ctx):
    ambient(ctx, 22, seed=35, a=0.5)


def fx_20(ctx):
    fade = 1 - ease(ctx.t / 1.6)
    ambient(ctx, 30, seed=36, a=0.6 * fade)
    # lamp signalling on the beat: off / on / off / on
    ph, n = beat_phase(ctx.T)
    k = (ctx.T - (B(10) + 4 * BEAT)) / BEAT
    off = (0 <= k < 1) or (2 <= k < 3)
    if off:
        lx, ly = anchor(ctx, "lamp", (525, 400))
        ctx.fin["exposure"] = 0.45
        ctx.fin["halate"] = 0.0
        ctx.plate = ctx.plate * radial_gain(lx, ly, 380, 0.25, 1.0)


def fx_21(ctx):
    sx, sy = anchor(ctx, "blink", (430, 300))
    fl = math.exp(-abs(ctx.t - 2.2) / 0.08) if ctx.t > 1.9 else 0
    if fl > 0.01:
        ctx.L.dot(sx, sy, 3, BLUE_CORE, fl)
        ctx.L.dot(sx, sy, 14, BLUE, 0.6 * fl)
        L = 50 * fl
        ctx.L.polyline([(sx - L, sy), (sx + L, sy)], BLUE_CORE, 1, 0.7 * fl)
        ctx.L.polyline([(sx, sy - L), (sx, sy + L)], BLUE_CORE, 1, 0.7 * fl)


def fx_22(ctx):
    """Blue motes stream in from the room and gather into her younger self."""
    m = blue_mask(ctx.plate)
    form = ease((ctx.t - 0.1) / 2.2)
    if not ctx.clip:
        # reveal the figure: hide unformed parts (noise dissolve from the core outward)
        key = "_fig"
        if not hasattr(ctx.src, key):
            base = (ctx.plate * 255).astype(np.uint8)
            hole = (m > 0.15).astype(np.uint8) * 255
            hole = cv2.dilate(hole, np.ones((9, 9), np.uint8))
            bg = cv2.inpaint(base, hole, 5, cv2.INPAINT_TELEA).astype(np.float32) / 255
            noise = cv2.GaussianBlur(np.random.default_rng(3).random((H // 8, W // 8)).astype(np.float32), (0, 0), 1.2)
            noise = cv2.resize(noise, (W, H))
            setattr(ctx.src, key, (bg, noise, mask_points(m, 900, 5)))
        bg, noise, pts = getattr(ctx.src, key)
        reveal = np.clip((form * 1.25 - noise) * 5, 0, 1)[..., None]
        ctx.plate = bg * (1 - reveal) + ctx.plate * reveal
    else:
        pts = mask_points(m, 900, 5)
    if len(pts):
        rng = np.random.default_rng(8)
        start = pts + rng.normal(0, 1, pts.shape) * np.array([700, 420]) + np.array([300, -200])
        lag = rng.uniform(0, 0.6, len(pts))
        u = ease_out(np.clip((ctx.t - lag) / 1.8, 0, 1))
        cur = start * (1 - u[:, None]) + pts * u[:, None]
        a = (1 - u) * 0.9 + 0.15
        for i in range(0, len(cur), 2):
            if a[i] > 0.12:
                ctx.L.dot(cur[i, 0], cur[i, 1], 1.4, BLUE_CORE, a[i])
    ambient(ctx, 20, seed=37, a=0.45)


def fx_23(ctx):
    ambient(ctx, 30, seed=38, a=0.5)


def fx_24(ctx):
    ambient(ctx, 14, seed=39, a=0.35, size=(0.5, 1.6))
    ctx.fin["grain"] = 0.014


def fx_25(ctx):
    ambient(ctx, 26, seed=40, a=0.5)


def robot_poster(size):
    im = ImageOps.exif_transpose(Image.open(os.path.join(ROOT, REF["ROBOT"]))).convert("RGB")
    a = np.asarray(im).astype(np.float32) / 255
    # circular poster sits around (748,1098)/1494x2000 in the phone photo (EXIF-corrected) -> crop to the circle
    h, w = a.shape[:2]
    cx, cy, r = w * 0.505, h * 0.555, w * 0.345
    x0, y0 = int(cx - r), int(cy - r)
    c = a[y0:y0 + int(2 * r), x0:x0 + int(2 * r)]
    c = cv2.resize(c, (size, size), interpolation=cv2.INTER_AREA)
    yy, xx = np.mgrid[0:size, 0:size]
    m = (((xx - size / 2) ** 2 + (yy - size / 2) ** 2) < (size / 2 - 1) ** 2).astype(np.float32)
    return c, cv2.GaussianBlur(m, (0, 0), 1.0)


def fx_poster(ctx, fade=1.0):
    """The band's robot in the round frame on the gig wall (KF-D: circle at ~(719, 88), r~78)."""
    if ctx.clip and "poster" not in ANCHORS.get(ctx.shot.id, {}):
        return
    if ctx.clip:
        px, py, pr = ANCHORS[ctx.shot.id]["poster"]
    else:
        px, py = kf(ctx, 719, 90); pr = 76 * kfs(ctx)
    size = int(pr * 2)
    if size < 8:
        return
    c, m = robot_poster(size)
    # match the room: dim, magenta-washed, painterly soft
    c = cv2.GaussianBlur(c, (0, 0), max(0.6, size / 400))
    c = c * np.array([0.55, 0.38, 0.55], np.float32) * 0.8
    x0, y0 = int(px - size / 2), int(py - size / 2)
    x1, y1 = min(W, x0 + size), min(H, y0 + size)
    if x0 < 0 or y0 < 0 or x1 <= x0 or y1 <= y0:
        return
    mm = m[: y1 - y0, : x1 - x0, None] * fade
    ctx.plate[y0:y1, x0:x1] = ctx.plate[y0:y1, x0:x1] * (1 - mm) + c[: y1 - y0, : x1 - x0] * mm


def fx_26(ctx):
    u = ease(ctx.t / 3.0)
    if not ctx.clip:
        # band fades up; the gig's green/magenta wash spreads over the walls
        m = blue_mask(ctx.plate)
        band = m * (np.arange(W)[None, :] > kf(ctx, 1180, 0)[0])
        warm = ctx.plate.mean(axis=2, keepdims=True) * np.array([1.0, 0.8, 0.55], np.float32) * 0.8
        ctx.plate = warm * (1 - u) + ctx.plate * u
        ctx.plate = ctx.plate * (1 - band[..., None] * (1 - u))
    fx_poster(ctx, fade=u)
    ambient(ctx, 40, seed=41, a=0.6)


def fx_27(ctx):
    fx_poster(ctx)
    gx, gy = anchor(ctx, "strings", (1455, 470))
    hi = env(ctx.T, "high")
    rng = np.random.default_rng(int(ctx.f))
    # sparks: ballistic, spawned on accents over the last 0.6 s
    for k in range(40):
        age = hash01(k, 3) * 0.6
        t_spawn = ctx.T - age
        strength = env(t_spawn, "high")
        if strength < 0.35:
            continue
        ang = -math.pi / 2 + (hash01(k, int(t_spawn * 24)) - 0.5) * 2.4
        v = 350 + 500 * hash01(k, 9)
        x = gx + math.cos(ang) * v * age
        y = gy + math.sin(ang) * v * age + 500 * age * age
        a = (1 - age / 0.6) * strength
        ctx.L.dot(x, y, 1.6, GOLD_CORE, a)
        ctx.L.polyline([(x, y), (x - math.cos(ang) * 18, y - (math.sin(ang) * v + 1000 * age) / v * 18)], GOLD, 1, 0.6 * a)
    for j in range(3):
        cfg = {"kind": "orbit", "center": (W / 2, 300), "radii": (700 + 80 * j, 140 + 30 * j), "a0": j * 2.1,
               "span": 2.0, "spin": 0.9, "amp": 40, "gap": 6}
        Staff(cfg, seed=130 + j, n_notes=4).draw(ctx.L, ctx.T, a=0.75)
    ambient(ctx, 50, seed=42, a=0.6)


def fx_28(ctx):
    cx, cy = anchor(ctx, "gap", (W / 2, H / 2)) if ctx.clip else (W / 2, H / 2)
    u = ease(ctx.t / 3.4)
    if not ctx.clip:
        # stand-in hands of light
        g = 260 - 180 * u
        ctx.L.dot(cx - g, cy, 60, GOLD, 0.5); ctx.L.dot(cx + g, cy, 60, BLUE, 0.5)
    for k in range(30):
        yy = cy + (hash01(k, 1) - 0.5) * 140
        xx = cx + (hash01(k, 2) - 0.5) * 60 * (1 - u + 0.3)
        tw = 0.5 + 0.5 * math.sin(ctx.t * (5 + 7 * hash01(k, 3)) + k)
        col = lerp_color(GOLD_CORE, BLUE_CORE, hash01(k, 4))
        ctx.L.dot(xx, yy, 1.2, col, u * tw)


def fx_29(ctx):
    cx, cy = anchor(ctx, "center", (W / 2, H / 2)) if ctx.clip else (W / 2, H / 2)
    b = 0.7 + 0.3 * ease(ctx.t / 3.9)
    for j in range(4):
        cfg = {"kind": "spiral", "center": (cx, cy), "a0": j * math.pi / 2, "spin": 0.55, "turns": 1.1,
               "r0": 120, "r1": 1100, "gap": 7, "squash": 0.85, "note_speed": 0.05}
        Staff(cfg, seed=140 + j, n_notes=6).draw(ctx.L, ctx.T, a=0.9 * b, width=1.1)
    ambient(ctx, 70, seed=43, a=0.7 * b)
    if not ctx.clip:
        ang = ctx.t * 2.0
        M = cv2.getRotationMatrix2D((W / 2, H / 2), ang, 1.0 + 0.02 * ctx.t)
        ctx.plate = cv2.warpAffine(ctx.plate, M, (W, H), borderMode=cv2.BORDER_REFLECT)
    ctx.fin["exposure"] = 1.0 + 0.1 * ease(ctx.t / 3.9)


def fx_30(ctx):
    """Light drains from the top down; the band, then her younger self, crumble into blue dust."""
    wipe = H * ease_in(np.clip(ctx.t / 6.2, 0, 1)) * 1.15 - 60
    yy = np.arange(H, dtype=np.float32)[:, None, None]
    above = np.clip((wipe - yy) / 120, 0, 1)
    m = blue_mask(ctx.plate)
    # dissolve blue figures above the wipe, and pull the room down to moonlight
    moon = ctx.plate * np.array([0.25, 0.3, 0.45], np.float32) * 0.6
    dark = ctx.plate * (1 - above) + moon * above
    fig_gone = (m[..., None] * above)
    ctx.plate = dark * (1 - fig_gone) + moon * 0.6 * fig_gone
    # dust from the figures at the wipe line
    pts = mask_points(m * (np.abs(np.arange(H)[:, None] - wipe) < 60), 220, int(ctx.f))
    for (x, y) in pts:
        age = hash01(x, y) * 0.8
        ctx.L.dot(x + 60 * age + smooth_noise(ctx.t + x, y) * 10, y - 140 * age, 1.3, BLUE_CORE, 0.9 * (1 - age))
    # drifting dust that already left
    Motes(90, (0, -100, W, max(wipe, 1)), seed=44, rise=40, speed=40).draw(ctx.L, ctx.T, a=0.55 * (1 - ease((ctx.t - 5) / 2.5)))
    ctx.fin["halate"] = 0.28 * (1 - ease(ctx.t / 4))


def fx_31a(ctx):
    ctx.fin["halate"] = 0.0


def fx_31b(ctx):
    for j, tex in enumerate(EQUATIONS[:3]):
        u = ease((ctx.t + j * 0.25) / 1.7)
        x = 900 + 250 * j + 60 * math.sin(ctx.t * 3 + j)
        y = -80 + u * 620
        Equation(tex, [(0, x, y, 0.55, 20 * math.sin(ctx.t * 2 + j))], seed=150 + j).draw(ctx.L, ctx.T, a=0.8 * (1 - ease((ctx.t - 1.3) / 0.6)))
    ctx.fin["halate"] = 0.0


def dark_led_glow(ctx, default=(1037, 637), r=90, a=0.35):
    x, y = anchor(ctx, "led", default)
    ctx.L.dot(x, y, 2.5 * (kfs(ctx) if not ctx.clip else 1), RED, 0.9)
    ctx.L.dot(x, y, r, RED * 0.5, a * (0.85 + 0.15 * math.sin(ctx.T * 2)))


def fx_dark(ctx):
    ctx.fin["halate"] = 0.0
    dark_led_glow(ctx)


def fx_33(ctx):
    fx_dark(ctx)
    x = 1250 - 700 * ease(ctx.t / 3.9)
    y = 520 + 30 * math.sin(ctx.t)
    ctx.L.dot(x, y, 2.6, BLUE_CORE, 0.9)
    ctx.L.dot(x, y, 12, BLUE, 0.3)


def fx_34(ctx):
    fx_dark(ctx)
    # the stop around 2:15 -- one beat of black
    if 134.53 <= ctx.T < 135.02:
        ctx.fin["fade"] = 0.0
        ctx.L.buf[:] = 0


def fx_35(ctx):
    led_macro(ctx, blink_every=2, dim=0.8)


def fx_36(ctx):
    # the cat's tail sweeps across the LED: the second transit, quieter than the first
    d = transit_depth(ctx.t, 1.2, 2.9, 0.4, 0.8)
    led_macro(ctx, blink_every=2, dim=0.8, extra_dip=d)
    if not ctx.clip:
        u = (ctx.t - 0.9) / 2.3
        if 0 < u < 1:
            tx = W * 1.1 - u * W * 1.3
            fur = np.zeros((H, W), np.float32)
            cv2.ellipse(fur, (int(tx), int(H * 0.47)), (420, 150), -8, 0, 360, 1.0, -1, cv2.LINE_AA)
            fur = cv2.GaussianBlur(fur, (0, 0), 40)[..., None]
            ctx.plate = ctx.plate * (1 - 0.9 * fur) + np.array([0.05, 0.035, 0.025], np.float32) * fur
            ctx.L.buf[:] = (ctx.L.buf.astype(np.float32) * (1 - 0.85 * fur)).astype(np.uint8)


def fx_37(ctx):
    fx_dark(ctx)


def fx_38(ctx):
    ctx.fin["fade"] = 0.0
    ctx.fin["grain"] = 0.0


def fx_39(ctx):
    ctx.fin["halate"] = 0.0
    x, y = anchor(ctx, "rec", (1037, 637))
    ctx.L.dot(x, y, 3, RED, 1.0)
    ctx.L.dot(x, y, 140, RED * 0.45, 0.4)


def fx_40(ctx):
    cx, cy = W / 2, H * 0.45
    burst = math.exp(-ctx.t / 0.3)
    for j in range(5):
        col = GOLD if j % 2 else BLUE
        cfg = {"kind": "orbit", "center": (cx, cy - 60 + 40 * j), "radii": (560 + 90 * j, 150 + 40 * j), "a0": j * 1.3,
               "span": 2.4, "spin": 0.8 + 0.1 * j, "amp": 50, "gap": 7}
        Staff(cfg, seed=160 + j, n_notes=5).draw(ctx.L, ctx.T, a=0.9, color=col)
    ambient(ctx, 50, seed=45, a=0.7)
    Motes(40, (0, 0, W, H), seed=46, color=GOLD, rise=10, speed=30).draw(ctx.L, ctx.T, a=0.7)
    ctx.fin["exposure"] = 1.0 + 0.25 * burst
    ctx.fin["glow_amt"] = 1.2


def fx_41(ctx):
    x, y = anchor(ctx, "visitor", (400, 150))
    g = 0.3 + 1.4 * ease(ctx.t / 3.9)
    ctx.L.dot(x, y, 2 + 3 * g, BLUE_CORE, 0.9)
    ctx.L.dot(x, y, 14 * g, BLUE, 0.4)
    L = 60 * g
    ctx.L.polyline([(x - L, y), (x + L, y)], BLUE_CORE, 1, 0.5)
    ctx.L.polyline([(x, y - L), (x, y + L)], BLUE_CORE, 1, 0.5)
    ambient(ctx, 25, seed=47, a=0.45)
    Motes(20, (0, 0, W, H), seed=48, color=GOLD, rise=6).draw(ctx.L, ctx.T, a=0.5)


def fx_42(ctx):
    ctx.fin["halate"] = 0.35


def fx_43(ctx):
    x, y = anchor(ctx, "button", (1105, 880))
    on = ease((ctx.t - 1.6) / 0.15)
    if on > 0:
        ctx.L.dot(x, y, 4 * kfs(ctx) / 1.5 if not ctx.clip else 4, np.array([150, 230, 255]), on)
        ctx.L.dot(x, y, 40, BLUE, 0.4 * on)


def fx_44(ctx):
    ctx.fin["halate"] = 0.15
    if not os.path.exists(os.path.join(ROOT, "gen", "frames", ZOOM_PLATES[-1])):
        u = ease(ctx.t / ctx.dur)
        if u > 0.75:
            x = W * 0.56; y = H / 2
            a = ease((u - 0.75) / 0.2)
            ctx.L.dot(x, y, 2.5, BLUE_CORE, a)
            ctx.L.dot(x, y, 9, BLUE, 0.4 * a)


def fx_45(ctx):
    """Black -> the label with a new second line in fresh ink -> title card."""
    ctx.fin["halate"] = 0.2
    fade_in = ease((ctx.t - 0.25) / 0.35)
    ctx.fin["fade"] = fade_in * (1 - 0.75 * ease((ctx.t - 1.45) / 0.4))
    title_card(ctx, ease((ctx.t - 1.5) / 0.5))


def title_card(ctx, a):
    if a <= 0:
        return
    t1 = vfx.text_sprite("rare earth", "InstrumentSerif-Italic.ttf", 150)
    t2 = vfx.text_sprite("written by Jade Wang and Charlie van Norman", "CormorantGaramond[wght].ttf", 40)
    ctx.L.sprite(t1, W / 2, H * 0.44, 1.0, 0, np.array([240, 232, 215]), a)
    ctx.L.sprite(t2, W / 2, H * 0.56, 1.0, 0, np.array([200, 196, 188]), a * 0.9)
    ctx.fin["glow_amt"] = 0.25


def fx_post(ctx):
    ctx.fin["halate"] = 0.0
    ctx.fin["fade"] = ease(ctx.t / 0.6)
    cap = vfx.text_sprite("RNA band, 2011", "CormorantGaramond-Italic[wght].ttf", 40)
    ctx.L.sprite(cap, W / 2, H * 0.9, 1.0, 0, np.array([210, 204, 192]), ease((ctx.t - 0.4) / 0.6))
    ctx.fin["glow_amt"] = 0.15


FX = {"P1": fx_pre, "P2": fx_pre, "P3": fx_pre, "1": fx_1, "2": fx_2, "3": fx_3, "4": fx_4, "5": fx_5, "6": fx_6,
      "7": fx_7, "8a": fx_8a, "8b": fx_8b, "9": fx_9, "10": fx_10, "11": fx_11, "12": fx_12, "13": fx_13,
      "14": fx_14, "15": fx_15, "16": fx_16, "17": fx_17, "18": fx_18, "19": fx_19, "20": fx_20, "21": fx_21,
      "22": fx_22, "23": fx_23, "24": fx_24, "25": fx_25, "26": fx_26, "27": fx_27, "28": fx_28, "29": fx_29,
      "30": fx_30, "31a": fx_31a, "31b": fx_31b, "32": fx_dark, "33": fx_33, "34": fx_34, "35": fx_35,
      "36": fx_36, "37": fx_37, "38": fx_38, "39": fx_39, "40": fx_40, "41": fx_41, "42": fx_42, "43": fx_43,
      "44": fx_44, "45": fx_45, "POST": fx_post}


def apply(ctx):
    fn = FX.get(ctx.shot.id)
    if fn:
        fn(ctx)
