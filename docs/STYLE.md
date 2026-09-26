# RARE EARTH v3 — style bible

## One sentence

**A 1988 space-opera OVA, re-inked and lit by a JavaScript renderer, with a 2020s editorial type system on top.**

The plates are shot like a late-80s TV anime: clean ink, flat two-tone cels, painted light (Macross, Gunbuster,
*Wings of Honnêamise*). They are never shown directly. Every frame on screen is redrawn: the character art is traced
to vectors and repainted, skies and space are procedural, and light, type and camera are composited in the browser.
That is the *satsuei* (撮影, compositing) stage of an anime production, done in code.

## Why this style

* **Epic anime without anime-by-numbers.** 80s space opera is the anime of a future people believed in:
  Macross is literally a singer whose song reaches another civilisation, and *Honnêamise* is a launch against
  the odds.
* **It works with the models.** Every image model tested (GPT Image 2.5, Nano Banana Pro, Seedream 5, Grok
  Imagine 2, FLUX.2) renders "late-80s cel anime" consistently, and Seedance 2.5 keeps it through motion.
* **It traces cleanly.** Flat cels and bold outlines turn into crisp vector regions and ink shapes at 1080p
  without the mush of a filtered photo.

## Palette

| Token | Hex | Use |
|---|---|---|
| night | `#060a1a` | sky zenith, ink shadows |
| navy | `#1c2552` | key background for plates (flat, keyable) |
| pale | `#8ecbff` | Earth light, rim light, UI |
| paper | `#f4f1e8` | hero type, whites |
| gold | `#ffcf5a` | the beacon LGM-2, receiver glow, "signal" |
| ember | `#ff8a4c` | the other world |
| violet | `#7b61ff` | the other world's night |
| red | `#ff2d3d` | the Great Filter only (bridge) |
| dawn | `#f2c48a` | final act sky |

Grades used on traced plates (`render/src/scenes/plate.js`): `night`, `lamp`, `dawn`, `screen`, `insta2011`
(the 2011 life montage), and the ramps `signal` and `bluedot` for transmission-style moments.

## Type system

| Role | Face | Setting |
|---|---|---|
| Hero lyric | Noto Serif Display Black, width 62.5, squeezed to 80% | Evangelion title-card energy; stacked, tight leading, word-by-word slams on the sung onset |
| Accent word | Bodoni Moda Italic | one word per card, the emotional hinge ("*still*") |
| Full-height slam | Six Caps | rare single words that fill the frame height |
| Telemetry / subtitle | JetBrains Mono | data UI, timestamps, lower-third lyrics |
| Accent | Noto Serif JP Black | small vertical katakana/kanji lines (anime OP / K-pop teaser flavour) |

Rules: hero type is `paper` with a whisper of glow; it never sits on a busy background. The plates are
composed with the character on one third and flat negative space where the lyric lands.

## Characters (canonical sheets in `design/`)

* **Jade, 2011 (28):** black bowler hat, long straight black hair, white peasant blouse and open cardigan,
  tiered rust-red skirt, sandals, silver pendant.
* **Jade, 2026 (43):** loose low ponytail, oversized heather-grey hoodie, charcoal joggers, grey sneakers; olive
  field jacket at dawn. Brown tabby cat.
* **Charlie:** curly hair, beige newsboy cap. 2011: charcoal tee and acoustic guitar. 2026: grey in the curls,
  stubble, flannel, lanyard.
* **Ricky:** short black hair. 2011: blue-white striped shirt and natural-wood electric guitar. 2026: glasses,
  navy shirt, headphones, lanyard.

## Plate rules (Seedance 2.5)

* Keyframes come from GPT Image 2.5 or Nano Banana Pro, with the character sheets as references, at 16:9.
* Performance plates use a **flat navy background** (`#1c2552`); outdoor skies are flat too. The renderer keys
  them out and paints its own sky.
* The motion prompt always starts with *"keep the exact 1980s cel-anime drawing style"*.
* Singing plates get the **vocal stem** for that exact song window as `reference_audios`. Every take is scored by
  `pipeline/syncscore.py` (mouth-openness vs vocal-energy cross-correlation), and only takes with a single clear
  peak near zero lag are used.

## Rendering rules (JS)

* Characters are drawn **on twos** (12 drawings per second). Camera, light, type and FX run on ones (24 fps).
* Energy flows **into** Earth's instruments: receiver glows, incoming wavefronts. Earth never transmits.
* Post: multi-scale bloom, a red-shifted film halation on highlights, soft shoulder, vignette, fine grain.
