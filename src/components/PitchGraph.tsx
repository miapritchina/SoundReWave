import { useId, useMemo } from 'react';
import { Group } from '@visx/group';
import { scaleLinear, scaleLog } from '@visx/scale';
import { LinePath } from '@visx/shape';
import { curveCatmullRom } from '@visx/curve';
import type { Loop, PitchPoint } from '../lib/contour';
import { toSegments } from '../lib/contour';
import { noteTicks, DEFAULT_FMIN, DEFAULT_FMAX } from '../lib/scales';

export interface PitchGraphProps {
  width: number;
  height: number;
  /** Finished layers, drawn dimmed underneath the active take. */
  committedLoops?: Loop[];
  /** Points of the take currently being sung (Phase 1: the only line). */
  activePoints?: PitchPoint[];
  activeColor?: string;
  fMin?: number;
  fMax?: number;
  /** Minimum time window (ms) mapped across the x-axis before it grows. */
  windowMs?: number;
  /** Bridge unvoiced gaps up to this many ms. */
  maxBridgeMs?: number;
  padding?: { top: number; right: number; bottom: number; left: number };
}

const DEFAULT_PAD = { top: 16, right: 16, bottom: 16, left: 44 };

/**
 * Layered pitch-contour graph. Pure/declarative visx (SVG) so the same
 * component renders live and serializes for export. X resets per loop;
 * committed layers overlay in the same window.
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
  padding = DEFAULT_PAD,
}: PitchGraphProps) {
  const innerW = Math.max(0, width - padding.left - padding.right);
  const innerH = Math.max(0, height - padding.top - padding.bottom);
  const clipId = useId();

  // While recording, keep a fixed time-scale window and scroll left once the
  // take runs past it (instead of squishing everything to fit). When finished
  // (no active take), fit the whole session so the artwork reads end to end.
  const [domainStart, domainEnd] = useMemo(() => {
    const lastActive = activePoints.length ? activePoints[activePoints.length - 1].tMs : 0;
    if (lastActive > 0) {
      const end = Math.max(windowMs, lastActive);
      return [end - windowMs, end];
    }
    let max = windowMs;
    for (const l of committedLoops) max = Math.max(max, l.durationMs);
    return [0, max];
  }, [windowMs, committedLoops, activePoints]);

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

  return (
    <svg width={width} height={height} role="img" aria-label="Layered pitch contour graph">
      <Group left={padding.left} top={padding.top}>
        {/* Note gridlines + labels */}
        {ticks.map((t) => {
          const y = yScale(t.freq);
          return (
            <g key={t.name}>
              <line
                x1={0}
                x2={innerW}
                y1={y}
                y2={y}
                stroke="#ffffff"
                strokeOpacity={t.major ? 0.14 : 0.05}
              />
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

        {/* Clip lines to the plot area so scrolled-off content stays clean. */}
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
                stroke={loop.color}
                strokeOpacity={0.72}
                strokeWidth={2.25}
                strokeLinecap="round"
                strokeLinejoin="round"
                curve={curveCatmullRom}
                fill="none"
              />
            )),
          )}

          {/* Active take (bright) */}
          {activeSegments.map((seg, i) => (
            <LinePath
              key={`active-${i}`}
              data={seg}
              x={(d) => xScale(d.tMs)}
              y={(d) => yScale(d.freq)}
              stroke={activeColor}
              strokeOpacity={0.98}
              strokeWidth={2.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              curve={curveCatmullRom}
              fill="none"
            />
          ))}
        </g>
      </Group>
    </svg>
  );
}
