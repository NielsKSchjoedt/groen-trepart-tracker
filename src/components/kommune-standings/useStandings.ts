import { useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { KommuneRankingData } from '@/lib/types';
import {
  buildStandingsTable,
  type StandingsLensKey,
  type StandingsMode,
  type StandingsRow,
} from '@/lib/kommune-ranking';
import { decodeStandings } from '@/lib/permalink/slices/standings';
import { applyStandingsToParams } from '@/lib/permalink/slices/standings';

export interface StandingsState {
  region: string;
  setRegion: (r: string) => void;
  mode: StandingsMode;
  setMode: (m: StandingsMode) => void;
  sortKey: StandingsLensKey | 'leveretHa';
  sortDir: 'asc' | 'desc';
  toggleSort: (key: StandingsLensKey | 'leveretHa') => void;
  /** Region-filtered rows for the mini-boards (pos = global rank on sortKey). */
  boardRows: StandingsRow[];
  /** Region-filtered + sorted rows for the master table. */
  tableRows: StandingsRow[];
}

/**
 * Shared standings state synced to URL (`sort`, `visning`, `region`).
 */
export function useStandings(ranking: KommuneRankingData | null): StandingsState {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlStandings = useMemo(() => decodeStandings(searchParams), [searchParams]);

  const { region, mode, sort: sortKey } = urlStandings;
  const sortDir: 'asc' | 'desc' = 'desc';

  const patchStandings = useCallback(
    (partial: Partial<{ region: string; mode: StandingsMode; sort: StandingsLensKey }>) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const current = decodeStandings(next);
        applyStandingsToParams(next, { ...current, ...partial });
        return next;
      }, { replace: true });
    },
    [setSearchParams],
  );

  const setRegion = useCallback(
    (r: string) => patchStandings({ region: r }),
    [patchStandings],
  );

  const setMode = useCallback(
    (m: StandingsMode) => patchStandings({ mode: m }),
    [patchStandings],
  );

  const toggleSort = useCallback(
    (key: StandingsLensKey | 'leveretHa') => {
      if (key === 'leveretHa') return;
      patchStandings({ sort: key });
    },
    [patchStandings],
  );

  const tableRows = useMemo(
    () =>
      ranking
        ? buildStandingsTable(ranking, { query: '', region, mode, sortKey, sortDir })
        : [],
    [ranking, region, mode, sortKey, sortDir],
  );

  const boardRows = useMemo(
    () =>
      ranking
        ? ranking.kommuner
            .filter((k) => region === 'Alle regioner' || k.region === region)
            .map((k) => ({ ...k, pos: k.rankByMetric?.[sortKey] ?? 0 }))
        : [],
    [ranking, region, sortKey],
  );

  return { region, setRegion, mode, setMode, sortKey, sortDir, toggleSort, boardRows, tableRows };
}
