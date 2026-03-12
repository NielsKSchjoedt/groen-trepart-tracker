import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { formatDanishNumber, getProgressColor } from '@/lib/format';
import { usePillar } from '@/lib/pillars';
import type { PillarId } from '@/lib/pillars';
import type { Plan } from '@/lib/types';
import { ArrowUpDown, ArrowUp, ArrowDown, Search, TableProperties, ChevronDown, ChevronRight, Hammer, Droplets, MapPin, Trees, Leaf } from 'lucide-react';
import { NatureWatermark } from './NatureWatermark';
import { ProjectList } from './ProjectList';

interface DataTableProps {
  plans: Plan[];
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

function progressCell(pct: number) {
  const clamped = Math.max(0, Math.min(pct, 100));
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden flex-shrink-0">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${clamped}%`,
            backgroundColor: getProgressColor(pct),
          }}
        />
      </div>
      <span className="tabular-nums font-semibold text-foreground" style={{ color: getProgressColor(pct) }}>
        {Math.round(pct)}%
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
          key: 'achieved',
          label: 'Opnået (ton)',
          value: (p) => p.nitrogenAchievedT,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(p.nitrogenAchievedT, 1)}</span>,
        },
        {
          key: 'progress',
          label: 'Fremskridt',
          value: (p) => p.nitrogenProgressPct,
          render: (p) => progressCell(p.nitrogenProgressPct),
        },
        projectsCol,
        {
          key: 'share',
          label: 'Andel af mål',
          value: (p) => p.nitrogenGoalT,
          render: (p, plans) => shareCell(p.nitrogenGoalT, plans.reduce((s, x) => s + x.nitrogenGoalT, 0)),
        },
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
          key: 'achieved',
          label: 'Udtaget (ha)',
          value: (p) => p.extractionAchievedHa,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(Math.round(p.extractionAchievedHa))}</span>,
        },
        {
          key: 'progress',
          label: 'Fremskridt',
          value: (p) => p.extractionPotentialHa > 0 ? (p.extractionAchievedHa / p.extractionPotentialHa) * 100 : 0,
          render: (p) => {
            const pct = p.extractionPotentialHa > 0 ? (p.extractionAchievedHa / p.extractionPotentialHa) * 100 : 0;
            return progressCell(pct);
          },
        },
        projectsCol,
      ];

    case 'afforestation':
      return [
        nameCol,
        {
          key: 'achieved',
          label: 'Skov (ha)',
          value: (p) => p.afforestationAchievedHa,
          render: (p) => <span className="tabular-nums">{formatDanishNumber(Math.round(p.afforestationAchievedHa))}</span>,
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

const PILLAR_TABLE_TITLES: Record<PillarId, { heading: string; subtitle: string }> = {
  nitrogen: {
    heading: 'Kystvandeplaner — Kvælstof',
    subtitle: 'kystvandeplaner med kvælstofreduktionsmål',
  },
  extraction: {
    heading: 'Lavbundsudtag pr. vandopland',
    subtitle: 'vandoplande med potentiale for lavbundsudtag',
  },
  afforestation: {
    heading: 'Skovrejsning pr. vandopland',
    subtitle: 'vandoplande med skovrejsningsdata',
  },
  nature: {
    heading: 'Naturpotentiale pr. vandopland',
    subtitle: 'vandoplande med naturpotentialer',
  },
  co2: {
    heading: 'CO₂-reduktion pr. vandopland',
    subtitle: 'vandoplande (CO₂-data afventer)',
  },
};

// ---------- inline expanded row ----------

function ExpandedPlanRow({ plan, colSpan, pillarId }: { plan: Plan; colSpan: number; pillarId: PillarId }) {
  const [showProjects, setShowProjects] = useState(false);

  const projects = plan.projects;
  const totalProjects = projects.sketches + projects.assessed + projects.approved + projects.established;
  const hasProjectDetails = ((plan.projectDetails?.length ?? 0) + (plan.sketchProjects?.length ?? 0) + (plan.naturePotentials?.length ?? 0)) > 0;

  const stages = [
    { label: 'Skitser', count: projects.sketches, color: 'hsl(35 50% 75%)' },
    { label: 'Vurderet', count: projects.assessed, color: 'hsl(45 60% 60%)' },
    { label: 'Godkendt', count: projects.approved, color: 'hsl(80 40% 55%)' },
    { label: 'Anlagt', count: projects.established, color: 'hsl(95 55% 48%)' },
  ];

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-muted/30 border-t border-border/30 px-6 py-5 animate-in slide-in-from-top-1 duration-200">
          <div className="max-w-3xl space-y-4">

            {/* Pillar-specific metrics */}
            {pillarId === 'nitrogen' && plan.nitrogenGoalT > 0 && (
              <div className="flex items-center gap-3">
                <Droplets className="w-4 h-4 text-nature-water flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: getProgressColor(plan.nitrogenProgressPct) }}>
                      {Math.round(plan.nitrogenProgressPct)}%
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDanishNumber(plan.nitrogenAchievedT, 1)} / {formatDanishNumber(plan.nitrogenGoalT, 1)} ton N
                    </span>
                  </div>
                  <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(plan.nitrogenProgressPct, 100)}%`,
                        background: 'linear-gradient(90deg, hsl(152 44% 38%), hsl(95 55% 48%))',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {pillarId === 'extraction' && plan.extractionPotentialHa > 0 && (
              <div className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-nature-earth flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-sm font-semibold">
                      {formatDanishNumber(plan.extractionAchievedHa, 1)} ha
                    </span>
                    <span className="text-xs text-muted-foreground">
                      af {formatDanishNumber(plan.extractionPotentialHa, 1)} ha potentiale
                    </span>
                  </div>
                  <div className="h-2 w-full max-w-xs rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min((plan.extractionAchievedHa / plan.extractionPotentialHa) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, hsl(30 35% 45%), hsl(38 50% 55%))',
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {pillarId === 'afforestation' && (
              <div className="flex items-center gap-3">
                <Trees className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-sm">
                  {formatDanishNumber(plan.afforestationAchievedHa, 1)} ha skovrejst
                </span>
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

export function DataTable({ plans, onSelectPlan }: DataTableProps) {
  const { activePillar, config: pillarConfig } = usePillar();
  const [searchParams, setSearchParams] = useSearchParams();
  const columns = useMemo(() => getColumnsForPillar(activePillar), [activePillar]);
  const titles = PILLAR_TABLE_TITLES[activePillar];

  const defaultSortKey = columns.find((c) => c.key === 'progress') ? 'progress' : 'name';
  const [sortKey, setSortKey] = useState<string>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [search, setSearch] = useState('');

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

  // Reset sort when pillar changes (expansion clears automatically via URL)
  useEffect(() => {
    const hasProgress = columns.some((c) => c.key === 'progress');
    setSortKey(hasProgress ? 'progress' : 'name');
    setSortDir('desc');
  }, [activePillar, columns]);

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
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        {plans.length} {titles.subtitle} — klik en række for detaljer. Sortér ved at klikke på kolonneoverskrifter.
      </p>

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
        <span>Kilde: <a href="https://mars.mst.dk" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">MARS API</a> — Miljøstyrelsen</span>
      </div>
    </section>
  );
}
