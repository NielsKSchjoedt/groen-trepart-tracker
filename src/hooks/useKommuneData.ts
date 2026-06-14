import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  loadDashboardData,
  ensureDashboardProjectDetails,
  loadKommunerGeoJSON,
  loadKlimaskovfondenProjects,
  loadNaturstyrelsenSkovProjects,
  loadKlimaregnskabData,
  loadKommuneBenchmarkData,
  loadKommuneRanking,
  loadKommuneOplande,
  loadKommuneTrepartLinks,
  loadNationalFordelingSimulation,
} from '@/lib/data';
import type {
  DashboardData,
  KommuneMetrics,
  KlimaskovfondenProject,
  NaturstyrelsenSkovProject,
  KlimaregnskabData,
  KommuneBenchmarkData,
  KommuneRankingData,
  KommuneOplandeData,
  KommuneTrepartLinksData,
  NationalFordelingSimulation,
} from '@/lib/types';
import type { FeatureCollection, Geometry } from 'geojson';
import { findKommuneBySlug } from '@/lib/kommune-slugs';

export interface KommuneDataBundle {
  data: DashboardData | null;
  kommunerGeo: FeatureCollection<Geometry> | null;
  ksfProjects: KlimaskovfondenProject[];
  nstProjects: NaturstyrelsenSkovProject[];
  klimaregnskab: KlimaregnskabData | null;
  kommuneBenchmark: KommuneBenchmarkData | null;
  kommuneRanking: KommuneRankingData | null;
  kommuneOplande: KommuneOplandeData | null;
  trepartLinks: KommuneTrepartLinksData | null;
  fordelingSimulation: NationalFordelingSimulation | null;
  loadError: string | null;
}

async function fetchKommuneBundle(): Promise<KommuneDataBundle> {
  const [dashboard, geo, ksf, nst, kr, benchmark, ranking, oplande, trepart, fordeling] = await Promise.all([
    loadDashboardData(),
    loadKommunerGeoJSON().catch(() => null),
    loadKlimaskovfondenProjects(),
    loadNaturstyrelsenSkovProjects(),
    loadKlimaregnskabData(),
    loadKommuneBenchmarkData(),
    loadKommuneRanking(),
    loadKommuneOplande(),
    loadKommuneTrepartLinks(),
    loadNationalFordelingSimulation(),
  ]);

  return {
    data: dashboard,
    kommunerGeo: geo,
    ksfProjects: ksf,
    nstProjects: nst,
    klimaregnskab: kr,
    kommuneBenchmark: benchmark,
    kommuneRanking: ranking,
    kommuneOplande: oplande,
    trepartLinks: trepart,
    fordelingSimulation: fordeling,
    loadError: geo ? null : 'Kommune-polygoner ikke tilgængelige endnu — kør `mise run build-kommune-map`',
  };
}

/**
 * Shared data loader for `/kommuner` and `/kommuner/:slug`.
 * Caches via React Query so direct detail-page loads reuse the same bundle.
 */
export function useKommuneData() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['kommune-data'],
    queryFn: fetchKommuneBundle,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    ensureDashboardProjectDetails().then((full) => {
      if (!full) return;
      queryClient.setQueryData<KommuneDataBundle>(['kommune-data'], (prev) =>
        prev ? { ...prev, data: full } : prev,
      );
    });
  }, [queryClient]);

  return {
    ...query.data,
    data: query.data?.data ?? null,
    kommunerGeo: query.data?.kommunerGeo ?? null,
    ksfProjects: query.data?.ksfProjects ?? [],
    nstProjects: query.data?.nstProjects ?? [],
    klimaregnskab: query.data?.klimaregnskab ?? null,
    kommuneBenchmark: query.data?.kommuneBenchmark ?? null,
    kommuneRanking: query.data?.kommuneRanking ?? null,
    kommuneOplande: query.data?.kommuneOplande ?? null,
    trepartLinks: query.data?.trepartLinks ?? null,
    fordelingSimulation: query.data?.fordelingSimulation ?? null,
    loadError: query.data?.loadError ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

/** Resolve slug → KommuneMetrics from loaded dashboard data. */
export function useSelectedKommune(
  slug: string | undefined,
  kommuner: KommuneMetrics[],
): KommuneMetrics | null {
  if (!slug || kommuner.length === 0) return null;
  return findKommuneBySlug(slug, kommuner) ?? null;
}
