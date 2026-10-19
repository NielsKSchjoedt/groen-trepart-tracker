import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mioKrToMiaKr, sumKapacitetBreakdownMioKr, sumKilderMioKr } from './budget';
import type { BudgetData, FinansieringKategori } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AFTALER = JSON.parse(
  readFileSync(join(__dirname, '../../data/finansiering/aftaler.json'), 'utf-8'),
) as BudgetData;

function cat(id: string): FinansieringKategori {
  const k = AFTALER.kategorier.find((c) => c.id === id);
  if (!k) throw new Error(`category ${id}`);
  return k;
}

describe('sumKilderMioKr (aftaler.json)', () => {
  it('lavbund total matches kurateret sum', () => {
    expect(sumKilderMioKr(cat('lavbund-udtagning'))).toBe(11_860);
  });
  it('natur total without Novo (tværgående)', () => {
    expect(sumKilderMioKr(cat('natur-sammenhaengende'))).toBe(1000);
  });
  it('skov total excludes sub-budgets already covered by umbrella line', () => {
    const skov = sumKilderMioKr(cat('skov'));
    expect(skov).toBe(20_000);
  });
  it('display converts mio. kr. to mia. kr.', () => {
    expect(mioKrToMiaKr(sumKilderMioKr(cat('lavbund-udtagning')))).toBe(11.86);
  });
});

describe('stroemme (aftaler.json)', () => {
  it('has three national streams', () => {
    expect(AFTALER.stroemme).toHaveLength(3);
    expect(AFTALER.stroemme.map((s) => s.id)).toEqual(['anlaeg', 'kapacitet', 'drift']);
  });

  it('kommunal kapacitet breakdown sums to 461,8 mio. kr.', () => {
    const kap = AFTALER.stroemme.find((s) => s.id === 'kapacitet')!;
    expect(sumKapacitetBreakdownMioKr(kap)).toBeCloseTo(461.8, 1);
  });

  it('drift stream is marked as not allocated', () => {
    const drift = AFTALER.stroemme.find((s) => s.id === 'drift')!;
    expect(drift.hero).toBe('Ikke afsat');
    expect(drift.tone).toBe('red');
  });
});
