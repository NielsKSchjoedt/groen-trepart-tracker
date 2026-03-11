import { useState, useEffect, useCallback, useRef } from 'react';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import { loadCatchmentsGeoJSON, loadCoastalWatersGeoJSON, loadNameLookup, findPlanForFeature, findCatchmentForFeature } from '@/lib/data';
import { getProgressColor } from '@/lib/format';
import { DetailPanel } from './DetailPanel';
import type { Plan, Catchment, DashboardData } from '@/lib/types';
import { Map } from 'lucide-react';
import { NatureWatermark } from './NatureWatermark';
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

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const denmarkBounds = L.latLngBounds(
      L.latLng(54.4, 7.5),
      L.latLng(57.9, 15.5),
    );
    const map = L.map(mapContainerRef.current, {
      center: [56.0, 11.5],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: denmarkBounds.pad(0.1),
      maxBoundsViscosity: 1.0,
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
    if (currentLayer === 'catchments') return feature.properties?.hov_na || '';
    return feature.properties?.op_navn || '';
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const activeGeo = layer === 'catchments' ? catchmentsGeo : coastalGeo;
    if (!activeGeo) return;

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
              fillOpacity: 0.55,
              weight: 2,
              color: 'hsl(40, 18%, 82%)',
              opacity: 0.9,
            };
          }
          return { fillColor: '#c8c4bb', fillOpacity: 0.3, weight: 1, color: '#d6d2c9' };
        }

        const plan = findPlanForFeature(name, data.plans, lookup);
        if (plan) {
          return {
            fillColor: getProgressColor(plan.nitrogenProgressPct),
            fillOpacity: 0.55,
            weight: 2,
            color: 'hsl(40, 18%, 82%)',
            opacity: 0.9,
          };
        }
        return { fillColor: '#c8c4bb', fillOpacity: 0.2, weight: 1, color: '#d6d2c9' };
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
            path.setStyle({ weight: 3, color: 'hsl(152 44% 38%)', fillOpacity: 0.7 });
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
    <section className="w-full max-w-6xl mx-auto px-4 py-10 relative overflow-hidden">
      <div className="absolute right-2 top-16 opacity-[0.10] hidden lg:block">
        <NatureWatermark animal="seatrout" size={110} className="-rotate-12" />
      </div>
      <div className="absolute left-0 bottom-10 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="seal" size={100} />
      </div>
      <div className="absolute right-1/3 bottom-4 opacity-[0.07] hidden md:block">
        <NatureWatermark animal="shrimp" size={65} className="rotate-[15deg]" />
      </div>
      <div className="absolute left-1/4 top-8 opacity-[0.08] hidden xl:block">
        <NatureWatermark animal="seaweed" size={90} />
      </div>
      <div className="absolute right-8 bottom-24 opacity-[0.07] hidden lg:block">
        <NatureWatermark animal="crab" size={60} />
      </div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <Map className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Kort over Danmark
          </h2>
        </div>
        <div className="flex bg-card border border-border rounded-lg p-0.5 shadow-sm">
          <button
            onClick={() => switchLayer('catchments')}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-all font-medium ${
              layer === 'catchments'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vandoplande
          </button>
          <button
            onClick={() => switchLayer('coastal')}
            className={`px-3.5 py-1.5 text-sm rounded-md transition-all font-medium ${
              layer === 'coastal'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Kystvande
          </button>
        </div>
      </div>

      {/* Color legend */}
      <div className="flex flex-wrap items-center gap-3 mb-5 text-xs text-muted-foreground">
        {[
          { color: '#16a34a', label: '≥80%' },
          { color: '#84cc16', label: '60–79%' },
          { color: '#facc15', label: '40–59%' },
          { color: '#f97316', label: '20–39%' },
          { color: '#dc2626', label: '<20%' },
          { color: '#c8c4bb', label: 'Ingen data' },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.color }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className={`flex transition-all ${panelOpen ? 'gap-0' : ''}`}>
        <div className={`transition-all ${panelOpen ? 'w-full md:w-3/5' : 'w-full'}`}>
          <div
            ref={mapContainerRef}
            className="rounded-2xl overflow-hidden border border-border shadow-md"
            style={{ height: '520px' }}
          />
        </div>

        {panelOpen && (selectedPlan || selectedCatchment) && (
          <div className="hidden md:block w-2/5 min-h-[520px]">
            <DetailPanel plan={selectedPlan} catchment={selectedCatchment} nationalData={data.national} onClose={closePanel} />
          </div>
        )}
      </div>

      {panelOpen && (selectedPlan || selectedCatchment) && (
        <div className="md:hidden mt-4 rounded-2xl border border-border shadow-md overflow-hidden">
          <DetailPanel plan={selectedPlan} catchment={selectedCatchment} nationalData={data.national} onClose={closePanel} />
        </div>
      )}
    </section>
  );
}
