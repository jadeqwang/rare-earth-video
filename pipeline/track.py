"""Track anchor points through generated clips (pyramidal Lucas-Kanade) so overlays stay locked to moving objects.

  python3 track.py [ids...]   -> writes anchors_tracked.json: {shot: {name: [[t, x, y], ...]}}

Point anchors come from anchors.json (frame-0 positions in 1920x1080). The track is sampled at 24 fps in
shot-local time, through the same ClipSource the renderer uses (so retiming/freeze are respected).
"""
import json, os, sys
import numpy as np
import cv2

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from shots import BY_ID, SHOTS
import render

FPS = 24
LK = dict(winSize=(41, 41), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01))


def track_shot(sid, anchors):
    shot = BY_ID[sid]
    clip = os.path.join(render.CLIPS, f"{sid}.mp4")
    if not os.path.exists(clip):
        return None
    src = render.ClipSource(clip, shot)
    names = [k for k, v in anchors.items() if isinstance(v, list) and len(v) == 2 and not isinstance(v[0], list)]
    if not names:
        return None
    pts = np.array([anchors[k] for k in names], np.float32).reshape(-1, 1, 2)
    out = {k: [] for k in names}
    prev = None
    n = int(round(shot.dur * FPS)) + 1
    for i in range(n):
        t = i / FPS
        g = cv2.cvtColor((src.get(t) * 255).astype(np.uint8), cv2.COLOR_RGB2GRAY)
        if prev is not None:
            nxt, st, err = cv2.calcOpticalFlowPyrLK(prev, g, pts, None, **LK)
            # backward check; hold position where tracking is unreliable
            back, st2, _ = cv2.calcOpticalFlowPyrLK(g, prev, nxt, None, **LK)
            fb = np.linalg.norm((back - pts).reshape(-1, 2), axis=1)
            ok = (st.reshape(-1) == 1) & (st2.reshape(-1) == 1) & (fb < 2.0)
            pts = np.where(ok[:, None, None], nxt, pts)
        for j, k in enumerate(names):
            out[k].append([round(t, 4), round(float(pts[j, 0, 0]), 1), round(float(pts[j, 0, 1]), 1)])
        prev = g
    return out


def main():
    base = json.load(open(os.path.join(HERE, "anchors.json")))
    path = os.path.join(HERE, "anchors_tracked.json")
    tracked = json.load(open(path)) if os.path.exists(path) else {}
    ids = sys.argv[1:] or [s.id for s in SHOTS if s.id in base]
    for sid in ids:
        if sid not in base:
            continue
        r = track_shot(sid, base[sid])
        if r:
            tracked[sid] = r
            print(sid, {k: (v[0][1:], v[-1][1:]) for k, v in r.items()})
    json.dump(tracked, open(path, "w"))


if __name__ == "__main__":
    main()
