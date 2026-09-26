"""Shot 17: per-frame homography of the book/rug plane (frame 0 -> frame t) and scribble timing in the clip."""
import json, subprocess, numpy as np, cv2
p = "../gen/clips/17.mp4"
o = subprocess.run(["ffmpeg", "-v", "error", "-i", p, "-vf", "scale=1920:1080", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"], capture_output=True).stdout
F = np.frombuffer(o, np.uint8).reshape(-1, 1080, 1920, 3)
g0 = cv2.cvtColor(F[0], cv2.COLOR_RGB2GRAY)
orb = cv2.ORB_create(6000)
def skin(f):  # mask out the hand/arm (skin + grey sleeve are the moving parts): keep rug + paper
    hsv = cv2.cvtColor(f, cv2.COLOR_RGB2HSV)
    m = ((hsv[..., 0] < 25) & (hsv[..., 1] > 40) & (hsv[..., 1] < 150) & (hsv[..., 2] > 120)) | ((hsv[..., 1] < 30) & (hsv[..., 2] < 170) & (hsv[..., 2] > 60))
    m = cv2.dilate(m.astype(np.uint8), np.ones((31, 31), np.uint8))
    return (1 - m).astype(np.uint8) * 255
k0, d0 = orb.detectAndCompute(g0, skin(F[0]))
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
Hs = []
for i in range(len(F)):
    g = cv2.cvtColor(F[i], cv2.COLOR_RGB2GRAY)
    k, d = orb.detectAndCompute(g, skin(F[i]))
    m = sorted(bf.match(d0, d), key=lambda x: x.distance)[:1500]
    a = np.float32([k0[x.queryIdx].pt for x in m]); b = np.float32([k[x.trainIdx].pt for x in m])
    H, inl = cv2.findHomography(a, b, cv2.RANSAC, 3.0)
    Hs.append(H.tolist())
# scribble: dark grey strokes appearing on the right page (in frame-0 coords, warp each frame back)
region = (900, 250, 1400, 750)
base = None; act = []
for i in range(len(F)):
    Hi = np.linalg.inv(np.array(Hs[i]))
    w = cv2.warpPerspective(F[i], Hi, (1920, 1080))
    x0, y0, x1, y1 = region
    r = w[y0:y1, x0:x1].astype(np.float32).mean(2)
    if base is None: base = r
    dark = ((base - r) > 35)
    act.append(float(dark.mean()))
act = np.array(act)
on = int(np.argmax(act > 0.01)) if (act > 0.01).any() else -1
ys, xs = np.nonzero((base - cv2.warpPerspective(F[-1], np.linalg.inv(np.array(Hs[-1])), (1920, 1080))[250:750, 900:1400].astype(np.float32).mean(2)) > 35)
cen = (float(xs.mean() + 900), float(ys.mean() + 250)) if len(xs) else None
print("frames", len(F), "scribble onset frame", on, f"t={on/24:.2f}s", "dark frac per 0.5s:", [round(float(act[j]), 3) for j in range(0, len(act), 12)])
print("scribble centre (frame-0 coords)", cen, "bbox", (int(xs.min()+900), int(ys.min()+250), int(xs.max()+900), int(ys.max()+250)) if len(xs) else None)
print("H last", np.round(np.array(Hs[-1]), 3).tolist())
t = json.load(open("anchors_tracked.json")); t["17"] = {"H": Hs, "scribble_on": on / 24.0, "scribble_centre": cen}
json.dump(t, open("anchors_tracked.json", "w"))
