"""v4 fixes: new start frames for P2/20/21, new motion for 11/16/24/26."""
import os, sys
import cf, gen, relay, lipsync
from shots import BY_ID, STYLE
from gen import FR, CL

MS = ("Hand-painted anime film, consistent with the first frame: same character design, same art style, same lighting. "
      "Smooth, natural, continuous motion from the very first frame; nothing is frozen. No text appears. ")

FRAMES = {
    "P2": (["S1", "ROBOT"], STYLE + "Extreme close-up at true scale, the frame about fifteen centimetres across: the fingertips of a "
           "young woman's hand (grey hoodie cuff just visible at the edge) reaching down to a richly patterned Persian rug to pick up "
           "a tiny SD memory card. The card is small, about the size of her fingertip to first knuckle. A strip of cream masking tape "
           "on the card reads, in small blue ballpoint handwriting, \"rare earth — late night solo\" with a tiny doodle of the "
           "round-headed robot from the reference. Warm gold lamplight, shallow depth of field."),
    "20": (["KF-A", "S1"], STYLE + "The cluttered study from the first image at night, its blue lights dimmed to a faint glow. The young "
           "woman from the character sheet (grey hoodie, messy dark ponytail) stands at the wooden desk beneath the large window, "
           "seen from behind at a three-quarter angle. The warm desk lamp stands on the desk top in front of the window, its base "
           "firmly on the desk, and her hand rests on the lamp's switch. The lamp's gold light is the brightest thing in the frame, "
           "facing a dark sky full of stars through the window. No text."),
    "21": (["KF-A"], STYLE + "Inside the study from the reference image at night, looking out through its large window, the same "
           "window as in the reference: one big wooden-framed window with evenly divided panes, a potted plant on the sill, over "
           "dark low tiled rooftops to a clear sky full of stars. The warm desk lamp stands switched off on the wooden desk beneath "
           "the window. A woman's dark silhouette stands at the left edge of the frame beside the desk, leaning toward the glass. "
           "The sky near the horizon is empty. Only one window, drawn consistently, no reflections of other windows. No text."),
}

CLIPS = {
    "11": ("11.jpg", 5, MS + "The ribbons of pale blue light and the music notes keep flowing and swirling gently around her the whole "
           "time. She breathes, blinks and slowly turns her head to follow them. After about three seconds every ribbon and note "
           "surges outward toward the edges of the room at once. Static camera, then a slight push in as they surge."),
    "16": ("16.jpg", 5, MS + "The three small ninja figures of light keep performing their martial-arts form the whole time, crisp "
           "punches, kicks and spins, while their glow shifts steadily from pale blue at the start to red at the end. Outside the "
           "window the horizon flashes pale twice. Slow push toward the window."),
    "26": ("26.jpg", 5, MS + "Both guitarists play from the first moment: the one in the tan flat cap strums his acoustic guitar in "
           "rhythm and the one in the striped shirt plays his electric guitar, both bobbing their heads to the beat, while they grow "
           "into full pale blue light and the green and magenta light spreads across the walls. The two young women stay in frame "
           "and sway slightly. Locked-off camera, no reframing, no zoom."),
}


def frame_job(sid, k):
    refs, prompt = FRAMES[sid]
    out = os.path.join(FR, f"{sid}_v4_{k}.jpg")
    if os.path.exists(out): return out, "exists"
    inp = {"prompt": prompt, "aspect_ratio": "16:9", "image_size": "1K", "output_format": "jpg",
           "image_input": [gen.ref_uri(r, 1024) for r in refs]}
    r = cf.run("google/nano-banana-pro", inp, timeout=120, tag=f"v4 frame {sid}_{k}", retries=2)
    cf.download(cf.find_media(r), out)
    return out, "ok"


def clip_job(sid, k):
    img, dur, prompt = CLIPS[sid]
    out = os.path.join(CL, f"{sid}_v4_{k}.mp4")
    if os.path.exists(out): return out, "exists"
    return gen.gen_clip(BY_ID[sid], f"v4_{k}", frame=os.path.join(FR, img), dur=dur, prompt=prompt)


def lipsync24(k):
    s = BY_ID["24"]
    out = os.path.join(CL, f"24_v4_{k}.mp4")
    if os.path.exists(out): return out, "exists"
    aud = lipsync.audio_uri(s.start, 5.0, "24")
    prompt = MS + ("The translucent pale blue young woman in the black hat on the piano bench lifts her microphone and sings the "
                   "reference audio to the woman in the foreground, her lips moving in sync with the sung words and resting closed in "
                   "the pauses. Her eyes are normal dark eyes, gentle and open, not glowing. The woman in the grey hoodie in the "
                   "foreground breathes and tilts her head slightly. Locked-off camera.")
    inp = {"prompt": prompt, "image": gen.img_uri(os.path.join(FR, "24.jpg"), 1920), "reference_audios": [aud], "duration": 5,
           "resolution": "720p", "aspect_ratio": "adaptive", "fps": 24, "camera_fixed": True, "watermark": False,
           "output_format": "mp4", "use_virtual_avatar": False, "generate_audio": False}
    r = gen.run_long("bytedance/seedance-2.5", inp, tag=f"v4 lipsync 24_{k}")
    relay.fetch_media(r, out)
    return out, "ok"


if __name__ == "__main__":
    what = sys.argv[1]
    if what == "frames":
        gen.run_parallel([(f"{s}_{k}", frame_job, (s, k), {}) for s in FRAMES for k in (0, 1)], 6)
    elif what == "clips":
        jobs = [(f"{s}", clip_job, (s, 0), {}) for s in CLIPS] + [("24", lipsync24, (0,), {})]
        gen.run_parallel(jobs, 4)
