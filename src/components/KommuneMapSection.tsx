import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import type { FeatureCollection, Geometry } from 'geojson';
import { MapPin } from 'lucide-react';
import { MapFullscreenShell } from '@/components/MapFullscreenShell';
import { ProjectDetailPanel } from '@/components/ProjectDetailPanel';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { InfoTooltip } from '@/components/InfoTooltip';
import {
  KommuneFordelingDisclaimer,
  KommuneNatureLayerDisclaimer,
} from '@/components/KommuneMapControls';
import type { KommuneBenchmarkData, KommuneMetrics, KommuneRankingData, NationalFordelingSimulation, DashboardData } from '@/lib/types';
import type { KommuneMetric, KommunePhase } from '@/lib/kommune-metrics';
import { getPillarConfig } from '@/lib/pillars';
import type { SelectedProject } from '@/lib/project-selection';
import { findMarsProjectByGeoId } from '@/lib/map-projects';
import { loadProjectGeometries, loadProjectNatureOverlap } from '@/lib/data';
import { useMarsProjectUrl } from '@/lib/mars-project-url';
import type { ProjectNatureOverlapData } from '@/lib/types';
import type { ChoroplethScaleMode, FordelingViewMode, LegendStop, NatureLayerKey } from '@/lib/kommune-map-visualization';
import {
  getKommuneMapLegendLabel,
  getKommuneMapLegendStops,
  NATURE_LAYER_OPTIONS,
  showChoroplethScaleToggle,
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
  showProjectLayer?: boolean;
  /** Detail page: mirror list-page view without map toggles. */
  readOnly?: boolean;
  /** Short caption of active view (detail page). */
  contextCaption?: string;
  focusKode?: string | null;
  selectedKode?: string | null;
  inlineMapHeight?: string;
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
  showProjectLayer = true,
  readOnly = false,
  contextCaption,
  focusKode = null,
  selectedKode = null,
  inlineMapHeight = '580px',
}: KommuneMapSectionProps) {
  const mapRef = useRef<L.Map | null>(null);
  const [selectedProject, setSelectedProject] = useState<SelectedProject | undefined>();
  const [projectCoordinates, setProjectCoordinates] = useState<[number, number][] | undefined>();
  const [natureOverlap, setNatureOverlap] = useState<ProjectNatureOverlapData | null>(null);
  const { marsGeoId, openMarsProject, closeMarsProject } = useMarsProjectUrl();

  const handleProjectClick = useCallback((geoId: string) => {
    if (!dashboard) return;
    const found = findMarsProjectByGeoId(dashboard, geoId);
    if (!found) return;
    setSelectedProject({ source: 'mars', ...found });
    openMarsProject(geoId);
    if (activeMetric === 'nature' && !natureOverlap) {
      loadProjectNatureOverlap().then(setNatureOverlap);
    }
  }, [dashboard, openMarsProject, activeMetric, natureOverlap]);

  const closeProjectPanel = useCallback(() => {
    setSelectedProject(undefined);
    closeMarsProject();
  }, [closeMarsProject]);

  useEffect(() => {
    if (!marsGeoId || !dashboard) {
      if (!marsGeoId) setSelectedProject(undefined);
      return;
    }
    const found = findMarsProjectByGeoId(dashboard, marsGeoId);
    if (found) setSelectedProject({ source: 'mars', ...found });
  }, [marsGeoId, dashboard]);

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
  }, []);

  const handleMapResize = useCallback(() => {
    mapRef.current?.invalidateSize();
  }, []);

  const pillarConfig = activeMetric ? getPillarConfig(activeMetric) : null;

  const mapControls = !readOnly && activeMetric ? (
    <>
      {showGrundkort && showNatureLayerToggle(activeMetric) && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Grundkort</span>
          <div className="flex flex-wrap bg-card border border-border rounded-lg p-0.5 shadow-sm">
            {NATURE_LAYER_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onNatureLayerChange(option.id)}
                className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                  natureLayer === option.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.shortLabel}
              </button>
            ))}
          </div>
          <InfoTooltip
            title="Grundkort"
            content={
              <p>
                Grundkortet er den farvelagte baggrund. Vælg hvilket benchmark-kortlag der farvelægger
                kommunerne — samme kilder som på det nationale kort under beskyttet natur.
              </p>
            }
            source="Arealdata om biodiversitet · DCE 30 %"
            side="bottom"
            size={13}
          />
        </div>
      )}

      {showGrundkort && showFordelingViewToggle(activeMetric) && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Grundkort</span>
          <div className="flex flex-wrap bg-card border border-border rounded-lg p-0.5 shadow-sm">
            {([
              { value: 'actual' as const, label: 'Faktisk' },
              { value: 'simulated' as const, label: 'Fagligt forventet' },
              { value: 'difference' as const, label: 'Forskel' },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onFordelingViewModeChange(option.value)}
                className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                  fordelingViewMode === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <InfoTooltip
            title="Grundkort"
            content={
              <p>
                <strong>Faktisk</strong> viser realiseret areal fra MARS.{' '}
                <strong>Fagligt forventet</strong> og <strong>Forskel</strong> er en simulering baseret
                på proportional fordeling efter naturpotentiale — et diskussionsgrundlag, ikke officiel
                kommune-fordeling.
              </p>
            }
            side="bottom"
            size={13}
          />
        </div>
      )}

      {showChoroplethScaleToggle(activeMetric, fordelingViewMode) && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground hidden sm:inline">Vis som</span>
          <div className="flex flex-wrap bg-card border border-border rounded-lg p-0.5 shadow-sm">
            {([
              { value: 'absolute' as const, label: 'Absolut (ha)' },
              { value: 'ansvar' as const, label: 'Ift. ansvar' },
            ]).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onChoroplethScaleChange(option.value)}
                className={`px-3 py-1 text-sm rounded-md transition-all font-medium ${
                  choroplethScale === option.value
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <InfoTooltip
            title="Absolut vs. ift. ansvar"
            content={
              <>
                <p><strong>Absolut (ha)</strong> — samlet areal fra valgte projektfaser (og evt. KSF). Farver skaleres mod den kommune med mest.</p>
                <p><strong>Ift. ansvar</strong> — samme formel som ranglisten: (kommunens andel af landets levering) ÷ (kommunens andel af naturpotentiale). 1,0× = som forventet.</p>
              </>
            }
            source="MARS + DCE 30 % naturpotentiale"
            side="bottom"
            size={13}
          />
        </div>
      )}

    </>
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
      controls={mapControls}
      hint={
        readOnly && contextCaption ? (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {contextCaption}. Skift visning på{' '}
            <span className="font-medium text-foreground/80">Alle kommuner</span>.
          </p>
        ) : activeMetric ? (
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            Klik på en kommune for at åbne detaljesiden. Grundkortet skifter visning for natur-kortlag
            og fordelings-simulering. Projektfaser og supplerende kilder styres ovenfor — de filtrerer
            tallene, ikke kortlag.
          </p>
        ) : undefined
      }
      banners={mapBanners}
      onResize={handleMapResize}
      expandDisabled={activeMetric === null}
      inlineMapHeight={inlineMapHeight}
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
              showProjectLayer={showProjectLayer}
              onProjectClick={handleProjectClick}
              fillContainer
              onMapReady={handleMapReady}
            />
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
