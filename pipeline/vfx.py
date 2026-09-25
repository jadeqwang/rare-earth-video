"""Procedural light VFX for Rare Earth: motes, notes, staff ribbons, equations, glow, film finish.

Everything draws additively into a uint8 "light" layer (anti-aliased cv2 primitives and sprites);
`finish()` turns that into glow + core and screens it over the plate, then adds the film look.
"""
import functools, math, os
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont

W, H = 1920, 1080
HERE = os.path.dirname(os.path.abspath(__file__))
FONTS = os.path.join(HERE, "fonts")

# Palette (RGB 0-255). Blue = the past, gold = the present.
BLUE_CORE = np.array([225, 240, 255], np.float32)
BLUE = np.array([120, 185, 255], np.float32)
BLUE_DEEP = np.array([55, 105, 235], np.float32)
GOLD = np.array([255, 196, 110], np.float32)
GOLD_CORE = np.array([255, 236, 200], np.float32)
RED = np.array([255, 70, 60], np.float32)


# ----------------------------------------------------------------------------- noise helpers

def hash01(*xs):
    """Deterministic pseudo-random in [0,1) from ints/floats (vectorised)."""
    h = np.float64(0)
    for i, x in enumerate(xs):
        h = h + np.asarray(x, np.float64) * (12.9898 + 31.4159 * i)
    return (np.sin(h) * 43758.5453) % 1.0


def smooth_noise(t, seed=0.0):
    """1-D value noise, smooth, roughly in [-1,1]."""
    t = np.asarray(t, np.float64)
    i = np.floor(t); f = t - i
    a = hash01(i, seed) * 2 - 1; b = hash01(i + 1, seed) * 2 - 1
    u = f * f * (3 - 2 * f)
    return a + (b - a) * u


def flow(x, y, t, seed=0.0, scale=0.004):
    """Cheap divergence-free-ish 2-D drift field built from summed sines."""
    s = seed * 1.7
    dx = (np.sin(y * scale * 1.3 + t * 0.35 + s) + 0.6 * np.sin(y * scale * 2.9 - t * 0.21 + 2 * s)
          + 0.4 * np.cos(x * scale * 1.1 + t * 0.17))
    dy = (np.cos(x * scale * 1.1 - t * 0.29 + s) + 0.6 * np.cos(x * scale * 2.3 + t * 0.23 + 3 * s)
          + 0.4 * np.sin(y * scale * 1.7 - t * 0.13))
    return dx, dy


def ease(x):
    x = np.clip(x, 0, 1)
    return x * x * (3 - 2 * x)


def ease_out(x):
    x = np.clip(x, 0, 1)
    return 1 - (1 - x) ** 3


def ease_in(x):
    x = np.clip(x, 0, 1)
    return x ** 3


# ----------------------------------------------------------------------------- sprites

def _font(name, size):
    return ImageFont.truetype(os.path.join(FONTS, name) if not os.path.isabs(name) else name, size)


SYSFONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SERIF = "/usr/share/fonts/truetype/freefont/FreeSerif.ttf"


@functools.lru_cache(maxsize=None)
def glyph_sprite(ch, size=96, font=SYSFONT):
    """Alpha mask (uint8, HxW) for a single glyph, tightly cropped with padding."""
    f = ImageFont.truetype(font, size)
    im = Image.new("L", (size * 2, size * 2), 0)
    d = ImageDraw.Draw(im)
    d.text((size // 2, size // 3), ch, font=f, fill=255)
    a = np.array(im)
    ys, xs = np.nonzero(a > 8)
    pad = 6
    a = a[max(ys.min() - pad, 0):ys.max() + pad, max(xs.min() - pad, 0):xs.max() + pad]
    return a


NOTE_CHARS = ["♪", "♫", "♬", "♩"]  # ♪ ♫ ♬ ♩


@functools.lru_cache(maxsize=None)
def math_sprite(tex, size=64):
    """Render a TeX-ish math string with matplotlib mathtext (STIX) into an alpha mask."""
    import matplotlib
    matplotlib.use("Agg")
    from matplotlib import mathtext, font_manager
    from matplotlib.figure import Figure
    from matplotlib.backends.backend_agg import FigureCanvasAgg
    fig = Figure(figsize=(12, 2), dpi=100)
    fig.patch.set_alpha(0)
    canvas = FigureCanvasAgg(fig)
    fig.text(0.02, 0.35, tex, fontsize=size * 0.72, color="white", math_fontfamily="stix")
    canvas.draw()
    a = np.asarray(canvas.buffer_rgba())[..., 3].copy()
    ys, xs = np.nonzero(a > 8)
    pad = 8
    return a[max(ys.min() - pad, 0):ys.max() + pad, max(xs.min() - pad, 0):xs.max() + pad]


EQUATIONS = [
    r"$i\hbar\,\frac{\partial}{\partial t}\Psi = \hat{H}\,\Psi$",
    r"$\Delta x\,\Delta p \geq \frac{\hbar}{2}$",
    r"$\partial_\mu j^\mu = 0$",                       # Noether: symmetry -> conservation
    r"$N = R_* f_p n_e f_l f_i f_c L$",                 # Drake equation
    r"$E = \hbar\omega$",
    r"$\nabla^2\psi + k^2\psi = 0$",
    r"$\frac{\Delta F}{F} \approx \left(\frac{R_p}{R_*}\right)^2$",  # transit depth
]


def text_sprite(text, font, size, pad=10):
    f = _font(font, size)
    l, t, r, b = f.getbbox(text)
    im = Image.new("L", (r - l + 2 * pad, b - t + 2 * pad), 0)
    ImageDraw.Draw(im).text((pad - l, pad - t), text, font=f, fill=255)
    return np.array(im)


# ----------------------------------------------------------------------------- drawing into light layer

class Light:
    """uint8 RGB accumulation buffer for emissive elements (additive, saturating)."""

    def __init__(self, w=W, h=H):
        self.w, self.h = w, h
        self.buf = np.zeros((h, w, 3), np.uint8)

    def dot(self, x, y, r, color, a=1.0):
        c = tuple(float(v) for v in np.clip(np.asarray(color) * a, 0, 255))
        if r < 1.2:
            # sub-pixel dots: draw a 1px AA circle with reduced intensity
            c = tuple(v * max(r / 1.2, 0.25) for v in c)
            r = 1.2
        sh = 3
        layer_x, layer_y = int(round(x * (1 << sh))), int(round(y * (1 << sh)))
        tmp_r = int(round(r * (1 << sh)))
        x0, y0 = int(x - r - 2), int(y - r - 2)
        x1, y1 = int(x + r + 3), int(y + r + 3)
        if x1 < 0 or y1 < 0 or x0 >= self.w or y0 >= self.h:
            return
        roi = np.zeros((y1 - y0, x1 - x0, 3), np.uint8)
        cv2.circle(roi, (layer_x - (x0 << sh), layer_y - (y0 << sh)), tmp_r, c, -1, cv2.LINE_AA, sh)
        self._add_roi(roi, x0, y0)

    def _add_roi(self, roi, x0, y0):
        h, w = roi.shape[:2]
        sx0, sy0 = max(0, -x0), max(0, -y0)
        dx0, dy0 = max(0, x0), max(0, y0)
        dx1, dy1 = min(self.w, x0 + w), min(self.h, y0 + h)
        if dx1 <= dx0 or dy1 <= dy0:
            return
        sub = roi[sy0:sy0 + (dy1 - dy0), sx0:sx0 + (dx1 - dx0)]
        cv2.add(self.buf[dy0:dy1, dx0:dx1], sub, dst=self.buf[dy0:dy1, dx0:dx1])

    def polyline(self, pts, color, thick=2, a=1.0):
        c = tuple(float(v) for v in np.clip(np.asarray(color) * a, 0, 255))
        if a <= 0.01:
            return
        p = np.round(np.asarray(pts) * 8).astype(np.int32).reshape(-1, 1, 2)
        tmp = np.zeros_like(self.buf)
        cv2.polylines(tmp, [p], False, c, max(1, int(round(thick))), cv2.LINE_AA, 3)
        cv2.add(self.buf, tmp, dst=self.buf)

    def polyline_fast(self, pts, color, thick=2, a=1.0):
        """Same as polyline but draws directly (overlapping segments may not double-add)."""
        c = tuple(float(v) for v in np.clip(np.asarray(color) * a, 0, 255))
        if a <= 0.01:
            return
        p = np.round(np.asarray(pts) * 8).astype(np.int32).reshape(-1, 1, 2)
        cv2.polylines(self.buf, [p], False, c, max(1, int(round(thick))), cv2.LINE_AA, 3)

    def sprite(self, mask, x, y, scale=1.0, angle=0.0, color=BLUE_CORE, a=1.0):
        """Blit an alpha mask centred at (x,y), rotated (deg) & scaled, tinted, additively."""
        if a <= 0.01 or scale <= 0.01:
            return
        h, w = mask.shape
        diag = int(math.ceil(math.hypot(w, h) * scale)) + 4
        M = cv2.getRotationMatrix2D((w / 2, h / 2), angle, scale)
        M[0, 2] += diag / 2 - w / 2
        M[1, 2] += diag / 2 - h / 2
        fx, fy = x - diag / 2, y - diag / 2
        ix, iy = int(math.floor(fx)), int(math.floor(fy))
        M[0, 2] += fx - ix
        M[1, 2] += fy - iy
        m = cv2.warpAffine(mask, M, (diag, diag), flags=cv2.INTER_LINEAR)
        col = np.clip(np.asarray(color, np.float32) * a / 255.0, 0, 1)
        roi = (m[..., None].astype(np.float32) * col).astype(np.uint8)
        self._add_roi(roi, ix, iy)


# ----------------------------------------------------------------------------- element systems

class Motes:
    """Drifting specks of blue light. Deterministic in t (no state) so frames render independently."""

    def __init__(self, n, region=(0, 0, W, H), seed=1, size=(0.8, 3.0), speed=40.0, color=BLUE,
                 twinkle=1.0, rise=0.0):
        self.n, self.region, self.seed, self.size, self.speed = n, region, seed, size, speed
        self.color, self.twinkle, self.rise = color, twinkle, rise
        k = np.arange(n)
        self.u = hash01(k, seed); self.v = hash01(k, seed + 7.1)
        self.s = hash01(k, seed + 3.3); self.ph = hash01(k, seed + 9.9) * 100

    def positions(self, t):
        x0, y0, x1, y1 = self.region
        x = x0 + self.u * (x1 - x0); y = y0 + self.v * (y1 - y0)
        # integrate drift approximately by evaluating the flow at a few points along time
        dx = np.zeros(self.n); dy = np.zeros(self.n)
        for j in range(4):
            tt = t * (j + 1) / 4
            fx, fy = flow(x + dx, y + dy, tt + self.ph * 0.01, self.seed)
            dx += fx * self.speed * t / 4 * 0.5
            dy += fy * self.speed * t / 4 * 0.5
        y = y + dy - self.rise * t * (0.5 + self.s)
        x = x + dx
        # wrap into region
        w, h = x1 - x0, y1 - y0
        x = x0 + np.mod(x - x0, w); y = y0 + np.mod(y - y0, h)
        return x, y

    def draw(self, L, t, a=1.0, bright=1.0, offset=(0, 0)):
        if a <= 0.01:
            return
        x, y = self.positions(t)
        r = self.size[0] + (self.size[1] - self.size[0]) * self.s ** 2
        tw = 0.55 + 0.45 * np.sin(t * (2 + 5 * self.s) + self.ph) * self.twinkle
        for i in range(self.n):
            L.dot(x[i] + offset[0], y[i] + offset[1], r[i], self.color, a * bright * tw[i])


def staff_path(t, u, cfg):
    """A flowing path for a staff ribbon; u in [0,1] along the ribbon. Returns (x, y, nx, ny).

    kinds: "line" (from -> to with wobble), "orbit" (ellipse arc around a centre),
           "spiral" (arm winding out from a centre), "points" (catmull-rom through fixed points).
    """
    kind = cfg.get("kind", "line")
    amp = cfg.get("amp", 80.0); waves = cfg.get("waves", 1.5); spd = cfg.get("speed", 0.6)
    ph = cfg.get("phase", 0.0)
    u = np.asarray(u, np.float64)
    if kind == "orbit":
        cx, cy = cfg["center"]; rx, ry = cfg["radii"]
        a0 = cfg.get("a0", 0.0) + t * cfg.get("spin", 0.4)
        th = a0 + cfg.get("span", 2.5) * u
        wob = amp * 0.3 * np.sin(2 * np.pi * (u * waves - t * spd * 0.25) + ph)
        x = cx + (rx + wob) * np.cos(th); y = cy + (ry + wob * 0.5) * np.sin(th) + cfg.get("tilt", 0.0) * np.cos(th)
        dx = -(rx) * np.sin(th); dy = ry * np.cos(th)
    elif kind == "spiral":
        cx, cy = cfg["center"]
        a0 = cfg.get("a0", 0.0) + t * cfg.get("spin", 0.5)
        r = cfg.get("r0", 30.0) + (cfg.get("r1", 900.0) - cfg.get("r0", 30.0)) * u
        th = a0 + cfg.get("turns", 1.2) * 2 * np.pi * u
        sq = cfg.get("squash", 1.0)
        x = cx + r * np.cos(th); y = cy + r * np.sin(th) * sq
        dr = cfg.get("r1", 900.0) - cfg.get("r0", 30.0); dth = cfg.get("turns", 1.2) * 2 * np.pi
        dx = dr * np.cos(th) - r * np.sin(th) * dth + 1e-6
        dy = (dr * np.sin(th) + r * np.cos(th) * dth) * sq
    else:
        x0, y0, x1, y1 = cfg["from"][0], cfg["from"][1], cfg["to"][0], cfg["to"][1]
        x = x0 + (x1 - x0) * u
        y = y0 + (y1 - y0) * u
        dx, dy = np.full_like(u, x1 - x0), np.full_like(u, y1 - y0)
        ln = math.hypot(x1 - x0, y1 - y0) + 1e-6
        nx0, ny0 = -(y1 - y0) / ln, (x1 - x0) / ln
        w = amp * (np.sin(2 * np.pi * (u * waves - t * spd * 0.25) + ph)
                   + 0.35 * np.sin(2 * np.pi * (u * waves * 2.3 + t * spd * 0.17) + 2 * ph))
        return x + nx0 * w, y + ny0 * w, np.full_like(u, nx0), np.full_like(u, ny0)
    ln = np.hypot(dx, dy) + 1e-6
    return x, y, -dy / ln, dx / ln


class Staff:
    """Five glowing staff lines flowing along a path, with notes riding them.

    reveal: 0..1 how much of the ribbon exists (grows from its tail);  a: overall alpha.
    """

    def __init__(self, cfg, seed=0, n_notes=6):
        self.cfg, self.seed, self.n_notes = cfg, seed, n_notes
        self.gap = cfg.get("gap", 7.0)
        self.notes = [(hash01(k, seed) , NOTE_CHARS[int(hash01(k, seed + 1) * 4)],
                       int(hash01(k, seed + 2) * 5)) for k in range(n_notes)]

    def draw(self, L, t, a=1.0, reveal=1.0, width=1.0, note_scale=0.5, color=BLUE):
        if a <= 0.01 or reveal <= 0.001:
            return
        n = 120
        u = np.linspace(0, 1, n)
        x, y, nx, ny = staff_path(t, u, self.cfg)
        head = reveal
        fade = np.clip(np.minimum(u / 0.22, (head - u) / 0.1), 0, 1) * (u <= head)
        taper = 0.35 + 0.65 * np.sin(np.pi * np.clip(u, 0, 1))
        chunks = 20
        for c in range(chunks):
            i0, i1 = c * n // chunks, (c + 1) * n // chunks + 1
            aa = float(fade[i0:i1].mean())
            if aa <= 0.02:
                continue
            for k in range(5):
                off = (k - 2) * self.gap * width * taper[i0:i1]
                pts = np.stack([x[i0:i1] + nx[i0:i1] * off, y[i0:i1] + ny[i0:i1] * off], -1)
                L.polyline_fast(pts, color, 1, a * aa * (0.55 if k in (0, 4) else 0.42))
        # glittering dust shed from the ribbon
        m = 40
        for j in range(m):
            uu = (hash01(j, self.seed + 11) + t * 0.03) % 1.0
            if uu > head:
                continue
            fx, fy, nnx, nny = staff_path(t, np.array([uu]), self.cfg)
            spread = (hash01(j, self.seed + 13) - 0.5) * 70 * width
            drift = (t * 12 * hash01(j, self.seed + 17)) % 40
            tw = 0.5 + 0.5 * math.sin(t * (3 + 6 * hash01(j, self.seed + 19)) + j)
            fa = float(np.clip(min(uu / 0.2, (head - uu) / 0.1), 0, 1))
            L.dot(float(fx[0] + nnx[0] * spread), float(fy[0] + nny[0] * spread - drift), 0.6 + 1.4 * hash01(j, self.seed + 23) ** 3,
                  BLUE_CORE, a * fa * tw)
        # notes ride along the staff
        for (p, ch, line) in self.notes:
            uu = (p + t * self.cfg.get("note_speed", 0.05)) % 1.0
            if uu > head:
                continue
            fx, fy, nnx, nny = staff_path(t, np.array([uu]), self.cfg)
            off = (line - 2) * self.gap * width
            fa = float(np.clip(min(uu / 0.18, (head - uu) / 0.12), 0, 1))
            spr = glyph_sprite(ch, 96, SERIF)
            ang = math.degrees(math.atan2(-nnx[0], nny[0])) * 0.3
            L.sprite(spr, float(fx[0] + nnx[0] * off), float(fy[0] + nny[0] * off - 12 * note_scale),
                     note_scale * width, ang, BLUE_CORE, a * fa)


class FloatingNote:
    """A single note of light that follows a keyframed path (list of (t, x, y, scale))."""

    def __init__(self, keys, ch="♪", color=BLUE_CORE, wobble=6.0, seed=0):
        self.keys = np.array(keys, np.float64); self.ch = ch; self.color = color
        self.wobble = wobble; self.seed = seed

    def state(self, t):
        k = self.keys
        x = np.interp(t, k[:, 0], k[:, 1]); y = np.interp(t, k[:, 0], k[:, 2])
        s = np.interp(t, k[:, 0], k[:, 3])
        x += smooth_noise(t * 0.8, self.seed) * self.wobble
        y += smooth_noise(t * 0.7, self.seed + 5) * self.wobble
        return x, y, s

    def draw(self, L, t, a=1.0, trail=True):
        x, y, s = self.state(t)
        spr = glyph_sprite(self.ch, 128, SERIF)
        ang = smooth_noise(t * 0.5, self.seed + 9) * 12
        if trail:
            for j in range(1, 9):
                tx, ty, ts = self.state(t - j * 0.035)
                L.dot(tx + hash01(j, self.seed) * 6 - 3, ty + 10 * ts, 1.5 * ts + 0.6, BLUE, a * (1 - j / 9) * 0.6)
        L.sprite(spr, x, y, s, ang, self.color, a)
        L.dot(x, y, 16 * s, BLUE_DEEP, a * 0.35)


class Equation:
    def __init__(self, tex, keys, seed=0, color=(190, 222, 255), size=64):
        self.spr = math_sprite(tex, size)
        self.keys = np.array(keys, np.float64); self.seed = seed; self.color = color

    def draw(self, L, t, a=1.0, peel=1.0):
        k = self.keys
        x = np.interp(t, k[:, 0], k[:, 1]); y = np.interp(t, k[:, 0], k[:, 2])
        s = np.interp(t, k[:, 0], k[:, 3]); ang = np.interp(t, k[:, 0], k[:, 4]) if k.shape[1] > 4 else 0
        x += smooth_noise(t * 0.5, self.seed) * 5; y += smooth_noise(t * 0.45, self.seed + 3) * 5
        if peel < 1.0:
            # reveal left-to-right as the line lifts off the page
            m = self.spr.copy(); cut = int(m.shape[1] * np.clip(peel, 0, 1)); m[:, cut:] = 0
            L.sprite(m, x, y, s, ang, self.color, a)
        else:
            L.sprite(self.spr, x, y, s, ang, self.color, a)


# ----------------------------------------------------------------------------- finishing

_GRAIN = None


def _grain_bank():
    global _GRAIN
    if _GRAIN is None:
        rng = np.random.default_rng(7)
        bank = []
        for _ in range(12):
            g = rng.standard_normal((H // 2, W // 2)).astype(np.float32)
            g = cv2.GaussianBlur(g, (0, 0), 0.9)
            g = cv2.resize(g, (W, H), interpolation=cv2.INTER_LINEAR)
            bank.append(g / (g.std() + 1e-6))
        _GRAIN = bank
    return _GRAIN


_VIG = None


def _vignette():
    global _VIG
    if _VIG is None:
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        r = np.sqrt(((xx - W / 2) / (W / 2)) ** 2 + ((yy - H / 2) / (H / 2)) ** 2)
        _VIG = (1 - 0.32 * np.clip(r - 0.35, 0, 1) ** 1.6)[..., None]
    return _VIG


def glow(light_u8, amount=1.0, radii=(3, 12, 36), weights=(0.8, 0.5, 0.35)):
    """Return float32 glow at full res (core + blurred halo) for an emissive uint8 layer."""
    small = cv2.resize(light_u8, (W // 4, H // 4), interpolation=cv2.INTER_AREA).astype(np.float32) / 255.0
    acc = None
    for r, w in zip(radii, weights):
        b = cv2.GaussianBlur(small, (0, 0), r / 4) * w
        acc = b if acc is None else acc + b
    up = cv2.resize(acc, (W, H), interpolation=cv2.INTER_LINEAR)
    core = light_u8.astype(np.float32) * (1 / 255.0)
    return cv2.scaleAdd(up, amount * 2.2, core)


def screen(base, light):
    light = np.clip(light, 0, 1)
    return 1 - cv2.multiply(1 - base, 1 - light)


def halation(base, thresh=0.72, amount=0.35, tint=(1.0, 0.72, 0.45)):
    """Warm bloom around the brightest practicals (the lamp) -- a filmic halation."""
    small = cv2.resize(base, (W // 8, H // 8), interpolation=cv2.INTER_AREA)
    m = np.clip((small.max(axis=2) - thresh) / (1 - thresh), 0, 1)
    b = cv2.GaussianBlur(m, (0, 0), 3) * 0.6 + cv2.GaussianBlur(m, (0, 0), 9) * 0.6
    b = b[..., None] * np.array(tint, np.float32) * amount
    b = cv2.resize(b, (W, H), interpolation=cv2.INTER_LINEAR)
    return screen(base, b)


def finish(plate_f32, light_u8=None, frame_idx=0, glow_amt=1.0, grain=0.016, vignette=True,
           halate=0.3, exposure=1.0, fade=1.0, lift=0.0):
    """plate: float32 HxWx3 in [0,1]. Returns uint8 final frame."""
    glow_amt, grain, halate, exposure, fade, lift = (float(v) for v in (glow_amt, grain, halate, exposure, fade, lift))
    img = np.asarray(plate_f32, np.float32)
    img = img * np.float32(exposure) if exposure != 1.0 else img
    if halate > 0:
        img = halation(img, amount=halate)
    if light_u8 is not None and light_u8.any():
        img = screen(img, glow(light_u8, glow_amt))
    if vignette:
        img = cv2.multiply(img, _vignette3())
    if fade != 1.0 or lift:
        img = img * fade + lift
    if grain > 0:
        g = _grain_bank()[frame_idx % 12]
        img = img + cv2.merge([g, g, g]) * grain
    return cv2.convertScaleAbs(np.clip(img, 0, 1), alpha=255.0)


_VIG3 = None


def _vignette3():
    global _VIG3
    if _VIG3 is None:
        v = _vignette()[..., 0]
        _VIG3 = cv2.merge([v, v, v])
    return _VIG3
