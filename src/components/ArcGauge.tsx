import { formatDanishNumber } from '@/lib/format';

interface ArcGaugeProps {
  value: number;
  max: number;
  pct: number;
  unit: string;
  label: string;
  size?: number;
}

export function ArcGauge({ value, max, pct, unit, label, size = 280 }: ArcGaugeProps) {
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  // 270° arc: starts at 135° (bottom-left), ends at 405° (bottom-right)
  const startAngle = 135;
  const totalAngle = 270;
  const endAngle = startAngle + totalAngle;

  const polarToCartesian = (angle: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const describeArc = (start: number, end: number) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  };

  const progressAngle = startAngle + (totalAngle * Math.min(pct, 100)) / 100;

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.82} viewBox={`0 0 ${size} ${size * 0.82}`} className="overflow-visible">
        {/* Background arc */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc */}
        {pct > 0 && (
          <path
            d={describeArc(startAngle, progressAngle)}
            fill="none"
            stroke="hsl(210 100% 52%)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Center text */}
        <text
          x={center}
          y={center - 16}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: '2.5rem', fontWeight: 600, fontFamily: "'Public Sans', sans-serif" }}
        >
          {Math.round(pct)}%
        </text>
        <text
          x={center}
          y={center + 14}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '0.875rem', fontFamily: "'Public Sans', sans-serif" }}
        >
          {formatDanishNumber(value, 0)} af {formatDanishNumber(max)} {unit}
        </text>
      </svg>
      <p className="mt-2 text-sm text-muted-foreground text-center max-w-xs">{label}</p>
    </div>
  );
}
