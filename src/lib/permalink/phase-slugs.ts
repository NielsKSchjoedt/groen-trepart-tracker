import type { ProjectPhase } from '@/lib/phase-config';

/** URL slug ↔ ProjectPhase (shared with kommune map). */
export const PHASE_SLUG: Record<ProjectPhase, string> = {
  sketch: 'skitse',
  preliminary: 'foru',
  approved: 'godk',
  established: 'anlagt',
};

export const PHASE_FROM_SLUG = Object.fromEntries(
  Object.entries(PHASE_SLUG).map(([phase, slug]) => [slug, phase]),
) as Record<string, ProjectPhase>;

const PHASE_ORDER: ProjectPhase[] = ['sketch', 'preliminary', 'approved', 'established'];

export function phasesToSlugList(phases: Set<ProjectPhase>): string {
  return PHASE_ORDER.filter((p) => phases.has(p)).map((p) => PHASE_SLUG[p]).join(',');
}

export function phasesFromSlugList(raw: string | null, fallback: Set<ProjectPhase>): Set<ProjectPhase> {
  if (!raw) return new Set(fallback);
  const parsed = raw
    .split(',')
    .map((s) => PHASE_FROM_SLUG[s.trim()])
    .filter(Boolean) as ProjectPhase[];
  return parsed.length > 0 ? new Set(parsed) : new Set(fallback);
}

export function phasesEqual(a: Set<ProjectPhase>, b: Set<ProjectPhase>): boolean {
  if (a.size !== b.size) return false;
  for (const p of a) if (!b.has(p)) return false;
  return true;
}
