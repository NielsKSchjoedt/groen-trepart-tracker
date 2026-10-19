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

/**
 * The project with its effect fields on MARS's national basis.
 *
 * Plan rows carry effects clipped to their kystvandopland: a project spanning two
 * plans appears twice, each row holding only that plan's share (Ølholmbæk: 58 ha
 * in one plan, 1.291 ha in the other). Deduplicating plan rows therefore kept only
 * one share and understated the national funnel (lavbund anlagt 607 ha vs MARS 735).
 * The ETL attaches whole-project national values; use them for every national view.
 */
export function withNationalEffects<T extends ProjectDetail | SketchProject>(project: T): T {
  const p = project as T & {
    nationalNitrogenT?: number;
    nationalExtractionHa?: number;
    nationalAfforestationHa?: number;
  };
  if (p.nationalNitrogenT == null && p.nationalExtractionHa == null && p.nationalAfforestationHa == null) {
    return project;
  }
  return {
    ...project,
    nitrogenT: p.nationalNitrogenT ?? project.nitrogenT,
    extractionHa: p.nationalExtractionHa ?? project.extractionHa,
    afforestationHa: p.nationalAfforestationHa ?? project.afforestationHa,
  };
}

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
 * National view: one entry per project id, with whole-project national effects
 * (see withNationalEffects). Pillar membership follows MARS's rule — a project counts
 * toward an indsats when its national effect for that indsats is > 0.
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
    for (const rawSketch of plan.sketchProjects) {
      const sk = withNationalEffects(rawSketch);
      if (projectMatchesPillar(sk, pillarId)) {
        result.sketches.push({ ...sk, planName: plan.name });
      }
    }
    for (const rawProj of plan.projectDetails) {
      const proj = withNationalEffects(rawProj);
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
