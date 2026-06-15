import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type L from 'leaflet';
import type { FeatureCollection, Geometry } from 'geojson';
import { MapPin } from 'lucide-react';
import { MapFullscreenShell } from '@/components/MapFullscreenShell';
import { MapLayersPanel } from '@/components/MapLayersPanel';
import { KommuneMapOverlayLayers } from '@/components/kommune-map/KommuneMapOverlayLayers';
import { ProjectDetailPanel } from '@/components/ProjectDetailPanel';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { InfoTooltip } from '@/components/InfoTooltip';
import { KommuneMapViewControlsBar } from '@/components/KommuneMapViewControlsBar';
import {
  KommuneFordelingDisclaimer,
  KommuneNatureLayerDisclaimer,
} from '@/components/KommuneMapControls';
import type { KommuneBenchmarkData, KommuneMetrics, KommuneRankingData, NationalFordelingSimulation, DashboardData, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import type { KommuneMetric, KommunePhase, SupplementSource } from '@/lib/kommune-metrics';
import { getPillarConfig } from '@/lib/pillars';
import type { SelectedProject } from '@/lib/project-selection';
import { findMarsProjectByGeoId } from '@/lib/map-projects';
import {
  buildMapLagLayerGroups,
  patchKommuneMapOverlay,
  kommuneMetricToLagPillar,
  isKommuneMapStubMetric,
  type KommuneMapOverlayToken,
} from '@/lib/kommune-map-overlays';
import { loadProjectGeometries, loadProjectNatureOverlap, loadWaterBodiesGeoJSON } from '@/lib/data';
import { useMarsProjectUrl } from '@/lib/mars-project-url';
import type { ProjectNatureOverlapData } from '@/lib/types';
import type { ChoroplethScaleMode, FordelingViewMode, LegendStop, NatureLayerKey } from '@/lib/kommune-map-visualization';
import {
  getKommuneMapLegendLabel,
  getKommuneMapLegendStops,
  showFordelingViewToggle,
  showNatureLayerToggle,
  usesSimulationChoropleth,
} from '@/lib/kommune-map-visualization';

const KommuneMap = lazy(() =>
  import('@/components/KommuneMap').then((m) => ({ default: m.KommuneMap })),
);

interface KommuneMapSectionProps {
  activeMetric: KommuneMetric | null;
  kommunerGeo: FeatureCollection<Geometry> | null;
  kommunerFiltered: KommuneMetrics[];
  loadError: string | null;
  fordelingSimulation: NationalFordelingSimulation | null;
  kommuneBenchmark: KommuneBenchmarkData | null;
  fordelingViewMode: FordelingViewMode;
  onFordelingViewModeChange: (mode: FordelingViewMode) => void;
  choroplethScale: ChoroplethScaleMode;
  onChoroplethScaleChange: (mode: ChoroplethScaleMode) => void;
  kommuneRanking: KommuneRankingData | null;
  ansvarIndexByKode: Record<string, number | null>;
  natureLayer: NatureLayerKey;
  onNatureLayerChange: (layer: NatureLayerKey) => void;
  onSelect: (kode: string) => void;
  /** Tier 1: MARS project overlay. */
  dashboard?: DashboardData | null;
  selectedPhases?: Set<KommunePhase>;
  activeSupplements?: Set<SupplementSource>;
  mapOverlays: Set<KommuneMapOverlayToken>;
  onMapOverlaysChange: (overlays: Set<KommuneMapOverlayToken>) => void;
  ksfProjects?: KlimaskovfondenProject[];
  nstProjects?: NaturstyrelsenSkovProject[];
  /** Detail page: mirror list-page view without map toggles. */
  readOnly?: boolean;
  /** Short caption of active view (detail page). */
  contextCaption?: string;
  focusKode?: string | null;
  selectedKode?: string | null;
  /** When set, deep-linked MARS projects outside this set are ignored. */
  allowedMarsGeoIds?: ReadonlySet<string>;
  inlineMapHeight?: string;
  /** Dropdown + Kortvisning popover instead of inline grundkort / tilvalg rows. */
  compactMapControls?: boolean;
  /** Metric picker row — fasefilter and kilder live on the map-controls row below. */
  filterControls?: ReactNode;
  /** Show collapsed fasefilter on the map-controls row. */
  showPhaseFilter?: boolean;
  onPhasesChange?: (phases: Set<KommunePhase>) => void;
  phaseFilterTooltip?: string;
  supplementSources?: SupplementSource[];
  onSupplementsChange?: (next: Set<SupplementSource>) => void;
}

/**
 * Kommune choropleth with the same map shell and floating legend as DenmarkMap —
 * MapFullscreenShell and Grundkort toggles for nature layers / distribution views.
 */
export function KommuneMapSection({
  activeMetric,
  kommunerGeo,
  kommunerFiltered,
  loadError,
  fordelingSimulation,
  kommuneBenchmark,
  fordelingViewMode,
  onFordelingViewModeChange,
  choroplethScale,
  onChoroplethScaleChange,
  kommuneRanking,
  ansvarIndexByKode,
  natureLayer,
  onNatureLayerChange,
  onSelect,
  dashboard = null,
  selectedPhases = new Set(['established']),
  activeSupplements = new Set(),
  mapOverlays,
  onMapOverlaysChange,
  ksfProjects = [],
  nstProjects = [],
  readOnly = false,
  contextCaption,
  focusKode = null,
  selectedKode = null,
  allowedMarsGeoIds,
  inlineMapHeight = '580px',
  compactMapControls = false,
  filterControls,
  showPhaseFilter = false,
  onPhasesChange,
  phaseFilterTooltip,
  supplementSources,
  onSupplementsChange,
}: KommuneMapSectionProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [leafletMap, setLeafletMap] = useState<L.Map | null>(null);
  const [hasWaterBodiesGeo, setHasWaterBodiesGeo] = useState(false);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | undefined>();
  const [projectCoordinates, setProjectCoordinates] = useState<[number, number][] | undefined>();
  const [natureOverlap, setNatureOverlap] = useState<ProjectNatureOverlapData | null>(null);
  const { projectOpen, openProject, closeMarsProject } = useMarsProjectUrl();

  useEffect(() => {
    let cancelled = false;
    loadWaterBodiesGeoJSON().then((geo) => {
      if (!cancelled) setHasWaterBodiesGeo(!!geo);
    });
    return () => { cancelled = true; };
  }, []);

  const handleOverlayToggle = useCallback(
    (token: KommuneMapOverlayToken, on: boolean) => {
      onMapOverlaysChange(patchKommuneMapOverlay(mapOverlays, token, on));
    },
    [mapOverlays, onMapOverlaysChange],
  );

  const layerGroups = useMemo(
    () => buildMapLagLayerGroups({
      pillarId: activeMetric ? kommuneMetricToLagPillar(activeMetric) : null,
      isStub: isKommuneMapStubMetric(activeMetric),
      hasWaterBodiesGeo,
      overlays: mapOverlays,
      onToggle: handleOverlayToggle,
    }),
    [activeMetric, hasWaterBodiesGeo, mapOverlays, handleOverlayToggle],
  );

  const mapOverlayControls = !readOnly && activeMetric && layerGroups.length > 0
    ? <MapLayersPanel groups={layerGroups} />
    : null;

  const handleProjectClick = useCallback((geoId: string) => {
    if (!dashboard) return;
    const found = findMarsProjectByGeoId(dashboard, geoId);
    if (!found) return;
    setSelectedProject({ source: 'mars', ...found });
    openProject('mars', geoId);
    if (activeMetric === 'nature' && !natureOverlap) {
      loadProjectNatureOverlap().then(setNatureOverlap);
    }
  }, [dashboard, openProject, activeMetric, natureOverlap]);

  const handleSupplementClick = useCallback((selection: SelectedProject) => {
    setSelectedProject(selection);
    if (selection.source === 'klimaskovfonden') {
      openProject('ksf', selection.project.sagsnummer);
    } else if (selection.source === 'naturstyrelsen') {
      openProject('nst', selection.project.name);
    }
  }, [openProject]);

  const closeProjectPanel = useCallback(() => {
    setSelectedProject(undefined);
    closeMarsProject();
  }, [closeMarsProject]);

  useEffect(() => {
    if (!projectOpen) {
      setSelectedProject(undefined);
      return;
    }
    if (projectOpen.source === 'mars') {
      if (!dashboard) return;
      if (allowedMarsGeoIds && !allowedMarsGeoIds.has(projectOpen.id)) {
        closeMarsProject();
        setSelectedProject(undefined);
        return;
      }
      const found = findMarsProjectByGeoId(dashboard, projectOpen.id);
      if (found) setSelectedProject({ source: 'mars', ...found });
      else closeMarsProject();
      return;
    }
    if (projectOpen.source === 'ksf') {
      const proj = ksfProjects.find((p) => p.sagsnummer === projectOpen.id);
      if (proj) setSelectedProject({ source: 'klimaskovfonden', project: proj });
      else closeMarsProject();
      return;
    }
    if (projectOpen.source === 'nst') {
      const proj = nstProjects.find((p) => p.name === projectOpen.id);
      if (proj) setSelectedProject({ source: 'naturstyrelsen', project: proj });
      else closeMarsProject();
    }
  }, [projectOpen, dashboard, allowedMarsGeoIds, closeMarsProject, ksfProjects, nstProjects]);

  useEffect(() => {
    if (!selectedProject || selectedProject.source !== 'mars') {
      setProjectCoordinates(undefined);
      return;
    }
    let cancelled = false;
    loadProjectGeometries().then((geometries) => {
      if (cancelled) return;
      setProjectCoordinates(geometries[selectedProject.project.geoId]);
    });
    return () => { cancelled = true; };
  }, [selectedProject]);

  const visualContext = useMemo(
    () => ({
      activeMetric: activeMetric ?? 'nitrogen',
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

  const legendStops: LegendStop[] = activeMetric
    ? getKommuneMapLegendStops(visualContext)
    : [];
  const legendLabel = activeMetric ? getKommuneMapLegendLabel(visualContext) : '';

  const showGrundkort =
    activeMetric !== null
    && (
      (showNatureLayerToggle(activeMetric) && !!kommuneBenchmark)
      || (showFordelingViewToggle(activeMetric) && !!fordelingSimulation)
    );

  const handleMapReady = useCallback((map: L.Map) => {
    mapRef.current = map;
    setLeafletMap(map);
  }, []);

  const handleMapResize = useCallback(() => {
    mapRef.current?.invalidateSize();
  }, []);

  const pillarConfig = activeMetric ? getPillarConfig(activeMetric) : null;

  const mapControls = !readOnly && activeMetric ? (
    <KommuneMapViewControlsBar
      activeMetric={activeMetric}
      showGrundkort={showGrundkort}
      natureLayer={natureLayer}
      onNatureLayerChange={onNatureLayerChange}
      fordelingViewMode={fordelingViewMode}
      onFordelingViewModeChange={onFordelingViewModeChange}
      choroplethScale={choroplethScale}
      onChoroplethScaleChange={onChoroplethScaleChange}
      showPhaseFilter={showPhaseFilter}
      selectedPhases={selectedPhases}
      onPhasesChange={onPhasesChange}
      phaseFilterTooltip={phaseFilterTooltip}
      supplementSources={supplementSources}
      activeSupplements={activeSupplements}
      onSupplementsChange={onSupplementsChange}
      compact={compactMapControls}
    />
  ) : null;

  const shellControls = (filterControls || mapControls) ? (
    <div className="w-full">
      <div
        className={[
          'flex items-start gap-2 w-full',
          !compactMapControls && 'md:flex-col md:gap-3',
        ].filter(Boolean).join(' ')}
      >
        {filterControls && (
          <div
            className={[
              'flex-1 min-w-0 space-y-2',
              !compactMapControls && 'md:flex-none md:w-full',
            ].filter(Boolean).join(' ')}
          >
            {filterControls}
          </div>
        )}
        {mapControls && (
          <div className="shrink-0 flex items-center gap-2">
            {mapControls}
          </div>
        )}
      </div>
    </div>
  ) : null;

  const mapBanners = !readOnly && activeMetric ? (
    <>
      {showFordelingViewToggle(activeMetric) && fordelingViewMode !== 'actual' && (
        <KommuneFordelingDisclaimer />
      )}
      {showNatureLayerToggle(activeMetric) && kommuneBenchmark && (
        <KommuneNatureLayerDisclaimer layer={natureLayer} />
      )}
    </>
  ) : null;

  if (loadError) {
    return (
      <div
        className="rounded-2xl border border-border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground p-10 text-center"
        style={{ height: inlineMapHeight }}
      >
        <div>
          <MapPin className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="font-medium mb-1">Kortdata ikke klar</p>
          <p className="text-xs opacity-70">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!kommunerGeo) {
    return (
      <div
        className="rounded-2xl border border-border bg-muted/10 flex items-center justify-center"
        style={{ height: inlineMapHeight }}
      >
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
    <MapFullscreenShell
      fullscreenTitle="Kommune-kort"
      fullscreenTitleAddon={
        pillarConfig ? (
          <span
            className="text-xs font-medium rounded-full px-2.5 py-0.5 border shrink-0"
            style={{
              color: pillarConfig.accentColor,
              borderColor: pillarConfig.accentColor + '40',
              backgroundColor: pillarConfig.accentColor + '10',
            }}
          >
            {pillarConfig.label}
          </span>
        ) : undefined
      }
      controls={shellControls}
      hint={
        readOnly && contextCaption ? (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {contextCaption}. Skift visning på{' '}
            <span className="font-medium text-foreground/80">Alle kommuner</span>.
          </p>
        ) : activeMetric ? (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {focusKode
              ? 'Klik en anden kommune for at skifte. MARS-projekter følger fasefilteret; KSF/NST vises på kortet når du slår dem til under tilvalg. Brug Lag-knappen for baggrundskort som på det nationale kort (kystvande, markudledning, §3 m.fl.).'
              : 'Klik på en kommune for at åbne detaljesiden. Projektfaser og tilvalg styrer både farvelægning og projekter på kortet. Lag-knappen tilføjer valgfrie baggrundskort — samme som på det nationale kort.'}
          </p>
        ) : undefined
      }
      banners={mapBanners}
      onResize={handleMapResize}
      expandDisabled={activeMetric === null}
      inlineMapHeight={inlineMapHeight}
      mapOverlayControls={mapOverlayControls}
      sidePanel={selectedProject ? (
        <div className="hidden md:block w-full max-h-[580px] overflow-y-auto md:max-h-full">
          <ProjectDetailPanel
            project={selectedProject}
            coordinates={projectCoordinates}
            schemes={dashboard?.subsidySchemes}
            natureOverlap={
              selectedProject.source === 'mars' && natureOverlap
                ? natureOverlap.byProject[selectedProject.project.geoId] ?? null
                : undefined
            }
            showNatureOverlap={activeMetric === 'nature'}
            onClose={closeProjectPanel}
          />
        </div>
      ) : undefined}
    >
      {() => (
        <>
          {activeMetric === null && (
            <div className="absolute inset-0 z-20 rounded-2xl bg-background/80 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
              <div className="text-center space-y-2 px-4">
                <MapPin className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">Vælg et indsatsområde ovenfor</p>
                <p className="text-xs text-muted-foreground/70">
                  Kortet viser data, når du vælger kvælstof, lavbund, skovrejsning m.fl.
                </p>
              </div>
            </div>
          )}

          <Suspense
            fallback={
              <div className="absolute inset-0 rounded-2xl border border-border bg-muted/10 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            }
          >
            <KommuneMap
              kommunerGeo={kommunerGeo}
              metrics={kommunerFiltered}
              activeMetric={activeMetric ?? 'nitrogen'}
              fordelingSimulation={fordelingSimulation}
              kommuneBenchmark={kommuneBenchmark}
              fordelingViewMode={fordelingViewMode}
              natureLayer={natureLayer}
              choroplethScale={choroplethScale}
              kommuneRanking={kommuneRanking}
              ansvarIndexByKode={ansvarIndexByKode}
              focusKode={focusKode}
              selectedKode={selectedKode}
              onSelect={readOnly ? () => {} : onSelect}
              dashboard={dashboard}
              selectedPhases={selectedPhases}
              onProjectClick={handleProjectClick}
              fillContainer
              onMapReady={handleMapReady}
            />
            {activeMetric && (
              <KommuneMapOverlayLayers
                map={leafletMap}
                activeMetric={activeMetric}
                mapOverlays={mapOverlays}
                activeSupplements={activeSupplements}
                ksfProjects={ksfProjects}
                nstProjects={nstProjects}
                onSupplementClick={handleSupplementClick}
              />
            )}
          </Suspense>

          {activeMetric && legendStops.length > 0 && (
            <div className="absolute bottom-3 left-3 z-[500] max-w-[15rem] sm:max-w-[17rem] pointer-events-none">
              <div className="pointer-events-auto rounded-lg bg-background/90 backdrop-blur-sm border border-border shadow-md px-3 py-2 text-[10px] leading-tight text-muted-foreground max-h-[300px] overflow-y-auto">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <span className="font-semibold text-foreground/80">{legendLabel}</span>
                    <InfoTooltip
                      title="Farveindeks"
                      content={
                        usesSimulationChoropleth(activeMetric, fordelingViewMode) ? (
                          <p>
                            Farverne viser simuleret fordeling af skov- eller lavbundsmålet efter
                            dokumenteret naturpotentiale — ikke officielle kommune-tal.
                          </p>
                        ) : choroplethScale === 'ansvar' ? (
                          <p>
                            Farverne viser levering ift. ansvar (×). 1,0× betyder at kommunen leverer
                            proportionalt med sit naturpotentiale. Det mørkeste område har højest index —
                            ikke nødvendigvis flest hektar.
                          </p>
                        ) : (
                          <p>
                            Det mørkeste område har den højeste værdi for den valgte metrik, og alle
                            andre skaleres i forhold. Det er ikke en målstreg — det viser hvilke
                            kommuner der har mest aktivitet eller størst benchmark-værdi.
                          </p>
                        )
                      }
                      size={11}
                      side="top"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {legendStops.map((item) => (
                      <div key={item.label} className="flex items-center gap-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full border border-border"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </MapFullscreenShell>

    {selectedProject && (
      <MobileBottomSheet onClose={closeProjectPanel}>
        <ProjectDetailPanel
          project={selectedProject}
          coordinates={projectCoordinates}
          schemes={dashboard?.subsidySchemes}
          natureOverlap={
            selectedProject.source === 'mars' && natureOverlap
              ? natureOverlap.byProject[selectedProject.project.geoId] ?? null
              : undefined
          }
          showNatureOverlap={activeMetric === 'nature'}
          onClose={closeProjectPanel}
        />
      </MobileBottomSheet>
    )}
    </>
  );
}
