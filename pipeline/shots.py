"""The edit: every shot's timing on the 123 BPM grid, its generation spec, animatic fallback and VFX.

Times: `start`/`dur` are song time (s, 0 = song 0:00). The film timeline is song time + PRE.
Pre-roll shots have negative song times.
"""
import json, os
from dataclasses import dataclass, field
from typing import Callable, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
GRID = json.load(open(os.path.join(HERE, "grid.json")))
BAR = GRID["bar"]
BEAT = GRID["period"]
PRE = 10.0
SONG_END = 177.19
POST = 3.2


def B(k, bars=0.0):
    """Song time of block k plus `bars` bars."""
    return GRID["blocks"][f"B{k}"] + bars * BAR


STYLE = ("Hand-painted anime film still, 16:9 widescreen, richly detailed painted background art, "
         "soft film grain, gentle depth of field. ")
MOTION_STYLE = ("Hand-painted anime film, consistent with the first frame: same character design, same art style, "
                "same lighting. Smooth, gentle, cinematic motion. No text appears. ")

REF = {
    "KF-A": "KF-A_empty_room.jpg", "KF-B": "KF-B_hero_frame.jpg", "KF-C": "KF-C_jade_at_28.jpg",
    "KF-D": "KF-D_the_gig.jpg", "KF-E": "KF-E_dark_room.jpg", "KF-F": "KF-F_other_world.jpg",
    "S1": "Sheet_1_Jade_now.jpg", "S2": "Sheet_2_Jade_at_28.jpg", "S3a": "Sheet_3a_Charlie.jpg",
    "S3b": "Sheet_3b_Ricky.jpg", "S4": "Sheet_4_recorder.jpg", "ROBOT": "robot_doodle.JPG",
    "PHOTO": "rna_band.jpg",
}


@dataclass
class Shot:
    id: str
    start: float            # song time
    dur: float
    lyric: str = ""
    # start-frame generation
    refs: list = field(default_factory=list)
    prompt: str = ""        # start-frame prompt (image model)
    motion: str = ""        # image-to-video prompt
    gen_dur: int = 5
    model: str = "seedance"  # seedance | h3 | none
    last_frame: Optional[str] = None  # optional last-frame prompt
    # animatic fallback: (ref key, crop x,y,w in KF px (16:9 implied), end crop or None)
    still: tuple = ("KF-A", (0, 0, 1792), None)
    # timing inside the generated clip: take source from `clip_in` seconds, speed factor
    clip_in: float = 0.0
    speed: float = 1.0
    freeze_until: Optional[float] = None   # hold the first frame until this local time
    notes: str = ""

    @property
    def end(self):
        return self.start + self.dur


def S(*a, **k):
    return Shot(*a, **k)


SHOTS = [
    # ------------------------------------------------------------------ PRE-ROLL (room sound)
    S("P1", -PRE, 4.0, "(room sound)", refs=["KF-A", "S1"], gen_dur=5,
      prompt=STYLE + "The cluttered study from the first reference image at night, in the middle of a move, lit only by the "
             "single warm desk lamp. The young woman from the character sheet (loose messy dark ponytail, oversized "
             "heather-grey hoodie, charcoal joggers, white socks) kneels on the patterned rug beside an open cardboard "
             "moving box, lifting a black brimmed bucket hat out of it with both hands, looking at it in quiet surprise. "
             "A heavy old hardback book rests on the box flaps. The long-haired brown tabby cat sits nearby watching. "
             "Gold lamplight on her and the box; the rest of the room in soft blue-black shadow; stars in the window. "
             "Nothing glows. Medium shot. No text.",
      motion=MOTION_STYLE + "She sets the black hat down on the rug and lifts the heavy book; as it opens, a small memory "
             "card slips out from between its pages and drops onto the rug. Slow push in.",
      still=("KF-A", (380, 380, 1000), (430, 420, 880))),
    S("P2", -6.0, 2.0, "(room sound)", refs=["ROBOT"], gen_dur=4,
      prompt=STYLE + "Extreme close-up, macro: a small SD memory card lying on a richly patterned Persian rug in warm gold "
             "lamplight. A strip of cream masking tape is stuck across the card; on the tape, handwritten in blue ballpoint "
             "pen in a quick casual hand: \"rare earth — late night solo\", and beside it a tiny doodle of the round-headed "
             "blue robot from the reference image, drawn in the same pen. Shallow depth of field, the rug soft behind. "
             "Anime painted style.",
      motion=MOTION_STYLE + "A woman's fingertips enter the frame and gently pick the card up. Very slight drift. The "
             "handwriting on the tape stays sharp and unchanged.",
      still=("KF-B", (1040, 800, 300), (1060, 815, 260))),
    S("P3", -4.0, 4.0, "(click)", refs=["KF-B", "S4", "ROBOT"], gen_dur=5,
      prompt=STYLE + "In the lamplit study at night, the young woman from the first image (grey hoodie, messy dark ponytail) "
             "sits on the rug beside an open moving box, holding the small silver handheld audio recorder from the "
             "second image (two crossed microphones on top, small screen, PLAY / REC / STOP buttons) in one hand and a "
             "tiny memory card in the other, about to slide the card into its slot. We see the back of the recorder, "
             "which has a small round sticker of the blue robot from the third image. A black brimmed hat and a heavy "
             "book lie on the rug beside her. Warm desk-lamp light on her hands and face; the room behind in soft "
             "shadow. Medium close-up. No text.",
      motion=MOTION_STYLE + "She slides the card into the slot with a click, turns the recorder over, and its little screen "
             "lights up with a soft pale glow. Static camera.",
      still=("KF-B", (700, 420, 700), (760, 470, 560))),

    # ------------------------------------------------------------------ ACT 1: THE FIND
    S("1", 0.0, B(1), "(held tone)", refs=["S4", "S1"], gen_dur=5,
      prompt=STYLE + "Extreme close-up of the small silver handheld recorder from the first image (two crossed microphones "
             "on top, small backlit screen, round green PLAY button, red REC button, black STOP button, speaker grille), "
             "held in the hand of the young woman in the grey hoodie from the second image, the hoodie cuff at the edge "
             "of frame, her thumb resting on the PLAY button. The screen glows faintly, blank. The small red LED is off. "
             "Warm gold lamplight from one side, deep shadow behind. Shallow depth of field. No text, no numbers.",
      motion=MOTION_STYLE + "Her thumb presses the PLAY button down firmly and releases. Very slow push in. The screen "
             "stays blank.",
      still=("KF-B", (1080, 830, 280), (1110, 850, 220))),
    S("2", B(1), 2 * BAR, "Do you still care", refs=["KF-B", "S1"], gen_dur=5,
      prompt=STYLE + "Close-up of the young woman from the first image, seated cross-legged on the rug at night, head bowed "
             "over the small silver recorder she holds near her chest. Her face is lit from below by its small red LED "
             "and from one side by warm lamplight. Her expression is the first moment of recognition: lips parted, eyes "
             "widening. Just above the recorder's speaker grille, a single small music note made of pale blue light is "
             "starting to rise. The room behind falls into soft dark shadow. No glowing patterns on her skin or clothes.",
      motion=MOTION_STYLE + "The small blue note of light rises slowly out of the speaker grille and her eyes follow it "
             "upward in wonder. Static camera, slight rack focus from her face to the note.",
      still=("KF-B", (600, 150, 620), (660, 180, 520))),
    S("3", B(1, 2), 2 * BAR, "…the life out there / Searching for me", refs=["KF-B", "S1"], gen_dur=5,
      prompt=STYLE + "Lower and closer on the scene in the first image: the long-haired brown tabby cat curled asleep in the "
             "young woman's lap in warm gold lamplight, one eye just opening. A single small music note of pale blue "
             "light floats in the air just above the cat's head. Her hands and a silver recorder are soft in the "
             "foreground.",
      motion=MOTION_STYLE + "The blue note drifts slowly across the frame; the cat opens one eye fully and tracks it, "
             "turning its head. Gentle pan following the note.",
      still=("KF-B", (640, 470, 460), (700, 480, 420))),
    S("4", B(2), 2 * BAR, "Are you still there", refs=["KF-A"], gen_dur=5,
      prompt=STYLE + "The piano corner of the study from the reference image at night: the upright piano with open sheet "
             "music on its stand, caught at an angle by the warm desk lamp, moving boxes stacked beside it, the rest in "
             "shadow. The staff lines on the sheet music have just begun to shimmer faintly pale blue while still lying "
             "flat on the page. Medium close-up.",
      motion=MOTION_STYLE + "The staff lines peel up off the page as thin ribbons of pale blue light, carrying small music "
             "notes with them, and float out into the dark room. Slow push in.",
      still=("KF-A", (640, 200, 560), (700, 230, 440))),
    S("5", B(2, 2), 2 * BAR, "A rare earth looking for a friend", refs=["KF-B"], gen_dur=5,
      prompt=STYLE + "The reference image with its composition unchanged: the young woman sits cross-legged on the rug with "
             "the tabby cat asleep in her lap and the silver recorder beside her, warm gold lamplight, moving boxes "
             "around her. Add a few thin ribbons of pale blue light carrying small music notes, circling her loosely at "
             "shoulder height, drifting in from the piano side of the room. Stars in the window.",
      motion=MOTION_STYLE + "The ribbons of blue light circle her slowly; she lowers the pages and looks up and around at "
             "them in wonder. Very slow pull back.",
      still=("KF-B", (180, 90, 1430), (0, 0, 1792))),
    S("6", B(3), 2 * BAR, "Lived my life on a pale blue dot", refs=[], gen_dur=5,
      prompt=STYLE + "Macro shot of dust motes drifting through a diagonal beam of warm gold lamplight against deep "
             "blue-black shadow. Among the gold motes, one tiny speck glows pale blue, off-center, resting inside a faint "
             "band of light, like Earth in the Voyager 'pale blue dot' photograph. Shallow depth of field, soft bokeh.",
      motion=MOTION_STYLE + "The gold dust motes drift slowly down through the beam; the single pale blue speck hangs, then "
             "drifts gently across the beam. Static camera.",
      still=("PROC", "dust_beam", None)),
    S("7", B(3, 2), 2 * BAR, "Your signal here I think I've caught", refs=["S4", "S1"], gen_dur=5,
      prompt=STYLE + "Close-up of the silver handheld recorder from the first image held in the hand of the young woman in "
             "the grey hoodie, her thumb on the ribbed volume wheel on its side. The small backlit screen shows a row of "
             "low level-meter bars. Thin wisps of pale blue light curl up from the speaker grille. Warm gold lamplight, "
             "dark background. No text, no numbers on the screen.",
      motion=MOTION_STYLE + "Her thumb rolls the volume wheel up; the level-meter bars on the screen jump higher and the "
             "blue wisps of light thicken and multiply, spiralling upward. Static camera.",
      still=("KF-B", (1060, 780, 360), (1080, 800, 300))),
    S("8a", B(4), BAR, "The beating blinking of a star", refs=["S4"], gen_dur=4,
      prompt=STYLE + "Extreme close-up of the small red LED on the brushed-silver recorder from the reference image, lit "
             "and centered in the frame, a soft red halo on the brushed metal around it, everything else falling into "
             "darkness. No text.",
      motion=MOTION_STYLE + "The red LED blinks on and off in a steady rhythm. Static camera.",
      still=("PROC", "led", None)),
    S("8b", B(4, 1), BAR, "(continues)", refs=["KF-A"], gen_dur=4,
      prompt=STYLE + "The window of the study from the reference image at night, framed from inside: a clear night sky over "
             "dark low tiled rooftops, with one star exactly centered in the frame, brighter than the rest. The potted "
             "plant is a silhouette on the sill; a little warm lamplight catches the window frame. Deep blue night.",
      motion=MOTION_STYLE + "The central star twinkles in a steady rhythm. Static camera.",
      still=("KF-A", (150, 0, 500), (170, 10, 470))),
    S("9", B(4, 2), 2 * BAR, "A planet's transit is not that…", refs=["KF-A", "S1"], gen_dur=5,
      prompt=STYLE + "Looking across a desk toward the large window of the study from the first image at night. The warm "
             "desk lamp glows gold in the middle of the frame, just in front of the windowsill. The long-haired brown "
             "tabby cat from the character sheet is stepping onto the end of the sill, about to walk along it in front "
             "of the lamp. Pinned to the wall beside the window is a printed graph: a flat line with one small rounded "
             "dip in the middle. Stars through the glass. No numbers or labels on the graph.",
      motion=MOTION_STYLE + "The cat walks slowly along the windowsill, passing directly in front of the glowing lamp; as "
             "its body crosses, the lamplight dips, then comes back. Static camera.",
      still=("KF-A", (160, 120, 760), (200, 140, 700))),
    S("10", B(5), BAR + BAR / 3, "…far from my own", refs=["KF-B", "S1"], gen_dur=4,
      prompt=STYLE + "Close-up of the young woman from the first image seated on the rug, turned toward the window, "
             "watching something off-frame with a small half smile. Warm gold lamplight on her face; a couple of thin "
             "pale blue ribbons of light drift in the dark behind her.",
      motion=MOTION_STYLE + "Her smile widens a little and she tilts her head. Static camera.",
      still=("KF-B", (660, 160, 460), (690, 180, 420))),
    S("11", B(5) + BAR + BAR / 3, 5.2, "How could we be alone", refs=["KF-B"], gen_dur=8,
      prompt=STYLE + "The reference image with the same composition, but with far more pale blue light in the room: ribbons "
             "of light, small music notes and loose staff lines hang motionless in the air all around her, frozen in "
             "place. She sits still on the rug, the recorder beside her, looking from one frozen light to another; the "
             "tabby cat is no longer in her lap but sits on the windowsill in the background.",
      motion=MOTION_STYLE + "Everything holds perfectly still for three seconds; then every blue light starts moving at "
             "once and surges outward to the edges of the room. Static camera, then a slight push in as they surge.",
      still=("KF-B", (90, 50, 1610), (0, 0, 1792)), freeze_until=3.0),

    # ------------------------------------------------------------------ ACT 2: THE ROOM WAKES
    S("12", B(6), 2 * BAR, "(instrumental)", refs=["KF-A"], gen_dur=5,
      prompt=STYLE + "The bookshelves of the study from the reference image at night, medium shot. A thick physics textbook "
             "lies open on a shelf edge in warm lamplight, and lines of handwritten mathematical symbols are lifting off "
             "its pages as pale blue light, still close to the paper. A few blue ribbons and notes drift in from the left.",
      motion=MOTION_STYLE + "Soft ribbons of pale blue light and drifting sparks lift off the open pages one after another "
             "and swing out to orbit the room. No letters, no symbols, no writing in the light. Slow pan along the shelf.",
      still=("KF-A", (1100, 60, 600), (1180, 80, 560))),
    S("13", B(6, 2), 2 * BAR, "(instrumental)", refs=["KF-A"], gen_dur=5,
      prompt=STYLE + "The upper bookshelves of the study from the reference image at night, with a framed light-box panel "
             "of brain MRI scan images mounted above them: a 4 by 3 grid of grey brain cross-sections, dark and unlit. A "
             "few pale blue glowing equations drift across the foreground. Warm lamplight grazes the shelves from below. "
             "No labels on the panel.",
      motion=MOTION_STYLE + "The light panel flickers on; regions of the brain scans light up pale blue one after another in "
             "a rhythmic sequence. Static camera.",
      still=("KF-A", (1150, 0, 640), (1180, 10, 600))),
    S("14", B(7), 2 * BAR, "(instrumental)", refs=["KF-A"], gen_dur=5,
      prompt=STYLE + "The corner of the study from the reference image with the wooden wing-chun martial-arts training "
             "dummy, at night, lit warm gold from the side. The violin leans on books behind it, glowing faintly pale "
             "blue. Three small figures made of translucent pale blue light, dressed as ninjas, are stepping out of the "
             "dummy's silhouette; one already stands on the floor in a ready stance. Medium shot.",
      motion=MOTION_STYLE + "The three small ninja figures of blue light step off the dummy and perform a martial-arts form "
             "in unison, crisp punches and kicks on the beat. Static camera, slightly low angle.",
      still=("KF-A", (1000, 260, 620), (1030, 290, 560))),
    S("15", B(7, 2), 2 * BAR, "(instrumental)", refs=["KF-A", "S1"], gen_dur=5,
      prompt=STYLE + "The training-dummy corner of the study from the first image at night. The young woman from the "
             "character sheet (grey hoodie, messy dark ponytail, charcoal joggers, white socks), lit warm gold, has "
             "stepped in among three small ninja figures made of translucent pale blue light and is copying one "
             "figure's stance, arms raised in a block. The long-haired brown tabby cat watches from the rug in the "
             "soft-focus foreground.",
      motion=MOTION_STYLE + "She matches one move with the glowing figures, a turn and a slow kick, then laughs. Static camera.",
      still=("KF-A", (940, 250, 760), (980, 280, 680))),
    S("16", B(8), 2 * BAR, "Before they launch or self-destruct", refs=["KF-A"], gen_dur=5,
      prompt=STYLE + "The study from the reference image at night, looking toward the large window. Three small ninja "
             "figures of light stand frozen mid-form in the foreground, their pale blue glow flickering toward red. "
             "Outside, the sky above the dark rooftops is lit by a pale flash on the horizon. Tense and still.",
      motion=MOTION_STYLE + "The small figures flicker from blue to red; the horizon outside flashes pale twice, like a "
             "distant storm or something worse. Slow push toward the window.",
      still=("KF-A", (0, 0, 1100), (60, 20, 900))),
    S("17", B(8, 2), 2 * BAR, "Weapons, wars, and now we're f_____", refs=["S1"], gen_dur=5,
      prompt=STYLE + "Top-down close-up of an open paper journal lying on a patterned rug in warm gold lamplight. The hand "
             "of the young woman from the reference (grey hoodie cuff at the edge of frame) holds a pen at the start of "
             "a blank ruled line near the middle of the page. The pages are completely blank, cream paper with faint "
             "blue ruled lines. No writing on the page.",
      motion=MOTION_STYLE + "Her hand writes quickly across the ruled line, then scribbles hard, then writes once more. "
             "Static camera.",
      still=("PROC", "journal", None)),
    S("18", B(9), 2 * BAR, "Keep on looking, keep the faith", refs=["KF-B", "S1"], gen_dur=5,
      prompt=STYLE + "The study at night, medium-wide. The young woman from the reference sits on the rug turning a page of "
             "her journal. Around her, small ninja figures of light stand frozen with a red tinge, and glowing "
             "equations hang still in the air. Warm gold lamplight on her.",
      motion=MOTION_STYLE + "As she turns the page, the red glow drains out of the small glowing figures, they turn pale "
             "blue and start moving again. The warm gold lamplight on her and the room stays exactly the same, warm and "
             "unchanged; only the small figures change colour. Slow push in.",
      still=("KF-B", (300, 60, 1300), (380, 100, 1150))),
    S("19", B(9, 2), 2 * BAR, "Keep up funding, our planet", refs=["KF-A", "S1"], gen_dur=5,
      prompt=STYLE + "Close-up of a wooden bookshelf edge in warm gold lamplight. A glass jar half full of coins sits at the "
             "very edge, with a paper label on it handwritten in marker: \"ATA fund\". The fluffy paw of the "
             "long-haired brown tabby cat from the character sheet reaches up into frame toward it. A few pale blue "
             "lights drift in the dark behind.",
      motion=MOTION_STYLE + "The cat's paw nudges the jar off the shelf; it falls to the wooden floor and the coins spill "
             "out, spinning and circling each other like orbiting planets. Tilt down to follow the jar.",
      still=("KF-A", (1480, 380, 300), (1500, 400, 260))),
    S("20", B(10), 2 * BAR, "Waits for your transmission", refs=["KF-A", "S1"], gen_dur=5,
      prompt=STYLE + "The study from the first image at night, its blue lights dimmed to a faint glow. The young woman from "
             "the character sheet stands at the large window, seen from behind at a three-quarter angle, holding the "
             "warm desk lamp in both hands, its gold light the brightest thing in the frame, facing a dark sky full of "
             "stars.",
      motion=MOTION_STYLE + "The last blue lights fade out; she clicks the lamp off and on, off and on, signalling into the "
             "dark. Static camera.",
      still=("KF-A", (0, 0, 1000), (30, 0, 940))),
    S("21", B(10, 2), 2 * BAR, "Our science has a vision", refs=["KF-A"], gen_dur=5,
      prompt=STYLE + "The view out through the study window from the reference image at night, over dark low rooftops to a "
             "clear sky full of stars. A woman's dark silhouette holding an unlit desk lamp stands at the left edge of "
             "the frame. The sky near the horizon is empty.",
      motion=MOTION_STYLE + "Far off near the horizon, a single point of light blinks once and is gone; she leans forward. "
             "Static camera.",
      still=("KF-A", (60, 0, 560), (100, 20, 480))),
    S("22", B(11), 2 * BAR, "Do you still care", refs=["KF-C", "S2"], gen_dur=5,
      prompt=STYLE + "The first image with the same framing: on the piano bench, the young woman made of translucent pale "
             "blue light, in the black brimmed hat, long dark hair worn down, loose white blouse, a handheld microphone "
             "raised to her lips, eyes closed, starting to sing. She is still forming: blue motes of light stream in from "
             "the room and gather into her shoulders and arms. The piano shows faintly through her. The rest of the room "
             "stays warm and physical in gold lamplight.",
      motion=MOTION_STYLE + "The motes finish gathering into her and she sings into the microphone with feeling. Static camera.",
      still=("KF-C", (300, 0, 1400), (420, 30, 1200)), notes="lip-sync 81.68-85.58"),
    S("23", B(11, 2), 2 * BAR, "…the life out there / Searching for me", refs=["KF-C", "S1"], gen_dur=5,
      prompt=STYLE + "The study at night in warm gold lamplight, a wide shot from the window side. In the foreground at the "
             "window, the young woman in the grey hoodie stands turned away, still holding the desk lamp. In the "
             "background on the piano bench, her younger self from the first image, made of translucent pale blue light "
             "in the black brimmed hat, sings into a microphone.",
      motion=MOTION_STYLE + "The woman at the window turns, sees the glowing singer, and slowly lowers the lamp. Rack focus "
             "from the foreground to the blue figure.",
      still=("KF-D", (0, 0, 1792), (100, 40, 1500))),
    S("24", B(12), 2 * BAR, "Are you still there", refs=["KF-C", "S1"], gen_dur=5,
      prompt=STYLE + "Over-the-shoulder shot from behind the young woman in the grey hoodie, her messy dark ponytail soft in "
             "the foreground, lit warm gold, looking toward the piano bench. On the bench, her younger self from the "
             "first image, made of translucent pale blue light, black brimmed hat, microphone lowered in her lap, looks "
             "up and meets her eyes. The piano shows faintly through the blue figure. Stillness.",
      motion=MOTION_STYLE + "Almost nothing moves: the younger self's eyes lift to meet hers, and they share one breath. "
             "Locked-off camera.",
      still=("KF-C", (560, 0, 900), (600, 20, 820))),
    S("25", B(12, 2), 2 * BAR, "A rare earth looking for a friend", refs=["KF-C", "S1", "S2"], gen_dur=5,
      prompt=STYLE + "Medium-wide shot of the piano bench in the study at night. The young woman in the grey hoodie, lit "
             "warm gold, sits beside her younger self, who is made of translucent pale blue light in the black brimmed "
             "hat and white blouse, with a gap between them on the bench. The long-haired brown tabby cat crouches on "
             "the rug in front, about to jump.",
      motion=MOTION_STYLE + "The cat jumps up onto the bench between them and settles; both women look down at it and smile. "
             "Static camera.",
      still=("KF-C", (200, 200, 1400), (260, 240, 1300))),
    S("26", B(13), 2 * BAR, "(instrumental peak)", refs=["KF-D", "S3a", "S3b"], gen_dur=5,
      prompt=STYLE + "The first image with the same framing, a moment earlier: the two guitarists behind the women are only "
             "faint pale blue outlines, just starting to appear, and the green and magenta stage light is only beginning "
             "to wash across the walls. The empty round poster frame hangs on the back wall. The present-day woman is lit "
             "warm gold; her younger self glows pale blue.",
      motion=MOTION_STYLE + "The two guitarists fade up into full pale blue light, guitars in hand, as the green and magenta "
             "light wash spreads over the walls. Slow push in.",
      still=("KF-D", (0, 0, 1792), (120, 40, 1560))),
    S("27", B(13, 2), 2 * BAR, "(instrumental peak)", refs=["KF-D", "S3b", "S1"], gen_dur=5,
      prompt=STYLE + "Wide shot of the study turned into a small club gig, the walls washed in green and magenta light. The "
             "guitarist in the pale striped shirt from the second image, made of pale blue light, steps to the front "
             "and plays a solo on a natural-wood electric guitar, sparks of light flying off the strings. The guitarist "
             "in the tan flat cap plays acoustic behind him. The younger woman in blue light, black brimmed hat and "
             "microphone, stands beside them. Glowing blue music notes and small ninja figures orbit overhead. The "
             "present-day woman in the grey hoodie stands watching, the only warm gold figure.",
      motion=MOTION_STYLE + "He leans into the guitar solo, sparks of light spraying off the strings on the accents, and "
             "the orbiting lights speed up around the band. Slow arc around the center.",
      still=("KF-D", (900, 150, 900), (980, 180, 800))),
    S("28", B(14), 2 * BAR, "(instrumental peak)", refs=["S1", "S2"], gen_dur=5,
      prompt=STYLE + "Close-up in a glowing study. On the left, the hand of the woman from the first sheet, lit warm gold, "
             "grey hoodie cuff at the wrist, reaches out; on the right, the hand of her younger self from the second "
             "sheet, made of translucent pale blue light with a white blouse cuff, reaches back. The two hands are "
             "raised toward each other, palms facing like mirror images, a small gap between the fingertips. Background: "
             "soft bokeh of blue notes and gold lamplight.",
      motion=MOTION_STYLE + "The hands drift closer until the fingertips almost touch, and a faint shimmer of light crosses "
             "the gap. Static camera.",
      still=("PROC", "hands", None)),
    S("29", B(14, 2), 2 * BAR, "(instrumental peak)", refs=["KF-D", "S1", "S2"], gen_dur=5,
      prompt=STYLE + "Top-down view straight down onto the patterned rug in the study, the brightest frame of the film. At "
             "the center, the woman in the grey hoodie, lit warm gold, and her younger self in translucent pale blue "
             "light with the black brimmed hat face each other, hands raised and almost touching, at the heart of a "
             "wide spiral of pale blue music notes and ribbons of light swirling out across the floor and the moving "
             "boxes. The long-haired brown tabby cat sits at the spiral's edge, looking up.",
      motion=MOTION_STYLE + "The two women turn slowly together and the spiral of light turns with them, getting brighter. "
             "The camera rotates slowly overhead.",
      still=("KF-D", (500, 300, 800), (540, 330, 700))),

    # ------------------------------------------------------------------ ACT 3: THE HANDOFF
    S("30", B(15), 4 * BAR, "(breakdown)", refs=["KF-D", "S1"], gen_dur=10,
      prompt=STYLE + "Medium-wide shot of the study at full glow, warm gold and pale blue, with no green or magenta. At the "
             "back, the two guitarists made of pale blue light hold their guitars. In front, the younger woman in pale "
             "blue light with the black brimmed hat faces the present-day woman in the grey hoodie, lit gold, whose hand "
             "is reaching toward her. Blue notes hang in the air.",
      motion=MOTION_STYLE + "The light drains from the top of the frame downward. The guitarists crumble into drifting blue "
             "dust first, then the younger woman. Hold on the present-day woman's hand, still reaching into the dark. "
             "Slow push in on the hand.",
      still=("KF-D", (0, 0, 1792), (300, 150, 1300))),
    S("31a", B(16), BAR, "(breakdown)", refs=["S4"], gen_dur=4, model="none",
      still=("PROC", "lcd_sink", None)),
    S("31b", B(16, 1), BAR, "(breakdown)", refs=["KF-E", "KF-A"], gen_dur=4,
      prompt=STYLE + "The dark study at night, lit only by cool moonlight, framed on the bookshelves and the wooden wing-chun "
             "training dummy, with no person in frame. A few last pale blue equations fall like leaves back onto an "
             "open book, and faint blue ninja figures beside the dummy are fading into it. The room is near-black blue.",
      motion=MOTION_STYLE + "The glowing symbols settle onto the pages and go dark; the figures fade into the dummy. Static "
             "camera.",
      still=("KF-E", (1150, 250, 640), (1180, 270, 600))),
    S("32", B(16, 2), 2 * BAR, "(pickup: \"Lived…\")", refs=["KF-E", "S1"], gen_dur=5,
      prompt=STYLE + "The dark room from the first image from the same camera angle: the young woman is lowering herself to "
             "sit cross-legged on the rug, the black brimmed hat in both hands, and the long-haired brown tabby cat is "
             "walking toward her lap. The only light is cool moonlight from the window and the small red LED on the "
             "recorder lying on the rug.",
      motion=MOTION_STYLE + "She settles on the rug; the cat climbs into her lap and curls up. Static camera.",
      still=("KF-E", (200, 50, 1400), (300, 100, 1200))),
    S("33", B(17), 2 * BAR, "Lived my life on a pale blue dot", refs=["KF-E", "S1"], gen_dur=5,
      prompt=STYLE + "Close-up of the young woman from the first image in the dark, her face lit faintly red from below by "
             "the recorder's LED and by cool moonlight from the side, eyes wet, looking down. One tiny speck of pale blue "
             "light floats in the dark beside her cheek.",
      motion=MOTION_STYLE + "The blue speck drifts slowly across in front of her face and she watches it go. Static camera.",
      still=("KF-E", (620, 170, 520), (660, 190, 460))),
    S("34", B(17, 2), 2 * BAR, "Your signal here I think I've caught", refs=["KF-E", "S4"], gen_dur=5,
      prompt=STYLE + "Close-up in the dark: the young woman from the first image holds the small silver recorder from the "
             "second image against her ear with both hands, eyes closed, head tilted, the red LED glowing against her "
             "cheek, moonlight along her profile.",
      motion=MOTION_STYLE + "She holds still, listening, breathing softly. Static camera.",
      still=("KF-E", (620, 150, 560), (650, 170, 500))),
    S("35", B(18), 2 * BAR, "The beating blinking of a star", refs=["S4"], gen_dur=5,
      prompt=STYLE + "Extreme close-up of the small red LED on the brushed-silver recorder from the reference image, in "
             "darkness, glowing softly, its red halo on the brushed metal, a hint of cool moonlight at the edge of the "
             "frame.",
      motion=MOTION_STYLE + "The LED blinks slowly. Static camera.",
      still=("PROC", "led", None)),
    S("36", B(18, 2), 2 * BAR, "A planet's transit is not that far from…", refs=["S4", "S1"], gen_dur=5,
      prompt=STYLE + "Low close-up of the silver recorder from the reference image lying on a patterned rug in the dark, its "
             "red LED lit. The fluffy tip of a long-haired brown tabby cat's tail curls into the frame from one side, "
             "about to sweep across it. Moonlight only.",
      motion=MOTION_STYLE + "The fluffy tail sweeps slowly across in front of the LED; the red light dips as it passes, then "
             "comes back. Static camera.",
      still=("PROC", "led", None)),
    S("37", B(19), 2.4, "…my own", refs=["KF-E", "S1", "S4"], gen_dur=4,
      prompt=STYLE + "Close-up in the dark: the hands of the young woman from the first image lift a black brimmed bucket "
             "hat toward her head, while the silver recorder lies on the rug in front of her with its red LED lit. "
             "Moonlight and the LED are the only light.",
      motion=MOTION_STYLE + "She settles the black hat on her head and reaches down for the recorder. Static camera.",
      still=("KF-E", (500, 150, 800), (540, 170, 720))),
    S("38", B(19) + 2.4, 0.3, "(REC click)", model="none", still=("PROC", "black", None)),
    S("39", B(19) + 2.7, B(20) - (B(19) + 2.7), "How could we be alone", refs=["KF-E", "S1", "S4"], gen_dur=6,
      prompt=STYLE + "Close-up of the young woman from the first image in the dark, now wearing a black brimmed bucket hat, "
             "holding the small silver recorder up near her mouth with both hands, its two crossed microphones toward her "
             "lips. The red REC light glows on her face from below; moonlight edges the hat brim. Lips parted, about to "
             "sing.",
      motion=MOTION_STYLE + "She sings softly into the recorder, eyes closing. Very slow push in.",
      still=("KF-E", (600, 140, 540), (640, 160, 460)), notes="lip-sync 146.8-151.9"),
    S("40", B(20), 2 * BAR, "(final lift)", refs=["KF-D", "S1", "S4"], gen_dur=5,
      prompt=STYLE + "The study at night, relit brighter than ever with warm gold and pale blue light mixed through the whole "
             "room: glowing notes and ribbons of light in both gold and blue swirl around the shelves, the piano and the "
             "training dummy. At the center, the young woman in her grey hoodie and a black brimmed hat sits on the rug, "
             "holding the small silver handheld digital audio recorder from the third image (a gadget with a screen and "
             "buttons, NOT a flute) in her lap and looking up in wonder, the tabby cat beside her; she is the only woman in the "
             "frame. Behind her, the two guitarists made of pale blue light are back with their guitars. No green or "
             "magenta. Wide shot.",
      motion=MOTION_STYLE + "The gold and blue lights swirl faster around the room. Slow pull back.",
      still=("KF-B", (200, 100, 1400), (0, 0, 1792))),
    S("41", B(20, 2), 2 * BAR, "(final lift)", refs=["KF-A", "S1"], gen_dur=5,
      prompt=STYLE + "The study window from the first image at night, from inside, with gold and blue light glowing in the "
             "room behind the camera. The young woman from the character sheet, in her grey hoodie and a black brimmed "
             "hat, stands at the window in three-quarter back view, looking up. Far off above the rooftops, one point of "
             "light is noticeably larger and brighter than the stars.",
      motion=MOTION_STYLE + "The distant point of light grows steadily bigger and brighter. Slow push toward the window past "
             "her shoulder.",
      still=("KF-A", (40, 0, 720), (120, 20, 520))),
    S("42", B(21), 2 * BAR, "(final lift)", refs=["KF-A", "KF-F"], gen_dur=5,
      prompt=STYLE + "Through the dark wooden frame of the study window from the first image, with the potted plant "
             "silhouetted on the sill in the foreground, we look not at the night sky but into the other-world room from "
             "the second image: curved living-wood shelves and strange instruments, a rug, a small creature curled "
             "asleep seen only as a dark silhouette, and beyond its own window a sun a little smaller and more "
             "golden-orange than ours hanging low over a misty ocean. Warm, dim light. No faces.",
      motion=MOTION_STYLE + "Slow push in through the window frame into the other room.",
      still=("KF-F", (0, 0, 1792), (200, 100, 1300))),
    S("43", B(21, 2), 2 * BAR, "(final lift)", refs=["KF-F"], gen_dur=5,
      prompt=STYLE + "Close-up in the other-world room from the reference image: a long-fingered, not-quite-human pale hand, "
             "strange but gentle, reaches toward a small handheld recording device of unfamiliar design resting on the "
             "rug, its single button softly lit. Warm, dim golden-orange light from a low sun. No face visible.",
      motion=MOTION_STYLE + "The hand presses the button and a small light on the device comes on. Static camera.",
      still=("KF-F", (600, 560, 800), (680, 600, 680))),
    S("44", B(22), SONG_END - 2.4 - B(22) - 0.0, "(ring-out)", model="none", still=("PROC", "zoomout", None)),
    S("45", SONG_END - 2.4, 2.4, "(silence)", refs=["S4", "ROBOT"], gen_dur=4,
      prompt=STYLE + "Extreme close-up of a small SD memory card with a strip of cream masking tape across it, resting on "
             "top of a small brushed-silver handheld recorder in warm gold lamplight. On the tape, in blue ballpoint "
             "handwriting: \"rare earth — late night solo\" with a tiny doodle of the blue robot from the reference, "
             "and below it, in fresh black ink in the same hand: \"new version\". Shallow depth of field.",
      motion=MOTION_STYLE + "Still, with the faintest drift. The handwriting stays sharp and unchanged.",
      still=("KF-B", (1100, 850, 220), (1110, 858, 200))),
    S("POST", SONG_END, POST, "(post-roll)", model="none", still=("PROC", "photo", None)),
]

BY_ID = {s.id: s for s in SHOTS}


def check():
    prev = None
    for s in SHOTS:
        if prev is not None and abs(prev.end - s.start) > 0.02:
            print(f"gap/overlap {prev.id}->{s.id}: {prev.end:.3f} vs {s.start:.3f}")
        prev = s
    print("total film", PRE + SHOTS[-1].end, "shots", len(SHOTS))


if __name__ == "__main__":
    check()
    for s in SHOTS:
        print(f"{s.id:>5} {s.start + PRE:7.2f} {s.dur:5.2f}  {s.lyric}")


# Camera moves for 'living painting' plates (FrameSource): zoom range, pan px, parallax, focus (0..1), static offset px
CAM = {
    "P1": dict(zoom=(1.0, 1.07), pan=(-20, -8)),
    "2": dict(zoom=(1.0, 1.06), focus=(0.55, 0.4)),
    "5": dict(zoom=(1.10, 1.01), pan=(0, 10), par=0.03),
    "6": dict(zoom=(1.0, 1.04), pan=(-30, 12)),
    "8a": dict(zoom=(1.25, 1.29), offset=(0, -117), par=0.0),
    "8b": dict(zoom=(1.25, 1.29), offset=(-12, 132), par=0.0),
    "11": dict(zoom=(1.02, 1.06), pan=(0, 0), par=0.02),
    "24": dict(zoom=(1.04, 1.05), pan=(0, 0), par=0.01),
    "29": dict(zoom=(1.0, 1.08), pan=(0, 0), par=0.0),
    "30": dict(zoom=(1.0, 1.22), pan=(0, 0), focus=(0.45, 0.38)),
    "34": dict(zoom=(1.02, 1.06), pan=(0, 0), focus=(0.46, 0.48)),
    "39": dict(zoom=(1.0, 1.10), pan=(0, 0), focus=(0.48, 0.45)),
    "41": dict(zoom=(1.0, 1.12), pan=(10, 0), focus=(0.2, 0.15)),
    "42": dict(zoom=(1.0, 1.35), pan=(0, 0), focus=(0.62, 0.35), par=0.04),
    "45": dict(zoom=(1.03, 1.05), pan=(-6, 0), par=0.01),
}
for _s in SHOTS:
    _s.cam = CAM.get(_s.id)

# clip retiming: fit the whole generated move into the shot
BY_ID["30"].speed = 10.0 / BY_ID["30"].dur
