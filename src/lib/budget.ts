import type { FinansieringKategori } from './types';

/** Sum total-bearing `kilder[].beloebMioKr` for a single financing category. */
export function sumKilderMioKr(kategori: FinansieringKategori): number {
  return kategori.kilder.reduce((s, k) => (
    k.includeInTotal === false ? s : s + (k.beloebMioKr || 0)
  ), 0);
}

/** Convert million kroner to billion kroner for display. */
export function mioKrToMiaKr(mioKr: number): number {
  return mioKr / 1000;
}
