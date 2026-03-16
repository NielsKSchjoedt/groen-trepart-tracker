import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDanishNumber, getProgressColor } from '@/lib/format';
import { usePillar } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import type { Plan, DashboardData, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import { loadKlimaskovfondenProjects, loadNaturstyrelsenSkovProjects } from '@/lib/data';
import { AlertTriangle, ArrowUpDown, ArrowUp, ArrowDown, Search, TableProperties, ChevronDown, ChevronRight, Hammer, Droplets, MapPin, Mountain, Trees, TreePine, Landmark, Leaf, Shield, ExternalLink } from 'lucide-react';
import { getPhaseConfig } from '@/lib/phase-config';
import { NatureWatermark } from './NatureWatermark';
import { ProjectList } from './ProjectList';
import { InfoTooltip } from './InfoTooltip';
import { RecentActivity } from './RecentActivity';

type AfforestationTab = 'mars' | 'klimaskovfonden' | 'naturstyrelsen';
type ExtractionTab = 'mars' | 'klimaskovfonden';

interface DataTableProps {
  plans: Plan[];
  data?: DashboardData;
  onSelectPlan?: (plan: Plan) => void;
}

type SortDir = 'asc' | 'desc';

// ---------- per-pillar column definitions ----------

interface ColumnDef {
  key: string;
  label: string;
  /** Extract the raw value from a plan for sorting */
  value: (p: Plan) => number | string;
  /** Render the cell */
  render: (p: Plan, plans: Plan[]) => React.ReactNode;
}

const nameCol: ColumnDef = {
  key: 'name',
  label: 'Vandplan',
  value: (p) => p.name,
  render: (p) => (
    <span className="truncate block">{p.name}</span>
  ),
};

const projectsCol: ColumnDef = {
  key: 'projects',
  label: 'Projekter',
  value: (p) => p.projects.sketches + p.projects.assessed + p.projects.approved + p.projects.established,
  render: (p) => {
    const total = p.projects.sketches + p.projects.assessed + p.projects.approved + p.projects.established;
    return (
      <div className="flex items-center gap-1.5">
        <span className="tabular-nums text-foreground font-medium">{formatDanishNumber(total)}</span>
        <span className="text-muted-foreground text-xs">
          ({formatDanishNumber(p.projects.established)} anlagt)
        </span>
      </div>
    );
  },
};

/**
 * Dual progress bar showing both the pipeline total (lighter shade) and
 * the established/implemented portion (solid). The percentage label
 * reflects the pipeline total with the established percentage shown
 * in parentheses when > 0.
 *
 * @param pipelinePct - Progress % including all pipeline phases
 * @param establishedPct - Progress % for established (implemented) projects only
 */
function dualProgressCell(pipelinePct: number, establishedPct: number) {
  const pipelineClamped = Math.max(0, Math.min(pipelinePct, 100));
  const establishedClamped = Math.max(0, Math.min(establishedPct, 100));
  const color = getProgressColor(pipelinePct);

  return (
    <div className="flex items-center gap-2.5">
      <div className="relative h-2 w-16 rounded-full bg-muted overflow-hidden flex-shrink-0">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${pipelineClamped}%`, backgroundColor: color, opacity: 0.3 }}
        />
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all"
          style={{ width: `${establishedClamped}%`, backgroundColor: color }}
        />
      </div>
      <span className="tabular-nums font-semibold whitespace-nowrap" style={{ color }}>
        {Math.round(pipelinePct)}%
      </span>
    </div>
  );
}

function shareCell(value: number, total: number) {
  const share = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-12 rounded-full bg-muted overflow-hidden flex-shrink-0">
        <div
          className="h-full rounded-full bg-primary/60 transition-all"
          style={{ width: `${Math.min(share, 100)}%` }}
        />
      </div>
      <span className="tabular-nums text-muted-foreground text-xs">
        {share.toFixed(1)}%
      </span>
    </div>
  );
}

function getColumnsForPillar(pillarId: PillarId): ColumnDef[] {
  switch (pillarId) {
    case 'nitrogen':
      return [
        nameCol,
        {
          key: 'goal',
          label: 'Mål (ton N)',
          value: (p) => p.nitrogenGoalT,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(p.nitrogenGoalT, 1)}</span>,
        },
        {
          key: 'established',
          label: 'Anlagt (ton)',
          value: (p) => p.nitrogenByPhase.established,
          render: (p) => <span className="tabular-nums font-semibold">{formatDanishNumber(p.nitrogenByPhase.established, 1)}</span>,
        },
        {
          key: 'pipeline',
          label: 'I pipeline (ton)',
          value: (p) => p.nitrogenAchievedT,
          render: (p) => <span className="tabular-nums text-muted-foreground">{formatDanishNumber(p.nitrogenAchievedT, 1)}</span>,
        },
        {
          key: 'progress',
          label: 'Fremskridt',
          value: (p) => p.nitrogenProgressPct,
          render: (p) => {
            const estPct = p.nitrogenGoalT > 0
              ? (p.nitrogenByPhase.established / p.nitrogenGoalT) * 100
              : 0;
            return dualProgressCell(p.nitrogenProgressPct, estPct);
          },
        },
        projectsCol,
      ];

    case 'extraction':
      return [
        nameCol,
        {
          key: 'potential',
          label: 'Potentiale (ha)',
          value: (p) => p.extractionPotentialHa,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(Math.round(p.extractionPotentialHa))}</span>,
        },
        {
          key: 'established',
          label: 'Anlagt (ha)',
          value: (p) => p.extractionByPhase.established,
          render: (p) => <span className="tabular-nums font-semibold">{formatDanishNumber(Math.round(p.extractionByPhase.established))}</span>,
        },
        {
          key: 'pipeline',
          label: 'I pipeline (ha)',
          value: (p) => p.extractionAchievedHa,
          render: (p) => <span className="tabular-nums text-muted-foreground">{formatDanishNumber(Math.round(p.extractionAchievedHa))}</span>,
        },
        {
          key: 'progress',
          label: 'Fremskridt',
          value: (p) => p.extractionPotentialHa > 0 ? (p.extractionAchievedHa / p.extractionPotentialHa) * 100 : 0,
          render: (p) => {
            const pipelinePct = p.extractionPotentialHa > 0 ? (p.extractionAchievedHa / p.extractionPotentialHa) * 100 : 0;
            const estPct = p.extractionPotentialHa > 0 ? (p.extractionByPhase.established / p.extractionPotentialHa) * 100 : 0;
            return dualProgressCell(pipelinePct, estPct);
          },
        },
        projectsCol,
      ];

    case 'afforestation':
      return [
        nameCol,
        {
          key: 'established',
          label: 'Anlagt (ha)',
          value: (p) => p.afforestationByPhase.established,
          render: (p) => <span className="tabular-nums font-semibold">{formatDanishNumber(Math.round(p.afforestationByPhase.established))}</span>,
        },
        {
          key: 'pipeline',
          label: 'I pipeline (ha)',
          value: (p) => p.afforestationAchievedHa,
          render: (p) => <span className="tabular-nums text-muted-foreground">{formatDanishNumber(Math.round(p.afforestationAchievedHa))}</span>,
        },
        projectsCol,
      ];

    case 'nature':
      return [
        nameCol,
        {
          key: 'potential',
          label: 'Potentiale (ha)',
          value: (p) => p.naturePotentialAreaHa,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(Math.round(p.naturePotentialAreaHa))}</span>,
        },
        {
          key: 'count',
          label: 'Naturpotentialer',
          value: (p) => p.countNaturePotentials,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(p.countNaturePotentials)}</span>,
        },
        projectsCol,
      ];

    case 'co2':
      return [
        nameCol,
        projectsCol,
      ];
  }
}

const PILLAR_TABLE_TITLES: Record<PillarId, { heading: string; subtitle: string; tooltip: React.ReactNode }> = {
  nitrogen: {
    heading: 'Implementeringsplaner — Kvælstof',
    subtitle: 'kystvandeplaner med kvælstofreduktionsmål fra vandplanerne',
    tooltip: (
      <>
        <p>Tabellen viser de 37 kystvandegruppers lokale implementeringsplaner for kvælstofreduktion.</p>
        <p><strong>Mål:</strong> Det regulatoriske reduktionsmål fastsat i vandplanerne — ikke en sum af projekter, men et krav der skal nås.</p>
        <p><strong>Anlagt:</strong> Kun fysisk gennemførte projekter (status 15). Denne kolonne er konsistent med resten af dashboardet.</p>
        <p><strong>I pipeline:</strong> MARS-totalen på tværs af alle projektfaser (skitser, forundersøgelse, godkendt og anlagt). Viser hvor stor en del af målet der er <em>dækket af projekter</em> — men langt fra alle er realiseret endnu.</p>
        <p><strong>Fremskridtlinjen</strong> viser begge: den solide del er anlagt, den lysere del er pipeline-totalen.</p>
      </>
    ),
  },
  extraction: {
    heading: 'Implementeringsplaner — Lavbundsudtag',
    subtitle: 'to datakilder — skift fane for at se MARS-vandoplande eller Klimaskovfonden',
    tooltip: (
      <>
        <p>Lavbundsudtag-data samles fra to kilder:</p>
        <p><strong>MARS-vandoplande:</strong> Lavbundsudtag pr. vandopland — areal der er udtaget af landbrugsdrift. Projekter i alle faser fra skitse til anlagt.</p>
        <p><strong>Klimaskovfonden:</strong> Frivillige lavbundsprojekter fra den uafhængige fond. Alle er anlagte. Data fra Klimaskovfondens WFS.</p>
      </>
    ),
  },
  afforestation: {
    heading: 'Implementeringsplaner — Skovrejsning',
    subtitle: 'tre datakilder — skift fane for at se MARS-vandoplande, Klimaskovfonden eller Naturstyrelsen',
    tooltip: (
      <>
        <p>Skovrejsningsdata samles fra tre kilder:</p>
        <p><strong>MARS-vandoplande:</strong> Vandmiljørelateret skovrejsning pr. vandopland — projekter i alle faser fra skitse til anlagt.</p>
        <p><strong>Klimaskovfonden:</strong> {' '}Frivillige skovrejsningsprojekter fra den uafhængige fond. Alle er anlagte.</p>
        <p><strong>Naturstyrelsen:</strong> Statslige skovrejsningsprojekter — igangværende og afsluttede.</p>
      </>
    ),
  },
  nature: {
    heading: 'Naturpotentialer og projektpipeline',
    subtitle: 'vandoplande med naturgenopretningspotentiale identificeret i MARS',
    tooltip: (
      <>
        <p><strong>Naturpotentialer er ikke det samme som beskyttet areal.</strong> Tabellen viser arealer i MARS identificeret som mulige naturgenopretningssteder — de er endnu ikke juridisk beskyttede.</p>
        <p>Målet på 20% beskyttet landareal nås via Natura 2000-udpegning, §3-registrering og naturnationalparker — ikke direkte via disse MARS-potentialer.</p>
        <p>Se statusoversigten ovenfor for den aktuelle dækning af beskyttede arealer.</p>
      </>
    ),
  },
  co2: {
    heading: 'Implementeringsplaner — CO₂',
    subtitle: 'vandoplande (CO₂-data afventer)',
    tooltip: (
      <p>CO₂-data er endnu ikke tilgængeligt pr. vandopland.</p>
    ),
  },
};

// ---------- inline expanded row ----------

function ExpandedPlanRow({ plan, colSpan, pillarId }: { plan: Plan; colSpan: number; pillarId: PillarId }) {
  const [showProjects, setShowProjects] = useState(false);

  const projects = plan.projects;
  const totalProjects = projects.sketches + projects.assessed + projects.approved + projects.established;
  const hasProjectDetails = ((plan.projectDetails?.length ?? 0) + (plan.sketchProjects?.length ?? 0) + (plan.naturePotentials?.length ?? 0)) > 0;

  const stages = [
    { label: getPhaseConfig('sketch').labelPlural, count: projects.sketches, color: getPhaseConfig('sketch').hex },
    { label: getPhaseConfig('preliminary').label, count: projects.assessed, color: getPhaseConfig('preliminary').hex },
    { label: getPhaseConfig('approved').label, count: projects.approved, color: getPhaseConfig('approved').hex },
    { label: getPhaseConfig('established').label, count: projects.established, color: getPhaseConfig('established').hex },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-muted/30 border-t border-border/30 px-6 py-5 animate-in slide-in-from-top-1 duration-200">
          <div className="max-w-3xl space-y-4">

            {/* Pillar-specific metrics */}
            {pillarId === 'nitrogen' && plan.nitrogenGoalT > 0 && (() => {
              const estPct = (plan.nitrogenByPhase.established / plan.nitrogenGoalT) * 100;
              const pipelinePct = plan.nitrogenProgressPct;
              return (
                <div className="flex items-center gap-3">
                  <Droplets className="w-4 h-4 text-nature-water flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold" style={{ color: getProgressColor(pipelinePct) }}>
                        {Math.round(pipelinePct)}%
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDanishNumber(plan.nitrogenAchievedT, 1)} / {formatDanishNumber(plan.nitrogenGoalT, 1)} ton N i pipeline
                      </span>
                    </div>
                    <div className="relative h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.min(pipelinePct, 100)}%`,
                          backgroundColor: getPhaseConfig('established').hex,
                          opacity: 0.3,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.min(estPct, 100)}%`,
                          backgroundColor: getPhaseConfig('established').hex,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getPhaseConfig('established').hex }} />
                        Anlagt: {formatDanishNumber(plan.nitrogenByPhase.established, 1)} ton
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getPhaseConfig('established').hex, opacity: 0.35 }} />
                        I pipeline: {formatDanishNumber(plan.nitrogenAchievedT, 1)} ton
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {pillarId === 'extraction' && plan.extractionPotentialHa > 0 && (() => {
              const pipelinePct = (plan.extractionAchievedHa / plan.extractionPotentialHa) * 100;
              const estPct = (plan.extractionByPhase.established / plan.extractionPotentialHa) * 100;
              return (
                <div className="flex items-center gap-3">
                  <Mountain className="w-4 h-4 text-nature-earth flex-shrink-0" />
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold">
                        {formatDanishNumber(plan.extractionAchievedHa, 1)} ha
                      </span>
                      <span className="text-xs text-muted-foreground">
                        af {formatDanishNumber(plan.extractionPotentialHa, 1)} ha potentiale i pipeline
                      </span>
                    </div>
                    <div className="relative h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.min(pipelinePct, 100)}%`,
                          backgroundColor: getPhaseConfig('established').hex,
                          opacity: 0.3,
                        }}
                      />
                      <div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{
                          width: `${Math.min(estPct, 100)}%`,
                          backgroundColor: getPhaseConfig('established').hex,
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getPhaseConfig('established').hex }} />
                        Anlagt: {formatDanishNumber(Math.round(plan.extractionByPhase.established))} ha
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: getPhaseConfig('established').hex, opacity: 0.35 }} />
                        I pipeline: {formatDanishNumber(Math.round(plan.extractionAchievedHa))} ha
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {pillarId === 'afforestation' && (
              <div className="flex items-center gap-3">
                <Trees className="w-4 h-4 text-primary flex-shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold">{formatDanishNumber(plan.afforestationByPhase.established, 1)} ha</span>
                  <span className="text-muted-foreground"> anlagt</span>
                  {plan.afforestationAchievedHa > plan.afforestationByPhase.established && (
                    <span className="text-muted-foreground"> — {formatDanishNumber(plan.afforestationAchievedHa, 1)} ha i pipeline</span>
                  )}
                </div>
              </div>
            )}

            {pillarId === 'nature' && (
              <div className="flex items-center gap-3">
                <Leaf className="w-4 h-4 flex-shrink-0" style={{ color: '#166534' }} />
                <span className="text-sm">
                  {formatDanishNumber(plan.naturePotentialAreaHa, 0)} ha naturpotentiale
                  {plan.countNaturePotentials > 0 && (
                    <span className="text-muted-foreground ml-1">
                      ({formatDanishNumber(plan.countNaturePotentials)} potentialer)
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Pipeline summary */}
            {totalProjects > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Hammer className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Projekt-pipeline
                  </span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatDanishNumber(projects.established)} af {formatDanishNumber(totalProjects)} anlagt
                  </span>
                </div>
                <div className="h-3 w-full max-w-md rounded-full bg-muted overflow-hidden flex">
                  {stages.map((stage) => {
                    const segmentPct = totalProjects > 0 ? (stage.count / totalProjects) * 100 : 0;
                    if (segmentPct === 0) return null;
                    return (
                      <div
                        key={stage.label}
                        className="h-full transition-all first:rounded-l-full last:rounded-r-full"
                        style={{ width: `${segmentPct}%`, backgroundColor: stage.color }}
                        title={`${stage.label}: ${formatDanishNumber(stage.count)}`}
                      />
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                  {stages.map((stage) =>
                    stage.count > 0 ? (
                      <div key={stage.label} className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: stage.color }} />
                        <span className="text-[10px] text-muted-foreground">
                          {stage.label} <span className="font-semibold text-foreground">{formatDanishNumber(stage.count)}</span>
                        </span>
                      </div>
                    ) : null
                  )}
                </div>

                {/* Toggle project details */}
                {hasProjectDetails && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowProjects(!showProjects);
                    }}
                    className="mt-3 flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-[11px] font-medium text-primary"
                  >
                    {showProjects ? (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        Skjul projektdetaljer
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3.5 h-3.5" />
                        Vis alle {formatDanishNumber(totalProjects)} projekter
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Full project list */}
            {showProjects && (
              <ProjectList
                projectDetails={plan.projectDetails ?? []}
                sketchProjects={plan.sketchProjects ?? []}
                naturePotentials={plan.naturePotentials ?? []}
                activePillar={pillarId}
              />
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}

/**
 * URL search param key for the expanded plan row.
 * Value is the plan's `id` string.
 * Example URL: /kvælstof?vandplan=23
 */
const VANDPLAN_PARAM = 'vandplan';

/**
 * Compact summary card showing the national protection status breakdown
 * for the nature pillar. Rendered above the nature data table to provide
 * context that the table's "potentials" are not yet-protected areas.
 *
 * @param progress - National progress data with natura2000/section3/combined
 */
function NatureProtectionSummary({ progress }: {
  progress: DashboardData['national']['progress'];
}) {
  const items = [
    { label: 'Natura 2000 (terrestrisk)', pct: progress.natura2000TerrestrialPct, color: '#2563eb' },
    { label: '§3-beskyttet natur', pct: progress.section3Pct, color: '#059669' },
  ];
  const combined = progress.natureProtectedPct;

  return (
    <div className="rounded-xl border border-border bg-card/60 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Shield className="w-4 h-4" style={{ color: '#166534' }} />
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Nuværende beskyttelsesniveau
        </span>
        <InfoTooltip
          title="Hvad tæller som beskyttet?"
          content={
            <p>Målet er 20% af Danmarks landareal juridisk beskyttet inden 2030 — via Natura 2000, §3 under Naturbeskyttelsesloven og naturnationalparker. Tallene herunder overlapper ca. 30%.</p>
          }
          methodLink="#kvalitet"
          size={12}
          side="right"
        />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {items.map((item) => (
          <div key={item.label} className="text-center">
            <p className="text-lg font-bold tabular-nums" style={{ color: item.color, fontFamily: "'Fraunces', serif" }}>
              {formatDanishNumber(item.pct, 1)}%
            </p>
            <p className="text-[10px] text-muted-foreground">{item.label}</p>
          </div>
        ))}
        <div className="text-center">
          <p className="text-lg font-bold tabular-nums" style={{ color: '#166534', fontFamily: "'Fraunces', serif" }}>
            ~{formatDanishNumber(combined, 1)}%
          </p>
          <p className="text-[10px] text-muted-foreground">Kombineret (OECD 2024)</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2 text-center">
        Mål: 20% — naturpotentialerne herunder viser hvor yderligere genopretning kan ske
      </p>
    </div>
  );
}

// ---------- Klimaskovfonden sortable project table ----------

type KsfSortKey = 'sagsnummer' | 'type' | 'kommune' | 'area' | 'aargang';

const KLIMASKOVFONDEN_REGISTRY_URL = 'https://klimaskovfonden.dk/vores-standard/register';

/**
 * Sortable table of individual Klimaskovfonden projects.
 * Renders as a standalone table for the "Klimaskovfonden" tab
 * within the afforestation pillar.
 *
 * @param projects - Array of KlimaskovfondenProject objects
 */
function KlimaskovfondenTable({ projects }: { projects: KlimaskovfondenProject[] }) {
  const [sortKey, setSortKey] = useState<KsfSortKey>('area');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const toggleSort = (key: KsfSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'sagsnummer' || key === 'type' || key === 'kommune' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    let items = [...projects];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.sagsnummer.toLowerCase().includes(q) ||
        p.projekttyp.toLowerCase().includes(q) ||
        p.aargang.toLowerCase().includes(q) ||
        (p.kommune?.toLowerCase().includes(q) ?? false)
      );
    }
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'sagsnummer': cmp = a.sagsnummer.localeCompare(b.sagsnummer, 'da'); break;
        case 'type': cmp = a.projekttyp.localeCompare(b.projekttyp, 'da'); break;
        case 'kommune': cmp = (a.kommune ?? '').localeCompare(b.kommune ?? '', 'da'); break;
        case 'area': cmp = a.areaHa - b.areaHa; break;
        case 'aargang': cmp = a.aargang.localeCompare(b.aargang, 'da'); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [projects, sortKey, sortDir, search]);

  const skovCount = projects.filter((p) => p.projekttyp === 'Skovrejsning').length;
  const totalHa = Math.round(projects.reduce((s, p) => s + p.areaHa, 0));
  const kommuneCount = new Set(projects.map((p) => p.kommune).filter(Boolean)).size;

  const KsfSortIcon = ({ col }: { col: KsfSortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {formatDanishNumber(projects.length)} projekter ({formatDanishNumber(skovCount)} skovrejsning, {formatDanishNumber(projects.length - skovCount)} lavbund) — i alt {formatDanishNumber(totalHa)} ha fordelt på {kommuneCount} kommuner. Alle projekter er anlagte (frivillige).
      </p>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Søg sagsnummer, kommune, type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {([
                  ['sagsnummer', 'Sagsnummer'],
                  ['type', 'Type'],
                  ['kommune', 'Kommune'],
                  ['area', 'Areal (ha)'],
                  ['aargang', 'Årgang'],
                ] as [KsfSortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => toggleSort(key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{label}</span>
                      <KsfSortIcon col={key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((proj) => {
                const isSkov = proj.projekttyp === 'Skovrejsning';
                return (
                  <tr key={proj.sagsnummer} className="border-b border-border/50 hover:bg-primary/[0.04] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground tabular-nums">{proj.sagsnummer}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
                        isSkov
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300'
                      }`}>
                        {isSkov ? <TreePine className="w-3 h-3" /> : <Mountain className="w-3 h-3" />}
                        {isSkov ? 'Skovrejsning' : 'Lavbund'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {proj.kommune ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground/60 flex-shrink-0" />
                          {proj.kommune}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-semibold">{formatDanishNumber(proj.areaHa, 2)} ha</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">{proj.aargang}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Ingen projekter matcher &quot;{search}&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500/60" />
          <span>Kilde: <a href={KLIMASKOVFONDEN_REGISTRY_URL} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">Klimaskovfondens WFS</a></span>
        </div>
        <a
          href={KLIMASKOVFONDEN_REGISTRY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <ExternalLink className="w-3 h-3" />
          Se officielt register
        </a>
      </div>
    </div>
  );
}

// ---------- Naturstyrelsen sortable project table ----------

type NstSortKey = 'name' | 'district' | 'area' | 'status';

/**
 * Sortable table of individual Naturstyrelsen state afforestation projects.
 * Renders as a standalone table for the "Naturstyrelsen" tab
 * within the afforestation pillar.
 *
 * @param projects - Array of NaturstyrelsenSkovProject objects
 */
function NaturstyrelsenTable({ projects }: { projects: NaturstyrelsenSkovProject[] }) {
  const [sortKey, setSortKey] = useState<NstSortKey>('area');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  const toggleSort = (key: NstSortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'district' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    let items = [...projects];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.district?.toLowerCase().includes(q) ?? false)
      );
    }
    items.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'name': cmp = a.name.localeCompare(b.name, 'da'); break;
        case 'district': cmp = (a.district ?? '').localeCompare(b.district ?? '', 'da'); break;
        case 'area': cmp = (a.areaHa ?? 0) - (b.areaHa ?? 0); break;
        case 'status': cmp = a.status.localeCompare(b.status, 'da'); break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [projects, sortKey, sortDir, search]);

  const ongoingCount = projects.filter((p) => p.status === 'ongoing').length;
  const completedCount = projects.filter((p) => p.status === 'completed').length;
  const matchedCount = projects.filter((p) => p.centroid).length;
  const totalHa = Math.round(projects.filter((p) => p.areaHa).reduce((s, p) => s + (p.areaHa ?? 0), 0));

  const NstSortIcon = ({ col }: { col: NstSortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <div>
      <p className="text-sm text-muted-foreground mb-4">
        {formatDanishNumber(projects.length)} projekter ({formatDanishNumber(ongoingCount)} igangværende, {formatDanishNumber(completedCount)} afsluttede) — {formatDanishNumber(matchedCount)} matchet med WFS-geodata ({formatDanishNumber(totalHa)} ha).
      </p>

      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Søg skovnavn, distrikt..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
        />
      </div>

      <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {([
                  ['name', 'Skov'],
                  ['district', 'Distrikt'],
                  ['area', 'Areal (ha)'],
                  ['status', 'Status'],
                ] as [NstSortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => toggleSort(key)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{label}</span>
                      <NstSortIcon col={key} />
                    </div>
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Link</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((proj) => {
                const isOngoing = proj.status === 'ongoing';
                return (
                  <tr key={proj.name} className="border-b border-border/50 hover:bg-primary/[0.04] transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{proj.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{proj.district ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold">
                      {proj.areaHa != null ? `${formatDanishNumber(proj.areaHa, 1)} ha` : <span className="text-muted-foreground font-normal">Ukendt</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        isOngoing
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300'
                      }`}>
                        {isOngoing ? 'Igangværende' : 'Afsluttet'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={proj.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="hidden sm:inline">naturstyrelsen.dk</span>
                      </a>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Ingen projekter matcher &quot;{search}&quot;
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
        <div className="w-1.5 h-1.5 rounded-full bg-blue-500/60" />
        <span>Kilde: <a href="https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsningsprojekter/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">Naturstyrelsen</a> + <a href="https://wfs2-miljoegis.mim.dk/skovdrift/ows" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">MiljøGIS WFS</a></span>
      </div>
    </div>
  );
}

const AFFORESTATION_TABS: { id: AfforestationTab; label: string; icon: React.ReactNode }[] = [
  { id: 'mars', label: 'MARS-vandoplande', icon: <Trees className="w-3.5 h-3.5" /> },
  { id: 'klimaskovfonden', label: 'Klimaskovfonden', icon: <TreePine className="w-3.5 h-3.5" /> },
  { id: 'naturstyrelsen', label: 'Naturstyrelsen', icon: <Landmark className="w-3.5 h-3.5" /> },
];

const EXTRACTION_TABS: { id: ExtractionTab; label: string; icon: React.ReactNode }[] = [
  { id: 'mars', label: 'MARS-vandoplande', icon: <Mountain className="w-3.5 h-3.5" /> },
  { id: 'klimaskovfonden', label: 'Klimaskovfonden', icon: <TreePine className="w-3.5 h-3.5" /> },
];

export function DataTable({ plans, data, onSelectPlan }: DataTableProps) {
  const { activePillar, config: pillarConfig } = usePillar();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ksfProjects, setKsfProjects] = useState<KlimaskovfondenProject[]>([]);
  const [nstProjects, setNstProjects] = useState<NaturstyrelsenSkovProject[]>([]);
  const [afforestationTab, setAfforestationTab] = useState<AfforestationTab>('mars');
  const [extractionTab, setExtractionTab] = useState<ExtractionTab>('mars');
  const columns = useMemo(() => getColumnsForPillar(activePillar), [activePillar]);
  const titles = PILLAR_TABLE_TITLES[activePillar];

  useEffect(() => {
    loadKlimaskovfondenProjects().then(setKsfProjects);
    loadNaturstyrelsenSkovProjects().then(setNstProjects);
  }, []);

  const defaultSortKey = columns.find((c) => c.key === 'progress') ? 'progress' : 'name';
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

  // Reset sort when pillar changes — React-recommended "derived state" pattern
  const [prevPillar, setPrevPillar] = useState(activePillar);
  if (prevPillar !== activePillar) {
    setPrevPillar(activePillar);
    const hasProgress = columns.some((c) => c.key === 'progress');
    setSortKey(hasProgress ? 'progress' : 'name');
    setSortDir('desc');
  }

  // Expanded plan ID is URL-driven: ?vandplan=<id>
  // When the pillar changes (new path), search params are dropped automatically.
  const expandedPlanId = searchParams.get(VANDPLAN_PARAM);

  const setExpandedPlanId = (id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id === null) {
        next.delete(VANDPLAN_PARAM);
      } else {
        next.set(VANDPLAN_PARAM, id);
      }
      return next;
    });
  };

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const filtered = useMemo(() => {
    let items = [...plans];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    const col = columns.find((c) => c.key === sortKey) ?? columns[0];
    items.sort((a, b) => {
      const av = col.value(a);
      const bv = col.value(b);
      if (typeof av === 'string' && typeof bv === 'string') {
        return sortDir === 'asc' ? av.localeCompare(bv, 'da') : bv.localeCompare(av, 'da');
      }
      return sortDir === 'asc' ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return items;
  }, [plans, sortKey, sortDir, search, columns]);

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-10 relative overflow-hidden">
      {/* Watermarks */}
      {pillarConfig.watermarks.slice(0, 5).map((animal, i) => {
        const positions = [
          'absolute -right-4 top-20 opacity-[0.08] hidden lg:block',
          'absolute left-0 bottom-16 opacity-[0.09] hidden lg:block',
          'absolute right-1/4 bottom-8 opacity-[0.07] hidden md:block',
          'absolute left-1/3 top-8 opacity-[0.06] hidden xl:block animate-gentle-sway',
          'absolute right-8 top-4 opacity-[0.08] hidden lg:block',
        ];
        const sizes = [100, 90, 80, 50, 70];
        return (
          <div key={`${animal}-${i}`} className={`pointer-events-none ${positions[i]}`}>
            <NatureWatermark animal={animal} size={sizes[i]} />
          </div>
        );
      })}

      <div className="flex items-center gap-2.5 mb-2">
        <TableProperties className="w-5 h-5" style={{ color: pillarConfig.accentColor }} />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          {titles.heading}
        </h2>
        <InfoTooltip
          title={titles.heading}
          content={titles.tooltip}
          source="MARS API (Miljøstyrelsen) — vandplanernes reduktionsmål"
          methodLink="#soejler"
          side="right"
        />
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {plans.length} {titles.subtitle} — klik en række for detaljer. Sortér ved at klikke på kolonneoverskrifter.
      </p>

      <RecentActivity />

      {/* CO₂ disclaimer — no per-catchment project data available */}
      {activePillar === 'co2' && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200/70 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/40 px-4 py-3.5 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1.5 leading-relaxed">
            <p><span className="font-semibold">Ingen data på konkrete projekter for CO₂.</span> CO₂-udledningen spores ikke via individuelle MARS-projekter pr. vandopland. Det er derfor ikke muligt at vise en nedbrydning af CO₂-implementeringen på dette niveau.</p>
            <p>Størstedelen af CO₂-reduktionen kommer fra sektorer som energi og industri — <span className="font-medium">ikke direkte fra Den Grønne Treparts initiativer</span>. Aftalen adresserer primært landbrug og LULUCF, som kun udgør en del af den samlede nationale udledning.</p>
            <p>Tallene på dette dashboard er udelukkende baseret på <strong>KF25 — Klimastatus og -fremskrivning 2025</strong> (KEFM), som er en modelbaseret national fremskrivning. Se oversigten ovenfor for de nationale tal.</p>
          </div>
        </div>
      )}

      {/* Nature protection summary — shows current national protection status */}
      {activePillar === 'nature' && data && (
        <NatureProtectionSummary progress={data.national.progress} />
      )}

      {/* Afforestation tab switcher */}
      {activePillar === 'afforestation' && (ksfProjects.length > 0 || nstProjects.length > 0) && (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex bg-card border border-border rounded-lg p-0.5 shadow-sm">
            {AFFORESTATION_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setAfforestationTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                  afforestationTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <InfoTooltip
            title="Tre datakilder for skovrejsning"
            content={
              <>
                <p><strong>MARS-vandoplande:</strong> Vandmiljørelateret skovrejsning fra MARS pr. vandopland — projekter i alle faser fra skitse til anlagt.</p>
                <p><strong>Klimaskovfonden:</strong> Frivillige skovrejsningsprojekter fra den uafhængige fond. Alle er anlagte. Data fra Klimaskovfondens WFS.</p>
                <p><strong>Naturstyrelsen:</strong> Statslige skovrejsningsprojekter. Areal fra MiljøGIS WFS-polygoner. Igangværende og afsluttede.</p>
              </>
            }
            methodLink="#kvalitet"
            size={14}
            side="right"
          />
        </div>
      )}

      {/* Tab content: Klimaskovfonden (skovrejsning only — lavbund projects belong to extraction pillar) */}
      {activePillar === 'afforestation' && afforestationTab === 'klimaskovfonden' && ksfProjects.length > 0 && (
        <KlimaskovfondenTable projects={ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning')} />
      )}

      {/* Tab content: Naturstyrelsen */}
      {activePillar === 'afforestation' && afforestationTab === 'naturstyrelsen' && nstProjects.length > 0 && (
        <NaturstyrelsenTable projects={nstProjects} />
      )}

      {/* Extraction tab switcher */}
      {activePillar === 'extraction' && ksfProjects.filter((p) => p.projekttyp === 'Lavbund').length > 0 && (
        <div className="flex items-center gap-3 mb-5">
          <div className="flex bg-card border border-border rounded-lg p-0.5 shadow-sm">
            {EXTRACTION_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setExtractionTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-all font-medium ${
                  extractionTab === tab.id
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
          <InfoTooltip
            title="To datakilder for lavbundsudtag"
            content={
              <>
                <p><strong>MARS-vandoplande:</strong> Lavbundsudtag pr. vandopland — projekter i alle faser fra skitse til anlagt.</p>
                <p><strong>Klimaskovfonden:</strong> Frivillige lavbundsprojekter fra den uafhængige fond. Alle er anlagte. Data fra Klimaskovfondens WFS.</p>
              </>
            }
            methodLink="#kvalitet"
            size={14}
            side="right"
          />
        </div>
      )}

      {/* Tab content: Klimaskovfonden lavbund (extraction pillar) */}
      {activePillar === 'extraction' && extractionTab === 'klimaskovfonden' && ksfProjects.filter((p) => p.projekttyp === 'Lavbund').length > 0 && (
        <KlimaskovfondenTable projects={ksfProjects.filter((p) => p.projekttyp === 'Lavbund')} />
      )}

      {/* Tab content: MARS table (default for afforestation/extraction, always shown for other pillars except CO₂) */}
      {activePillar !== 'co2' && (activePillar !== 'afforestation' || afforestationTab === 'mars') && (activePillar !== 'extraction' || extractionTab === 'mars' || ksfProjects.filter((p) => p.projekttyp === 'Lavbund').length === 0) && (
        <>
          {/* Search */}
          <div className="relative mb-4 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Søg vandplan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-lg bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/60"
            />
          </div>

          <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-4 py-3 font-semibold text-muted-foreground cursor-pointer hover:text-foreground transition-colors select-none"
                        onClick={() => toggleSort(col.key)}
                      >
                        <div className="flex items-center gap-1.5">
                          <span>{col.label}</span>
                          <SortIcon col={col.key} />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((plan) => {
                    const isExpanded = expandedPlanId === plan.id;
                    return (
                      <React.Fragment key={plan.id}>
                        <tr
                          onClick={() => {
                            setExpandedPlanId(isExpanded ? null : plan.id);
                            onSelectPlan?.(plan);
                          }}
                          className={`border-b border-border/50 hover:bg-primary/[0.04] cursor-pointer transition-colors group ${isExpanded ? 'bg-primary/[0.06]' : ''}`}
                        >
                          {columns.map((col, i) => (
                            <td
                              key={col.key}
                              className={`px-4 py-3.5 ${i === 0 ? 'font-medium text-foreground group-hover:text-primary transition-colors max-w-[200px]' : 'text-foreground'}`}
                            >
                              {i === 0 ? (
                                <div className="flex items-center gap-1.5">
                                  {isExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  }
                                  {col.render(plan, plans)}
                                </div>
                              ) : (
                                col.render(plan, plans)
                              )}
                            </td>
                          ))}
                        </tr>
                        {isExpanded && (
                          <ExpandedPlanRow plan={plan} colSpan={columns.length} pillarId={activePillar} />
                        )}
                      </React.Fragment>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-muted-foreground">
                        Ingen vandplaner matcher &quot;{search}&quot;
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Source badge */}
          <div className="flex items-center gap-2 mt-4 text-xs text-muted-foreground">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pillarConfig.accentColor + '80' }} />
            <span>Kilde: <a href="https://mars.sgav.dk" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">MARS API</a> — SGAV</span>
          </div>
        </>
      )}
    </section>
  );
}
