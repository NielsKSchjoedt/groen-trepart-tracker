import type { PillarId } from '@/lib/pillars';
import type { PipelineMainPhase } from '@/lib/types';

/** MARS pipeline stadium ids (Danish labels in stages.ts). */
export type FremskrivningMarsStageId = 'anlagt' | 'godkendt' | 'forundersoegt' | 'skitse';

/** Supplementary source ids (Klimaskovfonden, Naturstyrelsen). */
export type FremskrivningSupplementStageId =
  | 'ksf_skov'
  | 'nst_gennemfoert'
  | 'nst_igang'
  | 'ksf_lavbund';

export type FremskrivningStageId = FremskrivningMarsStageId | FremskrivningSupplementStageId;

export type FremskrivningStageKind = 'mars' | 'supplement_completed' | 'supplement_ongoing';

export type FremskrivningPillarId = Extract<PillarId, 'nitrogen' | 'extraction' | 'afforestation'>;

export interface FremskrivningStageMeta {
  id: FremskrivningStageId;
  kind: FremskrivningStageKind;
  marsPhase?: PipelineMainPhase;
  label: string;
  certainty: string;
  certColor: string;
  opacity: number;
  locked: boolean;
  dashed?: boolean;
  description: string;
}

export interface FremskrivningStageData extends FremskrivningStageMeta {
  value: number;
  projectCount: number;
}

export type FremskrivningStatusKey =
  | 'reached'
  | 'ontrack'
  | 'veryclose'
  | 'close'
  | 'behind';

export interface FremskrivningStatusMeta {
  key: FremskrivningStatusKey;
  label: string;
  color: string;
  icon: string;
  /** Status-pille baggrund (8-cifret hex m. alpha). */
  pillBg: string;
  /** Status-pille kant. */
  pillBorder: string;
  /** Resultatpanel baggrund. */
  panelBg: string;
  /** Resultatpanel kant. */
  panelBorder: string;
}

export interface FremskrivningBand {
  stage: FremskrivningStageData;
  bottom: number[];
  top: number[];
}

export interface FremskrivningPaceMetrics {
  builtPacePerDay: number;
  neededPacePerDay: number;
  paceMultiple: number;
}

export interface FremskrivningTimeFrame {
  projectStart: Date;
  asOf: Date;
  deadline: Date;
  elapsedYears: number;
  totalYears: number;
  remainingYears: number;
  goalPctToday: number;
}

export interface FremskrivningProjection {
  realizedToday: number;
  forecastEnd: number;
  forecastPct: number;
  potentialSum: number;
  stackTotal: number;
  stackPct: number;
  scenarioTon: number;
  scenarioPct: number;
  pace: FremskrivningPaceMetrics;
  sampleYears: number[];
  bands: FremskrivningBand[];
}

export interface FremskrivningModel {
  pillar: FremskrivningPillarId;
  target: number;
  unit: string;
  unitShort: string;
  deadlineYear: number;
  accentColor: string;
  stages: FremskrivningStageData[];
  time: FremskrivningTimeFrame;
  pace: FremskrivningPaceMetrics;
}

/** Per-stage toggle overrides; unset keys fall back to pillar-specific defaults. */
export type StageSelection = Partial<Record<Exclude<FremskrivningStageId, 'anlagt'>, boolean>>;
