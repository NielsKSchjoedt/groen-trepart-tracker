import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeDashboardPayload, normalizeRawData } from '@/lib/data';
import { computePillarProjects } from '@/lib/pillar-projects';
import type { DashboardData } from '@/lib/types';

/**
 * National-number integrity on the live ETL output.
 *
 * The 2026-10 audit found the project funnel, the fremskrivning and the headline
 * each computing "the pipeline" on a different basis — the funnel understated
 * lavbund anlagt as 607 ha against 735 ha on the same page. These invariants hold
 * for any daily snapshot: the funnel (frontend) and the national pipeline (ETL)
 * must agree stage by stage, and both must sit on the flat MARS project list.
 */
function loadDashboard(): DashboardData {
  const root = resolve(__dirname, '../..');
  const summary = JSON.parse(readFileSync(resolve(root, 'public/data/dashboard-summary.json'), 'utf8'));
  const details = JSON.parse(readFileSync(resolve(root, 'public/data/project-details.json'), 'utf8'));
  return normalizeRawData(mergeDashboardPayload(summary, details));
}

const data = loadDashboard();

const PILLAR_FIELD = {
  nitrogen: 'nitrogenT',
  extraction: 'extractionHa',
  afforestation: 'afforestationHa',
} as const;

const STAGES = ['preliminary_grant', 'establishment_grant', 'established'] as const;

describe('national pipeline: funnel ≡ ETL', () => {
  for (const [pillar, field] of Object.entries(PILLAR_FIELD)) {
    it(`${pillar}: every stage has the same project count and effect`, () => {
      const funnel = computePillarProjects(data, pillar as keyof typeof PILLAR_FIELD);
      const etl = data.national.byPipelinePhase?.[pillar as keyof typeof PILLAR_FIELD];
      expect(etl).toBeTruthy();
      for (const stage of STAGES) {
        const rows = funnel[stage];
        const sum = rows.reduce((s, p) => s + ((p as unknown as Record<string, number>)[field] ?? 0), 0);
        const etlRow = etl![stage];
        expect(rows.length, `${pillar}/${stage} count`).toBe(etlRow.count);
        expect(sum, `${pillar}/${stage} ${field}`).toBeCloseTo(etlRow[field], 0);
      }
    });
  }

  it('each project appears at most once per stage', () => {
    for (const pillar of Object.keys(PILLAR_FIELD)) {
      const funnel = computePillarProjects(data, pillar as keyof typeof PILLAR_FIELD);
      for (const stage of STAGES) {
        const ids = funnel[stage].map((p) => p.id);
        expect(new Set(ids).size, `${pillar}/${stage}`).toBe(ids.length);
      }
    }
  });
});

describe('national headline', () => {
  it('project phase counts sum to the national total (no plan double counting)', () => {
    const p = data.national.projects;
    expect(p.assessed + p.approved + p.established).toBe(p.total);
  });
});
