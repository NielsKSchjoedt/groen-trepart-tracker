import { useState, useEffect, useMemo, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { InfoTooltip } from '@/components/InfoTooltip';
import { loadDashboardData, loadKommunerGeoJSON, loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects } from '@/lib/data';
import type { DashboardData, KommuneMetrics, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import type { FeatureCollection, Geometry } from 'geojson';
import { MetricPicker } from '@/components/MetricPicker';
import { KommuneTable } from '@/components/KommuneTable';
import { KommuneDetailPanel } from '@/components/KommuneDetailPanel';
import { MobileBottomSheet } from '@/components/MobileBottomSheet';
import { Footer } from '@/components/Footer';
import { StickyNav } from '@/components/StickyNav';
import { usePageMeta } from '@/hooks/usePageMeta';
import { findKommuneBySlug, kommuneToSlug } from '@/lib/kommune-slugs';
import type { KommuneMetric, KommunePhase } from '@/lib/kommune-metrics';
import { DEFAULT_PHASES, filterByPhases } from '@/lib/kommune-metrics';
import { PhaseFilter } from '@/components/PhaseFilter';
import { PILLAR_SLUGS, slugToPillar } from '@/lib/slugs';

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
/** Default metric when the query param is absent or unrecognised. */
const DEFAULT_METRIC: KommuneMetric = 'nitrogen';

export default function KommunePage() {
  const { kommuneSlug } = useParams<{ kommuneSlug: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const heroSentinelRef = useRef<HTMLDivElement>(null);

  const [selectedPhases, setSelectedPhases] = useState<Set<KommunePhase>>(DEFAULT_PHASES);
  const [data, setData] = useState<DashboardData | null>(null);
  const [kommunerGeo, setKommunerGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Derive activeMetric from the URL query param (?metric=kvælstof etc.) so the
  // URL is the single source of truth. Falls back to DEFAULT_METRIC for
  // unknown/missing values. Uses the same Danish slugs as the national pillar routes.
  const activeMetric: KommuneMetric = useMemo(() => {
    const slug = searchParams.get('metric');
    const pillar = slug ? (slugToPillar(slug) as KommuneMetric | null) : null;
    return pillar ?? DEFAULT_METRIC;
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
    ]).then(([d, geo, ksf, nst]) => {
      setData(d);
      if (geo) setKommunerGeo(geo);
      else setLoadError('Kommune-polygoner ikke tilgængelige endnu — kør `mise run build-kommune-map`');
      setKsfProjects(ksf);
      setNstProjects(nst);
    });
  }, []);

  const kommuner: KommuneMetrics[] = useMemo(
    () => data?.national.byKommune ?? [],
    [data],
  );

  /**
   * Phase-filtered view of kommuner. For nitrogen and extraction, always
   * recomputes from byPhase so sketch data is consistently included/excluded.
   * Afforestation, nature, and CO₂ are static (no phase breakdown) and
   * pass through unchanged.
   */
  const kommunerFiltered: KommuneMetrics[] = useMemo(() => {
    return kommuner.map((km) => {
      const { nitrogenT, extractionHa } = filterByPhases(km, selectedPhases);
      return { ...km, nitrogenT, extractionHa };
    });
  }, [kommuner, selectedPhases]);

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
   * Build the ?metric= search string using Danish slugs (e.g. "lavbund"),
   * omitting it entirely for the default metric so URLs stay clean.
   */
  const metricSearch = activeMetric !== DEFAULT_METRIC ? `?metric=${PILLAR_SLUGS[activeMetric]}` : '';

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

  // When user changes the metric, update ?metric= while keeping the path intact.
  const handleMetricChange = (metric: KommuneMetric) => {
    setSearchParams(
      metric !== DEFAULT_METRIC ? { metric: PILLAR_SLUGS[metric] } : {},
      { replace: true },
    );
  };

  // Filter projects for the selected kommune
  const selectedProjectDetails = useMemo(() => {
    if (!selectedKode || !data) return [];
    return data.plans.flatMap((p) =>
      p.projectDetails.filter((pd) => pd.kommuneKode === selectedKode),
    );
  }, [selectedKode, data]);

  const selectedKsfProjects = useMemo(() => {
    if (!selectedKommune) return [];
    return ksfProjects.filter((p) => p.kommune === selectedKommune.navn);
  }, [selectedKommune, ksfProjects]);

  const selectedNstProjects = useMemo(() => {
    if (!selectedKommune) return [];
    return nstProjects.filter((p) => p.kommune === selectedKommune.navn);
  }, [selectedKommune, nstProjects]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* StickyNav — shares the same component as the national view */}
      <StickyNav sentinelRef={heroSentinelRef} />

      {/* Hero */}
      <div className="max-w-6xl mx-auto px-4 pt-10 pb-6">
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
                <p><strong>Data:</strong> Projekter tilknyttes en kommune via DAWA-omvendt geokodning af projekternes centroider. Det betyder at et projekt med areal på tværs af kommunegrænser tilknyttes den kommune, hvor projektets centrum ligger.</p>
                <p><strong>Beskyttet natur</strong> vises som §3 + Natura 2000 areal i kommunen. Centroid-baseret tildeling — sites der strækker sig over kommunegrænser tilknyttes den kommune, der indeholder centroiden. CO₂ er ikke tilgængeligt på kommuneniveau.</p>
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
          <div className="flex items-start gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-sm font-medium text-muted-foreground pt-1.5">
              Vis:
              <InfoTooltip
                title="Metrikker"
                content={
                  <>
                    <p><strong>Kvælstof</strong> — ton N reduceret/år (kollektive virkemidler). Mål: 12.776 T inden 2027.</p>
                    <p><strong>Udtagning</strong> — ha kulstofrig lavbundsjord udtaget fra omdrift. Mål: 140.000 ha inden 2030.</p>
                    <p><strong>Skovrejsning</strong> — ha ny skov (MARS + Klimaskovfonden + Naturstyrelsen). Mål: 250.000 ha inden 2045.</p>
                    <p><strong>Beskyttet natur</strong> — §3 + Natura 2000 areal i kommunen (ha).</p>
                    <p><strong>CO₂</strong> — CO₂-reduktion fra landbrug. Kun opgøres nationalt via KF25.</p>
                  </>
                }
                source="Den Grønne Trepart (2024)"
                size={12}
                side="right"
              />
            </span>
            <MetricPicker activeMetric={activeMetric} onChange={handleMetricChange} />
          </div>

          {/* Phase filter — only meaningful for nitrogen and extraction */}
          {(activeMetric === 'nitrogen' || activeMetric === 'extraction') && (
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-xs font-medium text-muted-foreground">Faser:</span>
              <PhaseFilter selected={selectedPhases} onChange={setSelectedPhases} />
            </div>
          )}
        </div>

        {/* Map + optional desktop detail panel */}
        <section id="kort" aria-label="Danmarkskort med kommuner">
          {/* Colour legend — shown above the map */}
          <KommuneLegend activeMetric={activeMetric} />

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
              <div className={`transition-all ${panelOpen ? 'w-full md:w-3/5' : 'w-full'}`}>
                <Suspense fallback={
                  <div className="rounded-2xl border border-border bg-muted/10 flex items-center justify-center" style={{ height: '520px' }}>
                    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                }>
                  <KommuneMap
                    kommunerGeo={kommunerGeo}
                    metrics={kommunerFiltered}
                    activeMetric={activeMetric}
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
                    ksfProjects={selectedKsfProjects}
                    nstProjects={selectedNstProjects}
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
            ksfProjects={selectedKsfProjects}
            nstProjects={selectedNstProjects}
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
  // CO₂ data is not disaggregated at municipality level — show only no-data entry.
  co2: [
    { color: 'hsl(0 0% 92%)', label: 'Ingen kommunedata tilgængeligt' },
  ],
};

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
