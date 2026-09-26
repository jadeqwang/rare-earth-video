"""Plate definitions: every Seedance base plate (character or physics shot) that the JS renderer traces over.

Each plate has
  kf_prompt   first-frame keyframe prompt (image model, with character-sheet references)
  refs        character sheets used as references for the keyframe
  motion      Seedance motion prompt
  dur         Seedance duration (s, 4..30)
  audio       (t0, t1) window of the vocal stem to pass as reference audio for lip-sync, or None
  use         song time range where the plate is used (for bookkeeping / sync checks)
  bg          'key' = flat keyable background (renderer paints the environment), 'env' = traced environment

Song times come from work/timing.json. Words (s): Do 3.86 | care 4.76 | You're 5.94 | Searching 9.56 | Are 11.70 |
A rare earth 13.46 | friend 15.70 | Lived 19.55 | Your signal 23.10 | The beating 26.60 | A planet's 30.38 |
How 38.33 | alone 39.90 | Before 57.90 | Weapons 61.28 | [gap 64.45-65.40] | Keep 65.41 | Keep up 69.00 |
Wait 72.22 | Our science 76.44 | Do (V4) 79.82 | Searching 85.76 | Are 87.54 | A rare earth 89.86 |
Live (V5) 126.19 | Your signal 129.42 | The beating 133.16 | A planet's 136.80 | How 144.87 | oh 147-161
"""

W = "/home/user/rare-earth-video/work/sheets/"
J11 = [W + "jade2011_gpt.png"]
J26 = [W + "jade2026_gpt.png"]
CH = [W + "charlie_gpt.png"]
RK = [W + "ricky_gpt.png"]

KF = ("A single frame from a late-1980s Japanese space-opera TV anime (Macross, Gunbuster, Wings of Honneamise era): "
      "clean production cel animation, bold uniform dark ink outlines, flat two-tone cel colors with hard-edged shadow "
      "shapes, crisp small highlights, no gradients on the characters, no painterly texture, no film grain, no text, no "
      "logos, no watermark, 16:9 widescreen. ")
KEYBG = ("The background behind her is a completely flat, uniform, featureless deep navy blue (#1c2552) with no stars, "
         "no clouds, no gradient and no objects. ")
MO = ("Keep the exact 1980s cel-anime drawing style, line weight and colors of the first frame for the whole clip. "
      "Smooth, natural character animation. No camera cuts. ")
SING = ("She sings the reference audio: her lips and jaw move in sync with every sung syllable, opening wide on the "
        "long vowels and closing between phrases. ")

PLATES = {
    # ---------------- Act 0 / I : the question (Jade 2011, night) ----------------
    "P01_rim": dict(
        refs=J11, bg="env", dur=6, audio=None, use=(0.0, 3.86),
        kf_prompt=KF + "Night. Low wide angle: Jade, the young woman from the reference sheet (long straight black hair, "
        "black bowler hat, white blouse and open white cardigan, tiered rust-red skirt, sandals), stands small on the "
        "curved steel rim of a gigantic white radio telescope dish, seen from below, looking up at the sky; the dish's "
        "quadripod legs and receiver rise behind her and the receiver glows soft gold. She stands on the right third of "
        "the frame; the left two-thirds are open sky. The sky is a completely flat, uniform, featureless deep navy blue "
        "(#1c2552) with no stars, no clouds and no gradient. Cool pale-blue rim light on her hair and cardigan.",
        motion=MO + "Night wind: her long hair, cardigan and skirt ripple and flutter. She slowly lifts one hand and cups "
        "it behind her ear, listening to the sky. The dish and sky stay perfectly still. Static camera.",
    ),
    "P02_care": dict(
        refs=J11, bg="key", dur=7, audio=(3.35, 10.35), use=(3.86, 9.2),
        kf_prompt=KF + "Close-up, chest up: Jade from the reference sheet (black bowler hat, long straight black hair, "
        "white blouse and cardigan, silver pendant) on the right third of the frame, three-quarter view turned slightly "
        "toward the left, looking just past the camera with a soft, searching expression, lips slightly parted as if "
        "about to sing. " + KEYBG + "Cool pale-blue rim light from the upper left outlining her hair and cheek; a soft "
        "warm gold light from below right on her chin.",
        motion=MO + SING + "Her head moves gently with the phrasing; a light breeze moves loose strands of hair. She looks "
        "into the camera on 'care'. Static camera, locked off.",
    ),
    "P03_there": dict(
        refs=J11, bg="key", dur=5, audio=(11.3, 16.3), use=(11.70, 13.46),
        kf_prompt=KF + "Medium close-up, waist up: Jade from the reference sheet (black bowler hat, long black hair, white "
        "blouse and cardigan) on the right third of the frame, cupping her right hand behind her ear as if listening to "
        "the sky, eyes lifted upward, lips parted mid-song. " + KEYBG + "Cool pale-blue rim light from the upper left; "
        "soft gold under-light.",
        motion=MO + SING + "She keeps her hand cupped behind her ear, listening, eyes searching the sky above. Hair sways "
        "slightly. Static camera.",
    ),
    "P04_eye": dict(
        refs=J11, bg="key", dur=4, audio=None, use=(15.3, 17.7),
        kf_prompt=KF + "Extreme close-up of Jade's eyes and the brim of her black bowler hat, from the reference sheet: "
        "large dark-brown anime eyes looking up and to the left, each iris holding a tiny bright gold star reflection, "
        "long lashes, a few strands of black hair across her forehead. " + KEYBG + "Cool blue rim light on the brim.",
        motion=MO + "She holds her gaze upward, eyes glistening; one slow blink; the gold star glint in her irises "
        "twinkles. Static camera, very slow push-in.",
    ),
    # ---------------- II : pale blue dot (2011 life montage + the catch) ----------------
    "P05_guitar": dict(
        refs=J11, bg="env", dur=5, audio=(19.1, 24.1), use=(19.55, 21.0),
        kf_prompt=KF + "Night, a small cozy 2011 apartment living room lit by one warm lamp: Jade from the reference sheet "
        "(long black hair, no hat, white blouse, red skirt) sits cross-legged on a worn cream sofa playing an acoustic "
        "guitar, singing softly, eyes half closed. A white 2011 laptop glows on the cushion beside her. Warm lamp light "
        "and deep blue window light.",
        motion=MO + SING + "She strums the acoustic guitar (right hand strumming, left hand shifting chords) and sings "
        "softly, swaying slightly. Static camera.",
    ),
    "P06_rehearsal": dict(
        refs=J11 + CH + RK, bg="env", dur=5, audio=None, use=(21.0, 23.1),
        kf_prompt=KF + "Night, a cramped band rehearsal room in 2011 with foam panels, a string of fairy lights and a "
        "small amp: three friends play together. Left: Charlie (curly hair, beige newsboy cap, charcoal t-shirt, jeans) "
        "strumming an acoustic guitar. Center: Jade (long black hair, black bowler hat, white blouse, red skirt) singing "
        "into a microphone on a stand. Right: Ricky (short spiky black hair, blue-white striped shirt) playing a "
        "natural-wood electric guitar. Warm fairy-light glow, magenta and green practice lights. Follow the attached "
        "character sheets.",
        motion=MO + "The three play and sing together: guitar strumming, Jade sings at the microphone, Charlie nods to "
        "the beat, Ricky grins. Static camera.",
    ),
    "P07_rooftop": dict(
        refs=J11 + CH + RK, bg="env", dur=5, audio=None, use=(21.0, 23.1),
        kf_prompt=KF + "Night, a city rooftop in 2011: seen from behind, Jade (long black hair, black bowler hat, white "
        "cardigan), Charlie (newsboy cap) and Ricky (striped shirt) sit side by side on the rooftop ledge, looking up "
        "at the sky; below them a hilly city glitters with thousands of warm windows and streetlights. The sky above the "
        "city is a completely flat, uniform deep navy blue (#1c2552) with no stars and no clouds.",
        motion=MO + "Gentle wind moves their hair; Jade points up at the sky and the others follow her gaze; city lights "
        "twinkle. Static camera.",
    ),
    "P08_notebook": dict(
        refs=J11, bg="env", dur=4, audio=None, use=(21.0, 23.1),
        kf_prompt=KF + "Night, close on a desk: Jade (long black hair, white blouse) writes song lyrics by hand in an "
        "open spiral notebook, lit by the cool glow of a 2011 white laptop screen and a small desk lamp; a mug of tea and "
        "a handheld audio recorder with two crossed microphones sit on the desk. The notebook page shows only "
        "illegible scribbles.",
        motion=MO + "Her pen moves across the page writing; she pauses, taps the pen, looks up thoughtfully, then keeps "
        "writing. Static camera.",
    ),
    "P09_catch": dict(
        refs=J11, bg="env", dur=6, audio=(22.6, 28.6), use=(23.10, 26.60),
        kf_prompt=KF + "Night, a dark radio-observatory control room in 2011: Jade (long black hair, no hat, white blouse, "
        "white cardigan) sits at a console wearing large over-ear headphones, leaning toward a big monitor on the left "
        "of the frame, her face lit by its glow. The monitor screen is a completely flat, uniform, glowing pale cyan "
        "rectangle with nothing on it. Racks of equipment with small indicator lights behind her. She sits on the right "
        "half of the frame.",
        motion=MO + SING + "She presses one hand to her headphones, listening hard, leans closer to the glowing screen, "
        "and her eyes widen. Static camera.",
    ),
    "P10_alone": dict(
        refs=J11, bg="key", dur=5, audio=(37.9, 42.9), use=(38.33, 41.4),
        kf_prompt=KF + "Close-up, chest up: Jade from the reference sheet (black bowler hat, long black hair, white blouse "
        "and cardigan, silver pendant) on the right third of the frame, face tilted up toward the sky, eyes shining "
        "with tears of wonder, lips parted mid-song. " + KEYBG + "Cool pale-blue rim light from above left; gold "
        "under-light.",
        motion=MO + SING + "She sings with emotion, looking up at the sky, a single tear glints on her cheek. Hair moves "
        "in a breeze. Static camera.",
    ),
    # ---------------- III : the search (2011 SETI benefit gig) ----------------
    "P11_gig": dict(
        refs=J11 + CH + RK, bg="env", dur=6, audio=None, use=(50.27, 54.08),
        kf_prompt=KF + "Dusk at a radio observatory in a high desert valley, 2011: a small outdoor benefit concert. A low "
        "wooden stage strung with warm bulb lights; on it Jade (long black hair, black bowler hat, white blouse and "
        "cardigan, red skirt) sings at a microphone stand, Charlie (newsboy cap) plays acoustic guitar, Ricky (striped "
        "shirt) plays electric guitar. A small audience in silhouette stands in the foreground. Behind the stage, three "
        "huge white radio telescope dishes point straight up at the sky. The sky is a completely flat, uniform deep "
        "violet-blue (#2a2560) with no stars and no clouds.",
        motion=MO + "The band plays: Jade sways and sings, the guitarists strum; the audience sways and a few raise their "
        "hands; the string lights twinkle. The dishes stay still. Static camera.",
    ),
    "P12_charlie": dict(
        refs=CH, bg="key", dur=4, audio=None, use=(50.27, 52.2),
        kf_prompt=KF + "Medium close-up at an outdoor evening concert: Charlie from the reference sheet (2011 version: "
        "curly dark hair, beige newsboy cap, charcoal t-shirt) plays an acoustic guitar, eyes closed, smiling, on the "
        "left third of the frame. The background is a completely flat, uniform deep violet-blue (#2a2560) with no "
        "objects. Warm bulb light from the right.",
        motion=MO + "He strums the acoustic guitar energetically and nods to the beat, smiling. Static camera.",
    ),
    "P13_ricky": dict(
        refs=RK, bg="key", dur=4, audio=None, use=(52.2, 54.1),
        kf_prompt=KF + "Medium close-up at an outdoor evening concert: Ricky from the reference sheet (2011 version: short "
        "spiky black hair, blue and white striped shirt) plays a natural-wood electric guitar, focused, on the right "
        "third of the frame. The background is a completely flat, uniform deep violet-blue (#2a2560) with no objects. "
        "Warm bulb light from the left.",
        motion=MO + "He plays a riff on the electric guitar, fingers moving on the fretboard, head bobbing to the beat. "
        "Static camera.",
    ),
    # ---------------- IV : the filter / the launch ----------------
    "P14_pad": dict(
        refs=[], bg="env", dur=5, audio=None, use=(57.90, 59.8),
        kf_prompt=KF + "Dusk. A huge stainless-steel rocket stands on a coastal launch pad beside a tall steel launch "
        "tower, lit by white floodlights, thin plumes of vapor venting from its sides; low dark scrubland and still water "
        "in the foreground. The sky is a completely flat, uniform dusky violet (#3a2a5a) with no clouds. No people, no "
        "text, no logos.",
        motion=MO + "Vapor vents and drifts from the rocket; floodlights shimmer in the water; the rocket stays still. "
        "Static camera, slow push-in.",
    ),
    "P15_dawn": dict(
        refs=J11, bg="env", dur=5, audio=(65.1, 70.1), use=(65.41, 68.72),
        kf_prompt=KF + "Dawn light through tall windows of a radio-observatory control room: Jade (long black hair, black "
        "bowler hat, white blouse and cardigan) stands up from a console, lifting large over-ear headphones to put them "
        "back on, determined, face lit by the first gold sunlight from the left; monitors glow behind her. She is on "
        "the right third of the frame.",
        motion=MO + SING + "She puts the headphones on and turns toward the window light with a determined look, singing. "
        "Static camera.",
    ),
    "P16_launch": dict(
        refs=[], bg="env", dur=6, audio=None, use=(76.44, 80.7),
        kf_prompt=KF + "Dawn: a huge stainless-steel rocket lifts off from a coastal launch pad beside a tall launch "
        "tower; a blinding gold-white flame and enormous billowing white exhaust clouds spread across the ground; the "
        "sky is gold and pale blue. Low angle, epic scale. No people, no text, no logos.",
        motion=MO + "The rocket rises steadily off the pad on a column of fire, exhaust clouds billow and roll outward, "
        "the tower's water deluge sprays, heat shimmer. Camera tilts up following the rocket.",
    ),
    "P17_crowd": dict(
        refs=[], bg="env", dur=4, audio=None, use=(78.3, 79.8),
        kf_prompt=KF + "Dawn on a beach causeway: a crowd of ordinary people seen from behind and in profile watch a "
        "distant rocket launch, their faces lit gold; some raise their arms, one child sits on a parent's shoulders "
        "pointing. The distant rocket and its bright trail rise over the sea.",
        motion=MO + "The crowd cheers, raises arms and hugs; the child points; wind in their hair. Static camera.",
    ),
    # ---------------- V / VI : 2026 ----------------
    "P18_jade26": dict(
        refs=J26, bg="env", dur=6, audio=(87.2, 93.2), use=(87.54, 92.74),
        kf_prompt=KF + "Night in a small modern apartment in 2026: Jade at 43 from the reference sheet (long black hair "
        "in a loose low ponytail, oversized heather-grey hoodie) sits by a large window, cupping one hand behind her ear "
        "as if listening to the sky; a fluffy brown tabby cat sits on the windowsill beside her. She is on the left "
        "third of the frame, facing right toward the window. The window shows a completely flat, uniform deep navy "
        "(#1c2552) night with no stars. Cool window light and a warm lamp behind.",
        motion=MO + SING + "She keeps her hand cupped behind her ear, gazing out of the window; the cat's tail sways "
        "and it looks up at her. Static camera.",
    ),
    "P20_room26": dict(
        refs=J26 + CH + RK, bg="env", dur=5, audio=None, use=(122.4, 126.2),
        kf_prompt=KF + "Night, a modern radio-observatory control room in 2026 lit only by screens: a small team stands "
        "shoulder to shoulder staring at a huge wall screen (off-frame left), faces lit pale blue: Jade at 43 (grey "
        "hoodie, low ponytail), Charlie at 44 (newsboy cap, grey in his curls, flannel shirt, lanyard), Ricky at 43 "
        "(glasses, navy shirt, headphones around neck) and two other scientists. Tense, hopeful silence. Follow the "
        "attached character sheets.",
        motion=MO + "They hold still, breathing, eyes fixed on the screen; Charlie grips Ricky's shoulder; Jade slowly "
        "covers her mouth with her hands. Static camera.",
    ),
    "P21_v5cu": dict(
        refs=J26, bg="key", dur=6, audio=(125.8, 131.8), use=(126.19, 129.42),
        kf_prompt=KF + "Close-up: Jade at 43 from the reference sheet (long black hair in a loose low ponytail with loose "
        "strands, heather-grey hoodie) on the right third of the frame, three-quarter view facing left, her face lit "
        "pale blue by a screen, eyes shining with held-back tears, lips parted mid-song. " + KEYBG,
        motion=MO + SING + "She sings softly with emotion, a tear rolls down her cheek, she half smiles. Static camera.",
    ),
    "P22_cheer": dict(
        refs=J26 + CH + RK, bg="env", dur=5, audio=None, use=(129.42, 133.16),
        kf_prompt=KF + "A modern radio-observatory control room in 2026 erupting in joy: Charlie at 44 (newsboy cap, "
        "flannel shirt) and Ricky at 43 (glasses, navy shirt) hug and shout, scientists throw papers in the air, Jade at "
        "43 (grey hoodie, low ponytail) laughs with both hands on her head in disbelief, all lit by pale blue screen "
        "light. Follow the attached character sheets.",
        motion=MO + "Everyone cheers, jumps and hugs; papers flutter down through the air; Jade laughs and wipes tears. "
        "Static camera.",
    ),
    "P23_rim26": dict(
        refs=J26, bg="env", dur=6, audio=(143.6, 149.6), use=(144.87, 147.14),
        kf_prompt=KF + "Dawn: Jade at 43 from the reference sheet (olive field jacket over the grey hoodie, low ponytail) "
        "stands on the curved rim of a gigantic white radio telescope dish, low angle, gold sunrise light on her face "
        "and hair, the dish's receiver glowing behind her. She stands on the left third of the frame, the right "
        "two-thirds are sky. The sky is a completely flat, uniform pale gold-peach (#f2c48a) with no clouds and no sun.",
        motion=MO + SING + "Wind ripples her jacket and hair; she cups her hand behind her ear, then slowly opens both "
        "arms wide toward the sky while singing. Static camera, slow push-in.",
    ),
    "P24_group": dict(
        refs=J26 + CH + RK, bg="env", dur=6, audio=None, use=(149.0, 153.0),
        kf_prompt=KF + "Dawn, wide shot from behind: Jade at 43 (olive field jacket, low ponytail), Charlie (newsboy cap) "
        "and Ricky (glasses) stand together on a gravel road among a line of giant white radio telescope dishes that all "
        "point up at the sky, looking up; long gold shadows. The sky is a completely flat, uniform pale gold-peach "
        "(#f2c48a) with no clouds.",
        motion=MO + "They stand together looking up; Charlie puts an arm around Jade's shoulders; wind blows dust and "
        "their clothes; the dishes stay still. Static camera.",
    ),
    "P25_oh": dict(
        refs=J26, bg="key", dur=6, audio=(152.5, 158.5), use=(152.76, 157.5),
        kf_prompt=KF + "Close-up: Jade at 43 from the reference sheet (low ponytail, loose strands blowing, olive field "
        "jacket over grey hoodie) on the left third of the frame facing right, lit by gold sunrise light, tears of joy, "
        "mouth open wide singing a long note. The background is a completely flat, uniform pale gold-peach (#f2c48a) "
        "with no objects.",
        motion=MO + SING + "She sings the long 'oh' notes with her whole heart, eyes closing and opening, joyful tears, "
        "hair blowing in the dawn wind. Static camera.",
    ),
}
