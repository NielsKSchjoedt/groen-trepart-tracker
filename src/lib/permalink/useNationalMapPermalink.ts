import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ProjectPhase } from '@/lib/phase-config';
import type { NationalBasemapToken, NationalOverlayToken, NationalMapState } from './types';
import { decodeNationalMap, applyNationalMapToParams } from './slices/map-national';
import { DEFAULT_NATIONAL_MAP } from './defaults';
import { phasesEqual } from './phase-slugs';

export type MapLayerKind = 'catchments' | 'coastal' | 'kommuner';

export interface NationalMapOverlayBooleans {
  showWaterBodies: boolean;
  showMarkudledning: boolean;
  showDrikkevand: boolean;
  showNaturpotentiale: boolean;
  showNatura2000: boolean;
  showSection3: boolean;
  showKulstof: boolean;
  showKsfLavbund: boolean;
  showKsfSkov: boolean;
  showNst: boolean;
  bioActive: boolean;
  vnsOn: boolean;
}

export function basemapTokenToLayer(token: NationalBasemapToken | null): MapLayerKind | 'off' | null {
  if (token === 'kystvande') return 'coastal';
  if (token === 'hovedvandoplande') return 'catchments';
  if (token === 'kommuner') return 'kommuner';
  if (token === 'skjult') return 'off';
  return null;
}

export function layerToBasemapToken(
  layer: MapLayerKind,
  baseVisible: boolean,
): NationalBasemapToken | null {
  if (!baseVisible) return 'skjult';
  if (layer === 'coastal') return 'kystvande';
  if (layer === 'catchments') return 'hovedvandoplande';
  if (layer === 'kommuner') return 'kommuner';
  return null;
}

export function overlaysToBooleans(overlays: Set<NationalOverlayToken>): NationalMapOverlayBooleans {
  return {
    showWaterBodies: overlays.has('vandlegemer'),
    showMarkudledning: overlays.has('markudledning'),
    showDrikkevand: overlays.has('drikkevand'),
    showNaturpotentiale: overlays.has('naturpotentialer'),
    showNatura2000: overlays.has('natura2000'),
    showSection3: overlays.has('section3'),
    showKulstof: overlays.has('kulstof'),
    showKsfLavbund: overlays.has('ksf'),
    showKsfSkov: overlays.has('ksf'),
    showNst: overlays.has('nst'),
    bioActive: overlays.has('biodiv'),
    vnsOn: overlays.has('vns'),
  };
}

export function booleansToOverlays(b: Partial<NationalMapOverlayBooleans>): Set<NationalOverlayToken> {
  const out = new Set<NationalOverlayToken>();
  if (b.showSection3) out.add('section3');
  if (b.showNatura2000) out.add('natura2000');
  if (b.showMarkudledning) out.add('markudledning');
  if (b.showDrikkevand) out.add('drikkevand');
  if (b.showNaturpotentiale) out.add('naturpotentialer');
  if (b.bioActive) out.add('biodiv');
  if (b.vnsOn) out.add('vns');
  if (b.showWaterBodies) out.add('vandlegemer');
  if (b.showKulstof) out.add('kulstof');
  if (b.showKsfLavbund || b.showKsfSkov) out.add('ksf');
  if (b.showNst) out.add('nst');
  return out;
}

/** Sync national map slice to URL with debounced replace. */
export function useNationalMapPermalink() {
  const [searchParams, setSearchParams] = useSearchParams();
  const decoded = useMemo(() => decodeNationalMap(searchParams), [searchParams]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<Partial<NationalMapState> | null>(null);

  const flush = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!pendingRef.current) return;
    const patch = pendingRef.current;
    pendingRef.current = null;
    setSearchParams((prev) => {
      const current = decodeNationalMap(prev);
      const merged: NationalMapState = { ...current, ...patch };
      const next = new URLSearchParams(prev);
      applyNationalMapToParams(next, merged);
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const patchMap = useCallback(
    (partial: Partial<NationalMapState>, immediate?: boolean) => {
      pendingRef.current = { ...pendingRef.current, ...partial };
      if (immediate) {
        flush();
        return;
      }
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(flush, 300);
    },
    [flush],
  );

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const patchPhases = useCallback(
    (phases: Set<ProjectPhase>) => {
      patchMap({ phases });
    },
    [patchMap],
  );

  const patchOverlays = useCallback(
    (overlays: Set<NationalOverlayToken>) => {
      patchMap({ overlays });
    },
    [patchMap],
  );

  const patchFullscreen = useCallback(
    (fullscreen: boolean) => {
      patchMap({ fullscreen }, true);
    },
    [patchMap],
  );

  const patchBasemap = useCallback(
    (basemap: NationalBasemapToken | null) => {
      patchMap({ basemap }, true);
    },
    [patchMap],
  );

  return {
    decoded,
    patchMap,
    patchPhases,
    patchOverlays,
    patchFullscreen,
    patchBasemap,
    flush,
    defaults: DEFAULT_NATIONAL_MAP,
    phasesEqual,
  };
}
