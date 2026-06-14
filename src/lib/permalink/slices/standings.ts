import type { StandingsLensKey, StandingsMode } from '@/lib/kommune-ranking';
import type { StandingsUrlState } from '../types';
import { DEFAULT_STANDINGS } from '../defaults';
import { PERMALINK_KEYS } from '../schema';

const SORT_TO_KEY: Record<string, StandingsLensKey> = {
  lavbund: 'idxLavbund',
  skov: 'idxSkov',
  kvaelstof: 'idxKvaelstof',
};

const KEY_TO_SORT: Record<StandingsLensKey, string> = {
  idxLavbund: 'lavbund',
  idxSkov: 'skov',
  idxKvaelstof: 'kvaelstof',
};

const MODE_TO_VISNING: Record<StandingsMode, string | null> = {
  relativ: null,
  absolut: 'absolut',
};

const VISNING_TO_MODE: Record<string, StandingsMode> = {
  ansvar: 'relativ',
  absolut: 'absolut',
};

export function decodeStandings(params: URLSearchParams): StandingsUrlState {
  const sortRaw = params.get(PERMALINK_KEYS.sort);
  const sort = (sortRaw && SORT_TO_KEY[sortRaw]) || DEFAULT_STANDINGS.sort;

  const visning = params.get(PERMALINK_KEYS.visning);
  const mode = (visning && VISNING_TO_MODE[visning]) || DEFAULT_STANDINGS.mode;

  const regionRaw = params.get(PERMALINK_KEYS.region);
  let region = DEFAULT_STANDINGS.region;
  if (regionRaw === 'alle') {
    region = 'Alle regioner';
  } else if (regionRaw) {
    region = decodeURIComponent(regionRaw);
  }

  return { sort, mode, region };
}

export function applyStandingsToParams(
  params: URLSearchParams,
  state: StandingsUrlState,
  defaults: StandingsUrlState = DEFAULT_STANDINGS,
): void {
  params.delete(PERMALINK_KEYS.sort);
  params.delete(PERMALINK_KEYS.visning);
  params.delete(PERMALINK_KEYS.region);

  if (state.sort !== defaults.sort) {
    params.set(PERMALINK_KEYS.sort, KEY_TO_SORT[state.sort]);
  }

  const visSlug = state.mode === 'relativ' ? 'ansvar' : 'absolut';
  if (state.mode !== defaults.mode) {
    params.set(PERMALINK_KEYS.visning, visSlug);
  }

  if (state.region !== defaults.region) {
    params.set(
      PERMALINK_KEYS.region,
      state.region === 'Alle regioner' ? 'alle' : encodeURIComponent(state.region),
    );
  }
}

export { KEY_TO_SORT, SORT_TO_KEY };
