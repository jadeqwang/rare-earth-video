"""Delivery encodes from the rendered master.

  python3 pipeline/deliver.py out/rare-earth-master.mp4

writes
  out/rare-earth-1080p.mp4       H.264 High, 2-pass, sized to stay under GitHub's 100 MB limit
  out/rare-earth-1080p-sfx.mp4   same picture, song + the sound-design stem (work/audio/song_sfx.wav)
  out/rare-earth-teaser.mp4      0 - 42.63 s (hook through verse 2), picture and sound faded out

The master's picture is never re-rendered here; the song is muxed from the original mp3.
"""
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SONG = os.path.join(ROOT, "Rare Earth (Jade vocals re-added).mp3")
SFX_MIX = os.path.join(ROOT, "work", "audio", "song_sfx.wav")
OUT = os.path.join(ROOT, "out")
TARGET_MB = 94.0
AUDIO_KBPS = 256
TEASER_END = 42.632      # the downbeat where the broadcast leaves Earth
TEASER_FADE = 1.2


def run(cmd):
    print(" ".join(cmd[:12]), "..." if len(cmd) > 12 else "")
    subprocess.run(cmd, check=True)


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", path],
                       capture_output=True, text=True, check=True)
    return float(r.stdout.strip())


def x264_2pass(src, dst, kbps, extra_in=(), vf=None, af=None, audio=SONG, t=None):
    log = os.path.join(OUT, "x264_2pass")
    common = ["-map", "0:v", "-c:v", "libx264", "-preset", "slow", "-profile:v", "high", "-level", "4.1",
              "-pix_fmt", "yuv420p", "-b:v", f"{kbps}k", "-maxrate", f"{int(kbps * 2.2)}k", "-bufsize", f"{int(kbps * 4)}k",
              "-x264-params", "aq-mode=3:psy-rd=1.0,0.15", "-passlogfile", log]
    if vf:
        common += ["-vf", vf]
    dur = ["-t", str(t)] if t else []
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, *dur, *common, "-pass", "1", "-an", "-f", "mp4", os.devnull])
    aflt = ["-af", af] if af else []
    run(["ffmpeg", "-loglevel", "error", "-y", "-i", src, *extra_in, "-i", audio, *dur, *common, "-pass", "2",
         "-map", "1:a", "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", *aflt, "-shortest", "-movflags", "+faststart", dst])
    for f in os.listdir(OUT):
        if f.startswith("x264_2pass"):
            os.remove(os.path.join(OUT, f))


def main():
    master = sys.argv[1] if len(sys.argv) > 1 else os.path.join(OUT, "rare-earth-master.mp4")
    os.makedirs(OUT, exist_ok=True)
    d = duration(master)
    kbps = int(TARGET_MB * 8 * 1000 / d - AUDIO_KBPS - 40)   # 40 kbps container headroom
    print(f"master {d:.2f}s -> video {kbps} kbps")

    full = os.path.join(OUT, "rare-earth-1080p.mp4")
    x264_2pass(master, full, kbps)

    # sound-design variant: same encoded picture, different audio (no second video encode)
    if os.path.exists(SFX_MIX):
        run(["ffmpeg", "-loglevel", "error", "-y", "-i", full, "-i", SFX_MIX, "-map", "0:v", "-map", "1:a",
             "-c:v", "copy", "-c:a", "aac", "-b:a", f"{AUDIO_KBPS}k", "-shortest", "-movflags", "+faststart",
             os.path.join(OUT, "rare-earth-1080p-sfx.mp4")])

    # teaser: higher bitrate is affordable for 42 s
    f0 = TEASER_END - TEASER_FADE
    x264_2pass(master, os.path.join(OUT, "rare-earth-teaser.mp4"), 12000, t=TEASER_END,
               vf=f"fade=t=out:st={f0}:d={TEASER_FADE}", af=f"afade=t=out:st={f0}:d={TEASER_FADE}")

    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        if f.endswith(".mp4"):
            print(f"{f:32s} {os.path.getsize(p) / 1e6:7.1f} MB  {duration(p):7.2f}s")


if __name__ == "__main__":
    main()
