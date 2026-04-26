import { useEffect, useRef, useMemo, useCallback } from 'react';
import type { SetStateAction } from 'react';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { Leaf, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AREALDATA_WMS_BASE, BIODIV_WMS_LAYERS, type BiodivWmsId, parseBioParam, serializeBioParam } from '@/lib/biodiv-map';
import { loadVandNaturSkovProjekter } from '@/lib/data';
const PARAM_BIO = 'bio';
const PARAM_VNS = 'vns';

interface DenmarkMapBiodivProps {
  map: L.Map | null;
  isStub: boolean;
  searchParams: URLSearchParams;
  setSearchParams: (u: SetStateAction<URLSearchParams>) => void;
}

/**
 * Biodiversitetslag: WMS tiles (4) + optional VNS 2026 vector overlay. Syncs ?bio= & ?vns=.
 */
export function DenmarkMapBiodiv({ map, isStub, searchParams, setSearchParams }: DenmarkMapBiodivProps) {
  const wmsByIdRef = useRef<Map<string, L.TileLayer.WMS>>(new Map());
  const vnsLayerRef = useRef<L.GeoJSON | null>(null);

  const bioActive = useMemo(
    () => parseBioParam(searchParams.get(PARAM_BIO)),
    [searchParams],
  );
  const vnsOn = searchParams.get(PARAM_VNS) === '1';

  const setBio = useCallback(
    (id: BiodivWmsId, on: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const cur = new Set(parseBioParam(next.get(PARAM_BIO)));
        if (on) cur.add(id);
        else cur.delete(id);
        const s = serializeBioParam([...cur] as BiodivWmsId[]);
        if (s) next.set(PARAM_BIO, s);
        else next.delete(PARAM_BIO);
        return next;
      });
    },
    [setSearchParams],
  );

  const setVns = useCallback(
    (on: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (on) next.set(PARAM_VNS, '1');
        else next.delete(PARAM_VNS);
        return next;
      });
    },
    [setSearchParams],
  );

  // WMS
  useEffect(() => {
    if (!map || isStub) return;
    if (!map.getPane('biodivWms')) {
      const pw = map.createPane('biodivWms');
      pw.style.zIndex = '250';
    }
    const wmsMap = wmsByIdRef.current;
    wmsMap.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch {
        /* ignore */
      }
    });
    wmsMap.clear();
    for (const id of bioActive) {
      const def = BIODIV_WMS_LAYERS.find((d) => d.id === id);
      if (!def) continue;
      const w = L.tileLayer.wms(AREALDATA_WMS_BASE, {
        layers: def.layer,
        format: 'image/png',
        transparent: true,
        version: '1.3.0',
        opacity: 0.65,
        pane: 'biodivWms',
        attribution: 'Danmarks Miljøportal (Arealdata)',
      });
      w.addTo(map);
      wmsMap.set(id, w);
    }
    return () => {
      wmsMap.forEach((layer) => {
        try {
          map.removeLayer(layer);
        } catch {
          /* ignore */
        }
      });
      wmsMap.clear();
    };
  }, [map, isStub, bioActive]);

  // VNS vector overlay
  useEffect(() => {
    if (!map || isStub) return;
    if (!map.getPane('biodivVns')) {
      const pv = map.createPane('biodivVns');
      pv.style.zIndex = '350';
    }
    if (vnsLayerRef.current) {
      map.removeLayer(vnsLayerRef.current);
      vnsLayerRef.current = null;
    }
    if (!vnsOn) return;

    let cancelled = false;
    (async () => {
      if (cancelled) return;
      const data = (await loadVandNaturSkovProjekter()) as FeatureCollection<Geometry> | null;
      if (cancelled || !data) return;
      const gl = L.geoJSON(data, {
        pane: 'biodivVns',
        style: {
          color: '#15803d',
          weight: 1,
          fillColor: '#22c55e',
          fillOpacity: 0.28,
        },
        onEachFeature: (feature: Feature, layer) => {
          const p = (feature.properties ?? {}) as { proj?: string; ha?: number; tag?: string };
          const t = p.proj ? p.proj : 'Vand/Natur/Skov 2026';
          layer.bindTooltip(t, { sticky: true, className: 'map-tooltip' });
        },
      });
      gl.addTo(map);
      vnsLayerRef.current = gl;
    })();

    return () => {
      cancelled = true;
      if (vnsLayerRef.current) {
        map.removeLayer(vnsLayerRef.current);
        vnsLayerRef.current = null;
      }
    };
  }, [map, isStub, vnsOn]);

  if (isStub) return null;

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs font-medium text-foreground/90"
          >
            <Leaf className="w-3.5 h-3.5 text-emerald-600" />
            Biodiversitet
            {bioActive.length > 0 && (
              <span className="ml-0.5 rounded-full bg-emerald-100 text-emerald-800 px-1.5 text-[10px] font-bold">
                {bioActive.length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3" align="end">
          <p className="text-[11px] font-semibold text-foreground mb-2">WMS (Arealdata, gennemsigtig 65 %)</p>
          <ul className="space-y-2 max-h-64 overflow-y-auto pr-0.5">
            {BIODIV_WMS_LAYERS.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-2 text-[11px]">
                <div className="min-w-0">
                  <div className="font-medium text-foreground leading-tight">{b.label}</div>
                  <div className="text-muted-foreground text-[10px] leading-tight mt-0.5">{b.sublabel}</div>
                </div>
                <Switch
                  checked={bioActive.includes(b.id as BiodivWmsId)}
                  onCheckedChange={(v) => setBio(b.id as BiodivWmsId, v)}
                  className="data-[state=checked]:bg-emerald-600 shrink-0"
                />
              </li>
            ))}
          </ul>
          <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between gap-2 text-[11px]">
            <div className="min-w-0">
              <div className="font-medium">Vand, natur & skov 2026</div>
              <div className="text-[10px] text-muted-foreground">FVM / Markkort (polygoner)</div>
            </div>
            <Switch
              checked={vnsOn}
              onCheckedChange={setVns}
              className="data-[state=checked]:bg-emerald-600 shrink-0"
            />
          </div>
          <p className="text-[9px] text-muted-foreground mt-2">
            WMS hentes efter behov. VNS 2026 er ~4.200 polygoner og kan tage kortvarigt at hente.
          </p>
        </PopoverContent>
      </Popover>
      {(bioActive.length > 0 || vnsOn) && (
        <div className="hidden lg:flex flex-wrap items-center gap-1.5 max-w-md">
          {bioActive.map((id) => {
            const d = BIODIV_WMS_LAYERS.find((e) => e.id === id);
            if (!d) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setBio(id, false)}
                className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] text-emerald-900 hover:bg-emerald-100/90"
              >
                {d.label}
                <X className="w-3 h-3" aria-hidden />
              </button>
            );
          })}
          {vnsOn && (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2 py-0.5 text-[10px] text-emerald-900">
              VNS 2026
            </span>
          )}
        </div>
      )}
    </div>
  );
}
