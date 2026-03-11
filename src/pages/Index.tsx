import { useEffect, useState } from 'react';
import { loadDashboardData } from '@/lib/data';
import type { DashboardData } from '@/lib/types';
import { HeroSection } from '@/components/HeroSection';
import { MetricCards } from '@/components/MetricCards';
import { ProjectFunnel } from '@/components/ProjectFunnel';
import { DenmarkMap } from '@/components/DenmarkMap';
import { DataTable } from '@/components/DataTable';
import { DataSourceSection } from '@/components/DataSourceSection';
import { Footer } from '@/components/Footer';

const Index = () => {
  const [data, setData] = useState<DashboardData | null>(null);

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
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto">
        <HeroSection data={data} />
        <MetricCards data={data} />
        <ProjectFunnel data={data} />
        <DenmarkMap data={data} />
        <DataTable plans={data.plans} />
        <DataSourceSection fetchedAt={data.fetchedAt} />
      </div>
      <Footer fetchedAt={data.fetchedAt} />
    </div>
  );
};

export default Index;
