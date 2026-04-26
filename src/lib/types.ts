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
import type { PillarId } from './pillars';

export type PipelineScenarioKey = 'established' | 'approved' | 'preliminary' | 'all';

// --- Sprint 1: initiator breakdown, budget, Klimarådet (ETL + UI) ---

export type InitiatorType = 'state' | 'municipal' | 'private';

export type InitiatorPhase = 'sketch' | 'preliminary' | 'approved' | 'established';

export interface InitiatorMetrics {
  /** For extraction/afforestation: ha. For nitrogen in ETL, ton N reuses the same field name for a uniform shape. */
  ha: number;
  projectCount: number;
}

export interface InitiatorBreakdown {
  state: InitiatorMetrics;
  municipal: InitiatorMetrics;
  private: InitiatorMetrics;
}

export interface ByInitiatorByPhaseEntry {
  extraction: InitiatorBreakdown;
  afforestation: InitiatorBreakdown;
  nitrogen: InitiatorBreakdown;
}

export interface ByInitiatorHa {
  extraction: InitiatorBreakdown;
  afforestation: InitiatorBreakdown;
  nitrogen: InitiatorBreakdown;
  byPhase: Record<InitiatorPhase, ByInitiatorByPhaseEntry>;
}

export interface FinansieringKilde {
  kildeNavn: string;
  kildeUrl?: string;
  beloebMioKr: number;
  arealMaalHa?: number;
  periode?: string;
  deadlineYear?: number;
  noter?: string;
}

export interface FinansieringSatser {
  [key: string]: number | string | undefined;
  noter?: string;
}

export interface FinansieringKategori {
  id: string;
  kategori: 'lavbund' | 'kvaelstof' | 'skovrejsning' | 'natur' | 'co2';
  label: string;
  kilder: FinansieringKilde[];
  satser?: FinansieringSatser;
  driftFinansieringMioKr: number | null;
  /** ETL: established ha (lavbund+KSF or skov total) / areal where applicable */
  realiseringHa?: number;
  realiseringTonN?: number;
}

export interface BudgetData {
  _meta: { kilde: string; opdateret: string };
  kategorier: FinansieringKategori[];
}

export type KlimaraadetRisiko = 'Lav' | 'Moderat' | 'Væsentlig' | 'Høj';

export interface KlimaraadetVurdering {
  risiko: KlimaraadetRisiko;
  citat: string;
  ekstraUdledningTons: number | null;
}

export interface KlimaraadetData {
  rapportTitle: string;
  publiceret: string;
  url: string;
  vurderinger: Partial<Record<PillarId, KlimaraadetVurdering>>;
  _meta?: { sourcePdfUrl?: string; lastChecked?: string };
}

export interface PipelineScenarioValues {
  nitrogenAchievedT: number;
  nitrogenProgressPct: number;
  extractionAchievedHa: number;
  extractionProgressPct: number;
  afforestationAchievedHa: number;
  afforestationProgressPct: number;
}

/**
 * Aggregated metrics for a single Danish municipality, derived from MARS
 * project data, Klimaskovfonden, and Naturstyrelsen sources.
 *
 * Produced by `etl/build_dashboard_data.py` and stored in
 * `dashboard-data.json → national.byKommune`.
 */
/** Per-phase metric breakdown for a single municipality. */
export interface KommunePhaseMetrics {
  nitrogenT: number;
  extractionHa: number;
  afforestationHa: number;
  count: number;
}

export interface KommuneMetrics {
  /** 4-digit municipality code from DAWA (e.g. "0461") */
  kode: string;
  /** Municipality name (e.g. "Odense") */
  navn: string;
  /** Region name (e.g. "Region Syddanmark") */
  region: string;
  /** Total nitrogen reduction (ton N) from MARS projects (all phases) */
  nitrogenT: number;
  /** Total lowland extraction area (ha) from MARS projects (all phases) */
  extractionHa: number;
  /** Afforestation area (ha) from MARS projects */
  afforestationMarsHa: number;
  /** Afforestation area (ha) from Klimaskovfonden projects */
  afforestationKsfHa: number;
  /** Afforestation area (ha) from Naturstyrelsen projects */
  afforestationNstHa: number;
  /** Combined afforestation from all three sources */
  afforestationTotalHa: number;
  /**
   * §3-protected nature area (ha) within this municipality.
   * Source: MiljøGIS WFS ais_par3 layer, centroid point-in-polygon assignment.
   */
  section3Ha: number;
  /**
   * Terrestrial Natura 2000 area (ha) assigned to this municipality.
   * Centroid-based assignment — sites spanning multiple municipalities are
   * attributed to the one containing the site centroid.
   */
  natura2000Ha: number;
  /**
   * Combined protected nature area (ha) = §3 + Natura 2000 terrestrial.
   * Note: the two sources overlap significantly; this is an additive estimate,
   * not a deduplicated figure. Use for relative comparison between municipalities.
   */
  naturePotentialHa: number;
  /**
   * Estimated CO₂ reduction (ton CO₂/year) for this municipality.
   * Currently 0 for all municipalities — CO₂ data from KF25 is only
   * available at national level and is not disaggregated per kommune.
   */
  co2EstimatedT: number;
  /** Total MARS project count (all phases) */
  projectCount: number;
  projectsByPhase: ProjectCounts;
  /**
   * MARS project metric breakdown by implementation phase.
   * Allows the frontend to compute totals for any selection of phases
   * without re-fetching data (e.g. show only established + approved).
   */
  byPhase: {
    sketch:      KommunePhaseMetrics;
    preliminary: KommunePhaseMetrics;
    approved:    KommunePhaseMetrics;
    established: KommunePhaseMetrics;
  };
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
    /** Per-kommune aggregated metrics — 98 entries, one per Danish municipality */
    byKommune: KommuneMetrics[];
    byInitiatorHa?: ByInitiatorHa;
    budgetData?: BudgetData;
    klimaraadet?: KlimaraadetData;
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
  projectDetails: ProjectDetail[];
  sketchProjects: SketchProject[];
  naturePotentials: NaturePotential[];
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
  /** 4-digit municipality code resolved via DAWA reverse geocoding (null if not resolved) */
  kommuneKode?: string | null;
  /** Municipality name resolved via DAWA reverse geocoding (null if not resolved) */
  kommuneNavn?: string | null;
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
  /** Municipality name resolved via DAWA reverse geocoding (null if not geocoded) */
  kommune: string | null;
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

// ============================================================
// Klimaregnskabet — per-municipality CO₂ emissions data
// Source: Energistyrelsen / klimaregnskabet.dk
// ============================================================

/** CO₂ emissions time series for a single Danish municipality (2018–2023). */
export interface KommuneCO2Data {
  /** 4-digit DAWA municipality code, e.g. "0101" */
  kommuneKode: string;
  kommuneNavn: string;
  /** Calendar years covered, e.g. [2018, 2019, 2020, 2021, 2022, 2023] */
  years: number[];
  /** Total CO₂e (ton) per year — Scope 1+2, all sectors */
  samletUdledning: number[];
  /** CO₂e per capita (ton/inhabitant) per year */
  udledningPrCapita: number[];
  /** Sector breakdown (ton CO₂e) per year */
  sektorer: {
    /** El og fjernvarme + brændsler (Energi) */
    energi: number[];
    transport: number[];
    landbrug: number[];
    /** Affaldsdeponi + spildevand combined */
    affald: number[];
    /** Kemiske processer / industriprocesser */
    industri: number[];
  };
  /** Renewable electricity self-sufficiency ratio (0–1) per year */
  veAndel: number[];
}

/** Top-level wrapper for the klimaregnskab-by-kommune.json data file. */
export interface KlimaregnskabData {
  source: string;
  sourceUrl: string;
  attribution: string;
  fetchedAt: string;
  latestYear: number;
  years: number[];
  nationalTotal: {
    year: number;
    samletUdledningTon: number;
  };
  kommuner: KommuneCO2Data[];
}

// -----------------------------------------------------------------------
// ETL run summary — produced by etl/build_etl_summary.py
// Served from public/data/etl-run-summary.json
// -----------------------------------------------------------------------

/** Status of a single source within one daily ETL run. */
export interface EtlSourceRun {
  status: 'ok' | 'partial' | 'error';
  /** MARS project count (source: mars) */
  projects?: number;
  /** MARS plan count (source: mars) */
  plans?: number;
  /** Municipality count (source: dawa or klimaregnskab) */
  municipalities?: number;
  /** Monitoring station count (source: vanda) */
  stations?: number;
  notes?: string;
}

/** Aggregated result for a single calendar day's ETL run. */
export interface EtlDailyRun {
  /** ISO date string, e.g. "2026-03-17" */
  date: string;
  /** ISO timestamp of the latest source fetch recorded for this day */
  runAt: string;
  /** Overall status — ok if all daily CI sources succeeded */
  status: 'ok' | 'partial' | 'error';
  /** Per-source outcomes, keyed by source name (mars, dawa, miljoegis, …) */
  sources: Record<string, EtlSourceRun>;
}

/** Top-level wrapper for public/data/etl-run-summary.json */
export interface EtlRunSummary {
  generatedAt: string;
  /** Last 30 daily runs, newest first */
  recentRuns: EtlDailyRun[];
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
