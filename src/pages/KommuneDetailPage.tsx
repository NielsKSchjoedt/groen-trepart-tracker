import { useEffect, useMemo, useRef } from 'react';
import { Link, useParams, useSearchParams, Navigate } from 'react-router-dom';
import { ArrowLeft, MapPin, ExternalLink } from 'lucide-react';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { Footer } from '@/components/Footer';
import { StickyNav } from '@/components/StickyNav';
import { LastUpdatedBadge } from '@/components/LastUpdatedBadge';
import { KommuneDetailPanel } from '@/components/KommuneDetailPanel';
import { KommuneMapSection } from '@/components/KommuneMapSection';
import { KommuneStandingsDetailHeader } from '@/components/kommune-standings/KommuneStandingsDetailHeader';
import { usePageMeta } from '@/hooks/usePageMeta';
import { useKommuneData, useSelectedKommune } from '@/hooks/useKommuneData';
import { scrollToPageTop, getKommuneListBackTarget } from '@/lib/kommune-navigation';
import { kommuneToSlug } from '@/lib/kommune-slugs';
import type { KommuneMetric } from '@/lib/kommune-metrics';
import { buildFilteredKommuner } from '@/lib/kommune-metrics';
import { buildDynamicRanking } from '@/lib/kommune-ranking-dynamic';
import { enrichKommunerWithKsfLavbund } from '@/lib/kommune-ksf-lavbund';
import { dedupeByProjectId } from '@/lib/dedupe-by-id';
import type { KommuneCO2Data } from '@/lib/types';
import { getPillarConfig } from '@/lib/pillars';
import { computeAnsvarIndices } from '@/lib/kommune-map-visualization';
import {
  describeKommuneMapView,
  parseKommuneMapViewState,
  parseKommuneMetricParam,
} from '@/lib/kommune-map-params';

/**
 * Full detail page for a single municipality at `/kommuner/:kommuneSlug`.
 */
export default function KommuneDetailPage() {
  const { kommuneSlug } = useParams<{ kommuneSlug: string }>();
  const [searchParams] = useSearchParams();
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
  } = mapView;

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

  const mapContextCaption = activeMetric
    ? `Samme kortvisning som på oversigten: ${describeKommuneMapView(activeMetric, mapView)}`
    : undefined;

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
      p.projectDetails.filter((pd) => pd.kommuneKode === kommune.kode),
    );
    return dedupeByProjectId(all);
  }, [kommune, data]);

  const sketchProjects = useMemo(() => {
    if (!kommune || !data) return [];
    const all = data.plans
      .filter((p) => p.projectDetails.some((pd) => pd.kommuneKode === kommune.kode))
      .flatMap((p) => p.sketchProjects);
    return dedupeByProjectId(all);
  }, [kommune, data]);

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

  const trepartLink = useMemo(() => {
    if (!kommune || !trepartLinks) return null;
    return trepartLinks.links[kommune.kode] ?? null;
  }, [kommune, trepartLinks]);

  const listSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const backTarget = getKommuneListBackTarget(listSearch);

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

  const backgroundTint = activeMetric
    ? getPillarConfig(activeMetric).backgroundTint
    : 'hsl(0 0% 96%)';

  const rankingRow = effectiveRanking?.byKommune[kommune.kode];

  return (
    <div className="relative min-h-screen transition-colors duration-400" style={{ backgroundColor: backgroundTint }}>
      <StickyNav sentinelRef={heroSentinelRef} />
      <LastUpdatedBadge fetchedAt={data.fetchedAt} />

      <div className="max-w-6xl mx-auto px-4 pt-8 pb-4">
        <ViewSwitcher />

        <Link
          to={backTarget}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Alle kommuner
        </Link>

        <div className="flex items-start gap-2.5 mb-1">
          <MapPin className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h1
              className="text-2xl font-bold text-foreground"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {kommune.navn}
            </h1>
            <p className="text-sm text-muted-foreground">
              {kommune.region} · {kommune.projectCount} MARS-projekt{kommune.projectCount !== 1 ? 'er' : ''}
            </p>
          </div>
        </div>

        {trepartLink?.url && (
          <a
            href={trepartLink.url}
            target="_blank"
            rel="noopener noreferrer"
            title={trepartLink.note || undefined}
            className="inline-flex items-center gap-1.5 mt-3 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Se hvad {kommune.navn} Kommune selv siger om trepart
            <ExternalLink className="w-3 h-3 flex-shrink-0" />
          </a>
        )}
      </div>

      <div ref={heroSentinelRef} />

      <div className="max-w-6xl mx-auto px-4 pb-16 space-y-8">
        {rankingRow && effectiveRanking && (
          <section aria-label="Tre indsatsmål">
            <KommuneStandingsDetailHeader row={rankingRow} ranking={effectiveRanking} />
          </section>
        )}

        <section aria-label="Kommune på kort">
          <KommuneMapSection
            activeMetric={activeMetric}
            kommunerGeo={kommunerGeo}
            kommunerFiltered={kommunerFiltered}
            loadError={loadError}
            fordelingSimulation={fordelingSimulation}
            kommuneBenchmark={kommuneBenchmark}
            fordelingViewMode={fordelingViewMode}
            onFordelingViewModeChange={() => {}}
            choroplethScale={choroplethScale}
            onChoroplethScaleChange={() => {}}
            kommuneRanking={kommuneRanking}
            ansvarIndexByKode={ansvarIndexByKode}
            natureLayer={natureLayer}
            onNatureLayerChange={() => {}}
            onSelect={() => {}}
            readOnly
            contextCaption={mapContextCaption}
            focusKode={kommune.kode}
            selectedKode={kommune.kode}
            inlineMapHeight="360px"
            dashboard={data}
            selectedPhases={selectedPhases}
            showProjectLayer
          />
        </section>

        <KommuneDetailPanel
          kommune={kommune}
          projectDetails={projectDetails}
          sketchProjects={sketchProjects}
          ksfProjects={ksfForKommune}
          nstProjects={nstForKommune}
          activeMetric={activeMetric ?? undefined}
          co2Data={co2Data}
          natureBenchmark={kommuneBenchmark}
          ranking={effectiveRanking}
          oplande={kommuneOplande}
          trepartLink={trepartLink}
          variant="page"
        />
      </div>

      <Footer fetchedAt={data.fetchedAt} />
    </div>
  );
}
