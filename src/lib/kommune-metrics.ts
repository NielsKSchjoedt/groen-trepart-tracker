import type { SeriesColor } from './supplement-colors';
import { KSF_COLOR_LAVBUND, KSF_COLOR_SKOV, NST_COLOR, SECTION3_COLOR, NATURA2000_COLOR } from './supplement-colors';
import type { KommuneMetrics } from './types';

/**
 * Metric identifiers for the municipality choropleth map and table.
 * Shared between KommuneMap, MetricPicker, and KommuneTable so that none of
 * these component files need to export non-component values (which breaks
 * Vite's fast-refresh HMR).
 */
export type KommuneMetric = 'nitrogen' | 'extraction' | 'afforestation' | 'nature' | 'co2';

/**
 * Metrics where municipal-level data is currently unavailable.
 * The map renders all polygons as no-data grey and the MetricPicker shows
 * a warning indicator for these.
 *
 * CO₂ data is now available at municipality level via Klimaregnskabet (Energistyrelsen).
 */
export const METRIC_NO_DATA = new Set<KommuneMetric>();

/**
 * MARS project implementation phase identifiers used for the phase filter.
 * Aligns with the ETL's byPhase keys in KommuneMetrics.
 *
 * Display order (earliest → latest):
 *   sketch      → Skitse (rough outline, not yet in formal study)
 *   preliminary → Forundersøgelse (feasibility study granted)
 *   approved    → Godkendt / Etableringstilsagn (approved for construction)
 *   established → Anlagt (physically built and operational)
 */
export type KommunePhase = 'sketch' | 'preliminary' | 'approved' | 'established';

/** All valid phase values in display order (earliest → latest). */
export const KOMMUNE_PHASES: KommunePhase[] = ['sketch', 'preliminary', 'approved', 'established'];

/**
 * Default phase selection — physically established (anlagt) only.
 *
 * Users can expand the phase filter to include forundersøgelse and godkendt
 * (pipeline view). Sketches remain opt-in.
 */
export const DEFAULT_PHASES = new Set<KommunePhase>(['established']);

// ---------------------------------------------------------------------------
// Supplementary data source toggles
// ---------------------------------------------------------------------------

/**
 * Identifier for a supplementary (non-MARS) data source that can be
 * toggled on/off in the kommune view.
 */
export type SupplementSource = 'ksf' | 'nst' | 'section3' | 'natura2000';

/** Which supplement sources are relevant for each metric. */
export const METRIC_SUPPLEMENTS: Partial<Record<KommuneMetric, SupplementSource[]>> = {
  extraction: ['ksf'],
  afforestation: ['ksf', 'nst'],
  nature: ['section3', 'natura2000'],
};

/** Display configuration for each supplement source. */
export interface SupplementDef {
  id: SupplementSource;
  label: string;
  shortLabel: string;
  description: string;
  field: string;
  /** Canonical colour tokens — shared with charts, maps, and badges. */
  color: SeriesColor;
}

export const SUPPLEMENT_DEFS: Record<SupplementSource, SupplementDef> = {
  ksf: {
    id: 'ksf',
    label: 'Klimaskovfonden',
    shortLabel: 'KSF',
    description: 'Frivillig privat skovrejsning administreret uden for MARS. Har ikke projektfasedata — inkluderes som samlet areal.',
    field: 'afforestationKsfHa',
    color: KSF_COLOR_SKOV,
  },
  nst: {
    id: 'nst',
    label: 'Naturstyrelsen',
    shortLabel: 'NST',
    description: 'Statslig skovrejsning administreret af Naturstyrelsen uden for MARS. Har ikke projektfasedata — inkluderes som samlet areal.',
    field: 'afforestationNstHa',
    color: NST_COLOR,
  },
  section3: {
    id: 'section3',
    label: '§3-arealer',
    shortLabel: '§3',
    description: 'Statsligt udpegede beskyttede naturtyper (hede, mose, eng, strandeng m.fl.). Faste lovmæssige udpegninger — ikke projekter med faser.',
    field: 'section3Ha',
    color: SECTION3_COLOR,
  },
  natura2000: {
    id: 'natura2000',
    label: 'Natura 2000',
    shortLabel: 'N2000',
    description: 'EU-udpegede Habitat- og Fugledirektiv-beskyttede områder. Faste lovmæssige udpegninger — ikke projekter med faser.',
    field: 'natura2000Ha',
    color: NATURA2000_COLOR,
  },
};

/** Metric-aware label, description, colour and data field for supplement toggles. */
export function getSupplementPresentation(
  id: SupplementSource,
  metric: KommuneMetric,
): Pick<SupplementDef, 'label' | 'description' | 'color'> & { field: string } {
  if (id === 'ksf' && metric === 'extraction') {
    return {
      label: 'Klimaskovfonden (lavbund)',
      description:
        'Frivillige lavbundsprojekter administreret uden for MARS. Har ikke projektfasedata — inkluderes som samlet areal.',
      field: 'extractionKsfHa',
      color: KSF_COLOR_LAVBUND,
    };
  }
  const def = SUPPLEMENT_DEFS[id];
  return {
    label: def.label,
    description: def.description,
    field: def.field,
    color: def.color,
  };
}

/**
 * Phase-metric shape for a single phase bucket.
 * Matches the ETL's byPhase sub-objects.
 */
interface PhaseMetrics {
  nitrogenT: number;
  extractionHa: number;
  afforestationHa: number;
  count: number;
}

/** Return type for {@link filterByPhases}. */
export interface FilteredPhaseMetrics {
  nitrogenT: number;
  extractionHa: number;
  afforestationMarsHa: number;
  projectCount: number;
}

/**
 * Compute nitrogen, extraction, and MARS afforestation metric values for a
 * municipality filtered to only the selected project phases.
 *
 * All three metrics are summed from the `byPhase` structure so the result
 * is consistent regardless of which phases are selected — including sketch
 * data that isn't in top-level totals.
 *
 * Non-MARS sources (KSF, NST, §3, Natura 2000) are handled separately
 * via supplement toggles and are NOT included here.
 *
 * @param km     - KommuneMetrics entry from dashboard data
 * @param phases - Set of phases to include in the sum
 * @returns Filtered totals for nitrogen, extraction, and MARS afforestation
 *
 * @example
 * // Only show what's actually been built
 * const { nitrogenT } = filterByPhases(km, new Set(['established']));
 *
 * @example
 * // Include the full funnel including rough sketches
 * const vals = filterByPhases(km, new Set(['sketch', 'preliminary', 'approved', 'established']));
 */
export function filterByPhases(
  km: {
    byPhase?: Partial<Record<KommunePhase, PhaseMetrics>>;
    nitrogenT: number;
    extractionHa: number;
    afforestationMarsHa: number;
    projectCount: number;
  },
  phases: Set<KommunePhase>,
): FilteredPhaseMetrics {
  if (!km.byPhase) {
    return {
      nitrogenT: km.nitrogenT,
      extractionHa: km.extractionHa,
      afforestationMarsHa: km.afforestationMarsHa,
      projectCount: km.projectCount,
    };
  }
  let nitrogenT = 0;
  let extractionHa = 0;
  let afforestationMarsHa = 0;
  let projectCount = 0;
  for (const phase of phases) {
    const p = km.byPhase[phase];
    if (p) {
      nitrogenT += p.nitrogenT ?? 0;
      extractionHa += p.extractionHa ?? 0;
      afforestationMarsHa += p.afforestationHa ?? 0;
      projectCount += p.count ?? 0;
    }
  }
  return { nitrogenT, extractionHa, afforestationMarsHa, projectCount };
}

/**
 * Apply phase filter and optional supplement sources to kommune metrics
 * (same logic as the choropleth on `/kommuner`).
 */
export function buildFilteredKommuner(
  kommuner: Array<
    KommuneMetrics & {
      afforestationKsfHa?: number;
      afforestationNstHa?: number;
      extractionKsfHa?: number;
      section3Ha?: number;
      natura2000Ha?: number;
    }
  >,
  selectedPhases: Set<KommunePhase>,
  activeSupplements: Set<SupplementSource>,
): KommuneMetrics[] {
  return kommuner.map((km) => {
    const filtered = filterByPhases(km, selectedPhases);

    const afforestationTotal =
      filtered.afforestationMarsHa
      + (activeSupplements.has('ksf') ? (km.afforestationKsfHa ?? 0) : 0)
      + (activeSupplements.has('nst') ? (km.afforestationNstHa ?? 0) : 0);

    const extractionTotal =
      filtered.extractionHa
      + (activeSupplements.has('ksf') ? (km.extractionKsfHa ?? 0) : 0);

    const natureTotal =
      (activeSupplements.has('section3') ? (km.section3Ha ?? 0) : 0)
      + (activeSupplements.has('natura2000') ? (km.natura2000Ha ?? 0) : 0);

    return {
      ...km,
      nitrogenT: filtered.nitrogenT,
      extractionHa: Math.round(extractionTotal * 10) / 10,
      afforestationMarsHa: Math.round(filtered.afforestationMarsHa * 10) / 10,
      afforestationTotalHa: Math.round(afforestationTotal * 10) / 10,
      naturePotentialHa: Math.round(natureTotal * 10) / 10,
      projectCount: filtered.projectCount,
    };
  });
}
