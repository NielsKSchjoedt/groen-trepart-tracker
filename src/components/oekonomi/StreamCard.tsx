import { AlertTriangle, Building2, Sprout, Users } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import type { FinansieringStroem } from '@/lib/types';
import { getStroemTone } from './tones';
import { SourceLine } from './SourceLine';

const STREAM_ICONS = {
  anlaeg: Sprout,
  kapacitet: Building2,
  drift: AlertTriangle,
} as const;

interface StreamCardProps {
  stroem: FinansieringStroem;
}

export function StreamCard({ stroem }: StreamCardProps) {
  // Derive the bar's denominator from the breakdown itself so the segment
  // widths always sum to 100% — a hardcoded total silently desyncs if the
  // underlying financing data is updated.
  const breakdownTotal = (stroem.breakdown ?? []).reduce((s, b) => s + b.amount, 0);
  const t = getStroemTone(stroem);
  const Icon = STREAM_ICONS[stroem.id];
  const WhoIcon = stroem.id === 'kapacitet' ? Building2 : stroem.id === 'drift' ? AlertTriangle : Users;

  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm"
      style={{ borderTopWidth: 3, borderTopColor: t.ink }}
    >
      <div className="flex flex-1 flex-col p-5 sm:p-[22px]">
        <div className="mb-3.5 flex items-center gap-2.5">
          <span
            className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px]"
            style={{ background: t.soft }}
          >
            <Icon className="h-[19px] w-[19px]" style={{ color: t.ink }} />
          </span>
          <div>
            <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: t.ink }}>
              {stroem.kicker}
            </p>
            <p className="text-base font-bold leading-tight">{stroem.title}</p>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span
            className="font-serif font-black leading-none"
            style={{
              color: t.ink,
              fontSize: stroem.heroUnit ? '2.6rem' : '2rem',
            }}
          >
            {stroem.hero}
          </span>
          {stroem.heroUnit && (
            <span className="font-serif text-lg font-bold" style={{ color: t.ink }}>
              {stroem.heroUnit}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{stroem.heroNote}</p>

        <div
          className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold"
          style={{ color: t.ink }}
        >
          <WhoIcon className="h-3.5 w-3.5" />
          {stroem.who}
        </div>

        <div className="mt-4 flex-1">
          {stroem.instruments && (
            <>
              {stroem.instruments.map((it, i) => (
                <div
                  key={it.label}
                  className={`flex justify-between gap-2.5 py-2 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold">
                      {it.label}
                      {it.privat && (
                        <span className="rounded-full border border-border bg-secondary px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          privat
                        </span>
                      )}
                    </div>
                    {it.note && (
                      <p className="text-[10px] text-muted-foreground">{it.note}</p>
                    )}
                  </div>
                  <span
                    className="shrink-0 font-serif text-sm font-bold whitespace-nowrap"
                    style={{ color: t.ink }}
                  >
                    {it.amount}
                  </span>
                </div>
              ))}
              {stroem.listNote && (
                <p className="mt-2 text-[10px] italic leading-snug text-muted-foreground">
                  {stroem.listNote}
                </p>
              )}
            </>
          )}

          {stroem.breakdown && (
            <>
              <div className="mb-3 flex h-3 overflow-hidden rounded border border-border">
                {stroem.breakdown.map((b, i) => (
                  <div
                    key={b.label}
                    title={`${b.label}: ${formatDanishNumber(b.amount, 1)} mio.`}
                    className="h-full"
                    style={{
                      width: `${breakdownTotal > 0 ? (b.amount / breakdownTotal) * 100 : 0}%`,
                      background: t.ink,
                      opacity: 0.45 + i * 0.18,
                    }}
                  />
                ))}
              </div>
              {stroem.breakdown.map((b, i) => (
                <div
                  key={b.label}
                  className={`flex justify-between gap-2.5 py-1.5 ${i > 0 ? 'border-t border-border' : ''}`}
                >
                  <div className="flex items-baseline gap-2">
                    <span
                      className="h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: t.ink, opacity: 0.45 + i * 0.18 }}
                    />
                    <div>
                      <p className="text-sm font-semibold">{b.label}</p>
                      {b.note && (
                        <p className="text-[10px] text-muted-foreground">{b.note}</p>
                      )}
                    </div>
                  </div>
                  <span className="font-mono text-sm font-semibold whitespace-nowrap">
                    {formatDanishNumber(b.amount, 1)} mio.
                  </span>
                </div>
              ))}
            </>
          )}

          {stroem.context && (
            <>
              {stroem.contextLabel && (
                <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                  {stroem.contextLabel}
                </p>
              )}
              {stroem.context.map((c) => (
                <div
                  key={c.label}
                  className="mb-2 flex justify-between gap-2.5 rounded-lg px-2.5 py-2"
                  style={{ background: t.soft }}
                >
                  <div>
                    <p className="text-sm font-semibold">{c.label}</p>
                    {c.note && (
                      <p className="text-[10px] text-muted-foreground">{c.note}</p>
                    )}
                  </div>
                  <span
                    className="font-serif text-sm font-bold whitespace-nowrap"
                    style={{ color: t.ink }}
                  >
                    {c.amount}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>

        <div
          className="mt-3.5 rounded-md border-l-[3px] px-3.5 py-3 text-sm leading-relaxed"
          style={{ background: t.soft, borderColor: t.ink }}
        >
          {stroem.keyPoint}
        </div>

        <SourceLine label={stroem.source.label} url={stroem.source.url} accentColor={t.ink} />
      </div>
    </div>
  );
}
