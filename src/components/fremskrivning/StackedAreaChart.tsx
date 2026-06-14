import type { FremskrivningProjection } from '@/lib/fremskrivning';
import {
  bandAreaPath,
  bandTopLine,
  formatFremskrivningPct,
  isKursStage,
  isPotentialStage,
} from '@/lib/fremskrivning';
import { formatDanishNumber } from '@/lib/format';
import { TimeFrameStats } from './TimeFrameStats';
import { ChartLegend } from './ChartLegend';

interface StackedAreaChartProps {
  model: import('@/lib/fremskrivning').FremskrivningModel;
  projection: FremskrivningProjection;
  accent: string;
}

export function StackedAreaChart({ model, projection, accent }: StackedAreaChartProps) {
  const { target, time, unitShort, deadlineYear } = model;
  const { bands, sampleYears, stackPct, realizedToday } = projection;
  const lastIdx = sampleYears.length - 1;

  const kursBands = bands.filter((b) => isKursStage(b.stage));
  const potentialBands = bands.filter((b) => isPotentialStage(b.stage));
  const hasPotential = potentialBands.length > 0;
  const kursTopBand = kursBands[kursBands.length - 1];
  const stackTopBand = bands[bands.length - 1];
  const stackTopValue = stackTopBand?.top[lastIdx] ?? projection.stackTotal;
  const realizedPct = target > 0 ? (realizedToday / target) * 100 : 0;

  const W = 600;
  const H = 262;
  const L = 48;
  const R = 556;
  const T = 22;
  const B = 218;
  const PW = R - L;
  const PH = B - T;

  const { elapsedYears, totalYears, projectStart } = time;
  const xOf = (yr: number) => L + (yr / totalYears) * PW;
  const yMax = Math.max(target, stackTopValue, 1);
  const yOf = (value: number) => B - (value / yMax) * PH;
  const goalY = yOf(target);
  const todayX = xOf(elapsedYears);
  const endX = xOf(totalYears);
  const yStackTop = yOf(stackTopValue);

  const goalLabel =
    model.pillar === 'nitrogen'
      ? `Mål: ${formatDanishNumber(target)} ton N/år`
      : `Mål: ${formatDanishNumber(target)} ${unitShort}`;

  return (
    <div>
      <p className="text-sm font-semibold text-foreground mb-3">
        Udvikling mod {deadlineYear}
      </p>
      <TimeFrameStats time={time} deadlineYear={deadlineYear} realizedPct={realizedPct} />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        className="block overflow-visible"
        role="img"
        aria-label={`Fremskrivning mod ${deadlineYear}`}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line
            key={g}
            x1={L}
            x2={R}
            y1={B - g * PH}
            y2={B - g * PH}
            className="stroke-border"
            strokeWidth={1}
          />
        ))}
        <line x1={L} x2={R} y1={B} y2={B} className="stroke-border" strokeWidth={1.5} />

        <line
          x1={L}
          x2={R}
          y1={goalY}
          y2={goalY}
          stroke="#16a34a"
          strokeWidth={1.5}
          strokeDasharray="7 4"
          opacity={0.85}
        />
        <text x={L} y={goalY - 8} textAnchor="start" fontSize={13.5} fontWeight={700} fill="#16a34a">
          {goalLabel}
        </text>

        {bands.map((band) => {
          const color = band.stage.kind === 'mars' ? accent : band.stage.certColor;
          return (
            <path
              key={band.stage.id}
              d={bandAreaPath(band, sampleYears, xOf, yOf)}
              fill={color}
              fillOpacity={band.stage.opacity}
              stroke={color}
              strokeOpacity={Math.min(band.stage.opacity + 0.25, 1)}
              strokeWidth={1}
            />
          );
        })}

        {kursTopBand && (
          <polyline
            points={bandTopLine(kursTopBand, sampleYears, xOf, yOf)}
            fill="none"
            stroke={kursTopBand.stage.kind === 'mars' ? accent : kursTopBand.stage.certColor}
            strokeWidth={2.6}
            strokeLinejoin="round"
          />
        )}

        <line
          x1={todayX}
          x2={todayX}
          y1={T}
          y2={B}
          className="stroke-foreground"
          strokeWidth={1}
          strokeDasharray="3 4"
          opacity={0.34}
        />

        <circle cx={endX} cy={yStackTop} r={6.5} fill={accent} className="stroke-card" strokeWidth={2} />
        <text
          x={endX + 9}
          y={yStackTop + 5}
          textAnchor="start"
          fontSize={13.5}
          fontWeight={800}
          fill={accent}
        >
          {formatFremskrivningPct(stackPct)}%
        </text>

        <text x={L} y={B + 22} textAnchor="start" fontSize={13} className="fill-muted-foreground">
          {projectStart.getFullYear()}
        </text>
        <text x={todayX} y={B + 22} textAnchor="middle" fontSize={13} fontWeight={700} className="fill-foreground">
          i dag
        </text>
        <text x={endX} y={B + 22} textAnchor="end" fontSize={13} className="fill-muted-foreground">
          {deadlineYear}
        </text>
      </svg>

      <ChartLegend
        activeStages={bands.map((b) => b.stage)}
        projection={projection}
        accent={accent}
        unitShort={unitShort}
        deadlineYear={deadlineYear}
        hasPotential={hasPotential}
      />
    </div>
  );
}
