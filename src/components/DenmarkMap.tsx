import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import { loadCatchmentsGeoJSON, loadCoastalWatersGeoJSON, loadNameLookup, findPlanForFeature, findCatchmentForFeature } from '@/lib/data';
import { getProgressColor } from '@/lib/format';
import { DetailPanel } from './DetailPanel';
import type { Plan, Catchment, DashboardData } from '@/lib/types';
import 'leaflet/dist/leaflet.css';

interface DenmarkMapProps {
  data: DashboardData;
}

type MapLayer = 'catchments' | 'coastal';

export function DenmarkMap({ data }: DenmarkMapProps) {
  const [layer, setLayer] = useState<MapLayer>('catchments');
  const [catchmentsGeo, setCatchmentsGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [coastalGeo, setCoastalGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [lookup, setLookup] = useState<Record<string, string>>({});
  const [selectedPlan, setSelectedPlan] = useState<Plan | undefined>();
  const [selectedCatchment, setSelectedCatchment] = useState<Catchment | undefined>();
  const [panelOpen, setPanelOpen] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);

  // Load geo data
  useEffect(() => {
    Promise.all([
      loadCatchmentsGeoJSON(),
      loadCoastalWatersGeoJSON(),
      loadNameLookup(),
    ]).then(([c, cw, l]) => {
      setCatchmentsGeo(c);
      setCoastalGeo(cw);
      setLookup(l);
    });
  }, []);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [56.0, 11.5],
      zoom: 7,
      scrollWheelZoom: true,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const getFeatureName = useCallback((feature: Feature, currentLayer: MapLayer): string => {
    if (currentLayer === 'catchments') {
      return feature.properties?.hov_na || '';
    }
    return feature.properties?.op_navn || '';
  }, []);

  // Update GeoJSON layer when data or layer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const activeGeo = layer === 'catchments' ? catchmentsGeo : coastalGeo;
    if (!activeGeo) return;

    // Remove old layer
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    const geoJsonLayer = L.geoJSON(activeGeo, {
      style: (feature) => {
        if (!feature) return {};
        const name = getFeatureName(feature, layer);

        if (layer === 'catchments') {
          const catchment = findCatchmentForFeature(name, data.catchments, lookup);
          if (catchment) {
            const maxAchieved = Math.max(...data.catchments.map((c) => c.nitrogenAchievedT), 1);
            const relPct = (catchment.nitrogenAchievedT / maxAchieved) * 100;
            return {
              fillColor: getProgressColor(relPct),
              fillOpacity: 0.6,
              weight: 1.5,
              color: '#c8ced6',
              opacity: 0.8,
            };
          }
          return { fillColor: '#9ca3af', fillOpacity: 0.3, weight: 1, color: '#d1d5db' };
        }

        // Coastal waters
        const plan = findPlanForFeature(name, data.plans, lookup);
        if (plan) {
          return {
            fillColor: getProgressColor(plan.nitrogenProgressPct),
            fillOpacity: 0.6,
            weight: 1.5,
            color: '#c8ced6',
            opacity: 0.8,
          };
        }
        return { fillColor: '#9ca3af', fillOpacity: 0.25, weight: 1, color: '#d1d5db' };
      },
      onEachFeature: (feature, featureLayer) => {
        const name = getFeatureName(feature, layer);
        const path = featureLayer as L.Path;

        if (layer === 'coastal') {
          const plan = findPlanForFeature(name, data.plans, lookup);
          if (plan) {
            path.bindTooltip(`${plan.name}: ${Math.round(plan.nitrogenProgressPct)}%`, { sticky: true, className: 'map-tooltip' });
          } else {
            path.bindTooltip(`${name || 'Ukendt'}: Ingen separat plan`, { sticky: true, className: 'map-tooltip' });
          }
        } else {
          const catchment = findCatchmentForFeature(name, data.catchments, lookup);
          if (catchment) {
            path.bindTooltip(`${catchment.name}: ${Math.round(catchment.nitrogenAchievedT)} ton`, { sticky: true, className: 'map-tooltip' });
          } else {
            path.bindTooltip(name || 'Ukendt', { sticky: true, className: 'map-tooltip' });
          }
        }

        path.on({
          mouseover: () => {
            path.setStyle({ weight: 3, color: '#0ea5e9', fillOpacity: 0.75 });
            path.bringToFront();
          },
          mouseout: () => {
            geoJsonLayer.resetStyle(path);
          },
          click: () => {
            if (layer === 'coastal') {
              const plan = findPlanForFeature(name, data.plans, lookup);
              setSelectedPlan(plan);
              setSelectedCatchment(undefined);
            } else {
              const catchment = findCatchmentForFeature(name, data.catchments, lookup);
              setSelectedCatchment(catchment);
              setSelectedPlan(undefined);
            }
            setPanelOpen(true);
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = geoJsonLayer;
  }, [layer, catchmentsGeo, coastalGeo, lookup, data, getFeatureName]);

  const closePanel = () => {
    setPanelOpen(false);
    setSelectedPlan(undefined);
    setSelectedCatchment(undefined);
  };

  const switchLayer = (newLayer: MapLayer) => {
    setLayer(newLayer);
    closePanel();
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Public Sans', sans-serif" }}>
          Kort over Danmark
        </h2>
        <div className="flex bg-muted rounded-lg p-0.5">
          <button
            onClick={() => switchLayer('catchments')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              layer === 'catchments'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vandoplande
          </button>
          <button
            onClick={() => switchLayer('coastal')}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              layer === 'coastal'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Kystvande
          </button>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap items-center gap-3 mb-4 text-xs text-muted-foreground">
        {[
          { color: '#16a34a', label: '≥80%' },
          { color: '#84cc16', label: '60–79%' },
          { color: '#facc15', label: '40–59%' },
          { color: '#f97316', label: '20–39%' },
          { color: '#dc2626', label: '<20%' },
          { color: '#9ca3af', label: 'Ingen data' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className={`flex transition-all ${panelOpen ? 'gap-0' : ''}`}>
        <div className={`transition-all ${panelOpen ? 'w-full md:w-3/5' : 'w-full'}`}>
          <div
            ref={mapContainerRef}
            className="rounded-xl overflow-hidden border border-border shadow-sm"
            style={{ height: '500px' }}
          />
        </div>

        {/* Detail panel - desktop */}
        {panelOpen && (selectedPlan || selectedCatchment) && (
          <div className="hidden md:block w-2/5 min-h-[500px]">
            <DetailPanel plan={selectedPlan} catchment={selectedCatchment} onClose={closePanel} />
          </div>
        )}
      </div>

      {/* Detail panel - mobile (bottom sheet) */}
      {panelOpen && (selectedPlan || selectedCatchment) && (
        <div className="md:hidden mt-4 rounded-xl border border-border shadow-sm overflow-hidden">
          <DetailPanel plan={selectedPlan} catchment={selectedCatchment} onClose={closePanel} />
        </div>
      )}
    </section>
  );
}
