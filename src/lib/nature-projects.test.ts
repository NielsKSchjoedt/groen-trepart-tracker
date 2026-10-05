import { describe, expect, it } from 'vitest';
import {
  isNaturePipelineMeasure,
  NATURE_EXCLUDED_MEASURES,
  NATURE_PIPELINE_MEASURES,
  uniqueByProjectId,
} from './nature-projects';

describe('nature project filter', () => {
  it('includes lavbund and all afforestation', () => {
    expect(isNaturePipelineMeasure('Lavbundsprojekter')).toBe(true);
    expect(isNaturePipelineMeasure('Skovrejsning')).toBe(true);
  });

  it('excludes nitrogen wetlands and the other DN-out measures', () => {
    for (const name of NATURE_EXCLUDED_MEASURES) {
      expect(isNaturePipelineMeasure(name)).toBe(false);
    }
  });

  it('covers the unique-project split 441+455 vs 632 excluded', () => {
    expect(NATURE_PIPELINE_MEASURES).toHaveLength(2);
    expect(NATURE_EXCLUDED_MEASURES.length).toBeGreaterThanOrEqual(5);
  });
});

describe('uniqueByProjectId', () => {
  it('keeps the first row when the same project sits in several plans', () => {
    const rows = [
      { id: 'a', plan: '1' },
      { id: 'b', plan: '1' },
      { id: 'a', plan: '2' },
    ];
    expect(uniqueByProjectId(rows)).toEqual([
      { id: 'a', plan: '1' },
      { id: 'b', plan: '1' },
    ]);
  });
});
