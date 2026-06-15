import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { formatDanishNumber } from '@/lib/format';
import type {
  DashboardData,
  PipelineMainPhase,
  ProjectDetail,
  SketchProject,
  KlimaskovfondenProject,
  NaturstyrelsenSkovProject,
  SubsidyScheme,
} from '@/lib/types';
import { loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects, loadProjectGeometries, loadProjectNatureOverlap } from '@/lib/data';
import { usePillar } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import type { MetricMode } from '@/lib/metric-mode';
import { getPillarMetricConfig } from '@/lib/metric-mode';
import { KSF_COLOR_SKOV, KSF_COLOR_LAVBUND, NST_COLOR } from '@/lib/supplement-colors';
import { useMarsProjectUrl } from '@/lib/mars-project-url';
import { createPortal } from 'react-dom';
import {
  GitPullRequestArrow,
  TreePine,
  Landmark,
  Droplets,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { getPhaseConfig, PIPELINE_PHASE_CONFIGS } from '@/lib/phase-config';
import { NatureWatermark } from './NatureWatermark';
import { InfoTooltip } from './InfoTooltip';
import { ProjectMapOverlay, type ProjectMapInfo } from './ProjectMapOverlay';
import { MarsProjectDetailContent, MarsProjectStickyHeader } from './MarsProjectDetailContent';
import type { ProjectNatureOverlapData } from '@/lib/types';

interface ProjectFunnelProps {
  data: DashboardData;
  /** Whether to size/label the funnel by project count or by area/effect */
  mode?: MetricMode;
}

const stages = PIPELINE_PHASE_CONFIGS.map((phase) => ({
  key: phase.id,
  sublabel: phase.description,
  phase,
}));

function stageToProjectKey(stage: PipelineMainPhase): keyof PillarProjects {
  return stage === 'sketch' ? 'sketches' : stage;
}

/** A project enriched with its parent plan name for display in the project list */
type ProjectWithPlan = (ProjectDetail | SketchProject) & { planName: string };

/** Grouped project lists per stage, filtered to the active pillar */
interface PillarProjects {
  sketches: ProjectWithPlan[];
  preliminary_grant: ProjectWithPlan[];
  preliminary_done: ProjectWithPlan[];
  establishment_grant: ProjectWithPlan[];
  established: ProjectWithPlan[];
}

/**
 * Compute pillar-specific project lists by collecting individual projects
 * that have a non-zero effect for the given pillar, grouped by pipeline stage.
 *
 * Each MARS project can contribute to multiple pillars simultaneously
 * (e.g. a wetland project reduces nitrogen AND extracts lowland).
 * This function collects only those relevant to the selected pillar.
 *
 * @param data - Full dashboard data
 * @param pillarId - Active pillar ('nitrogen' | 'extraction' | 'afforestation' | 'nature')
 * @returns Projects grouped by stage, each enriched with its parent plan name
 *
 * @example
 * const { sketches, preliminary_grant, establishment_grant, established } = computePillarProjects(data, 'nitrogen');
 */
function computePillarProjects(data: DashboardData, pillarId: PillarId): PillarProjects {
  const result: PillarProjects = {
    sketches: [],
    preliminary_grant: [],
    preliminary_done: [],
    establishment_grant: [],
    established: [],
  };

  const effectField = ({
    nitrogen: 'nitrogenT',
    extraction: 'extractionHa',
    afforestation: 'afforestationHa',
  } as Record<string, string>)[pillarId];

  const includeAllMarsProjects = pillarId === 'nature';
  if (!effectField && !includeAllMarsProjects) return result;

  for (const plan of data.plans) {
    for (const sk of plan.sketchProjects) {
      if (includeAllMarsProjects || ((sk as unknown as Record<string, unknown>)[effectField] as number > 0)) {
        result.sketches.push({ ...sk, planName: plan.name });
      }
    }
    for (const proj of plan.projectDetails) {
      if (proj.pipelinePhase === 'cancelled' || proj.isCancelled) continue;
      const stage = proj.pipelinePhase as PipelineMainPhase | undefined;
      const stageKey = stage === 'sketch' ? 'sketches' : stage;
      if (
        stageKey &&
        stageKey in result &&
        (includeAllMarsProjects || ((proj as unknown as Record<string, unknown>)[effectField] as number > 0))
      ) {
        result[stageKey].push({ ...proj, planName: plan.name });
      }
    }
  }

  return result;
}

/** Pillar-specific descriptions for the funnel header */
const PILLAR_FUNNEL_DESCRIPTIONS: Record<string, { title: string; subtitle: (total: number) => string; tooltip: string }> = {
  nitrogen: {
    title: 'Kvælstof-projekter',
    subtitle: (total) => `${formatDanishNumber(total)} projekter med kvælstofreducerende effekt`,
    tooltip: 'Projekter fra MARS-databasen der har en dokumenteret kvælstofreducerende effekt (N-reduktion > 0 ton/år). Samme projekt kan bidrage til flere delmål.',
  },
  extraction: {
    title: 'Lavbunds-projekter',
    subtitle: (total) => `${formatDanishNumber(total)} projekter med areal til lavbundsudtag`,
    tooltip: 'Projekter der bidrager til udtag af kulstofrige lavbundsjorde (ekstraktions-areal > 0 ha). Mange projekter har effekt på tværs af delmål.',
  },
  afforestation: {
    title: 'Skovrejsnings-projekter',
    subtitle: (total) => `${formatDanishNumber(total)} MARS-projekter med skovrejsningsareal`,
    tooltip: 'MARS-projekter der bidrager til skovrejsning (skovrejsningsareal > 0 ha). Klimaskovfondens frivillige og Naturstyrelsens statslige projekter vises separat nedenfor.',
  },
  nature: {
    title: 'Naturprojekter',
    subtitle: (_total) => 'Projekter fra alle typer virkemidler i MARS',
    tooltip: 'For beskyttet natur-delmålet vises den samlede projekt-pipeline — alle MARS-projekter uanset specifikt virkemiddel. Naturbeskyttelse afhænger af den samlede indsats.',
  },
};

/**
 * Returns the primary metric value and formatted label for a project under the active pillar.
 *
 * @param project - The project to extract the metric from
 * @param pillarId - Active pillar
 * @returns Object with numeric value, formatted string, and unit label
 *
 * @example
 * const { value, formatted, unit } = getPillarMetric(proj, 'nitrogen');
 * // { value: 3.4, formatted: '3,4', unit: 'ton N' }
 */
function getPillarMetric(
  project: ProjectWithPlan,
  pillarId: PillarId,
): { value: number; formatted: string; unit: string } {
  const map: Record<string, { field: string; unit: string }> = {
    nitrogen: { field: 'nitrogenT', unit: 'ton N' },
    extraction: { field: 'extractionHa', unit: 'ha' },
    afforestation: { field: 'afforestationHa', unit: 'ha' },
    nature: { field: 'areaHa', unit: 'ha' },
  };
  const { field, unit } = map[pillarId] ?? map.nitrogen;
  const value = (project as unknown as Record<string, unknown>)[field] as number ?? 0;
  return { value, formatted: formatDanishNumber(value, 1), unit };
}

const MAX_VISIBLE = 8;

function toProjectMapInfo(proj: ProjectWithPlan): ProjectMapInfo {
  const phase = proj.phase === 'sketch' ? 'sketch' : proj.phase;
  return {
    name: proj.name,
    phase,
    phaseLabelDa: getPhaseConfig(phase).label,
    measureName: proj.measureName,
    schemeName: proj.schemeName,
    schemeOrg: proj.schemeOrg,
    areaHa: proj.areaHa,
    nitrogenT: proj.nitrogenT,
    extractionHa: proj.extractionHa,
    afforestationHa: proj.afforestationHa,
  };
}

function ProjectDetailModal({
  proj,
  coordinates,
  scheme,
  natureOverlap,
  showNatureOverlap,
  onClose,
  onOpenFullMap,
}: {
  proj: ProjectWithPlan;
  coordinates: [number, number][] | null;
  scheme?: SubsidyScheme;
  natureOverlap?: ProjectNatureOverlapData | null;
  showNatureOverlap?: boolean;
  onClose: () => void;
  onOpenFullMap: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const overlap = proj.geoId ? natureOverlap?.byProject[proj.geoId] ?? null : null;

  return createPortal(
    <div
      className="fixed inset-0 z-[2100] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={proj.name}
    >
      <div
        className="relative flex w-full max-w-md max-h-[85vh] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <MarsProjectStickyHeader
          project={proj}
          planName={proj.planName}
          variant="modal"
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-3">
          <MarsProjectDetailContent
            project={proj}
            planName={proj.planName}
            variant="modal"
            scheme={scheme}
            coordinates={coordinates}
            natureOverlap={overlap}
            showNatureOverlap={showNatureOverlap}
            hideHeader
            onMiniMapClick={coordinates && coordinates.length >= 3 ? onOpenFullMap : undefined}
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * Inline accordion panel listing projects for a given funnel stage.
 *
 * @param projects - Sorted list of projects in this stage
 * @param pillarId - Active pillar (determines which metric to display)
 * @param stageColor - Accent colour for metric values
 */
function ProjectListPanel({
  projects,
  pillarId,
  stageColor,
  onProjectClick,
}: {
  projects: ProjectWithPlan[];
  pillarId: PillarId;
  stageColor: string;
  onProjectClick: (proj: ProjectWithPlan) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const sorted = useMemo(
    () => [...projects].sort((a, b) => {
      const ma = getPillarMetric(a, pillarId);
      const mb = getPillarMetric(b, pillarId);
      return mb.value - ma.value;
    }),
    [projects, pillarId],
  );

  const visible = showAll ? sorted : sorted.slice(0, MAX_VISIBLE);
  const remaining = sorted.length - MAX_VISIBLE;

  return (
    <div className="mt-2 rounded-xl border border-border bg-background/70 overflow-hidden text-[11px]">
      <div className="divide-y divide-border/50">
        {visible.map((proj) => {
          const metric = getPillarMetric(proj, pillarId);
          const canOpen = Boolean(proj.geoId);
          // The grey area only adds context when the primary metric isn't itself
          // an area in hectares (i.e. for nitrogen, where blue = ton N). For the
          // ha-based pillars it would just repeat the blue number, so we hide it.
          const showArea = metric.unit !== 'ha';
          return (
            <button
              key={proj.id}
              type="button"
              onClick={() => canOpen && onProjectClick(proj)}
              disabled={!canOpen}
              className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left transition-colors ${
                canOpen ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default opacity-80'
              }`}
              title={canOpen ? `Se ${proj.name} på kort` : proj.name}
            >
              <span className="flex-1 min-w-0 truncate font-medium text-foreground">
                {proj.name}
              </span>
              <span
                className="flex-shrink-0 tabular-nums font-semibold"
                style={{ color: stageColor }}
              >
                {metric.formatted} {metric.unit}
              </span>
              {showArea && (
                <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                  {formatDanishNumber(proj.areaHa, 0)} ha
                </span>
              )}
            </button>
          );
        })}
      </div>
      {remaining > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-1.5 text-center text-[10px] text-muted-foreground hover:bg-muted/40 transition-colors border-t border-border/50"
        >
          Vis alle {formatDanishNumber(sorted.length)} projekter
        </button>
      )}
      {showAll && remaining > 0 && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-1.5 text-center text-[10px] text-muted-foreground hover:bg-muted/40 transition-colors border-t border-border/50"
        >
          Vis færre
        </button>
      )}
    </div>
  );
}

export function ProjectFunnel({ data, mode = 'area' }: ProjectFunnelProps) {
  const { activePillar } = usePillar();
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);
  // Track both pillar and stage so switching pillars automatically resets the panel
  // without needing a separate effect.
  const [expandedEntry, setExpandedEntry] = useState<{ pillar: PillarId; stage: keyof PillarProjects } | null>(null);
  const [selected, setSelected] = useState<{ proj: ProjectWithPlan; coordinates: [number, number][] | null } | null>(null);
  const [overlayData, setOverlayData] = useState<{ coordinates: [number, number][]; info: ProjectMapInfo } | null>(null);
  const [natureOverlap, setNatureOverlap] = useState<ProjectNatureOverlapData | null>(null);
  const geometriesRef = useRef<Record<string, [number, number][]> | null>(null);
  const { openMarsProject, closeMarsProject, marsGeoId } = useMarsProjectUrl();

  const openProjectDetail = useCallback(async (proj: ProjectWithPlan) => {
    setSelected({ proj, coordinates: null });
    if (proj.geoId) openMarsProject(proj.geoId);
    if (!proj.geoId) return;
    if (!geometriesRef.current) {
      geometriesRef.current = await loadProjectGeometries();
    }
    const coords = geometriesRef.current[proj.geoId];
    if (coords && coords.length >= 3) {
      setSelected((cur) => (cur && cur.proj.id === proj.id ? { ...cur, coordinates: coords } : cur));
    }
    if (activePillar === 'nature' && !natureOverlap) {
      loadProjectNatureOverlap().then(setNatureOverlap);
    }
  }, [openMarsProject, activePillar, natureOverlap]);

  useEffect(() => {
    loadKlimaskovfondenProjects().then(setKsfProjects);
    loadNaturstyrelsenSkovProjects().then(setNstProjects);
  }, []);

  // For pillar-specific views, collect full project lists (enables drill-down)
  const pillarProjects = useMemo(
    () => computePillarProjects(data, activePillar),
    [data, activePillar],
  );

  const [prevMarsGeoId, setPrevMarsGeoId] = useState(marsGeoId);
  if (prevMarsGeoId !== marsGeoId) {
    setPrevMarsGeoId(marsGeoId);
    if (!marsGeoId) {
      setSelected(null);
    } else {
      const allProjects = [
        ...pillarProjects.sketches,
        ...pillarProjects.preliminary_grant,
        ...pillarProjects.establishment_grant,
        ...pillarProjects.established,
      ];
      const match = allProjects.find((p) => p.geoId === marsGeoId);
      if (match) {
        setSelected({ proj: match, coordinates: null });
      }
    }
  }

  useEffect(() => {
    if (!selected?.proj.geoId || selected.coordinates) return;
    void (async () => {
      if (!geometriesRef.current) {
        geometriesRef.current = await loadProjectGeometries();
      }
      const coords = geometriesRef.current[selected.proj.geoId!];
      if (coords && coords.length >= 3) {
        setSelected((cur) =>
          cur && cur.proj.id === selected.proj.id ? { ...cur, coordinates: coords } : cur,
        );
      }
      if (activePillar === 'nature' && !natureOverlap) {
        loadProjectNatureOverlap().then(setNatureOverlap);
      }
    })();
  }, [selected, activePillar, natureOverlap]);

  // Scheme id → scheme (from MARS master-data). The detail card joins a project
  // to its scheme by schemeId to show prose about what the scheme type entails
  // and who can apply. MARS has no per-project description (login-gated), so the
  // per-scheme prose is the closest public explanation available.
  const schemeById = useMemo(() => {
    const map = new Map<string, SubsidyScheme>();
    for (const s of data.subsidySchemes ?? []) map.set(s.id, s);
    return map;
  }, [data.subsidySchemes]);

  const ksfAfforestationCount = ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning').length;
  const ksfTotalHa = Math.round(ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning').reduce((s, p) => s + p.areaHa, 0));

  const ksfLowlandCount = ksfProjects.filter((p) => p.projekttyp === 'Lavbund').length;
  const ksfLowlandHa = Math.round(ksfProjects.filter((p) => p.projekttyp === 'Lavbund').reduce((s, p) => s + p.areaHa, 0));

  const nstMatchedProjects = nstProjects.filter((p) => p.centroid);
  const nstOngoing = nstMatchedProjects.filter((p) => p.status === 'ongoing');
  const nstCompleted = nstMatchedProjects.filter((p) => p.status === 'completed');
  const nstTotalHa = Math.round(nstMatchedProjects.reduce((s, p) => s + (p.areaHa ?? 0), 0));
  const nstOngoingHa = Math.round(nstOngoing.reduce((s, p) => s + (p.areaHa ?? 0), 0));
  const nstCompletedHa = Math.round(nstCompleted.reduce((s, p) => s + (p.areaHa ?? 0), 0));

  // For nature, show all MARS projects in the same administrative 5-phase model.
  const counts = stages.map((stage) => pillarProjects[stageToProjectKey(stage.key)].length);
  const totalProjects = counts.reduce((a, b) => a + b, 0);

  // Summed area/effect per stage (used when mode === 'area').
  const metricCfg = getPillarMetricConfig(activePillar);
  const metricByStage = stages.map((stage) =>
    pillarProjects[stageToProjectKey(stage.key)].reduce(
      (sum, proj) => sum + getPillarMetric(proj, activePillar).value,
      0,
    ),
  );

  // Values that drive bar widths, headline numbers and conversion rates.
  const values = mode === 'area' ? metricByStage : counts;

  // Supplement (KSF/NST) magnitudes shown for the active pillar, included in the
  // shared scale so their bars are comparable to the MARS funnel bars.
  const supplementValue = (count: number, ha: number) => (mode === 'area' ? ha : count);
  const supplementScaleValues: number[] = [];
  if (activePillar === 'extraction' && ksfLowlandCount > 0) {
    supplementScaleValues.push(supplementValue(ksfLowlandCount, ksfLowlandHa));
  }
  if (activePillar === 'afforestation') {
    if (ksfAfforestationCount > 0) supplementScaleValues.push(supplementValue(ksfAfforestationCount, ksfTotalHa));
    if (nstMatchedProjects.length > 0) supplementScaleValues.push(supplementValue(nstMatchedProjects.length, nstTotalHa));
  }

  // Total across all stages. This is also the upper bound for bar lengths, so each
  // bar's width equals that stage's share of the whole — exactly the % shown next to
  // it. Scaling to a single stage broke the upper end (a 164k-ha stage and a 67k-ha
  // stage both hit the cap and looked equally long); scaling to the total keeps the
  // largest stage as the longest bar and every bar honestly proportional.
  const totalValue = values.reduce((a, b) => a + b, 0);

  // Supplements (KSF/NST) are sized against the same total so their bars stay
  // comparable to the MARS stages; the guard keeps things sane if a supplement
  // ever exceeds the funnel total.
  const scaleMax = Math.max(totalValue, ...supplementScaleValues, 1);

  /** Bar width % = the value's share of the total, with a 1.5% hairline floor and a 100% cap. */
  const barWidthPct = (v: number) => {
    if (v <= 0) return 0;
    return Math.min(Math.max((v / scaleMax) * 100, 1.5), 100);
  };

  /** Format a stage value according to the active display mode. */
  const formatStageValue = (v: number) =>
    mode === 'area'
      ? `${formatDanishNumber(v, metricCfg.decimals)} ${metricCfg.unit}`
      : formatDanishNumber(v);

  /** Stage share of the total, formatted as a percentage string. */
  const formatSharePct = (v: number) => {
    const pct = totalValue > 0 ? (v / totalValue) * 100 : 0;
    const decimals = pct > 0 && pct < 1 ? 1 : 0;
    return `${formatDanishNumber(pct, decimals)} %`;
  };

  const shareCaption =
    mode === 'area'
      ? `Procenten ved hver fase er fasens andel af det samlede (målt i ${metricCfg.unit}).`
      : 'Procenten ved hver fase er fasens andel af alle projekter.';

  // Realized headline + how long the tracker has been measuring (since the
  // agreement was signed in June 2024), so the completion rate has a tempo context.
  const establishedValue = values[values.length - 1];
  const establishedLabel =
    mode === 'area'
      ? `${formatDanishNumber(establishedValue, metricCfg.decimals)} ${metricCfg.unit}`
      : `${formatDanishNumber(establishedValue)} projekter`;
  const refDate = data.fetchedAt ? new Date(data.fetchedAt) : new Date();
  const monthsMeasured = Math.max(
    0,
    (refDate.getFullYear() - 2024) * 12 + (refDate.getMonth() - 5),
  );
  const measuredYears = Math.floor(monthsMeasured / 12);
  const measuredMonths = monthsMeasured % 12;
  const measuredLabel =
    measuredYears > 0
      ? `${measuredYears} år${measuredMonths > 0 ? ` og ${measuredMonths} måned${measuredMonths > 1 ? 'er' : ''}` : ''}`
      : `${monthsMeasured} måned${monthsMeasured === 1 ? '' : 'er'}`;

  // True when this pillar contains nature projects. For those, "anlagt" isn't the
  // finish line — lasting value also depends on a subsequent management plan and
  // funding for the operations phase, neither of which MARS records. We surface
  // this once as a structural note (not a per-project status, since it never varies).
  const hasNatureProjects = Object.values(pillarProjects)
    .flat()
    .some((project) => project.forvaltningsplanStatus === 'unknown');

  const desc = PILLAR_FUNNEL_DESCRIPTIONS[activePillar] ?? PILLAR_FUNNEL_DESCRIPTIONS.nitrogen;

  /** Toggle a stage panel open/closed; only one stage can be open at a time */
  function handleStageClick(stageKey: keyof PillarProjects) {
    setExpandedEntry((prev) =>
      prev?.pillar === activePillar && prev?.stage === stageKey
        ? null
        : { pillar: activePillar, stage: stageKey },
    );
  }

  return (
    <section id="pipeline-status" className="w-full max-w-5xl mx-auto px-4 pt-4 pb-10 relative overflow-hidden">
      <div className="absolute -left-6 bottom-8 opacity-[0.10] hidden lg:block pointer-events-none">
        <NatureWatermark animal="heron" size={140} />
      </div>
      <div className="absolute right-4 top-4 opacity-[0.09] hidden md:block pointer-events-none">
        <NatureWatermark animal="seal" size={100} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-1/3 top-2 opacity-[0.07] hidden lg:block animate-gentle-sway pointer-events-none">
        <NatureWatermark animal="butterfly" size={50} />
      </div>
      <div className="absolute right-1/4 bottom-4 opacity-[0.08] hidden lg:block pointer-events-none">
        <NatureWatermark animal="cod" size={80} className="rotate-[-15deg]" />
      </div>
      <div className="absolute left-8 top-16 opacity-[0.07] hidden xl:block pointer-events-none">
        <NatureWatermark animal="eel" size={70} className="rotate-[20deg]" />
      </div>
      <div className="flex items-center gap-2.5 mb-2">
        <GitPullRequestArrow className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          {desc.title}
        </h3>
        <InfoTooltip
          title={desc.title}
          content={
            <>
              <p>{desc.tooltip}</p>
              <p><strong>Skitse:</strong> Indledende projektforslag.<br/>
              <strong>Tilsagn til forundersøgelse:</strong> projektet er optaget til forundersøgelse.<br/>
              <strong>Gennemført forundersøgelse:</strong> forundersøgelsen er afsluttet, men anlæg er ikke besluttet.<br/>
              <strong>Tilsagn til udtagning/anlæg:</strong> godkendt til etablering.<br/>
              <strong>Gennemført/anlagt:</strong> fysisk gennemført — kun disse har realiseret miljøeffekt.</p>
              <p><em>Klik på en fase for at se de enkelte projekter.</em></p>
            </>
          }
          source="MARS API (Miljøstyrelsen)"
          articleLink="saadan-maaler-vi"
          side="right"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-1.5">
        {desc.subtitle(totalProjects)}
        <span className="ml-2 text-xs text-muted-foreground/70">— klik på en fase for at se projekterne</span>
      </p>
      <p className="text-[11px] text-muted-foreground/80 mb-8">{shareCaption}</p>

      <div className="space-y-4">
        {stages.map((stage, i) => {
          const count = counts[i];
          const value = values[i];
          const widthPct = barWidthPct(value);
          const projectKey = stageToProjectKey(stage.key);
          const isExpanded = expandedEntry?.pillar === activePillar && expandedEntry?.stage === projectKey;
          const canExpand = count > 0;
          const stageProjects = pillarProjects[projectKey];

          return (
            <div key={stage.key}>
              {i > 0 && (
                <div className="flex items-center gap-2 ml-6 mb-2 -mt-1" aria-hidden="true">
                  <div className="w-px h-4 bg-border" />
                </div>
              )}

              <div
                className={`flex items-center gap-4 rounded-xl px-2 py-1 -mx-2 transition-colors ${
                  canExpand ? 'cursor-pointer hover:bg-muted/30' : ''
                }`}
                onClick={() => canExpand && handleStageClick(projectKey)}
                role={canExpand ? 'button' : undefined}
                aria-expanded={canExpand ? isExpanded : undefined}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: stage.phase.hex + '20' }}
                >
                  <stage.phase.icon className="w-5 h-5" style={{ color: stage.phase.hex }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-foreground">{stage.phase.label}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">{stage.sublabel}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: stage.phase.hex, fontFamily: "'Fraunces', serif" }}
                      >
                        {formatStageValue(value)}
                      </span>
                      <span className="text-[11px] font-medium text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatSharePct(value)}
                      </span>
                      {canExpand && (
                        isExpanded
                          ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                  <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stage.phase.hex,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Expandable project list panel */}
              {canExpand && isExpanded && stageProjects.length > 0 && (
                <ProjectListPanel
                  projects={stageProjects}
                  pillarId={activePillar}
                  stageColor={stage.phase.hex}
                  onProjectClick={openProjectDetail}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Gennemførelsesrate (skitse → gennemført/anlagt)
            {mode === 'area' && <span className="ml-1 text-xs text-muted-foreground/70">— målt på {metricCfg.unit}</span>}
          </span>
          <span className="font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            {values[0] > 0 ? ((values[values.length - 1] / values[0]) * 100).toFixed(1) : 0}%
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground/80">
          {establishedLabel} faktisk anlagt over ca. {measuredLabel}, siden Den Grønne Trepart blev underskrevet i juni 2024.
        </p>
      </div>

      {hasNatureProjects && (
        <div className="mt-4 rounded-xl border border-amber-200/70 bg-amber-50/80 px-4 py-3 text-xs text-amber-950 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-100">
          <span className="font-semibold">For naturprojekter er “anlagt” ikke målstregen. </span>
          Den varige naturværdi afhænger også af, at der følger en forvaltningsplan for arealet, og at der er midler til
          den løbende pleje bagefter. MARS registrerer ingen af delene, så det kan ikke gøres op projekt for projekt —
          og der er ikke afsat særskilte midler til den efterfølgende driftsfase.
        </div>
      )}

      {activePillar === 'extraction' && ksfLowlandCount > 0 && (
        <div
          className="mt-6 p-4 rounded-xl border-2"
          style={{ borderColor: `${KSF_COLOR_LAVBUND.stroke}40`, backgroundColor: `${KSF_COLOR_LAVBUND.stroke}08` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: KSF_COLOR_LAVBUND.bg }}
            >
              <Droplets className="w-5 h-5" style={{ color: KSF_COLOR_LAVBUND.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Klimaskovfonden</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Lavbundsprojekter · {formatDanishNumber(ksfLowlandHa)} ha</span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: KSF_COLOR_LAVBUND.text, fontFamily: "'Fraunces', serif" }}
                >
                  {formatStageValue(supplementValue(ksfLowlandCount, ksfLowlandHa))}
                </span>
              </div>
              <div
                className="h-3.5 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: `${KSF_COLOR_LAVBUND.stroke}20` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${barWidthPct(supplementValue(ksfLowlandCount, ksfLowlandHa))}%`,
                    backgroundColor: KSF_COLOR_LAVBUND.stroke,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Administreres uden for MARS — har ikke projektfasedata. Alle projekter er anlagte (frivillige lavbundsprojekter). Data fra Klimaskovfondens WFS.
              </p>
            </div>
          </div>
        </div>
      )}

      {activePillar === 'afforestation' && ksfAfforestationCount > 0 && (
        <div
          className="mt-6 p-4 rounded-xl border-2"
          style={{ borderColor: `${KSF_COLOR_SKOV.stroke}40`, backgroundColor: `${KSF_COLOR_SKOV.stroke}08` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: KSF_COLOR_SKOV.bg }}
            >
              <TreePine className="w-5 h-5" style={{ color: KSF_COLOR_SKOV.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Klimaskovfonden</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Frivillig skovrejsning · {formatDanishNumber(ksfTotalHa)} ha</span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: KSF_COLOR_SKOV.text, fontFamily: "'Fraunces', serif" }}
                >
                  {formatStageValue(supplementValue(ksfAfforestationCount, ksfTotalHa))}
                </span>
              </div>
              <div
                className="h-3.5 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: `${KSF_COLOR_SKOV.stroke}20` }}
              >
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${barWidthPct(supplementValue(ksfAfforestationCount, ksfTotalHa))}%`,
                    backgroundColor: KSF_COLOR_SKOV.stroke,
                  }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Administreres uden for MARS — har ikke projektfasedata. Alle projekter er anlagte (frivillige skovrejsningsprojekter). Data fra Klimaskovfondens WFS.
              </p>
            </div>
          </div>
        </div>
      )}

      {activePillar === 'afforestation' && nstMatchedProjects.length > 0 && (
        <div
          className="mt-4 p-4 rounded-xl border-2"
          style={{ borderColor: `${NST_COLOR.stroke}40`, backgroundColor: `${NST_COLOR.stroke}08` }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: NST_COLOR.bg }}
            >
              <Landmark className="w-5 h-5" style={{ color: NST_COLOR.text }} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between mb-1">
                <div>
                  <span className="text-sm font-semibold text-foreground">Naturstyrelsen</span>
                  <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">Statslig skovrejsning · {formatDanishNumber(nstTotalHa)} ha</span>
                </div>
                <span
                  className="text-lg font-bold tabular-nums"
                  style={{ color: NST_COLOR.text, fontFamily: "'Fraunces', serif" }}
                >
                  {formatStageValue(supplementValue(nstMatchedProjects.length, nstTotalHa))}
                </span>
              </div>
              <div
                className="h-3.5 w-full rounded-full overflow-hidden"
                style={{ backgroundColor: `${NST_COLOR.stroke}20` }}
              >
                <div
                  className="flex h-full"
                  style={{ width: `${barWidthPct(supplementValue(nstMatchedProjects.length, nstTotalHa))}%` }}
                >
                  {(() => {
                    const nstValue = supplementValue(nstMatchedProjects.length, nstTotalHa);
                    const ongoingValue = supplementValue(nstOngoing.length, nstOngoingHa);
                    const completedValue = supplementValue(nstCompleted.length, nstCompletedHa);
                    return (
                      <>
                        <div
                          className="h-full rounded-l-full transition-all duration-700 ease-out"
                          style={{
                            width: `${nstValue > 0 ? (ongoingValue / nstValue) * 100 : 0}%`,
                            backgroundColor: NST_COLOR.stroke,
                          }}
                        />
                        <div
                          className="h-full rounded-r-full transition-all duration-700 ease-out"
                          style={{
                            width: `${nstValue > 0 ? (completedValue / nstValue) * 100 : 0}%`,
                            backgroundColor: `${NST_COLOR.stroke}80`,
                          }}
                        />
                      </>
                    );
                  })()}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Administreres uden for MARS — har ikke projektfasedata. {formatDanishNumber(nstOngoing.length)} igangværende · {formatDanishNumber(nstCompleted.length)} afsluttede. Data fra MiljøGIS WFS (skovdrift).
              </p>
            </div>
          </div>
        </div>
      )}
      {selected && (
        <ProjectDetailModal
          proj={selected.proj}
          coordinates={selected.coordinates}
          scheme={selected.proj.schemeId ? schemeById.get(selected.proj.schemeId) : undefined}
          natureOverlap={natureOverlap}
          showNatureOverlap={activePillar === 'nature'}
          onClose={() => {
            setSelected(null);
            closeMarsProject();
          }}
          onOpenFullMap={() => {
            if (selected.coordinates && selected.coordinates.length >= 3) {
              setOverlayData({ coordinates: selected.coordinates, info: toProjectMapInfo(selected.proj) });
            }
          }}
        />
      )}
      {overlayData && (
        <ProjectMapOverlay
          coordinates={overlayData.coordinates}
          info={overlayData.info}
          onClose={() => setOverlayData(null)}
        />
      )}
    </section>
  );
}
