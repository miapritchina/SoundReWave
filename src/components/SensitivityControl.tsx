import { gatesFor } from '../hooks/useLooper';

export interface SensitivityControlProps {
  value: number; // 0..1
  onChange: (v: number) => void;
  level: number; // 0..1 live input level
}

/**
 * Sensitivity slider + live input-level meter. The white tick marks the
 * detection threshold at the current sensitivity — raise sensitivity until your
 * voice's level bar crosses it.
 */
export function SensitivityControl({ value, onChange, level }: SensitivityControlProps) {
  const gateMark = Math.min(1, gatesFor(value).rms * 4);
  const over = level >= gateMark;

  return (
    <div className="space-y-1.5 rounded-xl border border-white/10 bg-panel/50 p-3">
      <div className="flex items-center justify-between text-[11px] text-white/55">
        <span>Mic sensitivity</span>
        <span className="font-mono tabular-nums">{Math.round(value * 100)}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-accent"
        aria-label="Microphone sensitivity"
      />
      <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-[width] duration-75 ${over ? 'bg-accent' : 'bg-white/40'}`}
          style={{ width: `${Math.round(level * 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-white/80"
          style={{ left: `${Math.round(gateMark * 100)}%` }}
          title="Detection threshold"
        />
      </div>
      <p className="text-[10px] text-white/35">
        Raise until your voice crosses the line — then the graph draws.
      </p>
    </div>
  );
}
