import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Info } from 'lucide-react';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { Footer } from '@/components/Footer';
import { StickyNav } from '@/components/StickyNav';
import { SiteTopBadges } from '@/components/SiteTopBadges';
import { KommuneEmblem } from '@/components/KommuneEmblem';
import { INDSATS_MAAL, statusOf } from '@/lib/kommune-indsats-status';
import { IndsatsMaalChip } from '@/components/kommune-detail/IndsatsMaalChip';
import { KommuneMapSection } from '@/components/KommuneMapSection';
import {
  KommuneDetailCo2Section,
  KommuneDetailKeyFigures,
  KommuneDetailNaturSection,
  KommuneDetailPhaseProfile,
  KommuneDetailProjectsSection,
} from '@/components/kommune-detail/KommuneDetailPageBody';
import { KommuneStandingsDetailHeader } from '@/components/kommune-standings/KommuneStandingsDetailHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useKommuneData, useSelectedKommune } from '@/hooks/useKommuneData';
import { MetricPicker } from '@/components/MetricPicker';
import { ChapterSection } from '@/components/ChapterSection';
import { scrollToPageTop, getKommuneListBackTarget, navigateToKommuneByKode } from '@/lib/kommune-navigation';
import { kommuneToSlug } from '@/lib/kommune-slugs';
import type { KommuneMetric, KommunePhase, SupplementSource } from '@/lib/kommune-metrics';
import { buildFilteredKommuner, METRIC_SUPPLEMENTS } from '@/lib/kommune-metrics';
import { buildDynamicRanking, type StandingsMode } from '@/lib/kommune-ranking-dynamic';
import { enrichKommunerWithKsfLavbund } from '@/lib/kommune-ksf-lavbund';
import { dedupeByProjectId } from '@/lib/dedupe-by-id';
import type { KommuneCO2Data } from '@/lib/types';
import type { ChoroplethScaleMode, FordelingViewMode, NatureLayerKey } from '@/lib/kommune-map-visualization';
import { computeAnsvarIndices, usesSimulationChoropleth } from '@/lib/kommune-map-visualization';
import {
  applyKommuneMapViewState,
  parseKommuneMapViewState,
  parseKommuneMetricParam,
  resetMapViewParamsForMetric,
} from '@/lib/kommune-map-params';
import {
  getKommuneDetailChapters,
  KOMMUNE_DETAIL_CO2_CHAPTER,
  KOMMUNE_DETAIL_CO2_INTRO,
  KOMMUNE_DETAIL_FASEPROFIL_CHAPTER,
  KOMMUNE_DETAIL_FASEPROFIL_INTRO,
  KOMMUNE_DETAIL_KORT_CHAPTER,
  KOMMUNE_DETAIL_KORT_INTRO,
  KOMMUNE_DETAIL_NATUR_CHAPTER,
  KOMMUNE_DETAIL_NATUR_INTRO,
  KOMMUNE_DETAIL_NOEGLETAL_CHAPTER,
  KOMMUNE_DETAIL_NOEGLETAL_INTRO,
  KOMMUNE_DETAIL_PROJEKTER_CHAPTER,
  KOMMUNE_DETAIL_PROJEKTER_INTRO,
  KOMMUNE_DETAIL_STATUS_CHAPTER,
  KOMMUNE_DETAIL_STATUS_INTRO,
} from '@/lib/kommune-detail-chapters';
import { hasPhaseProfileData } from '@/components/kommune-standings/KommunePhaseVsNational';
import { useHashScroll } from '@/lib/permalink/useHashScroll';
import { parseProjectParam, PROJECT_PARAM } from '@/lib/permalink/slices/project-open';
import { projectOverlapsKommune } from '@/lib/mars-kommune-overlap';

/**
 * Full detail page for a single municipality at `/kommuner/:kommuneSlug`.
 */
export default function KommuneDetailPage() {
  const navigate = useNavigate();
  const { kommuneSlug } = useParams<{ kommuneSlug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const heroSentinelRef = useRef<HTMLDivElement>(null);

  const {
    data,
    kommunerGeo,
    ksfProjects,
    nstProjects,
    klimaregnskab,
    kommuneBenchmark,
    kommuneRanking,
    kommuneOplande,
    trepartLinks,
    fordelingSimulation,
    loadError,
    isLoading,
  } = useKommuneData();

  const kommuner = useMemo(
    () => enrichKommunerWithKsfLavbund(data?.national.byKommune ?? [], ksfProjects),
    [data, ksfProjects],
  );
  const kommune = useSelectedKommune(kommuneSlug, kommuner);

  useEffect(() => {
    scrollToPageTop();
  }, [kommuneSlug]);

  const activeMetric: KommuneMetric | null = useMemo(
    () => parseKommuneMetricParam(searchParams),
    [searchParams],
  );

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

  /** Måleenhed for the "Hvor står?" section — local to the page (Ift. ansvar default). */
  const [standingsMode, setStandingsMode] = useState<StandingsMode>('relativ');

  const supplementSources = activeMetric ? METRIC_SUPPLEMENTS[activeMetric] : undefined;

  const showPhaseFilter =
    activeMetric !== null
    && (activeMetric === 'nitrogen' || activeMetric === 'extraction' || activeMetric === 'afforestation')
    && !usesSimulationChoropleth(activeMetric, fordelingViewMode);

  const kommunerFiltered = useMemo(
    () => buildFilteredKommuner(kommuner, selectedPhases, activeSupplements),
    [kommuner, selectedPhases, activeSupplements],
  );

  const effectiveRanking = useMemo(
    () => (kommuneRanking ? buildDynamicRanking(kommuneRanking, kommunerFiltered) : null),
    [kommuneRanking, kommunerFiltered],
  );

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

  const handleMetricChange = (metric: KommuneMetric) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      resetMapViewParamsForMetric(next, metric);
      return next;
    }, { replace: true });
  };

  const handleSelect = (kode: string) => {
    const search = searchParams.toString() ? `?${searchParams.toString()}` : '';
    navigateToKommuneByKode(navigate, kode, kommuner, search);
  };

  usePageMeta({
    title: kommune
      ? `${kommune.navn} kommune — status & kort`
      : 'Kommune ikke fundet',
    description: kommune
      ? `Se status for Den Grønne Trepart i ${kommune.navn} Kommune. Følg skovrejsning, lavbundsarealer, kvælstofreduktion og CO₂-udledning.`
      : 'Kommune ikke fundet.',
    path: kommune ? `/kommuner/${kommuneToSlug(kommune.navn)}` : '/kommuner',
  });

  const projectDetails = useMemo(() => {
    if (!kommune || !data) return [];
    const all = data.plans.flatMap((p) =>
      p.projectDetails.filter((pd) => projectOverlapsKommune(pd, kommune.kode)),
    );
    return dedupeByProjectId(all);
  }, [kommune, data]);

  const sketchProjects = useMemo(() => {
    if (!kommune || !data) return [];
    const all = data.plans.flatMap((p) =>
      p.sketchProjects.filter((sk) => projectOverlapsKommune(sk, kommune.kode)),
    );
    return dedupeByProjectId(all);
  }, [kommune, data]);

  const allowedMarsGeoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const project of projectDetails) ids.add(project.geoId);
    for (const project of sketchProjects) ids.add(project.geoId);
    return ids;
  }, [projectDetails, sketchProjects]);

  useEffect(() => {
    if (!kommune || !data) return;
    const open = parseProjectParam(searchParams.get(PROJECT_PARAM));
    if (!open || open.source !== 'mars') return;
    if (allowedMarsGeoIds.has(open.id)) return;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(PROJECT_PARAM);
      return next;
    }, { replace: true });
  }, [kommune, data, allowedMarsGeoIds, searchParams, setSearchParams]);

  const ksfForKommune = useMemo(() => {
    if (!kommune) return [];
    return ksfProjects.filter((p) => p.kommune === kommune.navn);
  }, [kommune, ksfProjects]);

  const nstForKommune = useMemo(() => {
    if (!kommune) return [];
    return nstProjects.filter((p) => p.kommune === kommune.navn);
  }, [kommune, nstProjects]);

  const co2Data: KommuneCO2Data | null = useMemo(() => {
    if (!kommune || !klimaregnskab) return null;
    return klimaregnskab.kommuner.find((k) => k.kommuneKode === kommune.kode) ?? null;
  }, [kommune, klimaregnskab]);

  const co2First = activeMetric === 'co2' && !!co2Data;

  const detailChapters = useMemo(
    () => (kommune
      ? getKommuneDetailChapters({
        kommune,
        ranking: effectiveRanking,
        co2Data,
        co2First,
      })
      : []),
    [kommune, effectiveRanking, co2Data, co2First],
  );

  const detailChapterIds = useMemo(
    () => detailChapters.map((c) => c.id),
    [detailChapters],
  );

  const trepartLink = useMemo(() => {
    if (!kommune || !trepartLinks) return null;
    return trepartLinks.links[kommune.kode] ?? null;
  }, [kommune, trepartLinks]);

  const listSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const backTarget = getKommuneListBackTarget(listSearch);

  useHashScroll({
    chapterIds: detailChapterIds,
    ready: !!data && !!kommune,
  });

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

  if (!kommune) {
    return <Navigate to="/kommuner" replace />;
  }

  const rankingRow = effectiveRanking?.byKommune[kommune.kode];

  return (
    <div className="relative min-h-screen bg-[hsl(0_0%_96%)]">
      <StickyNav sentinelRef={heroSentinelRef} chapters={detailChapters} contextLabel={kommune.navn} />
      <SiteTopBadges fetchedAt={data.fetchedAt} />

      <div className="max-w-3xl mx-auto px-4 pt-8 pb-4 flex flex-col items-center">
        <ViewSwitcher />

        <div className="w-full flex flex-col items-center text-center">
          <Link
            to={backTarget}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Alle kommuner
          </Link>

          <div className="flex flex-col items-center gap-2 mb-1">
            <KommuneEmblem name={kommune.navn} size={56} />
            <div className="min-w-0">
              <h1
                className="text-2xl sm:text-3xl font-bold text-foreground leading-tight"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {kommune.navn}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {kommune.region} · {kommune.projectCount} MARS-projekt{kommune.projectCount !== 1 ? 'er' : ''}
              </p>

              {trepartLink?.url && (
                <a
                  href={trepartLink.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={trepartLink.note || undefined}
                  className="inline-flex items-center gap-1.5 mt-2.5 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                >
                  Se hvad {kommune.navn} Kommune selv siger om trepart
                  <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              )}
            </div>
          </div>

          {rankingRow && effectiveRanking && (
            <div className="flex flex-wrap justify-center gap-1.5 mt-3.5" aria-label="Status på de tre leveringsmål">
              {INDSATS_MAAL.map((m) => (
                <IndsatsMaalChip
                  key={m.key}
                  short={m.short}
                  tone={m.tone}
                  status={statusOf(rankingRow[m.key])}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div ref={heroSentinelRef} />

      <div className="max-w-6xl mx-auto pb-16">
        <ChapterSection
          id={KOMMUNE_DETAIL_STATUS_CHAPTER.id}
          eyebrow={KOMMUNE_DETAIL_STATUS_CHAPTER.eyebrow}
          question={`Hvor står ${kommune.navn}?`}
          intro={KOMMUNE_DETAIL_STATUS_INTRO}
        >
          {rankingRow && effectiveRanking ? (
            <div className="px-4 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-border bg-card shadow-sm p-4 sm:p-5">
                <KommuneStandingsDetailHeader
                  row={rankingRow}
                  ranking={effectiveRanking}
                  variant="embedded"
                  mode={standingsMode}
                  onModeChange={setStandingsMode}
                  selectedPhases={selectedPhases}
                  onPhasesChange={setSelectedPhases}
                />
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground py-12 px-4">
              Statusdata indlæses ikke endnu — kør{' '}
              <code className="text-xs bg-muted px-1 rounded">mise run build-kommune-ranking</code>
            </p>
          )}
        </ChapterSection>

        <ChapterSection
          id={KOMMUNE_DETAIL_KORT_CHAPTER.id}
          eyebrow={KOMMUNE_DETAIL_KORT_CHAPTER.eyebrow}
          question={KOMMUNE_DETAIL_KORT_CHAPTER.question}
          intro={KOMMUNE_DETAIL_KORT_INTRO}
        >
          <div className="px-4 max-w-6xl mx-auto">
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
              focusKode={kommune.kode}
              selectedKode={kommune.kode}
              allowedMarsGeoIds={allowedMarsGeoIds}
              inlineMapHeight="360px"
              dashboard={data}
              selectedPhases={selectedPhases}
              mapOverlays={mapOverlays}
              onMapOverlaysChange={setMapOverlays}
              activeSupplements={activeSupplements}
              ksfProjects={ksfForKommune}
              nstProjects={nstForKommune}
              showPhaseFilter={showPhaseFilter}
              onPhasesChange={setSelectedPhases}
              phaseFilterTooltip="Vælg hvilke MARS-projektfaser der tæller med i tallene på kortet og i nøgletal. Standard er kun anlagt — udvid for at inkludere godkendt og forundersøgelse."
              supplementSources={supplementSources}
              onSupplementsChange={setActiveSupplements}
              filterControls={
                <>
                  <div className="flex items-start gap-3 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground pt-1.5">Vis:</span>
                    <MetricPicker activeMetric={activeMetric} onChange={handleMetricChange} />
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
                      og dækker frem til <strong>2023</strong>.
                    </MetricDisclaimer>
                  )}
                </>
              }
            />
          </div>
        </ChapterSection>

        {co2First && co2Data && (
          <ChapterSection
            id={KOMMUNE_DETAIL_CO2_CHAPTER.id}
            eyebrow={KOMMUNE_DETAIL_CO2_CHAPTER.eyebrow}
            question={KOMMUNE_DETAIL_CO2_CHAPTER.question}
            intro={KOMMUNE_DETAIL_CO2_INTRO}
          >
            <div className="px-4 max-w-3xl mx-auto">
              <KommuneDetailCo2Section co2Data={co2Data} />
            </div>
          </ChapterSection>
        )}

        <ChapterSection
          id={KOMMUNE_DETAIL_NOEGLETAL_CHAPTER.id}
          eyebrow={KOMMUNE_DETAIL_NOEGLETAL_CHAPTER.eyebrow}
          question={`Hvad har ${kommune.navn} leveret?`}
          intro={KOMMUNE_DETAIL_NOEGLETAL_INTRO}
        >
          <div className="px-4 max-w-3xl mx-auto">
            <KommuneDetailKeyFigures
              kommune={kommune}
              ksfProjects={ksfForKommune}
              nstProjects={nstForKommune}
              ranking={effectiveRanking}
              natureBenchmark={kommuneBenchmark}
            />
          </div>
        </ChapterSection>

        {effectiveRanking && hasPhaseProfileData(kommune, effectiveRanking) && (
          <ChapterSection
            id={KOMMUNE_DETAIL_FASEPROFIL_CHAPTER.id}
            eyebrow={KOMMUNE_DETAIL_FASEPROFIL_CHAPTER.eyebrow}
            question={KOMMUNE_DETAIL_FASEPROFIL_CHAPTER.question}
            intro={KOMMUNE_DETAIL_FASEPROFIL_INTRO}
          >
            <div className="px-4 max-w-3xl mx-auto">
              <KommuneDetailPhaseProfile kommune={kommune} ranking={effectiveRanking} />
            </div>
          </ChapterSection>
        )}

        <ChapterSection
          id={KOMMUNE_DETAIL_NATUR_CHAPTER.id}
          eyebrow={KOMMUNE_DETAIL_NATUR_CHAPTER.eyebrow}
          question={KOMMUNE_DETAIL_NATUR_CHAPTER.question}
          intro={KOMMUNE_DETAIL_NATUR_INTRO}
        >
          <div className="px-4 max-w-3xl mx-auto">
            <KommuneDetailNaturSection
              kommune={kommune}
              natureBenchmark={kommuneBenchmark}
              oplande={kommuneOplande}
            />
          </div>
        </ChapterSection>

        {co2Data && !co2First && (
          <ChapterSection
            id={KOMMUNE_DETAIL_CO2_CHAPTER.id}
            eyebrow={KOMMUNE_DETAIL_CO2_CHAPTER.eyebrow}
            question={KOMMUNE_DETAIL_CO2_CHAPTER.question}
            intro={KOMMUNE_DETAIL_CO2_INTRO}
          >
            <div className="px-4 max-w-3xl mx-auto">
              <KommuneDetailCo2Section co2Data={co2Data} />
            </div>
          </ChapterSection>
        )}

        <ChapterSection
          id={KOMMUNE_DETAIL_PROJEKTER_CHAPTER.id}
          eyebrow={KOMMUNE_DETAIL_PROJEKTER_CHAPTER.eyebrow}
          question={`Hvad sker der i ${kommune.navn}?`}
          intro={KOMMUNE_DETAIL_PROJEKTER_INTRO}
        >
          <div className="px-4 max-w-3xl mx-auto">
            <KommuneDetailProjectsSection
              kommune={kommune}
              projectDetails={projectDetails}
              sketchProjects={sketchProjects}
              ksfProjects={ksfForKommune}
              nstProjects={nstForKommune}
              activeMetric={activeMetric ?? undefined}
            />
          </div>
        </ChapterSection>
      </div>

      <Footer fetchedAt={data.fetchedAt} />
    </div>
  );
}

function MetricDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-relaxed dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}
