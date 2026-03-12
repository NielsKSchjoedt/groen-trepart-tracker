import type { PillarId } from './pillars';

/**
 * Maps internal pillar IDs to Danish URL path slugs.
 * Using Danish words maximises SEO relevance for Danish-language queries.
 *
 * @example
 * PILLAR_SLUGS['nitrogen'] // => 'kvælstof'
 */
export const PILLAR_SLUGS: Record<PillarId, string> = {
  nitrogen:     'kvælstof',
  extraction:   'lavbund',
  afforestation:'skovrejsning',
  co2:          'co2',
  nature:       'natur',
};

/**
 * Reverse mapping: URL slug → pillar ID.
 * Keys are the lowercase Danish slugs from PILLAR_SLUGS.
 */
const SLUG_TO_PILLAR_MAP: Record<string, PillarId> = Object.fromEntries(
  (Object.entries(PILLAR_SLUGS) as [PillarId, string][]).map(([id, slug]) => [slug, id]),
);

/**
 * Convert a pillar ID to its Danish URL slug.
 *
 * @param id - A valid PillarId
 * @returns The Danish URL slug (e.g., 'kvælstof')
 * @example
 * pillarToSlug('nitrogen')     // => 'kvælstof'
 * pillarToSlug('afforestation') // => 'skovrejsning'
 */
export function pillarToSlug(id: PillarId): string {
  return PILLAR_SLUGS[id];
}

/**
 * Convert a URL path slug back to its pillar ID.
 * Returns null for unrecognised slugs so callers can redirect or default gracefully.
 *
 * @param slug - The URL path segment (case-insensitive)
 * @returns The matching PillarId, or null if unrecognised
 * @example
 * slugToPillar('kvælstof')  // => 'nitrogen'
 * slugToPillar('NATUR')     // => 'nature'
 * slugToPillar('unknown')   // => null
 */
export function slugToPillar(slug: string | undefined): PillarId | null {
  if (!slug) return null;
  return SLUG_TO_PILLAR_MAP[slug.toLowerCase()] ?? null;
}

/**
 * All valid pillar URL slugs.
 * Useful for route validation and generating sitemaps.
 *
 * @example
 * PILLAR_SLUG_LIST // => ['kvælstof', 'lavbund', 'skovrejsning', 'co2', 'natur']
 */
export const PILLAR_SLUG_LIST: string[] = Object.values(PILLAR_SLUGS);
