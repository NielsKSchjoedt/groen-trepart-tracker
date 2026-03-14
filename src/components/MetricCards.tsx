import { formatDanishNumber } from '@/lib/format';
import type { DashboardData } from '@/lib/types';
import { Mountain, Trees, Hammer } from 'lucide-react';
import { NatureWatermark } from './NatureWatermark';

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
    <section className="w-full max-w-4xl mx-auto px-4 py-8 relative overflow-hidden">
      <div className="absolute -right-4 top-2 opacity-[0.10] hidden md:block">
        <NatureWatermark animal="bee" size={100} />
      </div>
      <div className="absolute left-0 bottom-0 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="crab" size={75} />
      </div>
      <div className="absolute right-1/3 -top-2 opacity-[0.07] hidden md:block animate-gentle-sway">
        <NatureWatermark animal="dragonfly" size={50} className="rotate-[-20deg]" />
      </div>
      <div className="absolute left-1/4 top-4 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="flounder" size={70} className="rotate-6" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lavbundsarealer */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-nature-earth/10 flex items-center justify-center">
              <Mountain className="w-4.5 h-4.5 text-nature-earth" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Lavbundsarealer</h3>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
            {formatDanishNumber(progress.extractionProgressPct, 0)}%
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            {formatDanishNumber(progress.extractionAchievedHa, 0)} af {formatDanishNumber(targets.extractionHa)} ha
          </p>
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(progress.extractionProgressPct, 100)}%`,
                background: 'linear-gradient(90deg, hsl(30 35% 45%), hsl(38 50% 55%))',
              }}
            />
          </div>
        </div>

        {/* Skovrejsning */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Trees className="w-4.5 h-4.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Skovrejsning</h3>
          </div>
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-xs rounded-full bg-muted text-muted-foreground px-2.5 py-1 font-medium">
              🌱 Afventer data
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Mål: {formatDanishNumber(targets.afforestationHa)} ha inden 2045
          </p>
          <div className="h-2.5 w-full rounded-full bg-muted mt-3" />
        </div>

        {/* Projekter */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-9 h-9 rounded-lg bg-nature-sky/10 flex items-center justify-center">
              <Hammer className="w-4.5 h-4.5 text-nature-water" />
            </div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Projekter</h3>
          </div>
          <p className="text-2xl font-bold text-foreground mb-1" style={{ fontFamily: "'Fraunces', serif" }}>
            {formatDanishNumber(projects.established)}
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            anlagt af {formatDanishNumber(projects.total)} i pipeline
          </p>
          <div className="flex gap-0.5 h-2.5 rounded-full overflow-hidden bg-muted">
            {[
              { count: projects.sketches, color: 'hsl(150 20% 78%)', label: 'Skitser' },
              { count: projects.assessed, color: 'hsl(152 30% 60%)', label: 'Forundersøgelse' },
              { count: projects.approved, color: 'hsl(152 44% 45%)', label: 'Godkendt' },
              { count: projects.established, color: 'hsl(95 55% 48%)', label: 'Anlagt' },
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
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{formatDanishNumber(projects.sketches)} skitser</span>
            <span>{formatDanishNumber(projects.established)} anlagt</span>
          </div>
        </div>
      </div>
    </section>
  );
}
