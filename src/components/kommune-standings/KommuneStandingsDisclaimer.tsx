import { AlertTriangle } from 'lucide-react';

interface KommuneStandingsDisclaimerProps {
  text?: string;
  compact?: boolean;
}

/**
 * Prominent disclaimer for kommune competition framing (DN nuance).
 */
export function KommuneStandingsDisclaimer({
  text = 'Der findes ingen officiel kommunal fordeling af naturmålet. Ranglisten bruger naturpotentiale som fagligt stand-in for ansvar — ikke en politisk forpligtelse.',
  compact = false,
}: KommuneStandingsDisclaimerProps) {
  return (
    <div
      className={[
        'flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 text-amber-900',
        'dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200',
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm',
      ].join(' ')}
    >
      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-500" strokeWidth={2} />
      <p className="leading-relaxed">{text}</p>
    </div>
  );
}
