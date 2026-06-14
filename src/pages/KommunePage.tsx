import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Hand, Info } from 'lucide-react';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { InfoTooltip } from '@/components/InfoTooltip';
import { HintCallout } from '@/components/HintCallout';
import type { KommuneMetrics } from '@/lib/types';
import { MetricPicker } from '@/components/MetricPicker';
import { ChapterSection } from '@/components/ChapterSection';
import {
  KOMMUNE_GEOGRAFI_CHAPTER,
  KOMMUNE_GEOGRAFI_INTRO,
  KOMMUNE_LISTE_CHAPTER,
  KOMMUNE_LISTE_INTRO,
  KOMMUNE_RANGLISTE_CHAPTER,
  KOMMUNE_RANGLISTE_INTRO,
  getKommuneChapters,
} from '@/lib/kommune-chapters';
import { KommuneMapSection } from '@/components/KommuneMapSection';
import { KommuneStandingsSection } from '@/components/kommune-standings/KommuneStandingsSection';
import { KommuneMasterTable } from '@/components/kommune-standings/KommuneMasterTable';
import { useStandings } from '@/components/kommune-standings/useStandings';
import { Footer } from '@/components/Footer';
import { StickyNav } from '@/components/StickyNav';
import { SiteTopBadges } from '@/components/SiteTopBadges';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useKommuneData } from '@/hooks/useKommuneData';
import { consumeKommuneListReturnState, navigateToKommuneByKode, restoreKommuneListScroll } from '@/lib/kommune-navigation';
import type { KommuneMetric, KommunePhase, SupplementSource } from '@/lib/kommune-metrics';
import { buildFilteredKommuner, DEFAULT_PHASES, METRIC_SUPPLEMENTS } from '@/lib/kommune-metrics';
import { buildDynamicRanking } from '@/lib/kommune-ranking-dynamic';
import { enrichKommunerWithKsfLavbund } from '@/lib/kommune-ksf-lavbund';
import type { ChoroplethScaleMode, FordelingViewMode, NatureLayerKey } from '@/lib/kommune-map-visualization';
import { computeAnsvarIndices, usesSimulationChoropleth } from '@/lib/kommune-map-visualization';
import {
  applyKommuneMapViewState,
  parseKommuneMapViewState,
  parseKommuneMetricParam,
  resetMapViewParamsForMetric,
} from '@/lib/kommune-map-params';
import { useHashScroll } from '@/lib/permalink/useHashScroll';

/**
 * National kommune overview at `/kommuner` — choropleth map + rangliste.
 * Per-kommune detail lives at `/kommuner/:kommuneSlug` (KommuneDetailPage).
 */
export default function KommunePage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestore = useRef(consumeKommuneListReturnState());
  const [hintDismissed, setHintDismissed] = useState(false);

  const mapView = useMemo(() => parseKommuneMapViewState(searchParams), [searchParams]);
  const {
    fordelingViewMode,
    choroplethScale,
    natureLayer,
    selectedPhases,
    activeSupplements,
    mapOverlays,
  } = mapView;

  const patchMapView = (patch: Partial<typeof mapView>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      applyKommuneMapViewState(next, { ...parseKommuneMapViewState(prev), ...patch });
      return next;
    }, { replace: true });
  };

  const setSelectedPhases = (phases: Set<KommunePhase>) => patchMapView({ selectedPhases: phases });
  const setActiveSupplements = (supplements: Set<SupplementSource>) => patchMapView({ activeSupplements: supplements });
  const setFordelingViewMode = (mode: FordelingViewMode) => patchMapView({ fordelingViewMode: mode });
  const setChoroplethScale = (mode: ChoroplethScaleMode) => patchMapView({ choroplethScale: mode });
  const setNatureLayer = (layer: NatureLayerKey) => patchMapView({ natureLayer: layer });
  const setMapOverlays = (overlays: typeof mapOverlays) => patchMapView({ mapOverlays: overlays });

  const { data, kommunerGeo, ksfProjects, nstProjects, kommuneRanking, kommuneBenchmark, klimaregnskab, fordelingSimulation, loadError, isLoading } = useKommuneData();

  const activeMetric: KommuneMetric | null = useMemo(
    () => parseKommuneMetricParam(searchParams),
    [searchParams],
  );

  const kommuner: KommuneMetrics[] = useMemo(
    () => enrichKommunerWithKsfLavbund(data?.national.byKommune ?? [], ksfProjects),
    [data, ksfProjects],
  );

  const supplementSources = activeMetric ? METRIC_SUPPLEMENTS[activeMetric] : undefined;

  const kommunerFiltered: KommuneMetrics[] = useMemo(
    () => buildFilteredKommuner(kommuner, selectedPhases, activeSupplements),
    [kommuner, selectedPhases, activeSupplements],
  );

  const effectiveRanking = useMemo(
    () => (kommuneRanking ? buildDynamicRanking(kommuneRanking, kommunerFiltered) : null),
    [kommuneRanking, kommunerFiltered],
  );

  const standings = useStandings(effectiveRanking);

  const kommuneChapterIds = useMemo(
    () => getKommuneChapters().map((c) => c.id),
    [],
  );

  useHashScroll({
    chapterIds: kommuneChapterIds,
    ready: !!data,
  });

  const ansvarIndexByKode = useMemo(() => {
    if (choroplethScale !== 'ansvar' || !activeMetric) return {};
    if (activeMetric === 'extraction') {
      return computeAnsvarIndices(kommunerFiltered, 'extraction', effectiveRanking);
    }
    if (activeMetric === 'afforestation') {
      return computeAnsvarIndices(kommunerFiltered, 'afforestation', effectiveRanking);
    }
    return {};
  }, [choroplethScale, activeMetric, kommunerFiltered, effectiveRanking]);

  usePageMeta({
    title: 'Kommuner — status & kort',
    description:
      'Se fremskridt mod Den Grønne Treparts mål opdelt på alle 98 danske kommuner: kvælstof, lavbund, skovrejsning, CO₂ og beskyttet natur.',
    path: '/kommuner',
  });

  const listSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';

  const handleSelect = (kode: string) => {
    navigateToKommuneByKode(navigate, kode, kommuner, listSearch);
  };

  const handleMetricChange = (metric: KommuneMetric) => {
    setHintDismissed(true);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      resetMapViewParamsForMetric(next, metric);
      return next;
    }, { replace: true });
  };

  const showPhaseFilter =
    activeMetric !== null
    && (activeMetric === 'nitrogen' || activeMetric === 'extraction' || activeMetric === 'afforestation')
    && !usesSimulationChoropleth(activeMetric, fordelingViewMode);

  useEffect(() => {
    if (isLoading || !data) return;
    const saved = pendingScrollRestore.current;
    if (!saved) return;
    pendingScrollRestore.current = null;
    restoreKommuneListScroll(saved.scrollY);
  }, [isLoading, data]);

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Indlæser kommunedata…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[hsl(0_0%_96%)]">
      {/* StickyNav — shares the same component as the national view */}
      <StickyNav sentinelRef={heroSentinelRef} />
      <SiteTopBadges fetchedAt={data.fetchedAt} />

      {/* Hero — intentionally light: the rangliste chapter header below is the real lead */}
      <div className="max-w-6xl mx-auto px-4 pt-8 pb-1">
        <ViewSwitcher />
      </div>

      {/* Sentinel for StickyNav */}
      <div ref={heroSentinelRef} />

      <div className="max-w-6xl mx-auto pb-16">

        {/* Chapter: Ranglister (mini-boards) — leder siden */}
        <ChapterSection
          id={KOMMUNE_RANGLISTE_CHAPTER.id}
          eyebrow={KOMMUNE_RANGLISTE_CHAPTER.eyebrow}
          question={KOMMUNE_RANGLISTE_CHAPTER.question}
          intro={KOMMUNE_RANGLISTE_INTRO}
        >
          {effectiveRanking ? (
            <div className="px-4 max-w-6xl mx-auto">
              <KommuneStandingsSection
                ranking={effectiveRanking}
                standings={standings}
                klimaregnskab={klimaregnskab}
                benchmark={kommuneBenchmark}
                selectedPhases={selectedPhases}
                onPhasesChange={setSelectedPhases}
                selectedKode={null}
                onSelect={handleSelect}
              />
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-12 px-4">
              Rangliste-data indlæses ikke endnu — kør{' '}
              <code className="text-xs bg-muted px-1 rounded">mise run build-kommune-ranking</code>
            </p>
          )}
        </ChapterSection>

        {/* Chapter: Geografi (kort + filtre) */}
        <ChapterSection
          id={KOMMUNE_GEOGRAFI_CHAPTER.id}
          eyebrow={KOMMUNE_GEOGRAFI_CHAPTER.eyebrow}
          question={KOMMUNE_GEOGRAFI_CHAPTER.question}
          intro={KOMMUNE_GEOGRAFI_INTRO}
        >
        <div className="max-w-6xl mx-auto px-4 space-y-6">

        {/* Map */}
        <section id="kort" aria-label="Danmarkskort med kommuner">
          <KommuneMapSection
            activeMetric={activeMetric}
            kommunerGeo={kommunerGeo}
            kommunerFiltered={kommunerFiltered}
            loadError={loadError}
            fordelingSimulation={fordelingSimulation}
            kommuneBenchmark={kommuneBenchmark}
            fordelingViewMode={fordelingViewMode}
            onFordelingViewModeChange={setFordelingViewMode}
            choroplethScale={choroplethScale}
            onChoroplethScaleChange={setChoroplethScale}
            kommuneRanking={kommuneRanking}
            ansvarIndexByKode={ansvarIndexByKode}
            natureLayer={natureLayer}
            onNatureLayerChange={setNatureLayer}
            onSelect={handleSelect}
            dashboard={data}
            selectedPhases={selectedPhases}
            mapOverlays={mapOverlays}
            onMapOverlaysChange={setMapOverlays}
            activeSupplements={activeSupplements}
            ksfProjects={ksfProjects}
            nstProjects={nstProjects}
            showPhaseFilter={showPhaseFilter}
            onPhasesChange={setSelectedPhases}
            phaseFilterTooltip="Vælg hvilke MARS-projektfaser der tæller med i tallene på kortet, ranglisten og tabellen. Standard er kun anlagt — udvid for at inkludere godkendt og forundersøgelse. Ansvar-indekset (×) genberegnes efter valgte faser."
            supplementSources={supplementSources}
            onSupplementsChange={setActiveSupplements}
            filterControls={
              <>
                <div className="relative flex items-start gap-3 flex-wrap">
                  <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground pt-1.5">
                    Vis:
                    <InfoTooltip
                      title="Metrikker"
                      content={
                        <>
                          <p><strong>Kvælstof</strong> — ton N reduceret/år fra MARS-projekter. Understøtter fasefilter. Mål: 12.776 T inden 2027.</p>
                          <p><strong>Lavbund</strong> — ha kulstofrig lavbundsjord fra MARS-projekter. Understøtter fasefilter. Klimaskovfondens lavbundsprojekter kan tilvælges separat. Mål: 140.000 ha inden 2030.</p>
                          <p><strong>Skovrejsning</strong> — ha ny skov fra MARS-projekter (med fasefilter). Klimaskovfonden og Naturstyrelsen kan tilvælges separat — de administreres uden for MARS og har ikke fasedata.</p>
                          <p><strong>Beskyttet natur</strong> — benchmark-kortlag fra DCE 30 %, §3 og Natura 2000 (B1–B4). Vælg kortlag i stedet for MARS-projekter, som endnu ikke findes på kommuneniveau.</p>
                          <p><strong>CO₂</strong> — Samlet CO₂e-udledning per kommune (2023). Kilde: Energi- og CO₂-regnskabet, Energistyrelsen (klimaregnskabet.dk). Klik på en kommune for sektorfordeling og tidsudvikling.</p>
                        </>
                      }
                      source="Den Grønne Trepart (2024)"
                      size={12}
                      side="right"
                    />
                  </span>
                  <MetricPicker activeMetric={activeMetric} onChange={handleMetricChange} />

                  {activeMetric === null && !hintDismissed && (
                    <HintCallout
                      icon={Hand}
                      text="Vælg et indsatsområde for at se data på kortet og i tabellen"
                      arrow="left"
                      onDismiss={() => setHintDismissed(true)}
                      className="absolute left-1/2 -translate-x-1/2 -bottom-12 sm:left-auto sm:translate-x-0 sm:right-0 sm:bottom-auto sm:-top-1"
                    />
                  )}
                </div>

                {activeMetric === 'co2' && (
                  <MetricDisclaimer>
                    CO₂-tallene er fra{' '}
                    <a
                      href="https://klimaregnskabet.dk"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-amber-700"
                    >
                      Energi- og CO₂-regnskabet (Energistyrelsen)
                    </a>{' '}
                    og dækker frem til <strong>2023</strong>. Med den typiske ~2 års forsinkelse kan 2024-tal
                    være tilgængelige nu — dashboardet opdaterer automatisk, når de hentes ind.{' '}
                    <a
                      href="https://concito.dk/omstillingsindikatorer-drivhusgasreduktion"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2 hover:text-amber-700"
                    >
                      Concito / Klimaalliancen
                    </a>{' '}
                    udgiver løbende en dybere kommunal klimamonitorering med 16 omstillingsindikatorer pr. kommune.
                  </MetricDisclaimer>
                )}
              </>
            }
          />
        </section>
        </div>
        </ChapterSection>

        {/* Chapter: Den lange kommuneliste (master-tabel) — efter kortet */}
        <ChapterSection
          id={KOMMUNE_LISTE_CHAPTER.id}
          eyebrow={KOMMUNE_LISTE_CHAPTER.eyebrow}
          question={KOMMUNE_LISTE_CHAPTER.question}
          intro={KOMMUNE_LISTE_INTRO}
        >
          {kommuneRanking ? (
            <div className="px-4 max-w-6xl mx-auto space-y-3">
              <KommuneMasterTable
                rows={standings.tableRows}
                mode={standings.mode}
                sortKey={standings.sortKey}
                sortDir={standings.sortDir}
                onToggleSort={standings.toggleSort}
                selectedKode={null}
                onSelect={handleSelect}
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed max-w-3xl">
                Tallene viser realiseret indsats ift. kommunens andel af nationalt naturpotentiale. "Som forventet" = på niveau med ansvaret; flere gange = leverer mere end ansvaret tilsiger.
                Skitser tæller ikke med i ranglisten. Beskyttet natur der dyrkes vises kun på kommunedetaljesiden — ikke som rangliste-akse.
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-12 px-4">
              Kommunelisten indlæses ikke endnu — kør{' '}
              <code className="text-xs bg-muted px-1 rounded">mise run build-kommune-ranking</code>
            </p>
          )}
        </ChapterSection>
      </div>

      <Footer fetchedAt={data?.fetchedAt ?? ''} />
    </div>
  );
}

/**
 * Inline amber banner for contextual disclaimers.
 */
function MetricDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-relaxed dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}
