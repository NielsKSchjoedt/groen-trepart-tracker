import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { KommuneCO2Data } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';

interface CO2TrendChartProps {
  data: KommuneCO2Data;
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
 * Stacked area chart showing per-sector CO₂ trend for a single municipality
 * across all available years (2018–2023).
 */
export function CO2TrendChart({ data }: CO2TrendChartProps) {
  const chartData = data.years.map((year, i) => ({
    year,
    ...Object.fromEntries(
      SECTOR_CONFIG.map(({ key }) => [key, Math.max(0, data.sektorer[key as SectorKey][i] ?? 0)])
    ),
    total: data.samletUdledning[i] ?? 0,
  }));

  // Find the min and max total to assess trend direction
  const firstTotal = chartData[0]?.total ?? 0;
  const lastTotal = chartData[chartData.length - 1]?.total ?? 0;
  const change = lastTotal - firstTotal;
  const changePct = firstTotal > 0 ? Math.round((change / firstTotal) * 100) : 0;
  const isReduction = change < 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Udvikling {data.years[0]}–{data.years[data.years.length - 1]}
        </span>
        <span
          className="text-[11px] font-semibold"
          style={{ color: isReduction ? '#16a34a' : '#f97316' }}
        >
          {isReduction ? '↓' : '↑'} {Math.abs(changePct)}%
        </span>
      </div>
      <div className="h-36">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
            <defs>
              {SECTOR_CONFIG.map(({ key, color }) => (
                <linearGradient key={key} id={`co2Trend_${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.7} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.1} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(0 0% 88%)" />
            <XAxis
              dataKey="year"
              tick={{ fontSize: 10, fill: '#a3a3a3' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#a3a3a3' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : String(Math.round(v))}
              width={28}
            />
            <Tooltip content={<TrendTooltip />} />
            {SECTOR_CONFIG.map(({ key, label, color }) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                name={label}
                stackId="1"
                stroke={color}
                fill={`url(#co2Trend_${key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1 italic">
        Ton CO₂e. Kilde: Energistyrelsen / klimaregnskabet.dk
      </p>
    </div>
  );
}

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        p.value > 0 && (
          <div key={p.name} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground">{p.name}</span>
            </div>
            <span className="font-mono tabular-nums">
              {formatDanishNumber(Math.round(p.value / 1000), 0)} kt
            </span>
          </div>
        )
      ))}
      <div className="border-t border-border/50 mt-1 pt-1 flex justify-between font-semibold">
        <span>Total</span>
        <span className="font-mono tabular-nums">{formatDanishNumber(Math.round(total / 1000), 0)} kt</span>
      </div>
    </div>
  );
}
