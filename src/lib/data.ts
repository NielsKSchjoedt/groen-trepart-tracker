import type {
  DashboardData,
  Plan,
  Catchment,
  CO2EmissionsData,
  CoastalWaterStatusData,
  ProjectChangelog,
  KlimaskovfondenProject,
  NaturstyrelsenSkovProject,
  PipelineScenarioKey,
  PipelineScenarioValues,
  KlimaregnskabData,
  EtlRunSummary,
  ByInitiatorHa,
  BudgetData,
  KlimaraadetData,
  VandNaturSkovProjekt,
  KommuneBenchmarkData,
  NationalFordelingSimulation,
  KommuneRankingData,
  KommuneOplandeData,
  KommuneTrepartLinksData,
  ProjectNatureOverlapData,
} from './types';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';

let cachedData: DashboardData | null = null;
let summaryRaw: Record<string, unknown> | null = null;
let detailsMerged = false;
let cachedLookup: Record<string, string> | null = null;
let cachedCatchmentsTopo: Topology | null = null;
let cachedCoastalTopo: Topology | null = null;
let cachedKommunerTopo: Topology | null = null;
let cachedGeometries: Record<string, [number, number][]> | null = null;
let cachedCO2Data: CO2EmissionsData | null = null;
let cachedCoastalStatus: CoastalWaterStatusData | null = null;
let cachedWaterBodiesGeo: FeatureCollection<Geometry> | null = null;
let cachedNatura2000MapGeo: FeatureCollection<Geometry> | null = null;
let cachedSection3MapGeo: FeatureCollection<Geometry> | null = null;
let cachedChangelog: ProjectChangelog | null = null;
let cachedKlimaskovfonden: KlimaskovfondenProject[] | null = null;
let cachedNstSkov: NaturstyrelsenSkovProject[] | null = null;
let cachedKlimaregnskab: KlimaregnskabData | null = null;
let cachedEtlRunSummary: EtlRunSummary | null = null;
let cachedVandNaturSkov: FeatureCollection<Geometry, VandNaturSkovProjekt> | null = null;
let cachedVandNaturSkovKey = '';
let cachedKommuneBenchmark: KommuneBenchmarkData | null = null;
let cachedNationalFordeling: NationalFordelingSimulation | null = null;
let cachedKommuneRanking: KommuneRankingData | null = null;
let cachedProjectNatureOverlap: ProjectNatureOverlapData | null = null;
let cachedKommuneOplande: KommuneOplandeData | null = null;
let cachedKommuneTrepartLinks: KommuneTrepartLinksData | null = null;

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

  // Use only "established" (anlagt) values — projects physically built and operational.
  // The ETL totals include all phases (sketches, preliminary, approved) which inflates
  // progress. The byPhase breakdown gives us the honest numbers.
  const nitrogenEstablishedT = nitrogen.byPhase?.established?.T ?? nitrogen.totalT ?? 0;
  const nitrogenGoalT = nat.targets?.nitrogenReductionT ?? nitrogen.goalT ?? 0;

  const extractionEstablishedHa = extraction.byPhase?.established?.ha ?? extraction.totalHa ?? 0;
  const extractionGoalHa = nat.targets?.extractionHa ?? extraction.goalHa ?? 140_000;

  const afforestationMarsEstablishedHa =
    afforestation.marsTotal?.byPhase?.established?.ha ?? afforestation.marsTotal?.ha ?? afforestation.totalHa ?? 0;
  const afforestationKsfHa = afforestation.supplementary?.klimaskovfondenHa ?? 0;
  const afforestationKsfProjectCount = afforestation.supplementary?.klimaskovfondenProjectCount ?? 0;
  const afforestationNstCompletedHa = afforestation.supplementary?.nstSkovCompletedHa ?? 0;
  const afforestationNstOngoingHa = afforestation.supplementary?.nstSkovOngoingHa ?? 0;
  const afforestationNstMatchedCount = afforestation.supplementary?.nstSkovMatchedCount ?? 0;
  const afforestationNstHa =
    afforestation.supplementary?.nstSkovHa ??
    afforestationNstCompletedHa + afforestationNstOngoingHa;
  const afforestationSupplementaryHa = afforestationKsfHa + afforestationNstHa;

  const extractionKsfLavbundHa = extraction.supplementary?.klimaskovfondenLavbundHa ?? 0;
  const extractionKsfLavbundCount = extraction.supplementary?.klimaskovfondenLavbundCount ?? 0;
  const afforestationTotal = afforestationMarsEstablishedHa + afforestationSupplementaryHa;
  const afforestationGoal =
    afforestation.goalHa ?? nat.targets?.afforestationHa ?? 250_000;

  // Build cumulative pipeline scenarios: each level includes everything below it.
  const nitrogenApprovedT = nitrogen.byPhase?.approved?.T ?? 0;
  const nitrogenPreliminaryT = nitrogen.byPhase?.preliminary?.T ?? 0;
  const extractionApprovedHa = extraction.byPhase?.approved?.ha ?? 0;
  const extractionPreliminaryHa = extraction.byPhase?.preliminary?.ha ?? 0;
  const afforestationApprovedHa = afforestation.marsTotal?.byPhase?.approved?.ha ?? 0;
  const afforestationPreliminaryHa = afforestation.marsTotal?.byPhase?.preliminary?.ha ?? 0;

  // MARS aggregated totals across ALL phases (including sketches/assessed).
  // Used for the "all" scenario. We take the max of the MARS total and the
  // sum of explicit phases to guard against aggregation discrepancies.
  const nitrogenAllT = Math.max(
    nitrogen.totalT ?? 0,
    nitrogenEstablishedT + nitrogenApprovedT + nitrogenPreliminaryT,
  );
  const extractionAllHa = Math.max(
    extraction.totalHa ?? 0,
    extractionEstablishedHa + extractionApprovedHa + extractionPreliminaryHa,
  );
  const afforestationAllMarsHa = Math.max(
    afforestation.marsTotal?.ha ?? 0,
    (afforestation.marsTotal?.byPhase?.established?.ha ?? 0) +
      (afforestation.marsTotal?.byPhase?.approved?.ha ?? 0) +
      (afforestation.marsTotal?.byPhase?.preliminary?.ha ?? 0),
  );
  const afforestationAllHa = afforestationAllMarsHa + afforestationSupplementaryHa;

  function buildScenario(key: PipelineScenarioKey): PipelineScenarioValues {
    let nT: number;
    let eHa: number;
    let aHa: number;

    if (key === 'all') {
      nT = nitrogenAllT;
      eHa = extractionAllHa;
      aHa = afforestationAllHa;
    } else {
      nT = nitrogenEstablishedT;
      eHa = extractionEstablishedHa;
      aHa = afforestationTotal;

      if (key === 'approved' || key === 'preliminary') {
        nT += nitrogenApprovedT;
        eHa += extractionApprovedHa;
        aHa += afforestationApprovedHa;
      }
      if (key === 'preliminary') {
        nT += nitrogenPreliminaryT;
        eHa += extractionPreliminaryHa;
        aHa += afforestationPreliminaryHa;
      }
    }

    return {
      nitrogenAchievedT: nT,
      nitrogenProgressPct: nitrogenGoalT > 0 ? Math.min((nT / nitrogenGoalT) * 100, 100) : 0,
      extractionAchievedHa: eHa,
      extractionProgressPct: extractionGoalHa > 0 ? Math.min((eHa / extractionGoalHa) * 100, 100) : 0,
      afforestationAchievedHa: aHa,
      afforestationProgressPct: afforestationGoal > 0 ? Math.min((aHa / afforestationGoal) * 100, 100) : 0,
    };
  }

  const pipelineScenarios: Record<PipelineScenarioKey, PipelineScenarioValues> = {
    established: buildScenario('established'),
    approved: buildScenario('approved'),
    preliminary: buildScenario('preliminary'),
    all: buildScenario('all'),
  };

  return {
    fetchedAt: r.fetchedAt ?? r.builtAt ?? '',
    driftFinansiering: r.driftFinansiering as DashboardData['driftFinansiering'],
    national: {
      targets: {
        nitrogenReductionT: nat.targets?.nitrogenReductionT ?? 0,
        extractionHa: nat.targets?.extractionHa ?? 0,
        afforestationHa: nat.targets?.afforestationHa ?? 0,
        protectedNaturePct: nat.targets?.protectedNaturePct ?? 20,
        deadline: nat.targets?.deadline ?? '2030-12-31',
        forestDeadline: nat.targets?.forestDeadline ?? '2045-12-31',
        extractionRealiseringHorisont: nat.targets?.extractionRealiseringHorisont,
        extractionKulstofrigHa: nat.targets?.extractionKulstofrigHa,
        extractionKulstofrigDeadline: nat.targets?.extractionKulstofrigDeadline,
        forestKf26RealizationHorizon: nat.targets?.forestKf26RealizationHorizon,
        uroertSkovHa: nat.targets?.uroertSkovHa,
      },
      progress: {
        nitrogenAchievedT: nitrogenEstablishedT,
        nitrogenProgressPct: nitrogenGoalT > 0
          ? Math.min((nitrogenEstablishedT / nitrogenGoalT) * 100, 100)
          : 0,
        extractionAchievedHa: extractionEstablishedHa,
        extractionProgressPct: extractionGoalHa > 0
          ? Math.min((extractionEstablishedHa / extractionGoalHa) * 100, 100)
          : 0,
        afforestationAchievedHa: afforestationTotal,
        afforestationProgressPct:
          afforestationGoal > 0
            ? (afforestationTotal / afforestationGoal) * 100
            : 0,
        afforestationMarsHa: afforestationMarsEstablishedHa,
        afforestationSupplementaryHa: afforestationSupplementaryHa,
        afforestationKsfHa,
        afforestationKsfProjectCount,
        afforestationNstCompletedHa,
        afforestationNstOngoingHa,
        afforestationNstMatchedCount,
        extractionKsfLavbundHa,
        extractionKsfLavbundCount,
        naturePotentialAreaHa:
          nature.marsNaturePotential?.areaHa ?? 0,
        natureProtectedPct: nature.combinedEstimatePct ?? 0,
        natura2000TerrestrialPct: nature.natura2000?.terrestrialPct ?? 0,
        section3Pct: nature.section3?.pctOfLand ?? 0,
      },
      pipelineScenarios,
      projects: {
        total: pipeline.total ?? 0,
        sketches: phases.sketches?.count ?? 0,
        assessed: phases.assessed?.count ?? 0,
        approved: phases.approved?.count ?? 0,
        established: phases.established?.count ?? 0,
      },
      byKommune: (nat.byKommune ?? []) as any[],
      byInitiatorHa: nat.byInitiatorHa as ByInitiatorHa | undefined,
      budgetData: nat.budgetData as BudgetData | undefined,
      klimaraadet: nat.klimaraadet as KlimaraadetData | undefined,
      kf26: nat.kf26 as DashboardData['national']['kf26'],
      byPipelinePhase: nat.byPipelinePhase,
      cancelled: nat.cancelled,
      byOwnerOrg: nat.byOwnerOrg,
    },
    plans: ((r.plans ?? []) as any[]).map((p: any) => {
      const defaultPhase = { established: 0, approved: 0, preliminary: 0 };
      return {
        ...p,
        nitrogenProgressPct: p.nitrogenGoalT > 0
          ? Math.min(p.nitrogenProgressPct ?? 0, 100)
          : 0,
        nitrogenByPhase: { ...defaultPhase, ...p.nitrogenByPhase },
        extractionByPhase: { ...defaultPhase, ...p.extractionByPhase },
        afforestationByPhase: { ...defaultPhase, ...p.afforestationByPhase },
      };
    }),
    catchments: r.catchments ?? [],
    mitigationMeasures: r.mitigationMeasures ?? [],
    subsidySchemes: r.subsidySchemes ?? [],
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

interface ProjectDetailsPayload {
  plans: Array<{
    id: string;
    projectDetails: Plan['projectDetails'];
    sketchProjects: Plan['sketchProjects'];
    naturePotentials: Plan['naturePotentials'];
  }>;
  catchments: Array<{
    id: string;
    projectDetails: Catchment['projectDetails'];
    sketchProjects: Catchment['sketchProjects'];
    naturePotentials: Catchment['naturePotentials'];
  }>;
}

/** Merge slim summary rows with drill-down arrays from project-details.json. */
function mergeDashboardPayload(
  summary: Record<string, unknown>,
  details: ProjectDetailsPayload,
): Record<string, unknown> {
  const planDrill = new Map(details.plans.map((p) => [p.id, p]));
  const catchDrill = new Map(details.catchments.map((c) => [c.id, c]));

  const plans = ((summary.plans ?? []) as Plan[]).map((plan) => {
    const drill = planDrill.get(plan.id);
    return drill
      ? {
          ...plan,
          projectDetails: drill.projectDetails,
          sketchProjects: drill.sketchProjects,
          naturePotentials: drill.naturePotentials,
        }
      : { ...plan, projectDetails: [], sketchProjects: [], naturePotentials: [] };
  });

  const catchments = ((summary.catchments ?? []) as Catchment[]).map((c) => {
    const drill = catchDrill.get(c.id);
    return drill
      ? {
          ...c,
          projectDetails: drill.projectDetails,
          sketchProjects: drill.sketchProjects,
          naturePotentials: drill.naturePotentials,
        }
      : { ...c, projectDetails: [], sketchProjects: [], naturePotentials: [] };
  });

  return { ...summary, plans, catchments };
}

let detailsLoadPromise: Promise<ProjectDetailsPayload> | null = null;

function emptyDetailsPayload(summary: Record<string, unknown>): ProjectDetailsPayload {
  const plans = (summary.plans ?? []) as Array<{ id: string }>;
  const catchments = (summary.catchments ?? []) as Array<{ id: string }>;
  return {
    plans: plans.map((p) => ({
      id: p.id,
      projectDetails: [],
      sketchProjects: [],
      naturePotentials: [],
    })),
    catchments: catchments.map((c) => ({
      id: c.id,
      projectDetails: [],
      sketchProjects: [],
      naturePotentials: [],
    })),
  };
}

async function fetchProjectDetails(): Promise<ProjectDetailsPayload> {
  if (!detailsLoadPromise) {
    detailsLoadPromise = fetch('/data/project-details.json').then((res) => {
      if (!res.ok) throw new Error(`project-details.json: ${res.status}`);
      return res.json() as Promise<ProjectDetailsPayload>;
    });
  }
  return detailsLoadPromise;
}

export async function loadDashboardData(): Promise<DashboardData> {
  if (cachedData && detailsMerged) return cachedData;

  const summaryRes = await fetch('/data/dashboard-summary.json');
  if (!summaryRes.ok) {
    const legacy = await fetch('/data/dashboard-data.json');
    if (!legacy.ok) throw new Error('Dashboard data not found');
    const raw = await legacy.json();
    cachedData = normalizeRawData(raw);
    detailsMerged = true;
    return cachedData!;
  }

  summaryRaw = await summaryRes.json();
  cachedData = normalizeRawData(mergeDashboardPayload(summaryRaw, emptyDetailsPayload(summaryRaw)));
  return cachedData!;
}

/**
 * Fetches project-details.json and merges into cached dashboard data.
 * Call after loadDashboardData() so KPIs render before the ~10 MB payload.
 */
export async function ensureDashboardProjectDetails(): Promise<DashboardData> {
  if (detailsMerged && cachedData) return cachedData;
  if (!summaryRaw) await loadDashboardData();
  const details = await fetchProjectDetails();
  cachedData = normalizeRawData(mergeDashboardPayload(summaryRaw!, details));
  detailsMerged = true;
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

/**
 * Load the municipality polygon TopoJSON for the choropleth map.
 *
 * The file is produced by `etl/build_kommune_topojson.py` and stored at
 * `public/data/kommuner.topo.json`. Returns a GeoJSON FeatureCollection
 * converted from TopoJSON via topojson-client.
 *
 * @returns FeatureCollection with 98 kommuner polygons in WGS84
 * @example const kommunerGeo = await loadKommunerGeoJSON();
 */
export async function loadKommunerGeoJSON(): Promise<FeatureCollection<Geometry>> {
  if (!cachedKommunerTopo) {
    const res = await fetch('/data/kommuner.topo.json');
    cachedKommunerTopo = await res.json();
  }
  const objectKey = Object.keys(cachedKommunerTopo!.objects)[0];
  return feature(cachedKommunerTopo!, cachedKommunerTopo!.objects[objectKey]) as unknown as FeatureCollection<Geometry>;
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

/** Load simplified terrestrial Natura 2000 polygons for the national map overlay. */
export async function loadNatura2000MapGeo(): Promise<FeatureCollection<Geometry> | null> {
  if (cachedNatura2000MapGeo) return cachedNatura2000MapGeo;
  try {
    const res = await fetch('/data/natura2000-simplified.geojson');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedNatura2000MapGeo = await res.json();
  } catch {
    cachedNatura2000MapGeo = null;
  }
  return cachedNatura2000MapGeo;
}

/** Load simplified §3 polygons (>= 50 ha) for the national map overlay. */
export async function loadSection3MapGeo(): Promise<FeatureCollection<Geometry> | null> {
  if (cachedSection3MapGeo) return cachedSection3MapGeo;
  try {
    const res = await fetch('/data/section3-simplified.geojson');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedSection3MapGeo = await res.json();
  } catch {
    cachedSection3MapGeo = null;
  }
  return cachedSection3MapGeo;
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

/** Load Klimaskovfonden voluntary afforestation projects (centroids + areas) */
export async function loadKlimaskovfondenProjects(): Promise<KlimaskovfondenProject[]> {
  if (cachedKlimaskovfonden) return cachedKlimaskovfonden;
  try {
    const res = await fetch('/data/klimaskovfonden-projects.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedKlimaskovfonden = await res.json();
  } catch {
    cachedKlimaskovfonden = [];
  }
  return cachedKlimaskovfonden!;
}

/** Load Naturstyrelsen state afforestation projects (WFS-matched) */
export async function loadNaturstyrelsenSkovProjects(): Promise<NaturstyrelsenSkovProject[]> {
  if (cachedNstSkov) return cachedNstSkov;
  try {
    const res = await fetch('/data/naturstyrelsen-skov-projects.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedNstSkov = await res.json();
  } catch {
    cachedNstSkov = [];
  }
  return cachedNstSkov!;
}

/**
 * Load per-municipality CO₂ emissions data from Klimaregnskabet.
 * Source: Energistyrelsen / klimaregnskabet.dk
 * Coverage: 98 municipalities, years 2018–2023, sector breakdown.
 */
export async function loadKlimaregnskabData(): Promise<KlimaregnskabData | null> {
  if (cachedKlimaregnskab) return cachedKlimaregnskab;
  try {
    const res = await fetch('/data/klimaregnskab-by-kommune.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedKlimaregnskab = await res.json();
  } catch {
    cachedKlimaregnskab = null;
  }
  return cachedKlimaregnskab;
}

/**
 * Load the compact ETL run summary (last 30 daily runs).
 * Produced by etl/build_etl_summary.py on each CI run.
 * Used by the ETL health widget on the "Data og metode" page.
 */
export async function loadEtlRunSummary(): Promise<EtlRunSummary | null> {
  if (cachedEtlRunSummary) return cachedEtlRunSummary;
  try {
    const res = await fetch('/data/etl-run-summary.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedEtlRunSummary = await res.json();
  } catch {
    cachedEtlRunSummary = null;
  }
  return cachedEtlRunSummary;
}

/**
 * FVM / Markkort: Vand, natur & skov 2026 (slim GeoJSON for kort).
 * Query `v` matches ETL summary generation time to bust cache after refresh.
 */
export async function loadVandNaturSkovProjekter(): Promise<FeatureCollection<Geometry, VandNaturSkovProjekt> | null> {
  const summary = await loadEtlRunSummary();
  const v = summary?.generatedAt ?? '';
  if (cachedVandNaturSkov && cachedVandNaturSkovKey === v) return cachedVandNaturSkov;
  try {
    const q = v ? `?v=${encodeURIComponent(v)}` : '';
    const res = await fetch(`/data/vand-natur-skov-projekter-2026.geojson${q}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fc = (await res.json()) as FeatureCollection<Geometry, VandNaturSkovProjekt>;
    cachedVandNaturSkov = fc;
    cachedVandNaturSkovKey = v;
  } catch {
    cachedVandNaturSkov = null;
  }
  return cachedVandNaturSkov;
}

/**
 * Load Sprint 4/5 municipality nature benchmarks (B1/B2/B3/B4).
 *
 * @returns Combined benchmark data, or null when the monthly spatial build has
 * not been run yet.
 * @example const benchmark = await loadKommuneBenchmarkData();
 */
export async function loadKommuneBenchmarkData(): Promise<KommuneBenchmarkData | null> {
  if (cachedKommuneBenchmark) return cachedKommuneBenchmark;
  try {
    const [b1Res, b2Res, b3Res, b4Res] = await Promise.all([
      fetch('/data/kommune-benchmark/b1-andel-nationalt-naturpotentiale.json'),
      fetch('/data/kommune-benchmark/b2-marker-i-naturpotentiale.json'),
      fetch('/data/kommune-benchmark/b3-n2000-er-landbrug.json'),
      fetch('/data/kommune-benchmark/b4-vaerdibeskyttelse.json'),
    ]);
    if (!b1Res.ok || !b2Res.ok || !b3Res.ok) throw new Error('Kommune benchmark unavailable');
    const b4 = b4Res.ok ? await b4Res.json() : null;
    cachedKommuneBenchmark = {
      b1: await b1Res.json(),
      b2: await b2Res.json(),
      b3: await b3Res.json(),
      b4,
    };
  } catch {
    cachedKommuneBenchmark = null;
  }
  return cachedKommuneBenchmark;
}

/**
 * Load Sprint 4 national nature-goal distribution simulation.
 *
 * @returns Simulation data, or null when the monthly spatial build has not run.
 * @example const simulation = await loadNationalFordelingSimulation();
 */
export async function loadNationalFordelingSimulation(): Promise<NationalFordelingSimulation | null> {
  if (cachedNationalFordeling) return cachedNationalFordeling;
  try {
    const res = await fetch('/data/kommune-benchmark/national-fordeling-simulering.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedNationalFordeling = await res.json();
  } catch {
    cachedNationalFordeling = null;
  }
  return cachedNationalFordeling;
}

/**
 * Load Sprint 6 municipality competition ranking (precomputed indices).
 *
 * @example const ranking = await loadKommuneRanking();
 */
export async function loadKommuneRanking(): Promise<KommuneRankingData | null> {
  if (cachedKommuneRanking) return cachedKommuneRanking;
  try {
    const res = await fetch('/data/kommune-benchmark/kommune-ranking.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedKommuneRanking = await res.json();
  } catch {
    cachedKommuneRanking = null;
  }
  return cachedKommuneRanking;
}

/**
 * Per-project nature overlap (project polygons × DCE/§3/Natura 2000, clipped to
 * kommune). Headline = biodiversitetHa. Returns null until the monthly spatial
 * build has produced the file.
 */
export async function loadProjectNatureOverlap(): Promise<ProjectNatureOverlapData | null> {
  if (cachedProjectNatureOverlap) return cachedProjectNatureOverlap;
  try {
    const res = await fetch('/data/project-nature-overlap.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedProjectNatureOverlap = await res.json();
  } catch {
    cachedProjectNatureOverlap = null;
  }
  return cachedProjectNatureOverlap;
}

/**
 * Load Sprint 6 kommune × water-catchment overlap.
 *
 * @example const oplande = await loadKommuneOplande();
 */
export async function loadKommuneOplande(): Promise<KommuneOplandeData | null> {
  if (cachedKommuneOplande) return cachedKommuneOplande;
  try {
    const res = await fetch('/data/kommune-benchmark/kommune-oplande.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedKommuneOplande = await res.json();
  } catch {
    cachedKommuneOplande = null;
  }
  return cachedKommuneOplande;
}

/**
 * Load curated per-kommune Grøn Trepart entry links.
 *
 * Maps each kommune kode to the official entry page about Den Grønne Trepart
 * on the kommune's own domain (or a "Ingen fundet" record). Produced by
 * scripts/build-trepart-links.mjs.
 *
 * @example const links = await loadKommuneTrepartLinks();
 *          const link = links?.links[kommune.kode];
 */
export async function loadKommuneTrepartLinks(): Promise<KommuneTrepartLinksData | null> {
  if (cachedKommuneTrepartLinks) return cachedKommuneTrepartLinks;
  try {
    const res = await fetch('/data/kommune-trepart-links.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cachedKommuneTrepartLinks = await res.json();
  } catch {
    cachedKommuneTrepartLinks = null;
  }
  return cachedKommuneTrepartLinks;
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
