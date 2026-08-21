// Generates a mono 16-bit WAV of a steady A3 (220 Hz) tone for Chromium's
// --use-file-for-fake-audio-capture, so the pitch detector reads a known note.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = `${here}/fixtures/a3.wav`;
mkdirSync(`${here}/fixtures`, { recursive: true });

const sampleRate = 48000;
const seconds = 5;
const freq = 220; // A3
const n = sampleRate * seconds;

const dataBytes = n * 2;
const buf = Buffer.alloc(44 + dataBytes);
buf.write('RIFF', 0);
buf.writeUInt32LE(36 + dataBytes, 4);
buf.write('WAVE', 8);
buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20); // PCM
buf.writeUInt16LE(1, 22); // mono
buf.writeUInt32LE(sampleRate, 24);
buf.writeUInt32LE(sampleRate * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write('data', 36);
buf.writeUInt32LE(dataBytes, 40);

for (let i = 0; i < n; i++) {
  const s = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.6;
  buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
}

writeFileSync(out, buf);
console.log(`wrote ${out} (${(dataBytes / 1024).toFixed(0)} KiB)`);
