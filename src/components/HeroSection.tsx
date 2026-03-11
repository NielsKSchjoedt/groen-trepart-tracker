import { ArcGauge } from './ArcGauge';
import { daysUntil, formatDanishNumber } from '@/lib/format';
import type { DashboardData } from '@/lib/types';
import { Leaf, TreePine } from 'lucide-react';

interface HeroSectionProps {
  data: DashboardData;
}

export function HeroSection({ data }: HeroSectionProps) {
  const { targets, progress } = { targets: data.national.targets, progress: data.national.progress };
  const remaining = daysUntil(targets.deadline);

  return (
    <section className="w-full py-14 md:py-24 text-center relative overflow-hidden">
      {/* Decorative nature elements */}
      <div className="absolute top-6 left-8 opacity-[0.07] pointer-events-none">
        <Leaf className="w-32 h-32 text-primary animate-gentle-sway" strokeWidth={1} />
      </div>
      <div className="absolute bottom-4 right-10 opacity-[0.06] pointer-events-none">
        <TreePine className="w-40 h-40 text-nature-moss" strokeWidth={1} />
      </div>
      <div className="absolute top-1/3 right-1/4 opacity-[0.04] pointer-events-none hidden md:block">
        <Leaf className="w-20 h-20 text-nature-leaf rotate-45" strokeWidth={1} />
      </div>

      {/* Leaf emoji accent */}
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-2xl">🌿</span>
        <span className="text-xs font-medium uppercase tracking-widest text-primary">
          Den Grønne Trepart
        </span>
        <span className="text-2xl">🌿</span>
      </div>

      <h1
        className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-3"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Er vi på sporet?
      </h1>
      <p className="text-muted-foreground text-base md:text-lg mb-10 max-w-lg mx-auto leading-relaxed">
        Følg Danmarks fremskridt med kvælstofreduktion, lavbundsarealer og skovrejsning
      </p>

      <div className="flex justify-center mb-8">
        <ArcGauge
          value={progress.nitrogenAchievedT}
          max={targets.nitrogenReductionT}
          pct={progress.nitrogenProgressPct}
          unit="ton"
          label="kvælstof reduceret"
        />
      </div>

      <div className="inline-flex items-center gap-2.5 rounded-full bg-card border border-border px-5 py-3 text-sm text-muted-foreground shadow-sm">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
        <span>
          <strong className="text-foreground font-semibold">{formatDanishNumber(remaining)}</strong> dage til 2030
        </span>
      </div>
    </section>
  );
}
