import type { Loop } from './contour';

const OfflineCtx: typeof OfflineAudioContext =
  window.OfflineAudioContext ??
  (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext;

function loopsWithAudio(loops: Loop[]): { audio: AudioBuffer }[] {
  return loops.filter((l): l is Loop & { audio: AudioBuffer } => l.audio != null);
}

/** Headroom gain so summed layers don't clip. */
function mixGain(n: number): number {
  return n <= 1 ? 1 : 1 / Math.sqrt(n);
}

/** All takes starting together (overlapped), rendered to one buffer. */
export async function mixOverlapped(loops: Loop[]): Promise<AudioBuffer> {
  const items = loopsWithAudio(loops);
  if (!items.length) throw new Error('No recorded audio to mix.');
  const sampleRate = items[0].audio.sampleRate;
  const seconds = Math.max(...items.map((i) => i.audio.duration));
  const ctx = new OfflineCtx(1, Math.ceil(seconds * sampleRate), sampleRate);
  const gain = ctx.createGain();
  gain.gain.value = mixGain(items.length);
  gain.connect(ctx.destination);
  for (const { audio } of items) {
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(gain);
    src.start(0);
  }
  return ctx.startRendering();
}

/** All takes one after another (sequential), rendered to one long buffer. */
export async function mixSequential(loops: Loop[]): Promise<AudioBuffer> {
  const items = loopsWithAudio(loops);
  if (!items.length) throw new Error('No recorded audio to mix.');
  const sampleRate = items[0].audio.sampleRate;
  const seconds = items.reduce((sum, i) => sum + i.audio.duration, 0);
  const ctx = new OfflineCtx(1, Math.ceil(seconds * sampleRate), sampleRate);
  let t = 0;
  for (const { audio } of items) {
    const src = ctx.createBufferSource();
    src.buffer = audio;
    src.connect(ctx.destination);
    src.start(t);
    t += audio.duration;
  }
  return ctx.startRendering();
}
