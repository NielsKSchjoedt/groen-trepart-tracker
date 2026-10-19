import { describe, expect, it } from 'vitest';
import {
  applyKommuneMapViewState,
  describeKommuneMapView,
  parseKommuneMapViewState,
} from '@/lib/kommune-map-params';
import { DEFAULT_PHASES, phasesDifferFromDefault } from '@/lib/kommune-metrics';

describe('kommune-map-params', () => {
  it('round-trips non-default map view in URL params', () => {
    const params = new URLSearchParams('metric=lavbund');
    applyKommuneMapViewState(params, {
      fordelingViewMode: 'actual',
      choroplethScale: 'ansvar',
      natureLayer: 'b4-beskyttet',
      selectedPhases: new Set(['sketch', 'established']),
      activeSupplements: new Set(['ksf']),
      mapOverlays: new Set(['kulstof', 'vandlegemer']),
      fullscreen: true,
    });

    expect(params.get('skala')).toBe('ansvar');
    expect(params.get('tilvalg')).toBe('ksf');
    expect(params.get('faser')).toBe('skitse,anlagt');
    expect(params.get('overlag')).toBe('kulstof,vandlegemer');
    expect(params.get('fuldskaerm')).toBe('1');

    const parsed = parseKommuneMapViewState(params);
    expect(parsed.choroplethScale).toBe('ansvar');
    expect(parsed.activeSupplements.has('ksf')).toBe(true);
    expect(parsed.mapOverlays.has('kulstof')).toBe(true);
    expect(parsed.mapOverlays.has('vandlegemer')).toBe(true);
    expect(parsed.selectedPhases.has('sketch')).toBe(true);
    expect(parsed.selectedPhases.has('established')).toBe(true);
    expect(parsed.fullscreen).toBe(true);
  });

  it('describes the active view in plain language', () => {
    const caption = describeKommuneMapView('extraction', {
      fordelingViewMode: 'actual',
      choroplethScale: 'ansvar',
      natureLayer: 'b4-beskyttet',
      selectedPhases: new Set(['preliminary', 'approved', 'established']),
      activeSupplements: new Set(),
      mapOverlays: new Set(),
      fullscreen: false,
    });
    expect(caption).toContain('Lavbund');
    expect(caption).toContain('ift. ansvar');
  });

  it('omits faser when the selection is the pipeline default', () => {
    const params = new URLSearchParams('metric=lavbund');
    applyKommuneMapViewState(params, {
      fordelingViewMode: 'actual',
      choroplethScale: 'absolute',
      natureLayer: 'b4-beskyttet',
      selectedPhases: new Set(DEFAULT_PHASES),
      activeSupplements: new Set(),
      mapOverlays: new Set(),
      fullscreen: false,
    });
    expect(params.get('faser')).toBeNull();
    const parsed = parseKommuneMapViewState(new URLSearchParams());
    expect(parsed.selectedPhases.has('preliminary')).toBe(true);
    expect(parsed.selectedPhases.has('approved')).toBe(true);
    expect(parsed.selectedPhases.has('established')).toBe(true);
    expect(parsed.selectedPhases.has('sketch')).toBe(false);
    expect(phasesDifferFromDefault(parsed.selectedPhases)).toBe(false);
    expect(phasesDifferFromDefault(new Set(['established']))).toBe(true);
  });
});
