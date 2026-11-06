import { describe, expect, it } from 'vitest';
import {
  ansvarIndexColor,
  computeAnsvarIndices,
  getKommuneMapLegendStops,
} from '@/lib/kommune-map-visualization';
import type { KommuneRankingData } from '@/lib/types';

describe('computeAnsvarIndices', () => {
  it('divides mapped hectares by the kommune\'s own part of the goal', () => {
    const ranking = {
      byKommune: {
        '0101': { ansvarLavbundHa: 1000, ansvarSkovHa: 0 },
        '0147': { ansvarLavbundHa: 0, ansvarSkovHa: 0 },
      },
    } as unknown as KommuneRankingData;

    const kommuner = [
      { kode: '0101', extractionHa: 250, afforestationTotalHa: 0 },
      { kode: '0147', extractionHa: 500, afforestationTotalHa: 0 },
    ];

    const shares = computeAnsvarIndices(kommuner, 'extraction', ranking);
    expect(shares['0101']).toBeCloseTo(0.25, 5);
    // No part of the goal → no share (not "infinitely ahead").
    expect(shares['0147']).toBeNull();
  });
});

describe('ansvarIndexColor', () => {
  it('uses fixed share bands aligned with the legend', () => {
    expect(ansvarIndexColor(0, 'extraction')).toBe('hsl(0 0% 92%)');
    expect(ansvarIndexColor(0.05, 'extraction')).toBe('#fef3c7');
    expect(ansvarIndexColor(0.15, 'extraction')).toBe('#fcd34d');
    expect(ansvarIndexColor(0.3, 'extraction')).toBe('#a16207');
    expect(ansvarIndexColor(0.6, 'extraction')).toBe('#78350f');
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
