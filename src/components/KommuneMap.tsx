import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import type { KommuneBenchmarkData, KommuneMetrics, KommuneRankingData, NationalFordelingSimulation, DashboardData, ProjectNatureOverlapData } from '@/lib/types';
import type { KommuneMetric, KommunePhase } from '@/lib/kommune-metrics';
import type { ChoroplethScaleMode, FordelingViewMode, NatureLayerKey } from '@/lib/kommune-map-visualization';
import {
  resolveKommuneMapColor,
  resolveKommuneMapValue,
  type KommuneMapVisualContext,
} from '@/lib/kommune-map-visualization';
import { loadProjectGeometries, loadProjectNatureOverlap } from '@/lib/data';
import { collectMapProjects, kommuneMetricToPillar, filterMapProjectsByKommune } from '@/lib/map-projects';
import { MapProjectLayer } from '@/components/MapProjectLayer';
import 'leaflet/dist/leaflet.css';

export type { KommuneMetric };

interface KommuneMapProps {
  kommunerGeo: FeatureCollection<Geometry>;
  metrics: KommuneMetrics[];
  activeMetric: KommuneMetric;
  selectedKode?: string | null;
  /** When set, zoom/fit map bounds to this municipality */
  focusKode?: string | null;
  onSelect: (kode: string) => void;
  /** Map height in px (default 520). Ignored when `fillContainer` is true. */
  height?: number;
  /** Fill the positioned parent (e.g. MapFullscreenShell). */
  fillContainer?: boolean;
  /** Called once when the Leaflet map instance is ready — use for invalidateSize. */
  onMapReady?: (map: L.Map) => void;
  fordelingSimulation?: NationalFordelingSimulation | null;
  kommuneBenchmark?: KommuneBenchmarkData | null;
  fordelingViewMode?: FordelingViewMode;
  natureLayer?: NatureLayerKey;
  choroplethScale?: ChoroplethScaleMode;
  kommuneRanking?: KommuneRankingData | null;
  ansvarIndexByKode?: Record<string, number | null>;
  /** Tier 1: dashboard data for MARS project overlay. */
  dashboard?: DashboardData | null;
  selectedPhases?: Set<KommunePhase>;
  /** When false, hide tier-1 project dots/polygons (detail page: default true). */
  showProjectLayer?: boolean;
  /** Called when a MARS project dot/polygon is clicked. */
  onProjectClick?: (geoId: string, lng: number, lat: number) => void;
}

const SELECTED_BORDER = '#1e293b';

/**
 * Leaflet choropleth map showing all 98 Danish municipalities coloured by
 * the selected metric, optional distribution simulation, or nature benchmark layers.
 */
export function KommuneMap({
  kommunerGeo,
  metrics,
  activeMetric,
  selectedKode = null,
  focusKode = null,
  onSelect,
  height = 520,
  fillContainer = false,
  onMapReady,
  fordelingSimulation = null,
  kommuneBenchmark = null,
  fordelingViewMode = 'actual',
  natureLayer = 'b4-beskyttet',
  choroplethScale = 'absolute',
  kommuneRanking = null,
  ansvarIndexByKode = {},
  dashboard = null,
  selectedPhases = new Set(['established']),
  showProjectLayer = true,
  onProjectClick,
}: KommuneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedPathRef = useRef<L.Path | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const [projectGeometries, setProjectGeometries] = useState<Record<string, [number, number][]> | null>(null);
  const [natureOverlap, setNatureOverlap] = useState<ProjectNatureOverlapData | null>(null);

  const pillarId = kommuneMetricToPillar(activeMetric);

  const projectKommuneByGeoId = useMemo(() => {
    const m: Record<string, string | null | undefined> = {};
    if (!dashboard) return m;
    for (const plan of dashboard.plans) {
      for (const p of plan.projectDetails) {
        if (p.geoId) m[p.geoId] = p.kommuneKode;
      }
      for (const s of plan.sketchProjects) {
        if (s.geoId) m[s.geoId] = (s as { kommuneKode?: string | null }).kommuneKode;
      }
    }
    return m;
  }, [dashboard]);

  const mapProjects = useMemo(() => {
    if (!dashboard || !pillarId || !showProjectLayer) return [];
    const all = collectMapProjects(dashboard, pillarId, selectedPhases);
    if (!focusKode) return all;
    return filterMapProjectsByKommune(all, focusKode, projectKommuneByGeoId);
  }, [dashboard, pillarId, selectedPhases, showProjectLayer, focusKode, projectKommuneByGeoId]);

  const metricsById = useMemo(
    () => Object.fromEntries(metrics.map((k) => [k.kode, k])),
    [metrics],
  );

  const visualContext: KommuneMapVisualContext = useMemo(
    () => ({
      activeMetric,
      fordelingViewMode,
      natureLayer,
      choroplethScale,
      fordelingSimulation,
      kommuneBenchmark,
      kommuneRanking,
      ansvarIndexByKode,
    }),
    [
      activeMetric,
      fordelingViewMode,
      natureLayer,
      choroplethScale,
      fordelingSimulation,
      kommuneBenchmark,
      kommuneRanking,
      ansvarIndexByKode,
    ],
  );

  const { maxVal, maxAbs } = useMemo(() => {
    const allValues = kommunerGeo.features.map((feature) => {
      const kode = feature.properties?.kode as string | undefined;
      if (!kode) return 0;
      return resolveKommuneMapValue(kode, metricsById[kode], visualContext).value;
    });

    return {
      maxVal: Math.max(...allValues, 1),
      maxAbs: Math.max(...allValues.map((v) => Math.abs(v)), 1),
    };
  }, [kommunerGeo, metricsById, visualContext]);

  const activeMetricRef = useRef(activeMetric);
  const maxValRef = useRef(maxVal);
  const maxAbsRef = useRef(maxAbs);
  const metricsByIdRef = useRef(metricsById);
  const onSelectRef = useRef(onSelect);
  const selectedKodeRef = useRef(selectedKode);
  const visualContextRef = useRef(visualContext);

  useEffect(() => {
    activeMetricRef.current = activeMetric;
    maxValRef.current = maxVal;
    maxAbsRef.current = maxAbs;
    metricsByIdRef.current = metricsById;
    onSelectRef.current = onSelect;
    selectedKodeRef.current = selectedKode;
    visualContextRef.current = visualContext;
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const denmarkBounds = L.latLngBounds(
      L.latLng(54.4, 7.5),
      L.latLng(57.9, 15.5),
    );
    const map = L.map(containerRef.current, {
      center: [56.1, 11.0],
      zoom: 7,
      minZoom: 6,
      maxZoom: 12,
      maxBounds: denmarkBounds.pad(0.2),
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;
    setLeafletMap(map);
    onMapReady?.(map);
    const id = setTimeout(() => setMapReady(true), 0);
    return () => {
      clearTimeout(id);
      map.remove();
      mapRef.current = null;
      setLeafletMap(null);
      setMapReady(false);
    };
  }, [onMapReady]);

  useEffect(() => {
    if (!showProjectLayer || !dashboard) return;
    let cancelled = false;
    const loaders: Promise<unknown>[] = [loadProjectGeometries()];
    if (pillarId === 'nature') loaders.push(loadProjectNatureOverlap());
    Promise.all(loaders).then((results) => {
      if (cancelled) return;
      setProjectGeometries(results[0] as Record<string, [number, number][]>);
      if (pillarId === 'nature') {
        setNatureOverlap(results[1] as ProjectNatureOverlapData | null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [showProjectLayer, dashboard, pillarId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }
    selectedPathRef.current = null;

    function getKode(feature: Feature): string | undefined {
      return feature.properties?.kode as string | undefined;
    }

    function buildStyle(feature: Feature | undefined): L.PathOptions {
      if (!feature) return {};
      const kode = getKode(feature);
      const km = kode ? metricsByIdRef.current[kode] : undefined;
      const resolved = resolveKommuneMapValue(kode ?? '', km, visualContextRef.current);
      return {
        fillColor: resolveKommuneMapColor(
          resolved.value,
          maxValRef.current,
          maxAbsRef.current,
          activeMetricRef.current,
          resolved,
        ),
        fillOpacity: 0.65,
        weight: 1,
        color: 'hsl(40 15% 80%)',
        opacity: 0.9,
      };
    }

    const layer = L.geoJSON(kommunerGeo, {
      style: buildStyle,
      onEachFeature: (feature, featureLayer) => {
        const path = featureLayer as L.Path;
        const kode = getKode(feature);
        const km = kode ? metricsByIdRef.current[kode] : undefined;
        const navn = km?.navn ?? feature.properties?.navn ?? 'Ukendt';
        const resolved = resolveKommuneMapValue(kode ?? '', km, visualContextRef.current);

        path.bindTooltip(
          `<strong>${navn}</strong><br/>${resolved.label}`,
          { sticky: true, className: 'map-tooltip' },
        );

        path.on({
          mouseover: () => {
            if (path !== selectedPathRef.current) {
              path.setStyle({ weight: 2, color: '#475569', fillOpacity: 0.85 });
              path.bringToFront();
            }
          },
          mouseout: () => {
            if (path !== selectedPathRef.current) {
              layer.resetStyle(path);
            }
          },
          click: () => {
            if (!kode) return;
            if (selectedPathRef.current && selectedPathRef.current !== path) {
              layer.resetStyle(selectedPathRef.current);
            }
            path.setStyle({ weight: 2.5, color: SELECTED_BORDER, fillOpacity: 0.85 });
            path.bringToFront();
            selectedPathRef.current = path;
            onSelectRef.current(kode);
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = layer;

    const currentKode = selectedKodeRef.current;
    if (currentKode) {
      layer.eachLayer((sublayer) => {
        const f = (sublayer as L.GeoJSON & { feature?: Feature }).feature;
        if (!f) return;
        if (getKode(f) === currentKode) {
          const path = sublayer as L.Path;
          path.setStyle({ weight: 2.5, color: SELECTED_BORDER, fillOpacity: 0.85 });
          path.bringToFront();
          selectedPathRef.current = path;
        }
      });
    }
  }, [kommunerGeo, activeMetric, maxVal, maxAbs, mapReady, fordelingViewMode, natureLayer, fordelingSimulation, kommuneBenchmark, choroplethScale, ansvarIndexByKode]);

  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;

    if (selectedPathRef.current) {
      layer.resetStyle(selectedPathRef.current);
      selectedPathRef.current = null;
    }

    if (!selectedKode) return;

    layer.eachLayer((sublayer) => {
      const f = (sublayer as L.GeoJSON & { feature?: Feature }).feature;
      if (!f) return;
      const kode = f.properties?.kode as string | undefined;
      if (kode === selectedKode) {
        const path = sublayer as L.Path;
        path.setStyle({ weight: 2.5, color: SELECTED_BORDER, fillOpacity: 0.85 });
        path.bringToFront();
        selectedPathRef.current = path;
      }
    });
  }, [selectedKode]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = geoJsonLayerRef.current;
    if (!map || !layer || !focusKode) return;

    let bounds: L.LatLngBounds | null = null;
    layer.eachLayer((sublayer) => {
      const f = (sublayer as L.GeoJSON & { feature?: Feature }).feature;
      if (!f) return;
      const kode = f.properties?.kode as string | undefined;
      if (kode === focusKode) {
        bounds = (sublayer as L.Polygon).getBounds();
      }
    });

    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 });
    }
  }, [focusKode, mapReady, kommunerGeo]);

  return (
    <>
      <div
        ref={containerRef}
        className={
          fillContainer
            ? 'absolute inset-0 z-0 rounded-2xl overflow-hidden border border-border shadow-md'
            : 'relative z-0 w-full rounded-2xl overflow-hidden border border-border shadow-md'
        }
        style={fillContainer ? undefined : { height: `${height}px` }}
        aria-label="Danmarkskort med kommuner farvelagt efter valgt metrik"
      />
      <MapProjectLayer
        map={leafletMap}
        enabled={showProjectLayer && mapProjects.length > 0}
        projects={mapProjects}
        geometries={projectGeometries}
        natureOverlap={natureOverlap}
        activePillar={pillarId}
        paneName="kommuneMarsProjects"
        onProjectClick={onProjectClick}
      />
    </>
  );
}
