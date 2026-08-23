import { useId, useMemo } from 'react';
import { Group } from '@visx/group';
import { scaleLinear, scaleLog } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { curveCatmullRom } from '@visx/curve';
import type { Loop, PitchPoint } from '../lib/contour';
import { toSegments } from '../lib/contour';
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
const BLOOM_LAYER_OPACITY = 0.22;
const BLOOM_ACTIVE = '#fff0c8';

// Pitch → hue rainbow for Aurora (every pitch its own color). Top of the plot
// is the highest pitch; stops run high→low.
const AURORA_STOPS = [0, 30, 55, 110, 175, 215, 270]; // hues, high pitch → low

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

  const lastActive = activePoints.length ? activePoints[activePoints.length - 1].tMs : 0;

  // Fixed time-scale window that scrolls left once the take runs past it (no
  // squishing). When finished (no active take), fit the whole session.
  const [domainStart, domainEnd] = useMemo(() => {
    // While recording keep a stable fixed window (even between takes, when the
    // active take is momentarily empty) so the scale never flips to fit-all and
    // jumps. Once the take runs past the window it scrolls left.
    if (recording) {
      const end = Math.max(windowMs, lastActive);
      return [end - windowMs, end];
    }
    // Finished: fit the longest take to the full width so the art fills the screen.
    let max = 0;
    for (const l of committedLoops) max = Math.max(max, l.durationMs);
    return [0, max > 0 ? max : windowMs];
  }, [windowMs, committedLoops, lastActive, recording]);

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
          {/* Committed layers */}
          {committedSegments.map((loop) =>
            loop.segments.map((seg, i) => (
              <LinePath
                key={`${loop.id}-${i}`}
                data={seg}
                x={(d) => xScale(d.tMs)}
                y={(d) => yScale(d.freq)}
                stroke={aurora ? `url(#pitch-${clipId})` : bloom ? BLOOM_LAYER : loop.color}
                strokeOpacity={aurora ? 0.62 : bloom ? BLOOM_LAYER_OPACITY : 0.72}
                strokeWidth={aurora ? 2.5 : bloom ? 3 : 2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={bloom ? { mixBlendMode: 'plus-lighter' } : undefined}
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
