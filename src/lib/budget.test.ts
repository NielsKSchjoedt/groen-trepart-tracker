import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mioKrToMiaKr, sumKilderMioKr } from './budget';
import type { FinansieringKategori } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AFTALER = JSON.parse(
  readFileSync(join(__dirname, '../../data/finansiering/aftaler.json'), 'utf-8'),
) as { kategorier: FinansieringKategori[] };

function cat(id: string): FinansieringKategori {
  const k = AFTALER.kategorier.find((c) => c.id === id);
  if (!k) throw new Error(`category ${id}`);
  return k;
}

describe('sumKilderMioKr (aftaler.json)', () => {
  it('lavbund total matches kurateret sum', () => {
    expect(sumKilderMioKr(cat('lavbund-udtagning'))).toBe(11_860);
  });
  it('natur total', () => {
    expect(sumKilderMioKr(cat('natur-sammenhaengende'))).toBe(8500);
  });
  it('skov total excludes sub-budgets already covered by umbrella line', () => {
    const skov = sumKilderMioKr(cat('skov'));
    expect(skov).toBe(20_000);
  });
  it('display converts mio. kr. to mia. kr.', () => {
    expect(mioKrToMiaKr(sumKilderMioKr(cat('lavbund-udtagning')))).toBe(11.86);
  });
});
