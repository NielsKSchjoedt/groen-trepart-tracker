import type { NationalBasemapToken, NationalOverlayToken, NationalMapState } from '../types';
import { DEFAULT_NATIONAL_MAP, DEFAULT_NATIONAL_PHASES } from '../defaults';
import { phasesEqual, phasesFromSlugList, phasesToSlugList } from '../phase-slugs';
import { PERMALINK_KEYS } from '../schema';

const BASEMAP_TO_LEGACY: Record<NationalBasemapToken, string> = {
  kystvande: 'kyst',
  hovedvandoplande: 'opland',
  kommuner: 'kommuner',
  skjult: 'fra',
};

const LEGACY_TO_BASEMAP: Record<string, NationalBasemapToken> = {
  kyst: 'kystvande',
  opland: 'hovedvandoplande',
  kommuner: 'kommuner',
  fra: 'skjult',
};

const OVERLAY_TOKENS = new Set<string>([
  'section3', 'natura2000', 'markudledning', 'drikkevand', 'naturpotentialer',
  'biodiv', 'vns', 'ksf', 'nst', 'vandlegemer', 'kulstof',
]);

function parseBasemap(params: URLSearchParams): NationalBasemapToken | null {
  const kort = params.get(PERMALINK_KEYS.kort);
  if (kort && kort in LEGACY_TO_BASEMAP) {
    return LEGACY_TO_BASEMAP[kort as keyof typeof LEGACY_TO_BASEMAP] ?? null;
  }
  const lag = params.get(PERMALINK_KEYS.lag);
  if (lag && !lag.includes(',') && lag in LEGACY_TO_BASEMAP) {
    return LEGACY_TO_BASEMAP[lag];
  }
  return null;
}

export function parseMapOverlays(params: URLSearchParams): Set<NationalOverlayToken> {
  const out = new Set<NationalOverlayToken>();
  const overlag = params.get(PERMALINK_KEYS.overlag);
  if (overlag) {
    for (const token of overlag.split(',')) {
      const t = token.trim();
      if (OVERLAY_TOKENS.has(t)) out.add(t as NationalOverlayToken);
    }
  }
  // Legacy biodiv
  const bio = params.get(PERMALINK_KEYS.bio);
  if (bio && bio.trim()) out.add('biodiv');
  if (params.get(PERMALINK_KEYS.vns) === '1') out.add('vns');
  return out;
}

export function decodeNationalMap(params: URLSearchParams): NationalMapState {
  return {
    basemap: parseBasemap(params),
    overlays: parseMapOverlays(params),
    phases: phasesFromSlugList(params.get(PERMALINK_KEYS.faser), DEFAULT_NATIONAL_PHASES),
    fullscreen: params.get(PERMALINK_KEYS.fuldskaerm) === '1',
  };
}

export function applyNationalMapToParams(
  params: URLSearchParams,
  state: NationalMapState,
  defaults: NationalMapState = DEFAULT_NATIONAL_MAP,
): void {
  params.delete(PERMALINK_KEYS.kort);
  params.delete(PERMALINK_KEYS.lag);
  params.delete(PERMALINK_KEYS.overlag);
  params.delete(PERMALINK_KEYS.bio);
  params.delete(PERMALINK_KEYS.vns);
  params.delete(PERMALINK_KEYS.faser);
  params.delete(PERMALINK_KEYS.fuldskaerm);

  if (state.basemap && state.basemap !== defaults.basemap) {
    params.set(PERMALINK_KEYS.kort, state.basemap);
    // Also write legacy `lag` for backward-compatible shared links
    params.set(PERMALINK_KEYS.lag, BASEMAP_TO_LEGACY[state.basemap]);
  }

  if (state.overlays.size > 0) {
    params.set(PERMALINK_KEYS.overlag, [...state.overlays].sort().join(','));
  }

  if (!phasesEqual(state.phases, defaults.phases)) {
    params.set(PERMALINK_KEYS.faser, phasesToSlugList(state.phases));
  }

  if (state.fullscreen) {
    params.set(PERMALINK_KEYS.fuldskaerm, '1');
  }
}

/** Write only `overlag=` (+ legacy bio/vns) — shared by national and kommune maps. */
export function applyMapOverlaysToParams(
  params: URLSearchParams,
  overlays: Set<NationalOverlayToken>,
  defaults: Set<NationalOverlayToken> = new Set(),
): void {
  params.delete(PERMALINK_KEYS.overlag);
  params.delete(PERMALINK_KEYS.bio);
  params.delete(PERMALINK_KEYS.vns);

  if (!overlaysEqualSets(overlays, defaults) && overlays.size > 0) {
    params.set(PERMALINK_KEYS.overlag, [...overlays].sort().join(','));
  }
}

function overlaysEqualSets(a: Set<NationalOverlayToken>, b: Set<NationalOverlayToken>): boolean {
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}

export { LEGACY_TO_BASEMAP, BASEMAP_TO_LEGACY };
