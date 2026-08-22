// Generates the SoundReWave app/PWA icon set.
//
// The mark: overlapping neon pitch-contour lines — the app's core idea (singing
// stacks glowing "sound shapes") — glowing over the deep-studio background.
// Colors and background match the live app (tailwind.config.js / index.css).
//
// The generated files are committed; regenerate only when the mark changes.
// Requires sharp for PNG rasterization:  npm i -D sharp
// Run: node scripts/gen-icons.mjs   (regenerates public/*.svg and public/*.png)
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');

// App palette (kept in sync with src/lib/palette.ts + tailwind.config.js).
const CYAN = '#22d3ee';
const VIOLET = '#7c5cff';
const PINK = '#ff5c8a';
const GREEN = '#4ade80';

/**
 * A smooth pitch-contour polyline across the canvas: two summed sines so the
 * line warbles organically like a sung note rather than a perfect wave.
 */
function contour({ x0, x1, cy, amp, k1, k2, phase }) {
  const pts = [];
  const steps = 96;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y =
      cy +
      amp * Math.sin(k1 * t * Math.PI * 2 + phase) +
      amp * 0.4 * Math.sin(k2 * t * Math.PI * 2 + phase * 1.7);
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${pts.join(' L')}`;
}

// Four stacked contours in the layer colors — the "New Layer" stack.
function waves({ x0, x1, cy }) {
  const lines = [
    { color: PINK, cy: cy - 66, amp: 30, k1: 2.1, k2: 3.3, phase: 0.4, w: 15, o: 0.9 },
    { color: VIOLET, cy: cy - 22, amp: 42, k1: 1.6, k2: 2.7, phase: 1.9, w: 17, o: 1 },
    { color: CYAN, cy: cy + 26, amp: 46, k1: 1.4, k2: 2.4, phase: 3.3, w: 18, o: 1 },
    { color: GREEN, cy: cy + 68, amp: 26, k1: 2.4, k2: 3.6, phase: 5.1, w: 14, o: 0.85 },
  ];
  return lines
    .map(
      (l) =>
        `<path d="${contour({ x0, x1, cy: l.cy, amp: l.amp, k1: l.k1, k2: l.k2, phase: l.phase })}" ` +
        `fill="none" stroke="${l.color}" stroke-width="${l.w}" stroke-linecap="round" ` +
        `stroke-linejoin="round" opacity="${l.o}" filter="url(#glow)"/>`
    )
    .join('\n    ');
}

// The bright "live pitch" node riding the cyan contour.
function node(cx, cy) {
  return (
    `<circle cx="${cx}" cy="${cy}" r="26" fill="${CYAN}" opacity="0.25" filter="url(#glow)"/>` +
    `<circle cx="${cx}" cy="${cy}" r="13" fill="#eafcff" filter="url(#glow)"/>`
  );
}

const defs = `
  <defs>
    <radialGradient id="bg" cx="50%" cy="0%" r="120%">
      <stop offset="0%" stop-color="#1b1f38"/>
      <stop offset="55%" stop-color="#0f1120"/>
      <stop offset="100%" stop-color="#080910"/>
    </radialGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7c5cff" stop-opacity="0.28"/>
      <stop offset="45%" stop-color="#7c5cff" stop-opacity="0"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="7" result="b"/>
      <feMerge>
        <feMergeNode in="b"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>`;

// Badge icon (rounded square) — favicon + "any purpose" manifest icon.
function badgeSvg() {
  const S = 512;
  const r = 116; // iOS-style rounded square
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
${defs}
  <rect width="${S}" height="${S}" rx="${r}" fill="url(#bg)"/>
  <rect width="${S}" height="${S}" rx="${r}" fill="url(#sheen)"/>
  <g>
    ${waves({ x0: 60, x1: 452, cy: 256 })}
    ${node(318, 256 + 26 - 24)}
  </g>
  <rect x="4" y="4" width="${S - 8}" height="${S - 8}" rx="${r - 2}" fill="none" stroke="#ffffff" stroke-opacity="0.06" stroke-width="2"/>
</svg>`;
}

// Maskable icon — full-bleed background, mark kept inside the ~80% safe zone.
function maskableSvg() {
  const S = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" width="${S}" height="${S}">
${defs}
  <rect width="${S}" height="${S}" fill="url(#bg)"/>
  <rect width="${S}" height="${S}" fill="url(#sheen)"/>
  <g>
    ${waves({ x0: 118, x1: 394, cy: 256 })}
    ${node(300, 256 + 26 - 24)}
  </g>
</svg>`;
}

const badge = badgeSvg();
const maskable = maskableSvg();

writeFileSync(join(publicDir, 'icon.svg'), badge);
writeFileSync(join(publicDir, 'favicon.svg'), badge);
writeFileSync(join(publicDir, 'icon-maskable.svg'), maskable);

const density = 384; // 512px @ 72dpi base → crisp raster
async function raster(svg, size, out) {
  await sharp(Buffer.from(svg), { density })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, out));
  console.log('wrote', out);
}

await raster(badge, 192, 'icon-192.png');
await raster(badge, 512, 'icon-512.png');
await raster(badge, 180, 'apple-touch-icon.png');
await raster(maskable, 512, 'icon-maskable-512.png');
await raster(badge, 32, 'favicon-32.png');

console.log('done');
