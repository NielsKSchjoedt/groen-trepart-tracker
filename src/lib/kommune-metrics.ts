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
 * - `co2`: KF25 CO₂ data is national-level only.
 */
export const METRIC_NO_DATA = new Set<KommuneMetric>(['co2']);

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

/** Default phase selection — all phases selected. */
export const DEFAULT_PHASES = new Set<KommunePhase>(KOMMUNE_PHASES);

/**
 * Phase-metric shape for a single phase bucket.
 * Matches the ETL's byPhase sub-objects.
 */
interface PhaseMetrics {
  nitrogenT: number;
  extractionHa: number;
}

/**
 * Compute nitrogen and extraction metric values for a municipality filtered
 * to only the selected project phases.
 *
 * Sketch phase data is stored in `byPhase.sketch` and is NOT included in
 * the top-level `nitrogenT`/`extractionHa` totals (which only cover formal
 * projectDetails). This function always sums from `byPhase` so the result
 * is consistent regardless of which phases are selected.
 *
 * Afforestation is NOT phase-filtered because KSF and NST contributions
 * (which form most of `afforestationTotalHa`) don't have per-phase data.
 * Nature and CO₂ are static (no phase breakdown).
 *
 * @param km     - KommuneMetrics entry from dashboard data
 * @param phases - Set of phases to include in the sum
 * @returns Filtered `nitrogenT` and `extractionHa` totals
 *
 * @example
 * // Only show what's actually been built
 * const { nitrogenT } = filterByPhases(km, new Set(['established']));
 *
 * @example
 * // Include the full funnel including rough sketches
 * const { extractionHa } = filterByPhases(km, new Set(['sketch', 'preliminary', 'approved', 'established']));
 */
export function filterByPhases(
  km: {
    byPhase?: Partial<Record<KommunePhase, PhaseMetrics>>;
    nitrogenT: number;
    extractionHa: number;
  },
  phases: Set<KommunePhase>,
): { nitrogenT: number; extractionHa: number } {
  if (!km.byPhase) {
    // No phase data — fall back to top-level totals (projectDetails only, no sketch)
    return { nitrogenT: km.nitrogenT, extractionHa: km.extractionHa };
  }
  let nitrogenT = 0;
  let extractionHa = 0;
  for (const phase of phases) {
    const p = km.byPhase[phase];
    if (p) {
      nitrogenT += p.nitrogenT ?? 0;
      extractionHa += p.extractionHa ?? 0;
    }
  }
  return { nitrogenT, extractionHa };
}
