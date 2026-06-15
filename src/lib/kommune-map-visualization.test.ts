import { describe, expect, it } from 'vitest';
import { ansvarIndexColor, computeAnsvarIndices } from '@/lib/kommune-map-visualization';
import type { KommuneRankingData } from '@/lib/types';

describe('computeAnsvarIndices', () => {
  it('matches ranglisten formula (levering % ÷ ansvar %)', () => {
    const ranking = {
      byKommune: {
        '0101': { ansvarPct: 1.2973 },
        '0147': { ansvarPct: 2.0 },
      },
    } as unknown as KommuneRankingData;

    const kommuner = [
      { kode: '0101', extractionHa: 1976.4, afforestationTotalHa: 0 },
      { kode: '0147', extractionHa: 500, afforestationTotalHa: 0 },
    ];

    const indices = computeAnsvarIndices(kommuner, 'extraction', ranking);
    const natTotal = 2476.4;
    const expected0101 = ((1976.4 / natTotal) * 100) / 1.2973;
    expect(indices['0101']).toBeCloseTo(expected0101, 3);
    expect(indices['0101']).toBeGreaterThan(1);
  });
});

describe('ansvarIndexColor', () => {
  it('uses fixed thresholds aligned with legend', () => {
    expect(ansvarIndexColor(0, 'extraction')).toBe('hsl(0 0% 92%)');
    expect(ansvarIndexColor(0.5, 'extraction')).toBe('#fef3c7');
    expect(ansvarIndexColor(1.0, 'extraction')).toBe('#fcd34d');
    expect(ansvarIndexColor(1.3, 'extraction')).toBe('#a16207');
    expect(ansvarIndexColor(2.0, 'extraction')).toBe('#78350f');
  });
});
