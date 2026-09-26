# Rare Earth — how the video is made

The finished film is drawn entirely by JavaScript/WebGL. Generated video is used the way
an animator uses rotoscope reference: Seedance clips supply motion, faces and lip sync, and
the renderer redraws every frame in the film's own two materials. No raw generated pixel
reaches the screen.

```
 song ──► audio analysis ──► timing.json (words, syllables, beats, sections, spectrum)
                                   │
 character sheets ─┐               ▼
 (gpt-image-2)     ├─► Seedance 2.5 plates ─► plate processing ─► renderer ─► frames ─► film.mp4
 first frames ─────┘   (song slice as           (frames, masks,     (WebGL2,     (ffmpeg)
                        reference audio)         face tracks,        deterministic,
                                                 lip-sync score)     headless)
```

## 1. Audio → `work/audio/timing.json`

The song is never edited. Everything is derived from it:

* **Vocal stem**: UVR MDX separation (`audio-separator`) → `stems/vocals.wav`.
* **Words**: Whisper large-v3-turbo on Cloudflare, run on overlapping chunks with the lyric
  sheet as prompt; then a dynamic-programming aligner (`align.py`, `refine.py`) snaps every
  syllable to vocal onsets and pYIN pitch. A DTW cross-check (`dtwcheck.py`) compares the
  repeated verses (V1 ↔ V4, V2 ↔ V5): they agree within ±50 ms. `finalize.py` holds the
  hand-verified fixes.
* **Beats**: librosa beat tracking with tempo drift, downbeats, kick onsets; section map.
* **Spectrum**: a 64-band log spectrum at 100 Hz (drives the pulsar ridgelines and meters).

`renderer/assets/timing.json` is a copy of the result. Every animation reads the song
clock from it, so type slams land on sung syllables and cuts land on real downbeats.

## 2. Look development

* `docs/STYLE_BIBLE.md` — the two materials, palettes, typography, composition rules.
* Character sheets and first frames: `work/gen/sheets/`, `work/refs/` (gpt-image-2,
  conditioned on the band's real 2011 photos and the key-frame sheets in the repo root).

## 3. Plates — Seedance 2.5 (`pipeline/plates.py`, `pipeline/gen.py`)

19 plates (`work/gen/plates/*.mp4`, 720p, 4–16 s). Each singing plate is conditioned on
its first frame, the character sheets, and **the exact slice of the song it will play
under, passed as reference audio**, so the generated mouth follows the real vocal.

Cloudflare's `/ai/run` is cut at ~30 s from this environment, so jobs are submitted with
`options.background=true` and a webhook. `pipeline/relay/relay_worker.js` (Worker
`rare-earth-video-relay`) receives the webhook, mirrors the result media into KV (chunked
above 20 MB) and `gen.py` polls KV. The webhook path secret lives only in the Worker's
`HOOK_SECRET` binding and in `RELAY_SECRET`/`RELAY_SECRET_FILE` locally.

## 4. Plate processing (`pipeline/process_plate.py`)

For each plate: frames at 24 fps, a person mask (MediaPipe selfie segmenter, half
resolution), and a face track (FaceLandmarker; for small faces a PoseLandmarker-guided crop
is upscaled and re-detected — detection went from 24 % to 99 % of frames on wide shots).
Output: `renderer/assets/plates/<id>/{f*.jpg, m*.png, data.json}`.

**Lip-sync verification** (`pipeline/syncscore.py`): mouth openness from the landmarks is
correlated with the vocal envelope (150 Hz–4 kHz of the separated vocal) over a ±1 s
shift. The best shift becomes the plate's `slip` in the edit, so each plate is re-timed to
the song by its measured offset rather than by eye.

`f*.jpg` are not committed; `python3 pipeline/extract_frames.py` rebuilds them
byte-identically from the committed plates.

## 5. Renderer (`renderer/`)

A deterministic frame renderer: `RENDER.frame(n)` draws frame *n* from scratch, as a pure
function of the song clock, so frames render in any order and in parallel.

* `src/materials.js` — the two materials.
  * **INK** (2026, Earth, present): Kuwahara flattening → 4 anti-aliased tone bands mapped
    through a palette ramp, plate hue partially kept, mid-tone halftone, XDoG ink lines
    (stronger on the person mask), sparkle restored from a high-pass of the source,
    backgrounds relaxed into painted gradients. A drawn anime mouth, driven by the song's
    syllables and vowels and placed by the face track, replaces the generated mouth on
    frontal shots; its skin fill is sampled from the flattened plate around the mouth.
  * **LIGHT** (2011, stage, memory, the other world): emissive halftone dots sampled at
    cell centres with highlight compression, neon XDoG contours with RGB split,
    scanlines.
* `src/space.js` — stars, Earth (Natural Earth land + city lights), the eyeball planet,
  the red dwarf, the pale blue dot, all procedural.
* `src/scenes/*` — plate shots (single, split-screen duet, triptych), space shots, and
  graphics (Big Ear *Wow!* printout filled with this song's vocal, CP 1919 ridgelines from
  the song's spectrum, twin transits, launch alerts, the censored hole, the 2011
  crowdfunding page, JWST unfolding, the radio bubble, the reply bitmap, the end card).
* `src/type.js` — kinetic typography: Archivo hero slams keyed to syllable onsets,
  Instrument Serif italic for tender lines, JetBrains Mono for terminals and labels.
* `src/edl.js` — the edit: ~85 shots and three beat-cut montages, all timed in song
  seconds from `timing.json`.

### Rendering

```
cd renderer && npm install                   # Playwright (headless Chromium, SwiftShader GL)
python3 ../pipeline/extract_frames.py        # plate frames
node render.js stills --shots                # one still per shot  -> work/stills/
node render.js stills --times 21.2,147.1     # specific moments
node render.js film --jobs 3 --w 1920 --h 1080 --crf 14 --out ../out/rare-earth-master.mp4
node render.js film ... --audio ../work/audio/song_sfx.wav   # the sound-design variant
```

A 1080p frame takes 2–8 s on CPU (SwiftShader), so a full render is a few hours on four
cores; `--resume` skips finished segments.

## 6. Sound (optional variant)

`pipeline/sfx.py` writes a separate procedural stem — shortwave static tuning in under the
fade-in, a dropped carrier in the song's censored hole (64.5 s), static returning under the
fade-out — and a preview mix. The main cut uses the song untouched.

## Cost

About $37 of Seedance 2.5 (25 jobs, mostly 720p) and ~$6 of image generation (≈30
images), plus Whisper. Everything after the plates runs locally.
