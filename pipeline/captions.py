"""Lyric captions (SRT) from the syllable-level timing, for platforms that take a caption file.

  python3 pipeline/captions.py [out/rare-earth.srt]

Each lyric line is shown from its first sung word until just after its last word ends
(held for up to 1.2 s, never overlapping the next line). The censored word in verse 3 is
captioned as "(     )", the way the film shows it.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def ts(t):
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "out", "rare-earth.srt")
    d = json.load(open(os.path.join(ROOT, "renderer", "assets", "timing.json")))
    lines = sorted(d["lines"], key=lambda L: L["t0"])
    cues = []
    for i, L in enumerate(lines):
        a = L["t0"] - 0.08
        b = L["t1"] + 1.2
        if i + 1 < len(lines):
            b = min(b, lines[i + 1]["t0"] - 0.1)
        text = L["text"]
        if L["sec"] == "V3" and L["idx"] == 1:
            text = text.rstrip() + " (     )" if "(" not in text else text
        cues.append((a, b, text))
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        for n, (a, b, text) in enumerate(cues, 1):
            f.write(f"{n}\n{ts(a)} --> {ts(b)}\n{text}\n\n")
    print(f"{len(cues)} cues -> {out}")


if __name__ == "__main__":
    main()
