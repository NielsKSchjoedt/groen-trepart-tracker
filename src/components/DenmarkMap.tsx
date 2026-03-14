import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import { loadCatchmentsGeoJSON, loadCoastalWatersGeoJSON, loadWaterBodiesGeoJSON, loadNameLookup, loadCoastalWaterStatus, loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects, findPlanForFeature, findCatchmentForFeature } from '@/lib/data';
import { getProgressColor, getWfdStatusColor, formatDanishNumber } from '@/lib/format';
import { DetailPanel } from './DetailPanel';
import { CoastalWaterDetailPanel } from './CoastalWaterDetailPanel';
import { ProjectDetailPanel } from './ProjectDetailPanel';
import { getProjectKey } from '@/lib/project-selection';
import type { SelectedProject } from '@/lib/project-selection';
import { StubMapOverlay } from './StubMapOverlay';
import { NatureWatermark } from './NatureWatermark';
import { usePillar } from '@/lib/pillars';
import type { Plan, Catchment, DashboardData, CoastalWaterStatusData, CoastalWaterEntry, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import { Map, AlertTriangle } from 'lucide-react';
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
 * Ray-casting point-in-polygon test for a single GeoJSON ring.
 * Coordinates are in [longitude, latitude] order per GeoJSON/RFC 7946.
 *
 * @param lng - Test point longitude
 * @param lat - Test point latitude
 * @param ring - Array of [lng, lat] coordinate pairs forming a closed ring
 * @returns true if the point is inside the ring
 * @example pointInRing(10.5, 56.2, [[10,56],[11,56],[11,57],[10,57],[10,56]])
 */
function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const lngi = ring[i][0], lati = ring[i][1];
    const lngj = ring[j][0], latj = ring[j][1];
    if (
      (lati > lat) !== (latj > lat) &&
      lng < ((lngj - lngi) * (lat - lati)) / (latj - lati) + lngi
    ) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Test whether a [lng, lat] point is inside a GeoJSON Polygon or MultiPolygon.
 * Only tests the outer ring (index 0) of each polygon — holes are ignored
 * since catchment/coastal boundaries don't have meaningful interior holes.
 *
 * @param lng - Test point longitude
 * @param lat - Test point latitude
 * @param geometry - GeoJSON Geometry object
 * @returns true if the point falls inside the geometry
 * @example pointInGeometry(10.5, 56.2, feature.geometry)
 */
function pointInGeometry(lng: number, lat: number, geometry: Geometry): boolean {
  if (geometry.type === 'Polygon') {
    return pointInRing(lng, lat, geometry.coordinates[0] as number[][]);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as number[][][][]).some(
      (poly) => pointInRing(lng, lat, poly[0]),
    );
  }
  return false;
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
  projekt:  'projekt',
} as const;

export function DenmarkMap({ data }: DenmarkMapProps) {
  const { activePillar, config: pillarConfig } = usePillar();
  const [searchParams, setSearchParams] = useSearchParams();
  const showLayerToggle = pillarConfig.hasMultipleLayers;
  const isStub = !pillarConfig.hasData || !pillarConfig.hasGeoBreakdown;

  // --- Derive state from URL params ---

  /**
   * Active map layer. When the toggle is hidden, use the pillar's
   * `defaultLayer` (coastal for extraction/afforestation since MARS
   * returns null at the catchment level for those metrics).
   * When the toggle is shown, respect the user's URL param choice
   * or fall back to the pillar default.
   */
  const lagParam = searchParams.get(PARAM.lag);
  const layer: MapLayer = (() => {
    if (lagParam === 'kyst') return 'coastal';
    if (lagParam === 'opland') return 'catchments';
    return pillarConfig.defaultLayer;
  })();

  const [catchmentsGeo, setCatchmentsGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [coastalGeo, setCoastalGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [waterBodiesGeo, setWaterBodiesGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [lookup, setLookup] = useState<Record<string, string>>({});
  const [coastalStatus, setCoastalStatus] = useState<CoastalWaterStatusData | null>(null);
  const [showWaterBodies, setShowWaterBodies] = useState(false);
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const waterBodiesLayerRef = useRef<L.GeoJSON | null>(null);
  const ksfLayerRef = useRef<L.LayerGroup | null>(null);
  const nstLayerRef = useRef<L.LayerGroup | null>(null);
  const selectedPathRef = useRef<L.Path | null>(null);

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

  /**
   * Derive the selected project (circle marker) from the URL param.
   * Format: "ksf:<sagsnummer>|<featureName>" or "nst:<name>|<featureName>".
   * The feature name (coastal/catchment area the project sits in) is optional.
   */
  const selectedProject = useMemo((): (SelectedProject & { featureName?: string }) | undefined => {
    const raw = searchParams.get(PARAM.projekt);
    if (!raw) return undefined;
    const pipeIdx = raw.indexOf('|');
    const key = pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw;
    const featureName = pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : undefined;
    if (key.startsWith('ksf:')) {
      const sag = key.slice(4);
      const proj = ksfProjects.find((p) => p.sagsnummer === sag);
      return proj ? { source: 'klimaskovfonden', project: proj, featureName } : undefined;
    }
    if (key.startsWith('nst:')) {
      const name = key.slice(4);
      const proj = nstProjects.find((p) => p.name === name);
      return proj ? { source: 'naturstyrelsen', project: proj, featureName } : undefined;
    }
    return undefined;
  }, [searchParams, ksfProjects, nstProjects]);

  const panelOpen = !!(selectedPlan || selectedCatchment || selectedCoastalWater || selectedProject);

  // --- URL-updating helpers ---

  /** Switch the active map layer and clear any open panel. */
  const switchLayer = (newLayer: MapLayer) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.lag, newLayer === 'coastal' ? 'kyst' : 'opland');
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      next.delete(PARAM.projekt);
      return next;
    });
  };

  const openCatchmentPanel = useCallback((catchment: Catchment) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.opland, catchment.nameNormalized);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      next.delete(PARAM.projekt);
      return next;
    });
  }, [setSearchParams]);

  const openPlanPanel = useCallback((plan: Plan) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.plan, plan.id);
      next.delete(PARAM.opland);
      next.delete(PARAM.kystvand);
      next.delete(PARAM.projekt);
      return next;
    });
  }, [setSearchParams]);

  const openCoastalWaterPanel = useCallback((name: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set(PARAM.kystvand, name);
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      next.delete(PARAM.projekt);
      return next;
    });
  }, [setSearchParams]);

  /**
   * Open the project detail panel for a circle marker (KSF or NST project).
   * Optionally includes the name of the enclosing GeoJSON feature for context.
   *
   * @param sp - Selected project (source + project data)
   * @param featureName - Optional enclosing coastal/catchment feature name
   * @example openProjectPanel({ source: 'klimaskovfonden', project: p }, 'Mariager Fjord, indre')
   */
  const openProjectPanel = useCallback((sp: SelectedProject, featureName?: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const key = getProjectKey(sp);
      next.set(PARAM.projekt, featureName ? `${key}|${featureName}` : key);
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      return next;
    });
  }, [setSearchParams]);

  const closePanel = useCallback(() => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(PARAM.opland);
      next.delete(PARAM.plan);
      next.delete(PARAM.kystvand);
      next.delete(PARAM.projekt);
      return next;
    });
  }, [setSearchParams]);

  // Stable refs for callbacks so the GeoJSON layer effect doesn't re-run
  // every time URL params change (which would destroy and recreate the layer,
  // wiping out selection styling).
  const openCatchmentPanelRef = useRef(openCatchmentPanel);
  openCatchmentPanelRef.current = openCatchmentPanel;
  const openPlanPanelRef = useRef(openPlanPanel);
  openPlanPanelRef.current = openPlanPanel;
  const closePanelRef = useRef(closePanel);
  closePanelRef.current = closePanel;
  const openProjectPanelRef = useRef(openProjectPanel);
  openProjectPanelRef.current = openProjectPanel;

  // Stable refs for values that circle marker click handlers need.
  // Using refs avoids adding these to effect dependency arrays, which
  // would destroy and recreate all markers on every state change.
  const layerRef = useRef(layer);
  layerRef.current = layer;
  const coastalGeoRef = useRef(coastalGeo);
  coastalGeoRef.current = coastalGeo;
  const catchmentsGeoRef = useRef(catchmentsGeo);
  catchmentsGeoRef.current = catchmentsGeo;
  const lookupRef = useRef(lookup);
  lookupRef.current = lookup;
  const dataRef = useRef(data);
  dataRef.current = data;
  const accentColorRef = useRef(pillarConfig.accentColor);
  accentColorRef.current = pillarConfig.accentColor;

  /**
   * Handle a circle marker click by finding the enclosing GeoJSON polygon
   * (for contextual labelling), highlighting it on the map, and opening
   * the project detail panel. Works for every circle regardless of whether
   * the enclosing area has a MARS plan.
   *
   * @param sp - The project that was clicked (KSF or NST)
   * @param lng - Circle marker longitude (GeoJSON order)
   * @param lat - Circle marker latitude
   * @example handleCircleClick({ source: 'klimaskovfonden', project: p }, 10.5, 56.2)
   */
  const handleCircleClick = useCallback((sp: SelectedProject, lng: number, lat: number) => {
    const currentLayer = layerRef.current;
    const activeGeo = currentLayer === 'catchments'
      ? catchmentsGeoRef.current
      : coastalGeoRef.current;

    let featureName: string | undefined;

    if (activeGeo) {
      for (const feature of activeGeo.features) {
        if (!feature.geometry) continue;
        if (!pointInGeometry(lng, lat, feature.geometry)) continue;

        featureName = currentLayer === 'catchments'
          ? feature.properties?.hov_na || ''
          : feature.properties?.op_navn || '';

        // Highlight the matching polygon so the user sees which area was selected
        if (geoJsonLayerRef.current) {
          if (selectedPathRef.current) {
            geoJsonLayerRef.current.resetStyle(selectedPathRef.current);
          }
          geoJsonLayerRef.current.eachLayer((sublayer) => {
            const f = (sublayer as L.GeoJSON & { feature?: Feature }).feature;
            if (!f) return;
            const subName = currentLayer === 'catchments'
              ? f.properties?.hov_na || ''
              : f.properties?.op_navn || '';
            if (subName === featureName) {
              const path = sublayer as L.Path;
              path.setStyle({ weight: 3, color: accentColorRef.current, fillOpacity: 0.8 });
              path.bringToFront();
              selectedPathRef.current = path;
            }
          });
        }
        break;
      }
    }

    openProjectPanelRef.current(sp, featureName);
  }, []);

  // --- Data loading ---

  useEffect(() => {
    Promise.all([
      loadCatchmentsGeoJSON(),
      loadCoastalWatersGeoJSON(),
      loadWaterBodiesGeoJSON(),
      loadNameLookup(),
      loadCoastalWaterStatus(),
      loadKlimaskovfondenProjects(),
      loadNaturstyrelsenSkovProjects(),
    ]).then(([c, cw, wb, l, cs, ksf, nst]) => {
      setCatchmentsGeo(c);
      setCoastalGeo(cw);
      setWaterBodiesGeo(wb);
      setLookup(l);
      setCoastalStatus(cs);
      setKsfProjects(ksf);
      setNstProjects(nst);
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

    /**
     * Sum a PhaseBreakdown to get the total pipeline hectares/tons.
     * The MARS `totalExtractionEffortHa` (etc.) is unreliable — often 0
     * even when per-phase data exists — so we compute from breakdowns.
     */
    function phaseTotal(pb: { established: number; approved: number; preliminary: number } | undefined): number {
      if (!pb) return 0;
      return (pb.established || 0) + (pb.approved || 0) + (pb.preliminary || 0);
    }

    /**
     * Compute the choropleth percentage for a coastal plan feature.
     * Nitrogen and extraction use goal-relative coloring (pipeline / goal or potential).
     * Other pillars use relative-to-max.
     */
    let coastalMaxVal = 1;
    if (layer === 'coastal' && !['nitrogen', 'extraction'].includes(activePillar)) {
      coastalMaxVal = Math.max(
        ...data.plans.map((p) => {
          if (activePillar === 'afforestation') return phaseTotal(p.afforestationByPhase);
          return getNumericField(p as unknown as Record<string, unknown>, dataField);
        }),
        1,
      );
    }

    function getCoastalPct(plan: Plan): number {
      switch (activePillar) {
        case 'nitrogen':
          return plan.nitrogenProgressPct;
        case 'extraction': {
          const pipeHa = phaseTotal(plan.extractionByPhase);
          return plan.extractionPotentialHa > 0
            ? (pipeHa / plan.extractionPotentialHa) * 100
            : 0;
        }
        case 'afforestation': {
          const pipeHa = phaseTotal(plan.afforestationByPhase);
          return (pipeHa / coastalMaxVal) * 100;
        }
        default: {
          const val = getNumericField(plan as unknown as Record<string, unknown>, dataField);
          return (val / coastalMaxVal) * 100;
        }
      }
    }

    function getCoastalTooltip(plan: Plan): string {
      switch (activePillar) {
        case 'nitrogen':
          return `${plan.name}: ${Math.round(plan.nitrogenProgressPct)}% af mål (anlagt og i pipeline)`;
        case 'extraction': {
          const totalHa = phaseTotal(plan.extractionByPhase);
          const pct = plan.extractionPotentialHa > 0
            ? Math.round((totalHa / plan.extractionPotentialHa) * 100)
            : 0;
          return `${plan.name}: ${formatDanishNumber(Math.round(totalHa))} af ${formatDanishNumber(Math.round(plan.extractionPotentialHa))} ha (${pct}%)`;
        }
        case 'afforestation': {
          const totalHa = phaseTotal(plan.afforestationByPhase);
          return `${plan.name}: ${formatDanishNumber(Math.round(totalHa))} ha (anlagt og i pipeline)`;
        }
        case 'nature':
          return `${plan.name}: ${formatDanishNumber(Math.round(plan.naturePotentialAreaHa))} ha potentiale`;
        default:
          return plan.name;
      }
    }

    /**
     * Build a descriptive catchment tooltip that clarifies what the
     * value represents for each pillar, avoiding bare numbers that
     * could be misinterpreted.
     */
    function getCatchmentTooltip(name: string, val: number): string {
      const formatted = formatDanishNumber(Math.round(val));
      switch (activePillar) {
        case 'nitrogen':
          return `${name}: ${formatted} ton N (anlagt og i pipeline)`;
        case 'extraction':
          return `${name}: ${formatted} ha (anlagt og i pipeline)`;
        case 'afforestation':
          return `${name}: ${formatted} ha (anlagt og i pipeline)`;
        case 'nature':
          return `${name}: ${formatted} ha potentiale`;
        default:
          return `${name}: ${formatted}`;
      }
    }

    /** Universal green-yellow-red for all map views — intuitive regardless of pillar. */
    const choroplethColor = getProgressColor;

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
              fillColor: choroplethColor(relPct),
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
            fillColor: choroplethColor(getCoastalPct(plan)),
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
            path.bindTooltip(getCoastalTooltip(plan), { sticky: true, className: 'map-tooltip' });
          } else {
            path.bindTooltip(`${name || 'Ukendt'}: Ingen separat plan`, { sticky: true, className: 'map-tooltip' });
          }
        } else {
          const catchment = findCatchmentForFeature(name, data.catchments, lookup);
          if (catchment && dataField) {
            const val = getNumericField(catchment as unknown as Record<string, unknown>, dataField);
            path.bindTooltip(getCatchmentTooltip(catchment.name, val), { sticky: true, className: 'map-tooltip' });
          } else {
            path.bindTooltip(name || 'Ukendt', { sticky: true, className: 'map-tooltip' });
          }
        }

        path.on({
          mouseover: () => {
            if (path !== selectedPathRef.current) {
              path.setStyle({ weight: 3, color: pillarConfig.accentColor, fillOpacity: 0.7 });
            }
            path.bringToFront();
          },
          mouseout: () => {
            if (path !== selectedPathRef.current) {
              geoJsonLayer.resetStyle(path);
            }
          },
          click: () => {
            // Clear previous selection styling
            if (selectedPathRef.current && selectedPathRef.current !== path) {
              geoJsonLayer.resetStyle(selectedPathRef.current);
            }

            // Apply persistent selection styling
            path.setStyle({ weight: 3, color: pillarConfig.accentColor, fillOpacity: 0.8 });
            path.bringToFront();
            selectedPathRef.current = path;

            if (layer === 'coastal') {
              const plan = findPlanForFeature(name, data.plans, lookup);
              if (plan) openPlanPanelRef.current(plan);
              else closePanelRef.current();
            } else {
              const catchment = findCatchmentForFeature(name, data.catchments, lookup);
              if (catchment) openCatchmentPanelRef.current(catchment);
              else closePanelRef.current();
            }
          },
        });
      },
    }).addTo(map);

    geoJsonLayerRef.current = geoJsonLayer;
    selectedPathRef.current = null;

    if (waterBodiesLayerRef.current) {
      waterBodiesLayerRef.current.bringToFront();
    }
  }, [layer, catchmentsGeo, coastalGeo, lookup, data, getFeatureName, activePillar, pillarConfig, isStub]);

  // Clear map selection highlight when panel is closed externally (e.g. close button)
  useEffect(() => {
    if (!panelOpen && selectedPathRef.current && geoJsonLayerRef.current) {
      geoJsonLayerRef.current.resetStyle(selectedPathRef.current);
      selectedPathRef.current = null;
    }
  }, [panelOpen]);

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

  // --- Klimaskovfonden project markers ---
  // Skovrejsning (green) → afforestation pillar
  // Lavbund (orange) → extraction pillar

  const ksfSkovProjects = useMemo(() => ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning'), [ksfProjects]);
  const ksfLavbundProjects = useMemo(() => ksfProjects.filter((p) => p.projekttyp === 'Lavbund'), [ksfProjects]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (ksfLayerRef.current) {
      map.removeLayer(ksfLayerRef.current);
      ksfLayerRef.current = null;
    }

    const activeKsfProjects =
      activePillar === 'afforestation' ? ksfSkovProjects :
      activePillar === 'extraction' ? ksfLavbundProjects :
      [];

    if (activeKsfProjects.length === 0) return;

    const ksfGroup = L.layerGroup();
    const maxArea = Math.max(...activeKsfProjects.map((p) => p.areaHa), 1);

    for (const proj of activeKsfProjects) {
      const [lon, lat] = proj.centroid;
      if (!lat || !lon) continue;

      const radius = Math.max(4, Math.min(14, 4 + 10 * Math.sqrt(proj.areaHa / maxArea)));
      const isSkov = proj.projekttyp === 'Skovrejsning';
      const color = isSkov ? '#15803d' : '#92400e';
      const fillColor = isSkov ? '#22c55e' : '#f59e0b';

      const marker = L.circleMarker([lat, lon], {
        radius,
        weight: 1.5,
        color,
        fillColor,
        fillOpacity: 0.7,
        opacity: 0.9,
        pane: 'markerPane',
        bubblingMouseEvents: false,
      });

      const areaStr = proj.areaHa < 10
        ? proj.areaHa.toFixed(1).replace('.', ',')
        : Math.round(proj.areaHa).toLocaleString('da-DK');
      const typeLabel = isSkov ? 'Skovrejsning' : 'Lavbundsprojekt';
      const statusLabel = isSkov ? 'Anlagt (frivillig skovrejsning)' : 'Anlagt (lavbundsudtag)';
      const kommuneStr = proj.kommune ? ` · ${proj.kommune}` : '';
      marker.bindTooltip(
        `<strong>Klimaskovfonden ${proj.sagsnummer}</strong><br/>${typeLabel} · ${areaStr} ha${kommuneStr} · ${proj.aargang}<br/><span style="opacity:0.7">${statusLabel}</span>`,
        { sticky: true, className: 'map-tooltip' },
      );

      marker.on('click', () => handleCircleClick({ source: 'klimaskovfonden', project: proj }, lon, lat));

      ksfGroup.addLayer(marker);
    }

    ksfGroup.addTo(map);
    ksfLayerRef.current = ksfGroup;

    return () => {
      if (ksfLayerRef.current) {
        map.removeLayer(ksfLayerRef.current);
        ksfLayerRef.current = null;
      }
    };
  }, [activePillar, ksfSkovProjects, ksfLavbundProjects, handleCircleClick]);

  // --- Naturstyrelsen state afforestation markers (afforestation pillar only) ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Remove previous NST layer
    if (nstLayerRef.current) {
      map.removeLayer(nstLayerRef.current);
      nstLayerRef.current = null;
    }

    // Only show for afforestation pillar
    if (activePillar !== 'afforestation' || nstProjects.length === 0) return;

    const nstGroup = L.layerGroup();
    const matchedProjects = nstProjects.filter((p) => p.centroid);

    // Scale marker radius by area (sqrt scale, min 4px, max 14px)
    const maxArea = Math.max(...matchedProjects.map((p) => p.areaHa ?? 0), 1);

    for (const proj of nstProjects) {
      if (!proj.centroid) continue;
      const [lon, lat] = proj.centroid;
      if (!lat || !lon) continue;

      const area = proj.areaHa ?? 0;
      const radius = Math.max(4, Math.min(14, 4 + 10 * Math.sqrt(area / maxArea)));
      const isOngoing = proj.status === 'ongoing';
      const color = isOngoing ? '#1e40af' : '#4338ca';
      const fillColor = isOngoing ? '#3b82f6' : '#818cf8';

      const marker = L.circleMarker([lat, lon], {
        radius,
        weight: 1.5,
        color,
        fillColor,
        fillOpacity: 0.7,
        opacity: 0.9,
        pane: 'markerPane',
        bubblingMouseEvents: false,
      });

      const areaStr = area > 0
        ? area < 10
          ? area.toFixed(1).replace('.', ',')
          : Math.round(area).toLocaleString('da-DK')
        : 'ukendt';
      const statusLabel = isOngoing ? 'Igangværende' : 'Afsluttet';
      const districtStr = proj.district ? ` · ${proj.district}` : '';

      marker.bindTooltip(
        `<strong>${proj.name}</strong><br/>Naturstyrelsen${districtStr} · ${areaStr} ha<br/><span style="opacity:0.7">${statusLabel}</span>`,
        { sticky: true, className: 'map-tooltip' },
      );

      marker.on('click', () => handleCircleClick({ source: 'naturstyrelsen', project: proj }, lon, lat));

      nstGroup.addLayer(marker);
    }

    nstGroup.addTo(map);
    nstLayerRef.current = nstGroup;

    return () => {
      if (nstLayerRef.current) {
        map.removeLayer(nstLayerRef.current);
        nstLayerRef.current = null;
      }
    };
  }, [activePillar, nstProjects, handleCircleClick]);

  // --- Legend data ---
  // Nitrogen coastal uses goal-relative coloring; all other combos use
  // relative-to-max. The legend labels must communicate the scale honestly.

  const isGoalRelative = layer === 'coastal' && (activePillar === 'nitrogen' || activePillar === 'extraction');
  const legendItems = pillarConfig.hasData ? [
    { color: getProgressColor(80), label: isGoalRelative ? 'Tæt på mål' : 'Højest' },
    { color: getProgressColor(50), label: isGoalRelative ? 'Midtvejs' : 'Middel' },
    { color: getProgressColor(10), label: isGoalRelative ? 'Langt fra mål' : 'Lavest' },
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
                    <p><strong>Vandoplande</strong> = 23 hovedvandoplande (hvor vandet kommer fra). Farven viser kvælstofreduktion (anlagt og i pipeline) — det grønneste opland har mest aktivitet.</p>
                    <p><strong>Kystvandsoplande</strong> = 37 kystvandoplande (hvor vandet løber hen). Her bor de lokale implementeringsplaner og projekter. Farven viser anlagt og i pipeline i % af det lokale reduktionsmål.</p>
                    <p className="text-[10px] opacity-70">De to geografiske inddelinger overlapper men følger ikke de samme grænser.</p>
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
            <span className="font-medium text-foreground/70">{(() => {
              if (isGoalRelative) {
                const goalLabels: Record<string, string> = {
                  nitrogen: 'Kvælstof — anlagt og i pipeline i % af mål:',
                  extraction: 'Lavbundsudtag — anlagt og i pipeline i % af potentiale:',
                };
                return goalLabels[activePillar] ?? `${pillarConfig.label} — fremskridt mod mål:`;
              }
              const metricLabels: Record<string, string> = {
                nitrogen: 'Kvælstof — anlagt og i pipeline (ton):',
                extraction: 'Lavbundsudtag — anlagt og i pipeline (ha):',
                afforestation: 'Skovrejsning — anlagt og i pipeline (ha):',
                nature: 'Naturpotentiale (ha):',
              };
              return metricLabels[activePillar] ?? `${pillarConfig.label}:`;
            })()}</span>
            {legendItems.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full border border-border" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
            {activePillar === 'afforestation' && ksfSkovProjects.length > 0 && (
              <>
                <span className="ml-2 mr-1 text-muted-foreground/50">|</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-green-700" style={{ backgroundColor: '#22c55e' }} />
                  <span>Klimaskovfonden (skov)</span>
                </div>
              </>
            )}
            {activePillar === 'afforestation' && nstProjects.filter(p => p.centroid).length > 0 && (
              <>
                <span className="ml-2 mr-1 text-muted-foreground/50">|</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-blue-800" style={{ backgroundColor: '#3b82f6' }} />
                  <span>Naturstyrelsen</span>
                </div>
              </>
            )}
            {activePillar === 'extraction' && ksfLavbundProjects.length > 0 && (
              <>
                <span className="ml-2 mr-1 text-muted-foreground/50">|</span>
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full border border-amber-800" style={{ backgroundColor: '#f59e0b' }} />
                  <span>Klimaskovfonden (lavbund)</span>
                </div>
              </>
            )}
            <InfoTooltip
              title="Farveindeks"
              content={(() => {
                if (layer === 'coastal' && activePillar === 'nitrogen') {
                  return <p>Kystvandsoplande farves efter <strong>anlagt og i pipeline i % af det lokale kvælstofreduktionsmål</strong> fra vandplanerne. Grønt = tæt på målet. Summen omfatter alle projektfaser (anlagt + godkendt + forundersøgelse + skitse).</p>;
                }
                if (layer === 'coastal' && activePillar === 'extraction') {
                  return <p>Kystvandsoplande farves efter <strong>anlagt og i pipeline i % af det identificerede potentiale</strong> for lavbundsudtag. Grønt = stor andel af potentialet er dækket. Summen omfatter alle projektfaser (anlagt + godkendt + forundersøgelse + skitse).</p>;
                }
                const metricDesc: Record<string, string> = {
                  nitrogen: 'kvælstofreduktion — anlagt og i pipeline (ton N)',
                  extraction: 'lavbundsudtag — anlagt og i pipeline (ha)',
                  afforestation: 'skovrejsning — anlagt og i pipeline (ha)',
                  nature: 'identificeret naturgenopretningspotentiale (ha)',
                  co2: 'CO₂-data',
                };
                return (
                  <p>Det grønneste område har den højeste sum af anlagt og i pipeline for {metricDesc[activePillar] ?? 'denne metrik'}, og alle andre skaleres i forhold. Det er ikke en målstreg — det viser hvilke områder der har mest aktivitet.</p>
                );
              })()}
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

      {activePillar === 'afforestation' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50/60 px-3.5 py-2.5 mb-4 text-xs text-amber-900/80 leading-relaxed">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <div>
            <strong>Tre datakilder.</strong> Vandoplande farves efter MARS-projekter (vandmiljørelateret skovrejsning). <span style={{ color: '#22c55e', fontWeight: 600 }}>Grønne cirkler</span> = Klimaskovfondens {ksfSkovProjects.length} skovrejsningsprojekter (~{Math.round(ksfSkovProjects.reduce((s, p) => s + p.areaHa, 0)).toLocaleString('da-DK')} ha). <span style={{ color: '#3b82f6', fontWeight: 600 }}>Blå cirkler</span> = Naturstyrelsens {nstProjects.filter(p => p.centroid).length} statslige skovrejsningsprojekter (~{Math.round(nstProjects.filter(p => p.centroid).reduce((s, p) => s + (p.areaHa ?? 0), 0)).toLocaleString('da-DK')} ha).
          </div>
        </div>
      )}

      {activePillar === 'extraction' && ksfLavbundProjects.length > 0 && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50/60 px-3.5 py-2.5 mb-4 text-xs text-amber-900/80 leading-relaxed">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <div>
            <strong>Supplerende datakilde.</strong> Vandoplande farves efter MARS-projekter (lavbundsudtag). <span style={{ color: '#f59e0b', fontWeight: 600 }}>Orange cirkler</span> = Klimaskovfondens {ksfLavbundProjects.length} lavbundsprojekter (~{Math.round(ksfLavbundProjects.reduce((s, p) => s + p.areaHa, 0)).toLocaleString('da-DK')} ha).
          </div>
        </div>
      )}

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
        {panelOpen && selectedProject && (
          <div className="hidden md:block w-2/5 min-h-[520px]">
            <ProjectDetailPanel project={selectedProject} featureName={selectedProject.featureName} onClose={closePanel} />
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
      {panelOpen && selectedProject && (
        <div className="md:hidden mt-4 rounded-2xl border border-border shadow-md overflow-hidden">
          <ProjectDetailPanel project={selectedProject} featureName={selectedProject.featureName} onClose={closePanel} />
        </div>
      )}
    </section>
  );
}
