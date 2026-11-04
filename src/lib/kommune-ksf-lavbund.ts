import type { KlimaskovfondenProject, KommuneMetrics } from '@/lib/types';

/** Attach per-kommune KSF lavbund ha from project list when ETL field is missing. */
export function enrichKommunerWithKsfLavbund(
  kommuner: KommuneMetrics[],
  ksfProjects: KlimaskovfondenProject[],
): KommuneMetrics[] {
  const byNavn = new Map<string, number>();
  for (const project of ksfProjects) {
    if (project.projekttyp !== 'Lavbund' || !project.kommune) continue;
    byNavn.set(project.kommune, (byNavn.get(project.kommune) ?? 0) + (project.areaHa ?? 0));
  }

  return kommuner.map((km) => ({
    ...km,
    extractionKsfHa:
      km.extractionKsfHa ?? Math.round((byNavn.get(km.navn) ?? 0) * 10) / 10,
  }));
}
