import type { FremskrivningTimeFrame } from '@/lib/fremskrivning';
import { formatFremskrivningPct, formatFremskrivningYears } from '@/lib/fremskrivning';

interface TimeFrameStatsProps {
  time: FremskrivningTimeFrame;
  deadlineYear: number;
  /** Realiseret andel af målet (fra aktuel scenarie, ikke statisk model-default). */
  realizedPct?: number;
}

export function TimeFrameStats({ time, deadlineYear, realizedPct }: TimeFrameStatsProps) {
  const pct = realizedPct ?? time.goalPctToday;
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-3.5 mb-4">
      <div>
        <div
          className="font-extrabold text-[26px] leading-none tabular-nums text-foreground/90"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {formatFremskrivningYears(time.elapsedYears)} år
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-1">tid gået siden start</div>
      </div>
      <div>
        <div
          className="font-extrabold text-[26px] leading-none tabular-nums text-foreground/90"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {formatFremskrivningYears(time.remainingYears)} år
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-1">
          tilbage til frist {deadlineYear}
        </div>
      </div>
      <div>
        <div
          className="font-extrabold text-[26px] leading-none tabular-nums text-red-600"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          {formatFremskrivningPct(pct)}%
        </div>
        <div className="text-[12.5px] text-muted-foreground mt-1">af målet realiseret</div>
      </div>
    </div>
  );
}
