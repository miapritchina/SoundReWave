import { useState } from 'react';
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

export function ExportPanel({ loops, style, fMin, fMax }: ExportPanelProps) {
  const [busy, setBusy] = useState<Job>(null);
  const [err, setErr] = useState<string | null>(null);
  const hasAudio = loops.some((l) => l.audio);

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

  const btn =
    'rounded-lg border border-white/15 bg-haze/60 px-3 py-2 text-sm font-medium text-white/85 disabled:opacity-40 active:scale-[0.98]';

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <button className={btn} disabled={busy !== null} onClick={exportSvg}>
          {busy === 'svg' ? 'Exporting…' : 'Art · SVG'}
        </button>
        <button className={btn} disabled={busy !== null} onClick={exportPng}>
          {busy === 'png' ? 'Exporting…' : 'Art · PNG'}
        </button>
        <button className={btn} disabled={busy !== null || !hasAudio} onClick={() => exportMp3('mp3-overlap')}>
          {busy === 'mp3-overlap' ? 'Encoding…' : 'Overlapped · MP3'}
        </button>
        <button className={btn} disabled={busy !== null || !hasAudio} onClick={() => exportMp3('mp3-seq')}>
          {busy === 'mp3-seq' ? 'Encoding…' : 'Sequential · MP3'}
        </button>
      </div>
      {!hasAudio && <p className="text-[11px] text-white/40">Audio export needs recorded takes.</p>}
      {err && <p className="text-[11px] text-hot">{err}</p>}
    </div>
  );
}
