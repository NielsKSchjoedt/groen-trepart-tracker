import { describe, it, expect } from 'vitest';
import type { ByInitiatorHa, DashboardData } from '@/lib/types';
import { computeInitiatorCounts } from '@/lib/initiator-metrics';

/**
 * Samme logik som i InitiativeTypeGauge: summer areal/ton for valgte faser.
 */
function mergeFromPhases(
  bih: ByInitiatorHa,
  metric: 'extraction' | 'afforestation' | 'nitrogen',
  includeSketches: boolean,
): { state: number; municipal: number; private: number } {
  const phases: Array<keyof ByInitiatorHa['byPhase']> = includeSketches
    ? ['sketch', 'preliminary', 'approved', 'established']
    : ['preliminary', 'approved', 'established'];
  const out = { state: 0, municipal: 0, private: 0 };
  for (const ph of phases) {
    const block = bih.byPhase[ph][metric];
    for (const t of ['state', 'municipal', 'private'] as const) {
      out[t] += block[t].ha;
    }
  }
  return out;
}

describe('Initiative gauge phase merge', () => {
  const bih: ByInitiatorHa = {
    extraction: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
    afforestation: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
    nitrogen: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
    byPhase: {
      sketch: {
        extraction: {
          state: { ha: 1, projectCount: 1 },
          municipal: { ha: 0, projectCount: 0 },
          private: { ha: 0, projectCount: 0 },
        },
        afforestation: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
        nitrogen: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
      },
      preliminary: {
        extraction: {
          state: { ha: 2, projectCount: 1 },
          municipal: { ha: 0, projectCount: 0 },
          private: { ha: 0, projectCount: 0 },
        },
        afforestation: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
        nitrogen: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
      },
      approved: {
        extraction: {
          state: { ha: 0, projectCount: 0 },
          municipal: { ha: 0, projectCount: 0 },
          private: { ha: 0, projectCount: 0 },
        },
        afforestation: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
        nitrogen: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
      },
      established: {
        extraction: {
          state: { ha: 0, projectCount: 0 },
          municipal: { ha: 0, projectCount: 0 },
          private: { ha: 0, projectCount: 0 },
        },
        afforestation: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
        nitrogen: { state: { ha: 0, projectCount: 0 }, municipal: { ha: 0, projectCount: 0 }, private: { ha: 0, projectCount: 0 } },
      },
    },
  };

  it('uden skitser: kun preliminary+ (her state = 2 ha)', () => {
    expect(mergeFromPhases(bih, 'extraction', false).state).toBe(2);
  });

  it('med skitser: inkl. sketch (her state = 2 + 1)', () => {
    expect(mergeFromPhases(bih, 'extraction', true).state).toBe(3);
  });

  it('project-count mode excludes sketches unless explicitly included', () => {
    const data = {
      plans: [
        {
          projectDetails: [
            { schemeOrg: 'SGAV', schemeName: 'Kvælstofvådområder', extractionHa: 10 },
          ],
          sketchProjects: [
            { schemeOrg: 'NST', schemeName: 'Statsligt projekt', extractionHa: 20 },
          ],
        },
      ],
    };

    const dashboardData = data as unknown as DashboardData;

    expect(computeInitiatorCounts(dashboardData, 'extraction', false)).toEqual({
      state: 0,
      municipal: 1,
      private: 0,
    });
    expect(computeInitiatorCounts(dashboardData, 'extraction', true)).toEqual({
      state: 1,
      municipal: 1,
      private: 0,
    });
  });
});
