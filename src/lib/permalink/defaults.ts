import type { ProjectPhase } from '@/lib/phase-config';
import type { ViewState, NationalMapState, PanelState, FremskrivningUrlState, StandingsUrlState } from './types';

export const DEFAULT_NATIONAL_PHASES: Set<ProjectPhase> = new Set(['established']);

export const DEFAULT_NATIONAL_MAP: NationalMapState = {
  basemap: null,
  overlays: new Set(),
  phases: new Set(DEFAULT_NATIONAL_PHASES),
  fullscreen: false,
};

export const DEFAULT_PANELS: PanelState = {
  opland: null,
  plan: null,
  kystvand: null,
  vandplan: null,
};

export const DEFAULT_FREMSKRIVNING: FremskrivningUrlState = {
  activeStages: new Set(),
  explicit: false,
};

export const DEFAULT_STANDINGS: StandingsUrlState = {
  sort: 'idxLavbund',
  mode: 'maal',
  region: 'Alle regioner',
};

export const DEFAULT_VIEW_STATE: ViewState = {
  section: null,
  mapNational: DEFAULT_NATIONAL_MAP,
  mapKommune: null,
  panels: DEFAULT_PANELS,
  projectOpen: null,
  projectsMetric: 'area',
  fremskrivning: DEFAULT_FREMSKRIVNING,
  standings: DEFAULT_STANDINGS,
};
