import type { Loop } from './contour';
import { toSegments, type Segment } from './contour';
import { noteTicks, DEFAULT_FMIN, DEFAULT_FMAX } from './scales';
import { hueShift } from './palette';
import type { StyleMode } from './settings';

const BLOOM_LAYER = '#ff9a4d';

export interface SvgOptions {
  width?: number;
  height?: number;
  fMin?: number;
  fMax?: number;
  windowMs?: number;
  maxBridgeMs?: number;
  background?: string;
  style?: StyleMode;
  padding?: { top: number; right: number; bottom: number; left: number };
}

const PAD = { top: 20, right: 20, bottom: 20, left: 48 };

/** Catmull-Rom → cubic Bézier path for a smooth contour (matches on-screen curve). */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

/** Serialize the layered contour to a standalone SVG string (art export). */
export function svgFromLoops(loops: Loop[], opts: SvgOptions = {}): string {
  const width = opts.width ?? 1200;
  const height = opts.height ?? 600;
  const fMin = opts.fMin ?? DEFAULT_FMIN;
  const fMax = opts.fMax ?? DEFAULT_FMAX;
  const maxBridgeMs = opts.maxBridgeMs ?? 180;
  const bg = opts.background ?? '#0a0b14';
  const pad = opts.padding ?? PAD;
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const domainMs = Math.max(opts.windowMs ?? 0, ...loops.map((l) => l.durationMs), 1);

  const xOf = (tMs: number) => pad.left + (tMs / domainMs) * innerW;
  const logMin = Math.log(fMin);
  const logMax = Math.log(fMax);
  const yOf = (freq: number) => pad.top + innerH - ((Math.log(freq) - logMin) / (logMax - logMin)) * innerH;

  const segToPath = (seg: Segment) =>
    smoothPath(seg.map((p) => ({ x: xOf(p.tMs), y: yOf(p.freq) })));

  const ticks = noteTicks(fMin, fMax);
  const grid = ticks
    .map((t) => {
      const y = yOf(t.freq).toFixed(2);
      const line = `<line x1="${pad.left}" y1="${y}" x2="${pad.left + innerW}" y2="${y}" stroke="#ffffff" stroke-opacity="${t.major ? 0.14 : 0.05}"/>`;
      const label = t.major
        ? `<text x="${pad.left - 8}" y="${y}" dy="0.32em" text-anchor="end" font-family="monospace" font-size="11" fill="#8b90b8">${t.name}</text>`
        : '';
      return line + label;
    })
    .join('');

  const bloom = opts.style === 'bloom';
  const aurora = opts.style === 'aurora';

  const defs = aurora
    ? '<defs>' +
      loops
        .map(
          (loop, i) =>
            `<linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${loop.color}"/><stop offset="100%" stop-color="${hueShift(loop.color, 55)}"/></linearGradient>`,
        )
        .join('') +
      '</defs>'
    : '';

  const paths = loops
    .map((loop, i) => {
      const stroke = aurora ? `url(#g${i})` : bloom ? BLOOM_LAYER : loop.color;
      const opacity = aurora ? 0.6 : bloom ? 0.4 : 0.85;
      const blend = bloom ? ' style="mix-blend-mode:screen"' : '';
      const w = bloom ? 3 : 2.5;
      return toSegments(loop.points, maxBridgeMs)
        .map(
          (seg) =>
            `<path d="${segToPath(seg)}" fill="none" stroke="${stroke}" stroke-width="${w}" stroke-opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round"${blend}/>`,
        )
        .join('');
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${bg}"/>` +
    defs +
    grid +
    paths +
    `</svg>`;
}

/** Rasterize an SVG string to a PNG Blob (browser only). */
export function pngFromSvg(svg: string, scale = 2): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const wMatch = /width="(\d+)"/.exec(svg);
    const hMatch = /height="(\d+)"/.exec(svg);
    const w = wMatch ? parseInt(wMatch[1], 10) : 1200;
    const h = hMatch ? parseInt(hMatch[1], 10) : 600;
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas 2D unavailable'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encode failed'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG rasterization failed'));
    };
    img.src = url;
  });
}

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
