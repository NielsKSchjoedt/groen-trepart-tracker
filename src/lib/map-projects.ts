/**
 * Shared helpers for tier-1 MARS project rendering on Leaflet maps.
 */
import type { DashboardData, ProjectDetail, SketchProject } from './types';
import type { PillarId } from './pillars';
import type { KommuneMetric } from './kommune-metrics';
import type { ProjectPhase } from './phase-config';

/** Zoom at or above this level renders full polygons; below uses centroid dots. */
export const MAP_PROJECT_POLYGON_ZOOM = 9;

export interface MapProjectItem {
  geoId: string;
  name: string;
  phase: ProjectPhase;
  areaHa: number;
  measureName?: string;
}

/** MARS project + plan context for detail panels and map clicks. */
export interface MarsProjectWithContext {
  project: ProjectDetail | SketchProject;
  planName: string;
}

/** Look up a MARS project or sketch by geometry id across all plans. */
export function findMarsProjectByGeoId(
  data: DashboardData,
  geoId: string,
): MarsProjectWithContext | undefined {
  for (const plan of data.plans) {
    for (const sk of plan.sketchProjects) {
      if (sk.geoId === geoId) {
        return { project: sk, planName: plan.name };
      }
    }
    for (const proj of plan.projectDetails) {
      if (proj.geoId === geoId) {
        return { project: proj, planName: plan.name };
      }
    }
  }
  return undefined;
}

const PILLAR_EFFECT_FIELD: Partial<Record<PillarId, keyof ProjectDetail>> = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
};

const PIPELINE_TO_FILTER_PHASE: Record<string, ProjectPhase> = {
  sketch: 'sketch',
  preliminary_grant: 'preliminary',
  preliminary_done: 'preliminary',
  establishment_grant: 'approved',
  established: 'established',
};

/** Map a MARS project/sketch to the four phase-filter buckets. */
export function getProjectFilterPhase(project: ProjectDetail | SketchProject): ProjectPhase {
  if (project.phase === 'sketch' || project.pipelinePhase === 'sketch') return 'sketch';
  if (project.pipelinePhase && project.pipelinePhase in PIPELINE_TO_FILTER_PHASE) {
    return PIPELINE_TO_FILTER_PHASE[project.pipelinePhase];
  }
  return project.phase as ProjectPhase;
}

function pillarRelevant(
  project: ProjectDetail | SketchProject,
  pillarId: PillarId,
): boolean {
  if (pillarId === 'nature' || pillarId === 'co2') return pillarId === 'nature';
  const field = PILLAR_EFFECT_FIELD[pillarId];
  if (!field) return false;
  return ((project as Record<string, unknown>)[field] as number) > 0;
}

/**
 * Collect MARS projects/sketches with geometry for the active pillar and phases.
 */
export function collectMapProjects(
  data: DashboardData,
  pillarId: PillarId,
  activePhases: Set<ProjectPhase>,
): MapProjectItem[] {
  if (pillarId === 'co2') return [];

  const items: MapProjectItem[] = [];

  for (const plan of data.plans) {
    for (const sk of plan.sketchProjects) {
      if (!sk.geoId || !activePhases.has('sketch') || !pillarRelevant(sk, pillarId)) continue;
      items.push({
        geoId: sk.geoId,
        name: sk.name,
        phase: 'sketch',
        areaHa: sk.areaHa,
        measureName: sk.measureName,
      });
    }

    for (const proj of plan.projectDetails) {
      if (!proj.geoId || proj.isCancelled || proj.pipelinePhase === 'cancelled') continue;
      const phase = getProjectFilterPhase(proj);
      if (!activePhases.has(phase) || !pillarRelevant(proj, pillarId)) continue;
      items.push({
        geoId: proj.geoId,
        name: proj.name,
        phase,
        areaHa: proj.areaHa,
        measureName: proj.measureName,
      });
    }
  }

  return items;
}

/** Simple centroid of a GeoJSON outer ring ([lng, lat] pairs). */
export function ringCentroid(ring: [number, number][]): [number, number] {
  let lng = 0;
  let lat = 0;
  for (const [lo, la] of ring) {
    lng += lo;
    lat += la;
  }
  const n = ring.length || 1;
  return [lng / n, lat / n];
}

/** Scale dot radius by area (sqrt), clamped for map readability. */
export function projectMarkerRadius(areaHa: number, maxAreaHa: number): number {
  const max = Math.max(maxAreaHa, 1);
  return Math.max(4, Math.min(14, 4 + 10 * Math.sqrt(areaHa / max)));
}

const METRIC_TO_PILLAR: Partial<Record<KommuneMetric, PillarId>> = {
  nitrogen: 'nitrogen',
  extraction: 'extraction',
  afforestation: 'afforestation',
  nature: 'nature',
};

export function kommuneMetricToPillar(metric: KommuneMetric): PillarId | null {
  return METRIC_TO_PILLAR[metric] ?? null;
}

/** Filter map projects to a single municipality (by DAWA kode). */
export function filterMapProjectsByKommune(
  projects: MapProjectItem[],
  kommuneKode: string,
  projectKommuneByGeoId: Record<string, string | null | undefined>,
): MapProjectItem[] {
  return projects.filter((p) => projectKommuneByGeoId[p.geoId] === kommuneKode);
}
