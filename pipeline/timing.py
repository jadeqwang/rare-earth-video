"""Build the master timing file (lyrics with word times, beats, sections) from Whisper + stem analysis."""
import json, numpy as np

W = json.load(open("work/audio/whisper_vox.json"))["result"]
words = [dict(w=w["word"].strip(), t0=w["start"], t1=w["end"]) for s in W["segments"] for w in s["words"]]

# Canonical lyric lines (display text). Word counts must match the Whisper words consumed for each line.
LINES = [
    ("V1", "Do you still care"), ("V1", "You're yearning to see the life out there"), ("V1", "Searching for me"),
    ("V1", "Are you still there"), ("V1", "A rare earth looking for a friend"),
    ("V2", "Lived my life on a pale blue dot"), ("V2", "Your signal here I think I've caught"),
    ("V2", "The beating blinking of a star"), ("V2", "A planet's transit is not that far from my own"),
    ("V2", "How could we be alone"),
    ("B", "Before they launch or self-destruct"), ("B", "Weapons, wars, and now we're ██████"),
    ("B", "Keep on looking, keep the faith"), ("B", "Keep up funding, our planet waits"),
    ("B", "for your transmission"), ("B", "Our science has a vision"),
    ("V4", "Do you still care"), ("V4", "You're yearning to see the life out there"), ("V4", "Searching for me"),
    ("V4", "Are you still there"), ("V4", "A rare earth looking for a friend"),
    ("V5", "Lived my life on a pale blue dot"), ("V5", "Your signal here I think I've caught"),
    ("V5", "The beating blinking of a star"), ("V5", "A planet's transit is not that far from my own"),
    ("V5", "How could we be alone"),
]
# Whisper heard "launch self-destruct" (no "or"): the sung line drops "or"; keep display text but map words.
SUNG = {("B", 0): "Before they launch self-destruct", ("B", 1): "Weapons, wars, and now we're",
        ("B", 2): "Keep on looking, keep the faith", ("B", 3): "keep up funding our planet Wait",
        ("B", 4): "for your transmission"}
# Phrase-onset fixes from the vocal-stem energy (Whisper stretches phrase-initial words early).
FIX = {(0, 0): 3.855, (5, 0): 19.551, (9, 0): 38.325, (10, 0): 57.899, (12, 0): 65.411, (15, 0): 76.44,
       (21, 0): 126.189, (25, 0): 144.869}

out, wi = [], 0
bcount = 0
for li, (sec, text) in enumerate(LINES):
    n_disp = len(text.replace("██████", "").split())
    key = (sec, bcount) if sec == "B" else None
    if sec == "B": bcount += 1
    sung = SUNG.get(key, text)
    n = len(sung.replace("-destruct", " -destruct").split()) if "self-destruct" in sung else len(sung.split())
    ws = words[wi:wi + n]; wi += n
    for k, fx in FIX.items():
        if k[0] == li: ws[k[1]]["t0"] = fx
    out.append(dict(sec=sec, text=text, t0=ws[0]["t0"], t1=ws[-1]["t1"], words=ws))
assert wi == len(words), (wi, len(words))
# Redaction gap
red = dict(t0=64.45, t1=65.40)
bm = json.load(open("work/audio/beatmap.json"))
sections = [
    dict(id="INTRO", t0=0.0, t1=3.85), dict(id="V1", t0=3.85, t1=17.2), dict(id="V2", t0=17.2, t1=41.4),
    dict(id="INST1", t0=41.4, t1=57.4), dict(id="BRIDGE", t0=57.4, t1=79.7), dict(id="V4", t0=79.7, t1=97.6),
    dict(id="INST2", t0=97.6, t1=111.0), dict(id="BREAK", t0=111.0, t1=126.0), dict(id="V5", t0=126.0, t1=147.1),
    dict(id="CLIMAX", t0=147.1, t1=161.3), dict(id="OUTRO", t0=161.3, t1=172.36),
]
json.dump(dict(duration=172.36, bpm_nominal=126.5, beats=bm["beats"], downbeat_phase=0, redaction=red,
               sections=sections, lines=out), open("work/timing.json", "w"), indent=1)
for l in out:
    print(f"{l['sec']:6s} {l['t0']:7.2f}-{l['t1']:7.2f}  {l['text']}")
