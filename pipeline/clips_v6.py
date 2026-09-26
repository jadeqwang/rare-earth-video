import os, sys
import gen, relay, lipsync
from shots import BY_ID
from regen_v5 import MS
FR, CL = gen.FR, gen.CL
P = {
 "P3": MS + "Holding the recorder with its back toward the camera, she slides the tiny memory card into its slot with a click, then turns the recorder around toward herself so she can see the screen, which lights up with a soft glow on her face. The cat sleeps in her lap. Static camera.",
 "2": MS + "She holds the recorder still in both hands, screen toward us; a single small note of pale blue light rises slowly out of the speaker and her eyes follow it upward in wonder. Static camera, slight rack focus to the note.",
 "3": MS + "The cat opens one eye fully and slowly turns its head, tracking the small note of blue light as it drifts across; her hand strokes the cat. Gentle pan.",
 "9": MS + "The cat walks steadily along the front edge of the desk, from left to right, passing directly in front of the glowing lamp so its body blocks the lamp from view for a moment, then continues past. Static camera.",
 "10": MS + "Her half smile widens a little and she tilts her head, watching; the blue ribbons drift behind her. Static camera.",
 "11": MS + "The ribbons of pale blue light and the notes keep flowing and swirling gently around her the whole time. She breathes, blinks and turns her head to follow them; the cat in her lap stirs. After about three seconds every ribbon and note surges outward toward the edges of the room at once. Static camera, then a slight push in.",
 "25": MS + "The cat springs up onto the piano bench between the two women and settles; both women look down at it and smile. The younger woman in blue light does not sing; her mouth stays closed in a smile. Locked-off camera.",
 "12": MS + "The bookshelves, books, lamp and desk are solid and completely static; nothing in the room moves or deforms. Soft ribbons of pale blue light and drifting sparks lift off the open book's pages and float up and out. No letters, no symbols. Very slow, steady push in.",
}
def job(sid):
    return gen.gen_clip(BY_ID[sid], "v6_0", frame=os.path.join(FR, f"{sid}.jpg"), dur=5, prompt=P[sid])
def zoom(name, a, b, prompt):
    out = os.path.join(CL, f"44{name}_v6.mp4")
    if os.path.exists(out): return out, "exists"
    return gen.gen_clip(BY_ID["44"], f"{name}_v6", frame=os.path.join(FR, a), last=os.path.join(FR, b), dur=5, prompt=prompt)
def ls23():
    s = BY_ID["23"]; out = os.path.join(CL, "23_v6_0.mp4")
    if os.path.exists(out): return out, "exists"
    aud = lipsync.audio_uri(s.start, 5.0, "23v6")
    prompt = MS + ("The young woman in the grey hoodie turns her head toward the piano, surprised. On the piano bench her younger self in "
                   "translucent pale blue light sings the reference audio into her microphone, lips moving in sync with the words and "
                   "resting closed in the pauses. Static camera.")
    inp = {"prompt": prompt, "image": gen.img_uri(os.path.join(FR, "23.jpg"), 1920), "reference_audios": [aud], "duration": 5,
           "resolution": "720p", "aspect_ratio": "adaptive", "fps": 24, "camera_fixed": True, "watermark": False,
           "output_format": "mp4", "use_virtual_avatar": False, "generate_audio": False}
    r = gen.run_long("bytedance/seedance-2.5", inp, tag="v6 lipsync 23"); relay.fetch_media(r, out); return out, "ok"
if __name__ == "__main__":
    jobs = [(s, job, (s,), {}) for s in P] + [("23", ls23, (), {})]
    jobs += [("44a", zoom, ("a", "zoom_0.jpg", "zoom_2.jpg", MS + "One continuous smooth camera move: the camera pulls back from the glowing window and rises up over the rooftops, higher and higher, up through thin moonlit clouds until the whole sleeping town is small below. No cuts."), {}),
             ("44b", zoom, ("b", "zoom_3.jpg", "zoom_5.jpg", MS + "One continuous smooth camera move: the camera pulls back from the night side of the Earth, out into space, until the Earth shrinks to a single tiny pale blue dot in a faint band of sunlight. No cuts."), {})]
    gen.run_parallel(jobs, 12)
