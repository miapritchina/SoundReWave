/**
 * Pitch / note math. Pure functions, A440 equal temperament.
 * MIDI note 69 = A4 = 440 Hz.
 */

const A4_HZ = 440;
const A4_MIDI = 69;

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Continuous MIDI number for a frequency (may be fractional). */
export function freqToMidi(freq: number): number {
  return A4_MIDI + 12 * Math.log2(freq / A4_HZ);
}

/** Frequency for a (possibly fractional) MIDI number. */
export function midiToFreq(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - A4_MIDI) / 12);
}

/** Nearest integer MIDI note to a frequency. */
export function nearestMidi(freq: number): number {
  return Math.round(freqToMidi(freq));
}

/** Signed cents deviation from the nearest equal-tempered note (-50..+50). */
export function centsOff(freq: number): number {
  const midi = freqToMidi(freq);
  return Math.round((midi - Math.round(midi)) * 100);
}

/** Scientific-pitch name for an integer MIDI note, e.g. 57 -> "A3". */
export function midiToName(midi: number): string {
  const name = NOTE_NAMES[((midi % 12) + 12) % 12];
  const octave = Math.floor(midi / 12) - 1;
  return `${name}${octave}`;
}

/** Integer MIDI note for a scientific-pitch name, e.g. "A3" -> 57. */
export function nameToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`Invalid note name: ${name}`);
  const [, letter, accidental, octaveStr] = m;
  let semitone = NOTE_NAMES.indexOf(`${letter}${accidental === '#' ? '#' : ''}` as (typeof NOTE_NAMES)[number]);
  if (accidental === 'b') semitone = NOTE_NAMES.indexOf(letter as (typeof NOTE_NAMES)[number]) - 1;
  const octave = parseInt(octaveStr, 10);
  return (octave + 1) * 12 + ((semitone + 12) % 12);
}

/** Note name nearest to a frequency, e.g. 220.1 -> "A3". */
export function freqToName(freq: number): string {
  return midiToName(nearestMidi(freq));
}

/**
 * True when `freq` is within `toleranceCents` of the target note.
 * Used for the A3 target-hit detection.
 */
export function isNoteHit(freq: number, targetMidi: number, toleranceCents = 35): boolean {
  const midi = freqToMidi(freq);
  return Math.abs(midi - targetMidi) * 100 <= toleranceCents;
}

export const A3_MIDI = nameToMidi('A3'); // 57, 220 Hz
