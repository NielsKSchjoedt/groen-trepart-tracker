import type { BudgetData, FinansieringStroem } from '@/lib/types';
import { StreamCard } from './StreamCard';
import { OekonomiFlowDiagram } from './OekonomiFlowDiagram';
import { mioKrToMiaKr, sumKapacitetBreakdownMioKr } from '@/lib/budget';
import { formatDanishNumber } from '@/lib/format';
import { getStroemTone } from './tones';

interface OekonomiOverblikProps {
  budget?: BudgetData;
}

function streamMiaKr(stroem: FinansieringStroem): number {
  if (stroem.id === 'anlaeg') return 43;
  if (stroem.id === 'kapacitet') return mioKrToMiaKr(sumKapacitetBreakdownMioKr(stroem));
  return 0;
}

function StreamScaleBar({ stroemme }: { stroemme: FinansieringStroem[] }) {
  const rows = stroemme.map((s) => ({
    stroem: s,
    mia: streamMiaKr(s),
    tone: getStroemTone(s),
  }));
  const max = Math.max(...rows.map((r) => r.mia), 1);

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-sm font-semibold text-foreground">
        Mange penge til at lave projekterne, få til at implementere, ingen til at drifte.
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Samme enhed (mia. kr.) — så ~43, 0,46 og 0 kan sammenlignes.
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.map(({ stroem, mia, tone }) => (
          <div key={stroem.id} className="grid grid-cols-[7.5rem_1fr_4.5rem] items-center gap-2">
            <span className="text-[11px] font-medium text-foreground truncate">{stroem.title}</span>
            <div className="h-2.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: mia > 0 ? `${Math.max((mia / max) * 100, 1.2)}%` : '0%',
                  backgroundColor: tone.ink,
                  opacity: mia > 0 ? 1 : 0.25,
                }}
              />
            </div>
            <span className="text-right text-[11px] font-semibold tabular-nums" style={{ color: tone.ink }}>
              {stroem.id === 'drift' ? '0' : `~${formatDanishNumber(mia, mia >= 10 ? 0 : 2)}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OekonomiOverblik({ budget }: OekonomiOverblikProps) {
  const stroemme = budget?.stroemme;
  if (!stroemme?.length) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-primary">
        Hovedstrømme
      </p>
      <StreamScaleBar stroemme={stroemme} />
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-[18px]">
        {stroemme.map((s) => (
          <StreamCard key={s.id} stroem={s} />
        ))}
      </div>

      <OekonomiFlowDiagram stroemme={stroemme} />
    </div>
  );
}
