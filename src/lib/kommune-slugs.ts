/**
 * URL slug utilities for Danish municipality names.
 *
 * Danish characters are mapped to ASCII equivalents so that municipality
 * names produce clean, readable URL paths without percent-encoding:
 *   "København"  → "koebenhavn"
 *   "Aarhus"     → "aarhus"
 *   "Ærø"        → "aeroe"
 *
 * Note: The transforms are one-way: two different names could theoretically
 * produce the same slug, but no Danish municipality names are affected in
 * practice. We verify via slugToKommuneKode which matches the slug against
 * the full KommuneMetrics list.
 */

const CHAR_MAP: Record<string, string> = {
  æ: 'ae', ø: 'oe', å: 'aa',
  Æ: 'ae', Ø: 'oe', Å: 'aa',
};

/**
 * Convert a Danish municipality name to a URL-safe slug.
 *
 * @param navn - Municipality name (e.g. "København", "Ringe")
 * @returns URL-safe slug (e.g. "koebenhavn", "ringe")
 *
 * @example kommuneToSlug("København")  // → "koebenhavn"
 * @example kommuneToSlug("Ikast-Brande")  // → "ikast-brande"
 * @example kommuneToSlug("Ærø")  // → "aeroe"
 */
export function kommuneToSlug(navn: string): string {
  return navn
    .split('')
    .map((c) => CHAR_MAP[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/**
 * Find the 4-digit municipality kode matching a URL slug.
 *
 * @param slug - URL slug (e.g. "koebenhavn")
 * @param kommuner - Array of KommuneMetrics from dashboard data
 * @returns 4-digit kode string (e.g. "0101") or undefined if not found
 *
 * @example slugToKommuneKode("koebenhavn", byKommune)  // → "0101"
 */
export function slugToKommuneKode(
  slug: string,
  kommuner: Array<{ kode: string; navn: string }>,
): string | undefined {
  return kommuner.find((k) => kommuneToSlug(k.navn) === slug)?.kode;
}

/**
 * Find the KommuneMetrics entry by URL slug.
 *
 * @param slug - URL slug (e.g. "odense")
 * @param kommuner - Array of KommuneMetrics from dashboard data
 * @returns Matching KommuneMetrics or undefined
 *
 * @example findKommuneBySlug("odense", byKommune)  // → { kode: "0461", navn: "Odense", ... }
 */
export function findKommuneBySlug<T extends { kode: string; navn: string }>(
  slug: string,
  kommuner: T[],
): T | undefined {
  return kommuner.find((k) => kommuneToSlug(k.navn) === slug);
}
