import type { KommuneMetrics } from '@/lib/types';
import type {
  KommuneRankingData,
  KommuneRankingMetricKey,
  KommuneRankingRow,
} from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';

/** Competition lens — three Trepart indsatsmål (lavbund, skov, kvælstof). */
export type StandingsLensKey = 'idxLavbund' | 'idxSkov' | 'idxKvaelstof';

export type StandingsMode = 'relativ' | 'maal' | 'absolut';

/**
 * Per-metric scalar that turns a share-of-ansvar into a "Mod målet" index
 * (1 ÷ time elapsed fraction). Null when the deadline is unknown.
 * See `paceRatiosOf` in kommune-goal-pace.ts.
 */
export interface MetricPaceRatios {
  idxLavbund: number | null;
  idxSkov: number | null;
  idxKvaelstof: number | null;
}

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
    sub: 'Andel af kommunens lavbundsansvar',
  },
  {
    key: 'idxSkov',
    label: 'Skov',
    full: 'Skovrejsning',
    tone: '#15803d',
    kind: 'idx',
    sub: 'Andel af kommunens skovansvar',
  },
  {
    key: 'idxKvaelstof',
    label: 'Kvælstof',
    full: 'Kvælstofreduktion',
    tone: '#0d9488',
    kind: 'idx',
    sub: 'Andel af kommunens kvælstofansvar',
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
  /** Compact cell text (e.g. "34 %", "90.038 ha"). */
  txt: string;
  /** Full plain-language phrase (e.g. "34 % af kommunens andel"). */
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

/**
 * Kommuner whose part of a goal is below this share of the national goal (%)
 * are listed but not ranked: with ~0 ansvar a handful of hectares turns into an
 * extreme percentage (e.g. 16 ha of forest in a suburb). 0,1 % ≈ 140 ha lavbund,
 * 250 ha skov or 13 t kvælstof.
 */
export const MIN_ANSVAR_PCT = 0.1;

/** The kommune's share (%) of the national goal behind an axis. */
export function ansvarPctForAxis(row: KommuneRankingRow, key: StandingsLensKey): number {
  if (key === 'idxLavbund') return row.ansvarLavbundPct;
  if (key === 'idxSkov') return row.ansvarSkovPct;
  return row.ansvarKvaelstofPct;
}

/** The kommune's part of the national goal behind an axis, in ha or t. */
export function ansvarUnitsForAxis(row: KommuneRankingRow, key: StandingsLensKey): number {
  if (key === 'idxLavbund') return row.ansvarLavbundHa;
  if (key === 'idxSkov') return row.ansvarSkovHa;
  return row.ansvarKvaelstofT;
}

/** True when the kommune carries enough of the goal to be ranked on it. */
export function isRankable(row: KommuneRankingRow, key: StandingsLensKey): boolean {
  return row[key] != null && ansvarPctForAxis(row, key) >= MIN_ANSVAR_PCT;
}

/** Why a kommune is listed without a rank on an axis. */
export function notRankablePhrase(row: KommuneRankingRow, key: StandingsLensKey): string {
  if (ansvarPctForAxis(row, key) > 0) return 'For lille andel af målet til at rangere';
  if (key === 'idxKvaelstof') return 'Intet kvælstofkrav i kommunens oplande';
  if (key === 'idxLavbund') return 'Ingen dyrket lavbundsjord';
  return 'Intet landbrugsareal';
}

/** "34 %", "0,4 %" — share of the kommune's own part of the goal. */
function fmtSharePct(share: number): string {
  const pct = share * 100;
  if (pct > 0 && pct < 1) return `${formatDanishNumber(pct, 1)} %`;
  return `${formatDanishNumber(Math.round(pct), 0)} %`;
}

/** Format a goal-pace multiplier: one decimal below 10 (0,4×), whole above. */
function fmtTimes(value: number): string {
  const r = Math.round(value * 10) / 10;
  return Number.isInteger(r) ? formatDanishNumber(r, 0) : formatDanishNumber(r, 1);
}

/**
 * Full phrase for a share of the kommune's own part of the goal.
 * @example idxPhrase(0.34) // "34 % af kommunens andel"
 * @example idxPhrase(0) // "Intet godkendt eller anlagt"
 */
export function idxPhrase(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'Ingen andel af målet';
  if (value <= 0) return 'Intet godkendt eller anlagt';
  return `${fmtSharePct(value)} af kommunens andel`;
}

/** Compact form for dense tables (e.g. "34 %", "0 %"). */
export function idxCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value <= 0) return '0 %';
  return fmtSharePct(value);
}

/** Turn a share of ansvar into a goal-pace index (share ÷ time elapsed). */
export function paceIdx(
  share: number | null | undefined,
  ratio: number | null | undefined,
): number | null {
  if (share == null || Number.isNaN(share)) return null;
  if (ratio == null || Number.isNaN(ratio)) return null;
  if (share <= 0) return 0;
  return Math.round(share * ratio * 10_000) / 10_000;
}

/**
 * Full phrase for a goal-pace index (1,0× = on the trajectory needed).
 * @example paceIdxPhrase(1.8) // "1,8× nødvendigt tempo"
 */
export function paceIdxPhrase(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return 'Ingen andel af målet';
  if (value <= 0) return 'Intet godkendt eller anlagt';
  return `${fmtTimes(value)}× nødvendigt tempo`;
}

/** Compact goal-pace form for dense tables (e.g. "1,8× tempo"). */
export function paceCompact(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (value <= 0) return '0×';
  return `${fmtTimes(value)}× tempo`;
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
  paceRatios?: MetricPaceRatios,
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
  if (!isRankable(row, idxKey)) {
    return { sort: -1, txt: '—', phrase: notRankablePhrase(row, idxKey) };
  }
  const v = row[idxKey]!;
  // Goal-pace lens: share ÷ time elapsed. Same order as the share (constant
  // per-metric multiplier), so without ratios we fall back to the share.
  if (mode === 'maal' && paceRatios) {
    const pv = paceIdx(v, paceRatios[idxKey]);
    if (pv == null) return { sort: -1, txt: '—', phrase: 'Ingen frist' };
    return { sort: pv, txt: paceCompact(pv), phrase: paceIdxPhrase(pv), idx: pv };
  }
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
  paceRatios?: MetricPaceRatios,
): number {
  const c = standingsCell(row, key, mode, paceRatios);
  if (c.sort < 0 || maxInSet <= 0) return 0;
  if (mode === 'absolut') return Math.min((c.sort / maxInSet) * 100, 100);
  // Share of ansvar: the track is the kommune's whole part of the goal.
  if (mode === 'relativ') return Math.min(c.sort * 100, 100);
  // Goal pace shares a fixed 2,5× track so 1,0× always sits at 40%.
  return Math.min((c.sort / 2.5) * 100, 100);
}
