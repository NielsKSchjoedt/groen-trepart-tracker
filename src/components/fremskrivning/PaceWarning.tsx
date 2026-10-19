import { Gauge } from 'lucide-react';
import type { FremskrivningPaceMetrics } from '@/lib/fremskrivning';
import { formatDanishNumber } from '@/lib/format';

interface PaceWarningProps {
  pace: FremskrivningPaceMetrics;
  unitShort: string;
  deadlineYear: number;
  tone?: 'Forklarende' | 'Skarp';
}

export function PaceWarning({
  pace,
  unitShort,
  deadlineYear,
  tone = 'Forklarende',
}: PaceWarningProps) {
  const multipleLabel = Number.isFinite(pace.paceMultiple)
    ? formatDanishNumber(pace.paceMultiple, 1)
    : '∞';

  return (
    <div className="flex gap-3 items-start mt-4 px-4 py-3.5 rounded-lg bg-red-500/[0.06] border border-red-500/20">
      <Gauge className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
      <div className="text-[13.5px] text-foreground leading-snug">
        {tone === 'Skarp' ? (
          <>
            <b className="text-red-600">
              Vi realiserer {multipleLabel}× for langsomt.
            </b>{' '}
            Pipelinen rummer målet — men kun det nederste lag følger det faktiske tempo. Resten
            foldes kun ud, hvis projekterne rent faktisk gennemføres inden {deadlineYear}.
          </>
        ) : (
          <>
            <b>Hastigheden er problemet, ikke pipelinen.</b> Lige nu realiseres effekt med{' '}
            <b className="tabular-nums">
              ~{formatDanishNumber(pace.builtPacePerDay, pace.builtPacePerDay < 1 ? 2 : 1)} {unitShort}/dag
            </b>
            . For at nå målet til tiden skal tempoet op på{' '}
            <b className="tabular-nums">
              ~{formatDanishNumber(pace.neededPacePerDay, 0)} {unitShort}/dag
            </b>{' '}
            —{' '}
            <b className="text-red-600">{multipleLabel}× hurtigere</b>. De lysere lag tæller først
            med, når projekterne faktisk gennemføres.
          </>
        )}
      </div>
    </div>
  );
}
