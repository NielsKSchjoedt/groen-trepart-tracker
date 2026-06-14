import type { BudgetData, FinansieringKategori, FinansieringSatser, FinansieringStroem } from './types';

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

export function getKategoriById(
  budget: BudgetData | undefined,
  id: string,
): FinansieringKategori | undefined {
  return budget?.kategorier.find((k) => k.id === id);
}

export function sumKapacitetBreakdownMioKr(stroem: FinansieringStroem): number {
  return (stroem.breakdown ?? []).reduce((s, b) => s + b.amount, 0);
}

const SATSER_LABELS: Record<string, string> = {
  permanentEkstensiveringLavbundOmdriftKrPerHa: 'Perm. ekstensivering, omdrift',
  permanentEkstensiveringLavbundGraesKrPerHa: 'Perm. ekstensivering, græs',
  midlertidigEkstensiveringKrPerHaPerAar: 'Midlertidig ekstensivering',
  skovrejsningKrPerHa: 'Skovrejsning',
  uroertTillaegKrPerHa: 'Tillæg, urørt skov',
};

/** Format `satser` object as display chips (label + kr./ha). */
export function formatSatserChips(satser: FinansieringSatser | undefined): { label: string; value: string }[] {
  if (!satser) return [];
  const chips: { label: string; value: string }[] = [];
  for (const [key, val] of Object.entries(satser)) {
    if (key === 'noter' || typeof val !== 'number') continue;
    const label = SATSER_LABELS[key] ?? key;
    chips.push({
      label,
      value: `${val.toLocaleString('da-DK')} kr./ha${key.includes('PerAar') ? '/år' : ''}`,
    });
  }
  return chips;
}

/** Sub-budget lines (includeInTotal === false) for delmål detail panel. */
export function getSubBudgetLines(kategori: FinansieringKategori): { label: string; amount: string }[] {
  return kategori.kilder
    .filter((k) => k.includeInTotal === false)
    .map((k) => ({
      label: k.kildeNavn,
      amount: `${k.beloebMioKr.toLocaleString('da-DK')} mio.`,
    }));
}

/** Ordning lines (total-bearing kilder) for delmål detail panel. */
export function getOrdningLines(kategori: FinansieringKategori): { label: string; amount: string }[] {
  return kategori.kilder
    .filter((k) => k.includeInTotal !== false)
    .map((k) => ({
      label: k.kildeNavn,
      amount: `${k.beloebMioKr.toLocaleString('da-DK')} mio.`,
    }));
}
