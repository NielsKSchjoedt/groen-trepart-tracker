import { describe, it, expect } from 'vitest';
import { computeNationalPace, paceRatiosOf, paceStatusOf } from './kommune-goal-pace';
import { paceIdx, paceIdxPhrase } from './kommune-ranking';
import type { DashboardData, KommuneRankingData } from './types';

function fakeData(): DashboardData {
  return {
    national: {
      targets: {
        deadline: '2030-12-31',
        forestDeadline: '2045-12-31',
        extractionHa: 140_000,
        afforestationHa: 250_000,
        nitrogenReductionT: 12_776,
      },
    },
  } as unknown as DashboardData;
}

function fakeRanking(national: {
  deliveryExtractionHa: number;
  deliverySkovHa: number;
  deliveryKvaelstofT: number;
}): KommuneRankingData {
  return { national } as unknown as KommuneRankingData;
}

describe('paceIdx', () => {
  it('scales a share of ansvar by 1 ÷ time elapsed', () => {
    // 20 % of its part delivered when 40 % of the time has passed → half the tempo.
    expect(paceIdx(0.2, 1 / 0.4)).toBeCloseTo(0.5, 5);
    expect(paceIdx(0.4, 1 / 0.4)).toBeCloseTo(1, 5);
  });
  it('returns null when peer index or ratio is missing', () => {
    expect(paceIdx(null, 0.5)).toBeNull();
    expect(paceIdx(2, null)).toBeNull();
  });
  it('keeps zero at zero (nothing built)', () => {
    expect(paceIdx(0, 0.5)).toBe(0);
  });
});

describe('paceStatusOf', () => {
  it('reads "på sporet" only at/above the on-pace band', () => {
    expect(paceStatusOf(1).word).toBe('På sporet');
    expect(paceStatusOf(1.3).word).toBe('Foran tempo');
  });
  it('a strong peer standing can still be behind the clock', () => {
    // A kommune at the top of the list with 20 % of its part at 40 % of the time.
    const idx = paceIdx(0.2, 1 / 0.4)!;
    expect(paceStatusOf(idx).word).toBe('Bagud');
    expect(paceStatusOf(0.3).word).toBe('Langt bagud');
  });
  it('handles null and not-yet-started', () => {
    expect(paceStatusOf(null).kind).toBe('none');
    expect(paceStatusOf(0).word).toBe('Intet endnu');
  });
});

describe('paceIdxPhrase', () => {
  it('uses tempo wording, not peer wording', () => {
    expect(paceIdxPhrase(1.8)).toContain('nødvendigt tempo');
    expect(paceIdxPhrase(null)).toBe('Ingen andel af målet');
    expect(paceIdxPhrase(0)).toBe('Intet godkendt eller anlagt');
  });
});

describe('computeNationalPace', () => {
  it('measures national delivery in the selected phases against the goals', () => {
    const ctx = computeNationalPace(
      fakeData(),
      fakeRanking({ deliveryExtractionHa: 14_000, deliverySkovHa: 2_500, deliveryKvaelstofT: 1_277.6 }),
    );
    expect(ctx.lavbund!.progressPct).toBeCloseTo(10, 5);
    expect(ctx.skov!.progressPct).toBeCloseTo(1, 5);
    expect(ctx.kvaelstof!.progressPct).toBeCloseTo(10, 5);
    expect(ctx.kvaelstof!.paceRatio).toBeGreaterThan(0);
  });

  it('reports zero delivery as a zero ratio (not on pace)', () => {
    const ctx = computeNationalPace(
      fakeData(),
      fakeRanking({ deliveryExtractionHa: 0, deliverySkovHa: 0, deliveryKvaelstofT: 0 }),
    );
    expect(ctx.kvaelstof!.paceRatio).toBe(0);
    expect(ctx.kvaelstof!.status).toBe('behind');
  });
});

describe('paceRatiosOf', () => {
  it('is 1 ÷ time elapsed, so later deadlines get a larger multiplier', () => {
    const r = paceRatiosOf(fakeData());
    expect(r.idxLavbund).toBeGreaterThan(1);
    expect(r.idxSkov!).toBeGreaterThan(r.idxLavbund!);
  });
});
