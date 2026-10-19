import { useState } from 'react';
import { ChevronDown, ChevronUp, Ruler, Sprout } from 'lucide-react';
import {
  formatSatserChips,
  getOrdningLines,
  getSubBudgetLines,
  mioKrToMiaKr,
  sumKilderMioKr,
} from '@/lib/budget';
import { formatDanishNumber } from '@/lib/format';
import type { BudgetData, FinansieringKategori } from '@/lib/types';
import { usePillar, getPillarConfig, type PillarId } from '@/lib/pillars';
import { cn } from '@/lib/utils';
import { KATEGORI_ACCENT } from './tones';
import { SourceLine } from './SourceLine';

interface OekonomiDelmaalProps {
  budget?: BudgetData;
}

function subBudgetLabel(kategori: FinansieringKategori): string {
  const totalMia = mioKrToMiaKr(sumKilderMioKr(kategori));
  if (kategori.id === 'lavbund-udtagning') return `~${formatDanishNumber(totalMia, 1)} mia. kr.`;
  if (kategori.id === 'kvaelstof') return '~12,3 mia. kr.';
  if (kategori.id === 'skov') return '~20 mia. kr.';
  if (kategori.id === 'natur-sammenhaengende') return `${formatDanishNumber(totalMia, 1)} mia. kr.`;
  return `${formatDanishNumber(totalMia, 1)} mia. kr.`;
}

function subBudgetNote(kategori: FinansieringKategori): string {
  if (kategori.id === 'lavbund-udtagning') {
    return 'vejledende — kulstofrige lavbundsjorde inkl. randarealer';
  }
  if (kategori.id === 'kvaelstof') {
    return 'vejledende — kvælstofreducerende virkemidler';
  }
  if (kategori.id === 'skov') {
    return 'inden for rammen — hovedparten af resten efter kvælstof & lavbund';
  }
  if (kategori.id === 'natur-sammenhaengende') {
    return 'statslige signaturprojekter + ny natur (Novo m.m. er tværgående, se Lag 1)';
  }
  return '';
}

function RealiseretBar({ kategori, accent }: { kategori: FinansieringKategori; accent: string }) {
  const maal = kategori.kilder.map((k) => k.arealMaalHa).find((a) => a != null && a > 0);
  const isN = kategori.id === 'kvaelstof';
  const realVal = isN ? kategori.realiseringTonN : kategori.realiseringHa;
  const hasReal = realVal != null;

  if (!hasReal && kategori.id === 'natur-sammenhaengende') {
    return (
      <div className="rounded-lg bg-muted/60 px-3.5 py-3 text-sm italic leading-relaxed text-muted-foreground">
        Der findes ikke ét samlet offentligt realiseringstal — naturkortet viser finansiering og
        kilder, ikke en realiseringsbar.
      </div>
    );
  }

  if (!hasReal) return null;

  const pctHa =
    !isN && maal && maal > 0 && kategori.realiseringHa != null
      ? Math.min(100, (kategori.realiseringHa / maal) * 100)
      : null;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">Realiseret</span>
        <span className="whitespace-nowrap tabular-nums">
          <strong>
            {isN
              ? `${formatDanishNumber(kategori.realiseringTonN!, 1)} ton N/år`
              : `${formatDanishNumber(Math.round(kategori.realiseringHa!))} ha`}
          </strong>
          {!isN && maal != null && (
            <span className="text-muted-foreground">
              {' '}
              / {formatDanishNumber(maal)}
            </span>
          )}
          {!isN && maal != null && <span className="text-muted-foreground"> ha</span>}
          {pctHa != null && (
            <span className="font-bold" style={{ color: accent }}>
              {' '}
              · {formatDanishNumber(pctHa, pctHa < 1 ? 2 : 0)}%
            </span>
          )}
        </span>
      </div>
      {pctHa != null ? (
        <div className="h-2.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full"
            style={{ width: `${Math.max(1.2, pctHa)}%`, background: accent }}
          />
        </div>
      ) : isN ? (
        <p className="text-xs italic text-muted-foreground">
          Faktisk anlagt (MARS) — effekt, ikke areal; vises uden bar.
        </p>
      ) : null}
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/90">
        {kategori.id === 'kvaelstof'
          ? 'Realiseret = faktisk anlagt (MARS), sammenlignet med bevilligede ordninger.'
          : kategori.id === 'lavbund-udtagning'
            ? 'Realiseret = faktisk anlagt (MARS + Klimaskovfonden). Pipeline-tallet for lavbund viser MARS alene.'
            : 'Realiseret = faktisk anlagt (MARS/KSF/NST) mod arealmål i kilderne.'}
      </p>
    </div>
  );
}

function DelmaalDetail({ kategori }: { kategori: FinansieringKategori }) {
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const accent = KATEGORI_ACCENT[kategori.id] ?? 'hsl(var(--primary))';
  const satser = formatSatserChips(kategori.satser);
  const subLines = getSubBudgetLines(kategori);
  const ordningLines = getOrdningLines(kategori);
  const showSub = subLines.length > 0;
  const showOrdninger = ordningLines.length > 0 && kategori.id !== 'skov';
  const skovOrdninger = kategori.id === 'skov' ? subLines : [];
  const primarySource = kategori.kilder.find((k) => k.kildeUrl);

  return (
    <div
      className="rounded-xl border border-border bg-card p-6 shadow-sm sm:px-[26px]"
      style={{ borderLeftWidth: 4, borderLeftColor: accent }}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <span
            className="inline-flex items-center gap-2 font-serif text-xl font-bold sm:text-[1.3rem]"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: accent }} />
            {kategori.label}
          </span>
          <p className="mt-1 pl-5 text-sm text-muted-foreground">{subBudgetNote(kategori)}</p>
        </div>
        <div className="text-right">
          <div
            className="font-serif text-3xl font-black leading-none whitespace-nowrap"
            style={{ color: accent, fontFamily: "'Fraunces', serif" }}
          >
            {subBudgetLabel(kategori)}
          </div>
          <p className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            afsat sub-budget
          </p>
        </div>
      </div>

      {kategori.badge && (
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-200">
          <Sprout className="h-3.5 w-3.5" />
          {kategori.badge}
        </div>
      )}

      <div className="mb-5">
        <RealiseretBar kategori={kategori} accent={accent} />
      </div>

      <div
        className={cn(
          'grid gap-5',
          satser.length > 0 && (showSub || showOrdninger || skovOrdninger.length > 0)
            ? 'sm:grid-cols-2'
            : 'grid-cols-1',
        )}
      >
        {satser.length > 0 && (
          <div>
            <p className="mb-2.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              <Ruler className="h-3.5 w-3.5" />
              Tilskudssatser
            </p>
            <div className="flex flex-col gap-2">
              {satser.map((s) => (
                <div
                  key={s.label}
                  className="flex justify-between gap-2 rounded-lg bg-secondary px-3 py-2 text-sm"
                >
                  <span>{s.label}</span>
                  <strong className="font-mono whitespace-nowrap" style={{ color: accent }}>
                    {s.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {(showSub || showOrdninger || skovOrdninger.length > 0) && (
          <div>
            <p className="mb-2.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {showSub || skovOrdninger.length > 0 ? 'Sub-budgetter' : 'Konkrete ordninger'}
            </p>
            <div className="flex flex-col gap-1.5">
              {(showOrdninger ? ordningLines : showSub ? subLines : skovOrdninger).map((o) => (
                <div
                  key={o.label}
                  className="flex justify-between gap-2 border-b border-border py-1.5 text-sm last:border-0"
                >
                  <span>{o.label}</span>
                  <strong className="font-mono whitespace-nowrap">{o.amount}</strong>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {kategori.kilder.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setSourcesOpen((o) => !o)}
            className="mt-4 flex w-full items-center justify-center gap-1 text-[11px] font-medium text-primary hover:underline"
          >
            {sourcesOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            Se kilder
          </button>
          {sourcesOpen && (
            <ul className="mt-2 space-y-1.5 border-t border-border/60 pt-2 text-[11px] text-muted-foreground">
              {kategori.kilder.map((k, i) => (
                <li key={`${k.kildeNavn}-${i}`}>
                  <span className="text-foreground">{k.kildeNavn}</span> —{' '}
                  {formatDanishNumber(k.beloebMioKr, 0)} mio. kr.
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
        </>
      )}

      {primarySource?.kildeUrl && (
        <SourceLine
          label={primarySource.kildeNavn}
          url={primarySource.kildeUrl}
          accentColor={accent}
        />
      )}
    </div>
  );
}

function Co2OekonomiStub() {
  return (
    <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-muted/30 px-6 py-8 text-center text-sm leading-relaxed text-muted-foreground">
      <p>
        Trepartsøkonomien i trackeren handler om arealomlægning — tilskud til projekter og kommunal
        kapacitet. CO₂-delmålet følger KF25-fremskrivningen ovenfor; der er ikke et separat
        CO₂-budget i trepartsaftalen på samme måde.
      </p>
      <p className="mt-3">
        Se ovenfor for det tværgående overblik over pengestrømme og drift — eller vælg et
        andet delmål (ikke CO₂) for finansiering pr. virkemiddel.
      </p>
    </div>
  );
}

/** Delmåls-specifik økonomi — vises når et delmål er valgt; aktivt delmål følger valgt pillar. */
export function OekonomiDelmaal({ budget }: OekonomiDelmaalProps) {
  const { activePillar } = usePillar();
  const kategorier = budget?.kategorier ?? [];

  const pillarCategoryId =
    activePillar && activePillar !== 'co2'
      ? getPillarConfig(activePillar as PillarId).budgetCategoryId
      : undefined;

  const [activeId, setActiveId] = useState(pillarCategoryId ?? kategorier[0]?.id ?? '');
  const [prevPillarCategoryId, setPrevPillarCategoryId] = useState(pillarCategoryId);
  if (prevPillarCategoryId !== pillarCategoryId) {
    setPrevPillarCategoryId(pillarCategoryId);
    if (pillarCategoryId) setActiveId(pillarCategoryId);
  }

  if (!activePillar) return null;

  if (activePillar === 'co2') {
    return (
      <div className="mx-auto w-full max-w-5xl border-t border-border px-4 py-8">
        <Co2OekonomiStub />
      </div>
    );
  }

  if (!kategorier.length) return null;

  const activeKategori =
    kategorier.find((k) => k.id === activeId) ??
    kategorier.find((k) => k.id === pillarCategoryId) ??
    kategorier[0];

  return (
    <div className="mx-auto w-full max-w-5xl border-t border-border px-4 py-8">
      <h3
        className="text-2xl font-bold sm:text-[1.5rem]"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Finansiering pr. delmål
      </h3>
      <p className="mt-1 mb-4 max-w-xl text-base text-muted-foreground">
        Vælg et andet virkemiddel for at sammenligne — dit valgte delmål er markeret.
      </p>

      <div className="mb-4 flex flex-wrap gap-2.5">
        {kategorier.map((k) => {
          const accent = KATEGORI_ACCENT[k.id] ?? '#15803d';
          const on = k.id === activeId;
          return (
            <button
              key={k.id}
              type="button"
              onClick={() => setActiveId(k.id)}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors',
                on ? 'shadow-sm' : 'bg-card hover:bg-muted/50',
              )}
              style={{
                borderColor: on ? accent : undefined,
                background: on ? `${accent}14` : undefined,
                color: on ? accent : undefined,
              }}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: accent }} />
              {k.label}
            </button>
          );
        })}
      </div>

      {activeKategori && <DelmaalDetail kategori={activeKategori} />}
    </div>
  );
}
