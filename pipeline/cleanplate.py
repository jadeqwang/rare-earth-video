"""Clean plate: remove transient elements from a locked-off plate's background.

Seedance gave the pre-dawn rooftop plate (P05) large cartoon breath-clouds that drift
across the sky. The camera is locked off, so the background can be rebuilt from the clip
itself: for every pixel, take the frame at a low luminance percentile among the frames where
that pixel is background (clouds only ever brighten the sky), then composite the person
back over it with the segmentation mask.

  python3 pipeline/cleanplate.py P05 [--pct 6]

Rewrites renderer/assets/plates/<id>/f*.jpg in place (run after extract_frames.py, which
calls it for the plates listed in CLEAN there).
"""
import argparse
import glob
import os

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PLATES = os.path.join(ROOT, "renderer", "assets", "plates")


def clean(pid, pct=6.0, strip=72, keep=10):
    d = os.path.join(PLATES, pid)
    fs = sorted(glob.glob(os.path.join(d, "f*.jpg")))
    ms = [os.path.join(d, "m" + os.path.basename(f)[1:-4] + ".png") for f in fs]
    n = len(fs)
    W, H = Image.open(fs[0]).size
    frames = np.stack([np.asarray(Image.open(f).convert("RGB")) for f in fs])          # n,H,W,3 uint8
    # The person mask is soft around a profile face and loose hair, so work with generous
    # margins: estimate the sky only from pixels well clear of her, and keep the original
    # frame within `keep` px of her (a wisp right at the lips may stay; the drifting clouds go).
    # (dilations run on the half-resolution masks, then upsample)
    masks, near = [], []
    for m in ms:
        mk = np.asarray(Image.open(m).convert("L")).astype(np.float32) / 255.0
        hk = max(1, keep // 2)
        est = ndimage.maximum_filter(mk, size=2 * hk + 5)
        cmp_ = ndimage.gaussian_filter(ndimage.maximum_filter(mk, size=2 * hk + 1), hk / 3)
        masks.append(np.asarray(Image.fromarray((est * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)))
        near.append(np.asarray(Image.fromarray((cmp_ * 255).astype(np.uint8)).resize((W, H), Image.BILINEAR)))
    masks = np.stack(masks).astype(np.float32) / 255.0                                   # n,H,W  (estimation)
    near = np.stack(near).astype(np.float32) / 255.0                                     # n,H,W  (composite)
    bg = np.zeros((H, W, 3), np.uint8)
    open_sky = np.zeros((H, W), np.float32)   # fraction of the clip a pixel is clear background
    for y0 in range(0, H, strip):
        y1 = min(H, y0 + strip)
        fr = frames[:, y0:y1].astype(np.float32)
        lum = fr[..., 0] * 0.299 + fr[..., 1] * 0.587 + fr[..., 2] * 0.114                # n,h,W
        valid = masks[:, y0:y1] < 0.3
        lum = np.where(valid, lum, np.inf)
        order = np.argsort(lum, axis=0)
        cnt = valid.sum(axis=0)                                                          # h,W
        open_sky[y0:y1] = cnt / n
        k = np.clip((cnt * pct / 100.0).astype(np.int64), 0, n - 1)
        k = np.where(cnt > 0, k, 0)
        idx = np.take_along_axis(order, k[None], axis=0)[0]                              # h,W
        bg[y0:y1] = np.take_along_axis(frames[:, y0:y1], idx[None, ..., None].repeat(3, -1), axis=0)[0]
    bgf = bg.astype(np.float32)
    # only replace pixels that are open sky for (nearly) the whole clip; anywhere the person
    # ever moves through keeps its original pixels
    sky = np.clip((open_sky - 0.85) / 0.12, 0, 1)
    for i, f in enumerate(fs):
        m = 1 - (1 - np.clip(near[i] * 1.5, 0, 1)) * sky
        m = m[..., None]
        out = frames[i].astype(np.float32) * m + bgf * (1 - m)
        Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(f, quality=95)
    Image.fromarray(bg).save(os.path.join(d, "cleanbg.jpg"), quality=95)
    print(f"{pid}: cleaned {n} frames (background = {pct:.0f}th luminance percentile)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("ids", nargs="+")
    ap.add_argument("--pct", type=float, default=6.0)
    a = ap.parse_args()
    for pid in a.ids:
        clean(pid, a.pct)


if __name__ == "__main__":
    main()
