"""v6 continuity pass: derive each sequence's frames from one master frame."""
import os, sys
import cf, gen, regen_v5 as R5
from shots import STYLE
FR = gen.FR
SCALE = ("The silver handheld recorder is exactly the one in the reference: portrait-shaped, about the length of her hand, "
         "fitting in one palm. ")
SAME = ("This must be the same moment and place as the first image: the same woman in the same spot on the same rug, same pose "
        "and clothes, same cat, same room and furniture layout, same lighting; only the camera framing changes. ")
E = {
 # Act 1 floor sequence, all from the hero wide (M1)
 "P3": ("M1_floor.jpg", ["S4", "ROBOT"], SAME + "Reframe as a medium close-up of her sitting cross-legged, holding the silver "
        "recorder in one hand with its back (with a small round sticker of the blue robot) toward the camera, and a tiny memory "
        "card between the fingers of her other hand, about to insert it. The cat still curled in her lap. " + SCALE),
 "2": ("M1_floor.jpg", ["S4"], SAME + "Reframe as a close-up of her face and hands: she holds the silver recorder near her chest "
       "with both hands, its screen facing the camera, its red LED lit, her face lit from below, lips parted in recognition. A single "
       "small music note of pale blue light rises from the recorder's speaker. No glowing ribbons yet. " + SCALE),
 "3": ("M1_floor.jpg", ["S4"], SAME + "Reframe lower and closer on the cat curled asleep in her lap, one eye just opening; her hands "
       "rest near it and the silver recorder lies on the rug beside her knee. A single small note of pale blue light floats above the "
       "cat's head. " + SCALE),
 "10": ("M1_floor.jpg", [], SAME + "Reframe as a close-up of her face and shoulders: she has turned her head toward the window, "
        "watching something off-frame with a small half smile. A couple of thin pale blue ribbons of light drift behind her."),
 "11": ("M1_floor.jpg", ["KF-B"], SAME + "Same wide framing. More pale blue light now: ribbons of light, music notes and loose staff "
        "lines hang all around her. The cat is no longer in her lap: the same long-haired brown tabby cat now sits on the windowsill "
        "behind her, drawn exactly like the cat in the first image. The recorder lies on the rug beside her. " + SCALE),
 # the transit: the cat walks in FRONT of the lamp
 "9": ("9.jpg", ["KF-B"], "Edit this image: the long-haired brown tabby cat (same cat as in the second image) is now walking along "
       "the FRONT edge of the desk, nearest the camera, just about to pass directly in front of the glowing desk lamp so its body "
       "will block the lamp from our view. Remove the cat from the windowsill. Keep the window, the graph on the wall, the lamp, the "
       "books and everything else identical."),
 # piano corner: same heights for Jade and her ghost
 "23": ("24.jpg", ["S1", "S2"], "Using this image as the exact room and character scale reference, make a wider shot of the same "
        "piano corner (same piano, window, curtain and lamp positions). The young woman in the grey hoodie stands a few steps from the "
        "piano, hands empty, turning to look at her younger self, who sits on the piano bench in translucent pale blue light singing "
        "into a microphone. Both women are the same size and build as each other, exactly as in the reference image. No lamp in "
        "anyone's hands. No text."),
 "25": ("24.jpg", ["S1", "S2"], "Using this image as the exact room and character scale reference, make a medium-wide shot of the "
        "same piano corner (same piano, window, curtain and lamp positions). The young woman in the grey hoodie sits on the piano bench "
        "beside her younger self in translucent pale blue light (black hat, white blouse, ruffle skirt in blue light, legs and feet "
        "visible on the floor), with a gap between them. Both are exactly the same size and build, seated at the same height. The "
        "long-haired brown tabby cat crouches on the rug in front, about to jump. No text."),
}
if __name__ == "__main__":
    ids = sys.argv[1:] or list(E)
    R5.EDITS.update(E)
    import regen_v5
    gen.run_parallel([(f"{s}_{k}", regen_v5.edit, (s, k), {}) for s in ids for k in (6, 7)], 8)
