import { Mp3Encoder } from '@breezystack/lamejs';

/**
 * Encode an AudioBuffer to an MP3 Blob. Mono (mixes down if multi-channel).
 * Runs on the main thread; fine for the few-second takes we produce.
 */
export function encodeMp3(buffer: AudioBuffer, kbps = 192): Blob {
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const chans = buffer.numberOfChannels;

  // Downmix to mono Int16.
  const samples = new Int16Array(numFrames);
  for (let i = 0; i < numFrames; i++) {
    let sum = 0;
    for (let c = 0; c < chans; c++) sum += buffer.getChannelData(c)[i];
    const s = Math.max(-1, Math.min(1, sum / chans));
    samples[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }

  const encoder = new Mp3Encoder(1, sampleRate, kbps);
  const blockSize = 1152;
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < samples.length; i += blockSize) {
    const block = samples.subarray(i, i + blockSize);
    const buf = encoder.encodeBuffer(block);
    if (buf.length > 0) chunks.push(new Uint8Array(buf));
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));

  return new Blob(chunks as BlobPart[], { type: 'audio/mpeg' });
}
