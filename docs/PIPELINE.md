# How the video is made

Everything on screen is drawn by a deterministic JavaScript renderer. Seedance 2.5 video is used only as
reference footage: each plate is traced into vector cels and redrawn, so the generated video itself never appears.

```
song.mp3 ──► stems / beats / onsets ──────────────────────────────┐
                                                                  ▼
character sheets ─► keyframes (GPT Image 2.5 / Nano Banana Pro) ─► Seedance 2.5 plates (+ vocal-stem audio ref)
                                                                  │
                         lip-sync scoring, best take + lag ◄──────┤
                                                                  ▼
                                            rotoscope tracer (plates → vector cels)
                                                                  │
          procedural sky / array / planets / beacon / galaxy ─────┤
          kinetic lyric type (word onsets) ───────────────────────┤
                                                                  ▼
                           render/ (three.js + Canvas2D, headless Chromium) ─► frames ─► ffmpeg + original song
```

## 1. Audio analysis (`pipeline/separate.py`, `timing.py`, `audiofeat.py`)

* **Vocal stem.** UVR MDX-Net (`Kim_Vocal_2`) runs in ONNX with a numpy STFT, giving `stem_vocals.wav` and
  `stem_instrumental.wav`.
* **Words.** Whisper (large-v3-turbo on Cloudflare) runs on the stem. Onsets are corrected by hand against the
  vocal envelope, and the lyric sheet is mapped onto the sung words, so display text and timing stay separate.
* **Beats.** A spline beat map follows the tempo drift (about 124 → 126.8 BPM). Downbeats are on phase 0.
* **Envelopes.** Per-frame (24 fps) kick, snare, hat, bass, vocal and loudness curves, plus kick and snare
  onset lists, drive every pulse in the film. The beacon star blinks on the song's kicks.

The song is never modified. The final mux uses the original track.

## 2. Plates (`pipeline/plates.py`, `imggen.py`, `run_plates.py`, `cf.py`, `relay/`)

* **Keyframes.** 24 are painted with GPT Image 2.5 or Nano Banana Pro from the character sheets in `design/`,
  in a single late-80s cel style (see `docs/STYLE.md`). Backgrounds are flat so they can be keyed out.
* **Plates.** Seedance 2.5 renders 720p, 24 fps plates from each keyframe.
  * Singing plates also get the **vocal stem cut to that shot's window** as `reference_audios`, so the
    performance is timed to the real song.
  * Long jobs run through a small Cloudflare Worker relay (AI Gateway background runs + webhook, with a cron
    fallback that mirrors the media into KV).

## 3. Lip-sync verification (`pipeline/syncscore.py`, `syncstrip.py`)

* **Take selection.** For every singing take, the mouth is template-tracked from a hand-marked seed point.
  Mouth openness is then cross-correlated with the vocal envelope over the exact window the edit uses. The best
  take and its lag are stored in `render/src/shots/lib.js` (`TAKES`). The renderer plays plate frame
  `t − a0 + lag`.
* **Final check.** `syncstrip.py` checks the *final render*. It makes a filmstrip of the mouth at the drawing
  rate, with the vocal envelope and word onsets drawn underneath, one row per second.

## 4. Rotoscope (`pipeline/trace.py`)

Each plate frame (on twos, 12 drawings per second) becomes vector data:

1. A per-plate colour model (hue-weighted Lab k-means) flattens the frame into cel regions.
2. The regions are traced into smoothed polygons (OpenCV contours at 1.5× resolution).
3. XDoG ink lines become filled ink shapes.
4. A key silhouette is taken from the flat background colour.

The renderer redraws these with its own palette grades, a dark base under the mosaic, and a rim light computed
from the silhouette. Keyed backgrounds are replaced by procedural skies, rooms and space.

## 5. Renderer (`render/`)

* `render/index.html` boots a three.js (WebGL2) + Canvas2D compositor. `window.renderFrame(f)` draws frame
  `f` as a pure function of song time.
* **Shots** live in `src/shots/act*.js`: an edit decision list of about 50 shots, each with `t0`/`t1` in song
  seconds.
* **Scenes:** `src/scenes/`
  * toon-shaded dish array with beat choreography
  * cel-shaded Earth (Natural Earth coastlines, city lights)
  * the tidally locked other world
  * the LGM-2 transit beacon
  * a 160k-point galaxy
  * sky: baked Milky Way, point-catalogue stars, flare sprites
  * data graphics
* **Type:** `src/type.js`. Lyrics slam in on their sung onsets.
* **Post:** `src/post.js`
  * multi-scale bloom
  * red film halation
  * soft shoulder
  * vignette
  * grain
  * impact frames
* **Frames:** `node tools/render.mjs --from 0 --to 4137 --workers 3 --out ../work/frames --mux out.mp4`
  renders frames in parallel headless Chromium (SwiftShader) workers and muxes them with the song.
  `--stills 12.5,40` renders single frames for review.

## Rules the film keeps

* **Earth only listens.** Energy always flows *into* our dishes. The film has no outgoing beams, no radio
  bubble, and no "here is where we live" messages. The other world is the one that chose to shine.
* **The other world is only seen zoomed out.** It appears as lights, structures and signals, never as beings.
* **Facts on screen are real or clearly part of the story.** The years montage lists real milestones. LGM-2, its
  planet and the 2026 detection are the film's fiction, and their numbers are physically consistent: an M dwarf,
  a planet in its habitable zone, a 15-day period and a 0.13% transit depth.
