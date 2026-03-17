import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { KommuneCO2Data } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';

interface CO2SectorChartProps {
  data: KommuneCO2Data;
  /** Which year index to show (defaults to latest) */
  yearIndex?: number;
}

const SECTOR_CONFIG = [
  { key: 'energi',    label: 'Energi',    color: '#64748b' },
  { key: 'transport', label: 'Transport', color: '#3b82f6' },
  { key: 'landbrug',  label: 'Landbrug',  color: '#a16207' },
  { key: 'affald',    label: 'Affald',    color: '#6b7280' },
  { key: 'industri',  label: 'Industri',  color: '#6366f1' },
] as const;

type SectorKey = typeof SECTOR_CONFIG[number]['key'];

/**
 * Stacked horizontal bar chart showing CO₂ sector breakdown for a single
 * municipality in a single year.
 */
export function CO2SectorChart({ data, yearIndex }: CO2SectorChartProps) {
  const idx = yearIndex ?? data.years.length - 1;
  const year = data.years[idx];

  const chartData = [{
    name: year.toString(),
    ...Object.fromEntries(
      SECTOR_CONFIG.map(({ key }) => [key, Math.max(0, data.sektorer[key as SectorKey][idx] ?? 0)])
    ),
  }];

  const total = data.samletUdledning[idx] ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Sektorfordeling {year}
        </span>
        <span className="text-[11px] text-muted-foreground">
          Total: <strong className="text-foreground">{formatDanishNumber(Math.round(total / 1000), 0)} kt</strong>
        </span>
      </div>
      <div className="h-16">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 5, bottom: 0, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(0 0% 88%)" />
            <XAxis
              type="number"
              tick={{ fontSize: 9, fill: '#a3a3a3' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))}
            />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip content={<SectorTooltip total={total} />} />
            {SECTOR_CONFIG.map(({ key, label, color }) => (
              <Bar key={key} dataKey={key} name={label} stackId="a" fill={color} radius={key === 'energi' ? [2, 0, 0, 2] : key === 'industri' ? [0, 2, 2, 0] : [0, 0, 0, 0]} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
        {SECTOR_CONFIG.map(({ key, label, color }) => {
          const val = data.sektorer[key as SectorKey][idx] ?? 0;
          const pct = total > 0 ? Math.round((val / total) * 100) : 0;
          return (
            <div key={key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: color }} />
              <span>{label} <span className="text-foreground font-medium">{pct}%</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SectorTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string }>;
  total: number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      {payload.map((p) => (
        p.value > 0 && (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.fill }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-mono tabular-nums">
              {formatDanishNumber(Math.round(p.value / 1000), 0)} kt
              {total > 0 && <span className="text-muted-foreground ml-1">({Math.round(p.value / total * 100)}%)</span>}
            </span>
          </div>
        )
      ))}
    </div>
  );
}
