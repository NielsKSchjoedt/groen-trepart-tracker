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

/** Fixed snapshot date — matches data/project-details.json builtAt (2026-06-14). */
const FIXTURE_NOW = new Date('2026-06-14');

function loadFixtureData(): { data: ProjectDetailsFile; changelog: ProjectChangelog } {
  const root = resolve(__dirname, '../..');
  const data = JSON.parse(
    readFileSync(resolve(root, 'data/project-details.json'), 'utf8'),
  ) as ProjectDetailsFile;
  const changelog = JSON.parse(
    readFileSync(resolve(root, 'data/project-changelog.json'), 'utf8'),
  ) as ProjectChangelog;
  return { data, changelog };
}

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

  it('Vejle: counts, ha-shares and medians match snapshot', () => {
    const m = computeKommuneProces(data, 'Vejle', FIXTURE_NOW, changelog);
    expect(m.projekter).toBe(65);
    expect(m.ha).toBe(2573);
    expect(m.faser.preliminary).toBeCloseTo(45, 0);
    expect(m.faser.approved).toBeCloseTo(53, 0);
    expect(m.faser.established).toBeCloseTo(2, 0);
    expect(m.faser.preliminary + m.faser.approved + m.faser.established).toBe(100);
    expect(m.godkendtPlus).toBe(55);
    expect(m.medianMdr.preliminary).toBe(11);
    expect(m.medianMdr.approved).toBe(13);
    expect(m.naboer.length).toBeGreaterThan(0);
    expect(m.naboer).toEqual([...m.naboer].sort((a, b) => a.localeCompare(b, 'da')));
    // Momentum uses lastChanged when changelog absent (±2 pga. data-opdatering)
    expect(m.momentum6mdr.projekter).toBeGreaterThanOrEqual(25);
    expect(m.momentum6mdr.projekter).toBeLessThanOrEqual(31);
    expect(m.momentum6mdr.ha).toBeGreaterThanOrEqual(390);
    expect(m.momentum6mdr.ha).toBeLessThanOrEqual(420);
  });

  it('Kolding: exact fixture values', () => {
    const m = computeKommuneProces(data, 'Kolding', FIXTURE_NOW, changelog);
    expect(m.projekter).toBe(59);
    expect(m.ha).toBe(1284);
    expect(m.faser).toEqual({ preliminary: 60, approved: 40, established: 0 });
    expect(m.godkendtPlus).toBe(40);
    expect(m.momentum6mdr).toEqual({ projekter: 14, ha: 963 });
    expect(m.medianMdr).toEqual({ preliminary: 11, approved: 13 });
  });

  it('Haderslev: counts, ha-shares and medians match snapshot', () => {
    const m = computeKommuneProces(data, 'Haderslev', FIXTURE_NOW, changelog);
    expect(m.projekter).toBe(43);
    expect(m.ha).toBe(2192);
    expect(m.faser.preliminary).toBeCloseTo(41, 0);
    expect(m.faser.approved).toBeCloseTo(59, 0);
    expect(m.faser.established).toBe(0);
    expect(m.godkendtPlus).toBe(59);
    expect(m.medianMdr.preliminary).toBe(4);
    expect(m.medianMdr.approved).toBe(13);
    expect(m.momentum6mdr.projekter).toBeGreaterThanOrEqual(16);
    expect(m.momentum6mdr.projekter).toBeLessThanOrEqual(24);
    expect(m.momentum6mdr.ha).toBeGreaterThanOrEqual(1100);
    expect(m.momentum6mdr.ha).toBeLessThanOrEqual(1300);
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
    expect(groups.other).toContain('Horsens');
    expect(groups.other).toContain('Samsø');
    expect(groups.other).not.toContain('Odense');
    expect(groups.border).not.toContain('Horsens');
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
