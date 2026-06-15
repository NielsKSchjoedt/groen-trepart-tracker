import type { FinansieringStroem } from '@/lib/types';

export const STROEM_TONES = {
  green: {
    ink: '#15803d',
    soft: 'hsl(140 45% 96%)',
    line: 'hsl(140 40% 80%)',
    chip: 'hsl(140 35% 92%)',
  },
  teal: {
    ink: '#0d7d72',
    soft: 'hsl(178 40% 95.5%)',
    line: 'hsl(178 35% 78%)',
    chip: 'hsl(178 32% 91%)',
  },
  red: {
    ink: 'hsl(0 65% 45%)',
    soft: 'hsl(0 60% 97%)',
    line: 'hsl(0 60% 82%)',
    chip: 'hsl(0 55% 94%)',
  },
} as const;

export function getStroemTone(stroem: FinansieringStroem) {
  return STROEM_TONES[stroem.tone];
}

/** Map financing category id → pillar accent for Lag 2 cards. */
export const KATEGORI_ACCENT: Record<string, string> = {
  'lavbund-udtagning': '#a16207',
  kvaelstof: '#0d9488',
  skov: '#15803d',
  'natur-sammenhaengende': '#16a34a',
};
