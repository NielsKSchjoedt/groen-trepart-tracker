import type { NationalOverlayToken } from './types';
import type { NatureLayerKey } from '@/lib/kommune-map-visualization';
import { PILLAR_SLUGS } from '@/lib/slugs';
import { PERMALINK_KEYS } from './schema';

export interface VisPaaKortHrefOpts {
  /** Relative path, e.g. `/natur` or `/kommuner/viborg`. */
  path: string;
  /** Chapter hash without `#`, e.g. `geografi` or `kort`. */
  hash: string;
  overlays?: readonly NationalOverlayToken[];
  fullscreen?: boolean;
  /** Kommune map nature choropleth (`natur=`). */
  natureLayer?: NatureLayerKey;
  /** Kommune map metric (`metric=`). */
  metric?: keyof typeof PILLAR_SLUGS;
}

const NATURE_LAYER_SLUG: Record<NatureLayerKey, string | null> = {
  'b4-beskyttet': null,
  'b1-potentiale': 'dce',
  'b2-marker': 'b2',
  'b3-landbrug': 'b3',
};

/**
 * Build a relative permalink that opens a map with a predetermined layer combo.
 * Query comes before hash (browser-standard). Overlay tokens are sorted so
 * links stay stable.
 */
export function buildVisPaaKortHref(opts: VisPaaKortHrefOpts): string {
  const params = new URLSearchParams();
  if (opts.metric) params.set('metric', PILLAR_SLUGS[opts.metric]);
  const layerSlug = opts.natureLayer ? NATURE_LAYER_SLUG[opts.natureLayer] : null;
  if (layerSlug) params.set('natur', layerSlug);
  if (opts.overlays && opts.overlays.length > 0) {
    params.set(PERMALINK_KEYS.overlag, [...opts.overlays].sort().join(','));
  }
  if (opts.fullscreen) params.set(PERMALINK_KEYS.fuldskaerm, '1');
  const query = params.toString().replace(/%2C/g, ',');
  const hash = opts.hash ? `#${opts.hash}` : '';
  return `${opts.path}${query ? `?${query}` : ''}${hash}`;
}

export const VIS_PAA_KORT_PRESETS = {
  nationalOverlap: {
    path: `/${PILLAR_SLUGS.nature}`,
    hash: 'geografi',
    overlays: ['biodiv', 'natura2000', 'section3'] as const satisfies readonly NationalOverlayToken[],
    fullscreen: true,
  },
  kommuneB1: {
    metric: 'nature' as const,
    natureLayer: 'b1-potentiale' as const,
    overlays: ['biodiv'] as const satisfies readonly NationalOverlayToken[],
    fullscreen: true,
    hash: 'kort',
  },
  kommuneB3: {
    metric: 'nature' as const,
    natureLayer: 'b3-landbrug' as const,
    overlays: ['natura2000'] as const satisfies readonly NationalOverlayToken[],
    fullscreen: true,
    hash: 'kort',
  },
  kommuneB4: {
    metric: 'nature' as const,
    natureLayer: 'b4-beskyttet' as const,
    overlays: ['biodiv', 'natura2000', 'section3'] as const satisfies readonly NationalOverlayToken[],
    fullscreen: true,
    hash: 'kort',
  },
} as const;

export function visPaaKortNationalOverlap(): string {
  return buildVisPaaKortHref(VIS_PAA_KORT_PRESETS.nationalOverlap);
}

export function visPaaKortKommuneB1(kommuneSlug: string): string {
  return buildVisPaaKortHref({
    path: `/kommuner/${kommuneSlug}`,
    ...VIS_PAA_KORT_PRESETS.kommuneB1,
  });
}

export function visPaaKortKommuneB3(kommuneSlug: string): string {
  return buildVisPaaKortHref({
    path: `/kommuner/${kommuneSlug}`,
    ...VIS_PAA_KORT_PRESETS.kommuneB3,
  });
}

export function visPaaKortKommuneB4(kommuneSlug: string): string {
  return buildVisPaaKortHref({
    path: `/kommuner/${kommuneSlug}`,
    ...VIS_PAA_KORT_PRESETS.kommuneB4,
  });
}
