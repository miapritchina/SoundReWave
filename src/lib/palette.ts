/** Layer stroke colors, cycled as new loops are added. */
export const LAYER_COLORS = [
  '#22d3ee', // cyan
  '#7c5cff', // violet
  '#ff5c8a', // pink
  '#4ade80', // green
  '#fbbf24', // amber
  '#f472b6', // rose
  '#38bdf8', // sky
  '#a78bfa', // lavender
];

export function layerColor(index: number): string {
  return LAYER_COLORS[index % LAYER_COLORS.length];
}
