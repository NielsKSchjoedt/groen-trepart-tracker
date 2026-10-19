import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import type { IndsatsStatus, StatusKind } from '@/lib/kommune-indsats-status';
import { STATUS_VALUE_CLASS } from '@/lib/kommune-indsats-status';

function StatusDirectionIcon({ kind }: { kind: StatusKind }) {
  const className = 'w-3 h-3 flex-shrink-0';
  if (kind === 'over') return <ArrowUp className={className} strokeWidth={2.5} aria-hidden />;
  if (kind === 'on') return <Minus className={className} strokeWidth={2.5} aria-hidden />;
  if (kind === 'under') return <ArrowDown className={className} strokeWidth={2.5} aria-hidden />;
  return null;
}

/** Status word with up / mid / down arrow — no background fill. */
export function IndsatsStatusValue({ status }: { status: IndsatsStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${STATUS_VALUE_CLASS[status.kind]}`}
    >
      <StatusDirectionIcon kind={status.kind} />
      {status.word}
    </span>
  );
}

/** Hero chip: coloured goal dot + muted label + arrow status. */
export function IndsatsMaalChip({
  short,
  tone,
  status,
}: {
  short: string;
  tone: string;
  status: IndsatsStatus;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-2.5 py-1 text-xs shadow-sm">
      <span
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ backgroundColor: tone }}
        aria-hidden
      />
      <span className="font-medium text-muted-foreground">{short}</span>
      <IndsatsStatusValue status={status} />
    </span>
  );
}
