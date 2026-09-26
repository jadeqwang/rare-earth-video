"""Repair person masks that miss the face.

The multiclass selfie segmenter sometimes labels a face in profile (or a small face) as
background while keeping hair and clothes. The renderer uses the mask to decide where
the character is (stronger ink, cel bands vs. painted background) and the clean-plate
step uses it to protect the person, so a missing face shows up as a soft, washed face
or as smears. This adds the tracked face (landmark box from data.json, padded, as an
ellipse) into every frame's mask.

  python3 pipeline/maskfix.py P04 P05 A02

Idempotent (max with the same ellipse). Frames without a detection borrow the nearest
detected box within +/- 12 frames.
"""
import json
import os
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLATES = os.path.join(ROOT, "renderer", "assets", "plates")
PAD = 1.5          # ellipse radii = half box size * PAD
REACH = 12         # frames to look for a detection


def fix(pid):
    d = os.path.join(PLATES, pid)
    faces = json.load(open(os.path.join(d, "data.json")))["face"]
    boxes = [f.get("box") if f.get("found") else None for f in faces]
    n, changed = len(faces), 0
    for i in range(n):
        b = boxes[i]
        if b is None:
            near = [(abs(j - i), boxes[j]) for j in range(max(0, i - REACH), min(n, i + REACH + 1)) if boxes[j]]
            if not near:
                continue
            b = min(near)[1]
        p = os.path.join(d, f"m{i:05d}.png")
        if not os.path.exists(p):
            continue
        m = Image.open(p).convert("L")
        w, h = m.size
        cx, cy = (b[0] + b[2]) / 2 * w, (b[1] + b[3]) / 2 * h
        rx, ry = (b[2] - b[0]) / 2 * w * PAD, (b[3] - b[1]) / 2 * h * PAD
        e = Image.new("L", (w, h), 0)
        ImageDraw.Draw(e).ellipse([cx - rx, cy - ry, cx + rx, cy + ry], fill=255)
        e = e.filter(ImageFilter.GaussianBlur(1.5))
        out = np.maximum(np.asarray(m), np.asarray(e))
        if (out != np.asarray(m)).any():
            Image.fromarray(out).save(p)
            changed += 1
    print(f"{pid}: face added to {changed}/{n} masks")


if __name__ == "__main__":
    for pid in sys.argv[1:]:
        fix(pid)
