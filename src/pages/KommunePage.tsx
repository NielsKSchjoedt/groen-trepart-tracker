import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Hand, Info, Leaf, TreePine } from 'lucide-react';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { InfoTooltip } from '@/components/InfoTooltip';
import { HintCallout } from '@/components/HintCallout';
import { loadDashboardData, loadKommunerGeoJSON, loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects, loadKlimaregnskabData } from '@/lib/data';
import type { DashboardData, KommuneMetrics, KlimaskovfondenProject, NaturstyrelsenSkovProject, KlimaregnskabData, KommuneCO2Data } from '@/lib/types';
import type { FeatureCollection, Geometry } from 'geojson';
import { MetricPicker } from '@/components/MetricPicker';
import { KommuneTable } from '@/components/KommuneTable';
import { KommuneDetailPanel } from '@/components/KommuneDetailPanel';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { Footer } from '@/components/Footer';
import { StickyNav } from '@/components/StickyNav';
import { LastUpdatedBadge } from '@/components/LastUpdatedBadge';
import { usePageMeta } from '@/hooks/usePageMeta';
import { findKommuneBySlug, kommuneToSlug } from '@/lib/kommune-slugs';
import type { KommuneMetric, KommunePhase, SupplementSource } from '@/lib/kommune-metrics';
import { DEFAULT_PHASES, filterByPhases, METRIC_SUPPLEMENTS, SUPPLEMENT_DEFS } from '@/lib/kommune-metrics';
import { PhaseFilter } from '@/components/PhaseFilter';
import { PILLAR_SLUGS, slugToPillar } from '@/lib/slugs';
import { getPillarConfig } from '@/lib/pillars';

// Lazy-load Leaflet-heavy choropleth map so it splits into a separate chunk
const KommuneMap = lazy(() =>
  import('@/components/KommuneMap').then((m) => ({ default: m.KommuneMap })),
);

/**
 * Page component for /kommuner and /kommuner/:kommuneSlug.
 *
 * Loads dashboard data, kommune TopoJSON, KSF projects, and NST projects in
 * parallel. Manages the selected municipality and active metric state, encoding
 * the selected kommune in the URL as `/kommuner/:slug` for shareability.
 *
 * Layout:
 *   StickyNav
 *   ─ Hero header
 *   ─ MetricPicker (pill selector)
 *   ─ KommuneMap (choropleth, lazy)          desktop: 60% width + detail panel 40%
 *   ─ KommuneTable (sortable, searchable)
 *   ─ Mobile bottom sheet (when selected)
 *   Footer
 */
export default function KommunePage() {
  const { kommuneSlug } = useParams<{ kommuneSlug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const [hintDismissed, setHintDismissed] = useState(false);

  const [selectedPhases, setSelectedPhases] = useState<Set<KommunePhase>>(DEFAULT_PHASES);
  const [activeSupplements, setActiveSupplements] = useState<Set<SupplementSource>>(new Set());
  const [data, setData] = useState<DashboardData | null>(null);
  const [kommunerGeo, setKommunerGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);
  const [klimaregnskab, setKlimaregnskab] = useState<KlimaregnskabData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  /**
   * Derive activeMetric from the URL query param (?metric=kvælstof etc.).
   * When no ?metric= param is present, activeMetric is null (no selection)
   * so the page shows an onboarding hint and the map displays a prompt overlay.
   */
  const activeMetric: KommuneMetric | null = useMemo(() => {
    const slug = searchParams.get('metric');
    if (!slug) return null;
    return (slugToPillar(slug) as KommuneMetric | null) ?? null;
  }, [searchParams]);

  usePageMeta({
    title: 'Kommuner — Den Grønne Trepart Tracker',
    description: 'Se fremskridt mod Den Grønne Treparts klimamål opdelt på alle 98 danske kommuner. Kvælstofreduktion, lavbundsudtagning og skovrejsning per kommune.',
    path: '/kommuner',
  });

  // Load all data in parallel
  useEffect(() => {
    Promise.all([
      loadDashboardData(),
      loadKommunerGeoJSON().catch(() => null),
      loadKlimaskovfondenProjects(),
      loadNaturstyrelsenSkovProjects(),
      loadKlimaregnskabData(),
    ]).then(([d, geo, ksf, nst, kr]) => {
      setData(d);
      if (geo) setKommunerGeo(geo);
      else setLoadError('Kommune-polygoner ikke tilgængelige endnu — kør `mise run build-kommune-map`');
      setKsfProjects(ksf);
      setNstProjects(nst);
      setKlimaregnskab(kr);
    });
  }, []);

  const kommuner: KommuneMetrics[] = useMemo(
    () => data?.national.byKommune ?? [],
    [data],
  );

  /**
   * Phase-filtered + supplement-adjusted view of kommuner.
   *
   * MARS metrics (nitrogen, extraction, afforestation) are recomputed from
   * `byPhase` so the phase filter applies consistently. Non-MARS supplement
   * sources (KSF, NST, §3, Natura 2000) are added on top only when toggled.
   */
  const kommunerFiltered: KommuneMetrics[] = useMemo(() => {
    return kommuner.map((km) => {
      const filtered = filterByPhases(km, selectedPhases);

      const afforestationTotal =
        filtered.afforestationMarsHa
        + (activeSupplements.has('ksf') ? km.afforestationKsfHa : 0)
        + (activeSupplements.has('nst') ? km.afforestationNstHa : 0);

      const natureTotal =
        (activeSupplements.has('section3') ? km.section3Ha : 0)
        + (activeSupplements.has('natura2000') ? km.natura2000Ha : 0);

      return {
        ...km,
        nitrogenT: filtered.nitrogenT,
        extractionHa: filtered.extractionHa,
        afforestationTotalHa: Math.round(afforestationTotal * 10) / 10,
        naturePotentialHa: Math.round(natureTotal * 10) / 10,
        projectCount: filtered.projectCount,
      };
    });
  }, [kommuner, selectedPhases, activeSupplements]);

  // Derive selected kode from URL slug
  const selectedKode: string | null = useMemo(() => {
    if (!kommuneSlug || kommuner.length === 0) return null;
    return findKommuneBySlug(kommuneSlug, kommuner)?.kode ?? null;
  }, [kommuneSlug, kommuner]);

  const selectedKommune: KommuneMetrics | null = useMemo(
    () => (selectedKode ? (kommuner.find((k) => k.kode === selectedKode) ?? null) : null),
    [selectedKode, kommuner],
  );

  /**
   * Build the ?metric= search string using Danish slugs (e.g. "lavbund").
   * Omitted when no metric is selected (null state).
   */
  const metricSearch = activeMetric ? `?metric=${PILLAR_SLUGS[activeMetric]}` : '';

  // When user clicks a kommune, push URL — preserving the active metric.
  const handleSelect = (kode: string) => {
    const km = kommuner.find((k) => k.kode === kode);
    if (!km) return;
    const slug = kommuneToSlug(km.navn);
    if (kode === selectedKode) {
      navigate({ pathname: '/kommuner', search: metricSearch }, { replace: true });
    } else {
      navigate({ pathname: `/kommuner/${slug}`, search: metricSearch }, { replace: true });
    }
  };

  const handleClose = () => {
    navigate({ pathname: '/kommuner', search: metricSearch }, { replace: true });
  };

  const handleMetricChange = (metric: KommuneMetric) => {
    setHintDismissed(true);
    setSearchParams({ metric: PILLAR_SLUGS[metric] }, { replace: true });
  };

  // Filter MARS projects for the selected kommune
  const selectedProjectDetails = useMemo(() => {
    if (!selectedKode || !data) return [];
    return data.plans.flatMap((p) =>
      p.projectDetails.filter((pd) => pd.kommuneKode === selectedKode),
    );
  }, [selectedKode, data]);

  // Sketch projects from the same plans that have a project in this municipality.
  // SketchProject has no kommuneKode, so we scope to plans that touch this municipality.
  const selectedSketchProjects = useMemo(() => {
    if (!selectedKode || !data) return [];
    return data.plans
      .filter((p) => p.projectDetails.some((pd) => pd.kommuneKode === selectedKode))
      .flatMap((p) => p.sketchProjects);
  }, [selectedKode, data]);

  /**
   * KSF projects for the selected municipality — only populated when the
   * "ksf" supplement toggle is active, so the chart respects the toggle state.
   */
  const selectedKsfProjects = useMemo(() => {
    if (!selectedKommune || !activeSupplements.has('ksf')) return [];
    return ksfProjects.filter((p) => p.kommune === selectedKommune.navn);
  }, [selectedKommune, ksfProjects, activeSupplements]);

  /**
   * NST projects for the selected municipality — only populated when the
   * "nst" supplement toggle is active.
   */
  const selectedNstProjects = useMemo(() => {
    if (!selectedKommune || !activeSupplements.has('nst')) return [];
    return nstProjects.filter((p) => p.kommune === selectedKommune.navn);
  }, [selectedKommune, nstProjects, activeSupplements]);

  /** CO₂ time-series for the currently selected municipality */
  const selectedKommuneCO2Data: KommuneCO2Data | null = useMemo(() => {
    if (!selectedKommune || !klimaregnskab) return null;
    return klimaregnskab.kommuner.find((k) => k.kommuneKode === selectedKommune.kode) ?? null;
  }, [selectedKommune, klimaregnskab]);

  const panelOpen = !!selectedKommune;

  // ─── Loading state ────────────────────────────────────────────────────────

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Indlæser kommunedata…</p>
        </div>
      </div>
    );
  }

  const backgroundTint = activeMetric
    ? getPillarConfig(activeMetric).backgroundTint
    : 'hsl(0 0% 96%)';

  return (
    <div className="relative min-h-screen transition-colors duration-400" style={{ backgroundColor: backgroundTint }}>
      {/* StickyNav — shares the same component as the national view */}
      <StickyNav sentinelRef={heroSentinelRef} />
      <LastUpdatedBadge fetchedAt={data.fetchedAt} />

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-6 relative overflow-hidden">
        {/* Decorative background silhouettes */}
        <div className="absolute top-4 left-6 opacity-[0.08] pointer-events-none">
          <Leaf className="w-28 h-28 text-primary animate-gentle-sway" strokeWidth={1} />
        </div>
        <div className="absolute bottom-2 right-8 opacity-[0.06] pointer-events-none hidden md:block">
          <TreePine className="w-24 h-24 text-nature-moss" strokeWidth={1} />
        </div>

        <ViewSwitcher />
        <div className="flex items-center gap-2.5 mb-1">
          <MapPin className="w-5 h-5 text-primary" />
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Kommuner
          </h1>
        </div>
        <p className="text-sm text-muted-foreground max-w-xl flex items-start gap-1.5 flex-wrap">
          <span>
            Se hvordan de 98 danske kommuner bidrager til Den Grønne Treparts mål for
            kvælstofreduktion, lavbundsudtagning og skovrejsning.
          </span>
          <InfoTooltip
            title="Hvad viser kommunevisningen?"
            content={
              <>
                <p>Kortvisningen farvelægger kommunerne efter den valgte metrik. Klik på en kommune for at se detaljer.</p>
                <p><strong>MARS-data</strong> (kvælstof, udtagning, skovrejsning) viser projektdata med fasefilter. Projekter tilknyttes en kommune via DAWA-omvendt geokodning af centroider.</p>
                <p><strong>Supplerende kilder</strong> (Klimaskovfonden, Naturstyrelsen, §3, Natura 2000) administreres uden for MARS og har ikke projektfasedata. De kan tilvælges separat via &quot;Tilføj kilder&quot;.</p>
                <p>CO₂-udledning pr. kommune er baseret på Energistyrelsens Klimaregnskab (2023-data).</p>
              </>
            }
            source="MARS API, Klimaskovfonden, Naturstyrelsen via DAWA"
            size={13}
            side="bottom"
            align="start"
          />
        </p>
      </div>

      {/* Sentinel for StickyNav */}
      <div ref={heroSentinelRef} />

      <div className="max-w-6xl mx-auto px-4 pb-16 space-y-6">

        {/* Metric picker + phase filter */}
        <div className="space-y-2">
          <div className="relative flex items-start gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground pt-1.5">
              Vis:
              <InfoTooltip
                title="Metrikker"
                content={
                  <>
                    <p><strong>Kvælstof</strong> — ton N reduceret/år fra MARS-projekter. Understøtter fasefilter. Mål: 12.776 T inden 2027.</p>
                    <p><strong>Udtagning</strong> — ha kulstofrig lavbundsjord fra MARS-projekter. Understøtter fasefilter. Mål: 140.000 ha inden 2030.</p>
                    <p><strong>Skovrejsning</strong> — ha ny skov fra MARS-projekter (med fasefilter). Klimaskovfonden og Naturstyrelsen kan tilvælges separat — de administreres uden for MARS og har ikke fasedata.</p>
                    <p><strong>Beskyttet natur</strong> — §3-arealer og Natura 2000 kan tilvælges som separate datakilder. Disse er statslige/EU-udpegninger, ikke projekter med faser. MARS-naturdata per kommune er endnu ikke tilgængeligt.</p>
                    <p><strong>CO₂</strong> — Samlet CO₂e-udledning per kommune (2023). Kilde: Energi- og CO₂-regnskabet, Energistyrelsen (klimaregnskabet.dk). Klik på en kommune for sektorfordeling og tidsudvikling.</p>
                  </>
                }
                source="Den Grønne Trepart (2024)"
                size={12}
                side="right"
              />
            </span>
            <MetricPicker activeMetric={activeMetric} onChange={handleMetricChange} />

            {/* Onboarding hint — shown until user selects a metric */}
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

          {/* Phase filter — shown for metrics backed by MARS project data */}
          {(activeMetric === 'nitrogen' || activeMetric === 'extraction' || activeMetric === 'afforestation') && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Faser:</span>
              <PhaseFilter selected={selectedPhases} onChange={setSelectedPhases} />
            </div>
          )}

          {/* Supplement source toggles — shown for metrics with non-MARS data */}
          {activeMetric && METRIC_SUPPLEMENTS[activeMetric] && (
            <SupplementToggles
              metric={activeMetric}
              active={activeSupplements}
              onChange={setActiveSupplements}
            />
          )}

          {/* Nature has no MARS data per kommune yet — explain what's shown */}
          {activeMetric === 'nature' && activeSupplements.size === 0 && (
            <MetricDisclaimer>
              MARS-naturprojekter er endnu ikke opgjort på kommuneniveau. Tilvælg §3 og/eller Natura 2000 ovenfor for at se beskyttede naturarealer.
            </MetricDisclaimer>
          )}

          {/* CO₂ data coverage disclaimer */}
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
        </div>

        {/* Map + optional desktop detail panel */}
        <section id="kort" aria-label="Danmarkskort med kommuner">
          {/* Colour legend — shown above the map when a metric is selected */}
          {activeMetric && <KommuneLegend activeMetric={activeMetric} />}

          {loadError ? (
            <div className="rounded-2xl border border-border bg-muted/30 flex items-center justify-center text-sm text-muted-foreground p-10 text-center" style={{ height: '520px' }}>
              <div>
                <MapPin className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-medium mb-1">Kortdata ikke klar</p>
                <p className="text-xs opacity-70">{loadError}</p>
              </div>
            </div>
          ) : !kommunerGeo ? (
            <div className="rounded-2xl border border-border bg-muted/10 flex items-center justify-center" style={{ height: '520px' }}>
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className={`flex gap-0 transition-all ${panelOpen ? '' : ''}`}>
              <div className={`transition-all relative ${panelOpen ? 'w-full md:w-3/5' : 'w-full'}`}>
                {activeMetric === null && (
                  <div className="absolute inset-0 z-20 rounded-2xl bg-background/80 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                    <div className="text-center space-y-2 px-4">
                      <MapPin className="w-8 h-8 mx-auto text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">Vælg et indsatsområde ovenfor</p>
                      <p className="text-xs text-muted-foreground/70">Kortet viser data, når du vælger kvælstof, udtagning, skovrejsning m.fl.</p>
                    </div>
                  </div>
                )}
                <Suspense fallback={
                  <div className="rounded-2xl border border-border bg-muted/10 flex items-center justify-center" style={{ height: '520px' }}>
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }>
                  <KommuneMap
                    kommunerGeo={kommunerGeo}
                    metrics={kommunerFiltered}
                    activeMetric={activeMetric ?? 'nitrogen'}
                    selectedKode={selectedKode}
                    onSelect={handleSelect}
                  />
                </Suspense>
              </div>

              {/* Desktop detail panel */}
              {panelOpen && selectedKommune && (
                <div className="hidden md:block w-2/5 max-h-[520px] overflow-y-auto border-l border-t border-r border-b border-border rounded-r-2xl">
                  <KommuneDetailPanel
                    kommune={selectedKommune}
                    projectDetails={selectedProjectDetails}
                    sketchProjects={selectedSketchProjects}
                    ksfProjects={selectedKsfProjects}
                    nstProjects={selectedNstProjects}
                    activeMetric={activeMetric ?? undefined}
                    co2Data={selectedKommuneCO2Data}
                    onClose={handleClose}
                  />
                </div>
              )}
            </div>
          )}

        </section>

        {/* Table */}
        <section id="tabel" aria-label="Kommuneoversigt tabel">
          <KommuneTable
            metrics={kommunerFiltered}
            activeMetric={activeMetric}
            selectedKode={selectedKode}
            onSelect={handleSelect}
          />
        </section>
      </div>

      {/* Mobile bottom sheet */}
      {panelOpen && selectedKommune && (
        <MobileBottomSheet onClose={handleClose}>
          <KommuneDetailPanel
            kommune={selectedKommune}
            projectDetails={selectedProjectDetails}
            sketchProjects={selectedSketchProjects}
            ksfProjects={selectedKsfProjects}
            nstProjects={selectedNstProjects}
            activeMetric={activeMetric ?? undefined}
            co2Data={selectedKommuneCO2Data}
            onClose={handleClose}
          />
        </MobileBottomSheet>
      )}

      <Footer fetchedAt={data?.fetchedAt ?? ''} />
    </div>
  );
}

// ─── Colour legend ─────────────────────────────────────────────────────────

const LEGEND_STOPS: Record<KommuneMetric, { color: string; label: string }[]> = {
  nitrogen: [
    { color: '#0d9488', label: 'Høj kvælstofreduktion' },
    { color: '#5eead4', label: 'Middel' },
    { color: '#ccfbf1', label: 'Lav' },
    { color: 'hsl(0 0% 92%)', label: 'Ingen data' },
  ],
  extraction: [
    { color: '#a16207', label: 'Høj udtagning' },
    { color: '#fcd34d', label: 'Middel' },
    { color: '#fef3c7', label: 'Lav' },
    { color: 'hsl(0 0% 92%)', label: 'Ingen data' },
  ],
  afforestation: [
    { color: '#15803d', label: 'Høj skovrejsning' },
    { color: '#86efac', label: 'Middel' },
    { color: '#dcfce7', label: 'Lav' },
    { color: 'hsl(0 0% 92%)', label: 'Ingen data' },
  ],
  nature: [
    { color: '#166534', label: 'Høj beskyttet natur' },
    { color: '#4ade80', label: 'Middel' },
    { color: '#dcfce7', label: 'Lav' },
    { color: 'hsl(0 0% 92%)', label: 'Ingen data' },
  ],
  co2: [
    { color: '#b91c1c', label: 'Høj udledning (> 2M ton CO₂e)' },
    { color: '#f97316', label: 'Middel' },
    { color: '#fde68a', label: 'Lav' },
    { color: 'hsl(0 0% 92%)', label: 'Ingen data' },
  ],
};

/**
 * Inline amber banner for contextual disclaimers (e.g. when no data
 * sources are toggled on for nature).
 */
function MetricDisclaimer({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900 leading-relaxed dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">
      <Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-500" strokeWidth={2} />
      <span>{children}</span>
    </div>
  );
}

/**
 * Toggle pills for supplementary (non-MARS) data sources.
 *
 * Each pill adds a non-phased data source on top of the MARS base.
 * Toggling ON adds the source's hectares to the displayed totals;
 * toggling OFF removes them. OFF by default so the base view is
 * pure MARS project data (which supports phase filtering).
 *
 * For nature, there is currently no MARS base per kommune, so the
 * supplements are the only data available — the user needs to toggle
 * at least one on to see values.
 */
function SupplementToggles({
  metric,
  active,
  onChange,
}: {
  metric: KommuneMetric;
  active: Set<SupplementSource>;
  onChange: (next: Set<SupplementSource>) => void;
}) {
  const sources = METRIC_SUPPLEMENTS[metric];
  if (!sources) return null;

  const toggle = (id: SupplementSource) => {
    const next = new Set(active);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };

  return (
    <div className="flex items-start gap-2.5 flex-wrap">
      <span className="text-xs font-medium text-muted-foreground pt-1" title="Disse kilder administreres uden for MARS og har ikke projektfasedata">
        Tilføj kilder <span className="font-normal opacity-70">(uden fasedata)</span>:
      </span>
      <div className="flex items-center gap-2 flex-wrap">
        {sources.map((srcId) => {
          const def = SUPPLEMENT_DEFS[srcId];
          const isActive = active.has(srcId);
          return (
            <button
              key={srcId}
              type="button"
              onClick={() => toggle(srcId)}
              aria-pressed={isActive}
              title={def.description}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium',
                'transition-all duration-150 select-none cursor-pointer',
                isActive ? def.color.activeClass : 'border-border/50 bg-background text-muted-foreground hover:bg-muted/50',
              ].join(' ')}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors"
                style={{ backgroundColor: isActive ? def.color.stroke : undefined }}
              />
              + {def.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function KommuneLegend({ activeMetric }: { activeMetric: KommuneMetric }) {
  const stops = LEGEND_STOPS[activeMetric];
  return (
    <div className="flex flex-wrap items-center gap-3 mt-3 text-xs text-muted-foreground">
      {stops.map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full border border-border/60" style={{ backgroundColor: color }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
