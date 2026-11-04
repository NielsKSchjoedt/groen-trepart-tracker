import type { PillarId } from './pillars';

/**
 * Shared display mode for the "Forstå projekterne" chapter. All project
 * visualisations (funnel, phase breakdown, activity chart, initiative type)
 * react to the same mode so the reader can compare the same projects either
 * by their count or by their physical size/effect.
 */
export type MetricMode = 'count' | 'area';

export interface PillarMetricConfig {
  /** Field on a project carrying the pillar's area/effect value */
  marsField: 'nitrogenT' | 'extractionHa' | 'afforestationHa' | 'areaHa';
  /** Unit shown next to area/effect values, e.g. "ha" or "ton N" */
  unit: string;
  /**
   * Label for the "area" option in the global toggle. For most pillars this is
   * an area ("Areal (ha)"), but for nitrogen the meaningful quantity is the
   * reduction effect ("Effekt (ton N)").
   */
  areaToggleLabel: string;
  /** Decimals to show for area/effect values */
  decimals: number;
}

/**
 * Per-pillar configuration for the area/effect display mode. CO₂ has no
 * project pipeline, so it uses a harmless stub that is never rendered.
 */
export const PILLAR_METRIC_CONFIG: Record<PillarId, PillarMetricConfig> = {
  nitrogen: { marsField: 'nitrogenT', unit: 'ton N', areaToggleLabel: 'Effekt (ton N)', decimals: 1 },
  extraction: { marsField: 'extractionHa', unit: 'ha', areaToggleLabel: 'Areal (ha)', decimals: 0 },
  afforestation: { marsField: 'afforestationHa', unit: 'ha', areaToggleLabel: 'Areal (ha)', decimals: 0 },
  nature: { marsField: 'areaHa', unit: 'ha', areaToggleLabel: 'Areal (ha)', decimals: 0 },
  co2: { marsField: 'areaHa', unit: 'ha', areaToggleLabel: 'Areal (ha)', decimals: 0 },
};

/**
 * Resolve the area/effect field + unit for a pillar. Falls back to the
 * nitrogen config for safety if an unknown id is passed.
 *
 * @example getPillarMetricConfig('extraction') // { marsField: 'extractionHa', unit: 'ha', ... }
 */
export function getPillarMetricConfig(pillarId: PillarId): PillarMetricConfig {
  return PILLAR_METRIC_CONFIG[pillarId] ?? PILLAR_METRIC_CONFIG.nitrogen;
}
