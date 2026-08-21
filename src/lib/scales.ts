import { midiToFreq, midiToName, freqToMidi } from './pitch';

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
