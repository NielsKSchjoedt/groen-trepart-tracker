import type { ProjectPhase } from '@/lib/phase-config';
import type { MetricMode } from '@/lib/metric-mode';
import type { FremskrivningStageId } from '@/lib/fremskrivning';
import type { StandingsLensKey, StandingsMode } from '@/lib/kommune-ranking';
import type { KommuneMapViewState } from '@/lib/kommune-map-params';

/** National map basemap tokens (URL `kort=`). */
export type NationalBasemapToken = 'kystvande' | 'hovedvandoplande' | 'kommuner' | 'skjult';

/** Overlay layer tokens (URL `overlag=` comma-list). */
export type NationalOverlayToken =
  | 'section3'
  | 'natura2000'
  | 'markudledning'
  | 'drikkevand'
  | 'naturpotentialer'
  | 'biodiv'
  | 'vns'
  | 'ksf'
  | 'nst'
  | 'vandlegemer'
  | 'kulstof';

export type ProjectSource = 'mars' | 'ksf' | 'nst';

export interface ProjectOpenState {
  source: ProjectSource;
  id: string;
  featureName?: string;
}

export interface NationalMapState {
  basemap: NationalBasemapToken | null;
  overlays: Set<NationalOverlayToken>;
  phases: Set<ProjectPhase>;
  fullscreen: boolean;
}

export interface PanelState {
  opland: string | null;
  plan: string | null;
  kystvand: string | null;
  vandplan: string | null;
}

export interface FremskrivningUrlState {
  /** Stages toggled ON beyond anlagt when `explicit` is true. */
  activeStages: Set<Exclude<FremskrivningStageId, 'anlagt'>>;
  /** True when `frem` param was present — encodes full optional stage selection. */
  explicit: boolean;
}

export interface StandingsUrlState {
  sort: StandingsLensKey;
  mode: StandingsMode;
  region: string;
}

export interface ViewState {
  section: string | null;
  mapNational: NationalMapState;
  mapKommune: KommuneMapViewState | null;
  panels: PanelState;
  projectOpen: ProjectOpenState | null;
  projectsMetric: MetricMode;
  fremskrivning: FremskrivningUrlState;
  standings: StandingsUrlState;
}

export type RouteKind =
  | 'overview'
  | 'pillar'
  | 'kommune-list'
  | 'kommune-detail'
  | 'other';

export interface RouteContext {
  kind: RouteKind;
  pathname: string;
}
