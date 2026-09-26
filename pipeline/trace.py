"""Rotoscope tracer: turns a Seedance plate into per-frame vector data that the JS renderer redraws.

For each traced frame (on twos by default) it writes render/assets/plates/<pid>/fNNNN.json:
  {"w":W,"h":H,                        # tracing grid (2x the plate)
   "regions":[[label, [x0,y0,x1,y1,...], ...holes...], ...],   # flat colour regions (outer ring then holes)
   "lines":[[x0,y0,...], ...],        # ink line shapes (filled polygons, even-odd)
   "key":[[x0,y0,...], ...]}          # silhouette of everything that is NOT keyed background (for rim light / occlusion)
and render/assets/plates/<pid>/meta.json with the colour model (label -> source RGB), fps, frame list, key colour.

usage: python3 pipeline/trace.py P02_care work/plates/raw/P02_care_t0.mp4 [--every 2] [--key auto|none|#rrggbb] [--k 14]
"""
import argparse, json, os, sys
import numpy as np, cv2

ROOT = "/home/user/rare-earth-video"


def read_frames(path):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    frames = []
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        frames.append(fr)
    return frames, fps


HUEW = 1.7  # weight on a/b so hue differences beat lightness differences when clustering


def to_lab(bgr):
    return cv2.cvtColor(bgr, cv2.COLOR_BGR2LAB).astype(np.float32)


def to_labw(bgr):
    lab = to_lab(bgr)
    lab[..., 1:] = (lab[..., 1:] - 128.0) * HUEW + 128.0
    return lab


def unweight(c):
    c = c.copy()
    c[..., 1:] = (c[..., 1:] - 128.0) / HUEW + 128.0
    return c


def auto_key(frames):
    """Key colour = median of the frame border if the border is flat (low variance)."""
    f = frames[0]
    h, w = f.shape[:2]
    b = np.concatenate([f[:h // 12].reshape(-1, 3), f[:, :w // 20].reshape(-1, 3), f[:, -w // 20:].reshape(-1, 3)])
    lab = to_lab(b.reshape(-1, 1, 3)).reshape(-1, 3)
    med = np.median(lab, axis=0)
    spread = np.median(np.linalg.norm(lab - med, axis=1))
    return med, spread


def key_mask(bgr, key_lab, tol=14.0, soft=8.0):
    lab = to_lab(cv2.GaussianBlur(bgr, (3, 3), 0))
    d = np.linalg.norm(lab - key_lab[None, None, :], axis=2)
    m = np.clip((d - tol) / soft, 0, 1)  # 1 = foreground
    return m


def xdog(gray, sigma=1.1, k=1.6, p=22.0, eps=0.018, phi=14.0):
    g1 = cv2.GaussianBlur(gray, (0, 0), sigma)
    g2 = cv2.GaussianBlur(gray, (0, 0), sigma * k)
    d = (1 + p) * g1 - p * g2
    return np.where(d >= eps, 1.0, 1.0 + np.tanh(phi * (d - eps)))


def polys_from_mask(mask, eps=0.9, min_area=10.0):
    """Binary mask -> list of [outer, hole, hole...] rings as flat int lists (even-odd fill)."""
    cnts, hier = cv2.findContours(mask.astype(np.uint8), cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    out = []
    if hier is None:
        return out
    hier = hier[0]
    for i, c in enumerate(cnts):
        if hier[i][3] != -1:
            continue  # holes are attached to their parent
        if cv2.contourArea(c) < min_area:
            continue
        rings = [c]
        ch = hier[i][2]
        while ch != -1:
            if cv2.contourArea(cnts[ch]) >= min_area * 0.5:
                rings.append(cnts[ch])
            ch = hier[ch][0]
        group = []
        for r in rings:
            a = cv2.approxPolyDP(r, eps, True).reshape(-1, 2)
            if len(a) >= 3:
                group.append(a.astype(np.int32).flatten().tolist())
        if group:
            out.append(group)
    return out


def build_palette(frames, fg_masks, k, scale):
    samp = []
    idx = np.linspace(0, len(frames) - 1, min(8, len(frames))).astype(int)
    for i in idx:
        f = cv2.resize(frames[i], None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
        f = cv2.medianBlur(f, 3)
        m = cv2.resize(fg_masks[i], (f.shape[1], f.shape[0])) > 0.5 if fg_masks[i] is not None else np.ones(f.shape[:2], bool)
        lab = to_labw(f)[m]
        samp.append(lab[np.random.default_rng(i).choice(len(lab), min(len(lab), 20000), replace=False)])
    X = np.concatenate(samp).astype(np.float32)
    crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 50, 0.3)
    _, lbl, cen = cv2.kmeans(X, k, None, crit, 4, cv2.KMEANS_PP_CENTERS)
    # merge near-duplicate centres (dE < 6)
    keep = []
    for c in cen:
        if all(np.linalg.norm(c - q) > 6 for q in keep):
            keep.append(c)
    return np.array(keep, np.float32)


def assign(frame_bgr, centers, scale):
    f = cv2.resize(frame_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    f = cv2.bilateralFilter(f, 7, 30, 5)
    lab = to_labw(f)
    d = ((lab[:, :, None, :] - centers[None, None, :, :]) ** 2).sum(-1)
    lab_idx = d.argmin(-1).astype(np.uint8)
    lab_idx = cv2.medianBlur(cv2.medianBlur(lab_idx, 5), 5)
    return lab_idx, f


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pid")
    ap.add_argument("video")
    ap.add_argument("--every", type=int, default=2)
    ap.add_argument("--key", default="auto")
    ap.add_argument("--keypt", default=None, help="x,y normalized point in frame 0 to sample the key colour")
    ap.add_argument("--k", type=int, default=14)
    ap.add_argument("--scale", type=float, default=1.5)
    ap.add_argument("--tol", type=float, default=16.0)
    ap.add_argument("--out", default=None)
    ap.add_argument("--start", type=int, default=0)
    ap.add_argument("--end", type=int, default=10 ** 9)
    a = ap.parse_args()

    frames, fps = read_frames(a.video)
    H0, W0 = frames[0].shape[:2]
    S = a.scale
    out = a.out or f"{ROOT}/render/assets/plates/{a.pid}"
    os.makedirs(out, exist_ok=True)

    key_lab = None
    if a.keypt:
        kx, ky = map(float, a.keypt.split(","))
        f0 = frames[0]
        px, py = int(kx * (W0 - 1)), int(ky * (H0 - 1))
        patch = f0[max(0, py - 6):py + 7, max(0, px - 6):px + 7].reshape(-1, 1, 3)
        key_lab = np.median(to_lab(patch).reshape(-1, 3), axis=0)
    elif a.key == "auto":
        med, spread = auto_key(frames)
        if spread < 6.0:
            key_lab = med
    elif a.key.startswith("#"):
        h = a.key[1:]
        rgb = np.array([[[int(h[4:6], 16), int(h[2:4], 16), int(h[0:2], 16)]]], np.uint8)
        key_lab = to_lab(rgb).reshape(3)

    fg = [key_mask(f, key_lab, a.tol) if key_lab is not None else None for f in frames]
    centers = build_palette(frames, fg, a.k, S)
    cen_rgb = cv2.cvtColor(unweight(centers).reshape(1, -1, 3).clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(-1, 3)

    idx = [i for i in range(len(frames)) if i % a.every == 0 and a.start <= i < a.end]
    for i in idx:
        fr = frames[i]
        labels, big = assign(fr, centers, S)
        h, w = labels.shape
        if fg[i] is not None:
            m = cv2.resize(fg[i], (w, h), interpolation=cv2.INTER_LINEAR)
            m = cv2.GaussianBlur(m, (0, 0), 1.2) > 0.5
            m = cv2.morphologyEx(m.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8)).astype(bool)
        else:
            m = np.ones((h, w), bool)
        regions = []
        for L in range(len(centers)):
            mask = (labels == L) & m
            if mask.sum() < 30:
                continue
            mask = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, np.ones((3, 3), np.uint8))
            for grp in polys_from_mask(mask, eps=0.9 * S, min_area=30 * S * S):
                regions.append([L] + grp)
        gray = cv2.cvtColor(big, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
        ink = xdog(gray, sigma=0.75 * S) < 0.5
        ink &= cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
        ink = cv2.morphologyEx(ink.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
        lines = [g for g in polys_from_mask(ink, eps=0.6 * S, min_area=14 * S)]
        keyp = polys_from_mask(m, eps=1.0 * S, min_area=200 * S) if fg[i] is not None else []
        json.dump({"w": w, "h": h, "regions": regions, "lines": lines, "key": keyp},
                  open(f"{out}/f{i:04d}.json", "w"), separators=(",", ":"))
        print(f"\r{a.pid} {i}/{len(frames)} regions={len(regions)} lines={len(lines)}", end="", flush=True)
    meta = {"pid": a.pid, "fps": fps, "n": len(frames), "every": a.every, "frames": idx, "w": int(W0 * S), "h": int(H0 * S),
            "src": [W0, H0], "colors": cen_rgb.tolist(), "key": None if key_lab is None else
            cv2.cvtColor(key_lab.reshape(1, 1, 3).clip(0, 255).astype(np.uint8), cv2.COLOR_LAB2RGB).reshape(3).tolist(),
            "video": os.path.relpath(a.video, ROOT)}
    json.dump(meta, open(f"{out}/meta.json", "w"), indent=1)
    print(f"\n{a.pid}: {len(idx)} frames, {len(centers)} colours, key={meta['key']}")


if __name__ == "__main__":
    main()
