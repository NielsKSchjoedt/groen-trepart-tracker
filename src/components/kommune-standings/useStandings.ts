import { useMemo, useState } from 'react';
import type { KommuneRankingData } from '@/lib/types';
import {
  buildStandingsTable,
  type StandingsLensKey,
  type StandingsMode,
  type StandingsRow,
} from '@/lib/kommune-ranking';

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
 * Shared standings state so the mini-board ranglister and the master table can
 * live in separate page chapters (rankings → map → long table) yet stay in sync
 * on region, mode and sort.
 */
export function useStandings(ranking: KommuneRankingData | null): StandingsState {
  const [region, setRegion] = useState('Alle regioner');
  const [mode, setMode] = useState<StandingsMode>('relativ');
  const [sortKey, setSortKey] = useState<StandingsLensKey | 'leveretHa'>('idxLavbund');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

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

  const toggleSort = (key: StandingsLensKey | 'leveretHa') => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return { region, setRegion, mode, setMode, sortKey, sortDir, toggleSort, boardRows, tableRows };
}
