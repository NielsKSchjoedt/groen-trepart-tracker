import { PILLAR_CONFIGS } from '@/lib/pillars';
import type { DashboardData, PipelinePhaseMetricsRow } from '@/lib/types';
import { getStageMetas } from './stages';
import { buildSupplementStages, sortStagesForStacking } from './supplements';
import type {
  FremskrivningBand,
  FremskrivningModel,
  FremskrivningPaceMetrics,
  FremskrivningPillarId,
  FremskrivningProjection,
  FremskrivningStageData,
  FremskrivningTimeFrame,
  StageSelection,
} from './types';
import { buildEffectiveSelection, getActiveStages } from './stages';

/** Trepartsaftalen signed 24 June 2024. */
export const FREMSKRIVNING_PROJECT_START = new Date('2024-06-24T00:00:00');

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function metricValue(row: PipelinePhaseMetricsRow, pillar: FremskrivningPillarId): number {
  switch (pillar) {
    case 'nitrogen':
      return row.nitrogenT;
    case 'extraction':
      return row.extractionHa;
    case 'afforestation':
      return row.afforestationHa;
  }
}

function deadlineForPillar(pillar: FremskrivningPillarId, data: DashboardData): Date {
  const { targets } = data.national;
  if (pillar === 'afforestation') {
    return new Date(targets.forestDeadline ?? `${PILLAR_CONFIGS.find((p) => p.id === pillar)!.deadlineYear}-12-31`);
  }
  if (pillar === 'nitrogen') {
    return new Date(`${PILLAR_CONFIGS.find((p) => p.id === pillar)!.deadlineYear}-12-31`);
  }
  return new Date(targets.deadline ?? '2030-12-31');
}

function parseAsOf(fetchedAt: string | undefined): Date {
  if (fetchedAt) {
    const d = new Date(fetchedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function yearsBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / YEAR_MS);
}

function daysBetween(start: Date, end: Date): number {
  return Math.max(1, (end.getTime() - start.getTime()) / DAY_MS);
}

export function buildFremskrivningModel(
  data: DashboardData,
  pillar: FremskrivningPillarId,
): FremskrivningModel | null {
  const pipeline = data.national.byPipelinePhase?.[pillar];
  if (!pipeline) return null;

  const config = PILLAR_CONFIGS.find((p) => p.id === pillar)!;
  const metas = getStageMetas(pillar);

  const stages: FremskrivningStageData[] = [
    ...metas.map((meta) => {
      const row = pipeline[meta.marsPhase!];
      return {
        ...meta,
        value: metricValue(row, pillar),
        projectCount: row.count,
      };
    }),
    ...buildSupplementStages(data, pillar),
  ];

  const asOf = parseAsOf(data.fetchedAt);
  const deadline = deadlineForPillar(pillar, data);
  const elapsedYears = Math.max(0.001, yearsBetween(FREMSKRIVNING_PROJECT_START, asOf));
  const totalYears = Math.max(elapsedYears + 0.001, yearsBetween(FREMSKRIVNING_PROJECT_START, deadline));
  const remainingYears = Math.max(0, totalYears - elapsedYears);

  const defaultRealized = realizedFromStages(stages, buildEffectiveSelection(stages));
  const target = config.target ?? 0;

  const time: FremskrivningTimeFrame = {
    projectStart: FREMSKRIVNING_PROJECT_START,
    asOf,
    deadline,
    elapsedYears,
    totalYears,
    remainingYears,
    goalPctToday: target > 0 ? (defaultRealized / target) * 100 : 0,
  };

  const pace = computePaceMetrics(
    defaultRealized,
    target,
    FREMSKRIVNING_PROJECT_START,
    asOf,
    deadline,
  );

  return {
    pillar,
    target,
    unit: config.unit,
    unitShort: pillar === 'nitrogen' ? 'ton' : 'ha',
    deadlineYear: config.deadlineYear,
    accentColor: config.accentColor,
    stages,
    time,
    pace,
  };
}

export function realizedFromStages(
  stages: FremskrivningStageData[],
  selection: Record<Exclude<import('./types').FremskrivningStageId, 'anlagt'>, boolean>,
): number {
  return stages
    .filter((s) => {
      if (s.id === 'anlagt') return true;
      if (s.kind === 'supplement_completed') {
        return selection[s.id as Exclude<typeof s.id, 'anlagt'>] ?? true;
      }
      return false;
    })
    .reduce((sum, s) => sum + s.value, 0);
}

export function computePaceMetrics(
  realizedToday: number,
  target: number,
  projectStart: Date,
  asOf: Date,
  deadline: Date,
): FremskrivningPaceMetrics {
  const daysElapsed = daysBetween(projectStart, asOf);
  const daysRemaining = daysBetween(asOf, deadline);
  const builtPacePerDay = realizedToday / daysElapsed;
  const neededPacePerDay = Math.max(0, target - realizedToday) / daysRemaining;
  const paceMultiple =
    builtPacePerDay > 0 ? neededPacePerDay / builtPacePerDay : neededPacePerDay > 0 ? Infinity : 1;

  return { builtPacePerDay, neededPacePerDay, paceMultiple };
}

export function valOfStage(
  stage: FremskrivningStageData,
  yr: number,
  marsForecastEnd: number,
  elapsedYears: number,
  totalYears: number,
): number {
  if (stage.kind === 'supplement_completed') {
    return stage.value;
  }
  if (stage.id === 'anlagt') {
    return marsForecastEnd * (yr / totalYears);
  }
  if (yr <= elapsedYears) return 0;
  const ramp = totalYears - elapsedYears;
  if (ramp <= 0) return stage.value;
  return stage.value * ((yr - elapsedYears) / ramp);
}

export function buildStackedBands(
  activeStages: FremskrivningStageData[],
  model: FremskrivningModel,
): FremskrivningProjection {
  const { target, time } = model;
  const { elapsedYears, totalYears, projectStart, asOf, deadline } = time;
  const sorted = sortStagesForStacking(activeStages);

  const marsRealized = sorted.find((s) => s.id === 'anlagt')?.value ?? 0;
  const completedSupplement = sorted
    .filter((s) => s.kind === 'supplement_completed')
    .reduce((sum, s) => sum + s.value, 0);
  const realizedToday = marsRealized + completedSupplement;
  const marsForecastEnd =
    elapsedYears > 0 ? (marsRealized / elapsedYears) * totalYears : marsRealized;
  const scenarioTon = sorted.reduce((sum, s) => sum + s.value, 0);
  const scenarioPct = target > 0 ? (scenarioTon / target) * 100 : 0;
  const pace = computePaceMetrics(realizedToday, target, projectStart, asOf, deadline);

  const sampleYears = [0, elapsedYears, totalYears];
  let below = sampleYears.map(() => 0);
  const bands: FremskrivningBand[] = sorted.map((stage) => {
    const bottom = below.slice();
    const top = sampleYears.map((yr, i) =>
      bottom[i] + valOfStage(stage, yr, marsForecastEnd, elapsedYears, totalYears),
    );
    below = top.slice();
    return { stage, bottom, top };
  });

  const lastIdx = sampleYears.length - 1;
  // Kurs = færdige kilder (konstant) + MARS-tempo — ikke lineær ekstrapolation af hele realizedToday.
  const kursAtDeadline =
    bands.find((b) => b.stage.id === 'anlagt')?.top[lastIdx] ??
    completedSupplement + marsForecastEnd;
  const stackAtDeadline = bands[bands.length - 1]?.top[lastIdx] ?? scenarioTon;
  const potentialSum = stackAtDeadline - kursAtDeadline;

  const forecastEnd = kursAtDeadline;
  const forecastPct = target > 0 ? (forecastEnd / target) * 100 : 0;
  const stackTotal = stackAtDeadline;
  const stackPct = target > 0 ? (stackTotal / target) * 100 : 0;

  return {
    realizedToday,
    forecastEnd,
    forecastPct,
    potentialSum,
    stackTotal,
    stackPct,
    scenarioTon,
    scenarioPct,
    pace,
    sampleYears,
    bands,
  };
}

export function buildProjection(
  model: FremskrivningModel,
  selection: StageSelection,
): FremskrivningProjection {
  const activeStages = sortStagesForStacking(getActiveStages(model.stages, selection));
  return buildStackedBands(activeStages, model);
}

/** Closed SVG path for a stacked band. */
export function bandAreaPath(
  band: FremskrivningBand,
  sampleYears: number[],
  xOf: (yr: number) => number,
  yOf: (ton: number) => number,
): string {
  const pts: string[] = [];
  sampleYears.forEach((yr, i) => {
    pts.push(`${xOf(yr).toFixed(1)},${yOf(band.bottom[i]).toFixed(1)}`);
  });
  for (let i = sampleYears.length - 1; i >= 0; i--) {
    pts.push(`${xOf(sampleYears[i]).toFixed(1)},${yOf(band.top[i]).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

export function bandTopLine(
  band: FremskrivningBand,
  sampleYears: number[],
  xOf: (yr: number) => number,
  yOf: (ton: number) => number,
): string {
  return sampleYears
    .map((yr, i) => `${xOf(yr).toFixed(1)},${yOf(band.top[i]).toFixed(1)}`)
    .join(' ');
}
