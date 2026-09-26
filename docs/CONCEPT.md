# RARE EARTH — music video concept

*RNA (Robot Ninja Apocalypse), written 2011 for a SETI event · video 2026*

## The idea in one line

**Starlight is a recording.** A song sent out in 2011 is still traveling — and right now
two listeners are catching it at the same time: Jade in 2026, who just found the old
recording, and a world 15.8 light-years away, which the broadcast reaches in 2027.

## Why this is true (the nerd layer, all checkable)

| Fact | Where it shows up |
|---|---|
| April 2011: SETI's Allen Telescope Array (Hat Creek, CA) went dark for lack of funding. Crowdfunding (SETIStars, ~$200k) + an Air Force contract restarted it in Dec 2011. | *"Keep up funding, our planet waits"* — the 2011 crowdfunding bar |
| Dec 5 2011: Kepler-22b, first transiting planet in the habitable zone of a Sun-like star. | *"A planet's transit is not that far from my own"* — twin light curves |
| Pale Blue Dot: Voyager 1, 14 Feb 1990, ~6 billion km. | The opening frame and the closing frame |
| GJ 1002: red dwarf 15.8 ly away with two Earth-mass planets in its habitable zone (announced Dec 2022). A signal leaving Earth in 2011 reaches it in ~2027; a reply would arrive ~2043. | The other world; the end card: *reply ETA 2043 — keep listening* |
| CP 1919, the first pulsar — its stacked plot became the *Unknown Pleasures* cover. | *"The beating blinking of a star"* — drawn from this song's own spectrum |
| Artemis II flew four people around the Moon in April 2026. | The "good launch" in verse 3 |

## Two conversations, one shape

1. **Earth ↔ another world.** Search, signal, doubt, faith, reception, reply.
2. **Jade 2026 ↔ Jade 2011.** The past self is a transmission; the present self catches it.
   *git merge legacy/2011 — 0 conflicts.* ("0 conflicts" also answers *"weapons, wars"*.)

Both conversations ask the same question — *are you still there?* — and both get the same
answer at the drop.

## Arc (keyed to the song — `renderer/src/edl.js` has the frame-exact edit)

| Time | Section | What happens |
|---|---|---|
| 0.0–3.8 | intro | The Pale Blue Dot with a hero-sized YOU ARE HERE on frame 0. Zoom into Earth's night side → one light → match-cut to the recorder's LED. |
| 3.8–19.5 | V1 (hook) | The band slams in with 2011 Jade on stage (LIGHT). 2026 Jade finds the recorder (INK). Title drop on *"rare earth"*. |
| 19.5–41.2 | V2 | Pale blue dot pinched between two fingers (the signature gesture). The ATA dishes turn in unison; a *Wow!* printout. Pulsar ridgelines. Twin transits. *How could we be alone.* |
| 41.2–57.8 | break | The broadcast leaves Earth: solar system flyby, then the radio bubble expanding across real neighbouring stars, each labelled with the year it's reached … GJ 1002, 2027. Cliffhanger. |
| 57.8–80.4 | V3 | Launches and self-destruct; weapons, wars — and the song's own censored hole (64.5–65.5 s is near-silence) becomes a blackout. Then the turn: keep looking, the 2011 crowdfunding bar, headphones, JWST's mirror unfolding on *"our science has a vision"*. |
| 80.4–94.8 | V4 | Split-screen duet: 2011 Jade (LIGHT) and 2026 Jade (INK) sing the hook together; the seam pushes in to both faces, tilts, and `git merge legacy/2011` types above them; then they share one frame on the roof. |
| 94.8–126.1 | bridge | The other world (kept zoomed-out): eyeball planet around a red dwarf, a ring of cities on the terminator, a vast array turning. The signal arrives; the whole terminator listens; they compose a pixel reply and send it. *Reply ETA 2043.* |
| 126.1–147.0 | V5 | Intimate: 2026 Jade on a rooftop before dawn, headphones, singing along; her 2011 self fades in beside her. Cuts accelerate. Then silence: *how … could … we … be … alone* |
| 147.0–162.2 | outro (drop) | Contact. Impact frame. Everything at once: both Jades, the band, both worlds' dishes in unison, the real 2011 RNA photos, **0 CONFLICTS**. |
| 162.2–172.4 | tail | Pull back to the pale blue dot; a faint line to a red dot. *Signal departed 2011 · arrives GJ 1002 2027 · reply ETA 2043 · keep listening.* |

Earth gets well over half the running time; the other world stays wide.

## Signature image ("killing part")

A hand holding a pale blue dot of light between thumb and forefinger, on *"pale blue dot"*
in V2 (22.4 s), and again as a flash-frame in the drop montage. `out/thumb-pale-blue-dot.jpg`
is the alternate thumbnail; the default one is frame 0, the pale blue dot with YOU ARE HERE.

## Attention plan

* Frames 0–30 must work muted: a single iconic image in motion (the dot), then giant type.
* First 20 s: hero-scale lyrics on every line. After that, vary: integrated type (screens,
  plots, labels), subtitles for intimate moments, and hero type again for each hook return.
* Big lyrics sit in the negative space opposite the subject (subject right ⇄ type left).
* Cuts land on downbeats or on the sung syllable; the censored hole and the drop are the two
  hardest cuts in the piece.
