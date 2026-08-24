import { useEffect, useRef, useState } from 'react';
import type { Loop } from '../lib/contour';
import { svgFromLoops, pngFromSvg, downloadBlob } from '../lib/svgExport';
import { mixOverlapped, mixSequential } from '../lib/mixdown';

import type { StyleMode } from '../lib/settings';

export interface ExportPanelProps {
  loops: Loop[];
  style?: StyleMode;
  fMin?: number;
  fMax?: number;
}

type Job = 'svg' | 'png' | 'mp3-overlap' | 'mp3-seq' | null;

/**
 * Export controls collapsed into a single share icon (sits in the header next
 * to ⚙). Tapping it opens a small menu of the four exports; artwork is always
 * available, audio only once takes have been recorded.
 */
export function ExportPanel({ loops, style, fMin, fMax }: ExportPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<Job>(null);
  const [err, setErr] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const hasAudio = loops.some((l) => l.audio);
  const disabled = loops.length === 0;

  // Close the menu on outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = async (job: Exclude<Job, null>, fn: () => Promise<void>) => {
    setErr(null);
    setBusy(job);
    try {
      await fn();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const exportSvg = () =>
    run('svg', async () => {
      const svg = svgFromLoops(loops, { style, fMin, fMax });
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'soundrewave.svg');
    });

  const exportPng = () =>
    run('png', async () => {
      const svg = svgFromLoops(loops, { style, fMin, fMax });
      downloadBlob(await pngFromSvg(svg, 2), 'soundrewave.png');
    });

  const exportMp3 = (kind: 'mp3-overlap' | 'mp3-seq') =>
    run(kind, async () => {
      const overlapped = kind === 'mp3-overlap';
      const buffer = overlapped ? await mixOverlapped(loops) : await mixSequential(loops);
      const { encodeMp3 } = await import('../lib/mp3');
      downloadBlob(encodeMp3(buffer), `soundrewave-${overlapped ? 'overlapped' : 'sequential'}.mp3`);
    });

  const item =
    'flex w-full items-center justify-between gap-6 px-3 py-2 text-left text-sm text-white/85 hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div ref={rootRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`rounded-lg border px-2 py-1 text-sm disabled:opacity-40 ${
          open ? 'border-accent/60 text-accent' : 'border-white/15 text-white/60'
        }`}
        aria-label="Export & share"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* iOS-style share glyph: tray with an up arrow. */}
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 15V3" />
          <path d="M8 7l4-4 4 4" />
          <path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-xl border border-white/12 bg-panel/95 py-1 shadow-xl shadow-black/40 backdrop-blur"
        >
          <p className="px-3 pb-1 pt-1 text-[10px] uppercase tracking-wider text-white/35">Artwork</p>
          <button role="menuitem" className={item} disabled={busy !== null} onClick={exportSvg}>
            <span>SVG (vector)</span>
            <span className="font-mono text-[11px] text-white/40">{busy === 'svg' ? '…' : '.svg'}</span>
          </button>
          <button role="menuitem" className={item} disabled={busy !== null} onClick={exportPng}>
            <span>PNG (image)</span>
            <span className="font-mono text-[11px] text-white/40">{busy === 'png' ? '…' : '.png'}</span>
          </button>
          <p className="border-t border-white/10 px-3 pb-1 pt-2 text-[10px] uppercase tracking-wider text-white/35">
            Audio
          </p>
          <button
            role="menuitem"
            className={item}
            disabled={busy !== null || !hasAudio}
            onClick={() => exportMp3('mp3-overlap')}
          >
            <span>Overlapped mix</span>
            <span className="font-mono text-[11px] text-white/40">{busy === 'mp3-overlap' ? '…' : '.mp3'}</span>
          </button>
          <button
            role="menuitem"
            className={item}
            disabled={busy !== null || !hasAudio}
            onClick={() => exportMp3('mp3-seq')}
          >
            <span>Sequential mix</span>
            <span className="font-mono text-[11px] text-white/40">{busy === 'mp3-seq' ? '…' : '.mp3'}</span>
          </button>
          {!hasAudio && <p className="px-3 py-1.5 text-[11px] text-white/40">Audio needs recorded takes.</p>}
          {err && <p className="px-3 py-1.5 text-[11px] text-hot">{err}</p>}
        </div>
      )}
    </div>
  );
}
