/**
 * Shared helpers for tier-1 MARS project rendering on Leaflet maps.
 */
import type { LatLngExpression } from 'leaflet';
import type { DashboardData, ProjectDetail, SketchProject } from './types';
import type { PillarId } from './pillars';
import type { KommuneMetric } from './kommune-metrics';
import type { ProjectPhase } from './phase-config';
import { buildMarsProjectOverlapByGeoId } from './mars-kommune-overlap';

/** Screen bbox must reach this multiple of dot diameter before switching from dot to polygon. */
export const MAP_PROJECT_POLYGON_MIN_DOT_FACTOR = 1;

export interface LatLngProjector {
  latLngToContainerPoint(latlng: LatLngExpression): { x: number; y: number };
}

/** Bounding box of a ring in map container pixels (Leaflet [lat, lng] order). */
export function ringBoundingBoxScreenPx(
  map: LatLngProjector,
  ring: [number, number][],
): { width: number; height: number } {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const [lng, lat] of ring) {
    const pt = map.latLngToContainerPoint([lat, lng]);
    minX = Math.min(minX, pt.x);
    maxX = Math.max(maxX, pt.x);
    minY = Math.min(minY, pt.y);
    maxY = Math.max(maxY, pt.y);
  }

  return { width: maxX - minX, height: maxY - minY };
}

/** True when the on-screen shape is at least as large as the dot marker would be. */
export function shouldRenderProjectPolygonByScreenSize(
  bboxWidthPx: number,
  bboxHeightPx: number,
  dotRadiusPx: number,
  minDotFactor = MAP_PROJECT_POLYGON_MIN_DOT_FACTOR,
): boolean {
  const dotDiameter = dotRadiusPx * 2 * minDotFactor;
  return Math.max(bboxWidthPx, bboxHeightPx) >= dotDiameter;
}

export function shouldRenderProjectPolygon(
  map: LatLngProjector,
  ring: [number, number][],
  dotRadiusPx: number,
): boolean {
  const { width, height } = ringBoundingBoxScreenPx(map, ring);
  return shouldRenderProjectPolygonByScreenSize(width, height, dotRadiusPx);
}

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

/** Filter map projects to those whose polygon overlaps a municipality. */
export function filterMapProjectsByKommune(
  projects: MapProjectItem[],
  kommuneKode: string,
  overlapByGeoId: Record<string, string[] | undefined>,
): MapProjectItem[] {
  return projects.filter((p) => overlapByGeoId[p.geoId]?.includes(kommuneKode));
}

/** Build geoId → overlapping kommune koder from enriched dashboard plans. */
export { buildMarsProjectOverlapByGeoId };
