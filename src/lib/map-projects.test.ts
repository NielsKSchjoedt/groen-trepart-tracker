import { describe, expect, it } from 'vitest';
import { filterMapProjectsByKommune } from './map-projects';
import {
  overlappingKommuneKoderForProject,
  projectOverlapsKommune,
} from './mars-kommune-overlap';
import { shouldRenderProjectPolygonByScreenSize } from './map-projects';

describe('mars-kommune-overlap', () => {
  it('uses overlappingKommuneKoder when present', () => {
    const project = {
      geoId: 'a',
      kommuneKode: '0101',
      overlappingKommuneKoder: ['0101', '0187'],
    };
    expect(overlappingKommuneKoderForProject(project)).toEqual(['0101', '0187']);
    expect(projectOverlapsKommune(project, '0187')).toBe(true);
    expect(projectOverlapsKommune(project, '0461')).toBe(false);
  });

  it('falls back to kommuneKode when overlap list is missing', () => {
    const project = { geoId: 'b', kommuneKode: '0187' };
    expect(projectOverlapsKommune(project, '0187')).toBe(true);
  });
});

describe('filterMapProjectsByKommune', () => {
  it('includes projects that overlap the kommune, not only centroid match', () => {
    const projects = [{ geoId: 'g1', name: 'X', phase: 'sketch' as const, areaHa: 10 }];
    const overlap = { g1: ['0187', '0240'] };
    expect(filterMapProjectsByKommune(projects, '0187', overlap)).toHaveLength(1);
    expect(filterMapProjectsByKommune(projects, '0240', overlap)).toHaveLength(1);
    expect(filterMapProjectsByKommune(projects, '0461', overlap)).toHaveLength(0);
  });
});

describe('shouldRenderProjectPolygonByScreenSize', () => {
  it('keeps dots when the bbox is smaller than the marker', () => {
    expect(shouldRenderProjectPolygonByScreenSize(6, 4, 8)).toBe(false);
  });

  it('shows polygons when the bbox matches dot diameter', () => {
    expect(shouldRenderProjectPolygonByScreenSize(16, 10, 8)).toBe(true);
  });

  it('uses the larger bbox dimension for elongated shapes', () => {
    expect(shouldRenderProjectPolygonByScreenSize(20, 2, 8)).toBe(true);
    expect(shouldRenderProjectPolygonByScreenSize(10, 2, 8)).toBe(false);
  });
});
