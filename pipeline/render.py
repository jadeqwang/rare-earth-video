"""Render the film: per-shot plates + VFX -> gen/render/{id}.mp4, then concat + soundtrack -> gen/out/*.mp4

  python3 render.py [ids...] [--jobs 4] [--final] [--preview]   # render shots
  python3 render.py --concat [--name v0]                          # stitch everything with audio
  python3 render.py --still ID t                                  # write one frame to gen/test/ID_t.jpg
"""
import argparse, os, subprocess, sys, time, math
from multiprocessing import Pool
import numpy as np
import cv2

import vfx
from vfx import W, H
import shots as shots_mod
from shots import SHOTS, BY_ID, REF, ROOT, PRE, SONG_END, POST
import fx_shots

FPS = 24
FFMPEG = "ffmpeg"
GEN = os.path.join(ROOT, "gen")
RENDER = os.path.join(GEN, "render")
CLIPS = os.path.join(GEN, "clips")
OUT = os.path.join(GEN, "out")
os.makedirs(RENDER, exist_ok=True); os.makedirs(OUT, exist_ok=True)


def frame_range(shot):
    f0 = int(round((PRE + shot.start) * FPS))
    f1 = int(round((PRE + shot.end) * FPS))
    return f0, f1


# ----------------------------------------------------------------------------- plate sources

_IMG = {}


def load_ref(key):
    if key not in _IMG:
        from PIL import Image, ImageOps
        p = os.path.join(ROOT, REF[key]) if key in REF else key
        im = ImageOps.exif_transpose(Image.open(p)).convert("RGB")
        _IMG[key] = np.asarray(im).astype(np.float32) / 255.0
    return _IMG[key]


def crop_plate(img, crop, out_w=W, out_h=H):
    """crop = (x, y, w) in source px, 16:9 implied. Sub-pixel accurate via warpAffine."""
    x, y, w = crop
    h = w * 9 / 16
    s = out_w / w
    M = np.array([[s, 0, -x * s], [0, s, -y * s]], np.float32)
    interp = cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA
    return cv2.warpAffine(img, M, (out_w, out_h), flags=interp, borderMode=cv2.BORDER_REFLECT)


class StillSource:
    def __init__(self, shot):
        key, c0, c1 = shot.still
        self.img = load_ref(key)
        self.c0 = np.array(c0, np.float64)
        self.c1 = np.array(c1 if c1 is not None else c0, np.float64)
        self.dur = shot.dur

    def crop_at(self, t):
        u = vfx.ease(t / max(self.dur, 1e-6)) * 0.85 + (t / max(self.dur, 1e-6)) * 0.15
        return self.c0 + (self.c1 - self.c0) * u

    def get(self, t):
        return crop_plate(self.img, self.crop_at(t))


class ClipSource:
    """Sequential reader for a generated clip, scaled/cropped to 1920x1080, with retiming."""

    def __init__(self, path, shot):
        self.path, self.shot = path, shot
        probe = subprocess.run([FFMPEG, "-i", path], capture_output=True, text=True).stderr
        import re
        m = re.search(r"(\d{2,5})x(\d{2,5})[, ]", probe.split("Video:")[1])
        self.sw, self.sh = int(m.group(1)), int(m.group(2))
        fm = re.search(r"([\d.]+) fps", probe)
        self.sfps = float(fm.group(1)) if fm else 24.0
        dm = re.search(r"Duration: (\d+):(\d+):([\d.]+)", probe)
        self.sdur = int(dm.group(1)) * 3600 + int(dm.group(2)) * 60 + float(dm.group(3))
        self.proc = None; self.idx = -1; self.cur = None

    def _open(self):
        # scale to cover 16:9 at 1920x1080 (lanczos), center-crop
        vf = (f"scale={W}:{H}:force_original_aspect_ratio=increase:flags=lanczos,crop={W}:{H}")
        self.proc = subprocess.Popen([FFMPEG, "-v", "error", "-i", self.path, "-vf", vf, "-f", "rawvideo",
                                      "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE, bufsize=W * H * 3 * 2)
        self.idx = -1

    def _read_to(self, j):
        if self.proc is None or j < self.idx:
            if self.proc: self.proc.kill()
            self._open()
        while self.idx < j:
            buf = self.proc.stdout.read(W * H * 3)
            if len(buf) < W * H * 3:
                break  # past the end: hold last frame
            self.cur = np.frombuffer(buf, np.uint8).reshape(H, W, 3)
            self.idx += 1
        return self.cur

    def get(self, t):
        s = self.shot
        if s.freeze_until is not None and t < s.freeze_until:
            src_t = s.clip_in
        else:
            base = (t - (s.freeze_until or 0.0))
            src_t = s.clip_in + base * s.speed
        if s.id in REVERSE:
            src_t = self.sdur - 1.0 / self.sfps - src_t
        j = int(round(src_t * self.sfps))
        j = max(0, min(j, int(self.sdur * self.sfps) - 1))
        f = self._read_to(j)
        return f.astype(np.float32) / 255.0


class FrameSource:
    """A generated start frame animated as a 2.5D 'living painting': slow dolly with depth parallax.

    shot.cam = dict(zoom=(z0, z1), pan=(dx, dy) px over the shot, par=parallax strength, focus=(fx, fy) 0..1)
    """
    FR = os.path.join(GEN, "frames")

    def __init__(self, shot):
        from PIL import Image
        self.shot = shot
        img = np.asarray(Image.open(os.path.join(self.FR, f"{shot.id}.jpg")).convert("RGB")).astype(np.float32) / 255
        self.img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
        dp = os.path.join(self.FR, f"{shot.id}_depth.jpg")
        if os.path.exists(dp):
            d = np.asarray(Image.open(dp).convert("L")).astype(np.float32)
            d = cv2.resize(d, (W, H), interpolation=cv2.INTER_AREA)
            lo, hi = np.percentile(d, 2), np.percentile(d, 98)
            d = np.clip((d - lo) / max(hi - lo, 1), 0, 1)
            self.depth = cv2.GaussianBlur(d, (0, 0), 10)
        else:
            self.depth = np.full((H, W), 0.5, np.float32)
        cam = getattr(shot, "cam", None) or {}
        self.z0, self.z1 = cam.get("zoom", (1.02, 1.08))
        self.pan = np.array(cam.get("pan", (-18, -6)), np.float32)
        self.par = cam.get("par", 0.025)
        self.off = np.array(cam.get("offset", (0, 0)), np.float32)
        fx, fy = cam.get("focus", (0.5, 0.5))
        self.c = np.array([W * fx, H * fy], np.float32)
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        self.xx, self.yy = xx, yy
        self.dur = shot.dur

    def _u(self, t):
        u = t / max(self.dur, 1e-6)
        return 0.15 * u + 0.85 * vfx.ease(u)

    def params(self, t):
        u = self._u(t)
        return self.z0 + (self.z1 - self.z0) * u, self.pan * u + self.off, u

    def map_pt(self, x, y, t):
        z, pan, u = self.params(t)
        return (x - self.c[0]) * z + self.c[0] + pan[0], (y - self.c[1]) * z + self.c[1] + pan[1]

    def crop_at(self, t):
        z, pan, u = self.params(t)
        # equivalent crop (x, y, w) in 1920-wide frame coords, for kf()-style mapping
        w = W / z
        return np.array([self.c[0] - self.c[0] / z - pan[0] / z, self.c[1] - self.c[1] / z - pan[1] / z, w])

    def get(self, t):
        z, pan, u = self.params(t)
        dz = 1 + self.par * u * (self.depth - 0.35) * 2      # near layers dolly faster than far ones
        zz = z * dz
        mx = (self.xx - pan[0] * (0.8 + 0.4 * self.depth) - self.c[0]) / zz + self.c[0]
        my = (self.yy - pan[1] * (0.8 + 0.4 * self.depth) - self.c[1]) / zz + self.c[1]
        return cv2.remap(self.img, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


# Shots that stay as living paintings even when a clip exists (beat-locked blinks, the fresh-ink reveal)
REVERSE = {"16"}          # clips generated with the colour change running the wrong way
PREFER_PAINTING = {"8a", "8b", "35", "45", "17", "24"}


def make_source(shot):
    clip = os.path.join(CLIPS, f"{shot.id}.mp4")
    if os.path.exists(clip) and shot.id not in PREFER_PAINTING:
        return ClipSource(clip, shot)
    if os.path.exists(os.path.join(FrameSource.FR, f"{shot.id}.jpg")) and shot.still[1] not in ("lcd_sink", "zoomout", "black", "photo"):
        return FrameSource(shot)
    if shot.still[0] == "PROC":
        return fx_shots.ProcSource(shot)
    return StillSource(shot)


# ----------------------------------------------------------------------------- render

class Ctx:
    pass


def render_frame(shot, src, f, preview=False):
    t = f / FPS - (PRE + shot.start)   # local time
    ctx = Ctx()
    ctx.t, ctx.Tn, ctx.shot, ctx.f = t, shot.start + t, shot, f
    ctx.T = shots_mod.to_old(ctx.Tn)   # effects are keyed to the original recording's timeline
    ctx.dur = shot.dur
    fx_shots.pre(shot, src, max(t, 0.0))
    ctx.plate = src.get(max(t, 0.0))
    ctx.L = vfx.Light()
    ctx.fin = dict(glow_amt=1.0, grain=0.016, halate=0.28, exposure=1.0, fade=1.0, lift=0.0, vignette=True)
    ctx.clip = isinstance(src, (ClipSource, FrameSource))
    ctx.src = src
    fx_shots.apply(ctx)
    ctx.plate = np.asarray(ctx.plate, np.float32)
    return vfx.finish(ctx.plate, ctx.L.buf, f, **ctx.fin)


def render_shot(sid, preview=False):
    try:
        return _render_shot(sid, preview)
    except Exception:
        import traceback; traceback.print_exc()
        return sid, 0, -1.0


def _render_shot(sid, preview=False):
    shot = BY_ID[sid]
    f0, f1 = frame_range(shot)
    out = os.path.join(RENDER, f"{sid}.mp4")
    tmp = out + ".part.mp4"
    src = make_source(shot)
    enc = subprocess.Popen([FFMPEG, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                            "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "fast" if preview else "slow",
                            "-crf", "18" if preview else "12", "-pix_fmt", "yuv420p", "-x264-params", "keyint=24",
                            tmp], stdin=subprocess.PIPE)
    t0 = time.time()
    for f in range(f0, f1):
        img = render_frame(shot, src, f, preview)
        enc.stdin.write(img.tobytes())
    enc.stdin.close(); enc.wait()
    os.replace(tmp, out)
    return sid, f1 - f0, time.time() - t0


def concat(name):
    lst = os.path.join(RENDER, "list.txt")
    with open(lst, "w") as fh:
        for s in SHOTS:
            fh.write(f"file '{os.path.join(RENDER, s.id + '.mp4')}'\n")
    silent = os.path.join(OUT, f"{name}_video.mp4")
    subprocess.run([FFMPEG, "-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", silent], check=True)
    audio = os.path.join(GEN, "soundtrack.wav")
    final = os.path.join(OUT, f"{name}.mp4")
    subprocess.run([FFMPEG, "-v", "error", "-y", "-i", silent, "-i", audio, "-map", "0:v", "-map", "1:a",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-profile:v", "high",
                    "-level", "4.2", "-movflags", "+faststart", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
                    "-shortest", final], check=True)
    return final


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="*")
    ap.add_argument("--jobs", type=int, default=4)
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--concat", action="store_true")
    ap.add_argument("--name", default="v0")
    ap.add_argument("--still", nargs=2)
    a = ap.parse_args()
    if a.still:
        sid, t = a.still[0], float(a.still[1])
        shot = BY_ID[sid]; src = make_source(shot)
        f = int(round((PRE + shot.start + t) * FPS))
        img = render_frame(shot, src, f)
        p = os.path.join(GEN, "test", f"{sid}_{t:.2f}.jpg")
        os.makedirs(os.path.dirname(p), exist_ok=True)
        cv2.imwrite(p, cv2.cvtColor(img, cv2.COLOR_RGB2BGR), [cv2.IMWRITE_JPEG_QUALITY, 90])
        print(p); return
    if a.concat:
        print(concat(a.name)); return
    ids = a.ids or [s.id for s in SHOTS]
    # longest first for better packing
    ids.sort(key=lambda i: -BY_ID[i].dur)
    t0 = time.time()
    with Pool(a.jobs) as p:
        for sid, n, dt in p.starmap(render_shot, [(i, a.preview) for i in ids]):
            print(f"{sid:>5}: {n} frames in {dt:.0f}s ({dt / max(n, 1) * 1000:.0f} ms/f)", flush=True)
    print("total", time.time() - t0)


if __name__ == "__main__":
    cv2.setNumThreads(1)
    main()
