import type { FinansieringKategori } from './types';

/** Sum of `kilder[].beloebMioKr` for a single financing category. */
export function sumKilderMioKr(kategori: FinansieringKategori): number {
  return kategori.kilder.reduce((s, k) => s + (k.beloebMioKr || 0), 0);
}
