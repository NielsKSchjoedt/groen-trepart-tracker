import { useEffect, useState, useMemo } from 'react';
import { loadDashboardData } from '@/lib/data';
import type { DashboardData } from '@/lib/types';
import { PillarContext, getPillarConfig, PILLAR_CONFIGS } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import { HeroSection } from '@/components/HeroSection';
import { PillarCards } from '@/components/PillarCards';
import { ProjectFunnel } from '@/components/ProjectFunnel';
import { CO2Section } from '@/components/CO2Section';
import { DenmarkMap } from '@/components/DenmarkMap';
import { DataTable } from '@/components/DataTable';
import { DataSourceSection } from '@/components/DataSourceSection';
import { Footer } from '@/components/Footer';

const Index = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activePillar, setActivePillar] = useState<PillarId>('nitrogen');

  const pillarContextValue = useMemo(() => ({
    activePillar,
    setActivePillar,
    config: getPillarConfig(activePillar),
  }), [activePillar]);

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
