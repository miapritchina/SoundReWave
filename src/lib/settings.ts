/** Visual/behavior settings, persisted per-viewer in localStorage. */

export type StyleMode = 'layers' | 'bloom';

export interface VisualSettings {
  style: StyleMode;
  /** Visible pitch range in octaves (auto-centered on your voice). */
  octaves: number;
  /** Graph time window in seconds (smaller = fills/scrolls faster). */
  windowSec: number;
  /** Show a vertical playhead that tracks time. */
  playhead: boolean;
}

export const DEFAULT_SETTINGS: VisualSettings = {
  style: 'layers',
  octaves: 2,
  windowSec: 9,
  playhead: false,
};

export interface Preset {
  name: string;
  settings: VisualSettings;
  builtin?: boolean;
}

export const BUILTIN_PRESETS: Preset[] = [
  { name: 'Layers', builtin: true, settings: { style: 'layers', octaves: 3, windowSec: 10, playhead: false } },
  { name: 'Bloom', builtin: true, settings: { style: 'bloom', octaves: 2, windowSec: 8, playhead: true } },
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
