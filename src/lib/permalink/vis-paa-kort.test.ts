import { describe, expect, it } from 'vitest';
import {
  buildVisPaaKortHref,
  visPaaKortKommuneB1,
  visPaaKortKommuneB3,
  visPaaKortKommuneB4,
  visPaaKortNationalOverlap,
} from './vis-paa-kort';

describe('buildVisPaaKortHref', () => {
  it('builds a national overlap link with sorted overlays and fullscreen', () => {
    expect(visPaaKortNationalOverlap()).toBe(
      '/natur?overlag=biodiv,natura2000,section3&fuldskaerm=1#geografi',
    );
  });

  it('builds kommune B3 (dyrket beskyttet natur) with N2000 overlay', () => {
    expect(visPaaKortKommuneB3('viborg')).toBe(
      '/kommuner/viborg?metric=natur&natur=b3&overlag=natura2000&fuldskaerm=1#kort',
    );
  });

  it('omits default B4 nature-layer slug', () => {
    expect(visPaaKortKommuneB4('aalborg')).toBe(
      '/kommuner/aalborg?metric=natur&overlag=biodiv,natura2000,section3&fuldskaerm=1#kort',
    );
  });

  it('builds kommune B1 with DCE overlay', () => {
    expect(visPaaKortKommuneB1('horsens')).toBe(
      '/kommuner/horsens?metric=natur&natur=dce&overlag=biodiv&fuldskaerm=1#kort',
    );
  });

  it('omits empty query and hash', () => {
    expect(buildVisPaaKortHref({ path: '/natur', hash: '' })).toBe('/natur');
  });
});
