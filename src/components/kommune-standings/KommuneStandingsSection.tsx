import type { KommuneRankingData, KlimaregnskabData, KommuneBenchmarkData } from '@/lib/types';
import type { KommunePhase } from '@/lib/kommune-metrics';
import type { MetricPaceRatios } from '@/lib/kommune-ranking';
import type { NationalPaceContext } from '@/lib/kommune-goal-pace';
import type { StandingsState } from './useStandings';
import { KommuneStandingsControls } from './KommuneStandingsControls';
import { KommuneMiniBoards } from './KommuneMiniBoards';
import { GoalPaceBanner } from './GoalPaceBanner';

interface KommuneStandingsSectionProps {
  ranking: KommuneRankingData;
  standings: StandingsState;
  klimaregnskab: KlimaregnskabData | null;
  benchmark: KommuneBenchmarkData | null;
  selectedPhases: Set<KommunePhase>;
  onPhasesChange: (phases: Set<KommunePhase>) => void;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
  /** Per-metric pace scalars for the "Mod målet" lens. */
  paceRatios?: MetricPaceRatios;
  /** National goal-pace context — drives the banner shown in "Mod målet". */
  nationalPace?: NationalPaceContext | null;
}

/**
 * Ranglister-chapter content. One cohesive unit: a single control bar (region +
 * måleenhed + fasefilter), then the five branded podium boards — each flippable
 * to see how that list's numbers work. The long master table lives in its own
 * chapter after the map and shares state through `useStandings`.
 */
export function KommuneStandingsSection({
  ranking,
  standings,
  klimaregnskab,
  benchmark,
  selectedPhases,
  onPhasesChange,
  selectedKode,
  onSelect,
  paceRatios,
  nationalPace,
}: KommuneStandingsSectionProps) {
  return (
    <div className="space-y-3">
      <KommuneStandingsControls
        region={standings.region}
        onRegionChange={standings.setRegion}
        mode={standings.mode}
        onModeChange={standings.setMode}
        selectedPhases={selectedPhases}
        onPhasesChange={onPhasesChange}
      />
      {standings.mode === 'maal' && nationalPace && <GoalPaceBanner pace={nationalPace} />}
      <KommuneMiniBoards
        ctx={{ ranking, klimaregnskab, benchmark, globalMode: standings.mode, paceRatios }}
        region={standings.region}
        selectedKode={selectedKode}
        onSelect={onSelect}
        onSortAxis={(key) => standings.toggleSort(key)}
        activeSortKey={standings.sortKey}
        disclaimer={ranking.metadata.disclaimer}
      />
    </div>
  );
}
