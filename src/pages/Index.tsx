import { useEffect, useState, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronUp } from 'lucide-react';
import {
  loadDashboardData,
  ensureDashboardProjectDetails,
  loadKlimaskovfondenProjects,
  loadNaturstyrelsenSkovProjects,
} from '@/lib/data';
import type { DashboardData, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import { PillarContext, getPillarConfig, PILLAR_CONFIGS } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { slugToPillar, pillarToSlug } from '@/lib/slugs';
import { usePageMeta } from '@/hooks/usePageMeta';
import { HeroSection } from '@/components/HeroSection';
import { OekonomiOverblik } from '@/components/oekonomi/OekonomiOverblik';
import { OekonomiDelmaal } from '@/components/oekonomi/OekonomiDelmaal';
import { OekonomiFootnote } from '@/components/oekonomi/OekonomiFootnote';
import { ChapterSection } from '@/components/ChapterSection';
import {
  getGeografiIntro,
  OEKONOMI_CHAPTER,
  OEKONOMI_INTRO,
  PROJEKTER_CHAPTER,
  FREMSKRIVNING_CHAPTER,
  GEOGRAFI_CHAPTER,
  CO2DATA_CHAPTER,
} from '@/lib/chapters';
import { ProjectsSection } from '@/components/ProjectsSection';
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
    'Kort og status over Danmarks kvælstofreduktion i vandmiljøet. Følg fremskridt mod 12.776 ton N/år-målet opdelt på kystvandoplande og vandoplande.',
  extraction:
    'Kort og status over udtagning af lavbundsjord i Danmark. Følg reetablering og udtagning af lavbundsarealer mod 140.000 ha-målet.',
  afforestation:
    'Kort og status over skovrejsning i Danmark. Se fremskridt mod 250.000 ha ny skov inden 2045 opdelt på vandoplande.',
  co2:
    'Kort og status over Danmarks CO₂-udledning og fremskridt mod 70 % reduktion i 2030. Data fra KF25 (Klimastatus og -fremskrivning 2025).',
  nature:
    'Kort og status over beskyttet natur i Danmark. Se fremskridt mod 20 %-målet for beskyttet natur inden 2030.',
};

const OVERVIEW_DESCRIPTION =
  'Kort og status over implementeringen af Danmarks Grønne Trepart-aftale — kvælstofreduktion, lavbundsarealer, skovrejsning, CO₂ og natur.';

const Index = () => {
  const { pillarSlug } = useParams<{ pillarSlug: string }>();
  const navigate = useNavigate();
  const heroSentinelRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);

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
    ensureDashboardProjectDetails().then(setData);
    loadKlimaskovfondenProjects().then(setKsfProjects);
    loadNaturstyrelsenSkovProjects().then(setNstProjects);
  }, []);

  const allProjects = useMemo(
    () => data?.plans.flatMap((p) => p.projectDetails) ?? [],
    [data],
  );

  /**
   * MARS projects filtered to those relevant for the active pillar.
   * Mirrors the logic in ProjectFunnel's computePillarProjects: only
   * projects with a positive effect in the pillar's key metric are included.
   * For "nature" all projects are shown; for "co2" the chart is hidden.
   */
  const pillarProjects = useMemo(() => {
    const effectField: Record<string, keyof typeof allProjects[0]> = {
      nitrogen: 'nitrogenT',
      extraction: 'extractionHa',
      afforestation: 'afforestationHa',
    };
    const field = activePillar ? effectField[activePillar] : undefined;
    if (!field) return allProjects;
    return allProjects.filter((p) => ((p as Record<string, unknown>)[field as string] as number) > 0);
  }, [allProjects, activePillar]);

  /**
   * KSF projects filtered by active pillar:
   *   extraction    → only "Lavbund" type
   *   afforestation → only "Skovrejsning" type
   *   other         → empty (KSF not relevant)
   */
  const pillarKsfProjects = useMemo(() => {
    if (activePillar === 'extraction') return ksfProjects.filter((p) => p.projekttyp === 'Lavbund');
    if (activePillar === 'afforestation') return ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning');
    return [];
  }, [ksfProjects, activePillar]);

  /** NST projects are only relevant for the afforestation pillar. */
  const pillarNstProjects = useMemo(
    () => activePillar === 'afforestation' ? nstProjects : [],
    [nstProjects, activePillar],
  );

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
          <HeroSection data={data} heroSentinelRef={heroSentinelRef} />
          <ScrollPrompt />

          {/* The "delmaal" chapter (de fem løfter) now lives inside HeroSection. */}

          {/* Overview: short narrative — løfter → økonomi → prompt */}
          {!pillarSelected && (
            <>
              <ChapterSection
                id={OEKONOMI_CHAPTER.id}
                eyebrow={OEKONOMI_CHAPTER.eyebrow}
                question={OEKONOMI_CHAPTER.question}
                intro={OEKONOMI_INTRO}
              >
                <OekonomiOverblik budget={data.national.budgetData} />
                <OekonomiFootnote
                  kilde={data.national.budgetData?._meta.kilde}
                  opdateret={data.national.budgetData?._meta.opdateret}
                />
              </ChapterSection>

              <section className="w-full max-w-5xl mx-auto px-4 pb-20 pt-6">
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
                        className="text-xs font-semibold px-3 py-1.5 rounded-full border transition-all hover:scale-105 hover:shadow-sm cursor-pointer"
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
            </>
          )}

          {/* Pillar narrative — chapters appear once a delmål is selected */}
          {pillarSelected && (
            <>
              {/* Chapter: Hvad gør vi konkret? — forstå projekterne */}
              {activePillar !== 'co2' && (
                <ChapterSection
                  id={PROJEKTER_CHAPTER.id}
                  eyebrow={PROJEKTER_CHAPTER.eyebrow}
                  question={PROJEKTER_CHAPTER.question}
                  accentColor={config.accentColor}
                  intro="De udfordringer aftalen skal løse, bliver til konkrete projekter — vådområder, skovrejsning og lavbundsudtag — der styres gennem en fast proces. Her kan du følge hvor mange projekter der er, hvor store de er, og hvilken fase de er nået til: fra første skitse til færdigt anlæg."
                >
                  <ProjectsSection
                    data={data}
                    activePillar={activePillar as Exclude<PillarId, 'co2'>}
                    pillarProjects={pillarProjects}
                    pillarKsfProjects={pillarKsfProjects}
                    pillarNstProjects={pillarNstProjects}
                  />
                </ChapterSection>
              )}

              {/* Chapter: CO₂-data (co2 pillar only) */}
              {activePillar === 'co2' && (
                <ChapterSection
                  id={CO2DATA_CHAPTER.id}
                  eyebrow={CO2DATA_CHAPTER.eyebrow}
                  question={CO2DATA_CHAPTER.question}
                  accentColor={config.accentColor}
                >
                  <section className="w-full px-4 py-2">
                    <Suspense fallback={<div className="h-64 animate-pulse bg-muted/30 rounded-xl mx-4" />}>
                      <CO2Section />
                    </Suspense>
                  </section>
                  <ScenarioBuilderSection data={data} />
                </ChapterSection>
              )}

              {/* Chapter: Hvor i Danmark sker det? — kort + tabeller */}
              {activePillar !== 'co2' && (
                <ChapterSection
                  id={GEOGRAFI_CHAPTER.id}
                  eyebrow={GEOGRAFI_CHAPTER.eyebrow}
                  question={GEOGRAFI_CHAPTER.question}
                  accentColor={config.accentColor}
                  intro={getGeografiIntro(activePillar)}
                >
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
                </ChapterSection>
              )}

              {/* Chapter: Når vi det i tide? — fremskrivning */}
              {activePillar !== 'co2' && (
                <ChapterSection
                  id={FREMSKRIVNING_CHAPTER.id}
                  eyebrow={FREMSKRIVNING_CHAPTER.eyebrow}
                  question={FREMSKRIVNING_CHAPTER.question}
                  accentColor={config.accentColor}
                >
                  <ScenarioBuilderSection data={data} />
                </ChapterSection>
              )}

              {/* Chapter: Har vi råd til det? — budget */}
              <ChapterSection
                id={OEKONOMI_CHAPTER.id}
                eyebrow={OEKONOMI_CHAPTER.eyebrow}
                question={OEKONOMI_CHAPTER.question}
                accentColor={config.accentColor}
                intro={`${OEKONOMI_INTRO} Nedenfor kan du også se finansiering for det delmål, du har valgt.`}
              >
                <OekonomiOverblik budget={data.national.budgetData} />
                <OekonomiDelmaal budget={data.national.budgetData} />
                <OekonomiFootnote
                  kilde={data.national.budgetData?._meta.kilde}
                  opdateret={data.national.budgetData?._meta.opdateret}
                />
              </ChapterSection>

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
