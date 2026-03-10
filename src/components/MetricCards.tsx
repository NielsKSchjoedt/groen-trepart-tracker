import { formatDanishNumber } from '@/lib/format';
import type { DashboardData } from '@/lib/types';

interface MetricCardsProps {
  data: DashboardData;
}

export function MetricCards({ data }: MetricCardsProps) {
  const { targets, progress, projects } = {
    targets: data.national.targets,
    progress: data.national.progress,
    projects: data.national.projects,
  };

  return (
    <section className="w-full max-w-3xl mx-auto px-4 py-8">
      {/* Lavbundsarealer */}
      <div className="py-6 border-b border-border">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Lavbundsarealer</h3>
          <span className="text-sm text-muted-foreground">
            {formatDanishNumber(progress.extractionProgressPct, 0)}%
          </span>
        </div>
        <p className="text-lg text-foreground mb-3">
          <strong>{formatDanishNumber(progress.extractionAchievedHa, 0)}</strong> af {formatDanishNumber(targets.extractionHa)} ha udtaget
        </p>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(progress.extractionProgressPct, 100)}%`,
              backgroundColor: 'hsl(45 96% 53%)', // amber-400
            }}
          />
        </div>
      </div>

      {/* Skovrejsning */}
      <div className="py-6 border-b border-border">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Skovrejsning</h3>
          <span className="text-xs rounded-full bg-muted text-muted-foreground px-2.5 py-0.5">Afventer data</span>
        </div>
        <p className="text-lg text-muted-foreground">
          Mål: {formatDanishNumber(targets.afforestationHa)} ha inden 2045
        </p>
        <div className="h-2 w-full rounded-full bg-muted mt-3" />
      </div>

      {/* Projekter */}
      <div className="py-6">
        <div className="flex items-baseline justify-between mb-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Projekter</h3>
          <span className="text-sm text-muted-foreground">{formatDanishNumber(projects.established)} anlagt</span>
        </div>
        <p className="text-lg text-foreground mb-4">
          <strong>{formatDanishNumber(projects.established)}</strong> anlagt af {formatDanishNumber(projects.total)} i pipeline
        </p>
        <div className="flex gap-1 h-2 rounded-full overflow-hidden bg-muted">
          {[
            { count: projects.sketches, color: 'hsl(210 40% 78%)', label: 'Skitser' },
            { count: projects.assessed, color: 'hsl(210 60% 60%)', label: 'Vurderet' },
            { count: projects.approved, color: 'hsl(210 80% 45%)', label: 'Godkendt' },
            { count: projects.established, color: 'hsl(142 71% 45%)', label: 'Anlagt' },
          ].map((stage) => {
            const total = projects.sketches + projects.assessed + projects.approved + projects.established;
            const pct = total > 0 ? (stage.count / total) * 100 : 0;
            return (
              <div
                key={stage.label}
                className="h-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: stage.color }}
                title={`${stage.label}: ${formatDanishNumber(stage.count)}`}
              />
            );
          })}
        </div>
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          <span>Skitser ({formatDanishNumber(projects.sketches)})</span>
          <span>Vurderet ({formatDanishNumber(projects.assessed)})</span>
          <span>Godkendt ({formatDanishNumber(projects.approved)})</span>
          <span>Anlagt ({formatDanishNumber(projects.established)})</span>
        </div>
      </div>
    </section>
  );
}
