import type { DashboardData } from './types';
import type { PillarId } from './pillars';
import { classifyInitiator } from './initiator';

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

  for (const plan of data.plans) {
    for (const proj of plan.projectDetails) {
      const hasEffect =
        !effectField || ((proj as Record<string, unknown>)[effectField] as number) > 0;
      if (hasEffect) {
        counts[classifyInitiator(proj.schemeOrg, proj.schemeName)]++;
      }
    }
    if (!includeSketches) continue;
    for (const sketch of plan.sketchProjects) {
      const hasEffect =
        !effectField || ((sketch as Record<string, unknown>)[effectField] as number) > 0;
      if (hasEffect) {
        counts[classifyInitiator(sketch.schemeOrg, sketch.schemeName)]++;
      }
    }
  }

  return counts;
}
