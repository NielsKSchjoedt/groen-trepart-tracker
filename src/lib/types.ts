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

export interface Plan {
  id: string;
  name: string;
  geoLocationId: string;
  nameNormalized: string;
  nitrogenGoalT: number;
  nitrogenAchievedT: number;
  nitrogenProgressPct: number;
  extractionPotentialHa: number;
  extractionAchievedHa: number;
  afforestationAchievedHa: number;
  naturePotentialAreaHa: number;
  countNaturePotentials: number;
  projects: ProjectCounts;
  status: string;
  // Drill-down detail arrays
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
