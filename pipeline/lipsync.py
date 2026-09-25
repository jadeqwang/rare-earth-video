"""Re-generate the singing shots (22, 23) driven by the vocal at that point in the song."""
import base64, os, subprocess, sys, time, json
from concurrent.futures import ThreadPoolExecutor
import cf, gen, relay
from shots import BY_ID, ROOT, PRE

import shots as _shots
SONG = _shots.SONG_FILE
CL = gen.CL


def audio_uri(t0, dur, name):
    out = os.path.join(ROOT, "gen", "test", f"vox_{name}.mp3")
    # emphasise the voice band so the model keys on the singing
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t0:.3f}", "-t", f"{dur:.3f}", "-i", SONG,
                    "-af", "highpass=f=180,lowpass=f=6000,acompressor", "-ac", "1", "-ar", "44100", "-b:a", "128k", out], check=True)
    return "data:audio/mpeg;base64," + base64.b64encode(open(out, "rb").read()).decode()


def seedance(sid, k):
    s = BY_ID[sid]
    out = os.path.join(CL, f"{sid}_ls{k}.mp4")
    if os.path.exists(out): return out, "exists"
    aud = audio_uri(s.start, 5.0, sid)
    prompt = (gen.MOTION_STYLE if hasattr(gen, "MOTION_STYLE") else "") + (
        "The translucent pale blue young woman in the black brimmed hat sings the reference audio into her microphone: "
        "her lips move in sync with the sung words, opening on each syllable, and her mouth rests closed during the pauses "
        "between lines. Everything else stays calm. Static camera.")
    inp = {"prompt": prompt, "image": gen.img_uri(os.path.join(gen.FR, f"{sid}.jpg"), 1920), "reference_audios": [aud],
           "duration": 5, "resolution": "720p", "aspect_ratio": "adaptive", "fps": 24, "camera_fixed": True,
           "watermark": False, "output_format": "mp4", "use_virtual_avatar": False, "generate_audio": False}
    r = gen.run_long("bytedance/seedance-2.5", inp, tag=f"lipsync seedance {sid}_{k}")
    relay.fetch_media(r, out)
    return out, "ok"


def avatar(sid, k):
    s = BY_ID[sid]
    out = os.path.join(CL, f"{sid}_av{k}.mp4")
    if os.path.exists(out): return out, "exists"
    aud = audio_uri(s.start, s.dur + 0.4, sid + "_av")
    inp = {"image": gen.img_uri(os.path.join(gen.FR, f"{sid}.jpg"), 1920), "audio": aud, "voice": "Zephyr (Female)",
           "voice_script": "", "voice_language": "English (US)", "resolution": "1080p",
           "video_prompt": "The translucent pale blue young woman in the black hat sings softly into her handheld microphone; "
                           "lips move with the singing and close in the pauses. The rest of the scene stays still.",
           "voice_prompt": "Say the following.", "negative_prompt": "", "strength_negative_prompt": 0.5,
           "disable_safety_filter": True, "disable_prompt_upsampling": False}
    r = gen.run_long("pruna/p-video-avatar", inp, tag=f"lipsync avatar {sid}_{k}")
    relay.fetch_media(r, out)
    return out, "ok"


if __name__ == "__main__":
    jobs = [(f"seedance {s}", seedance, (s, 0), {}) for s in ("22", "23")] + \
           [(f"avatar {s}", avatar, (s, 0), {}) for s in ("22", "23")]
    gen.run_parallel(jobs, 4)
