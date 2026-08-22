# SoundReWave — Sound analysis & synthesis ideas

Captured from discussion, not yet built. The key enabler for most of these is
**time-aligned takes** — which fixed-length loop mode now provides (all takes
share the same `[0, L]` window, so "the same moment" lines up across layers).
Without alignment (free-length manual loops), align first via DTW.

## Median / consensus "sound"

The Bloom graph already shows a *median shape*: it's a per-time histogram of
pitch, and the bright ridge is the mode/median. The audio analogs:

- **Median melody (easy — data already stored).** Per time frame, take the
  median pitch across takes → one clean consensus contour, robust to a few bad
  takes. Draw it as a bold guide line; play it through a synth, or pitch-shift
  one real take onto it. Export as MIDI.
- **Median timbre (medium — needs FFT).** You can't median raw samples (phase
  cancellation → mush). Instead median the **magnitude STFT** across takes per
  frequency bin, then invert with one take's phase or Griffin–Lim. Result: a
  denoised "prototype utterance" — like an *average face*, but for your word.

## What's NOT in the median (the interesting half)

- **Residual = take − median** (pitch or spectrogram domain). What's left is the
  character: wobble, ornament, off-pitch slides, breaths, mistakes. Playable as
  an "expressiveness/chaos" layer with the consensus removed.
- **Disagreement / variance map.** Per time-frequency cell, variance across
  takes → heatmap of where you were consistent (stable vowels) vs. all over the
  place (consonants, hard notes). Doubles as a pitch-training guide.
- **Outlier take finder.** Rank takes by distance from the median → surface the
  weird one to keep or toss.

## Other cool directions

**Cheap (we already have per-take pitch contours):**
- Harmonize — shift each layer to a chord interval off the median → chords from
  mono loops.
- Quantize pitch to a scale.
- Faint **ghost guide** = the median line to sing against (gamified training).
- Export the median melody as MIDI.

**Medium:**
- **Tighten** — pitch-correct + time-align all takes to the median for a tight
  unison chorus instead of a loose blur.
- **Density heatmap** visual style — the pitch histogram over time as a glowing
  ridge (the literal "median shape").
- Color the contour by **timbre/brightness** (spectral centroid) instead of
  pitch.

**Playful:**
- Canon (delay each layer), reverse takes, granular stutter, tempo-locked
  rounds.

## Prerequisites / building blocks
- **Alignment:** fixed-length loops (done) or DTW between takes.
- **FFT + inverse (Griffin–Lim)** for any spectral-domain median/residual.
- **Onset detection** to mark syllables; **loudness envelope** as a second lane.
