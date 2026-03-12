import { useMemo } from 'react';
import { formatDanishNumber } from '@/lib/format';

interface ArcGaugeProps {
  value: number;
  max: number;
  pct: number;
  unit: string;
  label: string;
  size?: number;
  /** Override the sub-text below the percentage. If not set, shows "X af Y unit". */
  subText?: string;
}

/**
 * Interpolate between color stops along a 0–1 parameter.
 * Stops are [t, h, s, l] where h/s/l are HSL values.
 */
function interpolateColor(
  t: number,
  stops: [number, number, number, number][],
): string {
  const clamped = Math.max(0, Math.min(1, t));
  // Find the two surrounding stops
  let lo = stops[0];
  let hi = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i++) {
    if (clamped >= stops[i][0] && clamped <= stops[i + 1][0]) {
      lo = stops[i];
      hi = stops[i + 1];
      break;
    }
  }
  const range = hi[0] - lo[0];
  const f = range > 0 ? (clamped - lo[0]) / range : 0;
  const h = lo[1] + (hi[1] - lo[1]) * f;
  const s = lo[2] + (hi[2] - lo[2]) * f;
  const l = lo[3] + (hi[3] - lo[3]) * f;
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}

// Color stops: red → orange → yellow → yellow-green → green
// Format: [position 0–1, hue, saturation%, lightness%]
const COLOR_STOPS: [number, number, number, number][] = [
  [0,    0,   72, 48],  // red
  [0.25, 25,  85, 50],  // orange
  [0.5,  45,  90, 48],  // yellow
  [0.75, 80,  55, 42],  // yellow-green
  [1,    142, 50, 36],  // green
];

/**
 * Converts polar coordinates (angle in degrees) to Cartesian (x, y).
 * @param center - SVG center coordinate (same for x and y)
 * @param radius - Circle radius in SVG units
 * @param angle - Angle in degrees (0° = top, clockwise)
 * @returns {x, y} SVG coordinates
 * @example polarToCartesian(150, 128, 135) // => { x: ..., y: ... }
 */
function polarToCartesian(center: number, radius: number, angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180;
  return {
    x: center + radius * Math.cos(rad),
    y: center + radius * Math.sin(rad),
  };
}

/**
 * Builds an SVG arc path string between two angles.
 * @param center - SVG center coordinate
 * @param radius - Circle radius in SVG units
 * @param start - Start angle in degrees
 * @param end - End angle in degrees
 * @returns SVG path `d` attribute string
 * @example describeArc(150, 128, 135, 405) // full 270° arc
 */
function describeArc(center: number, radius: number, start: number, end: number) {
  const s = polarToCartesian(center, radius, start);
  const e = polarToCartesian(center, radius, end);
  const largeArc = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

export function ArcGauge({ value, max, pct, unit, label, size = 300, subText }: ArcGaugeProps) {
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  const startAngle = 135;
  const totalAngle = 270;
  const endAngle = startAngle + totalAngle;

  const progressAngle = startAngle + (totalAngle * Math.min(pct, 100)) / 100;

  // Build small arc segments that each get a color based on their position
  // along the arc (0 = start/red, 1 = end/green). This creates a true
  // path-following gradient instead of a screen-space linear gradient.
  const SEGMENT_COUNT = 60;
  const segments = useMemo(() => {
    const clampedPct = Math.min(pct, 100);
    if (clampedPct <= 0) return [];
    const progressFraction = clampedPct / 100;
    const count = Math.max(1, Math.round(SEGMENT_COUNT * progressFraction));
    const segs: { d: string; color: string }[] = [];
    for (let i = 0; i < count; i++) {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const a0 = startAngle + totalAngle * progressFraction * t0;
      const a1 = startAngle + totalAngle * progressFraction * t1;
      // Color is based on position within the FULL arc (not just filled portion)
      const tColor = (progressFraction * (t0 + t1)) / 2;
      segs.push({
        d: describeArc(center, radius, a0, a1),
        color: interpolateColor(tColor, COLOR_STOPS),
      });
    }
    return segs;
  }, [pct, center, radius]);

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size * 0.92} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm overflow-visible">
        {/* Background arc */}
        <path
          d={describeArc(center, radius, startAngle, endAngle)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Progress arc — rendered as many small colored segments */}
        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.d}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeLinecap={i === 0 || i === segments.length - 1 ? 'round' : 'butt'}
          />
        ))}
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
          {subText ?? `${formatDanishNumber(value, 0)} af ${formatDanishNumber(max)} ${unit}`}
        </text>
      </svg>
      <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">{label}</p>
    </div>
  );
}
