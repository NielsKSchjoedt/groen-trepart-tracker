import { describe, expect, it } from 'vitest';
import {
  ansvarIndexColor,
  computeAnsvarIndices,
  getKommuneMapLegendStops,
} from '@/lib/kommune-map-visualization';
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

describe('getKommuneMapLegendStops', () => {
  it('labels nature choropleth stops with numbers from the national max', () => {
    const stops = getKommuneMapLegendStops({
      activeMetric: 'nature',
      fordelingViewMode: 'actual',
      natureLayer: 'b3-landbrug',
      choroplethScale: 'absolute',
      kommuneBenchmark: {
        b1: { metadata: { generatedAt: '', methodVersion: '', sourceLayers: [] }, national: { totalDce30Ha: 0, totalKuPrio1Ha: 0, totalKuPrio2Ha: 0 }, byKommune: {} },
        b2: { metadata: { generatedAt: '', methodVersion: '', sourceLayers: [] }, national: { markerTotalHa: 0, hoejtPotentialeHa: 0, lavtPotentialeHa: 0, udenforPotentialeHa: 0 }, byKommune: {} },
        b3: {
          metadata: { generatedAt: '', methodVersion: '', sourceLayers: [] },
          national: { n2000TotalHa: 100, n2000ErLandbrugHa: 40, andelLandbrugIN2000Pct: 40 },
          byKommune: {
            '0791': { kommuneNavn: 'Viborg', n2000TotalHa: 100, n2000ErLandbrugHa: 56.5, andelLandbrugIN2000Pct: 56.5 },
            '0101': { kommuneNavn: 'København', n2000TotalHa: 10, n2000ErLandbrugHa: 1, andelLandbrugIN2000Pct: 10 },
          },
        },
        b4: null,
      },
    });
    expect(stops[0].label).toContain('57');
    expect(stops[0].label).toContain('%');
    expect(stops[2].label).toContain('0');
  });
});
