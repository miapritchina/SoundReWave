# SoundReWave — Project Plan

> Forward-looking roadmap. For the agreed scope and architecture, see
> [`DISCOVERY.md`](DISCOVERY.md). This doc is about **what's next and in what order.**

## Where we are

The v1 MVP is built, tested, and pushed on `claude/pitch-graph-layering-app-dui7jp`.

| Phase | Scope | State |
|---|---|---|
| 0 | Scaffold: Vite + React + TS + Tailwind, Vitest, Storybook, Playwright | ✅ |
| 1 | Live pitch draw (visx/SVG), note axis, gap-bridging, layering, A3 flash, tuner readout | ✅ |
| 2 | Per-take audio recording (shared mic stream + MediaRecorder) | ✅ |
| 3 | Overlapped play-all, A3 chime | ✅ |
| 4 | Export: SVG + PNG art, overlapped + sequential WAV | ✅ |
| 5 | Mobile/iOS polish, CI + GitHub Pages deploy | ✅ |

**Verification in place:** 15 unit tests, 6 Playwright E2E (desktop + mobile, fake-audio)
covering detect → layer → finish → play → export. Clean typecheck, ~70 kB gzip build.

## Immediate next steps (to call v1 "done")

Ordered by value. None are blocked.

1. **Enable GitHub Pages** — repo *Settings → Pages → Source: GitHub Actions*. Then merge to
   `main` auto-deploys. _(User action; ~1 min.)_
2. **Real-device pass** — the fake-audio E2E proves the pipeline, but not mic quality on real
   hardware. Test on: desktop Chrome, iOS Safari (a real iPhone), Android Chrome. Watch for
   detection stability on actual voice, recording mime quirks, and gesture/permission UX. _(M)_
3. **Open the PR** and wire CI as a merge gate. _(S)_
4. **A3-bleed decision** — confirm whether the chime bleeding into the open-mic take is
   acceptable, or ship the visual-only toggle as default. _(S)_

## Backlog (prioritized)

### P1 — polish that users will feel
- **Detection tuning on real voice** — expose/auto-tune `clarityThreshold` & `rmsThreshold`;
  words at low volume may drop out or noise may leak. Consider a short median smoothing on the
  pitch stream to steady the line. _(M)_
- **Countdown + recording indicator** — a 3-2-1 before a take and a clear "recording" pulse so
  layering feels intentional. _(S)_
- **Playback scrub / per-take preview** — even without a full mixer, letting the user hear one
  take before committing helps. _(M)_
- **Empty/again affordances** — undo last layer, clear session confirm. _(S)_

### P2 — capability the spec deferred
- **AudioWorklet detection** — move pitch off the main thread if long sessions or low-end
  phones stutter. Escalation path already noted. _(M)_
- **MP3 export** — via `lamejs` in a Web Worker (slow on mobile — keep WAV default). _(M)_
- **IndexedDB persistence** — survive reload; store blobs + points, add a restore UI and quota
  handling. _(L)_
- **PWA** — installable, offline shell. _(M)_

### P3 — reach and richness
- **Per-loop controls** — the "full mixer" (mute/solo/volume/delete/re-record) if play-all-only
  proves limiting. _(L)_
- **Loudness encoding** — line thickness/opacity by RMS for a richer "sound shape". _(S)_
- **Configurable target note** + hold-to-trigger, tuner mode. _(S)_
- **Shareable art** — copy-link/share-sheet for the SVG/PNG. _(M)_

## Testing & quality plan (ongoing)
- Grow Storybook coverage: `NoteReadout` (in-tune/flat/sharp), `ExportPanel` states, a finished-
  session composite.
- Unit-test `wav.encode` (header bytes, sample count) and mixdown durations with a stub
  `OfflineAudioContext`.
- Add a Playwright visual snapshot of the graph for regression.
- Wire `npm run e2e` into CI (already scaffolded in `ci.yml`).

## Open decisions to confirm
- Deploy target = GitHub Pages (assumed). Vercel/Netlify are drop-in if preferred.
- WAV-only for v1 (MP3 deferred).
- Ephemeral session for v1 (persistence deferred).
- Aesthetic direction: current dark "studio" theme — keep, or push further with a
  design pass (`frontend-design`).

## Effort key
S = <½ day · M = ~1 day · L = multi-day
