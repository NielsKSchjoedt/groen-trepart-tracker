import type { FremskrivningProjection, FremskrivningStageData } from '@/lib/fremskrivning';
import {
  formatFremskrivningPct,
  formatFremskrivningValue,
} from '@/lib/fremskrivning';

interface ChartLegendProps {
  activeStages: FremskrivningStageData[];
  projection: FremskrivningProjection;
  accent: string;
  unitShort: string;
  deadlineYear: number;
  hasPotential: boolean;
}

export function ChartLegend({
  activeStages,
  projection,
  accent,
  unitShort,
  deadlineYear,
  hasPotential,
}: ChartLegendProps) {
  return (
    <div className="mt-3.5">
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {activeStages.map((s) => {
          const color = s.kind === 'mars' ? accent : s.certColor;
          return (
            <span key={s.id} className="inline-flex items-center gap-1.5 text-[12.5px] text-foreground">
              <span
                className="w-3 h-3 rounded-sm inline-block"
                style={{ backgroundColor: color, opacity: s.opacity }}
              />
              {s.label}
            </span>
          );
        })}
      </div>
      <div className="flex flex-col gap-1.5 mt-3 text-[13px] text-foreground leading-snug">
        <div className="flex items-start gap-2">
          <span className="flex-shrink-0 mt-1 w-3 h-3 rounded-full bg-red-600 ml-1" />
          <span>
            <b>Nederste, fuldfarvede lag</b> følger det <b>faktiske tempo</b> og lander på{' '}
            <b className="text-red-600">
              ~{formatFremskrivningValue(projection.forecastEnd)} {unitShort}
            </b>{' '}
            i {deadlineYear} ({formatFremskrivningPct(projection.forecastPct)}% af målet).
          </span>
        </div>
        {hasPotential && (
          <div className="flex items-start gap-2">
            <span
              className="flex-shrink-0 mt-1 w-3 h-3 rounded-full ml-1"
              style={{ backgroundColor: accent, opacity: 0.45 }}
            />
            <span>
              <b>De lysere lag ovenpå</b> er potentialet, fremskrevet <i>som om</i> det realiseres
              til tiden — samlet{' '}
              <b style={{ color: accent }}>
                {formatFremskrivningValue(projection.stackTotal)} {unitShort}
              </b>{' '}
              ({formatFremskrivningPct(projection.stackPct)}% af målet) i {deadlineYear}.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
