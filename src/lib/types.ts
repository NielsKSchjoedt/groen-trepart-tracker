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
  /** Defaults to true. Set false for sub-budgets already included in an umbrella line. */
  includeInTotal?: boolean;
  arealMaalHa?: number;
  periode?: string;
  deadlineYear?: number;
  noter?: string;
}

export interface FinansieringSatser {
  [key: string]: number | string | undefined;
  noter?: string;
}

export interface FinansieringStroemInstrument {
  label: string;
  amount: string;
  note?: string;
  privat?: boolean;
}

export interface FinansieringStroemBreakdown {
  label: string;
  amount: number;
  note?: string;
}

export interface FinansieringStroemContext {
  label: string;
  amount: string;
  note?: string;
}

export interface FinansieringStroem {
  id: 'anlaeg' | 'kapacitet' | 'drift';
  kicker: string;
  title: string;
  subtitle?: string;
  tone: 'green' | 'teal' | 'red';
  hero: string;
  heroUnit?: string;
  heroNote: string;
  who: string;
  instruments?: FinansieringStroemInstrument[];
  breakdown?: FinansieringStroemBreakdown[];
  context?: FinansieringStroemContext[];
  keyPoint: string;
  flow: [string, string, string];
  source: { label: string; url?: string };
  listNote?: string;
  contextLabel?: string;
}

export interface FinansieringKategori {
  id: string;
  kategori: 'lavbund' | 'kvaelstof' | 'skovrejsning' | 'natur' | 'co2';
  label: string;
  kilder: FinansieringKilde[];
  satser?: FinansieringSatser;
  driftFinansieringMioKr: number | null;
  /** Optional badge for delmål detail (e.g. EU coverage) */
  badge?: string;
  /** ETL: established ha (lavbund+KSF or skov total) / areal where applicable */
  realiseringHa?: number;
  realiseringTonN?: number;
}

export interface BudgetData {
  _meta: { kilde: string; opdateret: string };
  /** Lag 1 — tværgående pengestrømme (anlæg, kapacitet, drift) */
  stroemme?: FinansieringStroem[];
  kategorier: FinansieringKategori[];
}

export type KlimaraadetRisiko = 'Lav' | 'Moderat' | 'Væsentlig' | 'Høj';

export interface KlimaraadetVurdering {
  risiko: KlimaraadetRisiko;
  citat: string;
  ekstraUdledningTons: number | null;
}

export interface KlimaraadetTrepartBaggrundsnotat {
  title: string;
  url: string;
  publiceret: string;
  lokalFil?: string;
  kvantitative: {
    lavbundRealiseretVedNuvAfgiftHa: number;
    lavbundRealiseretVedAnbefaletAfgiftHa: number;
    nuvAfgiftKrPrTon: number;
    anbefaletAfgiftKrPrTon: number;
    frafaldsrate: number;
    tilsagnsBehovFor140kHa: number;
    midlertidigEkstensiveringKrHaAar?: number;
    afgiftsbelastningVed40KrKrHaAar?: number;
    skovMinusOmraadeAndel?: {
      udenMaalretning: number;
      medKvaelstofMaalretning: number;
    };
    uroertSkovTilskudKrHa?: number;
    produktionsskovJordvaerdiKrHa?: [number, number];
    uroertSkovJordvaerdiKrHa?: number;
    fosforfrigivelseKgHaAar?: [number, number];
  };
}

export interface KlimaraadetData {
  rapportTitle: string;
  publiceret: string;
  url: string;
  vurderinger: Partial<Record<PillarId, KlimaraadetVurdering>>;
  baggrundsnotatTrepart?: KlimaraadetTrepartBaggrundsnotat;
  _meta?: { sourcePdfUrl?: string; lastChecked?: string };
}

export interface Kf26SkovProfileYear {
  year: number;
  stateOrdinaryHa: number;
  stateUntouchedGtpHa: number;
  privateSubsidyCapHa: number;
  privateSubsidyGtpOrdinaryHa: number;
  privateSubsidyGtpUntouchedHa: number;
  klimaskovfondenHa: number;
  totalNewInitiativesHa: number;
  cumulativeNewInitiativesHa: number;
}

export interface Kf26TrepartData {
  _meta?: {
    builtAt?: string;
    sourcePageUrl?: string;
    inputFiles?: string[];
    notes?: string[];
  };
  publishedAt: string;
  version: string;
  status: string;
  sourceUrl: string;
  targetsAndHorizons: {
    politicalExtractionDeadline: string;
    kf26ExtractionProjectAreaHorizon: string;
    kf26ExtractionCarbonRichHorizon: string;
    politicalAfforestationDeadline: string;
    kf26AfforestationRealizationHorizon: string;
    extractionProjectAreaTargetHa: number;
    extractionAgriculturalAreaApproxHa: number;
    extractionCarbonRichAgriculturalSoilTargetHa: number;
    afforestationPoliticalTargetHa: number;
    afforestationKf26ImkHa: number;
    untouchedForestTargetWithinTrepartHa: number;
  };
  lavbundStatusDec2025: {
    underUdtagningHa: number;
    forundersoegelsestilsagnHa: number;
    vkpRunde3ForundersoegelseHa: number;
    vkpRunde3EtableringHa: number;
    definitionNote: string;
    source: { file: string; section: string };
  };
  assumptions: {
    lavbundNPlusYears: number;
    lavbundDropoutRateRange: [number, number];
    stateAfforestationRealization: string;
    privateAfforestationRealization: string;
    forestMineralSoilCarbonBindingYearsKf26: number;
    forestMineralSoilCarbonBindingYearsKf25: number;
    forestNetEffectIncrease2030MtCo2eVsKf25: number;
    forestNetEffectIncrease2035MtCo2eVsKf25: number;
  };
  skovProfilPerYear: Kf26SkovProfileYear[];
  skovProfilSummary: {
    sumNewInitiativesHa: number;
    roundedKf26ImkHa: number;
    politicalTargetHa: number;
    source: { file: string; table: string };
    roundingNote: string;
  };
  landbrug2030Goal: {
    sectorReductionPctKf26: number;
    lowerTargetPct: number;
    upperTargetPct: number;
    gapToLowerTargetMtCo2e: number;
    gapToUpperTargetMtCo2e: number;
    source: { file?: string; url?: string; section: string };
  };
  co2Headline: {
    target2030MarginMtCo2e: number;
    kf25Target2030MarginMtCo2e: number;
    source: { file?: string; url?: string; section: string };
  };
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
  /** Lowland extraction area (ha) from Klimaskovfonden lavbund projects */
  extractionKsfHa?: number;
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
  driftFinansiering?: DriftFinansiering;
  national: {
    targets: {
      nitrogenReductionT: number;
      extractionHa: number;
      afforestationHa: number;
      protectedNaturePct: number;
      deadline: string;
      forestDeadline: string;
      extractionRealiseringHorisont?: string;
      extractionKulstofrigHa?: number;
      extractionKulstofrigDeadline?: string;
      forestKf26RealizationHorizon?: string;
      uroertSkovHa?: number;
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
      /** Klimaskovfonden skovrejsning (WFS) */
      afforestationKsfHa?: number;
      afforestationKsfProjectCount?: number;
      /** Naturstyrelsen skov — gennemført and i gang */
      afforestationNstCompletedHa?: number;
      afforestationNstOngoingHa?: number;
      afforestationNstMatchedCount?: number;
      /** Klimaskovfonden lavbund (WFS) */
      extractionKsfLavbundHa?: number;
      extractionKsfLavbundCount?: number;
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
    kf26?: Kf26TrepartData;
    byPipelinePhase?: ByPipelinePhaseRoot;
    cancelled?: CancelledMetrics;
    byOwnerOrg?: Record<string, { count: number; ha: number; byPipelinePhase: ByPipelinePhaseRoot }>;
  };
  driftFinansiering?: DriftFinansiering;
  plans: Plan[];
  catchments: Catchment[];
  mitigationMeasures: MitigationMeasure[];
  subsidySchemes: SubsidyScheme[];
}

/** Per-phase metric totals (established / approved / preliminary) — plan-level byPhase keys. */
export interface LegacyPhaseTotals {
  established: number;
  approved: number;
  preliminary: number;
}

// --- Sprint 2: DN 5-fase model (MARS stateNr) ---

export type PipelinePhaseType =
  | 'sketch'
  | 'preliminary_grant'
  | 'preliminary_done'
  | 'establishment_grant'
  | 'established'
  | 'cancelled';

export type PipelineMainPhase = Exclude<PipelinePhaseType, 'cancelled'>;

export interface PipelinePhaseMetricsRow {
  count: number;
  nitrogenT: number;
  extractionHa: number;
  afforestationHa: number;
  subStates?: {
    kladde: Omit<PipelinePhaseMetricsRow, 'subStates'>;
    ansoegt: Omit<PipelinePhaseMetricsRow, 'subStates'>;
  };
}

export type PipelinePhaseBreakdown = Record<PipelineMainPhase, PipelinePhaseMetricsRow>;

export type ByPipelinePhaseRoot = {
  nitrogen: PipelinePhaseBreakdown;
  extraction: PipelinePhaseBreakdown;
  afforestation: PipelinePhaseBreakdown;
};

export interface CancelledMetrics {
  totalCount: number;
  totalHa: number;
  byCancellationStage: {
    preliminary: { count: number; ha: number };
    establishment: { count: number; ha: number };
  };
  byReason: {
    opgivet: { count: number; ha: number };
    afslag: { count: number; ha: number };
  };
}

export interface VandNaturSkovProjekt {
  id?: string | number;
  type?: string;
  navn?: string;
  kommune?: string | null;
  kommuneKode?: string | null;
  arealHa?: number | null;
  ordning?: string;
  kilde?: string;
  fetchedAt?: string;
  [key: string]: unknown;
}

export type OwnerOrgKey = 'NST' | 'SGAV' | 'LBST' | 'unknown';

export interface DriftFinansiering {
  afsat: boolean;
  status: string;
  label: string;
  sources: string[];
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
  nitrogenByPhase: LegacyPhaseTotals;
  extractionPotentialHa: number;
  /** MARS aggregate across ALL project phases */
  extractionAchievedHa: number;
  extractionByPhase: LegacyPhaseTotals;
  afforestationAchievedHa: number;
  afforestationByPhase: LegacyPhaseTotals;
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
  /** MARS 5-fase nøgle (Sprint 2) */
  pipelinePhase?: PipelinePhaseType;
  isCancelled?: boolean;
  projectType?: string;
  forvaltningsplanStatus?: 'unknown' | string | null;
  statusName: string;
  statusNr: number;
  measureName: string;
  /** Subsidy scheme id — join key to SubsidyScheme for prose details */
  schemeId?: string;
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
  /** All kommuner whose boundary intersects the project polygon (for map linking). */
  overlappingKommuneKoder?: string[];
}

// Early-stage sketch project (no formal MARS status yet)
export interface SketchProject {
  id: string;
  name: string;
  geoId: string;
  phase: 'sketch';
  pipelinePhase?: 'sketch';
  sketchSubState?: 'kladde' | 'ansoegt';
  measureName: string;
  projectType?: string;
  forvaltningsplanStatus?: 'unknown' | string | null;
  /** Subsidy scheme id — join key to SubsidyScheme for prose details */
  schemeId?: string;
  schemeName: string;
  schemeOrg: string;
  nitrogenT: number;
  extractionHa: number;
  afforestationHa: number;
  areaHa: number;
  /** 4-digit municipality code for primary overlap (largest clipped share). */
  kommuneKode?: string | null;
  kommuneNavn?: string | null;
  overlappingKommuneKoder?: string[];
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
  /** Mitigation measure this scheme belongs to (MARS master-data) */
  mitigationMeasureId?: string;
  /** Prose explanation of the scheme's purpose (from MARS master-data) */
  description?: string;
  /** Prose explanation of who can apply for / undertake the scheme */
  applicantText?: string;
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

// ============================================================
// Sprint 4 — Kommune nature benchmark (B1/B2/B3 + simulation)
// ============================================================

export interface KommuneBenchmarkMetadata {
  generatedAt: string;
  methodVersion: string;
  sourceLayers: { name: string; path: string; hash?: string }[];
  disclaimer?: string;
}

export interface KommuneBenchmarkB1Row {
  kommuneNavn: string;
  dce30Ha: number;
  dce30PctOfNational: number;
  kuPrio1Ha: number;
  kuPrio1PctOfNational: number;
  kuPrio2Ha: number;
  kuPrio2PctOfNational: number;
}

export interface KommuneBenchmarkB2Row {
  kommuneNavn: string;
  markerTotalHa: number;
  hoejtPotentialeHa: number;
  lavtPotentialeHa: number;
  udenforPotentialeHa: number;
  hoejtPotentialePct: number;
  lavtPotentialePct: number;
  udenforPotentialePct: number;
}

export interface KommuneBenchmarkB3Row {
  kommuneNavn: string;
  n2000TotalHa: number;
  n2000ErLandbrugHa: number;
  andelLandbrugIN2000Pct: number | null;
}

export interface KommuneBenchmarkB4Row {
  kommuneNavn: string;
  naturvaerdiHa: number;
  beskyttetHa: number;
  overlapHa: number;
  vaerdiUdenBeskyttelseHa: number;
  pctVaerdiBeskyttet: number;
}

export interface KommuneBenchmarkB4Data {
  methodVersion: string;
  generatedAt: string;
  sources: { name: string; path: string; hash?: string }[];
  disclaimer?: string;
  national: {
    naturvaerdiHa: number;
    beskyttetHa: number;
    overlapHa: number;
    vaerdiUdenBeskyttelseHa: number;
    pctVaerdiBeskyttet: number;
  };
  byKommune: Record<string, KommuneBenchmarkB4Row>;
}

export interface KommuneBenchmarkData {
  b1: {
    metadata: KommuneBenchmarkMetadata;
    national: { totalDce30Ha: number; totalKuPrio1Ha: number; totalKuPrio2Ha: number };
    byKommune: Record<string, KommuneBenchmarkB1Row>;
  };
  b2: {
    metadata: KommuneBenchmarkMetadata;
    national: {
      markerTotalHa: number;
      hoejtPotentialeHa: number;
      lavtPotentialeHa: number;
      udenforPotentialeHa: number;
    };
    byKommune: Record<string, KommuneBenchmarkB2Row>;
  };
  b3: {
    metadata: KommuneBenchmarkMetadata;
    national: { n2000TotalHa: number; n2000ErLandbrugHa: number; andelLandbrugIN2000Pct: number };
    byKommune: Record<string, KommuneBenchmarkB3Row>;
  };
  b4: KommuneBenchmarkB4Data | null;
}

export interface NationalFordelingRow {
  kommuneNavn: string;
  basis: 'dce30PctOfNational';
  dce30PctOfNational: number;
  simulatedSkovHa: number;
  actualSkovHa: number;
  skovDifferenceHa: number;
  simulatedLavbundHa: number;
  actualLavbundHa: number;
  lavbundDifferenceHa: number;
}

export interface NationalFordelingSimulation {
  metadata: KommuneBenchmarkMetadata;
  national: { skovTargetHa: number; lavbundTargetHa: number };
  byKommune: Record<string, NationalFordelingRow>;
}

/** Precomputed rank (1–98) per competition axis. */
export type KommuneRankingMetricKey =
  | 'idxLavbund'
  | 'idxSkov'
  | 'idxKvaelstof'
  | 'kvalitetGapPct'
  | 'leveretHa';

export interface KommuneRankingRow {
  kode: string;
  kommuneNavn: string;
  region: string;
  ansvarPct: number;
  ansvarKuPrio1Pct: number;
  ansvarKuPrio2Pct: number;
  leveringUdtagningPct: number | null;
  leveringSkovPct: number | null;
  leveringKvaelstofPct: number | null;
  idxLavbund: number | null;
  idxSkov: number | null;
  idxKvaelstof: number | null;
  kvalitetGapPct: number | null;
  markerHoejtPotentialePct: number;
  /** Project × DCE biodiversity-map overlap (ha), kommune-clipped (no double-count). Headline natur-signal. */
  projektNaturBiodiversitetHa?: number;
  projektNaturSection3Ha?: number;
  projektNaturNatura2000Ha?: number;
  projektNaturAreaHa?: number;
  leveretHa: number;
  deliveryExtractionHa: number;
  deliverySkovHa: number;
  deliveryKvaelstofT: number;
  co2T: number;
  projekterTotal: number;
  rankByMetric: Partial<Record<KommuneRankingMetricKey, number>>;
}

export interface KommuneRankingNationalPhase {
  extractionHa: number;
  afforestationHa: number;
  nitrogenT: number;
  count: number;
  sharePct: number;
}

export interface KommuneRankingData {
  metadata: KommuneBenchmarkMetadata & {
    rankingPhases: string[];
    ansvarBasis: string;
    disclaimer: string;
  };
  national: {
    deliveryExtractionHa: number;
    deliverySkovHa: number;
    deliveryKvaelstofT: number;
    leveretHa: number;
    phaseShareHa: Record<string, KommuneRankingNationalPhase>;
  };
  byKommune: Record<string, KommuneRankingRow>;
  kommuner: KommuneRankingRow[];
}

/** Sprint 6 — kommune × coastal water / catchment overlap. */
export interface OplandOverlap {
  opId: string;
  opNavn: string;
  overlapHa: number;
  andelAfKommunePct: number;
  andelAfOplandPct: number;
  ecologicalStatus?: string;
}

export interface HovedoplandOverlap {
  hovId: string;
  hovNavn: string;
  andelAfKommunePct: number;
}

export interface KommuneOplandeEntry {
  kommuneNavn: string;
  kystvandsoplande: OplandOverlap[];
  hovedoplande: HovedoplandOverlap[];
  antalOplande: number;
  kystvandStatus: { opNavn: string; ecologicalStatus: string }[];
}

export interface KommuneOplandeData {
  metadata: KommuneBenchmarkMetadata;
  byKommune: Record<string, KommuneOplandeEntry>;
  byOpland: Record<
    string,
    {
      opNavn: string;
      kommuner: { kode: string; kommuneNavn: string; andelAfOplandPct: number }[];
    }
  >;
}

// -----------------------------------------------------------------------
// Kommune Grøn Trepart entry links — curated, verified
// Produced by scripts/build-trepart-links.mjs from
// data/kommune-trepart-links.csv. Served from
// public/data/kommune-trepart-links.json, keyed by kommune kode.
// -----------------------------------------------------------------------

/** One kommune's official Grøn Trepart entry page (or "Ingen fundet"). */
export interface KommuneTrepartLink {
  navn: string;
  /** Canonical entry-page URL on the kommune's own domain, or null if none found. */
  url: string | null;
  /** temaside | projektside | nyhedsoversigt | enkelt nyhed | ingen */
  sidetype: string;
  /** Whether the URL was confirmed to resolve and be about grøn trepart. */
  verified: boolean;
  note: string;
}

export interface KommuneTrepartLinksData {
  generatedAt: string;
  source: string;
  count: number;
  withPage: number;
  /** Keyed by kommune kode (e.g. "0461"). */
  links: Record<string, KommuneTrepartLink>;
}

/** Geographic neighbors (shared kommunegrænse) from DAWA polygons. */
export interface KommuneNeighborsData {
  builtAt: string;
  source: string;
  count: number;
  byKode: Record<string, string[]>;
  byNavn: Record<string, string[]>;
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

// ============================================================
// Per-project nature overlap (build_project_nature_overlap.py)
// Project polygons clipped to kommune boundaries (no double-count),
// intersected with the DCE 30 % biodiversity map (headline) + §3 + Natura 2000.
// NB: overlap = strong INDICATOR of nature potential, NOT a guarantee of
// realized/improved nature.
// ============================================================

/** One project's overlap attributed to a single kommune (its clipped piece). */
export interface ProjectNatureOverlapPiece {
  kode: string;
  kommuneNavn: string;
  projektAreaHa: number;
  biodiversitetHa: number;
  section3Ha: number;
  natura2000Ha: number;
}

/** One MARS project's nature overlap, split across the kommuner it touches. */
export interface ProjectNatureOverlap {
  geoId: string;
  projectId: string | null;
  projectName: string;
  measure: string;
  status: string | null;
  projektAreaHa: number;
  primaryKommuneKode: string;
  biodiversitetHa: number;
  section3Ha: number;
  natura2000Ha: number;
  perKommune: ProjectNatureOverlapPiece[];
}

/** Per-kommune aggregate of project nature overlap. */
export interface ProjectNatureOverlapKommune {
  kommuneNavn: string;
  projektAreaHa: number;
  biodiversitetHa: number;
  section3Ha: number;
  natura2000Ha: number;
  antalProjekter: number;
}

export interface ProjectNatureOverlapData {
  metadata: {
    methodVersion: string;
    generatedAt: string;
    headline: string;
    note: string;
    projectsWithGeometry: number;
    projectsWithOverlap: number;
    sources: string[];
  };
  byProject: Record<string, ProjectNatureOverlap>;
  byKommune: Record<string, ProjectNatureOverlapKommune>;
}
