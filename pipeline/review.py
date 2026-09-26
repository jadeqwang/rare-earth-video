"""Review sheets for a rendered film: time-stamped contact sheets and a flash check.

  python3 pipeline/review.py film.mp4 out_dir [--fps 4] [--span 12] [--w 320]

Writes out_dir/sheet_<t0>.jpg (one sheet per `span` seconds, `fps` frames per second, each
thumbnail labelled with its song time) and prints a photosensitivity check: large-area
luminance flashes per second (the WCAG / Harding threshold is 3 per second).
"""
import argparse
import os
import subprocess

import numpy as np
from PIL import Image, ImageDraw, ImageFont


def frames(path, fps, w):
    h = w * 9 // 16
    cmd = ["ffmpeg", "-loglevel", "error", "-i", path, "-vf", f"fps={fps},scale={w}:{h}", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = w * h * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)


def flash_check(path):
    """Count opposing luminance swings of >= 20% (of full scale) covering > 25% of the frame."""
    lum = []
    for f in frames(path, 24, 160):
        lum.append(f.astype(np.float32).mean(axis=2) / 255.0)
    lum = np.stack(lum)
    d = np.diff(lum, axis=0)
    area_up = (d > 0.2).mean(axis=(1, 2))
    area_dn = (d < -0.2).mean(axis=(1, 2))
    ev = np.where(area_up > 0.25, 1, np.where(area_dn > 0.25, -1, 0))
    # a flash = a pair of opposing transitions; count transitions per 1 s window
    worst = []
    for i in range(0, len(ev) - 24, 6):
        w = ev[i:i + 24]
        nz = w[w != 0]
        flips = int(np.sum(nz[1:] != nz[:-1])) + (1 if len(nz) else 0)
        worst.append((flips // 2, i / 24))
    worst.sort(reverse=True)
    return worst[:8]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("film")
    ap.add_argument("out")
    ap.add_argument("--fps", type=float, default=4)
    ap.add_argument("--span", type=float, default=12)
    ap.add_argument("--w", type=int, default=320)
    ap.add_argument("--cols", type=int, default=8)
    ap.add_argument("--no-flash", action="store_true")
    ap.add_argument("--t0", type=float, default=0.0, help="song time of the file's first frame (for segments)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    per = int(a.fps * a.span)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    buf, k = [], 0

    def flush(buf, k):
        if not buf:
            return
        h = buf[0].shape[0]
        rows = (len(buf) + a.cols - 1) // a.cols
        sheet = Image.new("RGB", (a.cols * a.w, rows * h), (20, 20, 20))
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(buf):
            x, y = (i % a.cols) * a.w, (i // a.cols) * h
            sheet.paste(Image.fromarray(f), (x, y))
            t = a.t0 + (k * per + i) / a.fps
            d.rectangle([x, y, x + 58, y + 16], fill=(0, 0, 0))
            d.text((x + 3, y + 1), f"{t:6.2f}", fill=(255, 220, 90), font=font)
        sheet.save(os.path.join(a.out, f"sheet_{a.t0 + k * a.span:06.1f}.jpg"), quality=85)

    for f in frames(a.film, a.fps, a.w):
        buf.append(f)
        if len(buf) == per:
            flush(buf, k)
            buf, k = [], k + 1
    flush(buf, k)
    if not a.no_flash:
        print("flash check (flashes/s, window start):", flash_check(a.film))


if __name__ == "__main__":
    main()
