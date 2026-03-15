import { useEffect, useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import { loadDashboardData } from '@/lib/data';
import type { DashboardData } from '@/lib/types';
import { PillarContext, getPillarConfig, PILLAR_CONFIGS } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { slugToPillar, pillarToSlug } from '@/lib/slugs';
import { usePageMeta } from '@/hooks/usePageMeta';
import { HeroSection } from '@/components/HeroSection';
import { PillarCards } from '@/components/PillarCards';
import { ProjectFunnel } from '@/components/ProjectFunnel';
import { DataSourceSection } from '@/components/DataSourceSection';
import { ScenarioBuilderSection } from '@/components/ScenarioBuilderSection';
import { Footer } from '@/components/Footer';
import { ScrollPrompt } from '@/components/ScrollPrompt';
import { StickyNav } from '@/components/StickyNav';
import { LastUpdatedBadge } from '@/components/LastUpdatedBadge';

// Heavy components lazy-loaded so they split into separate JS chunks.
// Leaflet (~300 kB) and Recharts (~200 kB) are the main contributors.
const CO2Section  = lazy(() => import('@/components/CO2Section').then((m) => ({ default: m.CO2Section })));
const DenmarkMap  = lazy(() => import('@/components/DenmarkMap').then((m) => ({ default: m.DenmarkMap })));
const DataTable   = lazy(() => import('@/components/DataTable').then((m) => ({ default: m.DataTable })));

/** Per-pillar meta descriptions for Google and social sharing. */
const PILLAR_DESCRIPTIONS: Record<PillarId, string> = {
  nitrogen:
    'Følg Danmarks kvælstofreduktion i vandmiljøet. Se fremskridt mod 12.776 ton N/år-målet (kollektive virkemidler) opdelt på kystvandoplande og vandoplande.',
  extraction:
    'Følg udtaget af kulstofrige lavbundsjorde i Danmark. Se fremskridt mod 140.000 ha-målet opdelt på vandoplande.',
  afforestation:
    'Følg skovrejsningen i Danmark. Se fremskridt mod 250.000 ha ny skov inden 2045 opdelt på vandoplande.',
  co2:
    'Følg Danmarks CO₂-udledning og fremskridt mod 70 % reduktion i 2030. Data fra KF25 (Klimastatus og -fremskrivning 2025).',
  nature:
    'Følg beskyttet natur i Danmark. Se fremskridt mod 20 %-målet for beskyttet natur inden 2030 opdelt på vandoplande.',
};

const OVERVIEW_DESCRIPTION =
  'Dashboard der følger implementeringen af Danmarks Grønne Trepart-aftale — kvælstofreduktion, lavbundsarealer, skovrejsning, CO₂ og natur.';

const Index = () => {
  const { pillarSlug } = useParams<{ pillarSlug: string }>();
  const navigate = useNavigate();
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DashboardData | null>(null);

  // null when on the root "/" overview page; a resolved PillarId on slug routes.
  const activePillar: PillarId | null = pillarSlug ? (slugToPillar(pillarSlug) ?? null) : null;

  // Neutral fallback config used when no pillar is selected. Avoids null
  // propagation into components that always expect a valid PillarConfig.
  const config = activePillar ? getPillarConfig(activePillar) : PILLAR_CONFIGS[0];

  // Whether the detail sections (funnel, map, table, etc.) should render.
  const pillarSelected = activePillar !== null;

  // Redirect unrecognised slug paths back to the overview root.
  useEffect(() => {
    if (pillarSlug && !slugToPillar(pillarSlug)) {
      navigate('/', { replace: true });
    }
  }, [pillarSlug, navigate]);

  /**
   * Navigate to a different pillar.
   * Navigating to a new path drops all search params (panel state, map layer)
   * so the new pillar always starts clean.
   */
  const setActivePillar = useCallback(
    (id: PillarId) => navigate(`/${pillarToSlug(id)}`),
    [navigate],
  );

  const pillarContextValue = useMemo(
    () => ({ activePillar, setActivePillar, config }),
    [activePillar, setActivePillar, config],
  );

  // Update document.title, OG tags, and canonical link for the active view.
  usePageMeta({
    title: activePillar ? config.label : 'Oversigt',
    description: activePillar ? PILLAR_DESCRIPTIONS[activePillar] : OVERVIEW_DESCRIPTION,
    path: activePillar ? `/${pillarToSlug(activePillar)}` : '/',
  });

  useEffect(() => {
    loadDashboardData().then(setData);
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Indlæser data...</p>
      </div>
    );
  }

  const backgroundTint = pillarSelected ? config.backgroundTint : 'hsl(0 0% 96%)';

  return (
    <PillarContext.Provider value={pillarContextValue}>
      <div
        className="relative min-h-screen transition-colors duration-400"
        style={{ backgroundColor: backgroundTint }}
      >
        <StickyNav sentinelRef={heroSentinelRef} />
        <LastUpdatedBadge fetchedAt={data.fetchedAt} />
        <div className="max-w-6xl mx-auto">
          <HeroSection data={data} />
          {/* Sentinel: StickyNav watches this — slides in once hero scrolls out of view */}
          <div ref={heroSentinelRef} />
          <ScrollPrompt />
          <div id="oversigt">
            <PillarCards data={data} />
          </div>

          {/* Overview prompt — only shown when no pillar is selected */}
          {!pillarSelected && (
            <section className="w-full max-w-5xl mx-auto px-4 pb-20 pt-4">
              <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border/70 py-12 px-6 bg-card/40 text-center">
                <div className="w-10 h-10 rounded-full bg-muted border border-border/50 flex items-center justify-center">
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
                  Vælg et delmål for at dykke ned i detaljerne
                </p>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  Klik på et af de fem delmålskort ovenfor for at udforske projektpipeline, Danmarkskort, tabeller og fremskrivninger
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {PILLAR_CONFIGS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActivePillar(p.id)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:scale-105 hover:shadow-sm"
                      style={{
                        borderColor: p.accentColor + '50',
                        color: p.accentColor,
                        backgroundColor: p.accentColor + '10',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Detail sections — only rendered once a pillar is selected */}
          {pillarSelected && (
            <>
              {activePillar !== 'co2' && <ProjectFunnel data={data} />}
              <ScenarioBuilderSection data={data} />
              {activePillar === 'co2' && (
                <section className="w-full px-4 py-6">
                  <Suspense fallback={<div className="h-64 animate-pulse bg-muted/30 rounded-xl mx-4" />}>
                    <CO2Section />
                  </Suspense>
                </section>
              )}
              <div id="kort">
                <Suspense fallback={<div className="h-[580px] animate-pulse bg-muted/30 rounded-2xl mx-4 my-10" />}>
                  <DenmarkMap data={data} />
                </Suspense>
              </div>
              <div id="tabeller">
                <Suspense fallback={<div className="h-64 animate-pulse bg-muted/30 rounded-xl mx-4 my-10" />}>
                  <DataTable plans={data.plans} data={data} />
                </Suspense>
              </div>
              <DataSourceSection fetchedAt={data.fetchedAt} />
            </>
          )}
        </div>
        <Footer fetchedAt={data.fetchedAt} />
      </div>
    </PillarContext.Provider>
  );
};

export default Index;
