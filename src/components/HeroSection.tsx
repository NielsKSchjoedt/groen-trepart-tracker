import { ArcGauge } from './ArcGauge';
import { daysUntil, formatDanishNumber } from '@/lib/format';
import type { DashboardData } from '@/lib/types';

interface HeroSectionProps {
  data: DashboardData;
}

export function HeroSection({ data }: HeroSectionProps) {
  const { targets, progress } = { targets: data.national.targets, progress: data.national.progress };
  const remaining = daysUntil(targets.deadline);

  return (
    <section className="w-full py-12 md:py-20 text-center">
      <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-foreground mb-2" style={{ fontFamily: "'Public Sans', sans-serif" }}>
        Er vi på sporet?
      </h1>
      <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-xl mx-auto">
        Status på Den Grønne Treparts kvælstofreduktion
      </p>

      <div className="flex justify-center mb-6">
        <ArcGauge
          value={progress.nitrogenAchievedT}
          max={targets.nitrogenReductionT}
          pct={progress.nitrogenProgressPct}
          unit="ton"
          label="kvælstof reduceret"
        />
      </div>

      <div className="inline-flex items-center gap-2 rounded-full bg-muted px-5 py-2.5 text-sm text-muted-foreground">
        <span className="inline-block w-2 h-2 rounded-full bg-sky-500 animate-pulse" />
        <span>
          <strong className="text-foreground">{formatDanishNumber(remaining)}</strong> dage til 2030
        </span>
      </div>
    </section>
  );
}
