import type { Loop, PitchPoint } from './contour';
import { midiToFreq } from './pitch';
import { layerColor } from './palette';

/**
 * Deterministic synthetic contour for stories/tests: a melodic line over the
 * given MIDI notes with periodic unvoiced gaps (to mimic consonants).
 */
export function demoPoints(seed: number, notes: number[], stepMs = 40, holdMs = 520): PitchPoint[] {
  const points: PitchPoint[] = [];
  let tMs = 0;
  notes.forEach((baseMidi, i) => {
    const steps = Math.round(holdMs / stepMs);
    for (let s = 0; s < steps; s++) {
      // gentle vibrato + a per-seed offset so layers differ
      const vibrato = Math.sin((tMs / 120) + seed) * 0.12;
      const drift = Math.sin((s / steps) * Math.PI) * 0.2;
      points.push({ tMs, freq: midiToFreq(baseMidi + vibrato + drift), clarity: 0.95 });
      tMs += stepMs;
    }
    // consonant gap between notes
    if (i < notes.length - 1) {
      points.push({ tMs, freq: null, clarity: 0 });
      tMs += stepMs * 3;
    }
  });
  return points;
}

export function demoLoop(index: number, notes: number[], seed = index): Loop {
  const points = demoPoints(seed, notes);
  return {
    id: `demo-${index}`,
    index,
    color: layerColor(index),
    points,
    durationMs: points[points.length - 1]?.tMs ?? 0,
  };
}
