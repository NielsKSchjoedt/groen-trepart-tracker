export interface DashboardData {
  fetchedAt: string;
  national: {
    targets: {
      nitrogenReductionT: number;
      extractionHa: number;
      afforestationHa: number;
      deadline: string;
      forestDeadline: string;
    };
    progress: {
      nitrogenAchievedT: number;
      nitrogenProgressPct: number;
      extractionAchievedHa: number;
      extractionProgressPct: number;
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
  projects: ProjectCounts;
  status: string;
}

export interface Catchment {
  id: string;
  name: string;
  geoLocationId: string;
  nameNormalized: string;
  nitrogenAchievedT: number;
  extractionAchievedHa: number;
  afforestationAchievedHa: number;
  projects: ProjectCounts;
}

export interface ProjectCounts {
  sketches: number;
  assessed: number;
  approved: number;
  established: number;
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
  active: boolean;
}
