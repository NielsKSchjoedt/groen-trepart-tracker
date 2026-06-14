import { describe, expect, it } from 'vitest';
import { parseViewState, toSearchParams, resolveRouteContext } from './compose';
import { DEFAULT_NATIONAL_MAP } from './defaults';
import { phasesEqual } from './phase-slugs';
import { buildSectionPermalink } from './slices/section';
import {
  extractKommuneDetailSearch,
  sanitizeSearchParamsForRoute,
} from './route-params';

describe('permalink', () => {
  it('round-trips national map state with defaults omitted', () => {
    const state = {
      mapNational: {
        basemap: 'skjult' as const,
        overlays: new Set(['section3', 'natura2000'] as const),
        phases: new Set(['established', 'preliminary'] as const),
        fullscreen: true,
      },
    };
    const ctx = resolveRouteContext('/natur');
    const params = toSearchParams(state, ctx);
    expect(params.get('kort')).toBe('skjult');
    expect(params.get('overlag')).toBe('natura2000,section3');
    expect(params.get('faser')).toBe('foru,anlagt');
    expect(params.get('fuldskaerm')).toBe('1');

    const parsed = parseViewState({
      pathname: '/natur',
      search: params.toString() ? `?${params.toString()}` : '',
      hash: '',
    });
    expect(parsed.mapNational.basemap).toBe('skjult');
    expect(parsed.mapNational.overlays.has('section3')).toBe(true);
    expect(parsed.mapNational.fullscreen).toBe(true);
    expect(parsed.mapNational.phases.has('preliminary')).toBe(true);
  });

  it('accepts legacy lag=kyst as basemap alias', () => {
    const parsed = parseViewState({
      pathname: '/kvælstof',
      search: '?lag=kyst',
      hash: '',
    });
    expect(parsed.mapNational.basemap).toBe('kystvande');
  });

  it('accepts legacy bio and vns as overlays', () => {
    const parsed = parseViewState({
      pathname: '/natur',
      search: '?bio=maalretning-30&vns=1',
      hash: '',
    });
    expect(parsed.mapNational.overlays.has('biodiv')).toBe(true);
    expect(parsed.mapNational.overlays.has('vns')).toBe(true);
  });

  it('parses projekt for mars, ksf, and nst', () => {
    expect(
      parseViewState({ pathname: '/natur', search: '?projekt=mars:abc123', hash: '' }).projectOpen,
    ).toEqual({ source: 'mars', id: 'abc123' });
    expect(
      parseViewState({ pathname: '/skovrejsning', search: '?projekt=ksf:2024-346', hash: '' }).projectOpen,
    ).toEqual({ source: 'ksf', id: '2024-346' });
    expect(
      parseViewState({ pathname: '/skovrejsning', search: '?projekt=nst:Test', hash: '' }).projectOpen,
    ).toEqual({ source: 'nst', id: 'Test' });
  });

  it('ignores unknown query params', () => {
    const parsed = parseViewState({
      pathname: '/lavbund',
      search: '?unknown=foo&faser=not-a-phase',
      hash: '#oekonomi',
    });
    expect(parsed.section).toBe('oekonomi');
    expect(phasesEqual(parsed.mapNational.phases, DEFAULT_NATIONAL_MAP.phases)).toBe(true);
  });

  it('round-trips fremskrivning and projektenhed', () => {
    const ctx = resolveRouteContext('/skovrejsning');
    const params = toSearchParams(
      {
        fremskrivning: { activeStages: new Set(['forundersoegt']), explicit: true },
        projectsMetric: 'count',
      },
      ctx,
    );
    expect(params.get('frem')).toBe('forundersoegt');
    expect(params.get('projektenhed')).toBe('antal');
  });

  it('preserves explicit empty fremskrivning (all optional stages off)', () => {
    const ctx = resolveRouteContext('/skovrejsning');
    const params = toSearchParams(
      { fremskrivning: { activeStages: new Set(), explicit: true } },
      ctx,
    );
    expect(params.get('frem')).toBe('ingen');
    const parsed = parseViewState({
      pathname: '/skovrejsning',
      search: `?${params.toString()}#fremskrivning`,
      hash: '#fremskrivning',
    });
    expect(parsed.fremskrivning.explicit).toBe(true);
    expect(parsed.fremskrivning.activeStages.size).toBe(0);
    expect(parsed.section).toBe('fremskrivning');
  });

  it('builds readable URL when frem is empty and section hash is set', () => {
    const ctx = resolveRouteContext('/skovrejsning');
    const params = toSearchParams(
      { fremskrivning: { activeStages: new Set(), explicit: true }, section: 'fremskrivning' },
      ctx,
    );
    const url = `https://example.test/skovrejsning?${params.toString()}#fremskrivning`;
    expect(url).toBe('https://example.test/skovrejsning?frem=ingen#fremskrivning');
    expect(url).not.toContain('?frem=#');
  });

  it('round-trips kommune standings', () => {
    const ctx = resolveRouteContext('/kommuner');
    const params = toSearchParams(
      {
        standings: { sort: 'idxSkov', mode: 'relativ', region: 'Alle regioner' },
      },
      ctx,
    );
    expect(params.get('sort')).toBe('skov');
    expect(params.get('visning')).toBeNull();
  });

  it('resolves fane alias to section', () => {
    const parsed = parseViewState({
      pathname: '/kommuner/aalborg',
      search: '?fane=projekter',
      hash: '',
    });
    expect(parsed.section).toBe('projekter');
  });

  it('builds section permalink with hash and without fane alias', () => {
    const url = buildSectionPermalink('oekonomi', 'https://example.test/skovrejsning?frem=anlagt&fane=projekter');
    expect(url).toBe('https://example.test/skovrejsning?frem=anlagt#oekonomi');
  });

  it('strips national and list params from kommune detail URLs', () => {
    const dirty = new URLSearchParams(
      'sort=skov&metric=skovrejsning&projekt=mars:abc&kort=kystvande&frem=anlagt&visning=ansvar',
    );
    const clean = sanitizeSearchParamsForRoute(dirty, { kind: 'kommune-detail' });
    expect(clean.get('metric')).toBe('skovrejsning');
    expect(clean.get('sort')).toBeNull();
    expect(clean.get('projekt')).toBe('mars:abc');
    expect(clean.get('kort')).toBeNull();
    expect(clean.get('frem')).toBeNull();
    expect(clean.get('visning')).toBeNull();
  });

  it('extractKommuneDetailSearch drops list-only and project params', () => {
    const search = extractKommuneDetailSearch(
      '?sort=skov&metric=skovrejsning&projekt=mars:abc&visning=ansvar&faser=anlagt',
    );
    expect(search).toBe('?metric=skovrejsning&faser=anlagt');
  });

  it('parseViewState ignores national map params on kommune detail', () => {
    const parsed = parseViewState({
      pathname: '/kommuner/kolding',
      search: '?kort=kystvande&overlag=ksf&sort=skov&metric=skovrejsning',
      hash: '#status',
    });
    expect(parsed.section).toBe('status');
    expect(parsed.standings.sort).toBe('idxLavbund');
    expect(parsed.mapNational.basemap).toBeNull();
    expect(parsed.mapNational.overlays.size).toBe(0);
    expect(parsed.fremskrivning.explicit).toBe(false);
  });
});
