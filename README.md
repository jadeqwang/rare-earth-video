# RARE EARTH — music video

**RNA (Robot Ninja Apocalypse) · written 2011 for a SETI event · video 2026**

Audio: `Rare Earth (Jade vocals re-added).mp3`, untouched.

| File | What |
|---|---|
| `out/rare-earth-1080p.mp4` | **The film.** 1920×1080, 24 fps, 2:52, H.264 High + AAC 256k, under GitHub's 100 MB limit. |
| `out/rare-earth-1080p-sfx.mp4` | Same picture with an optional sound-design layer: shortwave static tuning in under the fade-in, a dropped carrier ("NO CARRIER") in the song's censored gap at 1:04, static returning under the fade-out. The song itself is unchanged; this is a separate stem mixed on top. |
| `out/rare-earth-teaser.mp4` | The first 42 s (the hook through verse 2, ending as the broadcast leaves Earth), for a feed post. |
| `out/rare-earth.srt` | Lyric captions, timed to the sung syllables. |
| `out/thumb-*.jpg` | Stills for the post: the opening frame, the signature pinch, the drop. |

On X, accounts without Premium can post up to 2:20, so the full film needs Premium (or
post the teaser). The opening frame is designed to work as the autoplay thumbnail.

The full-quality master (≈450 MB, 21 Mbps) is not in git; `node renderer/render.js film …`
rebuilds it deterministically (see below).

## The idea

**Starlight is a recording.** A song sent out in 2011 is still travelling, and right now two
listeners are catching it: Jade in 2026, who just found the old recording, and a world
15.8 light-years away (GJ 1002), which the broadcast reaches in 2027. The past self is a
transmission; the present self merges it: `git merge legacy/2011 — 0 conflicts`.

See [`docs/CONCEPT.md`](docs/CONCEPT.md) for the arc and the real science under every
image, and [`docs/STYLE_BIBLE.md`](docs/STYLE_BIBLE.md) for the look.

## How it was made

Every frame is drawn by a JavaScript/WebGL renderer. Seedance 2.5 clips are used only as
rotoscope reference: each singing clip was generated with the exact slice of the song as
reference audio, its lip sync was measured against the separated vocal and re-timed by the
measured offset, and the renderer then redraws it in one of two materials: **INK**
(cel-shaded; the present, Earth) or **LIGHT** (emissive halftone and neon; 2011, the
signal, the other world). Lyrics are typeset against syllable-level timing extracted from
the song, and cuts land on its real downbeats. A frame-by-frame review pass (contact
sheets of every second, a photosensitivity check: at most one large-area flash per second)
drove the final fixes.

Full pipeline and how to re-render: [`docs/PIPELINE.md`](docs/PIPELINE.md).

```
pipeline/     generation client, plate processing and repair, lip-sync scoring,
              sound design, captions, review and delivery tools
renderer/     the film: WebGL2 materials, scenes, kinetic type, edit decision list
work/gen/     the Seedance plates and the character/look sheets they were built from
work/audio/   lyric alignment and timing analysis
docs/         concept, style bible, pipeline
out/          the deliverables
```
