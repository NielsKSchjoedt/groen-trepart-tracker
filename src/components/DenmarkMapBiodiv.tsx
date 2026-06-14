import { useEffect, useRef } from 'react';
import L from 'leaflet';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import { AREALDATA_WMS_BASE, BIODIV_WMS_LAYERS, type BiodivWmsId } from '@/lib/biodiv-map';
import { loadVandNaturSkovProjekter } from '@/lib/data';

interface BiodivLayersProps {
  map: L.Map | null;
  isStub: boolean;
  bioActive: BiodivWmsId[];
  vnsOn: boolean;
}

/**
 * Headless biodiversity layer renderer. Renders no UI — it only applies the
 * Arealdata WMS tiles (Målretning 30 % etc.) and the optional VNS 2026 vector
 * overlay onto the Leaflet map based on the props it's given. The toggle UI for
 * these layers lives in the unified {@link MapLayersPanel}.
 */
export function BiodivLayers({ map, isStub, bioActive, vnsOn }: BiodivLayersProps) {
  const wmsByIdRef = useRef<Map<string, L.TileLayer.WMS>>(new Map());
  const vnsLayerRef = useRef<L.GeoJSON | null>(null);

  // WMS tiles (Arealdata, 65 % transparent)
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

  // VNS 2026 vector overlay (~4.200 polygoner, hentes efter behov)
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

  return null;
}
