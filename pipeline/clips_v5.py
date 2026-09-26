import os, sys
import gen, relay, lipsync
from shots import BY_ID
from regen_v5 import MS
FR, CL = gen.FR, gen.CL
P = {
 "3": MS + "The cat opens one eye fully and slowly turns its head, tracking something drifting past; her hand rests on the recorder in her lap and her body breathes gently. Gentle pan.",
 "6": MS + "The gold dust motes drift slowly down through the lamp beam. The single pale blue speck drifts across the frame at one steady, constant speed from the very first frame to the last, in a straight gentle line, never stopping and never speeding up. Static camera.",
 "7": MS + "She holds the recorder in both hands; her thumb rolls the side volume wheel up; the level bars on the screen jump higher and the pale blue wisps rising from the speaker thicken and multiply. The recorder moves naturally with her hands and breathing. Static camera.",
 "16": MS + "The three small ninja figures of light spar with each other in a real fight: one throws a punch and another blocks it, a kick is dodged, they trade blows and circle each other; no spinning in place. Their glow shifts steadily from pale blue at the start to red at the end. Outside the window the horizon flashes pale twice. Slow push toward the window.",
 "25": MS + "The cat springs up onto the piano bench between the two women and settles; both women look down at it and smile. The younger woman in blue light does not sing; her mouth stays gently closed in a smile. Locked-off camera.",
 "26": MS + "A lively live performance of an instrumental passage. The guitarist in the tan flat cap strums his acoustic guitar hard in rhythm; the guitarist in the striped shirt plays his electric guitar, fretting hand sliding, body rocking to the beat. The young woman in pale blue light with the black hat is NOT singing: her microphone is lowered, her mouth is closed, and she smiles and sways to the music. The woman in the grey hoodie nods along. The green and magenta light pulses on the beat. Locked-off camera, no reframing.",
 "36": MS + "The fluffy striped tail sweeps slowly across in front of the recorder's red LED, then away. Static camera.",
 "40": MS + "The whole room glows and the gold and blue ribbons of light swirl around. The young woman in the black hat blinks, looks up and around in wonder and smiles, holding the recorder in her lap; the cat's ears twitch. Behind her the two guitarists made of pale blue light play their guitars, strumming and fretting in rhythm. Slow pull back.",
 "37": MS + "She settles the black hat on her head, then reaches down for the recorder on the rug. The cat sleeps, breathing. Static camera.",
}
def job(sid):
    return gen.gen_clip(BY_ID[sid], "v5_0", frame=os.path.join(FR, f"{sid}.jpg"), dur=5, prompt=P[sid])
def ls23():
    s = BY_ID["23"]; out = os.path.join(CL, "23_v5_0.mp4")
    if os.path.exists(out): return out, "exists"
    aud = lipsync.audio_uri(s.start, 5.0, "23v5")
    prompt = MS + ("The young woman in the grey hoodie slowly turns her head toward the piano, surprised. On the piano bench her "
                   "younger self in translucent pale blue light sings the reference audio into her microphone, lips moving in sync "
                   "with the sung words and resting closed in the pauses. Static camera.")
    inp = {"prompt": prompt, "image": gen.img_uri(os.path.join(FR, "23.jpg"), 1920), "reference_audios": [aud], "duration": 5,
           "resolution": "720p", "aspect_ratio": "adaptive", "fps": 24, "camera_fixed": True, "watermark": False,
           "output_format": "mp4", "use_virtual_avatar": False, "generate_audio": False}
    r = gen.run_long("bytedance/seedance-2.5", inp, tag="v5 lipsync 23"); relay.fetch_media(r, out); return out, "ok"
if __name__ == "__main__":
    ids = sys.argv[1:] or [k for k in P if k != "37"] + ["23"]
    jobs = [(s, ls23, (), {}) if s == "23" else (s, job, (s,), {}) for s in ids]
    gen.run_parallel(jobs, 10)
