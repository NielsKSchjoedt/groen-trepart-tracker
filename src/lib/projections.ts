/**
 * Shared projection utilities for computing how far a pillar will get
 * by its deadline if the current pace continues linearly.
 */

import type { DashboardData, CO2EmissionsData, PipelineScenarioKey } from './types';

const AGREEMENT_START = new Date('2024-01-01');

/**
 * Graduated goal-status tiers, ordered from most positive to most negative.
 * - `reached`: actual progress already >= 100%
 * - `on-track`: projected to reach >= 100% by deadline
 * - `very-close`: projected to reach 90–99% of target
 * - `close`: projected to reach 75–89% of target
 * - `behind`: projected < 75% of target
 * - `unknown`: no data available
 */
export type GoalStatus =
  | 'reached'
  | 'on-track'
  | 'very-close'
  | 'close'
  | 'behind'
  | 'unknown';

const PROJECTED_THRESHOLD_ON_TRACK = 100;
const PROJECTED_THRESHOLD_VERY_CLOSE = 90;
const PROJECTED_THRESHOLD_CLOSE = 75;

interface GoalStatusMeta {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
}

/**
 * Human-readable labels, icons, and colors for each goal status tier.
 *
 * @example GOAL_STATUS_META['on-track'].label // "Når målet"
 */
export const GOAL_STATUS_META: Record<GoalStatus, GoalStatusMeta> = {
  'reached':    { label: 'Mål nået',           icon: '✓', color: '#16a34a', bgColor: '#16a34a18' },
  'on-track':   { label: 'Når målet',           icon: '✓', color: '#22c55e', bgColor: '#22c55e18' },
  'very-close': { label: 'Tæt på målet',        icon: '○', color: '#65a30d', bgColor: '#65a30d18' },
  'close':      { label: 'Nærmer sig målet',    icon: '○', color: '#eab308', bgColor: '#eab30818' },
  'behind':     { label: 'Når ikke målet',       icon: '!', color: '#dc2626', bgColor: '#dc262618' },
  'unknown':    { label: 'Afventer data',        icon: '?', color: '#d4d4d4', bgColor: '#d4d4d418' },
};

/**
 * Assess a pillar's goal status using a graduated scale based on the
 * projected end percentage and (optionally) the actual current percentage.
 *
 * @param projectedPct - Projected progress at deadline (0–∞, where 100 = target met).
 *                        Pass null if unknown.
 * @param actualPct    - Current actual progress (0–100). Pass null if unknown.
 * @returns A graduated GoalStatus tier
 *
 * @example assessGoalStatus(110, 102)  // 'reached'  (actual already past 100%)
 * @example assessGoalStatus(105, 80)   // 'on-track' (projected >= 100%)
 * @example assessGoalStatus(93, 60)    // 'very-close' (90 ≤ projected < 100)
 * @example assessGoalStatus(80, 40)    // 'close'    (75 ≤ projected < 90)
 * @example assessGoalStatus(50, 20)    // 'behind'   (projected < 75)
 */
export function assessGoalStatus(
  projectedPct: number | null,
  actualPct: number | null = null,
): GoalStatus {
  if (projectedPct === null) return 'unknown';

  if (actualPct !== null && actualPct >= 100) return 'reached';
  if (projectedPct >= PROJECTED_THRESHOLD_ON_TRACK) return 'on-track';
  if (projectedPct >= PROJECTED_THRESHOLD_VERY_CLOSE) return 'very-close';
  if (projectedPct >= PROJECTED_THRESHOLD_CLOSE) return 'close';
  return 'behind';
}

/**
 * Fraction of time elapsed from agreement start (Jan 2024) to a deadline year.
 * Returns a value in (0, 1] — clamped to avoid division by zero.
 *
 * @param deadlineYear - Target year for the pillar
 * @returns Elapsed fraction (0–1)
 * @example timeElapsedFraction(2030) // ~0.31 in March 2026
 */
export function timeElapsedFraction(deadlineYear: number): number {
  const now = new Date();
  const deadline = new Date(`${deadlineYear}-12-31`);
  const elapsed = now.getTime() - AGREEMENT_START.getTime();
  const total = deadline.getTime() - AGREEMENT_START.getTime();
  if (total <= 0) return 1;
  return Math.max(0.001, Math.min(1, elapsed / total));
}

/**
 * Project where a pillar will end up by its deadline if the current
 * pace continues linearly. Returns a percentage (0–100), capped at 100.
 *
 * @param progressPct - Current progress percentage (0–100, where 100 = target met)
 * @param deadlineYear - Target year for the pillar
 * @returns Projected end percentage (0–100)
 * @example projectEndPct(27, 2030) // ~87 in March 2026
 */
export function projectEndPct(progressPct: number, deadlineYear: number): number {
  const elapsed = timeElapsedFraction(deadlineYear);
  return Math.min(100, progressPct / elapsed);
}

/**
 * Extract pillar-specific achieved, target, deadline, and unit from DashboardData
 * for use in the CountdownProjection. Returns null for pillars without
 * numeric targets or data.
 */
export interface ProjectionData {
  achieved: number;
  target: number;
  deadline: string;
  unit: string;
  accentColor: string;
  projectedOverride?: number;
  scenarios?: Partial<Record<PipelineScenarioKey, { achieved: number; projected?: number }>>;
}

/**
 * Build the projection data for a pillar, including pipeline scenario
 * alternatives for pillars with byPhase data (nitrogen, extraction,
 * afforestation). CO₂ and nature don't have pipeline phases so they
 * get no scenario selector.
 *
 * @param pillarId - Pillar identifier
 * @param data - Full dashboard data (includes pipelineScenarios)
 * @param co2Data - Optional CO₂ emissions data
 * @returns Projection data with optional scenario alternatives, or null
 * @example getPillarProjectionData('nitrogen', dashboardData, null)
 */
export function getPillarProjectionData(
  pillarId: string,
  data: DashboardData,
  co2Data: CO2EmissionsData | null,
): ProjectionData | null {
  const { targets, progress, pipelineScenarios } = data.national;

  switch (pillarId) {
    case 'nitrogen':
      return {
        achieved: progress.nitrogenAchievedT,
        target: targets.nitrogenReductionT,
        deadline: targets.deadline,
        unit: 'ton',
        accentColor: '#0d9488',
        scenarios: {
          established: { achieved: pipelineScenarios.established.nitrogenAchievedT },
          approved: { achieved: pipelineScenarios.approved.nitrogenAchievedT },
          preliminary: { achieved: pipelineScenarios.preliminary.nitrogenAchievedT },
          all: { achieved: pipelineScenarios.all.nitrogenAchievedT },
        },
      };
    case 'extraction':
      return {
        achieved: progress.extractionAchievedHa,
        target: targets.extractionHa,
        deadline: targets.deadline,
        unit: 'ha',
        accentColor: '#a16207',
        scenarios: {
          established: { achieved: pipelineScenarios.established.extractionAchievedHa },
          approved: { achieved: pipelineScenarios.approved.extractionAchievedHa },
          preliminary: { achieved: pipelineScenarios.preliminary.extractionAchievedHa },
          all: { achieved: pipelineScenarios.all.extractionAchievedHa },
        },
      };
    case 'afforestation':
      return {
        achieved: progress.afforestationAchievedHa,
        target: targets.afforestationHa,
        deadline: targets.forestDeadline,
        unit: 'ha',
        accentColor: '#15803d',
        scenarios: {
          established: { achieved: pipelineScenarios.established.afforestationAchievedHa },
          approved: { achieved: pipelineScenarios.approved.afforestationAchievedHa },
          preliminary: { achieved: pipelineScenarios.preliminary.afforestationAchievedHa },
          all: { achieved: pipelineScenarios.all.afforestationAchievedHa },
        },
      };
    case 'nature':
      return null;
    case 'co2':
      if (!co2Data) return null;
      return {
        achieved: co2Data.milestones.reduction2025Pct,
        target: co2Data.targets.reductionPct,
        deadline: '2030-12-31',
        unit: '% reduktion',
        accentColor: '#737373',
        projectedOverride: co2Data.milestones.reduction2030Pct,
      };
    default:
      return null;
  }
}
