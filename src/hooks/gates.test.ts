import { describe, it, expect } from 'vitest';
import { gatesFor } from './useLooper';

describe('gatesFor', () => {
  it('loosens gates and raises gain as sensitivity increases', () => {
    const lo = gatesFor(0);
    const hi = gatesFor(1);
    expect(hi.clarity).toBeLessThan(lo.clarity); // easier to be "voiced"
    expect(hi.rms).toBeLessThan(lo.rms);
    expect(hi.gain).toBeGreaterThan(lo.gain);
  });

  it('clamps out-of-range input', () => {
    expect(gatesFor(-1)).toEqual(gatesFor(0));
    expect(gatesFor(2)).toEqual(gatesFor(1));
  });

  it('keeps clarity in a sane 0..1 band', () => {
    for (const s of [0, 0.25, 0.5, 0.75, 1]) {
      const g = gatesFor(s);
      expect(g.clarity).toBeGreaterThan(0.5);
      expect(g.clarity).toBeLessThanOrEqual(0.95);
      expect(g.rms).toBeGreaterThan(0);
    }
  });
});
