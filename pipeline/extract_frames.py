"""Re-extract the plate frames the renderer reads (renderer/assets/plates/<id>/f%05d.jpg).

The frames are derived from the committed Seedance plates in work/gen/plates/ and are not
checked in. Masks (m%05d.png, face-repaired by maskfix.py) and face tracks (data.json) are
committed, so this only needs ffmpeg (no MediaPipe). Uses the exact command process_plate.py
uses, so frame indices match the masks and face tracks. Plates listed in CLEAN then get their
background rebuilt by cleanplate.py.

  python3 pipeline/extract_frames.py            # all plates
  python3 pipeline/extract_frames.py P02 A07    # some plates
"""
import glob
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cleanplate  # noqa: E402

# plates whose background is rebuilt after extraction (see cleanplate.py)
CLEAN = {"P05": {"pct": 6.0}}
SRC = os.path.join(ROOT, "work", "gen", "plates")
DST = os.path.join(ROOT, "renderer", "assets", "plates")


def source(pid):
    hits = sorted(glob.glob(os.path.join(SRC, f"{pid}_*.mp4")))
    if not hits:
        raise SystemExit(f"no source video for {pid} in {SRC}")
    return hits[-1]


def extract(pid):
    out = os.path.join(DST, pid)
    os.makedirs(out, exist_ok=True)
    for f in glob.glob(os.path.join(out, "f*.jpg")):
        os.remove(f)
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-i", source(pid), "-vf", "fps=24", "-q:v", "2",
                    "-start_number", "0", os.path.join(out, "f%05d.jpg")], check=True)
    n = len(glob.glob(os.path.join(out, "f*.jpg")))
    masks = len(glob.glob(os.path.join(out, "m*.png")))
    print(f"{pid}: {n} frames ({masks} masks)")
    if pid in CLEAN:
        cleanplate.clean(pid, **CLEAN[pid])


def main():
    ids = sys.argv[1:] or sorted(d for d in os.listdir(DST) if os.path.isdir(os.path.join(DST, d)))
    for pid in ids:
        extract(pid)


if __name__ == "__main__":
    main()
