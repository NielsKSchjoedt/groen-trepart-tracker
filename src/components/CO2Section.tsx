import { useEffect, useState } from 'react';
import { Factory, TrendingDown, Leaf, ExternalLink } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend, Line,
} from 'recharts';
import { loadCO2Emissions } from '@/lib/data';
import { formatDanishNumber } from '@/lib/format';
import type { CO2EmissionsData } from '@/lib/types';

/**
 * National CO₂ emissions section — shown in DetailPanel when
 * the CO₂ pillar is active.  Displays:
 *   1. Key milestone stats (reduction %, gap to target)
 *   2. Stacked area chart of emissions by sector 1990–2050
 *   3. Agriculture + LULUCF highlights relevant to Trepart
 */
export function CO2Section() {
  const [co2, setCo2] = useState<CO2EmissionsData | null>(null);

  useEffect(() => {
    loadCO2Emissions().then(setCo2);
  }, []);

  if (!co2) {
    return (
      <div className="mb-5 mt-4 p-4 rounded-lg bg-muted/50 text-center">
        <p className="text-sm text-muted-foreground animate-pulse">Indlæser CO₂-data…</p>
      </div>
    );
  }

  const m = co2.milestones;
  const gapToTarget = co2.milestones.totalExcl2030 - co2.targets.target2030ExclLulucf;
  const onTrack = gapToTarget <= 0;

  // Build chart data — show every 5th year before 2020, then every year from 2020
  const chartData = co2.years
    .map((year, i) => ({
      year,
      energy: co2.sectors.energy[i],
      industry: co2.sectors.industry[i],
      agriculture: co2.sectors.agriculture[i],
      waste: co2.sectors.waste[i],
      lulucf: co2.sectors.lulucf[i],
      total: co2.totals.exclLulucf[i],
      isProjection: year > m.lastHistoricYear,
    }))
    .filter((d) => d.year >= 1990 && (d.year <= 2035));

  return (
    <div className="mb-5 mt-4 space-y-5">
      {/* Key milestones */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Factory className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Drivhusgasudledning
          </h3>
          <InfoTooltip
            title="Drivhusgasudledning"
            content={
              <>
                <p>Viser Danmarks samlede drivhusgasudledning (ekskl. LULUCF) og fremskrivning mod 2030.</p>
                <p><strong>Reduktion 2023:</strong> Faktisk opnået reduktion ift. 1990-niveau.<br/>
                <strong>Reduktion 2030:</strong> KF25-fremskrevet reduktion — Klimaloven kræver 70%.</p>
              </>
            }
            source="KF25 — Klimafremskrivning 2025 (KEFM)"
            size={12}
            side="right"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MilestoneStat
            value={`${m.reduction2023Pct}%`}
            label="Reduktion 2023"
            sub="(faktisk)"
            color="#737373"
          />
          <MilestoneStat
            value={`${m.reduction2030Pct}%`}
            label="Reduktion 2030"
            sub="(fremskrevet)"
            color={onTrack ? '#16a34a' : '#f97316'}
          />
          <MilestoneStat
            value={`${formatDanishNumber(m.totalExcl2023, 1)}`}
            label="Mio. ton 2023"
            sub="ekskl. LULUCF"
            color="#737373"
          />
          <MilestoneStat
            value={onTrack ? 'På sporet' : `${formatDanishNumber(Math.abs(gapToTarget), 2)} mio. t`}
            label={onTrack ? 'Mål nået' : 'Mangler i 2030'}
            sub={`Mål: ${formatDanishNumber(co2.targets.target2030ExclLulucf, 1)} mio. t`}
            color={onTrack ? '#16a34a' : '#dc2626'}
          />
        </div>
      </div>

      {/* Emissions trajectory chart */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            National udledning 1990–2035
          </h4>
          <InfoTooltip
            title="Udledningsgraf"
            content={
              <>
                <p>Stablede arealer viser udledning pr. sektor (mio. ton CO₂-ækvivalenter, ekskl. LULUCF). Data til venstre for den stiplede linje er historisk; til højre er KF25-fremskrivning.</p>
                <p>Den mørke linje viser det <strong>faktiske nationale total</strong> (excl. LULUCF) inkl. CCS/kulstoffjernelse der ikke er synlig som separat sektor. Den røde stiplede linje viser 70%-reduktionsmålet.</p>
                <p>Transport er inkluderet i <strong>energisektoren</strong> efter Danmarks UNFCCC-opgørelsesmetode og er ikke adskilt i KF25-kildetabellerne.</p>
              </>
            }
            source="KF25 — Klimafremskrivning 2025 (KEFM)"
            size={11}
            side="right"
          />
        </div>
        <div className="h-52 -ml-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="co2Energy" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="co2Agriculture" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a16207" stopOpacity={0.7} />
                  <stop offset="95%" stopColor="#a16207" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="co2Industry" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1} />
                </linearGradient>
                <linearGradient id="co2Waste" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a3a3a3" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#a3a3a3" stopOpacity={0.1} />
                </linearGradient>
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
                tickFormatter={(v: number) => `${v}`}
                width={30}
                label={{ value: 'mio. t', angle: -90, position: 'insideLeft', fontSize: 9, fill: '#a3a3a3', dx: -5 }}
              />
              <Tooltip content={<CO2Tooltip lastHistoricYear={m.lastHistoricYear} />} />
              <ReferenceLine
                x={m.lastHistoricYear}
                stroke="#d4d4d4"
                strokeDasharray="4 4"
                label={{ value: 'Fremskrivning →', position: 'top', fontSize: 9, fill: '#a3a3a3' }}
              />
              <ReferenceLine
                y={co2.targets.target2030ExclLulucf}
                stroke="#dc2626"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                label={{ value: '70% mål', position: 'right', fontSize: 9, fill: '#dc2626' }}
              />
              <Area
                type="monotone"
                dataKey="energy"
                stackId="1"
                stroke="#64748b"
                fill="url(#co2Energy)"
                name="Energi"
              />
              <Area
                type="monotone"
                dataKey="industry"
                stackId="1"
                stroke="#6366f1"
                fill="url(#co2Industry)"
                name="Industri"
              />
              <Area
                type="monotone"
                dataKey="agriculture"
                stackId="1"
                stroke="#a16207"
                fill="url(#co2Agriculture)"
                name="Landbrug"
              />
              <Area
                type="monotone"
                dataKey="waste"
                stackId="1"
                stroke="#a3a3a3"
                fill="url(#co2Waste)"
                name="Affald"
              />
              {/* Total line (excl. LULUCF) — includes CCS/negative components not visible in stacked sectors */}
              <Line
                type="monotone"
                dataKey="total"
                stroke="#1e293b"
                strokeWidth={1.5}
                dot={false}
                name="Total ekskl. LULUCF"
                legendType="line"
              />
              <Legend
                verticalAlign="bottom"
                height={24}
                iconSize={8}
                wrapperStyle={{ fontSize: 10 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 italic">
          Ekskl. LULUCF. Mørk linje = faktisk total (inkl. CCS). Rød stiplet = 70%-mål. Transport indgår i energisektoren. Kilde: KF25 (KEFM).
        </p>
      </div>

      {/* Agriculture + LULUCF highlight */}
      <div className="p-3.5 rounded-lg bg-muted/40 border border-border/50">
        <div className="flex items-center gap-1.5 mb-2.5">
          <Leaf className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Trepart-relevante sektorer
          </span>
          <InfoTooltip
            title="Trepart-relevante sektorer"
            content={
              <p>Landbrug og LULUCF (arealanvendelse, skov og jord) er de sektorer som den grønne trepart-aftale primært adresserer. CO₂-afgift på landbrug fra 2030 og udtagning af lavbundsarealer skal reducere udledningerne markant.</p>
            }
            size={11}
            side="right"
          />
        </div>
        <div className="space-y-3">
          <SectorRow
            label="Landbrug"
            description="Kvæg, gylle, gødning (CO₂-afgift fra 2030)"
            from={m.agriculture2023}
            to={m.agriculture2030}
            fromYear="2023"
            toYear="2030"
            color="#a16207"
          />
          <SectorRow
            label="LULUCF"
            description="Skov, kulstof i jord, vådområder"
            from={m.lulucf2023}
            to={m.lulucf2030}
            fromYear="2023"
            toYear="2030"
            color="#15803d"
          />
        </div>
        <p className="text-[10px] text-muted-foreground mt-3">
          Udtagning af lavbundsarealer og skovrejsning i den grønne trepart bidrager til
          at reducere LULUCF-udledningen og øge kulstofoptaget.
        </p>
      </div>

      {/* Source link */}
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <TrendingDown className="w-3 h-3" />
        <span>
          Data fra{' '}
          <a
            href={co2.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30"
          >
            KF25 (KEFM) <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </span>
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function MilestoneStat({
  value,
  label,
  sub,
  color,
}: {
  value: string;
  label: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="text-center p-2.5 rounded-lg bg-muted/30 border border-border/30">
      <p className="text-lg font-bold" style={{ fontFamily: "'Fraunces', serif", color }}>
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
      <p className="text-[9px] text-muted-foreground/70 leading-tight">{sub}</p>
    </div>
  );
}

function SectorRow({
  label,
  description,
  from,
  to,
  fromYear,
  toYear,
  color,
}: {
  label: string;
  description: string;
  from: number;
  to: number;
  fromYear: string;
  toYear: string;
  color: string;
}) {
  const change = to - from;
  const isReduction = change < 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-foreground">{label}</span>
          <p className="text-[10px] text-muted-foreground">{description}</p>
        </div>
        <span
          className="text-xs font-semibold whitespace-nowrap"
          style={{ color: isReduction ? '#16a34a' : '#f97316' }}
        >
          {isReduction ? '↓' : '↑'} {formatDanishNumber(Math.abs(change), 2)} mio. t
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
        <span>
          {fromYear}: <strong style={{ color }}>{formatDanishNumber(from, 2)}</strong>
        </span>
        <span>→</span>
        <span>
          {toYear}: <strong style={{ color }}>{formatDanishNumber(to, 2)}</strong> mio. t
        </span>
      </div>
    </div>
  );
}

/* Custom tooltip for the emissions chart */
function CO2Tooltip({
  active,
  payload,
  label,
  lastHistoricYear,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: number;
  lastHistoricYear: number;
}) {
  if (!active || !payload?.length) return null;

  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  const isProjection = (label ?? 0) > lastHistoricYear;

  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-foreground mb-1">
        {label} {isProjection && <span className="text-muted-foreground font-normal">(fremskrivning)</span>}
      </p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-sm" style={{ backgroundColor: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
          </div>
          <span className="font-mono tabular-nums">{formatDanishNumber(p.value, 1)}</span>
        </div>
      ))}
      <div className="border-t border-border/50 mt-1 pt-1 flex justify-between font-semibold">
        <span>Total</span>
        <span className="font-mono tabular-nums">{formatDanishNumber(total, 1)} mio. t</span>
      </div>
    </div>
  );
}
