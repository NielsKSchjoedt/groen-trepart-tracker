import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import type { KommuneMetrics } from '@/lib/types';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { formatDanishNumber } from '@/lib/format';
import 'leaflet/dist/leaflet.css';

export type { KommuneMetric };

interface KommuneMapProps {
  kommunerGeo: FeatureCollection<Geometry>;
  metrics: KommuneMetrics[];
  activeMetric: KommuneMetric;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
}

/**
 * Colour scale configurations per metric.
 * Each metric uses a sequential single-hue gradient from light to dark.
 * The lighter end represents low values; darker end represents high values.
 * Zero / no-data municipalities are shown in neutral grey.
 */
const METRIC_COLORS: Record<KommuneMetric, { stops: string[] }> = {
  nitrogen:     { stops: ['#ccfbf1', '#5eead4', '#0d9488', '#134e4a'] },
  extraction:   { stops: ['#fef3c7', '#fcd34d', '#a16207', '#78350f'] },
  afforestation:{ stops: ['#dcfce7', '#86efac', '#15803d', '#14532d'] },
  nature:       { stops: ['#f0fdf4', '#86efac', '#16a34a', '#052e16'] },
  // CO₂ data is not available per municipality — all values will be 0,
  // so the map will render entirely in NO_DATA_COLOR.
  co2:          { stops: ['#f1f5f9', '#94a3b8', '#475569', '#1e293b'] },
};

const NO_DATA_COLOR = 'hsl(0 0% 92%)';
const SELECTED_BORDER = '#1e293b';

/**
 * Linearly interpolate between two hex colours.
 *
 * @param a - Starting hex colour (e.g. "#ccfbf1")
 * @param b - Ending hex colour (e.g. "#0d9488")
 * @param t - Interpolation factor 0..1
 * @returns Interpolated hex colour
 */
function lerpHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [r1, g1, b1] = parse(a);
  const [r2, g2, b2] = parse(b);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const bl = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

/**
 * Map a value in [0, maxVal] to a colour from the metric's gradient.
 *
 * Values at zero receive NO_DATA_COLOR (neutral grey) regardless of the
 * gradient, so truly-zero municipalities read as "no data / no activity".
 * Values above zero are mapped across the 4-stop gradient.
 *
 * @param value - The metric value for this municipality
 * @param maxVal - The maximum value across all 98 municipalities (for normalisation)
 * @param metric - Which metric's colour scale to use
 * @returns CSS hex colour string
 */
function metricColor(value: number, maxVal: number, metric: KommuneMetric): string {
  if (value <= 0 || maxVal <= 0) return NO_DATA_COLOR;
  const t = Math.min(value / maxVal, 1);
  const { stops } = METRIC_COLORS[metric];
  // Map t across N-1 segments
  const seg = (stops.length - 1) * t;
  const idx = Math.min(Math.floor(seg), stops.length - 2);
  return lerpHex(stops[idx], stops[idx + 1], seg - idx);
}

/**
 * Extract the relevant metric value from a KommuneMetrics object.
 *
 * @param km - The KommuneMetrics data for one municipality
 * @param metric - Which metric to extract
 * @returns Numeric value for the selected metric
 */
function getMetricValue(km: KommuneMetrics, metric: KommuneMetric): number {
  switch (metric) {
    case 'nitrogen':     return km.nitrogenT;
    case 'extraction':   return km.extractionHa;
    case 'afforestation':return km.afforestationTotalHa;
    case 'nature':       return km.naturePotentialHa;
    case 'co2':          return km.co2EstimatedT ?? 0;
  }
}

const METRIC_LABELS: Record<KommuneMetric, string> = {
  nitrogen:     'ton N reduceret',
  extraction:   'ha udtagning',
  afforestation:'ha skovrejsning',
  nature:       'ha beskyttet natur (§3 + Natura 2000)',
  co2:          'ton CO₂ (ikke tilgængeligt)',
};

/**
 * Leaflet choropleth map showing all 98 Danish municipalities coloured by
 * the selected metric. Supports hover tooltips and click-to-select.
 *
 * @param kommunerGeo - TopoJSON→GeoJSON FeatureCollection from loadKommunerGeoJSON()
 * @param metrics     - Per-kommune metrics array from dashboard data
 * @param activeMetric - Which metric drives the colour scale
 * @param selectedKode - The currently selected municipality kode (or null)
 * @param onSelect    - Called with the 4-digit kode when a municipality is clicked
 */
export function KommuneMap({ kommunerGeo, metrics, activeMetric, selectedKode, onSelect }: KommuneMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const selectedPathRef = useRef<L.Path | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Build lookup: kode → KommuneMetrics
  const metricsById = Object.fromEntries(metrics.map((k) => [k.kode, k]));

  // Max value across all municipalities for this metric (for colour normalisation)
  const maxVal = Math.max(...metrics.map((k) => getMetricValue(k, activeMetric)), 1);

  // --- Stable refs so GeoJSON effect doesn't re-run on every selection change ---
  const activeMetricRef = useRef(activeMetric);
  const maxValRef = useRef(maxVal);
  const metricsByIdRef = useRef(metricsById);
  const onSelectRef = useRef(onSelect);
  const selectedKodeRef = useRef(selectedKode);

  useEffect(() => {
    activeMetricRef.current = activeMetric;
    maxValRef.current = maxVal;
    metricsByIdRef.current = metricsById;
    onSelectRef.current = onSelect;
    selectedKodeRef.current = selectedKode;
  });

  // --- Leaflet init (once) ---
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
    const id = setTimeout(() => setMapReady(true), 0);
    return () => {
      clearTimeout(id);
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // --- GeoJSON layer (re-renders on metric or data change) ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }
    selectedPathRef.current = null;

    /**
     * Extract the 4-digit kode from a GeoJSON feature's properties.
     * DAWA GeoJSON uses the `kode` property. Falls back to iterating
     * the kommuneNavn match if kode is absent (older TopoJSON may differ).
     */
    function getKode(feature: Feature): string | undefined {
      return feature.properties?.kode as string | undefined;
    }

    function buildStyle(feature: Feature | undefined): L.PathOptions {
      if (!feature) return {};
      const kode = getKode(feature);
      const km = kode ? metricsByIdRef.current[kode] : undefined;
      const value = km ? getMetricValue(km, activeMetricRef.current) : 0;
      return {
        fillColor: metricColor(value, maxValRef.current, activeMetricRef.current),
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

        if (km) {
          const value = getMetricValue(km, activeMetricRef.current);
          const label = METRIC_LABELS[activeMetricRef.current];
          const formatted = value > 0
            ? `${formatDanishNumber(Math.round(value * 10) / 10)} ${label}`
            : `Ingen data`;
          path.bindTooltip(`<strong>${navn}</strong><br/>${formatted}`, {
            sticky: true,
            className: 'map-tooltip',
          });
        } else {
          path.bindTooltip(navn, { sticky: true, className: 'map-tooltip' });
        }

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

    // Re-apply selection highlight if a kode is already selected
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
  }, [kommunerGeo, activeMetric, maxVal, mapReady]);

  // --- Re-apply selection when selectedKode changes without re-building the layer ---
  useEffect(() => {
    const layer = geoJsonLayerRef.current;
    if (!layer) return;

    // Clear old selection
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

  return (
    <div
      ref={containerRef}
      className="relative z-0 w-full rounded-2xl overflow-hidden border border-border shadow-md"
      style={{ height: '520px' }}
      aria-label="Danmarkskort med kommuner farvelagt efter valgt metrik"
    />
  );
}
