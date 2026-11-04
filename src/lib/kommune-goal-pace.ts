/**
 * Goal-pace lens ("Mod målet") for the three Grøn Trepart effort metrics.
 *
 * Each kommune's index is the share of its OWN part of the national goal that is
 * delivered in the selected phases (see `buildDynamicRanking`). The goal-pace
 * index compares that share with the share of the time to the deadline that has
 * passed:
 *
 *   paceIndex_i = shareOfAnsvar_i ÷ time elapsed fraction
 *
 * so the per-metric scalar is simply 1 ÷ time elapsed. 1,0× = exactly on the
 * trajectory its share of the goal needs; below 1,0× = behind the clock.
 *
 * The national banner uses the same phases as the ranking, so the kommune tempi
 * and the national tempo are always computed on one basis.
 */
import {
  assessGoalStatus,
  timeElapsedFraction,
  type GoalStatus,
} from './projections';
import { paceIdxPhrase, type MetricPaceRatios } from './kommune-ranking';
import type { IndsatsStatus } from './kommune-indsats-status';
import type { DashboardData, KommuneRankingData } from './types';
import { getPillarConfig } from './pillars';

/** National goal-pace context for one effort metric. */
export interface NationalMetricPace {
  /** National delivery in the selected phases as a share of the goal (0–100). */
  progressPct: number;
  /** Projected end progress at deadline if current pace holds (0–100, capped). */
  projectedPct: number;
  /** progress fraction ÷ time elapsed fraction. 1,0 = exactly on pace. */
  paceRatio: number;
  /** Deadline year used for the time-elapsed calculation. */
  deadlineYear: number;
  /** Graduated goal status from the projection. */
  status: GoalStatus;
}

export interface NationalPaceContext {
  lavbund: NationalMetricPace | null;
  skov: NationalMetricPace | null;
  kvaelstof: NationalMetricPace | null;
}

function yearOf(iso: string | undefined): number | null {
  if (!iso) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

function metricPace(progressPct: number, deadlineYear: number): NationalMetricPace {
  const frac = timeElapsedFraction(deadlineYear);
  const rawProjected = frac > 0 ? progressPct / frac : progressPct;
  return {
    progressPct,
    projectedPct: Math.min(100, Math.round(rawProjected)),
    paceRatio: rawProjected / 100,
    deadlineYear,
    status: assessGoalStatus(rawProjected, progressPct),
  };
}

/** Deadline year per effort metric. Kvælstof is 2027 (vandplanlægningsloven). */
function deadlines(data: DashboardData) {
  return {
    lavbund: yearOf(data.national.targets.deadline),
    skov: yearOf(data.national.targets.forestDeadline),
    kvaelstof: getPillarConfig('nitrogen').deadlineYear,
  };
}

/**
 * National goal-pace for all three effort metrics, computed from the national
 * delivery in the ranking (i.e. the phases the user selected) against the goals.
 */
export function computeNationalPace(
  data: DashboardData,
  ranking: KommuneRankingData,
): NationalPaceContext {
  const t = data.national.targets;
  const n = ranking.national;
  const d = deadlines(data);
  const pct = (delivered: number, goal: number) => (goal > 0 ? (delivered / goal) * 100 : 0);
  return {
    lavbund: d.lavbund != null ? metricPace(pct(n.deliveryExtractionHa, t.extractionHa), d.lavbund) : null,
    skov: d.skov != null ? metricPace(pct(n.deliverySkovHa, t.afforestationHa), d.skov) : null,
    kvaelstof: d.kvaelstof != null ? metricPace(pct(n.deliveryKvaelstofT, t.nitrogenReductionT), d.kvaelstof) : null,
  };
}

/** Per-metric scalar turning a share-of-ansvar into a goal-pace index (1 ÷ time elapsed). */
export function paceRatiosOf(data: DashboardData): MetricPaceRatios {
  const d = deadlines(data);
  const inv = (year: number | null) => (year != null ? 1 / timeElapsedFraction(year) : null);
  return {
    idxLavbund: inv(d.lavbund),
    idxSkov: inv(d.skov),
    idxKvaelstof: inv(d.kvaelstof),
  };
}

/**
 * Map a goal-pace index (1,0× = exactly on the trajectory needed) to a
 * plain-language status. Deliberately uses tempo wording — "På sporet",
 * "Bagud" — that the peer lens avoids, so the two stories never blur.
 */
export function paceStatusOf(idx: number | null): IndsatsStatus {
  if (idx == null) return { kind: 'none', word: 'Ingen andel af målet', detail: '' };
  if (idx <= 0) return { kind: 'under', word: 'Intet endnu', detail: 'Intet godkendt eller anlagt' };
  const detail = paceIdxPhrase(idx);
  if (idx >= 1.15) return { kind: 'over', word: 'Foran tempo', detail };
  if (idx >= 0.85) return { kind: 'on', word: 'På sporet', detail };
  if (idx >= 0.5) return { kind: 'under', word: 'Bagud', detail };
  return { kind: 'under', word: 'Langt bagud', detail };
}
