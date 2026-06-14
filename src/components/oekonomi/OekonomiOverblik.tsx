import type { BudgetData } from '@/lib/types';
import { StreamCard } from './StreamCard';
import { OekonomiFlowDiagram } from './OekonomiFlowDiagram';

interface OekonomiOverblikProps {
  budget?: BudgetData;
}

export function OekonomiOverblik({ budget }: OekonomiOverblikProps) {
  const stroemme = budget?.stroemme;
  if (!stroemme?.length) return null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 pb-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-[0.12em] text-primary">
        Hovedstrømme
      </p>
      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-[18px]">
        {stroemme.map((s) => (
          <StreamCard key={s.id} stroem={s} />
        ))}
      </div>

      <OekonomiFlowDiagram stroemme={stroemme} />
    </div>
  );
}
