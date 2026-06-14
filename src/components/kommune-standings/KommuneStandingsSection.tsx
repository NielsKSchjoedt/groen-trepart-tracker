import { useState } from 'react';
import type { KommuneRankingData, KlimaregnskabData, KommuneBenchmarkData } from '@/lib/types';
import type { StandingsState } from './useStandings';
import { KommuneStandingsExplainer } from './KommuneStandingsExplainer';
import { KommuneStandingsControls } from './KommuneStandingsControls';
import { KommuneMiniBoards } from './KommuneMiniBoards';

interface KommuneStandingsSectionProps {
  ranking: KommuneRankingData;
  standings: StandingsState;
  klimaregnskab: KlimaregnskabData | null;
  benchmark: KommuneBenchmarkData | null;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
}

/**
 * Ranglister-chapter content. One cohesive unit: a single control bar (region +
 * måleenhed + folded "Sådan virker det"), then the five branded podium boards.
 * The long master table lives in its own chapter after the map and shares state
 * through `useStandings`.
 */
export function KommuneStandingsSection({
  ranking,
  standings,
  klimaregnskab,
  benchmark,
  selectedKode,
  onSelect,
}: KommuneStandingsSectionProps) {
  const [infoOpen, setInfoOpen] = useState(false);

  return (
    <div className="space-y-3">
      <KommuneStandingsControls
        region={standings.region}
        onRegionChange={standings.setRegion}
        mode={standings.mode}
        onModeChange={standings.setMode}
        infoOpen={infoOpen}
        onToggleInfo={() => setInfoOpen((v) => !v)}
      />
      <KommuneStandingsExplainer open={infoOpen} disclaimer={ranking.metadata.disclaimer} />
      <KommuneMiniBoards
        ctx={{ ranking, klimaregnskab, benchmark, globalMode: standings.mode }}
        region={standings.region}
        selectedKode={selectedKode}
        onSelect={onSelect}
        onSortAxis={(key) => standings.toggleSort(key)}
        activeSortKey={standings.sortKey}
      />
    </div>
  );
}
