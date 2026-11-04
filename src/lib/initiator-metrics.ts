import type { DashboardData } from './types';
import type { PillarId } from './pillars';
import { classifyInitiator } from './initiator';
import { withNationalEffects } from '@/lib/pillar-projects';

interface InitiatorCounts {
  state: number;
  municipal: number;
  private: number;
}

const EFFECT_FIELD: Partial<Record<PillarId, string>> = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
};

export function computeInitiatorCounts(
  data: DashboardData,
  pillarId: PillarId,
  includeSketches: boolean,
): InitiatorCounts {
  const counts: InitiatorCounts = { state: 0, municipal: 0, private: 0 };
  const effectField = EFFECT_FIELD[pillarId];
  // A project spanning several kystvandoplande appears once per plan — count it once,
  // on its national effect.
  const seen = new Set<string>();

  for (const plan of data.plans) {
    for (const rawProj of plan.projectDetails) {
      if (rawProj.id && seen.has(rawProj.id)) continue;
      if (rawProj.id) seen.add(rawProj.id);
      const proj = withNationalEffects(rawProj);
      const hasEffect =
        !effectField || ((proj as Record<string, unknown>)[effectField] as number) > 0;
      if (hasEffect) {
        counts[classifyInitiator(proj.schemeOrg, proj.schemeName)]++;
      }
    }
    if (!includeSketches) continue;
    for (const rawSketch of plan.sketchProjects) {
      if (rawSketch.id && seen.has(rawSketch.id)) continue;
      if (rawSketch.id) seen.add(rawSketch.id);
      const sketch = withNationalEffects(rawSketch);
      const hasEffect =
        !effectField || ((sketch as Record<string, unknown>)[effectField] as number) > 0;
      if (hasEffect) {
        counts[classifyInitiator(sketch.schemeOrg, sketch.schemeName)]++;
      }
    }
  }

  return counts;
}
