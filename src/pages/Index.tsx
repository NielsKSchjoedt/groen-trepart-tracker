import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { loadDashboardData } from '@/lib/data';
import type { DashboardData } from '@/lib/types';
import { PillarContext, getPillarConfig } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { slugToPillar, pillarToSlug } from '@/lib/slugs';
import { usePageMeta } from '@/hooks/usePageMeta';
import { HeroSection } from '@/components/HeroSection';
import { RecentActivity } from '@/components/RecentActivity';
import { PillarCards } from '@/components/PillarCards';
import { ProjectFunnel } from '@/components/ProjectFunnel';
import { CO2Section } from '@/components/CO2Section';
import { DenmarkMap } from '@/components/DenmarkMap';
import { DataTable } from '@/components/DataTable';
import { DataSourceSection } from '@/components/DataSourceSection';
import { Footer } from '@/components/Footer';

/** Per-pillar meta descriptions for Google and social sharing. */
const PILLAR_DESCRIPTIONS: Record<PillarId, string> = {
  nitrogen:
    'Følg Danmarks kvælstofreduktion i vandmiljøet. Se fremskridt mod 13.780 ton N/år-målet opdelt på kystvandoplande og vandoplande.',
  extraction:
    'Følg udtaget af kulstofrige lavbundsjorde i Danmark. Se fremskridt mod 140.000 ha-målet opdelt på vandoplande.',
  afforestation:
    'Følg skovrejsningen i Danmark. Se fremskridt mod 250.000 ha ny skov inden 2045 opdelt på vandoplande.',
  co2:
    'Følg Danmarks CO₂-udledning og fremskridt mod 70 % reduktion i 2030. Data fra KF25 (Klimastatus og -fremskrivning 2025).',
  nature:
    'Følg beskyttet natur i Danmark. Se fremskridt mod 20 %-målet for beskyttet natur inden 2030 opdelt på vandoplande.',
};

const Index = () => {
  const { pillarSlug } = useParams<{ pillarSlug: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);

  // Derive the active pillar from the URL slug. Default to nitrogen for
  // any unrecognised slug (the effect below redirects unknown slugs away).
  const activePillar: PillarId = slugToPillar(pillarSlug) ?? 'nitrogen';
  const config = getPillarConfig(activePillar);

  // Redirect unknown pillar slugs to /kvælstof
  useEffect(() => {
    if (pillarSlug && !slugToPillar(pillarSlug)) {
      navigate('/kvælstof', { replace: true });
    }
  }, [pillarSlug, navigate]);

  /**
   * Navigate to a different pillar.
   * Navigating to a new path intentionally drops all search params (panel
   * state, map layer) so the new pillar starts clean.
   */
  const setActivePillar = useCallback(
    (id: PillarId) => navigate(`/${pillarToSlug(id)}`),
    [navigate],
  );

  const pillarContextValue = useMemo(
    () => ({ activePillar, setActivePillar, config }),
    [activePillar, setActivePillar, config],
  );

  // Update document.title, OG tags, and canonical link for the active pillar
  usePageMeta({
    title: config.label,
    description: PILLAR_DESCRIPTIONS[activePillar],
    path: `/${pillarToSlug(activePillar)}`,
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

  return (
    <PillarContext.Provider value={pillarContextValue}>
      <div
        className="min-h-screen transition-colors duration-400"
        style={{ backgroundColor: pillarContextValue.config.backgroundTint }}
      >
        <div className="max-w-6xl mx-auto">
          <HeroSection data={data} />
          <RecentActivity />
          <PillarCards data={data} />
          {activePillar !== 'co2' && <ProjectFunnel data={data} />}
          {activePillar === 'co2' && (
            <section className="w-full px-4 py-6">
              <CO2Section />
            </section>
          )}
          <DenmarkMap data={data} />
          <DataTable plans={data.plans} />
          <DataSourceSection fetchedAt={data.fetchedAt} />
        </div>
        <Footer fetchedAt={data.fetchedAt} />
      </div>
    </PillarContext.Provider>
  );
};

export default Index;
