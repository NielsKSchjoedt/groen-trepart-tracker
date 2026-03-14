import { useMemo, useState, useCallback } from 'react';
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
  /**
   * Projected end-of-period percentage (0–100). When provided, renders a muted
   * arc behind the actual progress arc showing where current pace leads.
   */
  projectedPct?: number;
  /**
   * Short status label shown as a pill just below the arc (e.g. "Når ikke målet").
   * Pair with `statusColor` for a coloured accent.
   */
  statusLabel?: string;
  /** Accent color for the status pill (hex or CSS color). */
  statusColor?: string;
  /** Icon character for the status pill (e.g. "✓", "!", "○"). */
  statusIcon?: string;
}

/**
 * Interpolate between color stops along a 0–1 parameter.
 * Stops are [t, h, s, l] where h/s/l are HSL values.
 *
 * @param t - Position along the arc (0 = start, 1 = end)
 * @param stops - Array of [position, hue, saturation, lightness] tuples
 * @returns HSL color string
 * @example interpolateColor(0.5, COLOR_STOPS) // => "hsl(45 90% 48%)"
 */
function interpolateColor(
  t: number,
  stops: [number, number, number, number][],
): string {
  const clamped = Math.max(0, Math.min(1, t));
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

/**
 * Same as interpolateColor but returns a muted/desaturated version
 * for the projection arc. Reduces saturation and pushes lightness
 * toward a pale tone.
 *
 * @param t - Position along the arc (0 = start, 1 = end)
 * @param stops - Color stop array
 * @returns Muted HSL color string
 * @example interpolateColorMuted(0.5, COLOR_STOPS) // => "hsl(45 35% 74%)"
 */
function interpolateColorMuted(
  t: number,
  stops: [number, number, number, number][],
): string {
  const clamped = Math.max(0, Math.min(1, t));
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
  const s = (lo[2] + (hi[2] - lo[2]) * f) * 0.4;
  const l = (lo[3] + (hi[3] - lo[3]) * f) * 0.65 + 50;
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(Math.min(l, 88))}%)`;
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

type ArcLayer = 'actual' | 'projected';

const SEGMENT_COUNT = 60;

const START_ANGLE = 135;
const TOTAL_ANGLE = 270;

/**
 * Build colored arc segments for a given percentage of the gauge.
 *
 * @param pct - Percentage to fill (0–100)
 * @param center - SVG center coordinate
 * @param radius - Circle radius
 * @param colorFn - Function that maps a 0–1 position to an HSL color string
 * @returns Array of { d, color } objects for SVG path rendering
 * @example buildSegments(48, 120, 109, interpolateColor)
 */
function buildSegments(
  pct: number,
  center: number,
  radius: number,
  colorFn: (t: number, stops: [number, number, number, number][]) => string,
): { d: string; color: string }[] {
  const clampedPct = Math.min(Math.max(pct, 0), 100);
  if (clampedPct <= 0) return [];
  const progressFraction = clampedPct / 100;
  const count = Math.max(1, Math.round(SEGMENT_COUNT * progressFraction));
  const segs: { d: string; color: string }[] = [];
  for (let i = 0; i < count; i++) {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const a0 = START_ANGLE + TOTAL_ANGLE * progressFraction * t0;
    const a1 = START_ANGLE + TOTAL_ANGLE * progressFraction * t1;
    const tColor = (progressFraction * (t0 + t1)) / 2;
    segs.push({
      d: describeArc(center, radius, a0, a1),
      color: colorFn(tColor, COLOR_STOPS),
    });
  }
  return segs;
}

export function ArcGauge({ value, max, pct, unit, label, size = 300, subText, projectedPct, statusLabel, statusColor, statusIcon }: ArcGaugeProps) {
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  const endAngle = START_ANGLE + TOTAL_ANGLE;

  const [hoveredLayer, setHoveredLayer] = useState<ArcLayer | null>(null);

  const handleLayerEnter = useCallback((layer: ArcLayer) => setHoveredLayer(layer), []);
  const handleLayerLeave = useCallback(() => setHoveredLayer(null), []);

  const actualSegments = useMemo(
    () => buildSegments(pct, center, radius, interpolateColor),
    [pct, center, radius],
  );

  const hasProjection = projectedPct !== undefined && projectedPct > pct;

  const projectedSegmentsMuted = useMemo(
    () => hasProjection
      ? buildSegments(projectedPct!, center, radius, interpolateColorMuted)
      : [],
    [hasProjection, projectedPct, center, radius],
  );

  const projectedSegmentsFull = useMemo(
    () => hasProjection
      ? buildSegments(projectedPct!, center, radius, interpolateColor)
      : [],
    [hasProjection, projectedPct, center, radius],
  );

  const projectionHovered = hoveredLayer === 'projected';
  const actualHovered = hoveredLayer === 'actual';
  const projectedSegs = projectionHovered ? projectedSegmentsFull : projectedSegmentsMuted;

  // When a status pill is shown inside the gauge, shift the number + subtext block
  // upward so the three-element group (number / subtext / pill) is visually centered.
  const hasPill = !!statusLabel;
  const numberY  = center + (hasPill ? -22 : -8);
  const subTextY = center + (hasPill ? 12  : 26);
  const pillTopY = center + 26;   // foreignObject top edge

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size * 0.92}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-sm overflow-visible"
      >
        {/* Background track */}
        <path
          d={describeArc(center, radius, START_ANGLE, endAngle)}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Projected arc (behind actual) — lights up to full color on hover */}
        {hasProjection && (
          <g
            className="cursor-pointer"
            style={{
              opacity: actualHovered ? 0.25 : 1,
              transition: 'opacity 200ms ease',
            }}
            onMouseEnter={() => handleLayerEnter('projected')}
            onMouseLeave={handleLayerLeave}
            onClick={() => setHoveredLayer((prev) => prev === 'projected' ? null : 'projected')}
          >
            {projectedSegs.map((seg, i) => (
              <path
                key={`proj-${i}`}
                d={seg.d}
                fill="none"
                stroke={seg.color}
                strokeWidth={strokeWidth}
                strokeLinecap={i === 0 || i === projectedSegs.length - 1 ? 'round' : 'butt'}
              />
            ))}
          </g>
        )}

        {/* Actual progress arc (on top) — full color always, dims when projection is hovered */}
        <g
          className={hasProjection ? 'cursor-pointer' : undefined}
          style={{
            opacity: projectionHovered ? 0.35 : 1,
            transition: 'opacity 200ms ease',
          }}
          onMouseEnter={hasProjection ? () => handleLayerEnter('actual') : undefined}
          onMouseLeave={hasProjection ? handleLayerLeave : undefined}
          onClick={hasProjection ? () => setHoveredLayer((prev) => prev === 'actual' ? null : 'actual') : undefined}
        >
          {actualSegments.map((seg, i) => (
            <path
              key={`act-${i}`}
              d={seg.d}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeLinecap={i === 0 || i === actualSegments.length - 1 ? 'round' : 'butt'}
            />
          ))}
        </g>

        {/* Center text — switches between actual / projected on hover */}
        <text
          x={center}
          y={numberY}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground"
          style={{ fontSize: '2.75rem', fontWeight: 700, fontFamily: "'Fraunces', serif" }}
        >
          {projectionHovered
            ? `~${projectedPct! > 0 && projectedPct! < 1 ? '< 1' : Math.round(projectedPct!)}%`
            : `${pct > 0 && pct < 1 ? '< 1' : Math.round(pct)}%`}
        </text>
        <text
          x={center}
          y={subTextY}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-muted-foreground"
          style={{ fontSize: '0.875rem', fontFamily: "'Manrope', sans-serif" }}
        >
          {projectionHovered
            ? 'forventet slutresultat'
            : actualHovered
              ? 'faktisk fremskridt'
              : (subText ?? `${formatDanishNumber(value, 0)} af ${formatDanishNumber(max)} ${unit}`)}
        </text>

        {/* Status pill — only when not in hover mode so it doesn't clash with hover labels */}
        {hasPill && !projectionHovered && !actualHovered && (
          <foreignObject x={0} y={pillTopY} width={size} height={26}>
            <div
              // @ts-expect-error — xmlns is required on the root element inside foreignObject
              xmlns="http://www.w3.org/1999/xhtml"
              style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  borderRadius: '9999px',
                  padding: '2px 10px',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  lineHeight: 1.4,
                  color: statusColor ?? '#6b7280',
                  backgroundColor: statusColor ? `${statusColor}18` : '#6b728018',
                  border: `1px solid ${statusColor ? `${statusColor}30` : '#6b728030'}`,
                  fontFamily: "'Manrope', sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {statusIcon && <span aria-hidden="true">{statusIcon}</span>}
                {statusLabel}
              </span>
            </div>
          </foreignObject>
        )}
      </svg>

      <p className="text-sm text-muted-foreground text-center max-w-xs mt-2">{label}</p>
    </div>
  );
}
