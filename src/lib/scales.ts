import { midiToFreq, midiToName, freqToMidi } from './pitch';
import type { Loop, PitchPoint } from './contour';

export const DEFAULT_FMIN = midiToFreq(40); // E2 ~ 82 Hz
export const DEFAULT_FMAX = midiToFreq(84); // C6 ~ 1047 Hz

export interface NoteTick {
  freq: number;
  name: string;
  /** C and A notes are "major" ticks (labeled, brighter gridline). */
  major: boolean;
}

/**
 * Note gridline ticks within [fMin, fMax]. Every semitone is a candidate,
 * but only C and A notes are labeled to keep the axis legible.
 */
const A3 = midiToFreq(57); // 220 Hz fallback center

/** Geometric (log) median frequency of voiced points, or null if none. */
function medianFreq(pointSets: PitchPoint[][]): number | null {
  const logs: number[] = [];
  for (const set of pointSets) {
    for (const p of set) if (p.freq != null) logs.push(Math.log(p.freq));
  }
  if (!logs.length) return null;
  logs.sort((a, b) => a - b);
  const mid = logs[Math.floor(logs.length / 2)];
  return Math.exp(mid);
}

/**
 * A pitch range spanning `octaves`, geometrically centered on the median pitch
 * of the committed takes (stable while recording). Snapped to whole notes so
 * the axis labels land cleanly. Falls back to A3 before anything is sung.
 */
export function autoRange(
  committed: Loop[],
  octaves: number,
  activePoints: PitchPoint[] = [],
): { fMin: number; fMax: number } {
  const center =
    medianFreq(committed.map((l) => l.points)) ?? medianFreq([activePoints]) ?? A3;
  const centerMidi = Math.round(freqToMidi(center));
  const half = (octaves * 12) / 2;
  return {
    fMin: midiToFreq(centerMidi - half),
    fMax: midiToFreq(centerMidi + half),
  };
}

export function noteTicks(fMin: number, fMax: number): NoteTick[] {
  const loMidi = Math.ceil(freqToMidi(fMin));
  const hiMidi = Math.floor(freqToMidi(fMax));
  const ticks: NoteTick[] = [];
  for (let m = loMidi; m <= hiMidi; m++) {
    const pc = ((m % 12) + 12) % 12;
    const major = pc === 0 || pc === 9; // C or A
    ticks.push({ freq: midiToFreq(m), name: midiToName(m), major });
  }
  return ticks;
}
