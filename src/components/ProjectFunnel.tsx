import { formatDanishNumber } from '@/lib/format';
import type { DashboardData } from '@/lib/types';
import { GitPullRequestArrow, Pencil, ClipboardCheck, ShieldCheck, Hammer } from 'lucide-react';
import { NatureWatermark } from './NatureWatermark';

interface ProjectFunnelProps {
  data: DashboardData;
}

const stages = [
  { key: 'sketches' as const, label: 'Skitser', sublabel: 'Indledende tegninger', icon: Pencil, color: 'hsl(150 20% 78%)' },
  { key: 'assessed' as const, label: 'Vurderet', sublabel: 'Fagligt gennemgået', icon: ClipboardCheck, color: 'hsl(152 30% 60%)' },
  { key: 'approved' as const, label: 'Godkendt', sublabel: 'Klar til anlæg', icon: ShieldCheck, color: 'hsl(152 44% 45%)' },
  { key: 'established' as const, label: 'Anlagt', sublabel: 'Færdige projekter', icon: Hammer, color: 'hsl(95 55% 48%)' },
];

export function ProjectFunnel({ data }: ProjectFunnelProps) {
  const { projects } = data.national;
  const counts = [projects.sketches, projects.assessed, projects.approved, projects.established];
  const maxCount = Math.max(...counts, 1);

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-2.5 mb-2">
        <GitPullRequestArrow className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Projekt-pipeline
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Sådan bevæger {formatDanishNumber(projects.total)} projekter sig fra skitse til virkelighed
      </p>

      <div className="space-y-4">
        {stages.map((stage, i) => {
          const count = counts[i];
          const widthPct = Math.max((count / maxCount) * 100, 4);
          const conversionRate = i > 0 && counts[i - 1] > 0
            ? ((count / counts[i - 1]) * 100).toFixed(0)
            : null;

          return (
            <div key={stage.key}>
              {/* Conversion arrow */}
              {i > 0 && (
                <div className="flex items-center gap-2 ml-6 mb-2 -mt-1">
                  <div className="w-px h-4 bg-border" />
                  <span className="text-[11px] text-muted-foreground bg-muted/70 px-2 py-0.5 rounded-full">
                    ↓ {conversionRate}% videre
                  </span>
                </div>
              )}

              <div className="flex items-center gap-4">
                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: stage.color + '20' }}
                >
                  <stage.icon className="w-5 h-5" style={{ color: stage.color }} />
                </div>

                {/* Bar + labels */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div>
                      <span className="text-sm font-semibold text-foreground">{stage.label}</span>
                      <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{stage.sublabel}</span>
                    </div>
                    <span
                      className="text-lg font-bold tabular-nums"
                      style={{ color: stage.color, fontFamily: "'Fraunces', serif" }}
                    >
                      {formatDanishNumber(count)}
                    </span>
                  </div>
                  <div className="h-3.5 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: stage.color,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary stat */}
      <div className="mt-8 p-4 rounded-xl bg-muted/50 border border-border">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Gennemførelsesrate (skitse → anlagt)
          </span>
          <span className="font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
            {projects.sketches > 0 ? ((projects.established / projects.sketches) * 100).toFixed(1) : 0}%
          </span>
        </div>
      </div>
    </section>
  );
}
