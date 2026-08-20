/**
 * Contour model — the vector representation of a sung take.
 * Renderer-agnostic: visx draws it live, and the same model serializes to SVG.
 */

export interface PitchPoint {
  /** Milliseconds from the start of this loop. */
  tMs: number;
  /** Detected frequency in Hz, or null for an unvoiced/silent frame (pen-up). */
  freq: number | null;
  /** Detector confidence 0..1 (McLeod clarity). */
  clarity: number;
}

export interface Loop {
  id: string;
  index: number;
  /** Stroke color assigned from the layer palette. */
  color: string;
  points: PitchPoint[];
  durationMs: number;
  /** Present once the take's audio has been captured (Phase 2+). */
  audio?: AudioBuffer;
}

/** A contiguous run of voiced points to draw as one polyline. */
export type Segment = { tMs: number; freq: number }[];

/**
 * Split a point list into drawable segments, bridging short unvoiced gaps.
 *
 * Words produce gaps at consonants; we keep the pen down across brief gaps
 * (<= maxBridgeMs) so each take reads as a flowing line, and lift it for
 * longer silences so distinct phrases stay separate.
 */
export function toSegments(points: PitchPoint[], maxBridgeMs = 180): Segment[] {
  const segments: Segment[] = [];
  let current: Segment = [];
  let lastVoicedTMs: number | null = null;

  for (const p of points) {
    if (p.freq == null) continue; // unvoiced — potential gap
    if (lastVoicedTMs != null && p.tMs - lastVoicedTMs > maxBridgeMs && current.length > 0) {
      // Gap too long to bridge — end the current segment.
      segments.push(current);
      current = [];
    }
    current.push({ tMs: p.tMs, freq: p.freq });
    lastVoicedTMs = p.tMs;
  }
  if (current.length > 0) segments.push(current);
  return segments;
}

/** Frequency extent across all voiced points, or null if silent. */
export function freqExtent(points: PitchPoint[]): [number, number] | null {
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    if (p.freq == null) continue;
    if (p.freq < lo) lo = p.freq;
    if (p.freq > hi) hi = p.freq;
  }
  return lo === Infinity ? null : [lo, hi];
}
