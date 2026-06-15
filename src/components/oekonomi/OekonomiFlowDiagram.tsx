import { ArrowRight } from 'lucide-react';
import type { FinansieringStroem } from '@/lib/types';
import { getStroemTone, STROEM_TONES } from './tones';

function FlowNode({
  children,
  tone,
  dashed,
}: {
  children: React.ReactNode;
  tone: FinansieringStroem['tone'];
  dashed?: boolean;
}) {
  const t = STROEM_TONES[tone];
  return (
    <span
      className="rounded-full px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap"
      style={{
        color: t.ink,
        background: t.chip,
        border: dashed ? `1.5px dashed ${t.line}` : `1px solid ${t.line}`,
      }}
    >
      {children}
    </span>
  );
}

function FlowRow({ stroem }: { stroem: FinansieringStroem }) {
  const t = getStroemTone(stroem);
  const isDrift = stroem.id === 'drift';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        className="w-[70px] shrink-0 text-[10px] font-bold uppercase tracking-wide"
        style={{ color: t.ink }}
      >
        {stroem.kicker}
      </span>
      <FlowNode tone={stroem.tone}>{stroem.flow[0]}</FlowNode>
      {isDrift ? (
        <span className="px-0.5 text-lg font-extrabold" style={{ color: t.ink }}>
          {stroem.flow[1]}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-muted-foreground">
          <ArrowRight className="h-4 w-4" style={{ color: t.line }} />
          <span className="text-xs italic">{stroem.flow[1]}</span>
          <ArrowRight className="h-4 w-4" style={{ color: t.line }} />
        </span>
      )}
      <FlowNode tone={stroem.tone} dashed={isDrift}>
        {stroem.flow[2]}
      </FlowNode>
    </div>
  );
}

interface OekonomiFlowDiagramProps {
  stroemme: FinansieringStroem[];
}

export function OekonomiFlowDiagram({ stroemme }: OekonomiFlowDiagramProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm sm:px-6">
      <p className="mb-3.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
        Sådan løber pengene
      </p>
      <div className="flex flex-col gap-3.5">
        {stroemme.map((s) => (
          <FlowRow key={s.id} stroem={s} />
        ))}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        To strømme finansierer to forskellige ting — projekterne (tilskud) og kommunernes planlægning
        (bloktilskud). Driftsfasen hænger fast: arealet anlægges, men der er ikke afsat varige midler
        til at passe det.
      </p>
    </div>
  );
}
