import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mergeDashboardPayload, normalizeRawData } from '@/lib/data';
import { buildEffectDomains } from '@/lib/model';
import type { CoastalWaterStatusData, DashboardData } from '@/lib/types';

/**
 * Coastal-water status (VP3-II, December 2025) — invariants on the ETL output and
 * on how the Vandmiljø effect card reads it.
 */
const root = resolve(__dirname, '../..');
const coastal: CoastalWaterStatusData = JSON.parse(
  readFileSync(resolve(root, 'public/data/coastal-water-status.json'), 'utf8'),
);

function loadDashboard(): DashboardData {
  const summary = JSON.parse(readFileSync(resolve(root, 'public/data/dashboard-summary.json'), 'utf8'));
  const details = JSON.parse(readFileSync(resolve(root, 'public/data/project-details.json'), 'utf8'));
  return normalizeRawData(mergeDashboardPayload(summary, details));
}

const GOOD = new Set(['God', 'Høj']);
const RANK: Record<string, number> = { Høj: 1, God: 2, Moderat: 3, Ringe: 4, Dårlig: 5 };

describe('coastal-water-status.json', () => {
  const waters = Object.values(coastal.waters);

  it('covers all 109 coastal waters from the revisited plan', () => {
    expect(coastal.summary.total).toBe(109);
    expect(waters).toHaveLength(109);
    expect(coastal.plan?.wfsLayer).toBe('vp3_2endelig2025:vp3_2e2025_marin_samlet');
  });

  it('summary counts match the per-water statuses', () => {
    const count = (key: 'ecologicalStatus' | 'ecologicalStatusExclNationalSubstances') =>
      waters.reduce<Record<string, number>>((acc, w) => {
        const s = w[key] ?? 'Ukendt';
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      }, {});
    expect(count('ecologicalStatus')).toEqual(coastal.summary.ecologicalStatus);
    expect(count('ecologicalStatusExclNationalSubstances')).toEqual(
      coastal.summary.ecologicalStatusExclNationalSubstances,
    );
  });

  it('status without national substances is never worse than the official status', () => {
    for (const w of waters) {
      const excl = w.ecologicalStatusExclNationalSubstances;
      if (!excl || !(excl in RANK)) continue;
      expect(RANK[excl]).toBeLessThanOrEqual(RANK[w.ecologicalStatus]);
    }
  });

  it('every water links to its vandplandata.dk page and has no macroalgae field', () => {
    for (const w of waters) {
      expect(w.vandplandataUrl).toMatch(/^https:\/\/vandplandata\.dk\/vp3_2endelig2025\//);
      expect('macroalgae' in w.subIndicators).toBe(false);
    }
  });
});

describe('Vandmiljø effect card', () => {
  const data = loadDashboard();

  it('headline is the official good count; secondary line the count without national substances', () => {
    const vand = buildEffectDomains(data, null, coastal).find((d) => d.id === 'vand');
    expect(vand?.reframe.kind).toBe('ecological-snapshot');
    if (vand?.reframe.kind !== 'ecological-snapshot') return;

    const officialGood = Object.values(coastal.waters).filter((w) => GOOD.has(w.ecologicalStatus)).length;
    const exclGood = Object.values(coastal.waters).filter((w) =>
      GOOD.has(w.ecologicalStatusExclNationalSubstances ?? ''),
    ).length;

    expect(vand.reframe.goodCount).toBe(officialGood);
    expect(vand.valueText).toBe(String(officialGood));
    expect(vand.reframe.goodCountExclNationalSubstances).toBe(exclGood);
    expect(vand.reframe.exclNationalSubstancesLine).toContain(`${exclGood} af 109`);
    if (officialGood === 0) expect(vand.reframe.verdictLabel).toBe('Ingen i god tilstand');
  });

  it('omits the secondary line for data without the derived field', () => {
    const legacy: CoastalWaterStatusData = {
      ...coastal,
      summary: { ...coastal.summary, ecologicalStatusExclNationalSubstances: undefined },
    };
    const vand = buildEffectDomains(data, null, legacy).find((d) => d.id === 'vand');
    if (vand?.reframe.kind !== 'ecological-snapshot') throw new Error('unexpected reframe');
    expect(vand.reframe.goodCountExclNationalSubstances).toBeNull();
    expect(vand.reframe.exclNationalSubstancesLine).toBeNull();
  });
});
