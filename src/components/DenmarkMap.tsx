import { useState, useEffect, useCallback, useRef } from 'react';
import { MapContainer, GeoJSON, TileLayer } from 'react-leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import type { Layer, PathOptions } from 'leaflet';
import type L from 'leaflet';
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
  const geoJsonRef = useRef<L.GeoJSON | null>(null);

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

  const getFeatureName = useCallback((feature: Feature): string => {
    if (layer === 'catchments') {
      return feature.properties?.hov_na || '';
    }
    return feature.properties?.op_navn || '';
  }, [layer]);

  const styleFeature = useCallback(
    (feature?: Feature): PathOptions => {
      if (!feature) return {};
      const name = getFeatureName(feature);

      if (layer === 'catchments') {
        const catchment = findCatchmentForFeature(name, data.catchments, lookup);
        if (catchment) {
          // Aggregate plans for this catchment to get a progress color
          // Since catchments don't have goals, we'll color by achieved nitrogen relative to the max
          const maxAchieved = Math.max(...data.catchments.map((c) => c.nitrogenAchievedT), 1);
          const relPct = (catchment.nitrogenAchievedT / maxAchieved) * 100;
          return {
            fillColor: getProgressColor(relPct),
            fillOpacity: 0.6,
            weight: 1.5,
            color: 'hsl(220, 13%, 80%)',
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
          color: 'hsl(220, 13%, 80%)',
          opacity: 0.8,
        };
      }
      return { fillColor: '#9ca3af', fillOpacity: 0.25, weight: 1, color: '#d1d5db' };
    },
    [layer, data, lookup, getFeatureName]
  );

  const onEachFeature = useCallback(
    (feature: Feature, featureLayer: Layer) => {
      const name = getFeatureName(feature);
      const l = featureLayer as L.Path;

      if (layer === 'coastal') {
        const plan = findPlanForFeature(name, data.plans, lookup);
        if (plan) {
          l.bindTooltip(`${plan.name}: ${Math.round(plan.nitrogenProgressPct)}%`, { sticky: true, className: 'map-tooltip' });
        } else {
          l.bindTooltip(`${name || 'Ukendt'}: Ingen separat plan`, { sticky: true, className: 'map-tooltip' });
        }
      } else {
        const catchment = findCatchmentForFeature(name, data.catchments, lookup);
        if (catchment) {
          l.bindTooltip(`${catchment.name}: ${Math.round(catchment.nitrogenAchievedT)} ton`, {
            sticky: true,
            className: 'map-tooltip',
          });
        } else {
          l.bindTooltip(name || 'Ukendt', { sticky: true, className: 'map-tooltip' });
        }
      }

      l.on({
        mouseover: () => {
          l.setStyle({ weight: 3, color: 'hsl(199, 89%, 48%)', fillOpacity: 0.75 });
          l.bringToFront();
        },
        mouseout: () => {
          if (geoJsonRef.current) {
            geoJsonRef.current.resetStyle(l);
          }
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
    [layer, data, lookup, getFeatureName]
  );

  const activeGeo = layer === 'catchments' ? catchmentsGeo : coastalGeo;

  const closePanel = () => {
    setPanelOpen(false);
    setSelectedPlan(undefined);
    setSelectedCatchment(undefined);
  };

  if (!activeGeo) {
    return (
      <div className="flex items-center justify-center h-[500px] text-muted-foreground">
        Indlæser kort...
      </div>
    );
  }

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Public Sans', sans-serif" }}>
          Kort over Danmark
        </h2>
        <div className="flex bg-muted rounded-lg p-0.5">
          <button
            onClick={() => { setLayer('catchments'); closePanel(); }}
            className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
              layer === 'catchments'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Vandoplande
          </button>
          <button
            onClick={() => { setLayer('coastal'); closePanel(); }}
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
          <div className="rounded-xl overflow-hidden border border-border shadow-sm" style={{ height: '500px' }}>
            <MapContainer
              center={[56.0, 11.5]}
              zoom={7}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
              />
              <GeoJSON
                key={layer}
                ref={(ref) => { geoJsonRef.current = ref; }}
                data={activeGeo}
                style={styleFeature}
                onEachFeature={onEachFeature}
              />
            </MapContainer>
          </div>
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
