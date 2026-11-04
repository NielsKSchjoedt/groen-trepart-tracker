import { ExternalLink } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { KlimaraadetVurdering, KlimaraadetRisiko } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Accent dot per risk tier — the badge itself stays neutral. */
const RISIKO_DOT: Record<KlimaraadetRisiko, string> = {
  Lav: '#16a34a',
  Moderat: '#ca8a04',
  Væsentlig: '#d97706',
  Høj: '#dc2626',
};

interface KlimaraadetBadgeProps {
  vurdering: KlimaraadetVurdering;
  rapportUrl: string;
  compact?: boolean;
}

/**
 * Subtle footnote-style link to Klimarådets risikovurdering. Full citat in popover.
 */
export function KlimaraadetBadge({ vurdering, rapportUrl, compact }: KlimaraadetBadgeProps) {
  const dotColor = RISIKO_DOT[vurdering.risiko] ?? RISIKO_DOT.Moderat;
  const label = `Klimarådet · ${vurdering.risiko.toLowerCase()} risiko`;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label} — læs vurdering fra Statusrapport 2026`}
          className={cn(
            'inline-flex max-w-full items-center gap-1.5 rounded-md border border-border/40',
            'bg-muted/25 px-2 py-1 text-left text-[9px] leading-snug text-muted-foreground',
            'transition-colors hover:border-border/70 hover:bg-muted/40 hover:text-foreground/90',
            compact && 'w-full',
          )}
        >
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: dotColor }}
            aria-hidden
          />
          <span className="min-w-0 truncate">
            <span className="font-medium text-foreground/75">Klimarådet</span>
            <span className="text-muted-foreground/70"> · </span>
            <span style={{ color: dotColor }}>{vurdering.risiko.toLowerCase()} risiko</span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(100vw-2rem,22rem)] text-sm" align="start">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Klimarådet · Statusrapport 2026
        </p>
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
