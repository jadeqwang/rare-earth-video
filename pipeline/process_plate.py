"""Turn a Seedance plate into renderer data.

    python3 process_plate.py <short_id> <plate.mp4> [--song T0] [--no-mask]

Writes renderer/assets/plates/<short_id>/:
    f00000.jpg ...   frames at 24 fps (plate resolution)
    m00000.png ...   person mask (half resolution), unless --no-mask
    data.json        per-frame face track (mouth centre/width/angle, eyes, skin tone)
and updates renderer/assets/plates/index.json. With --song T0 (song time of the plate's
reference-audio start) it also measures the lip-sync slip against the vocal stem.
"""
import argparse, json, os, subprocess, sys
import cv2, numpy as np, mediapipe as mp
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = os.path.join(ROOT, "work", "models")
OUTROOT = os.path.join(ROOT, "renderer", "assets", "plates")


def smooth_track(vals, found, k=2):
    vals = np.array(vals, dtype=float)
    out = vals.copy()
    idx = np.where(found)[0]
    if len(idx) == 0:
        return out
    # fill gaps by nearest valid, then moving average
    for i in range(len(vals)):
        if not found[i]:
            j = idx[np.argmin(np.abs(idx - i))]
            out[i] = vals[j]
    ker = np.ones(2 * k + 1) / (2 * k + 1)
    pad = np.pad(out, ((k, k),) + ((0, 0),) * (out.ndim - 1), mode="edge")
    if out.ndim == 1:
        return np.convolve(pad, ker, "valid")
    return np.stack([np.convolve(pad[:, c], ker, "valid") for c in range(out.shape[1])], 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sid"); ap.add_argument("mp4")
    ap.add_argument("--song", type=float, default=None)
    ap.add_argument("--no-mask", action="store_true")
    a = ap.parse_args()
    out = os.path.join(OUTROOT, a.sid)
    os.makedirs(out, exist_ok=True)
    for f in os.listdir(out):
        if f.endswith((".jpg", ".png")):
            os.remove(os.path.join(out, f))
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", a.mp4, "-vf", "fps=24", "-q:v", "2",
                    "-start_number", "0", os.path.join(out, "f%05d.jpg")], check=True)
    frames = sorted(f for f in os.listdir(out) if f.startswith("f") and f.endswith(".jpg"))
    first = cv2.imread(os.path.join(out, frames[0]))
    H, W = first.shape[:2]

    lm = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=os.path.join(MODELS, "face_landmarker.task")),
        running_mode=vision.RunningMode.VIDEO, num_faces=2, output_face_blendshapes=True,
        min_face_detection_confidence=0.3, min_face_presence_confidence=0.3, min_tracking_confidence=0.3))
    lm_img = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=os.path.join(MODELS, "face_landmarker.task")),
        running_mode=vision.RunningMode.IMAGE, num_faces=1, output_face_blendshapes=True,
        min_face_detection_confidence=0.2, min_face_presence_confidence=0.2))
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=os.path.join(MODELS, "pose_landmarker_full.task")),
        running_mode=vision.RunningMode.VIDEO, num_poses=3, min_pose_detection_confidence=0.3, min_tracking_confidence=0.3))
    seg = None
    if not a.no_mask:
        seg = vision.ImageSegmenter.create_from_options(vision.ImageSegmenterOptions(
            base_options=mpt.BaseOptions(model_asset_path=os.path.join(MODELS, "selfie_multiclass.tflite")),
            running_mode=vision.RunningMode.VIDEO, output_category_mask=True, output_confidence_masks=False))

    rows = []
    for i, fn in enumerate(frames):
        img = cv2.imread(os.path.join(out, fn))
        rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
        mimg = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        ts = int(i * 1000 / 24)
        r = lm.detect_for_video(mimg, ts)
        row = {"found": 0}
        faces = []
        cands = [(p, r.face_blendshapes[k] if r.face_blendshapes else []) for k, p in enumerate(r.face_landmarks or [])]
        if not cands:
            # stage 2: locate heads with the pose model, then run the face model on an upscaled crop
            pr = pose.detect_for_video(mimg, ts)
            for pl in (pr.pose_landmarks or []):
                hx = [pl[j].x for j in (0, 2, 5, 7, 8, 9, 10)]; hy = [pl[j].y for j in (0, 2, 5, 7, 8, 9, 10)]
                cx, cy = float(np.mean(hx)), float(np.mean(hy))
                span = max((max(hx) - min(hx)) * W, (max(hy) - min(hy)) * H, 24) * 2.6
                x0 = int(max(0, cx * W - span)); x1 = int(min(W, cx * W + span))
                y0 = int(max(0, cy * H - span * 1.05)); y1 = int(min(H, cy * H + span * 0.95))
                if x1 - x0 < 16 or y1 - y0 < 16:
                    continue
                crop = rgb[y0:y1, x0:x1]
                sc = 512.0 / max(crop.shape[:2])
                crop = cv2.resize(crop, (int(crop.shape[1] * sc), int(crop.shape[0] * sc)), interpolation=cv2.INTER_CUBIC)
                rr = lm_img.detect(mp.Image(image_format=mp.ImageFormat.SRGB, data=np.ascontiguousarray(crop)))
                for k2, p2 in enumerate(rr.face_landmarks or []):
                    cw, ch = crop.shape[1], crop.shape[0]
                    class Q:  # map crop-normalised landmark back to frame-normalised
                        __slots__ = ("x", "y")
                    mapped = []
                    for q in p2:
                        m = Q(); m.x = (x0 + q.x * cw / sc) / W; m.y = (y0 + q.y * ch / sc) / H; mapped.append(m)
                    cands.append((mapped, rr.face_blendshapes[k2] if rr.face_blendshapes else []))
        for k, (p, bsh) in enumerate(cands):
            P = lambda j: np.array([p[j].x, p[j].y])
            mc = (P(13) + P(14)) / 2
            left, right = P(61), P(291)
            mw = float(np.linalg.norm((right - left) * [W, H]) / W)
            ang = float(np.arctan2((right - left)[1] * H, (right - left)[0] * W))
            eyes = (P(33).tolist(), P(263).tolist())
            xs = [q.x for q in p]; ys = [q.y for q in p]
            jaw = next((b.score for b in bsh if b.category_name == "jawOpen"), 0.0)
            faces.append({"x": float(mc[0]), "y": float(mc[1]), "w": mw, "a": ang, "le": eyes[0], "re": eyes[1],
                          "box": [min(xs), min(ys), max(xs), max(ys)], "jaw": float(jaw),
                          "gap": float(np.linalg.norm((P(13) - P(14)) * [W, H]) / max(1e-6, np.linalg.norm((P(33) - P(263)) * [W, H])))})
        if faces:
            faces.sort(key=lambda f: -(f["box"][2] - f["box"][0]))  # largest face first
            row = {"found": 1, **faces[0], "others": faces[1:]}
        # skin tone + person mask
        if seg is not None:
            s = seg.segment_for_video(mimg, ts)
            cat = s.category_mask.numpy_view().reshape(H, W) if s.category_mask.numpy_view().ndim == 2 or True else None
            cat = np.asarray(cat)
            person = (cat != 0).astype(np.uint8) * 255
            person = cv2.GaussianBlur(person, (0, 0), 2.0)
            cv2.imwrite(os.path.join(out, "m" + fn[1:-4] + ".png"), cv2.resize(person, (W // 2, H // 2), interpolation=cv2.INTER_AREA))
            face_px = rgb[cat == 3]
            if len(face_px) > 50:
                row["skin"] = (np.median(face_px, axis=0) / 255.0).round(4).tolist()
        rows.append(row)
    lm.close(); lm_img.close(); pose.close()
    if seg:
        seg.close()

    found = np.array([r["found"] for r in rows], bool)
    if found.any():
        xy = smooth_track([[r.get("x", 0), r.get("y", 0)] for r in rows], found, 1)
        ww = smooth_track([r.get("w", 0) for r in rows], found, 2)
        aa = smooth_track([r.get("a", 0) for r in rows], found, 2)
        for i, r in enumerate(rows):
            r["sx"], r["sy"], r["sw"], r["sa"] = float(xy[i][0]), float(xy[i][1]), float(ww[i]), float(aa[i])
    skins = [r["skin"] for r in rows if "skin" in r]
    meta = {"fps": 24, "frames": len(frames), "w": W, "h": H, "mask": not a.no_mask,
            "skin": (np.median(np.array(skins), axis=0).round(4).tolist() if skins else None),
            "found_frac": float(found.mean())}
    if a.song is not None and found.sum() > 10:
        sys.path.insert(0, HERE)
        from syncscore import score
        mouth = {"t": [i / 24 for i in range(len(rows))], "open": [r.get("gap", np.nan) if r["found"] else np.nan for r in rows]}
        sc = score(mouth, a.song, max_shift=1.0)
        sc.pop("curve", None)
        meta["song_t0"] = a.song
        meta["sync"] = sc
    json.dump({"meta": meta, "face": rows}, open(os.path.join(out, "data.json"), "w"))
    idx_path = os.path.join(OUTROOT, "index.json")
    idx = json.load(open(idx_path)) if os.path.exists(idx_path) else {}
    idx[a.sid] = {k: v for k, v in meta.items()} | {"src": os.path.basename(a.mp4)}
    json.dump(idx, open(idx_path, "w"), indent=1)
    print(a.sid, json.dumps(meta))


if __name__ == "__main__":
    main()
