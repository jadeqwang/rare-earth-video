"""Seedance 2.5 plate specs. Each plate = first-frame keyframe + character refs (+ song slice for lip sync).

Times in `audio` are song seconds; the slice is passed as @Audio1 so performance timing follows the track.
Run: python3 plates.py [id ...]   (no ids = all)
"""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(__file__))
from gen import batch, as_data_uri

ROOT = "/home/user/rare-earth-video"
K = ROOT + "/work/gen/keys/"
R = ROOT + "/work/refs/"
OUT = ROOT + "/work/gen/plates"
SONG = ROOT + "/work/audio/song.mp3"
SHEETS = {"j11": R + "SHEET_jade2011.png", "j26": R + "SHEET_jade2026.png", "ch": R + "SHEET_charlie.png",
          "rk": R + "SHEET_ricky.png", "props": R + "SHEET_props.png"}
STYLE = " Anime style, keep every character exactly on-model with the reference sheets; clean line art; no text."
SING = "She sings the vocals of @Audio1 with precise lip sync on every word. "

PLATES = {
 "P01_stage11_v1": dict(key="k_stage11_v1-074403", refs=["j11"], audio=(3.4, 17.4), dur=14, prompt=SING +
   "[0-6s] eyes closed, swaying gently to the beat, microphone at her lips. [6-8s] she opens her eyes and looks straight into the lens. "
   "[8-14s] eyes half closed again, singing with feeling, free hand drifting up. Magenta and green spotlights sweep slowly through haze. "
   "Very slow push-in."),
 "P02_stage11_v4": dict(key="k_stage11_v4-074403", refs=["j11"], audio=(80.0, 94.0), dur=14, prompt=SING +
   "[0-6s] singing to camera. [6-8s] she turns her head to look toward the right edge of the frame. [8-10s] she reaches her free hand "
   "out toward the right edge. [10-14s] she smiles warmly, still singing. Static camera, spotlights pulse gently."),
 "P03_roof26_v4": dict(key="k_roof26_v4-074403", refs=["j26"], audio=(80.0, 94.0), dur=14, prompt=SING +
   "[0-6s] singing softly to camera, night breeze in loose strands of hair. [6-8s] she turns her head to look toward the left edge of the "
   "frame. [8-10s] she reaches her hand out toward the left edge. [10-14s] she smiles, still singing. Static camera, stars twinkle."),
 "P04_roof26_v2": dict(key="k_roof26_v2-073542", refs=["j26"], audio=(19.2, 24.2), dur=5, prompt=SING +
   "Looking up at the sky, she slowly brings thumb and index finger together as if pinching a tiny point of light, which glows softly "
   "pale blue between her fingers at the end. Slow push-in."),
 "P05_roof26_v5": dict(key="k_roof26_v5-073542", refs=["j26"], audio=(125.8, 133.8), dur=8, prompt=SING +
   "Quiet and intimate, eyes half closed, headphones on, breath visible in the cool dawn air, the horizon glow slowly brightening. "
   "Static camera."),
 "P06_band_outro": dict(key="k_band_wide-074403", refs=["j11", "ch", "rk"], audio=(146.8, 162.8), dur=16, prompt=
   "@Audio1 is the music. The band plays the big final chorus with huge energy exactly on the beat: at the first beat everyone jumps, "
   "Jade sings into the mic, Charlie strums hard, Ricky headbangs lightly, hair and skirt flying; spotlights strobe and sweep on every "
   "downbeat through thick haze. Handheld camera slowly circling."),
 "A01_room26_box": dict(key="k_room26_box-073542", refs=["j26", "props"], dur=5, prompt=
   "She lifts the old recorder out of the box, turns it over in her hands and brushes dust off the screen, eyes widening in recognition. "
   "Warm lamp light, dust motes. Static camera."),
 "A02_room26_window": dict(key="k_room26_window-073542", refs=["j26", "props"], dur=5, prompt=
   "She presses PLAY on the recorder; its small screen lights up with a waveform; she slowly looks up at the starry window; the cat turns "
   "its head toward the recorder with ears perked up. Very slow push-in."),
 "A03_room26_cu": dict(key="k_room26_cu-074403", refs=["j26"], dur=4, prompt=
   "Close-up: her eyes glisten, reflections of stars shimmer in them, a soft disbelieving smile slowly forms. Static camera."),
 "A04_room26_headphones": dict(key="k_room26_headphones-074403", refs=["j26", "props"], dur=6, prompt=
   "Eyes closed, she listens through the headphones, breathing slowly, head nodding very gently in time, a small smile. Lamp flickers "
   "softly. Static camera."),
 "A05_room26_phone": dict(key="k_room26_phone-074403", refs=["j26"], dur=4, prompt=
   "She scrolls her phone; its cold light flickers across her face as bad news scrolls by; she lowers her eyes and exhales. Static camera."),
 "A06_roof_duo": dict(key="k_roof_duo-074403", refs=["j11", "j26"], dur=5, prompt=
   "The two women slowly turn to face each other and smile, the one in the bucket hat laughs softly; stars twinkle; gentle breeze. "
   "Slow push-in."),
 "A07_roof_finale": dict(key="k_roof_finale-074403", refs=["j11", "j26", "ch", "rk", "props"], dur=6, prompt=
   "Everyone looks up at the sky; a bright meteor streaks across the Milky Way; the woman in the grey hoodie raises one hand toward it; "
   "the cat looks up too. Slow crane up toward the sky."),
 "A08_charlie_cu": dict(key="k_charlie_cu-074403", refs=["ch"], audio=(42.6, 46.6), dur=4, prompt=
   "@Audio1 is the music. He strums the acoustic guitar exactly on the beat, head bobbing, eyes closed. Spotlights pulse. Static camera."),
 "A09_ricky_cu": dict(key="k_ricky_cu-074403", refs=["rk"], audio=(46.5, 50.5), dur=4, prompt=
   "@Audio1 is the music. He plays the electric guitar on the beat, calm focus, then glances up with a small smile. Static camera."),
 "E01_ata_night": dict(key="k_ata_night-073542", refs=[], dur=5, prompt=
   "All the radio dishes slowly slew together in perfect unison to a new point in the sky, like synchronized dancers; the stars wheel "
   "very slightly. Static wide camera."),
 "E02_ata_dawn": dict(key="k_ata_dawn-074403", refs=[], dur=4, prompt=
   "The dishes turn upward together toward the brightening sky as the sun's first light spills across the desert. Slow dolly forward."),
 "E03_launch": dict(key="k_launch-074403", refs=[], dur=5, prompt=
   "The rocket climbs on a brilliant column of fire, the plume billowing and lighting the clouds; the reflection shimmers in the water. "
   "Camera tilts up slowly to follow."),
 "E04_alien_array": dict(key="k_alien_array-074403", refs=[], dur=6, prompt=
   "The colossal spiral array of alien dishes pivots in unison toward the dark sky; faint lights blink along their rims; the red sun "
   "glows on the horizon. Slow dolly forward across the plain."),
}


def slice_audio(a, b, path):
    subprocess.run(["ffmpeg", "-loglevel", "error", "-y", "-ss", str(a), "-t", str(b - a), "-i", SONG, "-ac", "2", "-ar", "44100",
                    "-b:a", "192k", path], check=True)


def job(pid, spec, tag, res="720p"):
    inp = {"image": as_data_uri(K + spec["key"] + "_169.jpg"), "duration": spec["dur"], "resolution": res, "generate_audio": True}
    prompt = spec["prompt"] + STYLE
    if spec["refs"]:
        inp["reference_images"] = [as_data_uri(SHEETS[r]) for r in spec["refs"]]
        prompt = "@Image1 is the first frame; the other images are character reference sheets. " + prompt
    if spec.get("audio"):
        os.makedirs(OUT + "/audio", exist_ok=True)
        ap = f"{OUT}/audio/{pid}.mp3"
        slice_audio(*spec["audio"], ap)
        inp["reference_audios"] = [as_data_uri(ap)]
    inp["prompt"] = prompt
    return {"id": f"{pid}-{tag}", "model": "bytedance/seedance-2.5", "input": inp, "ext": ".mp4",
            "meta": {"plate": pid, "audio": spec.get("audio")}}


if __name__ == "__main__":
    ids = sys.argv[1:] or list(PLATES)
    tag = time.strftime("%H%M%S")
    os.makedirs(OUT, exist_ok=True)
    jobs = [job(i, PLATES[i], tag) for i in ids]
    batch(jobs, OUT, timeout=3000, every=15)
