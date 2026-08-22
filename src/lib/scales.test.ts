import { describe, it, expect } from 'vitest';
import { autoRange, noteTicks } from './scales';
import { midiToFreq, freqToName, nameToMidi } from './pitch';
import type { Loop } from './contour';

function loopAt(midi: number): Loop {
  const f = midiToFreq(midi);
  return {
    id: 'x',
    index: 0,
    color: '#fff',
    durationMs: 100,
    points: [
      { tMs: 0, freq: f, clarity: 0.95 },
      { tMs: 30, freq: f, clarity: 0.95 },
    ],
  };
}

describe('autoRange', () => {
  it('centers a 2-octave range on the committed median pitch', () => {
    const { fMin, fMax } = autoRange([loopAt(nameToMidi('A4'))], 2); // A4 = 440
    expect(freqToName(fMin)).toBe('A3'); // one octave below
    expect(freqToName(fMax)).toBe('A5'); // one octave above
  });

  it('falls back to A3 center before anything is sung', () => {
    const { fMin, fMax } = autoRange([], 2);
    expect(freqToName(fMin)).toBe('A2');
    expect(freqToName(fMax)).toBe('A4');
  });

  it('wider octaves span a wider range', () => {
    const two = autoRange([loopAt(nameToMidi('C4'))], 2);
    const four = autoRange([loopAt(nameToMidi('C4'))], 4);
    expect(four.fMin).toBeLessThan(two.fMin);
    expect(four.fMax).toBeGreaterThan(two.fMax);
  });

  it('noteTicks stay within the range', () => {
    const ticks = noteTicks(midiToFreq(57), midiToFreq(69));
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.some((t) => t.name === 'A3')).toBe(true);
  });
});
