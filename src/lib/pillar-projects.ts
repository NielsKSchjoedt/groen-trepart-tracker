import type { DashboardData, ProjectDetail, SketchProject } from '@/lib/types';
import type { PillarId } from '@/lib/pillars';
import type { PipelineMainPhase } from '@/lib/types';
import { isNaturePipelineProject, uniqueByProjectId } from '@/lib/nature-projects';

/** A project enriched with its parent plan name for display. */
export type ProjectWithPlan = (ProjectDetail | SketchProject) & { planName: string };

export interface PillarProjects {
  sketches: ProjectWithPlan[];
  preliminary_grant: ProjectWithPlan[];
  preliminary_done: ProjectWithPlan[];
  establishment_grant: ProjectWithPlan[];
  established: ProjectWithPlan[];
}

const EFFECT_FIELD: Partial<Record<PillarId, keyof ProjectDetail>> = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
};

export function projectMatchesPillar(
  project: ProjectDetail | SketchProject,
  pillarId: PillarId,
): boolean {
  if (pillarId === 'co2') return false;
  if (pillarId === 'nature') return isNaturePipelineProject(project);
  const field = EFFECT_FIELD[pillarId];
  if (!field) return false;
  return ((project as unknown as Record<string, unknown>)[field] as number) > 0;
}

/**
 * Collect pillar-specific projects grouped by pipeline stage.
 *
 * National view deduplicates on project id: 84 MARS projects sit in 2–4
 * coastal plans, and counting nested plan rows would overstate the pipeline.
 */
export function computePillarProjects(data: DashboardData, pillarId: PillarId): PillarProjects {
  const result: PillarProjects = {
    sketches: [],
    preliminary_grant: [],
    preliminary_done: [],
    establishment_grant: [],
    established: [],
  };

  if (pillarId === 'co2') return result;

  for (const plan of data.plans) {
    for (const sk of plan.sketchProjects) {
      if (projectMatchesPillar(sk, pillarId)) {
        result.sketches.push({ ...sk, planName: plan.name });
      }
    }
    for (const proj of plan.projectDetails) {
      if (proj.pipelinePhase === 'cancelled' || proj.isCancelled) continue;
      if (!projectMatchesPillar(proj, pillarId)) continue;
      const stage = proj.pipelinePhase as PipelineMainPhase | undefined;
      const stageKey = stage === 'sketch' ? 'sketches' : stage;
      if (stageKey && stageKey in result) {
        result[stageKey].push({ ...proj, planName: plan.name });
      }
    }
  }

  result.sketches = uniqueByProjectId(result.sketches);
  result.preliminary_grant = uniqueByProjectId(result.preliminary_grant);
  result.preliminary_done = uniqueByProjectId(result.preliminary_done);
  result.establishment_grant = uniqueByProjectId(result.establishment_grant);
  result.established = uniqueByProjectId(result.established);
  return result;
}

export function flattenPillarProjects(groups: PillarProjects): ProjectWithPlan[] {
  return [
    ...groups.sketches,
    ...groups.preliminary_grant,
    ...groups.preliminary_done,
    ...groups.establishment_grant,
    ...groups.established,
  ];
}
