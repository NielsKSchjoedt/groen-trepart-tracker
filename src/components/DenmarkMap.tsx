import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import proj4 from 'proj4';
import 'proj4leaflet';
import type { FeatureCollection, Geometry, Feature } from 'geojson';
import { loadCatchmentsGeoJSON, loadCoastalWatersGeoJSON, loadWaterBodiesGeoJSON, loadNameLookup, loadCoastalWaterStatus, loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects, loadKommunerGeoJSON, loadKommuneBenchmarkData, loadNatura2000MapGeo, loadSection3MapGeo, loadProjectGeometries, loadProjectNatureOverlap, findPlanForFeature, findCatchmentForFeature } from '@/lib/data';
import { getProgressColor, getWfdStatusColor, formatDanishNumber } from '@/lib/format';
import { DetailPanel } from './DetailPanel';
import { CoastalWaterDetailPanel } from './CoastalWaterDetailPanel';
import { ProjectDetailPanel } from './ProjectDetailPanel';
import { getProjectKey } from '@/lib/project-selection';
import type { SelectedProject } from '@/lib/project-selection';
import { StubMapOverlay } from './StubMapOverlay';
import { MobileBottomSheet } from './MobileBottomSheet';
import { NatureWatermark } from './NatureWatermark';
import { BiodivLayers } from './DenmarkMapBiodiv';
import { useBiodivSearch } from '@/hooks/useBiodivSearch';
import { MapLayersPanel, type LayerGroup, type LayerRow } from './MapLayersPanel';
import { PhaseFilter } from './PhaseFilter';
import { BIODIV_WMS_LAYERS, type BiodivWmsId } from '@/lib/biodiv-map';
import { usePillar } from '@/lib/pillars';
import { getMapLayerHints } from '@/lib/chapters';
import type { Plan, Catchment, DashboardData, CoastalWaterStatusData, CoastalWaterEntry, KlimaskovfondenProject, NaturstyrelsenSkovProject, KommuneBenchmarkB4Data, ProjectNatureOverlapData } from '@/lib/types';
import type { ProjectPhase } from '@/lib/phase-config';
import { PHASE_CONFIGS } from '@/lib/phase-config';
import {
  collectMapProjects,
  findMarsProjectByGeoId,
} from '@/lib/map-projects';
import { Map, MousePointerClick, Check } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import { MapFullscreenShell } from './MapFullscreenShell';
import { KSF_COLOR_SKOV, KSF_COLOR_LAVBUND, NST_COLOR, SECTION3_COLOR } from '@/lib/supplement-colors';
import { getSupplementPresentation } from '@/lib/kommune-metrics';
import { MapProjectLayer } from './MapProjectLayer';
import { useFirstVisitHint } from '@/hooks/useFirstVisitHint';
import 'leaflet/dist/leaflet.css';

interface DenmarkMapProps {
  data: DashboardData;
}

type MapLayer = 'catchments' | 'coastal' | 'kommuner';

/** Shared caveat for visual project × nature overlap (see ProjectNatureOverlapBlock). */
const NATURE_OVERLAP_CAVEAT =
  'Visuelt overlap mellem projektareal og natur er en stærk indikator for naturpotentiale — ikke en garanti for, at naturen reelt forbedres.';

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
 * - `lag`      : base map — "kyst" coastal, "opland" catchments, "fra" hidden, absent = pillar default
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

/**
 * Markudledningskortet (SEGES, 2025) — kvælstof-potentialekort på Danmarks
 * Miljøportal. Vist som valgfrit WMS-overlay, men kun under Kvælstof-målet,
 * da det handler om N-udledning til kyst (ikke biodiversitet). Erstatter de
 * tidligere døde `transform:*`-lag fra biodiversitetspanelet.
 */
const MARKUDLEDNING_WMS = {
  base: 'https://arld-extgeo.miljoeportal.dk/geoserver/wms',
  layer: 'markudledningskort:Markudledning2025_SEGES',
} as const;

/**
 * Naturpotentialer (MARS / SGAV) — de områder de lokale treparter har udpeget
 * som ny natur i omlægningsplanerne. Vist som valgfrit WMS-overlay, men kun
 * under Beskyttet natur-målet. Dette er den fungerende erstatning for det
 * tidligere døde `transform:transform_ny_natur`-lag. Kilde fundet via Danmarks
 * Arealinformations databutik (urn:dmp:ds:mars-naturpotentialer); laget
 * understøtter EPSG:3857, så det kan tegnes direkte på Leaflet-kortet.
 */
const NATURPOTENTIALE_WMS = {
  base: 'https://mars.sgav.dk/geo/wms',
  layer: 'naturpotentialer',
} as const;

/**
 * Beskyttet natur (faktisk juridisk beskyttelse) — Natura 2000 habitatområder
 * og §3-beskyttede naturtyper. Begge fra Danmarks Miljøportals arealeditering-
 * GeoServer (CC0-licens), som reprojicerer til EPSG:3857. Vises som valgfrie
 * overlays under Beskyttet natur-målet, så man visuelt kan sammenligne den
 * faglige naturværdi (DCE/KU) med hvor naturen rent faktisk er beskyttet.
 */
const AREALEDITERING_WMS_BASE = 'https://arealeditering-dist-geo.miljoeportal.dk/geoserver/wms';

/** Sequential green scale for B4 kommune choropleth (darker = higher protected share). */
const B4_COLOR_STOPS = ['#f0fdf4', '#86efac', '#16a34a', '#052e16'] as const;
const B4_NO_DATA_COLOR = 'hsl(0 0% 92%)';

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

function b4ChoroplethColor(pct: number): string {
  if (pct <= 0) return B4_NO_DATA_COLOR;
  const t = Math.min(pct / 100, 1);
  const seg = (B4_COLOR_STOPS.length - 1) * t;
  const idx = Math.min(Math.floor(seg), B4_COLOR_STOPS.length - 2);
  return lerpHex(B4_COLOR_STOPS[idx], B4_COLOR_STOPS[idx + 1], seg - idx);
}

/** EPSG:25832 for WMS layers that reject Web Mercator (e.g. kulstofrige lavbund). */
const DEF_25832 = '+proj=utm +zone=32 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs';
proj4.defs('EPSG:25832', DEF_25832);
const CRS_25832 = new L.Proj.CRS('EPSG:25832', DEF_25832);

/**
 * Drikkevandsinteresser (OD/OSD) — Miljøstyrelsen via GRUKOS WMS.
 * Vises som valgfrit overlay under Kvælstof-målet (vandmiljø-kontekst).
 */
const DRIKKEVAND_WMS = {
  base: 'https://wfs2-miljoegis.mim.dk/grukos/ows',
  layer: 'drikkevandsinteresser',
} as const;

/**
 * Kulstofrige lavbundsjorder (DCA 2024) — kun EPSG:25832; kortet forbliver 3857.
 * Vises under Lavbund-målet i gruppen Klima / kulstof.
 */
const KULSTOF_LAVBUND_WMS = {
  base: 'https://miljoegis3.mim.dk/wms?servicename=vandprojekter_wms',
  layer: 'theme-kulstofrige_lavbund_2022_kulstof2022_i0',
} as const;

export function DenmarkMap({ data }: DenmarkMapProps) {
  const { activePillar, config: pillarConfig } = usePillar();
  const [searchParams, setSearchParams] = useSearchParams();
  const isStub = !pillarConfig.hasData || !pillarConfig.hasGeoBreakdown;
  const mapLayerHints =
    activePillar && activePillar !== 'co2' ? getMapLayerHints(activePillar) : null;

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
    if (lagParam === 'kommuner') return 'kommuner';
    // Naturmålet har ingen vandgeografi — grundkortet er kommuner (B4), ikke de
    // 23 vandoplande. Andre delmål bruger deres vand-defaultLayer.
    if (activePillar === 'nature') return 'kommuner';
    return pillarConfig.defaultLayer;
  })();
  /**
   * Whether the base choropleth (grundkort) is shown. Tier 2: explicit `?lag=fra`
   * hides it; on beskyttet natur the default is off (overlap story = tier 1 + lag).
   */
  const baseVisible = !isStub && (
    lagParam === 'kyst' || lagParam === 'opland' || lagParam === 'kommuner' ||
    (lagParam === null && activePillar !== 'nature')
  );

  const [catchmentsGeo, setCatchmentsGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [coastalGeo, setCoastalGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [waterBodiesGeo, setWaterBodiesGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [natura2000Geo, setNatura2000Geo] = useState<FeatureCollection<Geometry> | null>(null);
  const [section3Geo, setSection3Geo] = useState<FeatureCollection<Geometry> | null>(null);
  const [projectGeometries, setProjectGeometries] = useState<Record<string, [number, number][]> | null>(null);
  const [natureOverlap, setNatureOverlap] = useState<ProjectNatureOverlapData | null>(null);
  const [lookup, setLookup] = useState<Record<string, string>>({});
  const [coastalStatus, setCoastalStatus] = useState<CoastalWaterStatusData | null>(null);
  const [showWaterBodies, setShowWaterBodies] = useState(false);
  const [showMarkudledning, setShowMarkudledning] = useState(false);
  const [showDrikkevand, setShowDrikkevand] = useState(false);
  const [showNaturpotentiale, setShowNaturpotentiale] = useState(false);
  const [showNatura2000, setShowNatura2000] = useState(false);
  const [showSection3, setShowSection3] = useState(false);
  const [showKulstof, setShowKulstof] = useState(false);
  const [kommunerGeo, setKommunerGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [b4Data, setB4Data] = useState<KommuneBenchmarkB4Data | null>(null);
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);
  /** Tier 1: which MARS phases are drawn (default: anlagt only). */
  const [activePhases, setActivePhases] = useState<Set<ProjectPhase>>(() => new Set(['established']));
  /** Tier 1 supplement: Klimaskovfonden lavbundsprojekter (extraction pillar). */
  const [showKsfLavbund, setShowKsfLavbund] = useState(true);
  /** Tier 1 supplement: Klimaskovfonden skov (afforestation pillar). */
  const [showKsfSkov, setShowKsfSkov] = useState(true);
  /** Tier 1 supplement: Naturstyrelsen skov (afforestation pillar). */
  const [showNst, setShowNst] = useState(true);

  // Reset phase filter when switching delmål (matches URL reset behaviour).
  const [prevActivePillar, setPrevActivePillar] = useState(activePillar);
  if (prevActivePillar !== activePillar) {
    setPrevActivePillar(activePillar);
    setActivePhases(new Set(['established']));
    setShowKsfLavbund(true);
    setShowKsfSkov(true);
    setShowNst(true);
  }

  // Tier-3 overlays default off; tier-1 MARS phases default to anlagt only.
  const { bioActive, vnsOn, setBio, setVns } = useBiodivSearch({ searchParams, setSearchParams });

  const mapHint = useFirstVisitHint('map-click', 20_000);
  // Only show the hint after Leaflet has fully initialized to avoid z-index
  // races during the map's async setup (Leaflet creates z-index:1000 control
  // containers inside its own stacking context, which can bleed through before
  // the host element's stacking context is committed by the browser).
  const [mapReady, setMapReady] = useState(false);
  /** Set when Leaflet `map` is created; safe to pass to children (avoids ref access during render). */
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const waterBodiesLayerRef = useRef<L.GeoJSON | null>(null);
  const markudledningLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const drikkevandLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const naturpotentialeLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const natura2000LayerRef = useRef<L.GeoJSON | null>(null);
  const section3LayerRef = useRef<L.GeoJSON | null>(null);
  const kulstofLavbundLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const ksfLayerRef = useRef<L.LayerGroup | null>(null);
  const nstLayerRef = useRef<L.LayerGroup | null>(null);
  const b4ChoroplethLayerRef = useRef<L.GeoJSON | null>(null);
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
   * Format: "ksf:<sagsnummer>|<featureName>", "nst:<name>|<featureName>", or "mars:<geoId>|<featureName>".
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
    if (key.startsWith('mars:')) {
      const geoId = key.slice(5);
      const found = findMarsProjectByGeoId(data, geoId);
      return found ? { source: 'mars', ...found, featureName } : undefined;
    }
    return undefined;
  }, [searchParams, ksfProjects, nstProjects, data]);

  const selectedProjectCoordinates = useMemo((): [number, number][] | undefined => {
    if (!selectedProject || selectedProject.source !== 'mars' || !projectGeometries) return undefined;
    return projectGeometries[selectedProject.project.geoId];
  }, [selectedProject, projectGeometries]);

  const selectedMarsNatureOverlap = useMemo(() => {
    if (!selectedProject || selectedProject.source !== 'mars' || !natureOverlap) return undefined;
    return natureOverlap.byProject[selectedProject.project.geoId] ?? null;
  }, [selectedProject, natureOverlap]);

  const panelOpen = !!(selectedPlan || selectedCatchment || selectedCoastalWater || selectedProject);
  /**
   * Tier 2 grundkort for naturmålet: kommune-B4-choropleth (andel kortlagt
   * naturværdi med §3-/N2000-status). Drives af grundkort-segmentet ("Kommuner"),
   * ikke et Lag — naturmålet har ingen vandgeografi, så de 23 vandoplande gav
   * ingen mening som baggrund.
   */
  const showNatureKommuneBase =
    activePillar === 'nature' && layer === 'kommuner' && baseVisible && !!kommunerGeo && !!b4Data;

  // Dismiss map hint as soon as the user clicks any map feature
  useEffect(() => {
    if (panelOpen) mapHint.dismiss();
  }, [panelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- URL-updating helpers ---

  /**
   * Set the base map (grundkort): pick a geography, or pass `'off'` to hide the
   * choropleth entirely. Clears any open panel since the underlying feature may
   * no longer be visible.
   */
  const setBaseLayer = (target: MapLayer | 'off') => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const lagValue =
        target === 'off' ? 'fra'
        : target === 'coastal' ? 'kyst'
        : target === 'kommuner' ? 'kommuner'
        : 'opland';
      next.set(PARAM.lag, lagValue);
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
  const openPlanPanelRef = useRef(openPlanPanel);
  const closePanelRef = useRef(closePanel);
  const openProjectPanelRef = useRef(openProjectPanel);

  // Stable refs for values that circle marker click handlers need.
  // Using refs avoids adding these to effect dependency arrays, which
  // would destroy and recreate all markers on every state change.
  const layerRef = useRef(layer);
  const coastalGeoRef = useRef(coastalGeo);
  const catchmentsGeoRef = useRef(catchmentsGeo);
  const lookupRef = useRef(lookup);
  const dataRef = useRef(data);
  const accentColorRef = useRef(pillarConfig.accentColor);

  useEffect(() => {
    openCatchmentPanelRef.current = openCatchmentPanel;
    openPlanPanelRef.current = openPlanPanel;
    closePanelRef.current = closePanel;
    openProjectPanelRef.current = openProjectPanel;
    layerRef.current = layer;
    coastalGeoRef.current = coastalGeo;
    catchmentsGeoRef.current = catchmentsGeo;
    lookupRef.current = lookup;
    dataRef.current = data;
    accentColorRef.current = pillarConfig.accentColor;
  });

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

  /**
   * Handle a MARS project dot/polygon click — highlight enclosing area when
   * grundkort is visible, then open the project detail panel.
   */
  const handleMarsProjectClick = useCallback((geoId: string, lng: number, lat: number) => {
    const found = findMarsProjectByGeoId(dataRef.current, geoId);
    if (!found) return;

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

    openProjectPanelRef.current({ source: 'mars', ...found }, featureName);
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
      loadKommunerGeoJSON(),
      loadKommuneBenchmarkData(),
      loadNatura2000MapGeo(),
    ]).then(([c, cw, wb, l, cs, ksf, nst, kommuner, benchmark, n2000]) => {
      setCatchmentsGeo(c);
      setCoastalGeo(cw);
      setWaterBodiesGeo(wb);
      setLookup(l);
      setCoastalStatus(cs);
      setKsfProjects(ksf);
      setNstProjects(nst);
      setKommunerGeo(kommuner);
      setB4Data(benchmark?.b4 ?? null);
      setNatura2000Geo(n2000);
    });
  }, []);

  // Project geometries (tier 1) + nature-only tier-3 overlays.
  useEffect(() => {
    if (isStub) return;
    let cancelled = false;
    const loaders: Promise<unknown>[] = [loadProjectGeometries()];
    if (activePillar === 'nature') {
      loaders.push(loadSection3MapGeo(), loadProjectNatureOverlap());
    }
    Promise.all(loaders).then((results) => {
      if (cancelled) return;
      const geometries = results[0] as Record<string, [number, number][]>;
      setProjectGeometries(geometries);
      if (activePillar === 'nature') {
        setSection3Geo(results[1] as FeatureCollection<Geometry> | null);
        setNatureOverlap(results[2] as ProjectNatureOverlapData | null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activePillar, isStub]);

  /** Tier 1: MARS projects for the active pillar and selected phases. */
  const mapProjects = useMemo(
    () => (activePillar && !isStub ? collectMapProjects(data, activePillar, activePhases) : []),
    [data, activePillar, activePhases, isStub],
  );

  const mapProjectsWithGeometry = useMemo(() => {
    if (!projectGeometries) return [];
    return mapProjects.filter((p) => {
      const ring = projectGeometries[p.geoId];
      return ring && ring.length >= 3;
    });
  }, [mapProjects, projectGeometries]);

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
    setLeafletMap(map);

    // Delay the state update so it runs in a separate event-loop tick rather
    // than synchronously inside the effect body (react-hooks/set-state-in-effect).
    // This also guarantees Leaflet's DOM mutations are fully committed before
    // the hint overlay renders, eliminating z-index races with Leaflet controls.
    const readyTimer = setTimeout(() => setMapReady(true), 0);

    return () => {
      clearTimeout(readyTimer);
      map.remove();
      mapRef.current = null;
      setLeafletMap(null);
      setMapReady(false);
    };
  }, []);

  const getFeatureName = useCallback((feature: Feature, currentLayer: MapLayer): string => {
    if (currentLayer === 'catchments') return feature.properties?.hov_na || '';
    return feature.properties?.op_navn || '';
  }, []);

  // --- GeoJSON layer rendering ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Always clear the previous choropleth first so toggling the base map off
    // (lag=fra) actually removes it from the map.
    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    // 'kommuner' base (naturmålet) tegnes af B4-effekten nedenfor, ikke her.
    if (isStub || !baseVisible || layer === 'kommuner') return;

    const activeGeo = layer === 'catchments' ? catchmentsGeo : coastalGeo;
    if (!activeGeo) return;

    const dataField = layer === 'catchments' ? pillarConfig.catchmentDataField : pillarConfig.planDataField;

    let maxVal = 1;
    if (layer === 'catchments' && dataField) {
      maxVal = Math.max(
        ...data.catchments.map((c) => getNumericField(c as unknown as Record<string, unknown>, dataField)),
        1,
      );
    }

    /**
     * Sum a LegacyPhaseTotals to get the total pipeline hectares/tons.
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
  }, [layer, baseVisible, catchmentsGeo, coastalGeo, lookup, data, getFeatureName, activePillar, pillarConfig, isStub]);

  // --- Tier 2: B4 kommune choropleth — naturmålets grundkort ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (b4ChoroplethLayerRef.current) {
      map.removeLayer(b4ChoroplethLayerRef.current);
      b4ChoroplethLayerRef.current = null;
    }

    if (!showNatureKommuneBase || !kommunerGeo || !b4Data) return;

    if (!map.getPane('b4ChoroplethGeo')) {
      const pane = map.createPane('b4ChoroplethGeo');
      pane.style.zIndex = '350';
    }

    const b4Layer = L.geoJSON(kommunerGeo, {
      pane: 'b4ChoroplethGeo',
      style: (feature) => {
        if (!feature) return {};
        const kode = String(feature.properties?.kode ?? '');
        const row = b4Data.byKommune[kode];
        const pct = row?.pctVaerdiBeskyttet ?? 0;
        return {
          fillColor: b4ChoroplethColor(pct),
          fillOpacity: 0.55,
          weight: 1.5,
          color: 'hsl(40, 18%, 82%)',
          opacity: 0.9,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const kode = String(feature.properties?.kode ?? '');
        const navn = String(feature.properties?.navn ?? kode);
        const row = b4Data.byKommune[kode];
        const path = featureLayer as L.Path;
        if (row) {
          const pctLabel = formatDanishNumber(Math.round(row.pctVaerdiBeskyttet * 10) / 10);
          path.bindTooltip(
            `${navn}: ${formatDanishNumber(Math.round(row.overlapHa))} ha af ${formatDanishNumber(Math.round(row.naturvaerdiHa))} ha kortlagt naturværdi har §3-/Natura 2000-status (${pctLabel} %)`,
            { sticky: true, className: 'map-tooltip' },
          );
        } else {
          path.bindTooltip(navn, { sticky: true, className: 'map-tooltip' });
        }
        path.on({
          mouseover: () => {
            path.setStyle({ weight: 3, color: pillarConfig.accentColor, fillOpacity: 0.8 });
            path.bringToFront();
          },
          mouseout: () => {
            b4Layer.resetStyle(path);
          },
        });
      },
    });
    b4Layer.addTo(map);
    b4ChoroplethLayerRef.current = b4Layer;
  }, [showNatureKommuneBase, kommunerGeo, b4Data, pillarConfig.accentColor]);

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

  // --- Markudledningskort (kvælstof) WMS overlay ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (markudledningLayerRef.current) {
      map.removeLayer(markudledningLayerRef.current);
      markudledningLayerRef.current = null;
    }

    // Only relevant for the nitrogen goal — it maps N-runoff to coast.
    if (!showMarkudledning || activePillar !== 'nitrogen') return;

    if (!map.getPane('markudledningWms')) {
      const pane = map.createPane('markudledningWms');
      pane.style.zIndex = '250';
    }

    const wms = L.tileLayer.wms(MARKUDLEDNING_WMS.base, {
      layers: MARKUDLEDNING_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.65,
      pane: 'markudledningWms',
      attribution: 'Danmarks Miljøportal · Markudledningskortet (SEGES)',
    });
    wms.addTo(map);
    markudledningLayerRef.current = wms;
  }, [showMarkudledning, activePillar]);

  // --- Drikkevandsinteresser WMS overlay ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drikkevandLayerRef.current) {
      map.removeLayer(drikkevandLayerRef.current);
      drikkevandLayerRef.current = null;
    }

    if (!showDrikkevand || activePillar !== 'nitrogen') return;

    if (!map.getPane('drikkevandWms')) {
      const pane = map.createPane('drikkevandWms');
      pane.style.zIndex = '250';
    }

    const wms = L.tileLayer.wms(DRIKKEVAND_WMS.base, {
      layers: DRIKKEVAND_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.6,
      pane: 'drikkevandWms',
      attribution: 'Danmarks Miljøportal',
    });
    wms.addTo(map);
    drikkevandLayerRef.current = wms;
  }, [showDrikkevand, activePillar]);

  // --- Naturpotentialer (ny natur) WMS overlay ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (naturpotentialeLayerRef.current) {
      map.removeLayer(naturpotentialeLayerRef.current);
      naturpotentialeLayerRef.current = null;
    }

    // Only relevant for the nature goal — it shows designated new nature.
    if (!showNaturpotentiale || activePillar !== 'nature') return;

    if (!map.getPane('naturpotentialeWms')) {
      const pane = map.createPane('naturpotentialeWms');
      pane.style.zIndex = '250';
    }

    const wms = L.tileLayer.wms(NATURPOTENTIALE_WMS.base, {
      layers: NATURPOTENTIALE_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.6,
      pane: 'naturpotentialeWms',
      attribution: 'Danmarks Miljøportal · MARS (SGAV)',
    });
    wms.addTo(map);
    naturpotentialeLayerRef.current = wms;
  }, [showNaturpotentiale, activePillar]);

  // --- Beskyttet natur: Natura 2000 (habitatområder) local GeoJSON overlay ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (natura2000LayerRef.current) {
      map.removeLayer(natura2000LayerRef.current);
      natura2000LayerRef.current = null;
    }

    if (!showNatura2000 || activePillar !== 'nature' || !natura2000Geo) return;

    if (!map.getPane('natura2000Geo')) {
      const pane = map.createPane('natura2000Geo');
      pane.style.zIndex = '255';
    }

    const layer = L.geoJSON(natura2000Geo, {
      pane: 'natura2000Geo',
      style: {
        fillColor: '#1d4ed8',
        fillOpacity: 0.35,
        color: '#1d4ed8',
        weight: 0.5,
        opacity: 0.7,
      },
    });
    layer.addTo(map);
    natura2000LayerRef.current = layer;
  }, [showNatura2000, activePillar, natura2000Geo]);

  // --- Beskyttet natur: §3 (simplified national GeoJSON) ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (section3LayerRef.current) {
      map.removeLayer(section3LayerRef.current);
      section3LayerRef.current = null;
    }

    if (!showSection3 || activePillar !== 'nature' || !section3Geo) return;

    if (!map.getPane('section3Geo')) {
      const pane = map.createPane('section3Geo');
      pane.style.zIndex = '254';
    }

    const layer = L.geoJSON(section3Geo, {
      pane: 'section3Geo',
      style: {
        fillColor: SECTION3_COLOR.stroke,
        fillOpacity: 0.3,
        color: SECTION3_COLOR.stroke,
        weight: 0.5,
        opacity: 0.7,
      },
    });
    layer.addTo(map);
    section3LayerRef.current = layer;
  }, [showSection3, activePillar, section3Geo]);

  // --- Kulstofrige lavbundsjorder WMS overlay (EPSG:25832 via proj4leaflet) ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (kulstofLavbundLayerRef.current) {
      map.removeLayer(kulstofLavbundLayerRef.current);
      kulstofLavbundLayerRef.current = null;
    }

    if (!showKulstof || activePillar !== 'extraction') return;

    if (!map.getPane('kulstofLavbundWms')) {
      const pane = map.createPane('kulstofLavbundWms');
      pane.style.zIndex = '250';
    }

    const wms = L.tileLayer.wms(KULSTOF_LAVBUND_WMS.base, {
      layers: KULSTOF_LAVBUND_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.6,
      pane: 'kulstofLavbundWms',
      crs: CRS_25832,
      attribution: 'Danmarks Miljøportal',
    });
    wms.addTo(map);
    kulstofLavbundLayerRef.current = wms;
  }, [showKulstof, activePillar]);

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
      activePillar === 'afforestation' && showKsfSkov ? ksfSkovProjects :
      activePillar === 'extraction' && showKsfLavbund ? ksfLavbundProjects :
      [];

    if (activeKsfProjects.length === 0) return;

    const ksfGroup = L.layerGroup();
    const maxArea = Math.max(...activeKsfProjects.map((p) => p.areaHa), 1);

    for (const proj of activeKsfProjects) {
      const [lon, lat] = proj.centroid;
      if (!lat || !lon) continue;

      const radius = Math.max(4, Math.min(14, 4 + 10 * Math.sqrt(proj.areaHa / maxArea)));
      const isSkov = proj.projekttyp === 'Skovrejsning';
      const ksfColor = isSkov ? KSF_COLOR_SKOV : KSF_COLOR_LAVBUND;
      const color = ksfColor.stroke;
      const fillColor = ksfColor.stroke;

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
  }, [activePillar, ksfSkovProjects, ksfLavbundProjects, showKsfSkov, showKsfLavbund, handleCircleClick]);

  // --- Tier 1: Naturstyrelsen state afforestation markers (afforestation pillar) ---

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (nstLayerRef.current) {
      map.removeLayer(nstLayerRef.current);
      nstLayerRef.current = null;
    }

    if (activePillar !== 'afforestation' || !showNst || nstProjects.length === 0) return;

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
      const color = NST_COLOR.stroke;
      const fillColor = NST_COLOR.stroke;

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
  }, [activePillar, nstProjects, showNst, handleCircleClick]);

  // --- Legend data ---
  // Nitrogen coastal uses goal-relative coloring; all other combos use
  // relative-to-max. The legend labels must communicate the scale honestly.

  // --- Base map (grundkort) options ---
  // Only offer the geographies that carry meaningful data for this pillar.
  // Pillars without a usable catchment breakdown expose just their default
  // geography; nitrogen exposes both. Every pillar can additionally turn the
  // base map off ("Fra").
  const baseLayerOptions: { value: MapLayer; label: string }[] =
    activePillar === 'nature'
      ? [{ value: 'kommuner', label: 'Kommuner' }]
      : pillarConfig.hasMultipleLayers
      ? [
          { value: 'catchments', label: 'Vandoplande' },
          { value: 'coastal', label: 'Kystvandsoplande' },
        ]
      : [
          {
            value: pillarConfig.defaultLayer,
            label: pillarConfig.defaultLayer === 'coastal' ? 'Kystvandsoplande' : 'Vandoplande',
          },
        ];

  // --- Additive overlay layers (the "Lag" panel) ---
  const layerGroups: LayerGroup[] = (() => {
    // Stub maps (e.g. CO₂) show only a placeholder overlay — no layers apply.
    if (isStub) return [];

    const groups: LayerGroup[] = [];

    // Vandmiljø
    const vandmiljoeRows: LayerRow[] = [];
    if (waterBodiesGeo) {
      vandmiljoeRows.push({
        id: 'kystvande',
        label: 'Kystvande',
        sublabel: 'Hvordan kystvandene klarer sig økologisk — fra god til dårlig tilstand',
        source: 'Miljøstyrelsen (vandplaner)',
        color: '#4a90b8',
        checked: showWaterBodies,
        onChange: setShowWaterBodies,
      });
    }
    if (activePillar === 'nitrogen') {
      vandmiljoeRows.push({
        id: 'markudledning',
        label: 'Markudledning',
        sublabel: 'Hvor meget kvælstof marken bidrager til kystvandene',
        source: 'SEGES · Danmarks Miljøportal',
        color: '#b5832a',
        checked: showMarkudledning,
        onChange: setShowMarkudledning,
      });
      vandmiljoeRows.push({
        id: 'drikkevand',
        label: 'Drikkevandsinteresser',
        sublabel: 'Områder med (særlige) drikkevandsinteresser, OD/OSD (Miljøstyrelsen)',
        source: 'Miljøstyrelsen · Danmarks Miljøportal',
        color: '#2563eb',
        swatchVariant: 'area' as const,
        checked: showDrikkevand,
        onChange: setShowDrikkevand,
      });
    }
    if (vandmiljoeRows.length) groups.push({ title: 'Vandmiljø', rows: vandmiljoeRows });

    if (activePillar === 'extraction') {
      groups.push({
        title: 'Klima / kulstof',
        rows: [
          {
            id: 'kulstof-lavbund',
            label: 'Kulstofrige lavbundsjorder',
            sublabel: 'Organogene jorder 6-12 % / >12 % kulstof (DCA 2024)',
            source: 'DCA 2024 · Danmarks Miljøportal',
            color: '#7c4a1e',
            swatchVariant: 'area' as const,
            checked: showKulstof,
            onChange: setShowKulstof,
          },
        ],
      });
    }

    // Biodiversitet (Arealdata WMS + VNS 2026)
    if (!isStub) {
      const biodivRows: LayerRow[] = BIODIV_WMS_LAYERS.map((b) => ({
        id: `bio-${b.id}`,
        label: b.label,
        sublabel: b.sublabel,
        source: b.source,
        color: b.legendColor,
        swatchVariant: 'area' as const,
        checked: bioActive.includes(b.id as BiodivWmsId),
        onChange: (v: boolean) => setBio(b.id as BiodivWmsId, v),
      }));
      biodivRows.push({
        id: 'vns',
        label: 'Vand, natur & skov 2026',
        sublabel:
          'Arealer udpeget til vådområder, naturgenopretning og skov under statens omlægningsordning',
        source: 'FVM · Markkort 2026',
        color: '#22c55e',
        swatchVariant: 'area' as const,
        checked: vnsOn,
        onChange: (v: boolean) => setVns(v),
      });
      groups.push({ title: 'Biodiversitet', rows: biodivRows });
    }

    // Naturpotentialer (lokale treparters udpegede ny natur) — kun på naturmålet
    if (activePillar === 'nature') {
      groups.push({
        title: 'Trepart-udpegninger',
        rows: [
          {
            id: 'naturpotentialer',
            label: 'Naturpotentialer',
            sublabel: 'Hvor de lokale treparter ser mulighed for at skabe ny natur',
            source: 'MARS · lokale treparter',
            color: '#5b8a72',
            swatchVariant: 'area' as const,
            checked: showNaturpotentiale,
            onChange: setShowNaturpotentiale,
          },
        ],
      });
    }

    // Beskyttet natur i dag (faktisk juridisk beskyttelse) — kun på naturmålet.
    if (activePillar === 'nature') {
      groups.push({
        title: 'Beskyttet natur i dag',
        rows: [
          {
            id: 'section3',
            label: '§3-beskyttet natur',
            sublabel: 'Beskyttede naturtyper under Naturbeskyttelsesloven (>= 50 ha på kortet)',
            source: 'MiljøGIS WFS · lokal forenklet GeoJSON',
            color: SECTION3_COLOR.stroke,
            swatchVariant: 'area' as const,
            checked: showSection3,
            onChange: setShowSection3,
          },
          {
            id: 'natura2000',
            label: 'Natura 2000 (habitatområder)',
            sublabel: 'EU-udpegede habitatområder',
            source: 'MiljøGIS WFS · lokal forenklet GeoJSON',
            color: '#1d4ed8',
            swatchVariant: 'area' as const,
            checked: showNatura2000,
            onChange: setShowNatura2000,
          },
        ],
      });
    }

    return groups;
  })();

  const isGoalRelative = layer === 'coastal' && (activePillar === 'nitrogen' || activePillar === 'extraction');
  const grundkortLegendItems = (() => {
    if (!pillarConfig.hasData) return [];
    return [
      { color: getProgressColor(80), label: isGoalRelative ? 'Tæt på mål' : 'Højest' },
      { color: getProgressColor(50), label: isGoalRelative ? 'Midtvejs' : 'Middel' },
      { color: getProgressColor(10), label: isGoalRelative ? 'Langt fra mål' : 'Lavest' },
      { color: '#c8c4bb', label: 'Ingen data' },
    ];
  })();

  const b4LegendItems = showNatureKommuneBase
    ? [
        { color: B4_COLOR_STOPS[3], label: 'Høj andel med §3-/N2000-status' },
        { color: B4_COLOR_STOPS[2], label: 'Middel' },
        { color: B4_COLOR_STOPS[0], label: 'Lav' },
        { color: B4_NO_DATA_COLOR, label: 'Ingen kortlagt naturværdi' },
      ]
    : [];

  // Label for the choropleth scale (varies by pillar and coloring mode).
  const grundkortLegendLabel = (() => {
    if (isGoalRelative) {
      const goalLabels: Record<string, string> = {
        nitrogen: 'Kvælstof — anlagt og i pipeline i % af mål',
        extraction: 'Lavbundsudtag — anlagt og i pipeline i % af potentiale',
      };
      return goalLabels[activePillar] ?? `${pillarConfig.label} — fremskridt mod mål`;
    }
    const metricLabels: Record<string, string> = {
      nitrogen: 'Kvælstof — anlagt og i pipeline (ton)',
      extraction: 'Lavbundsudtag — anlagt og i pipeline (ha)',
      afforestation: 'Skovrejsning — anlagt og i pipeline (ha)',
      nature: 'Naturpotentiale (ha)',
    };
    return metricLabels[activePillar] ?? pillarConfig.label;
  })();

  const b4LegendLabel = 'Andel af kortlagt naturværdi (DCE 30 %) med §3-/Natura 2000-status';

  // Tier 1 supplement markers (KSF/NST) + MARS phase dots in the floating legend.
  const projectLegend: { key: string; color: string; label: string }[] = [];
  if (mapProjectsWithGeometry.length > 0) {
    for (const phase of PHASE_CONFIGS) {
      if (!activePhases.has(phase.id)) continue;
      if (!mapProjectsWithGeometry.some((p) => p.phase === phase.id)) continue;
      projectLegend.push({ key: `mars-${phase.id}`, color: phase.hex, label: `MARS — ${phase.label}` });
    }
  }
  if (activePillar === 'afforestation' && showKsfSkov && ksfSkovProjects.length > 0) {
    projectLegend.push({ key: 'ksf-skov', color: KSF_COLOR_SKOV.stroke, label: 'Klimaskovfonden (skov)' });
  }
  if (activePillar === 'afforestation' && showNst && nstProjects.filter((p) => p.centroid).length > 0) {
    projectLegend.push({ key: 'nst', color: NST_COLOR.stroke, label: 'Naturstyrelsen' });
  }
  if (activePillar === 'extraction' && showKsfLavbund && ksfLavbundProjects.length > 0) {
    projectLegend.push({ key: 'ksf-lavbund', color: KSF_COLOR_LAVBUND.stroke, label: 'Klimaskovfonden (lavbund)' });
  }

  // Active biodiversity WMS overlays, for the legend.
  const biodivLegend = BIODIV_WMS_LAYERS.filter((b) => bioActive.includes(b.id as BiodivWmsId));

  const showScaleLegend = baseVisible && grundkortLegendItems.length > 0;
  const showB4Legend = b4LegendItems.length > 0;
  const showKystvandeLegend = showWaterBodies && !!waterBodiesGeo;
  const showMarkudledningLegend = showMarkudledning && activePillar === 'nitrogen';
  const showDrikkevandLegend = showDrikkevand && activePillar === 'nitrogen';
  const showKulstofLegend = showKulstof && activePillar === 'extraction';
  const showBeskyttetNaturLegend =
    activePillar === 'nature' && (showNatura2000 || showSection3);
  const hasAnyLegend =
    showScaleLegend ||
    showB4Legend ||
    projectLegend.length > 0 ||
    showKystvandeLegend ||
    biodivLegend.length > 0 ||
    vnsOn ||
    showMarkudledningLegend ||
    showDrikkevandLegend ||
    showKulstofLegend ||
    showBeskyttetNaturLegend;

  const handleMapResize = useCallback(() => {
    leafletMap?.invalidateSize();
  }, [leafletMap]);

  const mapControls = (
    <>
      {!isStub && (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Grundkort</span>
              <div className="flex bg-card border border-border rounded-lg p-0.5 shadow-sm flex-wrap">
                {baseLayerOptions.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setBaseLayer(opt.value)}
                    className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                      baseVisible && layer === opt.value
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  onClick={() => setBaseLayer('off')}
                  aria-pressed={!baseVisible}
                  className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                    !baseVisible
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Fra
                </button>
              </div>
              <InfoTooltip
                title="Grundkort"
                content={
                  <>
                    <p>Grundkortet er den farvelagte baggrund (tier 2). Projekterne ligger altid ovenpå. Slå baggrunden fra med <strong>Fra</strong> for kun at se projekter og valgte lag.</p>
                    {activePillar === 'nature' ? (
                      <p><strong>Kommuner</strong> farves efter andel kortlagt naturværdi med §3-/Natura 2000-status (B4). Naturmålet har ingen vandgeografi, så kommuner er den meningsfulde baggrund — ikke vandoplande.</p>
                    ) : (
                      <p><strong>Vandoplande</strong> = 23 hovedvandoplande. <strong>Kystvandsoplande</strong> = 37 kystvandoplande med lokale planer.</p>
                    )}
                  </>
                }
                source="Geodata fra Miljøstyrelsens WFS (miljoegis.mim.dk)"
                methodLink="#datakilder"
                side="bottom"
                size={13}
              />
          </div>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="text-xs font-medium text-muted-foreground hidden sm:inline shrink-0">Projekter</span>
            <PhaseFilter selected={activePhases} onChange={setActivePhases} />
            {activePillar === 'extraction' && ksfLavbundProjects.length > 0 && (() => {
              const ksfDef = getSupplementPresentation('ksf', 'extraction');
              return (
                <button
                  type="button"
                  onClick={() => setShowKsfLavbund((v) => !v)}
                  aria-pressed={showKsfLavbund}
                  title={ksfDef.description}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                    'transition-all duration-150 select-none cursor-pointer',
                    showKsfLavbund
                      ? ksfDef.color.activeClass
                      : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50',
                  ].join(' ')}
                >
                  {showKsfLavbund ? (
                    <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
                  )}
                  {ksfDef.label}
                </button>
              );
            })()}
            {activePillar === 'afforestation' && ksfSkovProjects.length > 0 && (() => {
              const ksfDef = getSupplementPresentation('ksf', 'afforestation');
              return (
                <button
                  type="button"
                  onClick={() => setShowKsfSkov((v) => !v)}
                  aria-pressed={showKsfSkov}
                  title={ksfDef.description}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                    'transition-all duration-150 select-none cursor-pointer',
                    showKsfSkov
                      ? ksfDef.color.activeClass
                      : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50',
                  ].join(' ')}
                >
                  {showKsfSkov ? (
                    <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
                  )}
                  {ksfDef.label}
                </button>
              );
            })()}
            {activePillar === 'afforestation' && nstProjects.filter((p) => p.centroid).length > 0 && (() => {
              const nstDef = getSupplementPresentation('nst', 'afforestation');
              return (
                <button
                  type="button"
                  onClick={() => setShowNst((v) => !v)}
                  aria-pressed={showNst}
                  title={nstDef.description}
                  className={[
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                    'transition-all duration-150 select-none cursor-pointer',
                    showNst
                      ? nstDef.color.activeClass
                      : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50',
                  ].join(' ')}
                >
                  {showNst ? (
                    <Check className="w-3 h-3 flex-shrink-0" strokeWidth={3} />
                  ) : (
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-muted-foreground/40" />
                  )}
                  {nstDef.label}
                </button>
              );
            })()}
          </div>
        </div>
      )}
    </>
  );

  const hasLayerControls = layerGroups.some((group) => group.rows.length > 0);
  const mapOverlayControls = hasLayerControls ? <MapLayersPanel groups={layerGroups} /> : null;

  const detailSidePanel = panelOpen ? (
    <>
      {(selectedPlan || selectedCatchment) && (
        <div className="hidden md:block w-full max-h-[580px] overflow-y-auto md:max-h-full">
          <DetailPanel plan={selectedPlan} catchment={selectedCatchment} nationalData={data.national} onClose={closePanel} />
        </div>
      )}
      {selectedCoastalWater && (
        <div className="hidden md:block w-full max-h-[580px] overflow-y-auto md:max-h-full">
          <CoastalWaterDetailPanel name={selectedCoastalWater.name} entry={selectedCoastalWater.entry} onClose={closePanel} />
        </div>
      )}
      {selectedProject && (
        <div className="hidden md:block w-full max-h-[580px] overflow-y-auto md:max-h-full">
          <ProjectDetailPanel
            project={selectedProject}
            featureName={selectedProject.featureName}
            coordinates={selectedProjectCoordinates}
            schemes={data.subsidySchemes}
            natureOverlap={selectedMarsNatureOverlap}
            showNatureOverlap={activePillar === 'nature'}
            onClose={closePanel}
          />
        </div>
      )}
    </>
  ) : null;

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

      <div className="mb-5">
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
      </div>

      {/* Headless renderer for the biodiversity WMS/VNS overlays (no UI). */}
      {!isStub && mapReady && leafletMap && (
        <>
          <BiodivLayers map={leafletMap} isStub={isStub} bioActive={bioActive} vnsOn={vnsOn} />
          <MapProjectLayer
            map={leafletMap}
            enabled={!isStub}
            projects={mapProjects}
            geometries={projectGeometries}
            natureOverlap={natureOverlap}
            activePillar={activePillar}
            onProjectClick={handleMarsProjectClick}
          />
        </>
      )}

      <MapFullscreenShell
        fullscreenTitle="Kort over Danmark"
        fullscreenTitleAddon={
          <span
            className="text-xs font-medium rounded-full px-2.5 py-0.5 border shrink-0"
            style={{ color: pillarConfig.accentColor, borderColor: pillarConfig.accentColor + '40', backgroundColor: pillarConfig.accentColor + '10' }}
          >
            {pillarConfig.label}
          </span>
        }
        controls={mapControls}
        mapOverlayControls={mapOverlayControls}
        hint={mapLayerHints ? (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {mapLayerHints}
          </p>
        ) : undefined}
        sidePanel={detailSidePanel}
        onResize={handleMapResize}
        expandDisabled={isStub}
        inlineMapHeight="580px"
      >
        {() => (
          <>
          <div
            ref={mapContainerRef}
            className="absolute inset-0 z-0 rounded-2xl overflow-hidden border border-border shadow-md"
          />

          {/* Floating colour legend — overlays the map (bottom-left) so toggling
              layers on/off never reflows the page. Only shows active layers. */}
          {!isStub && hasAnyLegend && (
            <div className={`absolute bottom-3 left-3 z-[500] max-w-[15rem] sm:max-w-[17rem] pointer-events-none ${panelOpen && selectedProject ? 'max-md:hidden' : ''}`}>
              <div className="pointer-events-auto rounded-lg bg-background/90 backdrop-blur-sm border border-border shadow-md px-3 py-2 text-[10px] leading-tight text-muted-foreground max-h-[300px] overflow-y-auto space-y-1.5 [&>*+*]:border-t [&>*+*]:border-border/40 [&>*+*]:pt-1.5">
                {showScaleLegend && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="font-semibold text-foreground/80">{grundkortLegendLabel}</span>
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
                        methodLink="#metode"
                        size={11}
                        side="top"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {grundkortLegendItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: item.color }} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {showB4Legend && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">{b4LegendLabel}</div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {b4LegendItems.map((item) => (
                        <div key={item.label} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: item.color }} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {projectLegend.length > 0 && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Projekter</div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {projectLegend.map((item) => (
                        <div key={item.key} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          <span>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {showKystvandeLegend && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Kystvande — økologisk tilstand</div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      {['God', 'Moderat', 'Ringe', 'Dårlig'].map((status) => (
                        <div key={status} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full border border-border" style={{ backgroundColor: getWfdStatusColor(status) }} />
                          <span>{status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(biodivLegend.length > 0 || vnsOn) && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Biodiversitet & natur</div>
                    <div className="space-y-1">
                      {biodivLegend.map((b) => (
                        <div key={b.id} className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
                            style={{ backgroundColor: b.legendColor }}
                          />
                          <span>{b.label}</span>
                        </div>
                      ))}
                      {vnsOn && (
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-green-700/40" style={{ backgroundColor: '#22c55e' }} />
                          <span>Vand, natur &amp; skov 2026</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {showMarkudledningLegend && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Markudledning — potentiel N-udledning</div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-12 rounded-sm border border-border" style={{ background: 'linear-gradient(to right, #efe3c8, #b5832a, #7a5512)' }} />
                      <span>Lav → høj</span>
                    </div>
                  </div>
                )}
                {showDrikkevandLegend && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Drikkevandsinteresser</div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-sm border border-border" style={{ backgroundColor: '#2563eb' }} />
                      <span>OD/OSD-områder (Miljøstyrelsen)</span>
                    </div>
                  </div>
                )}
                {showKulstofLegend && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Kulstofrige lavbundsjorder</div>
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-12 rounded-sm border border-border" style={{ background: 'linear-gradient(to right, #c4a574, #7c4a1e, #4a2a0e)' }} />
                      <span>6–12 % → &gt;12 % kulstof</span>
                    </div>
                  </div>
                )}
                {showBeskyttetNaturLegend && (
                  <div>
                    <div className="font-semibold text-foreground/80 mb-1">Beskyttet natur</div>
                    <div className="space-y-1">
                      {showSection3 && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
                            style={{ backgroundColor: SECTION3_COLOR.stroke, opacity: 0.7 }}
                          />
                          <span>§3-beskyttet natur</span>
                        </div>
                      )}
                      {showNatura2000 && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/10"
                            style={{ backgroundColor: '#1d4ed8', opacity: 0.7 }}
                          />
                          <span>Natura 2000</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[9px] text-muted-foreground/90 leading-snug mt-1.5">
                      {NATURE_OVERLAP_CAVEAT}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {isStub && pillarConfig.stubMessage && (
            <StubMapOverlay message={pillarConfig.stubMessage} />
          )}
          {mapHint.visible && !isStub && mapReady && (
            <div
              className="absolute inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            >
              <button
                type="button"
                onClick={mapHint.dismiss}
                className="pointer-events-auto flex items-center gap-2 rounded-full bg-background/80 backdrop-blur-sm border border-border px-4 py-2 shadow-lg transition-opacity hover:bg-background/95"
              >
                <MousePointerClick className="w-4 h-4 text-primary" strokeWidth={1.8} />
                <span className="text-xs font-medium text-foreground/80">
                  Klik på et område for at udforske detaljerne
                </span>
              </button>
            </div>
          )}
          </>
        )}
      </MapFullscreenShell>

      {panelOpen && (selectedPlan || selectedCatchment || selectedCoastalWater || selectedProject) && (
        <MobileBottomSheet onClose={closePanel}>
          {(selectedPlan || selectedCatchment) && (
            <DetailPanel plan={selectedPlan} catchment={selectedCatchment} nationalData={data.national} onClose={closePanel} />
          )}
          {selectedCoastalWater && (
            <CoastalWaterDetailPanel name={selectedCoastalWater.name} entry={selectedCoastalWater.entry} onClose={closePanel} />
          )}
          {selectedProject && (
            <ProjectDetailPanel
              project={selectedProject}
              featureName={selectedProject.featureName}
              coordinates={selectedProjectCoordinates}
              schemes={data.subsidySchemes}
              natureOverlap={selectedMarsNatureOverlap}
              showNatureOverlap={activePillar === 'nature'}
              onClose={closePanel}
            />
          )}
        </MobileBottomSheet>
      )}
    </section>
  );
}

