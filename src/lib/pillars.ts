import { createContext, useContext } from 'react';
import type { Animal } from '@/components/NatureWatermark';

export type PillarId = 'nitrogen' | 'extraction' | 'afforestation' | 'co2' | 'nature';

/**
 * Configuration for a single pillar of the Green Tripartite agreement.
 * Drives all downstream rendering: cards, map coloring, detail panel, theming.
 */
export interface PillarConfig {
  id: PillarId;
  /** Danish display name shown on cards and headers */
  label: string;
  /** Short Danish description for the pillar */
  description: string;
  /** National target value, or null if no numeric target exists */
  target: number | null;
  /** Unit label for values (e.g. "ton N/år", "ha") */
  unit: string;
  /** Deadline year for achieving the target */
  deadlineYear: number;
  /** Whether this pillar has numeric progress data */
  hasData: boolean;
  /** Whether per-catchment/plan geographic data exists for map coloring */
  hasGeoBreakdown: boolean;
  /** Whether the catchment/coastal layer toggle is shown */
  hasMultipleLayers: boolean;
  /**
   * Which geographic layer to show by default.
   * 'catchments' = 23 vandoplande (river basins)
   * 'coastal' = 37 kystvandsoplande (coastal water plans where projects live)
   * Only matters when hasMultipleLayers is false (fixed layer) or as
   * the default when hasMultipleLayers is true.
   */
  defaultLayer: 'catchments' | 'coastal';
  /** Primary accent color for this pillar (hex) */
  accentColor: string;
  /** Field name on Catchment objects used for map choropleth coloring */
  catchmentDataField: string;
  /** Field name on Plan objects used for coastal water coloring */
  planDataField: string;
  /** Danish stub message for pillars without data */
  stubMessage?: string;
  /** Thematic animal silhouettes for this pillar */
  watermarks: Animal[];
  /** Subtle page background tint when this pillar is active */
  backgroundTint: string;
}

export const PILLAR_CONFIGS: PillarConfig[] = [
  {
    id: 'nitrogen',
    label: 'Kvælstof',
    description: 'Kvælstofreduktion i vandmiljøet',
    target: 12776,
    unit: 'ton N/år',
    deadlineYear: 2027,
    hasData: true,
    hasGeoBreakdown: true,
    hasMultipleLayers: true,
    defaultLayer: 'coastal',
    accentColor: '#0d9488',
    catchmentDataField: 'nitrogenAchievedT',
    planDataField: 'nitrogenProgressPct',
    watermarks: ['fish', 'flounder', 'seatrout', 'cod', 'eel', 'seal', 'crab', 'seaweed', 'shrimp'],
    backgroundTint: 'hsl(192 35% 95.5%)',
  },
  {
    id: 'extraction',
    label: 'Lavbundsarealer',
    description: 'Udtag af kulstofrige lavbundsjorde',
    target: 140000,
    unit: 'ha',
    deadlineYear: 2030,
    hasData: true,
    hasGeoBreakdown: true,
    hasMultipleLayers: false,
    defaultLayer: 'coastal',
    accentColor: '#a16207',
    catchmentDataField: 'extractionAchievedHa',
    planDataField: 'extractionAchievedHa',
    watermarks: ['heron', 'dragonfly', 'eel', 'crab', 'seaweed', 'flounder'],
    backgroundTint: 'hsl(35 40% 95%)',
  },
  {
    id: 'afforestation',
    label: 'Skovrejsning',
    description: 'Ny skov plantet',
    target: 250000,
    unit: 'ha',
    deadlineYear: 2045,
    hasData: true,
    hasGeoBreakdown: true,
    hasMultipleLayers: false,
    defaultLayer: 'coastal',
    accentColor: '#15803d',
    catchmentDataField: 'afforestationAchievedHa',
    planDataField: 'afforestationAchievedHa',
    watermarks: ['deer', 'fox', 'rabbit', 'owl', 'hedgehog', 'bee'],
    backgroundTint: 'hsl(140 30% 95%)',
  },
  {
    id: 'co2',
    label: 'CO₂',
    description: 'Drivhusgasudledning — 70% reduktion inden 2030',
    target: 70,
    unit: '% reduktion',
    deadlineYear: 2030,
    hasData: true,
    hasGeoBreakdown: false,
    hasMultipleLayers: false,
    defaultLayer: 'catchments',
    accentColor: '#737373',
    catchmentDataField: '',
    planDataField: '',
    watermarks: ['deer', 'butterfly', 'owl'],
    backgroundTint: 'hsl(0 0% 95%)',
    stubMessage: 'Ingen geografisk data for CO₂. Udledningerne spores ikke pr. vandopland — se KF25-fremskrivningen ovenfor for den nationale oversigt.',
  },
  {
    id: 'nature',
    label: 'Beskyttet natur',
    description: 'Beskyttet natur (Natura 2000, §3 m.fl.)',
    target: 20,
    unit: '% beskyttet',
    deadlineYear: 2030,
    hasData: true,
    hasGeoBreakdown: true,
    hasMultipleLayers: false,
    defaultLayer: 'catchments',
    accentColor: '#16a34a',
    catchmentDataField: 'naturePotentialAreaHa',
    planDataField: 'naturePotentialAreaHa',
    watermarks: ['butterfly', 'bee', 'dragonfly', 'hedgehog', 'deer', 'heron'],
    backgroundTint: 'hsl(145 28% 95.5%)',
  },
];

/**
 * Look up pillar config by id.
 *
 * @example
 * ```ts
 * const cfg = getPillarConfig('nitrogen');
 * console.log(cfg.label); // "Kvælstof"
 * ```
 */
export function getPillarConfig(id: PillarId): PillarConfig {
  const cfg = PILLAR_CONFIGS.find((p) => p.id === id);
  if (!cfg) throw new Error(`Unknown pillar: ${id}`);
  return cfg;
}

export interface PillarContextValue {
  /** null when the user is on the `/` overview page with no pillar selected */
  activePillar: PillarId | null;
  setActivePillar: (id: PillarId) => void;
  /**
   * Always a valid PillarConfig. When activePillar is null this is a neutral
   * fallback config — check activePillar directly before using pillar-specific fields.
   */
  config: PillarConfig;
}

export const PillarContext = createContext<PillarContextValue>({
  activePillar: null,
  setActivePillar: () => {},
  config: PILLAR_CONFIGS[0],
});

/**
 * Hook to access the active pillar state.
 *
 * @example
 * ```tsx
 * const { activePillar, setActivePillar, config } = usePillar();
 * ```
 */
export function usePillar(): PillarContextValue {
  return useContext(PillarContext);
}
