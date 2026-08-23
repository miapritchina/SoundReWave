/** Visual/behavior settings, persisted per-viewer in localStorage. */

export type StyleMode = 'layers' | 'bloom' | 'aurora';
export type LoopMode = 'manual' | 'fixed';

export interface VisualSettings {
  style: StyleMode;
  /** Visible pitch range in octaves (auto-centered on your voice). */
  octaves: number;
  /** Graph time window in seconds (smaller = fills/scrolls faster). */
  windowSec: number;
  /** Show a vertical playhead that tracks time. */
  playhead: boolean;
  /** 'manual' = New Layer ends/starts takes; 'fixed' = auto-stop after length. */
  loopMode: LoopMode;
  /** Fixed-loop length in seconds. */
  loopLengthSec: number;
  /** Mic detection sensitivity 0..1 (persisted across reloads). */
  sensitivity: number;
  /** When true, silence/unvoiced input is gated out of the recording too. */
  gateSilence: boolean;
}

export const DEFAULT_SETTINGS: VisualSettings = {
  style: 'layers',
  octaves: 2,
  windowSec: 9,
  playhead: false,
  loopMode: 'manual',
  loopLengthSec: 6,
  sensitivity: 0.65,
  gateSilence: true,
};

/** Visual-only keys — presets carry these; loop mode/sensitivity are separate. */
export const VISUAL_KEYS = ['style', 'octaves', 'windowSec', 'playhead'] as const;

export function visualSubset(s: VisualSettings): Partial<VisualSettings> {
  return {
    style: s.style,
    octaves: s.octaves,
    windowSec: s.windowSec,
    playhead: s.playhead,
  };
}

export interface Preset {
  name: string;
  /** Visual-only overrides applied on top of current settings. */
  settings: Partial<VisualSettings>;
  builtin?: boolean;
}

export const BUILTIN_PRESETS: Preset[] = [
  { name: 'Layers', builtin: true, settings: { style: 'layers', octaves: 3, windowSec: 10, playhead: false } },
  { name: 'Bloom', builtin: true, settings: { style: 'bloom', octaves: 2, windowSec: 8, playhead: true } },
  { name: 'Aurora', builtin: true, settings: { style: 'aurora', octaves: 2, windowSec: 8, playhead: false } },
];

const SETTINGS_KEY = 'srw:settings';
const PRESETS_KEY = 'srw:presets';

export function loadSettings(): VisualSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<VisualSettings>) };
  } catch {
    /* unavailable / blocked */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: VisualSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function loadUserPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    if (raw) return JSON.parse(raw) as Preset[];
  } catch {
    /* ignore */
  }
  return [];
}

export function saveUserPresets(presets: Preset[]): void {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /* ignore */
  }
}
