import type { KommuneMetrics, KommuneRankingData, KommuneRankingRow } from '@/lib/types';
import type { StandingsLensKey } from '@/lib/kommune-ranking';

function safeRatio(num: number, denom: number): number | null {
  if (denom <= 0 || num <= 0) return null;
  return Math.round((num / denom) * 10_000) / 10_000;
}

function idx(leveringPct: number | null, ansvar: number): number | null {
  if (leveringPct == null || ansvar <= 0) return null;
  return Math.round((leveringPct / ansvar) * 10_000) / 10_000;
}

/** MARS skov (phase-filtered) + KSF + NST — matches ranking ETL. */
function skovDeliveryHa(km: KommuneMetrics, marsHa: number): number {
  return marsHa + (km.afforestationKsfHa ?? 0) + (km.afforestationNstHa ?? 0);
}

/**
 * Recompute delivery shares and indices from phase-filtered kommune metrics.
 * Ansvar (DCE 30 %) stays from the precomputed ranking JSON.
 */
export function buildDynamicRanking(
  base: KommuneRankingData,
  kommuner: KommuneMetrics[],
): KommuneRankingData {
  const kmByKode = new Map(kommuner.map((k) => [k.kode, k]));

  let natExt = 0;
  let natSkov = 0;
  let natN = 0;
  for (const km of kommuner) {
    natExt += km.extractionHa;
    natSkov += skovDeliveryHa(km, km.afforestationMarsHa ?? 0);
    natN += km.nitrogenT;
  }

  const rows: KommuneRankingRow[] = base.kommuner.map((row) => {
    const km = kmByKode.get(row.kode);
    const ext = km?.extractionHa ?? 0;
    const skov = km ? skovDeliveryHa(km, km.afforestationMarsHa ?? 0) : 0;
    const nT = km?.nitrogenT ?? 0;
    const ansvar = row.ansvarPct;

    const levExtPct = safeRatio(ext, natExt);
    const levSkovPct = safeRatio(skov, natSkov);
    const levNPct = safeRatio(nT, natN);

    const levExtPct100 = levExtPct != null ? Math.round(levExtPct * 100 * 10_000) / 10_000 : null;
    const levSkovPct100 = levSkovPct != null ? Math.round(levSkovPct * 100 * 10_000) / 10_000 : null;
    const levNPct100 = levNPct != null ? Math.round(levNPct * 100 * 10_000) / 10_000 : null;

    return {
      ...row,
      deliveryExtractionHa: Math.round(ext * 100) / 100,
      deliverySkovHa: Math.round(skov * 100) / 100,
      deliveryKvaelstofT: Math.round(nT * 100) / 100,
      leveretHa: Math.round((ext + skov) * 100) / 100,
      leveringUdtagningPct: levExtPct100,
      leveringSkovPct: levSkovPct100,
      leveringKvaelstofPct: levNPct100,
      idxLavbund: idx(levExtPct100, ansvar),
      idxSkov: idx(levSkovPct100, ansvar),
      idxKvaelstof: idx(levNPct100, ansvar),
    };
  });

  const rankKeys: [StandingsLensKey | 'leveretHa', boolean][] = [
    ['idxLavbund', true],
    ['idxSkov', true],
    ['idxKvaelstof', true],
    ['leveretHa', true],
  ];

  for (const [key, higher] of rankKeys) {
    const ordered = [...rows].sort((a, b) => {
      const av = a[key as keyof KommuneRankingRow];
      const bv = b[key as keyof KommuneRankingRow];
      const aNum = av == null ? (higher ? -Infinity : Infinity) : Number(av);
      const bNum = bv == null ? (higher ? -Infinity : Infinity) : Number(bv);
      return higher ? bNum - aNum : aNum - bNum;
    });
    ordered.forEach((row, i) => {
      if (!row.rankByMetric) row.rankByMetric = {};
      row.rankByMetric[key] = i + 1;
    });
  }

  return {
    ...base,
    kommuner: rows,
    byKommune: Object.fromEntries(rows.map((r) => [r.kode, r])),
    national: {
      ...base.national,
      deliveryExtractionHa: Math.round(natExt * 100) / 100,
      deliverySkovHa: Math.round(natSkov * 100) / 100,
      deliveryKvaelstofT: Math.round(natN * 100) / 100,
      leveretHa: Math.round((natExt + natSkov) * 100) / 100,
    },
  };
}
