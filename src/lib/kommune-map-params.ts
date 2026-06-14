import type { KommuneMetric, KommunePhase, SupplementSource } from '@/lib/kommune-metrics';
import {
  DEFAULT_PHASES,
  KOMMUNE_PHASES,
  getSupplementPresentation,
} from '@/lib/kommune-metrics';
import type { ChoroplethScaleMode, FordelingViewMode, NatureLayerKey } from '@/lib/kommune-map-visualization';
import { NATURE_LAYER_OPTIONS } from '@/lib/kommune-map-visualization';
import { PILLAR_SLUGS, slugToPillar } from '@/lib/slugs';
import { getPillarConfig } from '@/lib/pillars';

export interface KommuneMapViewState {
  fordelingViewMode: FordelingViewMode;
  choroplethScale: ChoroplethScaleMode;
  natureLayer: NatureLayerKey;
  selectedPhases: Set<KommunePhase>;
  activeSupplements: Set<SupplementSource>;
}

const PHASE_SLUG: Record<KommunePhase, string> = {
  sketch: 'skitse',
  preliminary: 'foru',
  approved: 'godk',
  established: 'anlagt',
};

const PHASE_FROM_SLUG = Object.fromEntries(
  Object.entries(PHASE_SLUG).map(([phase, slug]) => [slug, phase]),
) as Record<string, KommunePhase>;

const SUPPLEMENT_SLUG: Record<SupplementSource, string> = {
  ksf: 'ksf',
  nst: 'nst',
  section3: 's3',
  natura2000: 'n2000',
};

const SUPPLEMENT_FROM_SLUG = Object.fromEntries(
  Object.entries(SUPPLEMENT_SLUG).map(([id, slug]) => [slug, id]),
) as Record<string, SupplementSource>;

const VIEW_SLUG: Record<FordelingViewMode, string | null> = {
  actual: null,
  simulated: 'forventet',
  difference: 'forskel',
};

const VIEW_FROM_SLUG: Record<string, FordelingViewMode> = {
  forventet: 'simulated',
  forskel: 'difference',
};

const SCALE_SLUG: Record<ChoroplethScaleMode, string | null> = {
  absolute: null,
  ansvar: 'ansvar',
};

const LAYER_SLUG: Record<NatureLayerKey, string | null> = {
  'b4-beskyttet': null,
  'b1-potentiale': 'dce',
  'b2-marker': 'b2',
  'b3-landbrug': 'b3',
};

const LAYER_FROM_SLUG: Record<string, NatureLayerKey> = {
  dce: 'b1-potentiale',
  b2: 'b2-marker',
  b3: 'b3-landbrug',
  b4: 'b4-beskyttet',
};

function phasesEqual(a: Set<KommunePhase>, b: Set<KommunePhase>): boolean {
  if (a.size !== b.size) return false;
  for (const phase of a) {
    if (!b.has(phase)) return false;
  }
  return true;
}

function supplementsEqual(a: Set<SupplementSource>, b: Set<SupplementSource>): boolean {
  if (a.size !== b.size) return false;
  for (const src of a) {
    if (!b.has(src)) return false;
  }
  return true;
}

/** Parse map view state from URL search params (defaults when omitted). */
export function parseKommuneMapViewState(params: URLSearchParams): KommuneMapViewState {
  const faserRaw = params.get('faser');
  let selectedPhases = new Set(DEFAULT_PHASES);
  if (faserRaw) {
    const parsed = faserRaw
      .split(',')
      .map((s) => PHASE_FROM_SLUG[s.trim()])
      .filter(Boolean) as KommunePhase[];
    if (parsed.length > 0) {
      selectedPhases = new Set(parsed);
    }
  }

  const tilvalgRaw = params.get('tilvalg');
  const activeSupplements = new Set<SupplementSource>();
  if (tilvalgRaw) {
    for (const token of tilvalgRaw.split(',')) {
      const src = SUPPLEMENT_FROM_SLUG[token.trim()];
      if (src) activeSupplements.add(src);
    }
  }

  const vis = params.get('vis');
  const fordelingViewMode = (vis && VIEW_FROM_SLUG[vis]) || 'actual';

  const skala = params.get('skala');
  const choroplethScale: ChoroplethScaleMode = skala === 'ansvar' ? 'ansvar' : 'absolute';

  const natur = params.get('natur');
  const natureLayer: NatureLayerKey = (natur && LAYER_FROM_SLUG[natur]) || 'b4-beskyttet';

  return {
    fordelingViewMode,
    choroplethScale,
    natureLayer,
    selectedPhases,
    activeSupplements,
  };
}

/** Write map view params into search; omits keys that match defaults. */
export function applyKommuneMapViewState(
  params: URLSearchParams,
  state: KommuneMapViewState,
): void {
  params.delete('vis');
  params.delete('skala');
  params.delete('natur');
  params.delete('faser');
  params.delete('tilvalg');

  const viewSlug = VIEW_SLUG[state.fordelingViewMode];
  if (viewSlug) params.set('vis', viewSlug);

  const scaleSlug = SCALE_SLUG[state.choroplethScale];
  if (scaleSlug) params.set('skala', scaleSlug);

  const layerSlug = LAYER_SLUG[state.natureLayer];
  if (layerSlug) params.set('natur', layerSlug);

  if (!phasesEqual(state.selectedPhases, DEFAULT_PHASES)) {
    params.set(
      'faser',
      KOMMUNE_PHASES
        .filter((phase) => state.selectedPhases.has(phase))
        .map((phase) => PHASE_SLUG[phase])
        .join(','),
    );
  }

  if (state.activeSupplements.size > 0) {
    params.set(
      'tilvalg',
      [...state.activeSupplements].map((src) => SUPPLEMENT_SLUG[src]).join(','),
    );
  }
}

export function parseKommuneMetricParam(params: URLSearchParams): KommuneMetric | null {
  const slug = params.get('metric');
  if (!slug) return null;
  return (slugToPillar(slug) as KommuneMetric | null) ?? null;
}

/** Plain-language summary of the active map view (detail page caption). */
export function describeKommuneMapView(
  metric: KommuneMetric,
  state: KommuneMapViewState,
): string {
  const parts: string[] = [getPillarConfig(metric).label];

  if (metric === 'extraction' || metric === 'afforestation') {
    if (state.fordelingViewMode === 'actual') {
      parts.push(state.choroplethScale === 'ansvar' ? 'faktisk · ift. ansvar' : 'faktisk · absolut (ha)');
    } else if (state.fordelingViewMode === 'simulated') {
      parts.push('fagligt forventet');
    } else {
      parts.push('forskel (forventet − faktisk)');
    }
  } else if (metric === 'nature') {
    const layer = NATURE_LAYER_OPTIONS.find((option) => option.id === state.natureLayer);
    parts.push(layer?.shortLabel ?? 'natur-kortlag');
  }

  if (metric === 'nitrogen' || metric === 'extraction' || metric === 'afforestation') {
    const phaseLabels: Record<KommunePhase, string> = {
      sketch: 'skitse',
      preliminary: 'forundersøgelse',
      approved: 'godkendt',
      established: 'anlagt',
    };
    const phases = KOMMUNE_PHASES
      .filter((phase) => state.selectedPhases.has(phase))
      .map((phase) => phaseLabels[phase]);
    if (phases.length > 0) {
      parts.push(`faser: ${phases.join(', ')}`);
    }
  }

  if (state.activeSupplements.size > 0) {
    const extras = [...state.activeSupplements].map(
      (src) => getSupplementPresentation(src, metric).label,
    );
    parts.push(`+ ${extras.join(', ')}`);
  }

  return parts.join(' · ');
}

/** Reset map-specific params when switching metric on the list page. */
export function resetMapViewParamsForMetric(params: URLSearchParams, metric: KommuneMetric): void {
  applyKommuneMapViewState(params, {
    fordelingViewMode: 'actual',
    choroplethScale: 'absolute',
    natureLayer: 'b4-beskyttet',
    selectedPhases: new Set(DEFAULT_PHASES),
    activeSupplements: new Set(),
  });
  params.set('metric', PILLAR_SLUGS[metric]);
}
