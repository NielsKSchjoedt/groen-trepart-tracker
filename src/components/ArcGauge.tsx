import { formatDanishNumber } from '@/lib/format';

interface ArcGaugeProps {
  value: number;
  max: number;
  pct: number;
  unit: string;
  label: string;
  size?: number;
}

export function ArcGauge({ value, max, pct, unit, label, size = 300 }: ArcGaugeProps) {
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

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
      <svg width={size} height={size * 0.92} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm overflow-visible">
        <defs>
          <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(152 44% 38%)" />
            <stop offset="100%" stopColor="hsl(95 55% 48%)" />
          </linearGradient>
        </defs>
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
            stroke="url(#arcGradient)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        )}
        {/* Center percentage */}
        <text
          x={center}
          y={center - 18}
          textAnchor="middle"
          className="fill-foreground"
          style={{ fontSize: '2.75rem', fontWeight: 700, fontFamily: "'Fraunces', serif" }}
        >
          {Math.round(pct)}%
        </text>
        {/* Sub-text */}
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          style={{ fontSize: '0.875rem', fontFamily: "'Manrope', sans-serif" }}
        >
          {formatDanishNumber(value, 0)} af {formatDanishNumber(max)} {unit}
        </text>
      </svg>
      <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">{label}</p>
    </div>
  );
}
