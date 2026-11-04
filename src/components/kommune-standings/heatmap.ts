import type { StandingsLensKey } from '@/lib/kommune-ranking';

const BAR_COLORS: Record<StandingsLensKey, { low: string; high: string }> = {
  idxLavbund: { low: '#fffbeb', high: '#fde68a' },
  idxSkov: { low: '#f0fdf4', high: '#86efac' },
  idxKvaelstof: { low: '#f0fdfb', high: '#99f6e4' },
};

/** Interpolate heatmap bar background for a cell value. */
export function standingsHeatmapBg(value: number, maxVal: number, key: StandingsLensKey): string {
  if (value <= 0 || maxVal <= 0) return 'transparent';
  const t = Math.min(value / maxVal, 1);
  const { low, high } = BAR_COLORS[key];
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(low);
  const [r2, g2, b2] = parse(high);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

export const MEDAL_COLORS = ['#caa84a', '#9ca3af', '#bd8a55'] as const;
