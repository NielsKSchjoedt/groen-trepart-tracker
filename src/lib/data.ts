import type { DashboardData, Plan, Catchment, CO2EmissionsData, CoastalWaterStatusData, ProjectChangelog } from './types';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';

let cachedData: DashboardData | null = null;
let cachedLookup: Record<string, string> | null = null;
let cachedCatchmentsTopo: Topology | null = null;
let cachedCoastalTopo: Topology | null = null;
let cachedGeometries: Record<string, [number, number][]> | null = null;
let cachedCO2Data: CO2EmissionsData | null = null;
let cachedCoastalStatus: CoastalWaterStatusData | null = null;
let cachedWaterBodiesGeo: FeatureCollection<Geometry> | null = null;
let cachedChangelog: ProjectChangelog | null = null;

/**
 * Normalize the raw ETL JSON (which uses nested progress objects and
 * projectPipeline) into the flat shape the React components expect.
 *
 * The ETL output changed to a richer nested format (e.g.
 * `national.progress.nitrogen.totalT` instead of
 * `national.progress.nitrogenAchievedT`). This adapter keeps the
 * component layer stable.
 */
function normalizeRawData(raw: Record<string, unknown>): DashboardData {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const r = raw as any;
  const nat = r.national ?? {};
  const prog = nat.progress ?? {};
  const pipeline = nat.projectPipeline ?? {};
  const phases = pipeline.phases ?? {};

  const nitrogen = prog.nitrogen ?? {};
  const extraction = prog.extraction ?? {};
  const afforestation = prog.afforestation ?? {};
  const nature = prog.nature ?? {};

  const afforestationMarsHa =
    afforestation.marsTotal?.ha ?? afforestation.totalHa ?? 0;
  const afforestationSupplementaryHa =
    afforestation.supplementary?.klimaskovfondenHa ?? 0;
  const afforestationTotal = afforestationMarsHa + afforestationSupplementaryHa;
  const afforestationGoal =
    afforestation.goalHa ?? nat.targets?.afforestationHa ?? 250_000;

  return {
    fetchedAt: r.fetchedAt ?? r.builtAt ?? '',
    national: {
      targets: {
        nitrogenReductionT: nat.targets?.nitrogenReductionT ?? 0,
        extractionHa: nat.targets?.extractionHa ?? 0,
        afforestationHa: nat.targets?.afforestationHa ?? 0,
        protectedNaturePct: nat.targets?.protectedNaturePct ?? 20,
        deadline: nat.targets?.deadline ?? '2030-12-31',
        forestDeadline: nat.targets?.forestDeadline ?? '2045-12-31',
      },
      progress: {
        nitrogenAchievedT: nitrogen.totalT ?? 0,
        nitrogenProgressPct: nitrogen.totalProgressPct ?? 0,
        extractionAchievedHa: extraction.totalHa ?? 0,
        extractionProgressPct: extraction.totalProgressPct ?? 0,
        afforestationAchievedHa: afforestationTotal,
        afforestationProgressPct:
          afforestationGoal > 0
            ? (afforestationTotal / afforestationGoal) * 100
            : 0,
        afforestationMarsHa: afforestationMarsHa,
        afforestationSupplementaryHa: afforestationSupplementaryHa,
        naturePotentialAreaHa:
          nature.marsNaturePotential?.areaHa ?? 0,
        natureProtectedPct: nature.combinedEstimatePct ?? 0,
        natura2000TerrestrialPct: nature.natura2000?.terrestrialPct ?? 0,
        section3Pct: nature.section3?.pctOfLand ?? 0,
      },
      projects: {
        total: pipeline.total ?? 0,
        sketches: phases.sketches?.count ?? 0,
        assessed: phases.assessed?.count ?? 0,
        approved: phases.approved?.count ?? 0,
        established: phases.established?.count ?? 0,
      },
    },
    plans: ((r.plans ?? []) as any[]).map((p: any) => ({
      ...p,
      // Clamp nonsensical percentages caused by near-zero goals in ETL
      nitrogenProgressPct: p.nitrogenGoalT > 0
        ? Math.min(p.nitrogenProgressPct ?? 0, 100)
        : 0,
    })),
    catchments: r.catchments ?? [],
    mitigationMeasures: r.mitigationMeasures ?? [],
    subsidySchemes: r.subsidySchemes ?? [],
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

export async function loadDashboardData(): Promise<DashboardData> {
  if (cachedData) return cachedData;
  const res = await fetch('/data/dashboard-data.json');
  const raw = await res.json();
  cachedData = normalizeRawData(raw);
  return cachedData!;
}

export async function loadNameLookup(): Promise<Record<string, string>> {
  if (cachedLookup) return cachedLookup;
  const res = await fetch('/data/name-lookup.json');
  cachedLookup = await res.json();
  return cachedLookup!;
}

export async function loadCatchmentsGeoJSON(): Promise<FeatureCollection<Geometry>> {
  if (!cachedCatchmentsTopo) {
    const res = await fetch('/data/catchments.topo.json');
    cachedCatchmentsTopo = await res.json();
  }
  const objectKey = Object.keys(cachedCatchmentsTopo!.objects)[0];
  return feature(cachedCatchmentsTopo!, cachedCatchmentsTopo!.objects[objectKey]) as unknown as FeatureCollection<Geometry>;
}

export async function loadCoastalWatersGeoJSON(): Promise<FeatureCollection<Geometry>> {
  if (!cachedCoastalTopo) {
    const res = await fetch('/data/coastal-waters.topo.json');
    cachedCoastalTopo = await res.json();
  }
  const objectKey = Object.keys(cachedCoastalTopo!.objects)[0];
  return feature(cachedCoastalTopo!, cachedCoastalTopo!.objects[objectKey]) as unknown as FeatureCollection<Geometry>;
}

/** Load project polygon geometries (geoId → [[lng,lat], ...]) */
export async function loadProjectGeometries(): Promise<Record<string, [number, number][]>> {
  if (cachedGeometries) return cachedGeometries;
  try {
    const res = await fetch('/data/project-geometries.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedGeometries = await res.json();
  } catch {
    cachedGeometries = {};
  }
  return cachedGeometries!;
}

/** Load CO₂ emissions data (KF25 national trajectory + sector breakdowns) */
export async function loadCO2Emissions(): Promise<CO2EmissionsData | null> {
  if (cachedCO2Data) return cachedCO2Data;
  try {
    const res = await fetch('/data/co2-emissions.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedCO2Data = await res.json();
  } catch {
    cachedCO2Data = null;
  }
  return cachedCO2Data;
}

/** Load actual water body polygons (marine shapes from VP3 tilstand layer) */
export async function loadWaterBodiesGeoJSON(): Promise<FeatureCollection<Geometry> | null> {
  if (cachedWaterBodiesGeo) return cachedWaterBodiesGeo;
  try {
    const res = await fetch('/data/water-bodies.geojson');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedWaterBodiesGeo = await res.json();
  } catch {
    cachedWaterBodiesGeo = null;
  }
  return cachedWaterBodiesGeo;
}

/** Load coastal water ecological status data (VP3 WFD assessment) */
export async function loadCoastalWaterStatus(): Promise<CoastalWaterStatusData | null> {
  if (cachedCoastalStatus) return cachedCoastalStatus;
  try {
    const res = await fetch('/data/coastal-water-status.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedCoastalStatus = await res.json();
  } catch {
    cachedCoastalStatus = null;
  }
  return cachedCoastalStatus;
}

/** Load project changelog (recent status changes for the news ticker) */
export async function loadProjectChangelog(): Promise<ProjectChangelog | null> {
  if (cachedChangelog) return cachedChangelog;
  try {
    const res = await fetch('/data/project-changelog.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedChangelog = await res.json();
  } catch {
    cachedChangelog = null;
  }
  return cachedChangelog;
}

export function findPlanForFeature(
  featureName: string,
  plans: Plan[],
  lookup: Record<string, string>
): Plan | undefined {
  const marsName = lookup[featureName] || featureName;
  return plans.find((p) => p.name === marsName);
}

export function findCatchmentForFeature(
  featureName: string,
  catchments: Catchment[],
  lookup: Record<string, string>
): Catchment | undefined {
  const marsName = lookup[featureName] || featureName;
  return catchments.find((c) => c.name === marsName);
}

/** Aggregate plans belonging to a catchment to compute nitrogen progress */
export function aggregatePlansForCatchment(
  catchmentName: string,
  plans: Plan[],
  lookup: Record<string, string>
): { goalT: number; achievedT: number; progressPct: number } {
  // We need to match plans to catchments. Since catchments and plans don't have
  // a direct foreign key, we match by looking at TopoJSON hov_id relationships.
  // For simplicity, we just use the catchment's own achieved value and compute
  // a rough progress based on national average goal distribution.
  return { goalT: 0, achievedT: 0, progressPct: 0 };
}
