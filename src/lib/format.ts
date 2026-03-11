/** Format a number with Danish locale (dot as thousand separator, comma as decimal) */
export function formatDanishNumber(value: number, decimals = 0): string {
  return value.toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Calculate days remaining until a date */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Get progress color class based on percentage */
export function getProgressColor(pct: number): string {
  if (pct >= 80) return '#16a34a'; // green-600
  if (pct >= 60) return '#84cc16'; // lime-500
  if (pct >= 40) return '#facc15'; // yellow-400
  if (pct >= 20) return '#f97316'; // orange-500
  return '#dc2626'; // red-600
}

export function getProgressColorClass(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-lime-500';
  if (pct >= 40) return 'text-yellow-500';
  if (pct >= 20) return 'text-orange-500';
  return 'text-red-600';
}

import type { EcologicalStatus } from './types';

/**
 * EU Water Framework Directive ecological status → color.
 * Follows the standard WFD color scheme used across Europe.
 */
const WFD_COLORS: Record<string, string> = {
  'Høj':            '#2563eb',  // blue — high status
  'God':            '#16a34a',  // green — good status (target)
  'Moderat':        '#eab308',  // yellow — moderate
  'Ringe':          '#f97316',  // orange — poor
  'Dårlig':         '#dc2626',  // red — bad
  'Ikke-god':       '#dc2626',  // red — not good (chemical)
  'Ukendt':         '#d4d4d4',  // gray — unknown
  'Ikke relevant':  '#e5e5e5',  // light gray
};

/** Get WFD status color for a Danish ecological status string */
export function getWfdStatusColor(status: EcologicalStatus | string): string {
  return WFD_COLORS[status] ?? '#d4d4d4';
}

/** Danish label for ecological status */
export function getWfdStatusLabel(status: EcologicalStatus | string): string {
  const labels: Record<string, string> = {
    'Høj': 'Høj tilstand',
    'God': 'God tilstand',
    'Moderat': 'Moderat tilstand',
    'Ringe': 'Ringe tilstand',
    'Dårlig': 'Dårlig tilstand',
    'Ikke-god': 'Ikke god tilstand',
    'Ukendt': 'Ukendt',
    'Ikke relevant': 'Ikke relevant',
  };
  return labels[status] ?? status;
}

type PillarColorScale = readonly [string, string, string, string, string];

const PILLAR_COLOR_SCALES: Record<string, PillarColorScale> = {
  nitrogen:      ['#0d9488', '#2dd4bf', '#facc15', '#f97316', '#dc2626'],
  extraction:    ['#a16207', '#ca8a04', '#facc15', '#f97316', '#dc2626'],
  afforestation: ['#15803d', '#22c55e', '#facc15', '#f97316', '#dc2626'],
  nature:        ['#166534', '#16a34a', '#facc15', '#f97316', '#dc2626'],
};

/**
 * Get a pillar-specific progress color for choropleth maps.
 * Uses the same 5-tier thresholds as `getProgressColor` but with hues
 * that match each pillar's visual identity.
 *
 * @param pct - Progress percentage (0–100)
 * @param pillarId - One of 'nitrogen', 'extraction', 'afforestation', 'nature'
 * @returns Hex color string
 *
 * @example
 * ```ts
 * getPillarProgressColor(85, 'nitrogen'); // '#0d9488' (teal)
 * getPillarProgressColor(85, 'afforestation'); // '#15803d' (forest green)
 * ```
 */
export function getPillarProgressColor(pct: number, pillarId: string): string {
  const scale = PILLAR_COLOR_SCALES[pillarId];
  if (!scale) return getProgressColor(pct);
  if (pct >= 80) return scale[0];
  if (pct >= 60) return scale[1];
  if (pct >= 40) return scale[2];
  if (pct >= 20) return scale[3];
  return scale[4];
}
