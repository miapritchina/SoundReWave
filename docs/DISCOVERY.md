# SoundReWave — Discovery Spec & Build Plan

> Status: **Discovery complete, pending review.** No feature code yet.
> This document is the agreed scope before implementation begins.

## 1. Concept

A microphone-driven "pitch painting" looper for the browser (desktop + mobile web).

You sing **words** into the mic. The app detects your pitch in real time and draws
your pitch contour as a line across a note graph. Pressing the main button ends the
current take and **starts a new layer drawn over the previous ones**, building up a
stack of overlapping "sound shapes." When you finish, all recorded takes play back
**together** (real audio, overlapped), and you can **export** the mix and the artwork.

It is part vocal looper, part Praat-style intonation visualizer, part generative art toy.

## 2. Locked decisions

| Area | Decision |
|---|---|
| Input | Microphone only, **monophonic** (one voice), singing **words** |
| Detection | Real-time pitch → nearest note, A440 reference |
| Graph — X axis | **Resets each loop**; layers **overlay** in the same window |
| Graph — gaps | **Bridge** short unvoiced gaps so each layer reads as a flowing line |
| Graph — encoding | **Pitch only** (loudness not encoded) |
| Main button | **End current loop + start a new layer**; a separate **Finish** ends the session |
| Storage / playback | **Real recorded mic audio** per loop; overlapped mix (all start at t=0) |
| Loop timing | **Free length**, no tempo/metronome grid |
| Target note | **Fixed A3, momentary** (+ small cents tolerance & debounce) |
| A3 feedback | **Play a tone** (visual-only toggle offered as escape hatch) |
| Loop controls | **Play-all only** (no per-loop mute/solo/volume) |
| Export | **WAV/MP3** (overlapped mix + one long sequential track), **SVG** (preferred) + **PNG** of graph |
| Persistence | **Ephemeral / in-memory** for v1 — export is the durability story |
| Platform | **Mobile-essential**, responsive, iOS Safari–aware |
| Stack | React + TypeScript + Tailwind + Vite; Tone.js, pitchy, tonal; Storybook + Playwright + Vitest |

### Assumed defaults (redirect if wrong)
1. **Y axis:** log-frequency, labeled with note names over a vocal range (~E2–C6), fixed
   (not auto-zooming), with faint octave gridlines.
2. **Layer colors:** each new layer gets a fresh palette color; older layers dim slightly
   so the newest reads clearly.
3. **No live monitoring** — you won't hear yourself while recording (avoids feedback howl).
4. **Soft limits** to protect mobile memory (gentle warning past ~8 loops / long takes)
   rather than hard caps.

## 3. Why "words" matters (design consequence)

Sung words are not a continuous tone. **Vowels are voiced** (clear pitch); **many
consonants (s, t, k, f, p) are unvoiced** and carry no pitch. A real-time detector
therefore produces a **broken, gappy contour** — pitch on vowels, nothing on
consonants. We decided to **bridge short gaps** (pen stays down, interpolating across
brief unvoiced spans up to a threshold; longer silences lift the pen). The A3 target
only registers on voiced vowels.

## 4. Architecture

### 4.1 Audio pipeline
```
getUserMedia (mic)
   │
   ├─► Analysis path:  AudioWorklet → pitchy (McLeod pitch) → {freq, clarity, rms} per frame (~30–50ms)
   │                       └─ gate by clarity + RMS to decide voiced/unvoiced
   │
   └─► Recording path: MediaRecorder → one Blob per loop → decodeAudioData → AudioBuffer
```
- For detection quality we lean toward **disabling** `noiseSuppression` / `autoGainControl`
  (cleaner pitch), accepting slightly rawer recorded audio — flagged as a tunable trade-off.
- AudioContext + all audio start **only on a user gesture** (Start button) — required by
  iOS Safari and good practice everywhere.

### 4.2 Session state machine
```
idle ──Start──► recording ──"New layer"──► recording (commits take, resets X, new take)
                    │
                    └──Finish──► finished ──► Play-all / Export
```

### 4.3 Data model
```ts
type PitchPoint = { tMs: number; freq: number | null; clarity: number }; // null freq = pen-up
type Loop = { id: string; index: number; color: string; audioBuffer: AudioBuffer;
              points: PitchPoint[]; durationMs: number };
type Session = { loops: Loop[]; sampleRate: number };
```

### 4.4 Rendering
- **Live:** Canvas 2D under `requestAnimationFrame`. Committed layers painted once (dimmed);
  the active line updates each frame. `freq → y` via log scale over `[fMin, fMax]`;
  `tMs → x` via elapsed time within the window. Gap-bridging interpolates across short
  unvoiced spans, lifts the pen beyond the threshold.
- **Export is vector-first:** the per-loop `points` arrays are the source of truth. We
  serialize one `<path>` per layer into an **SVG** string (crisp, preferred), and rasterize
  that SVG to **PNG** via an offscreen canvas. Canvas stays purely for live performance.

### 4.5 Audio export
- **Overlapped mix:** `OfflineAudioContext`, duration = longest loop; schedule every buffer
  at t=0; render → `audiobuffer-to-wav` → WAV. Apply gain staging / limiter to avoid clipping
  when many layers sum.
- **One long track:** `OfflineAudioContext`, duration = sum of loop lengths; buffers scheduled
  back-to-back in record order.
- **MP3:** optional via `lamejs` (slower, esp. on mobile) — default WAV, MP3 as opt-in.

## 5. Mobile / iOS Safari notes
- Audio + mic start on a user gesture; deployment needs **HTTPS**.
- `MediaRecorder` mime differs (`audio/webm` Chrome vs `audio/mp4` Safari) — feature-detect;
  `decodeAudioData` handles both for mixing.
- Handle AudioContext **suspend/resume** on tab-switch / interruptions.
- Big touch target for the main button; portrait-first layout; graph sized to viewport.
- Vibration API is limited on iOS (we chose tone feedback anyway).

## 6. Component / hook plan
**Hooks:** `useMicPitch()` (stream + worklet + pitchy), `useLoopRecorder()` (MediaRecorder
lifecycle per loop), `useSession()` (state machine + loop store).

**Components** (presentational ones fed props → Storybook-friendly):
- `MicPermissionGate` — request + error/denied states
- `PitchCanvas` — live layered contour
- `NoteAxis` — note-name / octave gridlines
- `TransportBar` — Start · New Layer · Finish
- `TargetNoteIndicator` — A3 hit flash/badge
- `PlaybackPanel` — Play-all in finished state
- `ExportPanel` — WAV (mix / sequential), SVG, PNG (+ optional MP3)

## 7. Testing plan
- **Vitest (unit):** pitch→note math, `freq→y` mapping, gap-bridging, WAV encoding, mixdown
  duration scheduling.
- **Storybook:** stories for `PitchCanvas` (empty / one layer / many layers / gap-bridged /
  A3 flash), `NoteAxis`, `TransportBar`, `ExportPanel`, `MicPermissionGate` — all driven by
  fixtures, no mic needed.
- **Playwright (E2E):** Chromium fake media
  (`--use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<wav>`) feeds a known
  tone; assert a line renders, A3 triggers, layering works, and export produces a download.
  Include a **mobile viewport** project.

## 8. Risks / decisions to revisit
- **A3 tone bleeds into the open-mic recording** (tone chosen). Mitigation: short/quiet tone;
  visual-only toggle available. Revisit if bleed is objectionable.
- **Noise-suppression/AGC off** helps pitch but yields rawer audio in noisy rooms — tunable.
- **Clipping** on many-layer mixdown → gain staging / limiter required.
- **MP3 perf/size** on mobile (`lamejs` slow) → WAV default, MP3 optional.
- **Memory** — many raw audio buffers on a phone → soft cap + warning.
- Detection→draw **latency** is small but non-zero; acceptable for this toy.

## 9. Phased build order
- **Phase 0 — Scaffold:** Vite + React + TS + Tailwind; Storybook; Playwright (with fake-audio
  setup) + Vitest; scripts/CI-ready.
- **Phase 1 — Live pitch draw:** mic gate, AudioWorklet + pitchy, `PitchCanvas` + `NoteAxis`,
  single continuous gap-bridged line (no loops yet). Storybook fixtures.
- **Phase 2 — Layering + recording:** state machine, "New layer" resets X and commits dimmed
  layer, `MediaRecorder` per loop, Finish.
- **Phase 3 — Playback + A3:** overlapped play-all; A3 detection + tone feedback.
- **Phase 4 — Export:** SVG + PNG of graph; WAV overlapped + sequential; optional MP3.
- **Phase 5 — Mobile polish:** iOS Safari audio handling, responsive/touch UI, soft caps,
  optional PWA.

_Cross-cutting: Playwright E2E, Storybook coverage, and unit tests grow with each phase._
