import { describe, it, expect } from 'vitest';
import { toSegments, freqExtent, voicedTimeExtent, type PitchPoint } from './contour';

const P = (tMs: number, freq: number | null): PitchPoint => ({ tMs, freq, clarity: freq ? 0.95 : 0 });

describe('toSegments', () => {
  it('keeps a continuous voiced run as one segment', () => {
    const segs = toSegments([P(0, 220), P(30, 221), P(60, 219)]);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(3);
  });

  it('bridges short unvoiced gaps', () => {
    // 90ms gap (< 180ms bridge) — stays one segment.
    const segs = toSegments([P(0, 220), P(30, 220), P(120, 221)], 180);
    expect(segs).toHaveLength(1);
    expect(segs[0]).toHaveLength(3);
  });

  it('breaks on long gaps', () => {
    const segs = toSegments([P(0, 220), P(30, 220), P(400, 330)], 180);
    expect(segs).toHaveLength(2);
    expect(segs[0]).toHaveLength(2);
    expect(segs[1]).toHaveLength(1);
  });

  it('ignores pen-up markers but uses their timing implicitly', () => {
    const segs = toSegments([P(0, 220), P(30, null), P(60, 220)], 180);
    expect(segs).toHaveLength(1);
    expect(segs[0].every((p) => typeof p.freq === 'number')).toBe(true);
  });
});

describe('freqExtent', () => {
  it('returns min/max of voiced points', () => {
    expect(freqExtent([P(0, 200), P(1, 400), P(2, null)])).toEqual([200, 400]);
  });
  it('returns null when silent', () => {
    expect(freqExtent([P(0, null), P(1, null)])).toBeNull();
  });
});

describe('voicedTimeExtent', () => {
  it('trims leading and trailing silence to the voiced span', () => {
    // Silence at 0–300ms and after 900ms; singing runs 300–900ms.
    const loop = { points: [P(0, null), P(300, 220), P(600, 240), P(900, 230), P(1200, null)] };
    expect(voicedTimeExtent([loop])).toEqual([300, 900]);
  });

  it('spans the earliest and latest voiced time across all layers', () => {
    const a = { points: [P(200, 220), P(500, 220)] };
    const b = { points: [P(100, 330), P(800, 330)] };
    expect(voicedTimeExtent([a, b])).toEqual([100, 800]);
  });

  it('returns null when nothing is voiced', () => {
    expect(voicedTimeExtent([{ points: [P(0, null), P(30, null)] }])).toBeNull();
  });
});
