/**
 * Goal-pace lens ("Mod målet") for the three Grøn Trepart effort metrics.
 *
 * The existing "Ift. ansvar" index measures a kommune's share of what the
 * country has ALREADY delivered, divided by its share of national potential.
 * By construction the potential-weighted national average is always 1,0× — so
 * that index can never tell you whether the country is on pace for 2030.
 *
 * This module adds the missing axis: how the kommune's delivery compares to the
 * *tempo* its share of the 2030 goal requires by now. The two stories share a
 * denominator, so the relationship is a single per-metric scalar:
 *
 *   paceIndex_i = peerIndex_i × (national progress fraction ÷ time elapsed fraction)
 *
 * i.e. each kommune's "Ift. ansvar" multiplier scaled by the nation's pace
 * ratio for that metric. 1,0× = exactly on the trajectory needed; below 1,0×
 * = behind the clock no matter how well the kommune ranks against its peers.
 */
import {
  assessGoalStatus,
  timeElapsedFraction,
  type GoalStatus,
} from './projections';
import { paceIdxPhrase, type MetricPaceRatios } from './kommune-ranking';
import type { IndsatsStatus } from './kommune-indsats-status';
import type { DashboardData } from './types';

/** National goal-pace context for one effort metric. */
export interface NationalMetricPace {
  /** Current national progress toward the 2030 goal (0–100). */
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

/**
 * Derive the national goal-pace context for all three effort metrics from the
 * dashboard's national targets + progress. Returns null per metric when the
 * deadline year is unparseable.
 */
export function computeNationalPace(data: DashboardData): NationalPaceContext {
  const t = data.national.targets;
  const p = data.national.progress;
  const extractionYear = yearOf(t.deadline);
  const forestYear = yearOf(t.forestDeadline);
  const nitrogenYear = yearOf(t.deadline);
  return {
    lavbund: extractionYear != null ? metricPace(p.extractionProgressPct, extractionYear) : null,
    skov: forestYear != null ? metricPace(p.afforestationProgressPct, forestYear) : null,
    kvaelstof: nitrogenYear != null ? metricPace(p.nitrogenProgressPct, nitrogenYear) : null,
  };
}

/** Extract the per-metric pace scalars that scale a peer index into a pace index. */
export function paceRatiosOf(ctx: NationalPaceContext): MetricPaceRatios {
  return {
    idxLavbund: ctx.lavbund?.paceRatio ?? null,
    idxSkov: ctx.skov?.paceRatio ?? null,
    idxKvaelstof: ctx.kvaelstof?.paceRatio ?? null,
  };
}

/**
 * Map a goal-pace index (1,0× = exactly on the trajectory needed) to a
 * plain-language status. Deliberately uses tempo wording — "På sporet",
 * "Bagud" — that the peer lens avoids, so the two stories never blur.
 */
export function paceStatusOf(idx: number | null): IndsatsStatus {
  if (idx == null) return { kind: 'none', word: 'Ingen data', detail: '' };
  if (idx <= 0) return { kind: 'under', word: 'Ikke begyndt', detail: '' };
  const detail = paceIdxPhrase(idx);
  if (idx >= 1.15) return { kind: 'over', word: 'Foran tempo', detail };
  if (idx >= 0.85) return { kind: 'on', word: 'På sporet', detail };
  if (idx >= 0.5) return { kind: 'under', word: 'Bagud', detail };
  return { kind: 'under', word: 'Langt bagud', detail };
}
