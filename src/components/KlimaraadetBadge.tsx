import { ExternalLink } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { KlimaraadetVurdering, KlimaraadetRisiko } from '@/lib/types';
import { cn } from '@/lib/utils';

const RISIKO_BADGE: Record<KlimaraadetRisiko, string> = {
  Lav: 'bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
  Moderat: 'bg-yellow-100 text-yellow-900 border-yellow-400 dark:bg-yellow-950/50 dark:text-yellow-200 dark:border-yellow-800',
  Væsentlig: 'bg-amber-200/90 text-amber-950 border-amber-600 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-600',
  Høj: 'bg-red-100 text-red-900 border-red-600 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800',
};

interface KlimaraadetBadgeProps {
  vurdering: KlimaraadetVurdering;
  rapportUrl: string;
  compact?: boolean;
}

/**
 * Kompakt mærke for Klimarådets risikovurdering med fuldt citat i popover.
 */
export function KlimaraadetBadge({ vurdering, rapportUrl, compact }: KlimaraadetBadgeProps) {
  const cls = RISIKO_BADGE[vurdering.risiko] ?? RISIKO_BADGE.Moderat;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-left text-[10px] font-medium leading-tight transition hover:opacity-90',
            cls,
            compact && 'w-full justify-center',
          )}
        >
          <span aria-hidden>🟡</span>
          <span>
            Klimarådet: {vurdering.risiko} risiko (Statusrapport 2026)
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,22rem)] text-sm" align="start">
        <p className="whitespace-pre-wrap text-foreground leading-relaxed">
          {vurdering.citat}
        </p>
        {vurdering.ekstraUdledningTons != null && (
          <p className="mt-2 text-xs text-muted-foreground">
            Omtalt ekstraudledning: {vurdering.ekstraUdledningTons.toLocaleString('da-DK')} ton CO₂e (jf. rapporten).
          </p>
        )}
        <a
          href={rapportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          Læs hele rapporten
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </PopoverContent>
    </Popover>
  );
}
