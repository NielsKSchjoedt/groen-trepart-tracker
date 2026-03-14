import { useState, useEffect } from 'react';

interface LastUpdatedBadgeProps {
  /** ISO 8601 timestamp string from the data pipeline (e.g. "2026-03-14T06:00:00Z") */
  fetchedAt: string;
}

/**
 * Formats a past timestamp as a human-readable relative time string in Danish.
 *
 * @param isoString - ISO 8601 timestamp of when data was last fetched
 * @returns A short Danish relative time label, e.g. "3 timer siden", "i går", "14. mar."
 *
 * @example
 * formatRelativeTime('2026-03-14T06:00:00Z') // => "3 timer siden"
 * formatRelativeTime('2026-03-13T06:00:00Z') // => "i går"
 */
function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;

  if (isNaN(diffMs) || diffMs < 0) return 'for nylig';

  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours   = Math.floor(diffMs / 3_600_000);
  const diffDays    = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 2)  return 'lige nu';
  if (diffMinutes < 60) return `${diffMinutes} min. siden`;
  if (diffHours   < 24) return `${diffHours} time${diffHours === 1 ? '' : 'r'} siden`;
  if (diffDays    === 1) return 'i går';
  if (diffDays    < 7)  return `${diffDays} dage siden`;

  // Fallback: show the date in short Danish format
  return new Date(isoString).toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

/**
 * A fixed, subtle top-right badge that shows when the underlying data was
 * last refreshed. The blinking green dot signals that data is live and
 * auto-updating — not a static snapshot.
 *
 * Placed fixed in the viewport so it's visible on first load before the
 * StickyNav appears, and stays accessible while scrolling.
 *
 * @param fetchedAt - ISO timestamp from the ETL pipeline output
 *
 * @example
 * <LastUpdatedBadge fetchedAt={data.fetchedAt} />
 */
export function LastUpdatedBadge({ fetchedAt }: LastUpdatedBadgeProps) {
  const [label, setLabel] = useState(() => formatRelativeTime(fetchedAt));

  // Re-evaluate the label every minute so it stays accurate during long visits.
  // The initial value is already set via useState; only the interval is needed here.
  useEffect(() => {
    const id = setInterval(() => setLabel(formatRelativeTime(fetchedAt)), 60_000);
    return () => clearInterval(id);
  }, [fetchedAt]);

  return (
    <div
      className="absolute top-3 right-3 z-10 flex items-center gap-1.5 rounded-full border border-border/60 bg-background/80 backdrop-blur-sm px-2.5 py-1 shadow-sm pointer-events-none select-none"
      aria-label={`Data sidst opdateret ${label}`}
      title={`Data hentet: ${new Date(fetchedAt).toLocaleString('da-DK')}`}
    >
      {/* Blinking live dot */}
      <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>

      <span className="text-[10px] font-medium text-muted-foreground leading-none whitespace-nowrap">
        Data sidst opdateret{' '}
        <span className="text-foreground/70">{label}</span>
      </span>
    </div>
  );
}
