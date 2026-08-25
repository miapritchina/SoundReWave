import { useState } from 'react';
import type { VisualSettings, Preset } from '../lib/settings';
import { VERSION, BUILD_SHA, BUILD_TIME } from '../version';

interface SegProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function Segmented<T extends string | number>({ label, value, options, onChange }: SegProps<T>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-white/55">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-white/10">
        {options.map((o) => (
          <button
            key={String(o.value)}
            onClick={() => onChange(o.value)}
            className={`px-2.5 py-1 text-xs ${
              o.value === value ? 'bg-accent text-ink' : 'bg-haze/40 text-white/70'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export interface SettingsPanelProps {
  settings: VisualSettings;
  onChange: (patch: Partial<VisualSettings>) => void;
  /** Window length (whole seconds) auto-derived from the first wave, or null
   * before one is recorded. Shown as the readout while Auto speed is on. */
  autoWindowSec?: number | null;
  presets: Preset[];
  onApplyPreset: (name: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (name: string) => void;
}

export function SettingsPanel({
  settings,
  onChange,
  autoWindowSec,
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: SettingsPanelProps) {
  const [presetName, setPresetName] = useState('');
  const userPresets = presets.filter((p) => !p.builtin);

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-panel/50 p-3">
      <Segmented
        label="Preset"
        value={''}
        options={[{ value: '', label: '—' }, ...presets.map((p) => ({ value: p.name, label: p.name }))]}
        onChange={(name) => name && onApplyPreset(String(name))}
      />
      <Segmented
        label="Style"
        value={settings.style}
        options={[
          { value: 'layers', label: 'Layers' },
          { value: 'bloom', label: 'Bloom' },
          { value: 'aurora', label: 'Aurora' },
        ]}
        onChange={(v) => onChange({ style: v })}
      />
      <Segmented
        label="Range"
        value={settings.octaves}
        options={[
          { value: 1, label: '1 oct' },
          { value: 2, label: '2 oct' },
          { value: 3, label: '3 oct' },
          { value: 4, label: '4 oct' },
        ]}
        onChange={(v) => onChange({ octaves: v })}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/55">Speed</span>
        <div className="flex flex-1 items-center gap-2">
          <button
            onClick={() => onChange({ windowAuto: !settings.windowAuto })}
            className={`rounded-md border px-2 py-1 text-[11px] ${
              settings.windowAuto ? 'border-accent/60 bg-accent/15 text-accent' : 'border-white/15 text-white/55'
            }`}
            aria-pressed={settings.windowAuto}
            aria-label="Auto speed from first wave"
          >
            Auto
          </button>
          {/* Reversed: drag right = faster = shorter window. Disabled while Auto
              derives the window from the first wave. */}
          <input
            type="range"
            min={2}
            max={18}
            step={1}
            value={20 - settings.windowSec}
            onChange={(e) => onChange({ windowSec: 20 - Number(e.target.value) })}
            disabled={settings.windowAuto}
            className="min-w-0 flex-1 accent-accent disabled:opacity-40"
            aria-label="Graph speed"
          />
          <span className="w-9 text-right font-mono text-[11px] text-white/50">
            {settings.windowAuto ? (autoWindowSec != null ? `${autoWindowSec}s` : 'auto') : `${settings.windowSec}s`}
          </span>
        </div>
      </div>
      {settings.windowAuto && (
        <p className="text-[10px] leading-snug text-white/40">
          Speed follows your first wave’s length — later takes line up with it. The first take fills the width as you record.
        </p>
      )}
      <div className="border-t border-white/10 pt-2">
        <Segmented
          label="Loop"
          value={settings.loopMode}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'fixed', label: 'Fixed' },
          ]}
          onChange={(v) => onChange({ loopMode: v })}
        />
      </div>
      {settings.loopMode === 'fixed' && (
        <Segmented
          label="Length"
          value={settings.loopFromFirst ? 'first' : String(settings.loopLengthSec)}
          options={[
            { value: 'first', label: '1st' },
            { value: '1', label: '1s' },
            { value: '2', label: '2s' },
            { value: '3', label: '3s' },
            { value: '4', label: '4s' },
            { value: '6', label: '6s' },
          ]}
          onChange={(v) =>
            v === 'first'
              ? onChange({ loopFromFirst: true })
              : onChange({ loopFromFirst: false, loopLengthSec: Number(v) })
          }
        />
      )}
      {settings.loopMode === 'fixed' && settings.loopFromFirst && (
        <p className="text-[10px] leading-snug text-white/40">
          Every loop matches your first wave’s length (rounded up to a whole second).
        </p>
      )}

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/55">Playhead</span>
        <button
          onClick={() => onChange({ playhead: !settings.playhead })}
          className={`h-6 w-11 rounded-full transition-colors ${settings.playhead ? 'bg-accent' : 'bg-white/15'}`}
          aria-pressed={settings.playhead}
          aria-label="Toggle playhead"
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition-transform ${
              settings.playhead ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/55">Skip silence</span>
        <button
          onClick={() => onChange({ gateSilence: !settings.gateSilence })}
          className={`h-6 w-11 rounded-full transition-colors ${settings.gateSilence ? 'bg-accent' : 'bg-white/15'}`}
          aria-pressed={settings.gateSilence}
          aria-label="Toggle skip silence"
        >
          <span
            className={`block h-5 w-5 rounded-full bg-white transition-transform ${
              settings.gateSilence ? 'translate-x-5' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      <div className="flex gap-2 border-t border-white/10 pt-2">
        <input
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          placeholder="Save current as…"
          className="min-w-0 flex-1 rounded-lg border border-white/10 bg-haze/40 px-2 py-1 text-xs text-white/85 placeholder:text-white/30"
        />
        <button
          onClick={() => {
            onSavePreset(presetName);
            setPresetName('');
          }}
          disabled={!presetName.trim()}
          className="rounded-lg bg-glow px-3 py-1 text-xs font-medium text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {userPresets.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {userPresets.map((p) => (
            <span key={p.name} className="flex items-center gap-1 rounded-full bg-haze/50 px-2 py-0.5 text-[11px] text-white/70">
              {p.name}
              <button onClick={() => onDeletePreset(p.name)} className="text-white/40 hover:text-hot" aria-label={`Delete ${p.name}`}>
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div
        data-testid="app-version"
        className="space-y-1 border-t border-white/10 pt-2 text-center font-mono text-[10px] text-white/35"
      >
        <div>
          v{VERSION} · {BUILD_SHA}
          {BUILD_TIME ? ` · ${BUILD_TIME} UTC` : ''}
        </div>
        <a
          href="storybook/"
          target="_blank"
          rel="noreferrer"
          className="inline-block text-white/45 underline decoration-white/20 underline-offset-2 hover:text-accent"
        >
          Component storybook ↗
        </a>
      </div>
    </div>
  );
}
