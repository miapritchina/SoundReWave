import { useCallback, useMemo, useRef, useState } from 'react';
import { PitchGraph } from './components/PitchGraph';
import { NoteReadout } from './components/NoteReadout';
import { ExportPanel } from './components/ExportPanel';
import { SensitivityControl } from './components/SensitivityControl';
import { SettingsPanel } from './components/SettingsPanel';
import { useLooper } from './hooks/useLooper';
import { useSettings } from './hooks/useSettings';
import { useElementSize } from './hooks/useElementSize';
import { A3_MIDI, isNoteHit } from './lib/pitch';
import { layerColor } from './lib/palette';
import { autoRange } from './lib/scales';

export default function App() {
  const [graphRef, size] = useElementSize<HTMLDivElement>();
  const [onTarget, setOnTarget] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const onTargetRef = useRef(false);
  const flashTimer = useRef<number | null>(null);
  const looperRef = useRef<ReturnType<typeof useLooper> | null>(null);

  const { settings, update, presets, applyPreset, savePreset, deletePreset } = useSettings();

  const handleHit = useCallback((freq: number) => {
    const hit = isNoteHit(freq, A3_MIDI);
    if (hit && !onTargetRef.current) looperRef.current?.playHitTone();
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

  const looper = useLooper({
    onHit: handleHit,
    loopMode: settings.loopMode,
    loopLengthMs: settings.loopLengthSec * 1000,
    sensitivity: settings.sensitivity,
  });
  looperRef.current = looper;

  // Keep the live sensitivity and the persisted setting in sync.
  const handleSensitivity = useCallback(
    (v: number) => {
      looper.setSensitivity(v);
      update({ sensitivity: v });
    },
    [looper, update],
  );

  const { status, committed, activePoints } = looper;
  const recording = status === 'recording';
  const finished = status === 'finished';
  const active = recording && !looper.armed;
  const layerIdx = committed.length;
  const fixed = settings.loopMode === 'fixed';
  const windowMs = (fixed ? settings.loopLengthSec : settings.windowSec) * 1000;

  const lastActiveMs = activePoints.length ? activePoints[activePoints.length - 1].tMs : 0;
  const remainingSec = Math.max(0, Math.ceil((settings.loopLengthSec * 1000 - lastActiveMs) / 1000));
  const primaryLabel = fixed && !looper.armed ? 'Stop' : 'New Layer';

  const range = useMemo(
    () => autoRange(committed, settings.octaves, activePoints),
    [committed, settings.octaves, activePoints],
  );

  // Warn on total recorded time (real memory pressure), not layer count.
  const totalRecordedSec = useMemo(() => {
    const active = activePoints.length ? activePoints[activePoints.length - 1].tMs : 0;
    return (committed.reduce((s, l) => s + l.durationMs, 0) + active) / 1000;
  }, [committed, activePoints]);

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col gap-3 p-4 no-touch-callout">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-xl font-bold tracking-tight">
          Sound<span className="text-glow">Re</span>Wave
        </h1>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-white/40">
            {committed.length} layer{committed.length === 1 ? '' : 's'}
            {finished && ' · finished'}
          </span>
          <button
            onClick={() => setShowSettings((v) => !v)}
            className={`rounded-lg border px-2 py-1 text-sm ${
              showSettings ? 'border-accent/60 text-accent' : 'border-white/15 text-white/60'
            }`}
            aria-label="Visual settings"
            aria-pressed={showSettings}
          >
            ⚙
          </button>
        </div>
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
            activePoints={activePoints}
            activeColor={layerColor(layerIdx)}
            fMin={range.fMin}
            fMax={range.fMax}
            windowMs={windowMs}
            style={settings.style}
            playhead={settings.playhead}
            playheadTMs={looper.isPlaying ? looper.playbackMs : undefined}
          />
        )}
        {onTarget && (
          <div className="pointer-events-none absolute right-3 top-3 rounded-full bg-hot px-3 py-1 font-mono text-xs font-semibold text-white">
            A3!
          </div>
        )}
        {looper.paused && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-amber-400/90 px-3 py-1 font-mono text-xs font-semibold text-ink">
            Paused
          </div>
        )}
        {status !== 'recording' && !finished && (
          <div className="absolute inset-0 grid place-items-center overflow-auto bg-ink/70 p-5 backdrop-blur-sm">
            {looper.error ? (
              <p className="max-w-xs text-center text-sm text-hot">{looper.error}</p>
            ) : (
              <div className="max-w-sm space-y-3">
                <h2 className="font-display text-xl font-bold text-white">Paint your voice 🎤</h2>
                <p className="text-sm leading-relaxed text-white/65">
                  SoundReWave turns your singing — or just talking — into a live pitch drawing,
                  then lets you stack takes into overlapping “sound shapes.”
                </p>
                <ul className="space-y-2 text-sm text-white/80">
                  <li>
                    <b className="text-accent">Start</b> — allow the mic, then sing or say a word.
                  </li>
                  <li>
                    📈 Your pitch draws as a live line. Hit <b>A3</b> for a chime.
                  </li>
                  <li>
                    <b className="text-accent">New Layer</b> stacks another take over the last one.
                  </li>
                  <li>
                    <b className="text-accent">Finish</b> plays every layer together — then export the
                    audio (WAV/MP3) or the artwork (SVG/PNG).
                  </li>
                  <li>
                    <b className="text-accent">⚙ Settings</b> — visual styles, pitch range, loop mode,
                    and a playhead.
                  </li>
                </ul>
                <p className="text-xs leading-relaxed text-white/40">
                  Best with headphones. Tip: sing one short word and loop it a few times to watch it build up.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={update}
          presets={presets}
          onApplyPreset={applyPreset}
          onSavePreset={savePreset}
          onDeletePreset={deletePreset}
        />
      )}

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
          {active && (
            <SensitivityControl value={looper.sensitivity} onChange={handleSensitivity} level={looper.inputLevel} />
          )}
          {fixed && active && (
            <p className="text-center font-mono text-[11px] text-white/50">{remainingSec}s left in loop</p>
          )}
          {looper.armed && (
            <p className="text-center text-[11px] text-white/55">
              Take saved — <span className="text-accent">New Layer</span> to record the next {settings.loopLengthSec}s loop.
            </p>
          )}
          {totalRecordedSec > 180 && (
            <p className="text-center text-[11px] text-amber-300/80">
              ~{Math.round(totalRecordedSec)}s recorded — getting large in memory, consider finishing.
            </p>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => void looper.advance()}
              className="flex-1 rounded-xl bg-accent py-4 font-display text-lg font-semibold text-ink active:scale-[0.98]"
            >
              {primaryLabel}
            </button>
            {active && (
              <button
                onClick={() => (looper.paused ? looper.resume() : looper.pause())}
                className="rounded-xl border border-white/20 px-5 font-display text-base font-semibold text-white/80 active:scale-[0.98]"
              >
                {looper.paused ? 'Resume' : 'Pause'}
              </button>
            )}
            <button
              onClick={() => void looper.finish()}
              className="rounded-xl border border-white/20 px-5 font-display text-base font-semibold text-white/80 active:scale-[0.98]"
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
                onClick={() => void looper.playAll()}
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
          <ExportPanel loops={committed} style={settings.style} fMin={range.fMin} fMax={range.fMax} />
        </div>
      )}
    </div>
  );
}
