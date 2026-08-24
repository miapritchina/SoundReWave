import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Group } from '@visx/group';
import { scaleLinear, scaleLog } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { curveCatmullRom } from '@visx/curve';
import type { Loop, PitchPoint } from '../lib/contour';
import { toSegments, voicedTimeExtent } from '../lib/contour';
import { noteTicks, DEFAULT_FMIN, DEFAULT_FMAX } from '../lib/scales';
import type { StyleMode } from '../lib/settings';

export interface PitchGraphProps {
  width: number;
  height: number;
  committedLoops?: Loop[];
  activePoints?: PitchPoint[];
  activeColor?: string;
  fMin?: number;
  fMax?: number;
  /** Minimum time window (ms) mapped across the x-axis before it scrolls. */
  windowMs?: number;
  maxBridgeMs?: number;
  /** Visual style. 'layers' = distinct colors; 'bloom' = warm additive glow. */
  style?: StyleMode;
  /** Draw a vertical playhead. */
  playhead?: boolean;
  /** Playhead time (ms). Falls back to the active take's current time. */
  playheadTMs?: number | null;
  /** Recording session: keep the fixed window even between takes (no fit-all). */
  recording?: boolean;
  padding?: { top: number; right: number; bottom: number; left: number };
}

const DEFAULT_PAD = { top: 16, right: 16, bottom: 16, left: 44 };

// Bloom palette: warm, very transparent per layer, additively blended
// (plus-lighter) so light *sums* where takes overlap — faint single lines,
// bright stacks, blowing out to white in the densest (median) core. The blue
// headroom lets the sum reach true white, not just saturated orange.
const BLOOM_LAYER = '#ff9a55';
const BLOOM_ACTIVE = '#fff0c8';

// Pitch → hue rainbow for Aurora (every pitch its own color). Top of the plot
// is the highest pitch; stops run high→low.
const AURORA_STOPS = [0, 30, 55, 110, 175, 215, 270]; // hues, high pitch → low

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Per-layer stroke opacity for the additive (plus-lighter) styles. Auto-exposure:
 * scale each layer's opacity to the number of committed takes (`target / N`) so
 * the *most-overlapped* region sums toward pure white while sparse areas keep
 * their color. This is recomputed on every render, so as each layer finishes and
 * `n` grows the whole stack re-exposes live — the accumulation builds up while
 * recording, not only on Finish. Matches the export's `adaptive()`.
 */
function additiveOpacity(n: number, target: number): number {
  return clamp(target / Math.max(1, n), 0.1, 0.55);
}

/**
 * Ease the x-axis domain toward a target so the graph re-scales *gracefully*.
 * While a take is actively being recorded we track the scrolling window exactly
 * (`animate` false → snap, no lag). Between takes and on finish, the target
 * jumps to "fit everything to full width"; there we ease toward it over a few
 * frames so the graph softly zooms out instead of snapping.
 */
function useEasedDomain(
  targetStart: number,
  targetEnd: number,
  animate: boolean,
): [number, number] {
  const [d, setD] = useState<[number, number]>([targetStart, targetEnd]);
  const cur = useRef<[number, number]>([targetStart, targetEnd]);
  const target = useRef<[number, number]>([targetStart, targetEnd]);
  target.current = [targetStart, targetEnd];
  const raf = useRef<number | null>(null);

  useEffect(() => {
    if (!animate) {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
      cur.current = [targetStart, targetEnd];
      setD([targetStart, targetEnd]);
      return;
    }
    const tick = () => {
      const [tS, tE] = target.current;
      const [cS, cE] = cur.current;
      const nS = cS + (tS - cS) * 0.22;
      const nE = cE + (tE - cE) * 0.22;
      const done = Math.abs(tS - nS) < 0.5 && Math.abs(tE - nE) < 0.5;
      cur.current = done ? [tS, tE] : [nS, nE];
      setD(cur.current);
      raf.current = done ? null : requestAnimationFrame(tick);
    };
    if (raf.current == null) raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
        raf.current = null;
      }
    };
  }, [targetStart, targetEnd, animate]);

  return d;
}

/**
 * Layered pitch-contour graph. Pure/declarative visx (SVG) so the same
 * component renders live and serializes for export. X scrolls left once a take
 * runs past the window; committed layers overlay in the same window.
 */
export function PitchGraph({
  width,
  height,
  committedLoops = [],
  activePoints = [],
  activeColor = '#22d3ee',
  fMin = DEFAULT_FMIN,
  fMax = DEFAULT_FMAX,
  windowMs = 12000,
  maxBridgeMs = 180,
  style = 'layers',
  playhead = false,
  playheadTMs = null,
  recording = false,
  padding = DEFAULT_PAD,
}: PitchGraphProps) {
  const innerW = Math.max(0, width - padding.left - padding.right);
  const innerH = Math.max(0, height - padding.top - padding.bottom);
  const clipId = useId();
  const bloom = style === 'bloom';
  const aurora = style === 'aurora';
  const additive = bloom || aurora;
  const N = committedLoops.length;
  // Color pass opacity, and a separate WHITE additive pass so stacked takes sum
  // to true white at the densest overlap (a warm/hue base alone can't — its
  // weak channels never reach 1). White adds equally to all channels. Both
  // passes auto-expose to the committed-layer count `N`, so the white
  // accumulation is recalculated on every layer finish (as `N` grows the stack
  // re-exposes and overlaps read progressively whiter) — matching the export.
  const colorOpacity = bloom
    ? additiveOpacity(N, 2.0)
    : aurora
      ? additiveOpacity(N, 1.8)
      : 0.72;
  const whiteOpacity = additive ? clamp(1.2 / Math.max(1, N), 0.05, 0.4) : 0;

  const lastActive = activePoints.length ? activePoints[activePoints.length - 1].tMs : 0;

  // Target x-domain. While a take is actively recording, it's a fixed-width
  // window that scrolls left once the take runs past it (no squishing).
  // Otherwise — between takes (armed) or finished — the target fits the *voiced*
  // span of the committed takes to the full width: it starts at the first note
  // and ends at the last, trimming the silence at the start (and end) so the
  // drawing fills the width instead of sitting behind dead air. This is
  // recomputed whenever a layer commits (committedLoops changes), so the width
  // re-fits on every layer finish. The transition is eased below (soft zoom).
  const live = recording && lastActive > 0;
  const [targetStart, targetEnd] = useMemo(() => {
    if (live) {
      const end = Math.max(windowMs, lastActive);
      return [end - windowMs, end];
    }
    const fallback = Number.isFinite(windowMs) ? windowMs : 3000;
    const bounds = voicedTimeExtent(committedLoops);
    if (!bounds) return [0, fallback];
    const [lo, hi] = bounds;
    return hi > lo ? [lo, hi] : [lo, lo + fallback];
  }, [windowMs, committedLoops, lastActive, live]);

  const [domainStart, domainEnd] = useEasedDomain(targetStart, targetEnd, !live);

  const xScale = useMemo(
    () => scaleLinear<number>({ domain: [domainStart, domainEnd], range: [0, innerW] }),
    [domainStart, domainEnd, innerW],
  );
  const yScale = useMemo(
    () => scaleLog<number>({ domain: [fMin, fMax], range: [innerH, 0] }),
    [fMin, fMax, innerH],
  );

  const ticks = useMemo(() => noteTicks(fMin, fMax), [fMin, fMax]);

  const committedSegments = useMemo(
    () =>
      committedLoops.map((loop) => ({
        id: loop.id,
        color: loop.color,
        segments: toSegments(loop.points, maxBridgeMs),
      })),
    [committedLoops, maxBridgeMs],
  );

  const activeSegments = useMemo(
    () => toSegments(activePoints, maxBridgeMs),
    [activePoints, maxBridgeMs],
  );

  const headTMs = playheadTMs != null ? playheadTMs : lastActive > 0 ? lastActive : null;
  const headX = headTMs != null ? xScale(headTMs) : null;
  const showHead = playhead && headX != null && headX >= 0 && headX <= innerW;

  return (
    <svg width={width} height={height} role="img" aria-label="Layered pitch contour graph">
      <Group left={padding.left} top={padding.top}>
        {/* Note gridlines + labels */}
        {ticks.map((t) => {
          const y = yScale(t.freq);
          return (
            <g key={t.name}>
              <line x1={0} x2={innerW} y1={y} y2={y} stroke="#ffffff" strokeOpacity={t.major ? 0.14 : 0.05} />
              {t.major && (
                <text
                  x={-8}
                  y={y}
                  dy="0.32em"
                  textAnchor="end"
                  fontSize={10}
                  fontFamily="'JetBrains Mono', monospace"
                  fill="#8b90b8"
                >
                  {t.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Aurora: one vertical pitch→hue gradient shared by every line, so
            each pitch has its own color (a C4 is the same hue in any take). */}
        {aurora && (
          <linearGradient id={`pitch-${clipId}`} gradientUnits="userSpaceOnUse" x1={0} y1={0} x2={0} y2={innerH}>
            {AURORA_STOPS.map((h, i) => (
              <stop key={i} offset={`${(i / (AURORA_STOPS.length - 1)) * 100}%`} stopColor={`hsl(${h} 85% 60%)`} />
            ))}
          </linearGradient>
        )}

        <clipPath id={clipId}>
          <rect x={0} y={0} width={innerW} height={innerH} />
        </clipPath>
        <g clipPath={`url(#${clipId})`}>
          {/* Committed layers (color pass) */}
          {committedSegments.map((loop) =>
            loop.segments.map((seg, i) => (
              <LinePath
                key={`${loop.id}-${i}`}
                data={seg}
                x={(d) => xScale(d.tMs)}
                y={(d) => yScale(d.freq)}
                stroke={aurora ? `url(#pitch-${clipId})` : bloom ? BLOOM_LAYER : loop.color}
                strokeOpacity={colorOpacity}
                strokeWidth={aurora ? 2.5 : bloom ? 3 : 2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={additive ? { mixBlendMode: 'plus-lighter' } : undefined}
                curve={curveCatmullRom}
                fill="none"
              />
            )),
          )}

          {/* White additive pass — overlaps sum toward pure white */}
          {additive &&
            committedSegments.map((loop) =>
              loop.segments.map((seg, i) => (
                <LinePath
                  key={`w-${loop.id}-${i}`}
                  data={seg}
                  x={(d) => xScale(d.tMs)}
                  y={(d) => yScale(d.freq)}
                  stroke="#ffffff"
                  strokeOpacity={whiteOpacity}
                  strokeWidth={aurora ? 2 : 2.4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ mixBlendMode: 'plus-lighter' }}
                  curve={curveCatmullRom}
                  fill="none"
                />
              )),
            )}

          {/* Active take — solid/bright until it's committed */}
          {activeSegments.map((seg, i) => (
            <LinePath
              key={`active-${i}`}
              data={seg}
              x={(d) => xScale(d.tMs)}
              y={(d) => yScale(d.freq)}
              stroke={aurora ? `url(#pitch-${clipId})` : bloom ? BLOOM_ACTIVE : activeColor}
              strokeOpacity={0.98}
              strokeWidth={bloom ? 3.25 : 2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              curve={curveCatmullRom}
              fill="none"
            />
          ))}

          {/* Playhead */}
          {showHead && (
            <line
              x1={headX!}
              x2={headX!}
              y1={0}
              y2={innerH}
              stroke={bloom ? BLOOM_ACTIVE : activeColor}
              strokeOpacity={0.5}
              strokeWidth={1.5}
            />
          )}
        </g>
      </Group>
    </svg>
  );
}
