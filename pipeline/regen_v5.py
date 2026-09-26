"""v5 fixes: recorder consistency, window consistency, supported recorder, planet velocity, sparring ninjas,
ghost legs / no-singing, living band in 40."""
import os, sys
import cf, gen, relay, lipsync
from shots import BY_ID, STYLE
from gen import FR, CL

MS = ("Hand-painted anime film, consistent with the first frame: same character design, same art style, same lighting. "
      "Smooth, natural, continuous motion from the very first frame; nothing is frozen. No text appears. ")
REC = ("exactly the silver handheld digital audio recorder shown in the reference sheet: an upright portrait-shaped brushed-silver "
       "body with rounded corners, two crossed microphone capsules in a small cage on top, a small colour screen, round green "
       "PLAY, red REC and dark STOP buttons, and a speaker grille below")

EDITS = {  # sid: (source image, extra refs, prompt)
    "3": ("3.jpg", ["S4"], f"Edit this image: replace the handheld recorder lying in the foreground with {REC}, lying on her lap at the "
          "same place, similar size and angle, same warm lighting. Keep everything else exactly identical."),
    "36": ("36.jpg", ["S4"], f"Edit this image: replace the recorder lying on the rug with {REC}, lying on its back on the rug at the "
           "same place and similar size, its red LED lit, same cool moonlight. Keep the cat's tail and everything else identical."),
    "37": ("37.jpg", ["S4"], f"Edit this image: replace the small recorder lying on the rug with {REC}, lying on the rug at the same "
           "place, its red LED lit. Keep everything else exactly identical."),
    "40": ("40.jpg", ["S4"], f"Edit this image: replace the small device in the woman's hands with {REC}, held in her lap in both hands. "
           "Keep everything else exactly identical."),
    "45": ("45.jpg", ["S4"], "Edit this image: make the silver device under the memory card clearly the back of the recorder in the "
           "reference sheet: an upright portrait-shaped brushed-silver body with softly rounded corners and the small crossed "
           "microphone cage just visible at its top end. Keep the memory card, the masking tape and all the handwriting on it "
           "exactly identical and in the same place, same warm light and desk."),
    "7": ("7.jpg", ["S1", "S4"], "Edit this image: add the young woman's other hand cradling the recorder from below, fingers under its "
          "base, supporting it, grey hoodie cuff at the wrist, while the first hand's thumb stays on the side wheel. Keep the "
          "recorder, the blue wisps, the lamp and everything else exactly identical."),
    "8b": ("9.jpg", [], "Using this image as the room reference, make a new frame: a close shot of this exact window from inside, "
           "the same wooden window frame and panes, the same stacks of books on the sill, no cat, no lamp, no graph, no plants. "
           "Through the glass, a clear deep-blue night sky over dark low rooftops, with one single bright star in the middle of the "
           "upper half of the glass, brighter than the rest. Same hand-painted anime style, 16:9."),
    "23": ("24.jpg", ["KF-C", "S1"], STYLE + "The same piano corner of the study as in the first image, with the same window, "
           "curtain, lamp on the wall shelf and piano, as a wider shot from the side. The young woman in the grey hoodie and messy dark "
           "ponytail stands a few steps from the piano with her hands empty at her sides, turning to look at her younger self: a young "
           "woman made of translucent pale blue light, black brimmed hat, long hair down, white blouse, seated on the piano bench and "
           "singing into a handheld microphone. Warm gold lamplight. No lamp in anyone's hands. No text."),
    "25": ("24.jpg", ["S2", "S1"], STYLE + "The same piano corner of the study as in the first image, with the same window, curtain, "
           "wall lamp and piano, medium-wide. The young woman in the grey hoodie, lit warm gold, sits on the piano bench beside her "
           "younger self, who is made of translucent pale blue light (black brimmed hat, white blouse, red-orange ruffle skirt in "
           "blue light), her whole body clearly visible including her legs and her feet resting on the floor, holding a microphone "
           "lowered in her lap, smiling. There is a gap between them on the bench. The long-haired brown tabby cat crouches on the rug "
           "in front, about to jump. No text."),
}


def edit(sid, k):
    src, refs, prompt = EDITS[sid]
    out = os.path.join(FR, f"{sid}_v5_{k}.jpg" if k < 6 else f"{sid}_v6_{k-6}.jpg")
    if os.path.exists(out): return out, "exists"
    imgs = [gen.img_uri(os.path.join(FR, src), 1536)] + [gen.ref_uri(r, 1024) for r in refs]
    for size in ("2K", "1K"):
        try:
            r = cf.run("google/nano-banana-pro", {"prompt": prompt, "image_input": imgs[:3], "aspect_ratio": "16:9",
                                                  "image_size": size, "output_format": "jpg"}, timeout=120,
                       tag=f"v5 edit {sid}_{k}", retries=0)
            cf.download(cf.find_media(r), out)
            return out, "ok " + size
        except RuntimeError as e:
            if "502" not in str(e): raise
    raise RuntimeError("502 at both sizes")


if __name__ == "__main__":
    ids = sys.argv[1:] or list(EDITS)
    gen.run_parallel([(f"{s}_{k}", edit, (s, k), {}) for s in ids for k in (0, 1)], 8)
