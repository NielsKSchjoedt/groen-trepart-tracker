import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { ProjectDetail, KlimaskovfondenProject, NaturstyrelsenSkovProject } from '@/lib/types';
import type { SeriesColor } from '@/lib/supplement-colors';
import { KSF_COLOR_LAVBUND, KSF_COLOR_SKOV, NST_COLOR } from '@/lib/supplement-colors';
import type { MetricMode, PillarMetricConfig } from '@/lib/metric-mode';
import { PHASE_CONFIGS } from '@/lib/phase-config';
import type { ProjectPhase } from '@/lib/phase-config';

/** Minimum number of total data points (across all sources) to render. */
const MIN_PROJECTS = 3;

/** The Green Tripartite agreement was signed 2024-06-24. Charts start here. */
const AGREEMENT_MONTH = '2024-06';

/**
 * Rendering order for stacked areas (bottom → top).
 * MARS phases form the base; KSF and NST stack on top.
 */
const SERIES_ORDER = [
  'established', 'approved', 'preliminary', 'sketch',
  'ksf', 'nst',
] as const;

type SeriesKey = (typeof SERIES_ORDER)[number];

const PHASE_HEX: Record<ProjectPhase, string> = Object.fromEntries(
  PHASE_CONFIGS.map((p) => [p.id, p.hex]),
) as Record<ProjectPhase, string>;

const PHASE_HEX_LIGHT: Record<ProjectPhase, string> = Object.fromEntries(
  PHASE_CONFIGS.map((p) => [p.id, p.hexLight]),
) as Record<ProjectPhase, string>;

const DEFAULT_SUPPLEMENT_COLORS: Record<string, SeriesColor> = {
  ksf: KSF_COLOR_SKOV,
  nst: NST_COLOR,
};

/** Display labels for all series (MARS phases + supplements) used in tooltips. */
const SERIES_LABELS: Record<SeriesKey, string> = {
  established: PHASE_CONFIGS.find((p) => p.id === 'established')!.label,
  approved: PHASE_CONFIGS.find((p) => p.id === 'approved')!.label,
  preliminary: PHASE_CONFIGS.find((p) => p.id === 'preliminary')!.label,
  sketch: PHASE_CONFIGS.find((p) => p.id === 'sketch')!.label,
  ksf: 'Klimaskovfonden',
  nst: 'Naturstyrelsen',
};

const DANISH_MONTHS = [
  'jan', 'feb', 'mar', 'apr', 'maj', 'jun',
  'jul', 'aug', 'sep', 'okt', 'nov', 'dec',
];

/**
 * Format a YYYY-MM key as a short Danish month label (e.g. "mar '25").
 *
 * @param monthKey - String in format "YYYY-MM"
 * @returns Short Danish date label
 */
function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-');
  const monthIdx = parseInt(month, 10) - 1;
  return `${DANISH_MONTHS[monthIdx]} '${year.slice(2)}`;
}

interface ChartDatum {
  month: string;
  label: string;
  sketch: number;
  preliminary: number;
  approved: number;
  established: number;
  ksf: number;
  nst: number;
  total: number;
}

/**
 * Generate a sorted list of YYYY-MM keys from `start` through `end` (inclusive).
 *
 * @param start - First month key, e.g. "2024-06"
 * @param end   - Last month key, e.g. "2026-03"
 * @returns Ordered array of month keys
 */
function monthRange(start: string, end: string): string[] {
  const [sy, sm] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  const result: string[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    result.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return result;
}

type BucketRecord = Record<SeriesKey, number>;

/** Create a zeroed bucket for all series. */
function emptyBucket(): BucketRecord {
  return { sketch: 0, preliminary: 0, approved: 0, established: 0, ksf: 0, nst: 0 };
}

/**
 * Clamp a month key so it is never before the agreement month.
 *
 * @param key - YYYY-MM string
 * @returns Original key or AGREEMENT_MONTH if earlier
 */
function clampMonth(key: string): string {
  return key < AGREEMENT_MONTH ? AGREEMENT_MONTH : key;
}

interface BuildResult {
  data: ChartDatum[];
  /** The first month with observed data (YYYY-MM). */
  startMonth: string;
}

/**
 * Build cumulative monthly chart data from MARS, KSF, and NST projects.
 *
 * - MARS projects are binned by `appliedAt` month (clamped to agreement date).
 * - KSF projects have year-level precision: placed at January of their year
 *   (clamped to agreement month for pre-agreement years).
 * - NST projects have no date data: all placed at the agreement month as
 *   a pre-existing baseline.
 *
 * The timeline starts at the earliest month with actual data (not
 * necessarily the agreement date) to avoid long empty stretches.
 *
 * @param mars - MARS ProjectDetail array (has monthly dates)
 * @param ksf  - Klimaskovfonden projects (has year only)
 * @param nst  - Naturstyrelsen projects (no dates)
 * @returns BuildResult with chart data and start month, or null if insufficient data
 */
function buildCumulativeData(
  mars: ProjectDetail[],
  ksf: KlimaskovfondenProject[],
  nst: NaturstyrelsenSkovProject[],
  mode: MetricMode,
  marsField: PillarMetricConfig['marsField'],
): BuildResult | null {
  const marsWithDate = mars.filter((p) => p.appliedAt && !isNaN(Date.parse(p.appliedAt)));
  const totalPoints = marsWithDate.length + ksf.length + nst.length;
  if (totalPoints < MIN_PROJECTS) return null;

  // In 'area' mode each project contributes its area/effect; in 'count' mode
  // each project contributes 1.
  const isArea = mode === 'area';

  const buckets = new Map<string, BucketRecord>();

  const ensureBucket = (key: string) => {
    if (!buckets.has(key)) buckets.set(key, emptyBucket());
    return buckets.get(key)!;
  };

  for (const p of marsWithDate) {
    const d = new Date(p.appliedAt);
    const key = clampMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    const phase = (p.phase as ProjectPhase) || 'sketch';
    ensureBucket(key)[phase] += isArea ? ((p as unknown as Record<string, number>)[marsField] ?? 0) : 1;
  }

  for (const p of ksf) {
    const year = p.year ?? 2024;
    const key = clampMonth(`${year}-01`);
    ensureBucket(key).ksf += isArea ? (p.areaHa ?? 0) : 1;
  }

  if (nst.length > 0) {
    ensureBucket(AGREEMENT_MONTH).nst += isArea
      ? nst.reduce((s, p) => s + (p.areaHa ?? 0), 0)
      : nst.length;
  }

  const allKeys = [...buckets.keys()].sort();
  if (allKeys.length === 0) return null;

  const startMonth = allKeys[0];
  const endMonth = allKeys[allKeys.length - 1];

  const months = monthRange(startMonth, endMonth);

  const cumulative = emptyBucket();
  const data: ChartDatum[] = [];

  for (const month of months) {
    const bucket = buckets.get(month);
    if (bucket) {
      for (const k of SERIES_ORDER) {
        cumulative[k] += bucket[k];
      }
    }

    data.push({
      month,
      label: formatMonthLabel(month),
      sketch: cumulative.sketch,
      preliminary: cumulative.preliminary,
      approved: cumulative.approved,
      established: cumulative.established,
      ksf: cumulative.ksf,
      nst: cumulative.nst,
      total: SERIES_ORDER.reduce((s, k) => s + cumulative[k], 0),
    });
  }

  return { data, startMonth };
}

interface ProjectActivityChartProps {
  /** MARS projects to chart (monthly date precision) */
  projectDetails: ProjectDetail[];
  /** Klimaskovfonden projects (year-level precision, optional) */
  ksfProjects?: KlimaskovfondenProject[];
  /** Naturstyrelsen projects (no date data — shown as baseline, optional) */
  nstProjects?: NaturstyrelsenSkovProject[];
  /** Override KSF stroke/fill to match pillar context (e.g. purple for skovrejsning) */
  ksfColor?: SeriesColor;
  /** Override NST stroke/fill */
  nstColor?: SeriesColor;
  /** Chart height in pixels (default: 170) */
  height?: number;
  /** Section title (default: "Projektaktivitet over tid") */
  title?: string;
  /** Hide built-in uppercase title (when wrapped in KommuneDetailBlock). */
  showTitle?: boolean;
  /** Additional CSS classes on the outer wrapper */
  className?: string;
  /** Display by project count or accumulated area/effect (default 'area') */
  mode?: MetricMode;
  /** MARS field used in 'area' mode (default 'areaHa') */
  marsField?: PillarMetricConfig['marsField'];
  /** Unit suffix shown in tooltip in 'area' mode (e.g. "ha", "ton N") */
  unit?: string;
  /** Decimals for tooltip values in 'area' mode (default 0) */
  decimals?: number;
}

/**
 * Cumulative project activity chart with MARS phases and optional
 * supplementary sources (Klimaskovfonden, Naturstyrelsen).
 *
 * MARS projects are stacked by phase at monthly resolution. KSF projects
 * are added at year-level resolution. NST projects (no dates) appear as
 * a flat baseline from the agreement start. Each source uses its own
 * colour scheme matching the rest of the application.
 *
 * Requires at least 3 projects total to render.
 * Returns null (renders nothing) if data is insufficient.
 *
 * @param projectDetails - MARS projects to visualise
 * @param ksfProjects    - Optional Klimaskovfonden projects
 * @param nstProjects    - Optional Naturstyrelsen projects
 * @param height         - Chart height in pixels (default 170)
 * @param title          - Heading above the chart
 * @param className      - Optional wrapper class overrides
 *
 * @example
 * <ProjectActivityChart
 *   projectDetails={allProjects}
 *   ksfProjects={ksfData}
 *   nstProjects={nstData}
 *   height={220}
 * />
 */
export function ProjectActivityChart({
  projectDetails,
  ksfProjects = [],
  nstProjects = [],
  ksfColor,
  nstColor,
  height = 170,
  title = 'Kumulativ udvikling i projekter over tid',
  showTitle = true,
  className = 'mb-5',
  mode = 'area',
  marsField = 'areaHa',
  unit = '',
  decimals = 0,
}: ProjectActivityChartProps) {
  const resolvedKsfColor = ksfColor ?? DEFAULT_SUPPLEMENT_COLORS.ksf;
  const resolvedNstColor = nstColor ?? DEFAULT_SUPPLEMENT_COLORS.nst;

  const result = useMemo(
    () => buildCumulativeData(projectDetails, ksfProjects, nstProjects, mode, marsField),
    [projectDetails, ksfProjects, nstProjects, mode, marsField],
  );

  if (!result) return null;

  const { data, startMonth } = result;
  const hasKsf = ksfProjects.length > 0;
  const hasNst = nstProjects.length > 0;

  // Y-axis unit label reflects the active display mode.
  const yAxisLabel = mode === 'area' ? unit || 'Areal' : 'Antal projekter';

  const legendItems: { key: string; label: string; color: string; dashed?: boolean }[] = [
    ...PHASE_CONFIGS.filter((cfg) => data.some((d) => d[cfg.id as keyof ChartDatum] as number > 0))
      .map((cfg) => ({ key: cfg.id, label: cfg.label, color: cfg.hex })),
    ...(hasKsf ? [{ key: 'ksf', label: 'Klimaskovfonden', color: resolvedKsfColor.stroke, dashed: true }] : []),
    ...(hasNst ? [{ key: 'nst', label: 'Naturstyrelsen', color: resolvedNstColor.stroke, dashed: true }] : []),
  ];

  return (
    <div className={className}>
      {showTitle && (
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
          {title}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
        {legendItems.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
            {item.dashed && (
              <span className="opacity-60">(uden fasedata)</span>
            )}
          </span>
        ))}
      </div>
      <div className="rounded-lg border border-border/50 bg-muted/20 p-2">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 88%)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(0 0% 45%)' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={48}
              label={{
                value: yAxisLabel,
                angle: -90,
                position: 'insideLeft',
                style: {
                  fontSize: 10,
                  fill: 'hsl(0 0% 45%)',
                  textAnchor: 'middle',
                },
              }}
            />
            <Tooltip
              content={<CustomTooltip unit={mode === 'area' ? unit : ''} decimals={decimals} />}
              cursor={{ stroke: 'hsl(0 0% 70%)', strokeDasharray: '3 3' }}
            />
            {/* MARS phases (bottom of stack) */}
            {PHASE_CONFIGS.map((cfg) => cfg.id).reverse().map((phase) => (
              <Area
                key={phase}
                type="monotone"
                dataKey={phase}
                stackId="1"
                stroke={PHASE_HEX[phase]}
                fill={PHASE_HEX_LIGHT[phase]}
                strokeWidth={1.5}
                dot={false}
                animationDuration={600}
              />
            ))}
            {/* Klimaskovfonden (stacked on top of MARS) */}
            {hasKsf && (
              <Area
                type="monotone"
                dataKey="ksf"
                stackId="1"
                stroke={resolvedKsfColor.stroke}
                fill={resolvedKsfColor.fill}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                animationDuration={600}
              />
            )}
            {/* Naturstyrelsen (stacked on top) */}
            {hasNst && (
              <Area
                type="monotone"
                dataKey="nst"
                stackId="1"
                stroke={resolvedNstColor.stroke}
                fill={resolvedNstColor.fill}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                dot={false}
                animationDuration={600}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground/70 mt-1 px-0.5">
        Grafen starter ved første observerede data ({formatMonthLabel(startMonth)}).
        {' '}Den Grønne Trepart blev underskrevet juni 2024.
        {' '}Skitseprojekter indgår ikke: MARS registrerer ingen dato for dem, så de kan ikke placeres på tidslinjen.
      </p>
    </div>
  );
}

/**
 * Custom Recharts tooltip showing the month label and per-series breakdown.
 * Handles both MARS phases and supplementary sources.
 */
function CustomTooltip({ active, payload, label, unit = '', decimals = 0 }: {
  active?: boolean;
  payload?: Array<{ dataKey: string; value: number; color: string }>;
  label?: string;
  unit?: string;
  decimals?: number;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, entry) => sum + (entry.value || 0), 0);
  const fmt = (v: number) =>
    `${v.toLocaleString('da-DK', { maximumFractionDigits: decimals })}${unit ? ` ${unit}` : ''}`;

  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur-sm shadow-md px-3 py-2 text-xs">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload
        .filter((entry) => entry.value > 0)
        .reverse()
        .map((entry) => {
          const seriesLabel = SERIES_LABELS[entry.dataKey as SeriesKey] ?? entry.dataKey;
          return (
            <div key={entry.dataKey} className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">{seriesLabel}:</span>
              <span className="font-medium text-foreground">{fmt(entry.value)}</span>
            </div>
          );
        })}
      <div className="border-t border-border/50 mt-1 pt-1 font-semibold text-foreground">
        I alt: {fmt(total)}
      </div>
    </div>
  );
}
