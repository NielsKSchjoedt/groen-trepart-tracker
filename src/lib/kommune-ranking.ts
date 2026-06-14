import type { KommuneMetrics } from '@/lib/types';
import type {
  KommuneRankingData,
  KommuneRankingMetricKey,
  KommuneRankingRow,
} from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';

/** Competition lens — three Trepart indsatsmål (lavbund, skov, kvælstof). */
export type StandingsLensKey = 'idxLavbund' | 'idxSkov' | 'idxKvaelstof';

export type StandingsMode = 'relativ' | 'absolut';

export interface StandingsLens {
  key: StandingsLensKey;
  label: string;
  full: string;
  tone: string;
  kind: 'idx' | 'behov';
  sub: string;
}

export const STANDINGS_LENSES: StandingsLens[] = [
  {
    key: 'idxLavbund',
    label: 'Lavbund',
    full: 'Lavbundsudtagning',
    tone: '#a16207',
    kind: 'idx',
    sub: 'Udtaget lavbund ift. potentiale',
  },
  {
    key: 'idxSkov',
    label: 'Skov',
    full: 'Skovrejsning',
    tone: '#15803d',
    kind: 'idx',
    sub: 'Ny skov ift. potentiale',
  },
  {
    key: 'idxKvaelstof',
    label: 'Kvælstof',
    full: 'Kvælstofreduktion',
    tone: '#0d9488',
    kind: 'idx',
    sub: 'Reduceret N ift. indsatsbehov',
  },
];

export const STANDINGS_REGIONS = [
  'Alle regioner',
  'Region Nordjylland',
  'Region Midtjylland',
  'Region Syddanmark',
  'Region Sjælland',
  'Region Hovedstaden',
] as const;

export interface StandingsRow extends KommuneRankingRow {
  /** Global rank on active sort axis (1 = best for that axis). */
  pos: number;
}

export interface StandingsCell {
  sort: number;
  /** Compact cell text (e.g. "7 gange", "90.038 ha"). */
  txt: string;
  /** Full plain-language phrase (e.g. "7 gange forventet"). */
  phrase: string;
  idx?: number;
  behov?: boolean;
}

/**
 * Merge dashboard kommune metrics with ranking row by kode.
 */
export function mergeStandingsRows(
  ranking: KommuneRankingData,
  kommuner: KommuneMetrics[],
): Map<string, { ranking: KommuneRankingRow; metrics?: KommuneMetrics }> {
  const metricsByKode = new Map(kommuner.map((k) => [k.kode, k]));
  const out = new Map<string, { ranking: KommuneRankingRow; metrics?: KommuneMetrics }>();
  for (const row of ranking.kommuner) {
    out.set(row.kode, { ranking: row, metrics: metricsByKode.get(row.kode) });
  }
  return out;
}

/** Format index multiplier for display (e.g. 1,9×). Kept for internal use. */
export function fmtIdx(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${formatDanishNumber(Math.round(value * 10) / 10)}×`;
}

/** Format a "gange"-multiplier: integers plain (7), fractions with one decimal (1,9). */
function fmtTimes(value: number): string {
  const r = Math.round(value * 10) / 10;
  return Number.isInteger(r) ? formatDanishNumber(r, 0) : formatDanishNumber(r, 1);
}

/**
 * Full plain-language phrase for an index value — replaces the opaque "×".
 * The index = kommunens andel af national levering ÷ andel af naturpotentiale.
 * @example idxPhrase(7) // "7 gange forventet"
 * @example idxPhrase(1) // "Som forventet"
 */
export function idxPhrase(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'Ingen data';
  if (value <= 0) return 'Intet anlagt endnu';
  if (value >= 0.85 && value < 1.15) return 'Som forventet';
  return `${fmtTimes(value)} gange forventet`;
}

/** Compact plain-language form for dense tables (e.g. "7 gange", "som forventet"). */
export function idxCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value <= 0) return 'intet';
  if (value >= 0.85 && value < 1.15) return 'som forv.';
  return `${fmtTimes(value)} gange`;
}

/** Hectares attributed to an index axis when showing absolut mode. */
export function haForAxis(row: KommuneRankingRow, key: StandingsLensKey): number {
  if (key === 'idxLavbund') return row.deliveryExtractionHa;
  if (key === 'idxSkov') return row.deliverySkovHa;
  if (key === 'idxKvaelstof') return row.deliveryKvaelstofT;
  return 0;
}

/**
 * Cell value + display text for a standings row.
 */
export function standingsCell(
  row: KommuneRankingRow,
  key: StandingsLensKey | 'leveretHa',
  mode: StandingsMode,
): StandingsCell {
  if (mode === 'absolut' && key !== 'leveretHa') {
    const ha = haForAxis(row, key as StandingsLensKey);
    const t = `${formatDanishNumber(Math.round(ha))} ha`;
    return { sort: ha, txt: t, phrase: t };
  }
  if (key === 'leveretHa') {
    const t = `${formatDanishNumber(Math.round(row.leveretHa))} ha`;
    return { sort: row.leveretHa, txt: t, phrase: t };
  }
  const idxKey = key as StandingsLensKey;
  const v = row[idxKey];
  if (v == null) return { sort: -1, txt: '—', phrase: 'Ingen data' };
  return { sort: v, txt: idxCompact(v), phrase: idxPhrase(v), idx: v };
}

/**
 * Filter and sort standings rows; attach global position on sort axis.
 */
export function buildStandingsTable(
  ranking: KommuneRankingData,
  options: {
    query: string;
    region: string;
    mode: StandingsMode;
    sortKey: StandingsLensKey | 'leveretHa';
    sortDir: 'asc' | 'desc';
  },
): StandingsRow[] {
  const q = options.query.trim().toLowerCase();
  const filtered = ranking.kommuner.filter(
    (k) =>
      (options.region === 'Alle regioner' || k.region === options.region) &&
      (!q || k.kommuneNavn.toLowerCase().includes(q)),
  );

  const allRanked = [...ranking.kommuner].sort((a, b) => {
    const av = standingsCell(a, options.sortKey, options.mode).sort;
    const bv = standingsCell(b, options.sortKey, options.mode).sort;
    return bv - av;
  });
  const posOf = Object.fromEntries(allRanked.map((k, i) => [k.kode, i + 1]));

  const sorted = [...filtered].sort((a, b) => {
    const av = standingsCell(a, options.sortKey, options.mode).sort;
    const bv = standingsCell(b, options.sortKey, options.mode).sort;
    return options.sortDir === 'desc' ? bv - av : av - bv;
  });

  return sorted.map((k) => ({ ...k, pos: posOf[k.kode] ?? 0 }));
}

/** Rank position for one kommune on a lens (1-based). */
export function rankOnAxis(
  ranking: KommuneRankingData,
  kode: string,
  key: KommuneRankingMetricKey,
): number | null {
  return ranking.byKommune[kode]?.rankByMetric?.[key] ?? null;
}

/** Bar width percent for heatmap (0–100). */
export function standingsBarPct(
  row: KommuneRankingRow,
  key: StandingsLensKey,
  mode: StandingsMode,
  maxInSet: number,
): number {
  const c = standingsCell(row, key, mode);
  if (c.sort < 0 || maxInSet <= 0) return 0;
  if (mode === 'absolut') return Math.min((c.sort / maxInSet) * 100, 100);
  return Math.min((c.sort / 2.5) * 100, 100);
}
