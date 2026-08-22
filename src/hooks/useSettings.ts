import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type VisualSettings,
  type Preset,
  BUILTIN_PRESETS,
  loadSettings,
  saveSettings,
  loadUserPresets,
  saveUserPresets,
  visualSubset,
} from '../lib/settings';

/** Visual settings + preset management, persisted per-viewer in localStorage. */
export function useSettings() {
  const [settings, setSettings] = useState<VisualSettings>(() => loadSettings());
  const [userPresets, setUserPresets] = useState<Preset[]>(() => loadUserPresets());

  useEffect(() => saveSettings(settings), [settings]);

  const update = useCallback(
    (patch: Partial<VisualSettings>) => setSettings((s) => ({ ...s, ...patch })),
    [],
  );

  const presets = useMemo(() => [...BUILTIN_PRESETS, ...userPresets], [userPresets]);

  const applyPreset = useCallback(
    (name: string) => {
      const p = presets.find((x) => x.name === name);
      // Merge visual overrides, preserving loop mode / other settings.
      if (p) setSettings((s) => ({ ...s, ...p.settings }));
    },
    [presets],
  );

  const savePreset = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setUserPresets((prev) => {
        const next = [
          ...prev.filter((p) => p.name !== trimmed),
          { name: trimmed, settings: visualSubset(settings) },
        ];
        saveUserPresets(next);
        return next;
      });
    },
    [settings],
  );

  const deletePreset = useCallback((name: string) => {
    setUserPresets((prev) => {
      const next = prev.filter((p) => p.name !== name);
      saveUserPresets(next);
      return next;
    });
  }, []);

  return { settings, update, presets, applyPreset, savePreset, deletePreset };
}
