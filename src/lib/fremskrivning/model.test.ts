import { describe, it, expect } from 'vitest';
import {
  buildStackedBands,
  computePaceMetrics,
  valOfStage,
  FREMSKRIVNING_PROJECT_START,
} from './model';
import type { FremskrivningModel, FremskrivningStageData } from './types';
import { assessFremskrivningStatus } from './status';

function makeStage(
  id: FremskrivningStageData['id'],
  value: number,
  overrides: Partial<FremskrivningStageData> = {},
): FremskrivningStageData {
  return {
    id,
    kind: 'mars',
    marsPhase: 'established',
    label: id,
    certainty: 'Test',
    certColor: '#000',
    opacity: 1,
    locked: id === 'anlagt',
    description: 'test',
    value,
    projectCount: 1,
    ...overrides,
  };
}

function makeModel(
  realizedToday: number,
  elapsedYears = 2.4,
  totalYears = 4.0,
  target = 12776,
): FremskrivningModel {
  const asOf = new Date(FREMSKRIVNING_PROJECT_START.getTime() + elapsedYears * 365.25 * 86400000);
  const deadline = new Date(FREMSKRIVNING_PROJECT_START.getTime() + totalYears * 365.25 * 86400000);
  return {
    pillar: 'nitrogen',
    target,
    unit: 'ton N/år',
    unitShort: 'ton',
    deadlineYear: 2027,
    accentColor: '#0d9488',
    stages: [makeStage('anlagt', realizedToday)],
    time: {
      projectStart: FREMSKRIVNING_PROJECT_START,
      asOf,
      deadline,
      elapsedYears,
      totalYears,
      remainingYears: totalYears - elapsedYears,
      goalPctToday: (realizedToday / target) * 100,
    },
    pace: computePaceMetrics(realizedToday, target, FREMSKRIVNING_PROJECT_START, asOf, deadline),
  };
}

describe('valOfStage', () => {
  const marsForecastEnd = 128;
  const elapsed = 2.4;
  const total = 4.0;

  it('anlagt vokser lineært fra 0 til marsForecastEnd', () => {
    const stage = makeStage('anlagt', 77.3);
    expect(valOfStage(stage, 0, marsForecastEnd, elapsed, total)).toBe(0);
    expect(valOfStage(stage, total, marsForecastEnd, elapsed, total)).toBeCloseTo(marsForecastEnd, 5);
  });

  it('supplement_completed er konstant fra start', () => {
    const stage = makeStage('ksf_skov', 2859, {
      kind: 'supplement_completed',
      locked: false,
    });
    expect(valOfStage(stage, 0, marsForecastEnd, elapsed, total)).toBe(2859);
    expect(valOfStage(stage, total, marsForecastEnd, elapsed, total)).toBe(2859);
  });

  it('potentiale er 0 før i dag og fuldt ved deadline', () => {
    const stage = makeStage('godkendt', 638, { locked: false });
    expect(valOfStage(stage, elapsed, marsForecastEnd, elapsed, total)).toBe(0);
    expect(valOfStage(stage, total, marsForecastEnd, elapsed, total)).toBeCloseTo(638, 5);
  });
});

describe('buildStackedBands', () => {
  it('forecastEnd er højere end realizedToday ved lineær ekstrapolation', () => {
    const model = makeModel(77.3);
    const active = [makeStage('anlagt', 77.3)];
    const proj = buildStackedBands(active, model);
    expect(proj.forecastEnd).toBeGreaterThan(proj.realizedToday);
  });

  it('stackTotal inkluderer potentiale fra aktive valgfrie stadier', () => {
    const model = makeModel(77.3);
    const active = [
      makeStage('anlagt', 77.3),
      makeStage('godkendt', 638, { locked: false, opacity: 0.6 }),
    ];
    const proj = buildStackedBands(active, model);
    expect(proj.stackTotal).toBeCloseTo(proj.forecastEnd + 638, 5);
    expect(proj.scenarioTon).toBeCloseTo(77.3 + 638, 5);
  });

  it('forecastPct og stackPct matcher båndenes top ved deadline', () => {
    const model = makeModel(530, 2.4, 20.5, 250_000);
    const active = [
      makeStage('ksf_skov', 2859, { kind: 'supplement_completed', locked: false }),
      makeStage('anlagt', 530),
      makeStage('nst_igang', 2409, {
        kind: 'supplement_ongoing',
        locked: false,
        opacity: 0.35,
      }),
    ];
    const proj = buildStackedBands(active, model);
    const lastIdx = proj.sampleYears.length - 1;
    const kursTop = proj.bands.find((b) => b.stage.id === 'anlagt')!.top[lastIdx];
    const stackTop = proj.bands[proj.bands.length - 1].top[lastIdx];
    expect(proj.forecastEnd).toBeCloseTo(kursTop, 3);
    expect(proj.stackTotal).toBeCloseTo(stackTop, 3);
    expect(proj.forecastPct).toBeCloseTo((kursTop / 250_000) * 100, 2);
    expect(proj.stackPct).toBeCloseTo((stackTop / 250_000) * 100, 2);
  });

  it('bygger bånd i stablingsrækkefølge', () => {
    const model = makeModel(77.3);
    const active = [
      makeStage('anlagt', 77.3),
      makeStage('godkendt', 638, { locked: false }),
    ];
    const proj = buildStackedBands(active, model);
    expect(proj.bands).toHaveLength(2);
    expect(proj.bands[0].stage.id).toBe('anlagt');
    expect(proj.bands[1].stage.id).toBe('godkendt');
    expect(proj.bands[1].bottom[2]).toBeCloseTo(proj.bands[0].top[2], 5);
  });
});

describe('computePaceMetrics', () => {
  it('paceMultiple > 1 når tempo er for langsomt', () => {
    const start = new Date('2024-06-24');
    const asOf = new Date('2026-06-01');
    const deadline = new Date('2027-12-31');
    const pace = computePaceMetrics(26.7, 12776, start, asOf, deadline);
    expect(pace.paceMultiple).toBeGreaterThan(1);
    expect(pace.builtPacePerDay).toBeGreaterThan(0);
    expect(pace.neededPacePerDay).toBeGreaterThan(pace.builtPacePerDay);
  });
});

describe('assessFremskrivningStatus', () => {
  it('bruger stramme tærskler så labels ikke overdriver', () => {
    expect(assessFremskrivningStatus(100).key).toBe('reached');
    expect(assessFremskrivningStatus(96).key).toBe('ontrack');
    expect(assessFremskrivningStatus(85).key).toBe('veryclose');
    expect(assessFremskrivningStatus(64).key).toBe('close');
    expect(assessFremskrivningStatus(64).label).toBe('Delvis dækning');
    expect(assessFremskrivningStatus(16).key).toBe('behind');
    expect(assessFremskrivningStatus(5).key).toBe('behind');
  });
});
