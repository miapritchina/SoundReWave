import { useCallback, useRef, useState } from 'react';
import { PitchGraph } from './components/PitchGraph';
import { NoteReadout } from './components/NoteReadout';
import { useMicPitch } from './hooks/useMicPitch';
import { useElementSize } from './hooks/useElementSize';
import { A3_MIDI, isNoteHit } from './lib/pitch';
import { layerColor } from './lib/palette';
import type { Loop } from './lib/contour';

export default function App() {
  const [graphRef, size] = useElementSize<HTMLDivElement>();
  const [committed, setCommitted] = useState<Loop[]>([]);
  const [onTarget, setOnTarget] = useState(false);
  const targetTimer = useRef<number | null>(null);

  const handleHit = useCallback((freq: number) => {
    if (isNoteHit(freq, A3_MIDI)) {
      setOnTarget(true);
      if (targetTimer.current) clearTimeout(targetTimer.current);
      targetTimer.current = window.setTimeout(() => setOnTarget(false), 250);
    }
  }, []);

  const mic = useMicPitch({ onHit: handleHit });
  const running = mic.status === 'running';
  const layerIdx = committed.length;

  const newLayer = useCallback(() => {
    // Commit the current take as a dimmed layer and start a fresh line.
    mic.reset();
    const points = mic.points;
    if (points.some((p) => p.freq != null)) {
      const durationMs = points.length ? points[points.length - 1].tMs : 0;
      setCommitted((prev) => [
        ...prev,
        {
          id: `loop-${prev.length}-${Math.round(durationMs)}`,
          index: prev.length,
          color: layerColor(prev.length),
          points,
          durationMs,
        },
      ]);
    }
  }, [mic]);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-4 no-touch-callout">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold tracking-tight">
          Sound<span className="text-glow">Re</span>Wave
        </h1>
        <span className="font-mono text-[11px] text-white/40">
          {committed.length} layer{committed.length === 1 ? '' : 's'}
        </span>
      </header>

      <div
        ref={graphRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-panel/60"
      >
        {size.width > 0 && (
          <PitchGraph
            width={size.width}
            height={size.height}
            committedLoops={committed}
            activePoints={mic.points}
            activeColor={layerColor(layerIdx)}
          />
        )}
        {!running && (
          <div className="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-sm">
            <p className="max-w-xs text-center text-sm text-white/60">
              {mic.error ?? 'Tap Start, allow the mic, and sing. Your pitch draws in real time.'}
            </p>
          </div>
        )}
      </div>

      <NoteReadout live={mic.live} onTarget={onTarget} />

      <div className="flex gap-3">
        {!running ? (
          <button
            onClick={() => void mic.start()}
            className="flex-1 rounded-xl bg-glow py-4 font-display text-lg font-semibold text-white shadow-lg shadow-glow/30 active:scale-[0.98]"
          >
            {mic.status === 'requesting' ? 'Starting…' : 'Start'}
          </button>
        ) : (
          <>
            <button
              onClick={newLayer}
              className="flex-1 rounded-xl bg-accent py-4 font-display text-lg font-semibold text-ink active:scale-[0.98]"
            >
              New Layer
            </button>
            <button
              onClick={mic.stop}
              className="rounded-xl border border-white/20 px-6 font-display text-lg font-semibold text-white/80 active:scale-[0.98]"
            >
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}
