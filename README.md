# SoundReWave

A microphone-driven **layered pitch-contour looper** for the web (desktop + mobile).
Sing words; your pitch draws in real time. Each **New Layer** press stacks a fresh line
over the previous ones, building up overlapping "sound shapes." Finish to play every take
together and export the mix and the artwork.

> See [`docs/DISCOVERY.md`](docs/DISCOVERY.md) for the full spec, decisions, and build plan.

## Stack

- **React + TypeScript + Vite**, **Tailwind CSS**
- **visx** (D3-backed, renders SVG) for the pitch graph — declarative, vector-native export
- **pitchy** for real-time pitch detection (AnalyserNode + McLeod pitch method)
- **tonal** for note math; raw **Web Audio** for the target tone and (later) mixdown
- **Vitest** (unit), **Playwright** (E2E with fake audio), **Storybook** (component dev)

## Status

| Phase | State |
|---|---|
| 0 — Scaffold (Vite/TS/Tailwind, tests) | ✅ |
| 1 — Live pitch draw + note readout + layering + A3 target | ✅ |
| 2 — Per-loop audio recording (MediaRecorder) | ✅ |
| 3 — Overlapped play-all + A3 tone | ✅ |
| 4 — Export (SVG / PNG / overlapped + sequential WAV) | ✅ |
| 5 — Mobile polish (iOS Safari), CI + GitHub Pages deploy | ✅ |

## Develop

```bash
npm install
npm run dev          # start the app (needs mic + a user gesture)
npm test             # unit tests (Vitest)
npm run typecheck    # tsc project references
npm run build        # production build
```

> The mic needs **HTTPS** (or `localhost`). On iOS Safari, audio only starts inside a
> user gesture — the **Start** button.

## Deploy

`.github/workflows/deploy.yml` builds and publishes to **GitHub Pages** on every push to
`main`. Enable it once in the repo: **Settings → Pages → Build and deployment → Source:
GitHub Actions**. The Vite `base` defaults to `/SoundReWave/` in production (override with
`VITE_BASE`). CI (`ci.yml`) runs typecheck, unit tests, build, and Playwright E2E.
