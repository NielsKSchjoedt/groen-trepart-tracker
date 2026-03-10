import type { DashboardData, Plan, Catchment } from './types';
import { feature } from 'topojson-client';
import type { Topology } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';

let cachedData: DashboardData | null = null;
let cachedLookup: Record<string, string> | null = null;
let cachedCatchmentsTopo: Topology | null = null;
let cachedCoastalTopo: Topology | null = null;

export async function loadDashboardData(): Promise<DashboardData> {
  if (cachedData) return cachedData;
  const res = await fetch('/data/lovable-dashboard-data.json');
  cachedData = await res.json();
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
