import type { DashboardData, ProjectDetail, SketchProject } from '@/lib/types';

/** MARS project or sketch with optional polygon-overlap kommune attribution. */
export type MarsKommuneProject = Pick<
  ProjectDetail | SketchProject,
  'geoId' | 'kommuneKode' | 'overlappingKommuneKoder'
>;

/** All kommuner whose boundary intersects the project polygon (ETL); centroid fallback. */
export function overlappingKommuneKoderForProject(project: MarsKommuneProject): string[] {
  if (project.overlappingKommuneKoder?.length) return project.overlappingKommuneKoder;
  return project.kommuneKode ? [project.kommuneKode] : [];
}

export function projectOverlapsKommune(
  project: MarsKommuneProject,
  kommuneKode: string,
): boolean {
  return overlappingKommuneKoderForProject(project).includes(kommuneKode);
}

/** geoId → kommune koder for map filtering on enkelt-kommune views. */
export function buildMarsProjectOverlapByGeoId(
  dashboard: DashboardData,
): Record<string, string[]> {
  const map: Record<string, string[]> = {};

  const add = (projects: MarsKommuneProject[]) => {
    for (const project of projects) {
      if (!project.geoId) continue;
      const koder = overlappingKommuneKoderForProject(project);
      if (koder.length) map[project.geoId] = koder;
    }
  };

  for (const plan of dashboard.plans) {
    add(plan.projectDetails);
    add(plan.sketchProjects);
  }
  for (const catchment of dashboard.catchments ?? []) {
    add(catchment.projectDetails);
    add(catchment.sketchProjects);
  }

  return map;
}
