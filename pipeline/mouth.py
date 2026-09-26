"""Per-frame mouth openness from a video via MediaPipe FaceLandmarker.

mouth_track(video) -> dict(fps, t[], open[], jaw[], found[])
open = inner-lip gap / inter-ocular distance; jaw = blendshape jawOpen.
"""
import cv2, numpy as np, mediapipe as mp, os
from mediapipe.tasks import python as mpt
from mediapipe.tasks.python import vision

MODEL = os.path.join(os.path.dirname(__file__), "..", "work", "models", "face_landmarker.task")


def mouth_track(path, max_faces=1):
    opts = vision.FaceLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=MODEL),
        running_mode=vision.RunningMode.VIDEO, num_faces=max_faces,
        output_face_blendshapes=True, min_face_detection_confidence=0.3,
        min_face_presence_confidence=0.3, min_tracking_confidence=0.3)
    lm = vision.FaceLandmarker.create_from_options(opts)
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 24
    out = {"fps": fps, "t": [], "open": [], "jaw": [], "found": [], "box": []}
    i = 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)
        res = lm.detect_for_video(mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), int(i * 1000 / fps))
        t = i / fps
        if res.face_landmarks:
            p = res.face_landmarks[0]
            P = lambda k: np.array([p[k].x * fr.shape[1], p[k].y * fr.shape[0]])
            iod = np.linalg.norm(P(33) - P(263)) + 1e-6
            gap = np.linalg.norm(P(13) - P(14)) / iod
            jaw = next((b.score for b in res.face_blendshapes[0] if b.category_name == "jawOpen"), 0.0)
            xs = [q.x for q in p]; ys = [q.y for q in p]
            out["box"].append([min(xs), min(ys), max(xs), max(ys)])
            out["open"].append(float(gap)); out["jaw"].append(float(jaw)); out["found"].append(1)
        else:
            out["open"].append(np.nan); out["jaw"].append(np.nan); out["found"].append(0); out["box"].append(None)
        out["t"].append(t)
        i += 1
    lm.close()
    return out
