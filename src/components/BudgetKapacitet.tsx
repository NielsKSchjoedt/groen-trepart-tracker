import { useState } from 'react';
import { ChevronDown, ChevronUp, Coins } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import { mioKrToMiaKr, sumKilderMioKr } from '@/lib/budget';
import type { BudgetData, FinansieringKategori } from '@/lib/types';
import { usePillar, getPillarConfig } from '@/lib/pillars';
import { InfoTooltip } from './InfoTooltip';
import { cn } from '@/lib/utils';

interface BudgetKapacitetProps {
  data: { national: { budgetData?: BudgetData } };
}

function KategoriKort({
  kategori,
  highlight,
}: {
  kategori: FinansieringKategori;
  highlight: boolean;
}) {
  const [open, setOpen] = useState(false);
  const totalMio = sumKilderMioKr(kategori);
  const maal = kategori.kilder
    .map((k) => k.arealMaalHa)
    .find((a) => a != null && a > 0);
  const realHa = kategori.realiseringHa;
  const realTon = kategori.realiseringTonN;
  const pctHa =
    maal && realHa != null && maal > 0
      ? Math.min(100, (realHa / maal) * 100)
      : null;
  const drift = kategori.driftFinansieringMioKr;

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border bg-card p-4 transition-shadow',
        highlight ? 'border-primary ring-2 ring-primary/25 shadow-md' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-bold leading-tight" style={{ fontFamily: "'Fraunces', serif" }}>
          {kategori.label}
        </h3>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDanishNumber(mioKrToMiaKr(totalMio), 1)} mia. kr. (samlet tildelt)
        </span>
      </div>

      {(kategori.id === 'kvaelstof' ? realTon != null : realHa != null) && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {kategori.id === 'kvaelstof' ? (
            <>
              Realiseret:{' '}
              <strong>
                {formatDanishNumber(realTon!, 1)} ton N/år
              </strong>{' '}
              faktisk anlagt (MARS) — sammenlignet med bevilligede ordninger.
            </>
          ) : (
            <>
              Realiseret: <strong>{formatDanishNumber(Math.round(realHa!))} ha</strong> faktisk anlagt (MARS/KSF/NST) mod arealmål i kilderne.
            </>
          )}
        </p>
      )}

      {maal && pctHa !== null && kategori.id !== 'kvaelstof' && (
        <div className="mt-2">
          <div className="mb-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>Realisering mod arealmål (kilde-aggregat)</span>
            <span className="tabular-nums">
              {formatDanishNumber(Math.round(realHa!))} / {formatDanishNumber(maal)} ha
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary/80"
              style={{ width: `${pctHa}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {drift === null ? (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            Drift-finansiering: Ikke afsat
          </span>
        ) : (
          <span className="rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
            Drift: {formatDanishNumber(mioKrToMiaKr(drift), 1)} mia. kr.
          </span>
        )}
      </div>

      {kategori.kilder.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="mt-3 flex w-full items-center justify-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          Se kilder
        </button>
      )}
      {open && (
        <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
          {kategori.kilder.map((k, i) => (
            <li key={`${k.kildeNavn}-${i}`}>
              <span className="text-foreground">{k.kildeNavn}</span>
              {' '}
              — {formatDanishNumber(k.beloebMioKr, 0)} mio. kr.
              {k.kildeUrl && (
                <>
                  {' '}
                  <a
                    href={k.kildeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-2"
                  >
                    link
                  </a>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/90">
        Realiseret = projekter faktisk anlagt (ikke skitser eller forundersøgelse alene), jf. MARS- og
        supplerende offentlige kilder.
      </p>
    </div>
  );
}

/**
 * Sammenligning af afsat finansiering pr. hovedkategori (MGTP + trepart) med realiseret
 * areal/virkning hvor ETL har tal tilgængelige.
 */
export function BudgetKapacitet({ data }: BudgetKapacitetProps) {
  const b = data.national.budgetData;
  const { activePillar } = usePillar();
  const highlightId =
    activePillar != null ? getPillarConfig(activePillar).budgetCategoryId : undefined;

  if (!b?.kategorier?.length) {
    return null;
  }

  return (
    <section className="w-full max-w-5xl mx-auto px-4 py-8">
      <div className="mb-4 flex items-center gap-2">
        <Coins className="h-5 w-5 text-primary" />
        <h2
          className="text-lg font-bold text-foreground sm:text-xl"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Budget & kapacitet
        </h2>
        <InfoTooltip
          title="Hvad vises her?"
          content={
            <p>
              Afsatte beløb og mål efter manuelt kuraterede, offentlige kilder (treparteraftale, MGTP m.v.),
              sammenstillet med faktisk realisering som trackeren måler. Drift-efterfinansiering fremgår kun, når
              kilder angiver det — ellers vises tydeligt, at det ikke er afsat.
            </p>
          }
          size={12}
          side="right"
        />
      </div>
      {b._meta && (
        <p className="mb-4 text-xs text-muted-foreground">
          Kilde: {b._meta.kilde} — opdateret {b._meta.opdateret}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4">
        {b.kategorier.map((k) => (
          <KategoriKort key={k.id} kategori={k} highlight={k.id === highlightId} />
        ))}
      </div>
    </section>
  );
}
