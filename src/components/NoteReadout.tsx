import type { LiveFrame } from '../hooks/useMicPitch';

export interface NoteReadoutProps {
  live: LiveFrame | null;
  /** Whether the current frame is on the target note (A3). */
  onTarget?: boolean;
}

/** Big current-note display with a cents-off tuning meter. */
export function NoteReadout({ live, onTarget = false }: NoteReadoutProps) {
  const cents = live?.cents ?? 0;
  // Meter: -50..+50 cents mapped to 0..100% with center at 50%.
  const pct = Math.max(0, Math.min(100, 50 + cents));

  return (
    <div className="flex items-center gap-4">
      <div
        className={`font-mono text-4xl font-semibold tabular-nums transition-colors ${
          onTarget ? 'text-hot' : live ? 'text-accent' : 'text-white/25'
        }`}
      >
        {live ? live.note : '—'}
      </div>
      <div className="flex-1">
        <div className="relative h-2 w-full rounded-full bg-white/10">
          <div className="absolute left-1/2 top-1/2 h-4 w-px -translate-y-1/2 bg-white/30" />
          {live && (
            <div
              className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent shadow-[0_0_12px_rgba(34,211,238,0.8)]"
              style={{ left: `${pct}%` }}
            />
          )}
        </div>
        <div className="mt-1 font-mono text-[10px] text-white/40">
          {live ? `${cents > 0 ? '+' : ''}${cents}¢` : 'listening…'}
        </div>
      </div>
    </div>
  );
}
