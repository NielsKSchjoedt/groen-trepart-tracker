import { Leaf, MapPinned, Wheat, ShieldCheck, Shield, ExternalLink } from 'lucide-react';
import type { KommuneBenchmarkData } from '@/lib/types';
import { formatDanishNumber } from '@/lib/format';

interface KommuneNaturBenchmarkProps {
  kommuneKode: string;
  benchmark: KommuneBenchmarkData | null;
}

const DATA_ATTRIBUTION =
  'Indeholder data, som benyttes i henhold til vilkår for brug af danske offentlige data.';

/**
 * Shows municipality nature benchmark metrics (B1–B4).
 *
 * @param kommuneKode - DAWA 4-digit municipality code
 * @param benchmark - Combined B1/B2/B3/B4 data loaded from public/data
 * @example <KommuneNaturBenchmark kommuneKode="0851" benchmark={benchmark} />
 */
export function KommuneNaturBenchmark({ kommuneKode, benchmark }: KommuneNaturBenchmarkProps) {
  if (!benchmark) return null;

  const b1 = benchmark.b1.byKommune[kommuneKode];
  const b2 = benchmark.b2.byKommune[kommuneKode];
  const b3 = benchmark.b3.byKommune[kommuneKode];
  const b4 = benchmark.b4?.byKommune[kommuneKode];
  if (!b1 || !b2 || !b3) return null;

  const b1Context = buildContext(benchmark.b1.byKommune, (row) => row.dce30PctOfNational);
  const b3Context = buildContext(benchmark.b3.byKommune, (row) => row.andelLandbrugIN2000Pct ?? 0);
  const b4Context = benchmark.b4
    ? buildContext(benchmark.b4.byKommune, (row) => row.pctVaerdiBeskyttet)
    : null;

  return (
    <section className="mb-5 rounded-2xl border border-emerald-900/10 bg-gradient-to-br from-emerald-50 via-lime-50/70 to-stone-50 p-3.5 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-800/70">
            Naturtal for kommunen
          </p>
          <h3 className="text-sm font-bold text-emerald-950 mt-0.5" style={{ fontFamily: "'Fraunces', serif" }}>
            Faglige pejlemærker
          </h3>
        </div>
        <Leaf className="w-5 h-5 text-emerald-700 mt-0.5" />
      </div>

      <div className="space-y-3">
        <BenchmarkBlock
          icon={<MapPinned className="w-4 h-4 text-emerald-700" />}
          label="B1 — DCE 30 %-potentiale (andel af landet)"
          value={`${formatPct(b1.dce30PctOfNational)}%`}
          sub={`${formatHa(b1.dce30Ha)} ha i DCE 30%-laget`}
          context={`Lavest ${formatPct(b1Context.min)}% · højest ${formatPct(b1Context.max)}%`}
          tone="emerald"
        >
          <MiniBar label="DCE 30%" value={b1.dce30PctOfNational} max={b1Context.max} color="bg-emerald-700" />
          <MiniBar label="KU prio 1" value={b1.kuPrio1PctOfNational} max={Math.max(...Object.values(benchmark.b1.byKommune).map((r) => r.kuPrio1PctOfNational), 1)} color="bg-lime-700" />
        </BenchmarkBlock>

        <BenchmarkBlock
          icon={<Wheat className="w-4 h-4 text-amber-700" />}
          label="B2 — Højt+lavt naturpotentiale (marker)"
          value={`${formatPct(b2.hoejtPotentialePct + b2.lavtPotentialePct)}%`}
          sub={`${formatHa(b2.markerTotalHa)} ha marker analyseret`}
          context="Højt = KU prio 1. Lavt = DCE 30% uden KU prio 1."
          tone="amber"
        >
          <StackedPotentialBar high={b2.hoejtPotentialePct} low={b2.lavtPotentialePct} outside={b2.udenforPotentialePct} />
          <div className="grid grid-cols-3 gap-1.5 text-[10px] text-muted-foreground">
            <span>Højt {formatPct(b2.hoejtPotentialePct)}%</span>
            <span>Lavt {formatPct(b2.lavtPotentialePct)}%</span>
            <span>Udenfor {formatPct(b2.udenforPotentialePct)}%</span>
          </div>
        </BenchmarkBlock>

        <BenchmarkBlock
          icon={<ShieldCheck className="w-4 h-4 text-stone-700" />}
          label="B3 — Natura 2000 der er landbrugsjord"
          value={b3.andelLandbrugIN2000Pct === null ? 'Ingen N2000' : `${formatPct(b3.andelLandbrugIN2000Pct)}%`}
          sub={`${formatHa(b3.n2000ErLandbrugHa)} ha marker i Natura 2000`}
          context={`Lavest ${formatPct(b3Context.min)}% · højest ${formatPct(b3Context.max)}%`}
          tone="stone"
        >
          <MiniBar
            label="Landbrug i N2000"
            value={b3.andelLandbrugIN2000Pct ?? 0}
            max={Math.max(b3Context.max, 1)}
            color="bg-stone-700"
          />
        </BenchmarkBlock>

        {b4 && (
          <BenchmarkBlock
            icon={<Shield className="w-4 h-4 text-emerald-800" />}
            label="B4 — Naturværdi med §3-/Natura 2000-status"
            value={`${formatPct(b4.pctVaerdiBeskyttet)}%`}
            sub={`${formatHa(b4.overlapHa)} ha af ${formatHa(b4.naturvaerdiHa)} ha kortlagt naturværdi`}
            context={
              b4Context
                ? `Lavest ${formatPct(b4Context.min)}% · højest ${formatPct(b4Context.max)}%`
                : undefined
            }
            tone="emerald"
          >
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Af {formatHa(b4.naturvaerdiHa)} ha kortlagt naturværdi i {b4.kommuneNavn ?? b1.kommuneNavn} ligger{' '}
              {formatHa(b4.overlapHa)} ha ({formatPct(b4.pctVaerdiBeskyttet)} %) inden for beskyttet natur
              (Natura 2000/§3).
            </p>
            <MiniBar
              label="Andel med beskyttelsesstatus"
              value={b4.pctVaerdiBeskyttet}
              max={Math.max(b4Context?.max ?? 100, 1)}
              color="bg-emerald-900"
            />
          </BenchmarkBlock>
        )}
      </div>

      <p className="mt-3 text-[10px] text-emerald-900/70 leading-relaxed">
        {benchmark.b4?.disclaimer ??
          '§3 er tilstandsbeskyttelse, ikke en garanti for god naturtilstand. DCE 30 % er ét fagligt værdimål blandt flere.'}
      </p>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-emerald-900/70 leading-relaxed">
        Kilder: DCE 30%, KU prio 1+2, Markkort 2026, Natura 2000 og §3. {DATA_ATTRIBUTION}
        <a href="/data" className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-emerald-950">
          Metode <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </p>
    </section>
  );
}

function buildContext<T>(rows: Record<string, T>, pick: (row: T) => number): { min: number; max: number } {
  const values = Object.values(rows).map(pick).filter((v) => Number.isFinite(v));
  return { min: Math.min(...values, 0), max: Math.max(...values, 1) };
}

function formatPct(value: number): string {
  return value < 1 && value > 0 ? value.toFixed(1).replace('.', ',') : formatDanishNumber(Math.round(value * 10) / 10);
}

function formatHa(value: number): string {
  return formatDanishNumber(Math.round(value));
}

interface BenchmarkBlockProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  context?: string;
  tone: 'emerald' | 'amber' | 'stone';
  children: React.ReactNode;
}

function BenchmarkBlock({ icon, label, value, sub, context, tone, children }: BenchmarkBlockProps) {
  const toneClass = {
    emerald: 'border-emerald-200/70 bg-white/70',
    amber: 'border-amber-200/70 bg-white/70',
    stone: 'border-stone-200/80 bg-white/70',
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {icon}
          <p className="text-[11px] font-semibold text-foreground">{label}</p>
        </div>
        <p className="text-sm font-black tabular-nums text-foreground">{value}</p>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{sub}</p>
      <div className="mt-2 space-y-1.5">{children}</div>
      {context && <p className="text-[10px] text-muted-foreground mt-2">{context}</p>}
    </div>
  );
}

function MiniBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const width = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
        <span>{label}</span>
        <span>{formatPct(value)}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-stone-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function StackedPotentialBar({ high, low, outside }: { high: number; low: number; outside: number }) {
  return (
    <div className="h-2 rounded-full bg-stone-200 overflow-hidden flex">
      <div className="bg-emerald-800" style={{ width: `${Math.max(high, 0)}%` }} />
      <div className="bg-lime-500" style={{ width: `${Math.max(low, 0)}%` }} />
      <div className="bg-stone-300" style={{ width: `${Math.max(outside, 0)}%` }} />
    </div>
  );
}
