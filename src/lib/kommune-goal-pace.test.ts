import { describe, it, expect } from 'vitest';
import { computeNationalPace, paceRatiosOf, paceStatusOf } from './kommune-goal-pace';
import { paceIdx, paceIdxPhrase } from './kommune-ranking';
import type { DashboardData } from './types';

function fakeData(progress: {
  nitrogenProgressPct: number;
  extractionProgressPct: number;
  afforestationProgressPct: number;
}): DashboardData {
  return {
    national: {
      targets: { deadline: '2030-12-31', forestDeadline: '2045-12-31' },
      progress,
    },
  } as unknown as DashboardData;
}

describe('paceIdx', () => {
  it('scales a peer index by the national pace ratio', () => {
    expect(paceIdx(1, 0.5)).toBe(0.5);
    expect(paceIdx(6.4, 0.5)).toBeCloseTo(3.2, 5);
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
    // peer 1,0× ("som forventet" vs peers) × national pace 0,5 → behind
    const idx = paceIdx(1, 0.5)!;
    expect(paceStatusOf(idx).word).toBe('Bagud');
    expect(paceStatusOf(0.3).word).toBe('Langt bagud');
  });
  it('handles null and not-yet-started', () => {
    expect(paceStatusOf(null).kind).toBe('none');
    expect(paceStatusOf(0).word).toBe('Ikke begyndt');
  });
});

describe('paceIdxPhrase', () => {
  it('uses tempo wording, not peer wording', () => {
    expect(paceIdxPhrase(1.8)).toContain('nødvendigt tempo');
    expect(paceIdxPhrase(null)).toBe('Ingen data');
  });
});

describe('computeNationalPace', () => {
  it('derives a per-metric ratio from progress vs time elapsed', () => {
    const ctx = computeNationalPace(
      fakeData({ nitrogenProgressPct: 20, extractionProgressPct: 10, afforestationProgressPct: 5 }),
    );
    // Every metric has data and a positive ratio when progress > 0.
    expect(ctx.kvaelstof).not.toBeNull();
    expect(ctx.skov).not.toBeNull();
    expect(ctx.lavbund).not.toBeNull();
    expect(ctx.kvaelstof!.paceRatio).toBeGreaterThan(0);
    const ratios = paceRatiosOf(ctx);
    expect(ratios.idxKvaelstof).toBeGreaterThan(0);
    expect(ratios.idxSkov).toBeGreaterThan(0);
  });

  it('reports zero progress as a zero ratio (not on pace)', () => {
    const ctx = computeNationalPace(
      fakeData({ nitrogenProgressPct: 0, extractionProgressPct: 0, afforestationProgressPct: 0 }),
    );
    expect(ctx.kvaelstof!.paceRatio).toBe(0);
    expect(ctx.kvaelstof!.status).toBe('behind');
  });
});
