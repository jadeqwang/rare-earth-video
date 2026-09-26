# RARE EARTH — style bible

Everything on screen is drawn by the JavaScript renderer. Generated images and Seedance
clips are *plates*: reference footage the renderer reads (luminance, edges, masks, face
landmarks) and redraws. You never see a raw plate.

## Two materials

The film is built from exactly two materials. Which one a shot uses is a story decision.

### INK — the present, Earth, things you can touch
* Flat-tone cel: Kuwahara-smoothed plate → 4 tone bands → per-scene 4-stop colour ramp.
* Halftone screen (≈6 px cells @1080p, 30°) only inside the two middle tones.
* Ink contour (XDoG) in the scene's darkest stop; strong on the subject, faint on the set
  (segmentation mask modulates line weight).
* Characters are cel; backgrounds are painted: behind the person mask the tone bands relax
  into a continuous gradient, so skies never tear into posterised bands.
* Faces: on frontal singing shots a drawn anime mouth (shape from the song's syllables and
  vowels, position from the face track) replaces the generated one.
* Characters animate on twos (12 fps holds); camera and type move on ones (24 fps).
* On kicks in the loud sections the picture (never the type) punches in by 1–2 %.

### LIGHT — the signal, 2011, space, the other world
* Black field. Image = emissive halftone dots (radius ∝ √luminance), 7 px cells, 30°.
* Neon ink: the same XDoG contour, but *added* as light (white or tinted), with bloom.
* 2011 footage additionally gets 4 px scanlines, 1.5 px RGB split, and an orange LCD
  date stamp (`'11 04 23`) like a 2011 point-and-shoot.

Transition between materials = a scan line sweeping across the frame (decode), or a
particle dissolve (dots lift off INK and become stars).

## Palettes (ramps are shadow → highlight)

| Scene | Ramp |
|---|---|
| INK room/night | `#0B1026` `#2E3170` `#F29E4C` `#FFF1D6` + window `#9CC8FF` |
| INK rooftop/dawn | `#13183A` `#4B4C8C` `#FF8A6B` `#FFE9C7` |
| INK desert array | `#0A1430` `#3B5B8F` `#E9B872` `#F6EEDC` |
| LIGHT 2011 stage | black · `#7A3CFF` · `#FF2D95` · `#3DFFB2` (stage green) · white |
| LIGHT space | black · `#1B2A5A` · `#9CC8FF` (pale blue) · white |
| LIGHT other world | black · `#7A0F2B` · `#FF4B2B` (red dwarf) · `#2FE6D3` (their lights) |
| CONTACT (drop) | all of the above at full saturation; cream flash frames `#FFF6E8` |

Accent rule: magenta = 2011, amber = 2026, teal = the other world, pale blue = Earth/signal.

## Typography

* **Hero** — *Archivo* variable (wdth 62–125, wght 800–900), ALL CAPS, tight tracking.
  Slams on the sung syllable: 2-frame overshoot (scale 1.08→1), 1 frame of white flash on
  hits, width animates with the kick.
* **Voice** — *Instrument Serif* italic for tender words (*friend*, *alone*, *the life out
  there*, *from my own*). Never all caps.
* **Machine** — *JetBrains Mono* for terminals, data labels, subtitles, coordinates.
* Hero type fills 55–90 % of frame width. Subtitles sit at 8 % from the bottom-left.
* Censored word is rendered as `( )` — an empty pair of brackets on black.

## Composition rules for plates (prompts must say these)

1. One subject, strong rim light, simple silhouette; low-clutter backgrounds.
2. Leave half the frame as clean negative space (sky, dark wall, stage haze) on the side
   opposite the subject, for type.
3. Lighting keywords do the heavy lifting: *single warm desk lamp*, *magenta and green
   stage spotlights with haze*, *pre-dawn blue hour*, *red dwarf sun on the horizon*.
4. Anime key-visual rendering (clean line art, cel shading) — never Pixar/3D.

## Characters

| Who | Look |
|---|---|
| **Jade, 2011** (28) | black bucket hat, long straight black hair, loose white linen shirt with rolled sleeves, rust-red tiered skirt, brown sandals, thin silver necklace, handheld mic. Warm, eyes-closed singer. |
| **Jade, 2026** (43) | same face, older and calmer; hair up in a loose messy bun; heather-grey oversized hoodie, dark joggers; sometimes over-ear headphones. |
| **Charlie** | grey flat cap, dark curly hair, charcoal tee, acoustic guitar, jeans. |
| **Ricky** | short black hair, blue-and-white striped shirt, natural-wood electric guitar, jeans. |
| **The cat** | fluffy brown tabby, green eyes. |
| **The recorder** | handheld digital recorder with crossed X/Y mics, small LCD, red REC LED. |
| **The other world** | never individuals. Cities as light, arrays as silhouettes, planet from orbit. |
