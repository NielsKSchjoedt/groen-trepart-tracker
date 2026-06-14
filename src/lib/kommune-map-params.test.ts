import { describe, expect, it } from 'vitest';
import {
  applyKommuneMapViewState,
  describeKommuneMapView,
  parseKommuneMapViewState,
} from '@/lib/kommune-map-params';

describe('kommune-map-params', () => {
  it('round-trips non-default map view in URL params', () => {
    const params = new URLSearchParams('metric=lavbund');
    applyKommuneMapViewState(params, {
      fordelingViewMode: 'actual',
      choroplethScale: 'ansvar',
      natureLayer: 'b4-beskyttet',
      selectedPhases: new Set(['preliminary', 'approved', 'established']),
      activeSupplements: new Set(['ksf']),
    });

    expect(params.get('skala')).toBe('ansvar');
    expect(params.get('tilvalg')).toBe('ksf');
    expect(params.get('faser')).toBe('foru,godk,anlagt');

    const parsed = parseKommuneMapViewState(params);
    expect(parsed.choroplethScale).toBe('ansvar');
    expect(parsed.activeSupplements.has('ksf')).toBe(true);
    expect(parsed.selectedPhases.has('preliminary')).toBe(true);
    expect(parsed.selectedPhases.has('approved')).toBe(true);
    expect(parsed.selectedPhases.has('established')).toBe(true);
  });

  it('describes the active view in plain language', () => {
    const caption = describeKommuneMapView('extraction', {
      fordelingViewMode: 'actual',
      choroplethScale: 'ansvar',
      natureLayer: 'b4-beskyttet',
      selectedPhases: new Set(['preliminary', 'approved', 'established']),
      activeSupplements: new Set(),
    });
    expect(caption).toContain('Lavbund');
    expect(caption).toContain('ift. ansvar');
  });
});
