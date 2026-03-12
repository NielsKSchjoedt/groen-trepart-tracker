import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import { loadCatchmentsGeoJSON, loadCoastalWatersGeoJSON, loadWaterBodiesGeoJSON, loadNameLookup, loadCoastalWaterStatus, findPlanForFeature, findCatchmentForFeature } from '@/lib/data';
import { getProgressColor, getPillarProgressColor, getWfdStatusColor, formatDanishNumber } from '@/lib/format';
import { DetailPanel } from './DetailPanel';
import { CoastalWaterDetailPanel } from './CoastalWaterDetailPanel';
import { StubMapOverlay } from './StubMapOverlay';
import { NatureWatermark } from './NatureWatermark';
import { usePillar } from '@/lib/pillars';
import type { Plan, Catchment, DashboardData, CoastalWaterStatusData, CoastalWaterEntry } from '@/lib/types';
import { Map } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { InfoTooltip } from './InfoTooltip';
import 'leaflet/dist/leaflet.css';

interface DenmarkMapProps {
  data: DashboardData;
}

type MapLayer = 'catchments' | 'coastal';

/**
 * Read a numeric field from a catchment or plan object by name.
 * Returns 0 if the field doesn't exist or is falsy.
 */
function getNumericField(obj: Record<string, unknown>, field: string): number {
  const val = obj[field];
  return typeof val === 'number' ? val : 0;
}

/**
 * URL search-param keys used by this component.
 *
 * - `lag`      : map layer — "kyst" for coastal sub-catchments, absent = main catchments
 * - `opland`   : nameNormalized of the selected catchment (opens detail panel)
 * - `plan`     : id of the selected coastal plan (opens detail panel)
 * - `kystvand` : name of the selected coastal water body (opens quality panel)
 */
const PARAM = {
  lag:      'lag',
  opland:   'opland',
  plan:     'plan',
  kystvand: 'kystvand',
} as const;

export function DenmarkMap({ data }: DenmarkMapProps) {
  const { activePillar, config: pillarConfig } = usePillar();
  const [searchParams, setSearchParams] = useSearchParams();
  const showLayerToggle = pillarConfig.hasMultipleLayers;
  const isStub = !pillarConfig.hasData || !pillarConfig.hasGeoBreakdown;

  // --- Derive state from URL params ---

  /** Active map layer. Falls back to catchments if the pillar doesn't support coastal. */
  const layer: MapLayer = (showLayerToggle && searchParams.get(PARAM.lag) === 'kyst')
    ? 'coastal'
    : 'catchments';

  const [catchmentsGeo, setCatchmentsGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [coastalGeo, setCoastalGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [waterBodiesGeo, setWaterBodiesGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [lookup, setLookup] = useState<Record<string, string>>({});
  const [coastalStatus, setCoastalStatus] = useState<CoastalWaterStatusData | null>(null);
  const [showWaterBodies, setShowWaterBodies] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const waterBodiesLayerRef = useRef<L.GeoJSON | null>(null);

  // Derive selected items from URL params + loaded data
  const selectedCatchment = useMemo((): Catchment | undefined => {
    const id = searchParams.get(PARAM.opland);
    if (!id) return undefined;
    return data.catchments.find((c) => c.nameNormalized === id);
  }, [searchParams, data.catchments]);

  const selectedPlan = useMemo((): Plan | undefined => {
    const id = searchParams.get(PARAM.plan);
    if (!id) return undefined;
    return data.plans.find((p) => p.id === id);
  }, [searchParams, data.plans]);

  const selectedCoastalWater = useMemo((): { name: string; entry: CoastalWaterEntry } | undefined => {
    const name = searchParams.get(PARAM.kystvand);
    if (!name || !coastalStatus) return undefined;
    const entry = coastalStatus.waters[name];
    return entry ? { name, entry } : undefined;
  }, [searchParams, coastalStatus]);

  const panelOpen = !!(selectedPlan || selectedCatchment || selectedCoastalWater);

  // --- URL-updating helpers ---

  /** Switch the active map layer and clear any open panel. */
  const switchLayer = (newLayer: MapLayer) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (newLayer === 'coastal') {
        next.set(PARAM.lag, 'kyst');
      } else {
        next.delete(PARAM.lag);
      }
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      return next;
    });
  };

  const openCatchmentPanel = useCallback((catchment: Catchment) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.opland, catchment.nameNormalized);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      return next;
    });
  }, [setSearchParams]);

  const openPlanPanel = useCallback((plan: Plan) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.plan, plan.id);
      next.delete(PARAM.opland);
      next.delete(PARAM.kystvand);
      return next;
    });
  }, [setSearchParams]);

  const openCoastalWaterPanel = useCallback((name: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.kystvand, name);
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      return next;
    });
  }, [setSearchParams]);

  const closePanel = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      return next;
    });
  }, [setSearchParams]);

  // --- Data loading ---

  useEffect(() => {
    Promise.all([
      loadCatchmentsGeoJSON(),
      loadCoastalWatersGeoJSON(),
      loadWaterBodiesGeoJSON(),
      loadNameLookup(),
      loadCoastalWaterStatus(),
    ]).then(([c, cw, wb, l, cs]) => {
      setCatchmentsGeo(c);
      setCoastalGeo(cw);
      setWaterBodiesGeo(wb);
      setLookup(l);
      setCoastalStatus(cs);
    });
  }, []);

  // --- Leaflet map init ---

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const denmarkBounds = L.latLngBounds(
      L.latLng(54.4, 7.5),
      L.latLng(57.9, 15.5),
    );
    const map = L.map(mapContainerRef.current, {
      center: [56.1, 11.0],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: denmarkBounds.pad(0.15),
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

  // --- GeoJSON layer rendering ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map || isStub) return;
    const activeGeo = layer === 'catchments' ? catchmentsGeo : coastalGeo;
    if (!activeGeo) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
    }

    const dataField = layer === 'catchments' ? pillarConfig.catchmentDataField : pillarConfig.planDataField;

    let maxVal = 1;
    if (layer === 'catchments' && dataField) {
      maxVal = Math.max(
        ...data.catchments.map((c) => getNumericField(c as unknown as Record<string, unknown>, dataField)),
        1,
      );
    }

    const geoJsonLayer = L.geoJSON(activeGeo, {
      style: (feature) => {
        if (!feature) return {};
        const name = getFeatureName(feature, layer);

        if (layer === 'catchments') {
          const catchment = findCatchmentForFeature(name, data.catchments, lookup);
          if (catchment && dataField) {
            const val = getNumericField(catchment as unknown as Record<string, unknown>, dataField);
            const relPct = (val / maxVal) * 100;
            return {
              fillColor: getPillarProgressColor(relPct, activePillar),
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
            fillColor: getPillarProgressColor(plan.nitrogenProgressPct, 'nitrogen'),
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
          if (catchment && dataField) {
            const val = getNumericField(catchment as unknown as Record<string, unknown>, dataField);
            const unit = pillarConfig.unit.split('/')[0];
            path.bindTooltip(`${catchment.name}: ${formatDanishNumber(Math.round(val))} ${unit}`, { sticky: true, className: 'map-tooltip' });
          } else {
            path.bindTooltip(name || 'Ukendt', { sticky: true, className: 'map-tooltip' });
          }
        }

        path.on({
          mouseover: () => {
            path.setStyle({ weight: 3, color: pillarConfig.accentColor, fillOpacity: 0.7 });
            path.bringToFront();
          },
          mouseout: () => {
            geoJsonLayer.resetStyle(path);
          },
          click: () => {
            if (layer === 'coastal') {
              const plan = findPlanForFeature(name, data.plans, lookup);
              if (plan) openPlanPanel(plan);
              else closePanel();
            } else {
              const catchment = findCatchmentForFeature(name, data.catchments, lookup);
              if (catchment) openCatchmentPanel(catchment);
              else closePanel();
            }
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = geoJsonLayer;

    if (waterBodiesLayerRef.current) {
      waterBodiesLayerRef.current.bringToFront();
    }
  }, [layer, catchmentsGeo, coastalGeo, lookup, data, getFeatureName, activePillar, pillarConfig, isStub, openCatchmentPanel, openPlanPanel, closePanel]);

  // --- Water body overlay ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (waterBodiesLayerRef.current) {
      map.removeLayer(waterBodiesLayerRef.current);
      waterBodiesLayerRef.current = null;
    }

    if (!showWaterBodies || !waterBodiesGeo || !coastalStatus) return;

    const waterLayer = L.geoJSON(waterBodiesGeo, {
      style: (feature) => {
        if (!feature) return {};
        const ecoStatus = feature.properties?.eco_status || 'Ukendt';
        return {
          fillColor: getWfdStatusColor(ecoStatus),
          fillOpacity: 0.55,
          weight: 1.5,
          color: '#4a90b8',
          opacity: 0.7,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const name = feature.properties?.ov_navn || 'Ukendt';
        const ecoStatus = feature.properties?.eco_status || 'Ukendt';
        const path = featureLayer as L.Path;

        path.bindTooltip(`${name}: ${ecoStatus} tilstand`, {
          sticky: true,
          className: 'map-tooltip',
        });

        path.on({
          mouseover: () => {
            path.setStyle({ weight: 3, color: '#1e3a5f', fillOpacity: 0.75 });
            path.bringToFront();
          },
          mouseout: () => {
            waterLayer.resetStyle(path);
          },
          click: () => {
            const entry = coastalStatus.waters[name];
            if (entry) openCoastalWaterPanel(name);
          },
        });
      },
    }).addTo(map);

    waterBodiesLayerRef.current = waterLayer;
  }, [showWaterBodies, waterBodiesGeo, coastalStatus, openCoastalWaterPanel]);

  // --- Legend data ---

  const legendItems = pillarConfig.hasData ? [
    { color: getPillarProgressColor(80, activePillar), label: '≥80%' },
    { color: getPillarProgressColor(60, activePillar), label: '60–79%' },
    { color: getPillarProgressColor(40, activePillar), label: '40–59%' },
    { color: getPillarProgressColor(20, activePillar), label: '20–39%' },
    { color: getPillarProgressColor(10, activePillar), label: '<20%' },
    { color: '#c8c4bb', label: 'Ingen data' },
  ] : [];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-10 relative overflow-hidden">
      {pillarConfig.watermarks.slice(0, 3).map((animal, i) => {
        const positions = [
          'absolute right-2 top-16 opacity-[0.10] hidden lg:block',
          'absolute left-0 bottom-10 opacity-[0.08] hidden lg:block',
          'absolute right-1/3 bottom-4 opacity-[0.07] hidden md:block',
        ];
        const sizes = [110, 100, 65];
        return (
          <div key={`${animal}-${i}`} className={`pointer-events-none transition-opacity duration-300 ${positions[i]}`}>
            <NatureWatermark animal={animal} size={sizes[i]} />
          </div>
        );
      })}

      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2.5">
          <Map className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            Kort over Danmark
          </h2>
          <span
            className="text-xs font-medium rounded-full px-2.5 py-0.5 border"
            style={{ color: pillarConfig.accentColor, borderColor: pillarConfig.accentColor + '40', backgroundColor: pillarConfig.accentColor + '10' }}
          >
            {pillarConfig.label}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {showLayerToggle && (
            <div className="flex items-center gap-1.5">
              <div className="flex bg-card border border-border rounded-lg p-0.5 shadow-sm">
                <button
                  onClick={() => switchLayer('catchments')}
                  className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                    layer === 'catchments'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Vandoplande
                </button>
                <button
                  onClick={() => switchLayer('coastal')}
                  className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                    layer === 'coastal'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Kystvandsoplande
                </button>
              </div>
              <InfoTooltip
                title="Kortlag"
                content={
                  <>
                    <p><strong>Vandoplande:</strong> Danmarks 23 hovedvandoplande. Farven viser oplandets kvælstofreduktion relativt til det mest aktive opland.</p>
                    <p><strong>Kystvandsoplande:</strong> De ~90 kystvandoplande med lokale kvælstofreduktionsmål fra vandplanerne. Farven viser fremskridt mod det lokale mål.</p>
                  </>
                }
                source="Geodata fra Miljøstyrelsens WFS (miljoegis.mim.dk)"
                side="bottom"
                size={13}
              />
            </div>
          )}
          {waterBodiesGeo && (
            <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-1 shadow-sm">
              <Switch
                checked={showWaterBodies}
                onCheckedChange={setShowWaterBodies}
                className="data-[state=checked]:bg-[#4a90b8] h-5 w-9"
              />
              <span className={`text-sm font-medium transition-colors select-none ${showWaterBodies ? 'text-foreground' : 'text-muted-foreground'}`}>
                Kystvande
              </span>
              <InfoTooltip
                title="Kystvande — økologisk tilstand"
                content={
                  <p>Viser de 109 danske kystvandområders økologiske tilstand ifølge EU's Vandrammedirektiv (WFD). Farverne angiver den samlede økologiske vurdering: God (grøn), Moderat (gul), Ringe (orange) og Dårlig (rød). Klik på et vandområde for at se detaljerede indikatorer.</p>
                }
                source="VP3 — Vandområdeplanerne 2021–2027 (Miljøstyrelsen)"
                side="bottom"
                size={13}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-5 text-xs text-muted-foreground">
        {legendItems.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-foreground/70">{pillarConfig.label}:</span>
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
            <InfoTooltip
              title="Farveindeks"
              content={
                layer === 'catchments'
                  ? <p>Vandoplande farves efter relativ kvælstofreduktion sammenlignet med det mest aktive opland (= 100%). Lysere farve = lavere aktivitet.</p>
                  : <p>Kystvandsoplande farves efter fremskridt mod det lokale kvælstofreduktionsmål fra vandplanerne. Grønt = tæt på målet.</p>
              }
              size={12}
              side="bottom"
            />
          </div>
        )}
        {showWaterBodies && waterBodiesGeo && (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium text-foreground/70">Kystvande:</span>
            {[
              { status: 'God', label: 'God' },
              { status: 'Moderat', label: 'Moderat' },
              { status: 'Ringe', label: 'Ringe' },
              { status: 'Dårlig', label: 'Dårlig' },
            ].map((item) => (
              <div key={item.status} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: getWfdStatusColor(item.status) }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={`flex transition-all ${panelOpen ? 'gap-0' : ''}`}>
        <div className={`transition-all relative ${panelOpen ? 'w-full md:w-3/5' : 'w-full'}`}>
          <div
            ref={mapContainerRef}
            className="rounded-2xl overflow-hidden border border-border shadow-md"
            style={{ height: '580px' }}
          />
          {isStub && pillarConfig.stubMessage && (
            <StubMapOverlay message={pillarConfig.stubMessage} />
          )}
        </div>

        {panelOpen && (selectedPlan || selectedCatchment) && (
          <div className="hidden md:block w-2/5 min-h-[520px]">
            <DetailPanel plan={selectedPlan} catchment={selectedCatchment} nationalData={data.national} onClose={closePanel} />
          </div>
        )}
        {panelOpen && selectedCoastalWater && (
          <div className="hidden md:block w-2/5 min-h-[520px]">
            <CoastalWaterDetailPanel name={selectedCoastalWater.name} entry={selectedCoastalWater.entry} onClose={closePanel} />
          </div>
        )}
      </div>

      {panelOpen && (selectedPlan || selectedCatchment) && (
        <div className="md:hidden mt-4 rounded-2xl border border-border shadow-md overflow-hidden">
          <DetailPanel plan={selectedPlan} catchment={selectedCatchment} nationalData={data.national} onClose={closePanel} />
        </div>
      )}
      {panelOpen && selectedCoastalWater && (
        <div className="md:hidden mt-4 rounded-2xl border border-border shadow-md overflow-hidden">
          <CoastalWaterDetailPanel name={selectedCoastalWater.name} entry={selectedCoastalWater.entry} onClose={closePanel} />
        </div>
      )}
    </section>
  );
}
