import type { ChangelogEntry, Plan, ProjectChangelog, ProjectDetail } from '@/lib/types';

const MOMENTUM_DAYS = 180;
const MILEPAELE_COUNT = 5;
const NAME_MAX_LEN = 30;

export interface ProjectDetailsFile {
  plans: Array<Pick<Plan, 'id' | 'name'> & { projectDetails: ProjectDetail[] }>;
}

export interface KommuneProcesMetrics {
  kommune: string;
  projekter: number;
  ha: number;
  faser: { preliminary: number; approved: number; established: number };
  godkendtPlus: number;
  momentum6mdr: { projekter: number; ha: number };
  medianMdr: { preliminary: number | null; approved: number | null };
  mix: { measure: string; pct: number }[];
  milepaele: { dato: string; label: string; navn: string; measure: string; phase: ProjectDetail['phase'] }[];
  naboer: string[];
}

type ProjectPhase = ProjectDetail['phase'];
type MeasureGroup = 'skov' | 'lavbund/vådområde' | 'ekstensivering' | 'andet/natur';

function isCancelledProject(project: ProjectDetail): boolean {
  return project.isCancelled === true || project.pipelinePhase === 'cancelled';
}

/** Group mitigation measure names into coarse mix buckets. */
export function groupMeasureMix(measureName: string): MeasureGroup {
  const n = measureName.toLowerCase();
  if (n.includes('skov')) return 'skov';
  if (
    n.includes('lavbund')
    || n.includes('vådområde')
    || n.includes('vaadomraade')
    || n.includes('fosfor')
  ) {
    return 'lavbund/vådområde';
  }
  if (n.includes('ekstensiv')) return 'ekstensivering';
  return 'andet/natur';
}

/** Short Danish label for milestone status tags. */
export function shortMilestoneLabel(statusName: string, phase: ProjectPhase): string {
  const s = statusName.toLowerCase();
  if (phase === 'established' || s.includes('anlagt')) return 'Anlagt';
  if (s.includes('etablering') || phase === 'approved') return 'Etableringstilsagn';
  if (s.includes('forundersøg') || phase === 'preliminary') return 'Forundersøgelse';
  return statusName.length > 24 ? `${statusName.slice(0, 21)}…` : statusName;
}

/** Danish short date for timeline pills (e.g. "12. jun. 2026"). */
export function formatProcesDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
}

function trimProjectName(name: string): string {
  if (name.length <= NAME_MAX_LEN) return name;
  return `${name.slice(0, NAME_MAX_LEN - 1)}…`;
}

/** Round phase ha-shares to integers summing to exactly 100; remainder on preliminary. */
export function roundPhasePcts(
  preliminary: number,
  approved: number,
  established: number,
): { preliminary: number; approved: number; established: number } {
  if (preliminary === 0 && approved === 0 && established === 0) {
    return { preliminary: 0, approved: 0, established: 0 };
  }
  const pre = Math.round(preliminary);
  const app = Math.round(approved);
  const est = Math.round(established);
  const sum = pre + app + est;
  return {
    preliminary: pre + (100 - sum),
    approved: app,
    established: est,
  };
}

function monthsBetween(later: Date, earlier: Date): number {
  return (later.getFullYear() - earlier.getFullYear()) * 12
    + (later.getMonth() - earlier.getMonth());
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function buildChangelogByProjectId(changelog: ProjectChangelog | null | undefined): Map<string, ChangelogEntry> {
  const map = new Map<string, ChangelogEntry>();
  if (!changelog) return map;
  for (const group of changelog.byDate) {
    for (const entry of group.entries) {
      if (!map.has(entry.projectId)) map.set(entry.projectId, entry);
    }
  }
  return map;
}

function collectAllProjects(data: ProjectDetailsFile): ProjectDetail[] {
  const out: ProjectDetail[] = [];
  for (const plan of data.plans) {
    for (const project of plan.projectDetails) {
      if (!isCancelledProject(project)) out.push(project);
    }
  }
  return out;
}

function filterKommuneProjects(projects: ProjectDetail[], kommuneNavn: string): ProjectDetail[] {
  return projects.filter((p) => p.kommuneNavn === kommuneNavn);
}

function computeNeighbors(
  data: ProjectDetailsFile,
  kommuneNavn: string,
): string[] {
  const planIdsWithKommune = new Set<string>();
  for (const plan of data.plans) {
    const hasTarget = plan.projectDetails.some(
      (p) => !isCancelledProject(p) && p.kommuneNavn === kommuneNavn,
    );
    if (hasTarget) planIdsWithKommune.add(plan.id);
  }

  const neighborSet = new Set<string>();
  for (const plan of data.plans) {
    if (!planIdsWithKommune.has(plan.id)) continue;
    for (const p of plan.projectDetails) {
      if (!isCancelledProject(p) && p.kommuneNavn && p.kommuneNavn !== kommuneNavn) {
        neighborSet.add(p.kommuneNavn);
      }
    }
  }

  return [...neighborSet].sort((a, b) => a.localeCompare(b, 'da'));
}

/**
 * Date of the most recent detected phase activity for a project.
 * Prefers changelog entry when available; otherwise falls back to lastChanged
 * (an approximation — lastChanged may reflect non-phase metadata updates).
 */
function transitionDate(
  project: ProjectDetail,
  changelogById: Map<string, ChangelogEntry>,
): Date {
  const entry = changelogById.get(project.id);
  if (entry) return new Date(entry.date);
  return new Date(project.lastChanged);
}

function computeMetricsFromProjects(
  kommuneNavn: string,
  projects: ProjectDetail[],
  naboer: string[],
  now: Date,
  changelogById: Map<string, ChangelogEntry>,
): KommuneProcesMetrics {
  const totalHa = projects.reduce((sum, p) => sum + (p.areaHa ?? 0), 0);
  const phaseHa: Record<ProjectPhase, number> = {
    preliminary: 0,
    approved: 0,
    established: 0,
  };

  for (const p of projects) {
    phaseHa[p.phase] += p.areaHa ?? 0;
  }

  const faser = totalHa > 0
    ? roundPhasePcts(
        (phaseHa.preliminary / totalHa) * 100,
        (phaseHa.approved / totalHa) * 100,
        (phaseHa.established / totalHa) * 100,
      )
    : { preliminary: 0, approved: 0, established: 0 };

  const godkendtPlus = faser.approved + faser.established;

  const momentumCutoff = new Date(now);
  momentumCutoff.setDate(momentumCutoff.getDate() - MOMENTUM_DAYS);

  let momentumProjekter = 0;
  let momentumHa = 0;
  for (const p of projects) {
    const movedAt = transitionDate(p, changelogById);
    if (movedAt >= momentumCutoff) {
      momentumProjekter += 1;
      momentumHa += p.areaHa ?? 0;
    }
  }

  // Median time-in-phase uses appliedAt (ansøgningsdato). Changelog only covers ~30 days
  // and does not carry full phase-entry history for most projects.
  const preMonths: number[] = [];
  const appMonths: number[] = [];
  for (const p of projects) {
    const months = monthsBetween(now, new Date(p.appliedAt));
    if (p.phase === 'preliminary') preMonths.push(months);
    if (p.phase === 'approved') appMonths.push(months);
  }

  const mixHa = new Map<MeasureGroup, number>();
  for (const p of projects) {
    const group = groupMeasureMix(p.measureName);
    mixHa.set(group, (mixHa.get(group) ?? 0) + (p.areaHa ?? 0));
  }
  const mix = [...mixHa.entries()]
    .map(([measure, ha]) => ({
      measure,
      pct: totalHa > 0 ? Math.round((ha / totalHa) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  const milepaele = projects
    .map((p) => {
      const entry = changelogById.get(p.id);
      const iso = entry?.date ?? p.lastChanged;
      const phase = entry?.phase ?? p.phase;
      return {
        iso,
        dato: formatProcesDate(iso),
        label: entry?.phaseLabelDa ?? shortMilestoneLabel(p.statusName, phase),
        navn: trimProjectName(p.name),
        measure: p.measureName,
        phase,
      };
    })
    .sort((a, b) => new Date(b.iso).getTime() - new Date(a.iso).getTime())
    .slice(0, MILEPAELE_COUNT)
    .map(({ dato, label, navn, measure, phase }) => ({ dato, label, navn, measure, phase }));

  return {
    kommune: kommuneNavn,
    projekter: projects.length,
    ha: Math.round(totalHa),
    faser,
    godkendtPlus,
    momentum6mdr: {
      projekter: momentumProjekter,
      ha: Math.round(momentumHa),
    },
    medianMdr: {
      preliminary: median(preMonths),
      approved: median(appMonths),
    },
    mix,
    milepaele,
    naboer,
  };
}

export function computeKommuneProces(
  data: ProjectDetailsFile,
  kommuneNavn: string,
  now: Date = new Date(),
  changelog?: ProjectChangelog | null,
): KommuneProcesMetrics {
  const all = collectAllProjects(data);
  const projects = filterKommuneProjects(all, kommuneNavn);
  const naboer = computeNeighbors(data, kommuneNavn);
  const changelogById = buildChangelogByProjectId(changelog);
  return computeMetricsFromProjects(kommuneNavn, projects, naboer, now, changelogById);
}

/** National-level proces metrics (all non-cancelled projects). */
export function computeNationalProces(
  data: ProjectDetailsFile,
  now: Date = new Date(),
  changelog?: ProjectChangelog | null,
): KommuneProcesMetrics {
  const projects = collectAllProjects(data);
  const changelogById = buildChangelogByProjectId(changelog);
  return computeMetricsFromProjects('Landet', projects, [], now, changelogById);
}

export interface NeighborAverageMetrics {
  faser: { preliminary: number; approved: number; established: number };
  godkendtPlus: number;
  momentum6mdr: { projekter: number; ha: number };
  mix: { measure: string; pct: number }[];
}

/** Simple arithmetic mean of neighbor kommune metrics (empty → zeros). */
export function averageNeighborMetrics(
  neighborMetrics: KommuneProcesMetrics[],
): NeighborAverageMetrics {
  if (neighborMetrics.length === 0) {
    return {
      faser: { preliminary: 0, approved: 0, established: 0 },
      godkendtPlus: 0,
      momentum6mdr: { projekter: 0, ha: 0 },
      mix: [],
    };
  }

  const n = neighborMetrics.length;
  const faser = {
    preliminary: Math.round(neighborMetrics.reduce((s, m) => s + m.faser.preliminary, 0) / n),
    approved: Math.round(neighborMetrics.reduce((s, m) => s + m.faser.approved, 0) / n),
    established: Math.round(neighborMetrics.reduce((s, m) => s + m.faser.established, 0) / n),
  };
  const sum = faser.preliminary + faser.approved + faser.established;
  if (sum !== 100 && n > 0) {
    faser.preliminary += 100 - sum;
  }

  const mixMap = new Map<string, number[]>();
  for (const m of neighborMetrics) {
    for (const item of m.mix) {
      const arr = mixMap.get(item.measure) ?? [];
      arr.push(item.pct);
      mixMap.set(item.measure, arr);
    }
  }
  const mix = [...mixMap.entries()]
    .map(([measure, pcts]) => ({
      measure,
      pct: Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length),
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  return {
    faser,
    godkendtPlus: faser.approved + faser.established,
    momentum6mdr: {
      projekter: Math.round(neighborMetrics.reduce((s, m) => s + m.momentum6mdr.projekter, 0) / n),
      ha: Math.round(neighborMetrics.reduce((s, m) => s + m.momentum6mdr.ha, 0) / n),
    },
    mix,
  };
}

/** Geographic + comparison helpers for nabosammenligning dropdown. */
export interface ComparisonKommuneGroups {
  /** Nabokommuner med fælles kommunegrænse (DAWA). */
  border: string[];
  /** Øvrige kommuner med MARS-projekter. */
  other: string[];
}

/** All kommuner with at least one non-cancelled MARS project (primary attribution). */
export function listKommunerWithProcesData(data: ProjectDetailsFile): string[] {
  const names = new Set<string>();
  for (const plan of data.plans) {
    for (const p of plan.projectDetails) {
      if (!isCancelledProject(p) && p.kommuneNavn) names.add(p.kommuneNavn);
    }
  }
  return [...names].sort((a, b) => a.localeCompare(b, 'da'));
}

/**
 * Group kommuner for comparison dropdown: geographic border neighbors first,
 * then all other kommuner with proces data (alphabetical).
 */
export function buildComparisonKommuneGroups(
  selfNavn: string,
  allWithData: string[],
  borderNavne: string[],
): ComparisonKommuneGroups {
  const available = new Set(allWithData);
  const borderSet = new Set(borderNavne);
  const border = borderNavne
    .filter((n) => n !== selfNavn && available.has(n))
    .sort((a, b) => a.localeCompare(b, 'da'));
  const other = allWithData
    .filter((n) => n !== selfNavn && !borderSet.has(n))
    .sort((a, b) => a.localeCompare(b, 'da'));
  return { border, other };
}

/** Default comparison: border neighbor with most projects, else first option. */
export function defaultComparisonKommune(
  groups: ComparisonKommuneGroups,
  metricsFor: (navn: string) => KommuneProcesMetrics,
): string | null {
  const pickMostProjects = (candidates: string[]): string | null => {
    if (candidates.length === 0) return null;
    return candidates.reduce((best, navn) => {
      const bestCount = metricsFor(best).projekter;
      const count = metricsFor(navn).projekter;
      return count > bestCount ? navn : best;
    }, candidates[0]);
  };

  const borderPick = pickMostProjects(groups.border);
  if (borderPick) return borderPick;

  return groups.border[0] ?? groups.other[0] ?? null;
}

/** Default neighbor: the one with the most projects in shared trepart plans. */
export function defaultNeighbor(
  naboer: string[],
  metricsByNavn: Map<string, KommuneProcesMetrics>,
): string | null {
  if (naboer.length === 0) return null;
  return naboer.reduce((best, navn) => {
    const bestCount = metricsByNavn.get(best)?.projekter ?? 0;
    const count = metricsByNavn.get(navn)?.projekter ?? 0;
    return count > bestCount ? navn : best;
  }, naboer[0]);
}

/** Whether a kommune has enough MARS project data for the proces section. */
export function hasProcesData(
  data: ProjectDetailsFile,
  kommuneNavn: string,
): boolean {
  return computeKommuneProces(data, kommuneNavn).projekter > 0;
}
