import { useCallback, useRef, useState } from 'react';
import { PitchGraph } from './components/PitchGraph';
import { NoteReadout } from './components/NoteReadout';
import { ExportPanel } from './components/ExportPanel';
import { SensitivityControl } from './components/SensitivityControl';
import { useLooper } from './hooks/useLooper';
import { useElementSize } from './hooks/useElementSize';
import { A3_MIDI, isNoteHit } from './lib/pitch';
import { layerColor } from './lib/palette';

export default function App() {
  const [graphRef, size] = useElementSize<HTMLDivElement>();
  const [onTarget, setOnTarget] = useState(false);
  const onTargetRef = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const looperRef = useRef<ReturnType<typeof useLooper> | null>(null);

  const handleHit = useCallback((freq: number) => {
    const hit = isNoteHit(freq, A3_MIDI);
    if (hit && !onTargetRef.current) {
      // rising edge: chime once + flash
      looperRef.current?.playHitTone();
    }
    if (hit) {
      onTargetRef.current = true;
      setOnTarget(true);
      if (flashTimer.current) clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => {
        onTargetRef.current = false;
        setOnTarget(false);
      }, 250);
    }
  }, []);

  const looper = useLooper({ onHit: handleHit });
  looperRef.current = looper;

  const { status, committed } = looper;
  const recording = status === 'recording';
  const finished = status === 'finished';
  const layerIdx = committed.length;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-4 p-4 no-touch-callout">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold tracking-tight">
          Sound<span className="text-glow">Re</span>Wave
        </h1>
        <span className="font-mono text-[11px] text-white/40">
          {committed.length} layer{committed.length === 1 ? '' : 's'}
          {finished && ' · finished'}
        </span>
      </header>

      <div
        ref={graphRef}
        className={`relative min-h-0 flex-1 overflow-hidden rounded-2xl border bg-panel/60 transition-colors ${
          onTarget ? 'border-hot/70 shadow-[0_0_30px_-6px] shadow-hot/40' : 'border-white/10'
        }`}
      >
        {size.width > 0 && (
          <PitchGraph
            width={size.width}
            height={size.height}
            committedLoops={committed}
            activePoints={looper.activePoints}
            activeColor={layerColor(layerIdx)}
          />
        )}
        {onTarget && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-hot px-3 py-1 font-mono text-xs font-semibold text-white">
            A3!
          </div>
        )}
        {status !== 'recording' && !finished && (
          <div className="absolute inset-0 grid place-items-center bg-ink/40 backdrop-blur-sm">
            <p className="max-w-xs text-center text-sm text-white/60">
              {looper.error ?? 'Tap Start, allow the mic, and sing. Your pitch draws in real time; hit A3 for a chime.'}
            </p>
          </div>
        )}
      </div>

      {!finished && <NoteReadout live={looper.live} onTarget={onTarget} />}

      {/* Controls */}
      {status === 'idle' || status === 'denied' || status === 'error' || status === 'requesting' ? (
        <button
          onClick={() => void looper.start()}
          className="rounded-xl bg-glow py-4 font-display text-lg font-semibold text-white shadow-lg shadow-glow/30 active:scale-[0.98]"
        >
          {status === 'requesting' ? 'Starting…' : 'Start'}
        </button>
      ) : recording ? (
        <div className="flex flex-col gap-2">
          <SensitivityControl
            value={looper.sensitivity}
            onChange={looper.setSensitivity}
            level={looper.inputLevel}
          />
          {committed.length >= 8 && (
            <p className="text-center text-[11px] text-amber-300/80">
              {committed.length} layers — lots of audio in memory. Consider finishing soon.
            </p>
          )}
          <div className="flex gap-3">
          <button
            onClick={() => void looper.newLayer()}
            className="flex-1 rounded-xl bg-accent py-4 font-display text-lg font-semibold text-ink active:scale-[0.98]"
          >
            New Layer
          </button>
          <button
            onClick={() => void looper.finish()}
            className="rounded-xl border border-white/20 px-6 font-display text-lg font-semibold text-white/80 active:scale-[0.98]"
          >
            Finish
          </button>
          </div>
        </div>
      ) : (
        // finished
        <div className="space-y-3">
          <div className="flex gap-3">
            {!looper.isPlaying ? (
              <button
                onClick={looper.playAll}
                className="flex-1 rounded-xl bg-accent py-4 font-display text-lg font-semibold text-ink active:scale-[0.98]"
              >
                ▶ Play all layers
              </button>
            ) : (
              <button
                onClick={looper.stopPlayback}
                className="flex-1 rounded-xl bg-hot py-4 font-display text-lg font-semibold text-white active:scale-[0.98]"
              >
                ■ Stop
              </button>
            )}
            <button
              onClick={looper.reset}
              className="rounded-xl border border-white/20 px-6 font-display text-lg font-semibold text-white/80 active:scale-[0.98]"
            >
              New
            </button>
          </div>
          <ExportPanel loops={committed} />
        </div>
      )}
    </div>
  );
}
