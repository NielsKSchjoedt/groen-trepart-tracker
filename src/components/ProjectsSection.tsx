import { useState } from 'react';
import { Hash, Ruler } from 'lucide-react';
import type { DashboardData, ProjectDetail, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import type { PillarId } from '@/lib/pillars';
import type { MetricMode } from '@/lib/metric-mode';
import { getPillarMetricConfig } from '@/lib/metric-mode';
import { KSF_COLOR_LAVBUND, KSF_COLOR_SKOV, NST_COLOR } from '@/lib/supplement-colors';
import { ProjectFunnel } from './ProjectFunnel';
import { ProjectActivityChart } from './ProjectActivityChart';
import { InitiativeTypeGauge } from './InitiativeTypeGauge';
import { cn } from '@/lib/utils';

/** Pillars that have a project pipeline (everything except CO₂). */
type ProjectPillar = Exclude<PillarId, 'co2'>;

interface ProjectsSectionProps {
  data: DashboardData;
  activePillar: ProjectPillar;
  /** MARS projects already filtered to the active pillar */
  pillarProjects: ProjectDetail[];
  /** Klimaskovfonden projects relevant to the active pillar */
  pillarKsfProjects: KlimaskovfondenProject[];
  /** Naturstyrelsen projects relevant to the active pillar */
  pillarNstProjects: NaturstyrelsenSkovProject[];
}

/**
 * "Forstå projekterne" — the consolidated chapter that gathers every
 * project-oriented visualisation (pipeline funnel, cumulative development over
 * time, and initiative type) under one plain language intro and a single shared
 * toggle that switches all of them between project count and area/effect.
 */
export function ProjectsSection({
  data,
  activePillar,
  pillarProjects,
  pillarKsfProjects,
  pillarNstProjects,
}: ProjectsSectionProps) {
  const [mode, setMode] = useState<MetricMode>('area');
  const cfg = getPillarMetricConfig(activePillar);

  const ksfColor = activePillar === 'afforestation' ? KSF_COLOR_SKOV : KSF_COLOR_LAVBUND;

  return (
    <div>
      {/* Shared toggle: count ↔ area/effect drives every chart below */}
      <div className="mx-auto mb-2 flex max-w-5xl flex-col items-center gap-2 px-4">
        <div
          className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium"
          role="group"
          aria-label="Vis projekterne som antal eller areal/effekt"
        >
          <button
            type="button"
            onClick={() => setMode('area')}
            aria-pressed={mode === 'area'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition',
              mode === 'area' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Ruler className="h-3.5 w-3.5" />
            {cfg.areaToggleLabel}
          </button>
          <button
            type="button"
            onClick={() => setMode('count')}
            aria-pressed={mode === 'count'}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition',
              mode === 'count' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Hash className="h-3.5 w-3.5" />
            Antal projekter
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {mode === 'count'
            ? 'Viser antal projekter i hver visning nedenfor.'
            : `Viser ${cfg.areaToggleLabel.toLowerCase()} i hver visning nedenfor.`}
        </p>
      </div>

      <ProjectFunnel data={data} mode={mode} />

      <section className="w-full max-w-4xl mx-auto px-4 pb-2">
        <ProjectActivityChart
          projectDetails={pillarProjects}
          ksfProjects={pillarKsfProjects}
          nstProjects={pillarNstProjects}
          ksfColor={ksfColor}
          nstColor={NST_COLOR}
          height={220}
          title="Hvordan går det med projekterne over tid?"
          mode={mode}
          marsField={cfg.marsField}
          unit={cfg.unit}
          decimals={cfg.decimals}
        />
      </section>

      <InitiativeTypeGauge data={data} mode={mode} />
    </div>
  );
}
