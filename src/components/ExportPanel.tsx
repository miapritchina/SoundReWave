import { useState } from 'react';
import type { Loop } from '../lib/contour';
import { svgFromLoops, pngFromSvg, downloadBlob } from '../lib/svgExport';
import { mixOverlapped, mixSequential } from '../lib/mixdown';
import { encodeWav } from '../lib/wav';

export interface ExportPanelProps {
  loops: Loop[];
}

type Job = 'svg' | 'png' | 'wav-overlap' | 'wav-seq' | null;

export function ExportPanel({ loops }: ExportPanelProps) {
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
      const svg = svgFromLoops(loops);
      downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), 'soundrewave.svg');
    });

  const exportPng = () =>
    run('png', async () => {
      const svg = svgFromLoops(loops);
      downloadBlob(await pngFromSvg(svg, 2), 'soundrewave.png');
    });

  const exportWav = (kind: 'wav-overlap' | 'wav-seq') =>
    run(kind, async () => {
      const buffer =
        kind === 'wav-overlap' ? await mixOverlapped(loops) : await mixSequential(loops);
      downloadBlob(
        encodeWav(buffer),
        kind === 'wav-overlap' ? 'soundrewave-overlapped.wav' : 'soundrewave-sequential.wav',
      );
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
        <button className={btn} disabled={busy !== null || !hasAudio} onClick={() => exportWav('wav-overlap')}>
          {busy === 'wav-overlap' ? 'Rendering…' : 'Audio · Overlapped WAV'}
        </button>
        <button className={btn} disabled={busy !== null || !hasAudio} onClick={() => exportWav('wav-seq')}>
          {busy === 'wav-seq' ? 'Rendering…' : 'Audio · Sequential WAV'}
        </button>
      </div>
      {!hasAudio && <p className="text-[11px] text-white/40">Audio export needs recorded takes.</p>}
      {err && <p className="text-[11px] text-hot">{err}</p>}
    </div>
  );
}
