import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  averageNeighborMetrics,
  buildComparisonKommuneGroups,
  computeKommuneProces,
  computeNationalProces,
  defaultComparisonKommune,
  defaultNeighbor,
  listKommunerWithProcesData,
  groupMeasureMix,
  roundPhasePcts,
  shortMilestoneLabel,
} from '@/lib/kommune-proces';
import type { ProjectChangelog } from '@/lib/types';
import type { ProjectDetailsFile } from '@/lib/kommune-proces';

let cached: { data: ProjectDetailsFile; changelog: ProjectChangelog; now: Date } | null = null;

/**
 * Reads the live ETL output. `data/project-details.json` is rewritten by the
 * daily data job, so these tests assert invariants and plausible ranges rather
 * than snapshot values — see the note on the kommune fixtures below.
 */
function loadFixtureData(): { data: ProjectDetailsFile; changelog: ProjectChangelog; now: Date } {
  if (cached) return cached;
  const root = resolve(__dirname, '../..');
  const raw = JSON.parse(
    readFileSync(resolve(root, 'data/project-details.json'), 'utf8'),
  ) as ProjectDetailsFile & { builtAt?: string };
  const changelog = JSON.parse(
    readFileSync(resolve(root, 'data/project-changelog.json'), 'utf8'),
  ) as ProjectChangelog;
  // The 6-month momentum window is relative to the snapshot, not to wall clock.
  const now = raw.builtAt ? new Date(raw.builtAt) : new Date();
  cached = { data: raw, changelog, now };
  return cached;
}

const FIXTURE_NOW = loadFixtureData().now;

describe('roundPhasePcts', () => {
  it('corrects remainder onto preliminary so shares sum to 100', () => {
    expect(roundPhasePcts(33.3, 33.3, 33.3)).toEqual({
      preliminary: 34,
      approved: 33,
      established: 33,
    });
  });

  it('handles zero totals', () => {
    expect(roundPhasePcts(0, 0, 0)).toEqual({
      preliminary: 0,
      approved: 0,
      established: 0,
    });
  });
});

describe('groupMeasureMix', () => {
  it('maps known measure names to coarse groups', () => {
    expect(groupMeasureMix('Skovrejsning')).toBe('skov');
    expect(groupMeasureMix('Lavbundsprojekter')).toBe('lavbund/vådområde');
    expect(groupMeasureMix('Kvælstofvådområder')).toBe('lavbund/vådområde');
    expect(groupMeasureMix('Ekstensivering')).toBe('ekstensivering');
    expect(groupMeasureMix('Naturgenopretning')).toBe('andet/natur');
  });
});

describe('shortMilestoneLabel', () => {
  it('returns short Danish phase labels', () => {
    expect(shortMilestoneLabel('Etableringstilsagn', 'approved')).toBe('Etableringstilsagn');
    expect(shortMilestoneLabel('Forundersøgelsestilsagn', 'preliminary')).toBe('Forundersøgelse');
    expect(shortMilestoneLabel('Anlagt', 'established')).toBe('Anlagt');
  });
});

describe('computeKommuneProces — real data fixtures', () => {
  const { data, changelog } = loadFixtureData();

  /**
   * These three kommuner are large, long-running MARS participants, so they
   * always carry a substantial pipeline. The daily data job keeps moving the
   * exact counts, so assert the invariants that must hold for any snapshot —
   * shares summing to 100, godkendtPlus matching its parts, medians and
   * momentum staying inside their own totals — plus a floor that catches the
   * data silently going empty.
   */
  function expectProcesInvariants(m: ReturnType<typeof computeKommuneProces>) {
    expect(m.projekter).toBeGreaterThan(10);
    expect(m.ha).toBeGreaterThan(100);

    for (const pct of Object.values(m.faser)) {
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(100);
    }
    expect(m.faser.preliminary + m.faser.approved + m.faser.established).toBe(100);
    expect(m.godkendtPlus).toBe(m.faser.approved + m.faser.established);

    // Medians are months in a phase — present, positive and not absurd.
    for (const median of [m.medianMdr.preliminary, m.medianMdr.approved]) {
      if (median !== null) {
        expect(median).toBeGreaterThan(0);
        expect(median).toBeLessThan(120);
      }
    }

    // Momentum is a 6-month subset, so it can never exceed the whole.
    expect(m.momentum6mdr.projekter).toBeGreaterThanOrEqual(0);
    expect(m.momentum6mdr.projekter).toBeLessThanOrEqual(m.projekter);
    expect(m.momentum6mdr.ha).toBeGreaterThanOrEqual(0);
    expect(m.momentum6mdr.ha).toBeLessThanOrEqual(m.ha);
  }

  it('Vejle: phase shares, medians and momentum stay consistent', () => {
    const m = computeKommuneProces(data, 'Vejle', FIXTURE_NOW, changelog);
    expectProcesInvariants(m);
    expect(m.naboer.length).toBeGreaterThan(0);
    expect(m.naboer).toEqual([...m.naboer].sort((a, b) => a.localeCompare(b, 'da')));
  });

  it('Kolding: phase shares, medians and momentum stay consistent', () => {
    const m = computeKommuneProces(data, 'Kolding', FIXTURE_NOW, changelog);
    expectProcesInvariants(m);
  });

  it('Haderslev: phase shares, medians and momentum stay consistent', () => {
    const m = computeKommuneProces(data, 'Haderslev', FIXTURE_NOW, changelog);
    expectProcesInvariants(m);
  });

  it('excludes cancelled projects', () => {
    const synthetic: ProjectDetailsFile = {
      plans: [{
        id: 'p1',
        name: 'Testplan',
        projectDetails: [
          {
            id: 'a',
            name: 'Active',
            geoId: 'g1',
            phase: 'preliminary',
            statusName: 'Forundersøgelsestilsagn',
            statusNr: 6,
            measureName: 'Skovrejsning',
            schemeName: 'Skov',
            schemeOrg: 'SGAV',
            schemeUrl: '',
            nitrogenT: 0,
            extractionHa: 0,
            afforestationHa: 10,
            areaHa: 10,
            appliedAt: '2025-01-01T00:00:00Z',
            lastChanged: '2025-06-01T00:00:00Z',
            kommuneNavn: 'Testby',
          },
          {
            id: 'b',
            name: 'Cancelled',
            geoId: 'g2',
            phase: 'approved',
            pipelinePhase: 'cancelled',
            isCancelled: true,
            statusName: 'Annulleret',
            statusNr: 3,
            measureName: 'Skovrejsning',
            schemeName: 'Skov',
            schemeOrg: 'SGAV',
            schemeUrl: '',
            nitrogenT: 0,
            extractionHa: 0,
            afforestationHa: 50,
            areaHa: 50,
            appliedAt: '2025-01-01T00:00:00Z',
            lastChanged: '2025-06-01T00:00:00Z',
            kommuneNavn: 'Testby',
          },
        ],
      }],
    };
    const m = computeKommuneProces(synthetic, 'Testby', FIXTURE_NOW);
    expect(m.projekter).toBe(1);
    expect(m.ha).toBe(10);
  });
});

describe('comparison kommune groups', () => {
  const { data, changelog } = loadFixtureData();

  it('buildComparisonKommuneGroups puts grænsenaboer first', () => {
    const all = listKommunerWithProcesData(data);
    const borderGeo = ['Assens', 'Faaborg-Midtfyn', 'Kerteminde', 'Nordfyns'];
    const groups = buildComparisonKommuneGroups('Odense', all, borderGeo);
    expect(groups.border).toEqual(
      borderGeo.filter((n) => all.includes(n)).sort((a, b) => a.localeCompare(b, 'da')),
    );
    // Trepart-naboer without a shared border belong in «Øvrige», not first.
    // Only assert the ones the current snapshot actually has projects for —
    // a kommune can drop out of MARS entirely between data refreshes.
    for (const trepartOnly of ['Horsens', 'Samsø']) {
      if (!all.includes(trepartOnly)) continue;
      expect(groups.other).toContain(trepartOnly);
      expect(groups.border).not.toContain(trepartOnly);
    }
    expect(groups.other).not.toContain('Odense');
    // border and other partition `all` minus the kommune itself.
    expect([...groups.border, ...groups.other].sort()).toEqual(
      all.filter((n) => n !== 'Odense').sort(),
    );
  });

  it('defaultComparisonKommune prefers grænsenabo with most projects', () => {
    const all = listKommunerWithProcesData(data);
    const borderGeo = ['Assens', 'Faaborg-Midtfyn', 'Kerteminde', 'Nordfyns'];
    const groups = buildComparisonKommuneGroups('Odense', all, borderGeo);
    const pick = defaultComparisonKommune(
      groups,
      (navn) => computeKommuneProces(data, navn, FIXTURE_NOW, changelog),
    );
    expect(pick).toBeTruthy();
    expect(groups.border).toContain(pick!);
  });
});

describe('neighbor helpers', () => {
  const { data, changelog } = loadFixtureData();

  it('averageNeighborMetrics returns mean phase shares', () => {
    const vejle = computeKommuneProces(data, 'Vejle', FIXTURE_NOW, changelog);
    const neighborMetrics = vejle.naboer.slice(0, 3).map((n) =>
      computeKommuneProces(data, n, FIXTURE_NOW, changelog),
    );
    const avg = averageNeighborMetrics(neighborMetrics);
    expect(avg.faser.preliminary + avg.faser.approved + avg.faser.established).toBe(100);
    expect(avg.godkendtPlus).toBe(avg.faser.approved + avg.faser.established);
  });

  it('defaultNeighbor picks kommune with most projects', () => {
    const vejle = computeKommuneProces(data, 'Vejle', FIXTURE_NOW, changelog);
    const byNavn = new Map(
      vejle.naboer.map((n) => [n, computeKommuneProces(data, n, FIXTURE_NOW, changelog)]),
    );
    const pick = defaultNeighbor(vejle.naboer, byNavn);
    expect(pick).toBeTruthy();
    const pickCount = byNavn.get(pick!)?.projekter ?? 0;
    for (const n of vejle.naboer) {
      expect(byNavn.get(n)!.projekter).toBeLessThanOrEqual(pickCount);
    }
  });

  it('computeNationalProces aggregates all kommuner', () => {
    const nat = computeNationalProces(data, FIXTURE_NOW, changelog);
    expect(nat.projekter).toBeGreaterThan(100);
    expect(nat.faser.preliminary + nat.faser.approved + nat.faser.established).toBe(100);
  });
});
