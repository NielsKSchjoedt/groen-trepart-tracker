/**
 * Pipeline scenarios represent cumulative progress if projects up to
 * a given phase were all implemented. Each level includes everything
 * below it:
 *
 * - `established`: Only physically built projects (default, most conservative)
 * - `approved`: Established + approved for construction
 * - `preliminary`: Established + approved + preliminary investigation granted
 * - `all`: All phases including sketches — uses MARS aggregated totals
 *
 * Each scenario holds the achieved value and derived progress percentage
 * for nitrogen, extraction, and afforestation.
 */
export type PipelineScenarioKey = 'established' | 'approved' | 'preliminary' | 'all';

export interface PipelineScenarioValues {
  nitrogenAchievedT: number;
  nitrogenProgressPct: number;
  extractionAchievedHa: number;
  extractionProgressPct: number;
  afforestationAchievedHa: number;
  afforestationProgressPct: number;
}

export interface DashboardData {
  fetchedAt: string;
  national: {
    targets: {
      nitrogenReductionT: number;
      extractionHa: number;
      afforestationHa: number;
      protectedNaturePct: number;
      deadline: string;
      forestDeadline: string;
    };
    progress: {
      nitrogenAchievedT: number;
      nitrogenProgressPct: number;
      extractionAchievedHa: number;
      extractionProgressPct: number;
      afforestationAchievedHa: number;
      afforestationProgressPct: number;
      /** MARS afforestation only (without supplementary sources) */
      afforestationMarsHa: number;
      /** Klimaskovfonden supplementary afforestation */
      afforestationSupplementaryHa: number;
      naturePotentialAreaHa: number;
      /** Combined protected nature estimate as % of Danish land area */
      natureProtectedPct: number;
      /** Natura 2000 terrestrial coverage as % of land */
      natura2000TerrestrialPct: number;
      /** §3 protected nature as % of land */
      section3Pct: number;
    };
    /** Cumulative pipeline scenarios (established-only, +approved, +preliminary) */
    pipelineScenarios: Record<PipelineScenarioKey, PipelineScenarioValues>;
    projects: {
      total: number;
      sketches: number;
      assessed: number;
      approved: number;
      established: number;
    };
  };
  plans: Plan[];
  catchments: Catchment[];
  mitigationMeasures: MitigationMeasure[];
  subsidySchemes: SubsidyScheme[];
}

/** Per-phase metric breakdown (established / approved / preliminary). */
export interface PhaseBreakdown {
  established: number;
  approved: number;
  preliminary: number;
}

export interface Plan {
  id: string;
  name: string;
  geoLocationId: string;
  nameNormalized: string;
  nitrogenGoalT: number;
  /** MARS aggregate across ALL project phases (not just established) */
  nitrogenAchievedT: number;
  nitrogenProgressPct: number;
  nitrogenByPhase: PhaseBreakdown;
  extractionPotentialHa: number;
  /** MARS aggregate across ALL project phases */
  extractionAchievedHa: number;
  extractionByPhase: PhaseBreakdown;
  afforestationAchievedHa: number;
  afforestationByPhase: PhaseBreakdown;
  naturePotentialAreaHa: number;
  countNaturePotentials: number;
  projects: ProjectCounts;
  status: string;
  projectDetails: ProjectDetail[];
  sketchProjects: SketchProject[];
  naturePotentials: NaturePotential[];
}

export interface Catchment {
  id: string;
  name: string;
  geoLocationId: string;
  nameNormalized: string;
  nitrogenAchievedT: number;
  extractionAchievedHa: number;
  afforestationAchievedHa: number;
  naturePotentialAreaHa: number;
  countNaturePotentials: number;
  projects: ProjectCounts;
}

export interface ProjectCounts {
  sketches: number;
  assessed: number;
  approved: number;
  established: number;
}

// Individual MARS project enriched with master-data lookups
export interface ProjectDetail {
  id: string;
  name: string;
  geoId: string;
  phase: 'preliminary' | 'approved' | 'established';
  statusName: string;
  statusNr: number;
  measureName: string;
  schemeName: string;
  schemeOrg: string;
  schemeUrl: string;
  nitrogenT: number;
  extractionHa: number;
  afforestationHa: number;
  areaHa: number;
  appliedAt: string;
  lastChanged: string;
}

// Early-stage sketch project (no formal MARS status yet)
export interface SketchProject {
  id: string;
  name: string;
  geoId: string;
  phase: 'sketch';
  measureName: string;
  schemeName: string;
  schemeOrg: string;
  nitrogenT: number;
  extractionHa: number;
  afforestationHa: number;
  areaHa: number;
}

// Nature restoration potential site
export interface NaturePotential {
  id: string;
  name: string;
  areaHa: number;
  biodiversityHa: number;
  protectedNatureHa: number;
  section3Ha: number;
  natura2000Ha: number;
}

export interface MitigationMeasure {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface SubsidyScheme {
  id: string;
  name: string;
  organization: string;
  url: string;
  active: boolean;
}

// ============================================================
// Klimaskovfonden — voluntary afforestation projects (WFS)
// ============================================================

/** A single Klimaskovfonden project fetched from WFS. */
export interface KlimaskovfondenProject {
  /** Case number (e.g. "2024-99") */
  sagsnummer: string;
  /** Batch/year (e.g. "2024-5") */
  aargang: string;
  /** Extracted year (e.g. 2024) */
  year: number | null;
  /** "Skovrejsning" (afforestation) or "Lavbund" (lowland) */
  projekttyp: string;
  /** Computed area in hectares from polygon geometry */
  areaHa: number;
  /** Centroid [lon, lat] */
  centroid: [number, number];
  /** Municipality name from DAWA reverse geocoding (e.g. "Vejle") */
  kommune: string | null;
}

/** Naturstyrelsen state afforestation project matched from MiljøGIS WFS. */
export interface NaturstyrelsenSkovProject {
  /** Display name from Naturstyrelsen website */
  name: string;
  /** Name as it appears in the WFS layer (null if not matched) */
  wfsSkovnavn: string | null;
  /** NST district (e.g. "Himmerland", "Fyn") */
  district: string | null;
  /** NST district code (e.g. "HIM") */
  districtCode: string | null;
  /** Precise area from WFS polygon geometry in hectares (null if not matched) */
  areaHa: number | null;
  /** "ongoing" or "completed" */
  status: 'ongoing' | 'completed';
  /** URL to project page on naturstyrelsen.dk */
  url: string;
  /** Centroid [lon, lat] in WGS84 (null if not matched) */
  centroid: [number, number] | null;
  /** WFS feature ID (null if not matched) */
  wfsId: string | null;
}

// ============================================================
// Project changelog — recent status changes for the news ticker
// ============================================================

/** A single project status change detected during ETL. */
export interface ChangelogEntry {
  /** ISO date of the change (YYYY-MM-DD) */
  date: string;
  /** Project name */
  name: string;
  /** MARS project ID */
  projectId: string;
  /** Plan (kystvandoplandsplan) the project belongs to */
  planName: string;
  /** New phase after the change */
  phase: 'preliminary' | 'approved' | 'established';
  /** Danish label for the phase */
  phaseLabelDa: string;
  /** Mitigation measure type */
  measureName: string;
  /** Numeric effects (only if > 0) */
  nitrogenT?: number;
  extractionHa?: number;
  afforestationHa?: number;
  areaHa?: number;
}

/** Top-level changelog artifact produced by the ETL. */
export interface ProjectChangelog {
  /** When the changelog was generated */
  builtAt: string;
  /** How many days back the changelog covers */
  windowDays: number;
  /** Total number of changes in the window */
  totalChanges: number;
  /** Summary counts by phase */
  summary: {
    preliminary: number;
    approved: number;
    established: number;
  };
  /** Changes grouped by date (newest first), each date's entries sorted by name */
  byDate: { date: string; entries: ChangelogEntry[] }[];
}

// Coastal water ecological status from VP3 (EU Water Framework Directive)
export type EcologicalStatus = 'Høj' | 'God' | 'Moderat' | 'Ringe' | 'Dårlig' | 'Ikke-god' | 'Ukendt' | 'Ikke relevant';

export interface CoastalWaterEntry {
  ovId: string;
  mstId: number;
  district: string;
  mainCatchment: string;
  areaKm2: number;
  waterType: string;
  natureStatus: string;
  ecologicalStatus: EcologicalStatus;
  ecologicalStatusRank: number;
  ecologicalGoal: EcologicalStatus;
  chemicalStatus: string;
  subIndicators: {
    phytoplankton: EcologicalStatus;
    angiosperms: EcologicalStatus;
    benthicFauna: EcologicalStatus;
    macroalgae: EcologicalStatus;
    nationalSubstances: EcologicalStatus;
    oxygenConditions: EcologicalStatus;
    lightConditions: EcologicalStatus;
  };
}

export interface CoastalWaterStatusData {
  source: string;
  sourceUrl: string;
  fetchedAt: string;
  summary: {
    total: number;
    ecologicalStatus: Record<string, number>;
    chemicalStatus: Record<string, number>;
  };
  waters: Record<string, CoastalWaterEntry>;
}

// CO₂ emissions data from KF25 (Klimastatus og -fremskrivning 2025)
export interface CO2EmissionsData {
  source: string;
  sourceUrl: string;
  unit: string; // "mio_ton_co2e"
  years: number[];
  sectors: {
    energy: number[];
    industry: number[];
    agriculture: number[];
    lulucf: number[];
    waste: number[];
  };
  totals: {
    exclLulucf: number[];
    inclLulucf: number[];
  };
  targets: {
    baseline1990ExclLulucf: number;
    target2030ExclLulucf: number;
    reductionPct: number;
  };
  agricultureBreakdown: {
    entericFermentation: number[];
    manureManagement: number[];
    agriculturalSoils: number[];
  };
  lulucfBreakdown: {
    forestLand: number[];
    cropland: number[];
    grassland: number[];
    wetlands: number[];
  };
  milestones: {
    lastHistoricYear: number;
    reduction2023Pct: number;
    reduction2025Pct: number;
    reduction2030Pct: number;
    reduction2035Pct: number;
    totalExcl2023: number;
    totalExcl2030: number;
    agriculture2023: number;
    agriculture2030: number;
    lulucf2023: number;
    lulucf2030: number;
  };
}
