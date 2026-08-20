import { describe, it, expect } from 'vitest';
import {
  freqToMidi,
  midiToFreq,
  nearestMidi,
  centsOff,
  midiToName,
  nameToMidi,
  freqToName,
  isNoteHit,
  A3_MIDI,
} from './pitch';

describe('pitch math', () => {
  it('maps A4 = 440 Hz to MIDI 69', () => {
    expect(freqToMidi(440)).toBeCloseTo(69, 6);
    expect(midiToFreq(69)).toBeCloseTo(440, 6);
  });

  it('A3 = 220 Hz = MIDI 57', () => {
    expect(A3_MIDI).toBe(57);
    expect(midiToFreq(57)).toBeCloseTo(220, 6);
    expect(nearestMidi(220)).toBe(57);
  });

  it('names notes in scientific pitch', () => {
    expect(midiToName(57)).toBe('A3');
    expect(midiToName(60)).toBe('C4');
    expect(midiToName(69)).toBe('A4');
    expect(freqToName(261.63)).toBe('C4');
  });

  it('round-trips names to midi', () => {
    expect(nameToMidi('A3')).toBe(57);
    expect(nameToMidi('C4')).toBe(60);
    expect(nameToMidi('G#5')).toBe(80);
    expect(nameToMidi('Ab5')).toBe(80);
  });

  it('computes cents deviation', () => {
    expect(centsOff(220)).toBe(0);
    // +40 cents above A3 (well clear of the ±50c note boundary).
    expect(centsOff(220 * Math.pow(2, 0.4 / 12))).toBe(40);
    expect(centsOff(220 * Math.pow(2, -0.2 / 12))).toBe(-20);
  });

  it('detects a note hit within tolerance', () => {
    expect(isNoteHit(220, A3_MIDI, 35)).toBe(true);
    expect(isNoteHit(220 * Math.pow(2, 0.3 / 12), A3_MIDI, 35)).toBe(true); // +30c
    expect(isNoteHit(220 * Math.pow(2, 0.5 / 12), A3_MIDI, 35)).toBe(false); // +50c
  });
});
