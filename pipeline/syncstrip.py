#!/usr/bin/env python3
"""Lip-sync check on the FINAL render: a filmstrip of the singer's mouth region (every 2nd frame = the drawing rate)
with the isolated-vocal envelope and the sung word onsets drawn under each row, so sync can be judged by eye.

usage: python3 pipeline/syncstrip.py work/frames_v1 SHOT t0 t1 x y w h [out.jpg]
  (x, y, w, h) = crop box in output pixels (1920x1080); t0/t1 in song seconds.
"""
import json, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FPS = 24


def main():
    frames, shot = sys.argv[1], sys.argv[2]
    t0, t1 = float(sys.argv[3]), float(sys.argv[4])
    x, y, w, h = (int(v) for v in sys.argv[5:9])
    out = sys.argv[9] if len(sys.argv) > 9 else f"{ROOT}/work/sync/{shot}.jpg"
    os.makedirs(os.path.dirname(out), exist_ok=True)
    A = json.load(open(f"{ROOT}/render/assets/audio.json"))
    T = json.load(open(f"{ROOT}/render/assets/timing.json"))
    words = [(wd["t0"], wd.get("w") or wd.get("text", "")) for l in T["lines"] for wd in l["words"]]
    voc = A["vocal"]
    per_row, cw = 12, 150                      # 12 drawings = 1 s per row
    ch = int(cw * h / w)
    f0, f1 = int(t0 * FPS), int(t1 * FPS)
    fl = list(range(f0 - f0 % 2, f1, 2))
    rows = (len(fl) + per_row - 1) // per_row
    env_h = 70
    S = Image.new("RGB", (per_row * cw, rows * (ch + env_h + 8)), (10, 12, 20))
    d = ImageDraw.Draw(S)
    for i, f in enumerate(fl):
        p = f"{frames}/f{f:05d}.jpg"
        r, c = divmod(i, per_row)
        ox, oy = c * cw, r * (ch + env_h + 8)
        if os.path.exists(p):
            im = Image.open(p).crop((x, y, x + w, y + h)).resize((cw, ch))
            S.paste(im, (ox, oy))
        d.text((ox + 3, oy + 2), f"{f / FPS:.2f}", fill=(255, 220, 90))
    # envelope per row, aligned to the frames above it
    for r in range(rows):
        oy = r * (ch + env_h + 8) + ch + 4
        ta = fl[r * per_row] / FPS
        tb = ta + per_row * 2 / FPS
        pts = []
        for k in range(per_row * cw):
            tt = ta + (tb - ta) * k / (per_row * cw)
            fi = min(len(voc) - 1, max(0, int(tt * A["fps"])))
            pts.append((k, oy + env_h - voc[fi] * (env_h - 6)))
        d.line(pts, fill=(142, 203, 255), width=2)
        for (wt, wtxt) in words:
            if ta <= wt < tb:
                wx = int((wt - ta) / (tb - ta) * per_row * cw)
                d.line([(wx, oy), (wx, oy + env_h)], fill=(255, 150, 90), width=1)
                d.text((wx + 3, oy + 2), wtxt, fill=(255, 180, 120))
    S.save(out, quality=88)
    print(out, S.size)


if __name__ == "__main__":
    main()
