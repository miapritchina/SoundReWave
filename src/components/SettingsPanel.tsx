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
  presets: Preset[];
  onApplyPreset: (name: string) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (name: string) => void;
}

export function SettingsPanel({
  settings,
  onChange,
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
          { value: 2, label: '2 oct' },
          { value: 3, label: '3 oct' },
          { value: 4, label: '4 oct' },
        ]}
        onChange={(v) => onChange({ octaves: v })}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-white/55">Speed</span>
        <div className="flex flex-1 items-center gap-2">
          {/* Reversed: drag right = faster = shorter window. */}
          <input
            type="range"
            min={2}
            max={18}
            step={1}
            value={20 - settings.windowSec}
            onChange={(e) => onChange({ windowSec: 20 - Number(e.target.value) })}
            className="min-w-0 flex-1 accent-accent"
            aria-label="Graph speed"
          />
          <span className="w-9 text-right font-mono text-[11px] text-white/50">{settings.windowSec}s</span>
        </div>
      </div>
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
          value={settings.loopLengthSec}
          options={[
            { value: 4, label: '4s' },
            { value: 6, label: '6s' },
            { value: 8, label: '8s' },
            { value: 12, label: '12s' },
          ]}
          onChange={(v) => onChange({ loopLengthSec: v })}
        />
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
        className="border-t border-white/10 pt-2 text-center font-mono text-[10px] text-white/35"
      >
        v{VERSION} · {BUILD_SHA}
        {BUILD_TIME ? ` · ${BUILD_TIME} UTC` : ''}
      </div>
    </div>
  );
}
