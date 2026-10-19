import { formatDanishNumber } from '@/lib/format';

/** Ton/ha: 0 decimals above 1000, else 1 decimal. */
export function formatFremskrivningValue(value: number): string {
  return formatDanishNumber(value, value >= 1000 ? 0 : value < 10 ? 1 : 0);
}

/** Percent: 1 decimal under 10 %, else 0. */
export function formatFremskrivningPct(pct: number): string {
  return formatDanishNumber(pct, pct < 10 ? 1 : 0);
}

/** Years with one decimal (da-DK). */
export function formatFremskrivningYears(years: number): string {
  return formatDanishNumber(years, 1);
}
