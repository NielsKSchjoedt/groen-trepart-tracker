import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, X } from 'lucide-react';
import {
  CHANGELOG_PATH,
  CURRENT_VERSION,
  changelog,
  formatChangelogDate,
} from '@/lib/changelog';
import { LastUpdatedBadge } from '@/components/LastUpdatedBadge';

const SEEN_VERSION_KEY = 'seen-site-version';

interface SiteTopBadgesProps {
  fetchedAt: string;
}

function VersionBadge() {
  return (
    <Link
      to={CHANGELOG_PATH}
      className="rounded-full border border-transparent px-2 py-0.5 font-mono text-[10px] font-medium leading-none text-muted-foreground/45 transition-colors hover:border-border/40 hover:bg-background/60 hover:text-muted-foreground/70"
      title="Se ændringslog"
    >
      {CURRENT_VERSION}
    </Link>
  );
}

function NewVersionNotice() {
  const latest = changelog[0];
  const [visible, setVisible] = useState(() => {
    if (!latest) return false;
    try {
      return localStorage.getItem(SEEN_VERSION_KEY) !== latest.version;
    } catch {
      return true;
    }
  });

  const dismiss = useCallback(() => {
    if (latest) {
      try {
        localStorage.setItem(SEEN_VERSION_KEY, latest.version);
      } catch {
        /* ignore */
      }
    }
    setVisible(false);
  }, [latest]);

  if (!visible || !latest) return null;

  return (
    <div
      className="flex max-w-[calc(100vw-5.5rem)] items-center gap-1 rounded-full border border-primary/15 bg-background/90 py-0.5 pl-2 pr-1 shadow-sm backdrop-blur-sm sm:max-w-[min(18rem,calc(100vw-7rem))] sm:items-start sm:gap-2 sm:rounded-xl sm:px-3 sm:py-2"
      role="status"
      aria-label={`Ny version: ${latest.summary}`}
      title={latest.summary}
    >
      <Sparkles className="h-3 w-3 shrink-0 text-primary/70 sm:mt-0.5 sm:h-3.5 sm:w-3.5" aria-hidden />

      {/* Mobile: single compact line */}
      <p className="min-w-0 flex-1 truncate text-[10px] leading-none text-muted-foreground sm:hidden">
        <span className="font-semibold text-primary/80">Ny version</span>
        {' · '}
        <Link
          to={CHANGELOG_PATH}
          onClick={dismiss}
          className="font-medium text-foreground/75 underline decoration-primary/30 underline-offset-2"
        >
          Læs mere
        </Link>
      </p>

      {/* sm+: headline + date */}
      <div className="hidden min-w-0 flex-1 space-y-0.5 sm:block">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 leading-none">
          Ny version
        </p>
        <p className="text-[11px] font-medium leading-snug text-foreground/85 line-clamp-2">
          {latest.summary}
        </p>
        <p className="text-[10px] text-muted-foreground leading-none">
          {formatChangelogDate(latest.date)}
          {' · '}
          <Link
            to={CHANGELOG_PATH}
            onClick={dismiss}
            className="underline decoration-primary/30 underline-offset-2 transition-colors hover:text-foreground"
          >
            Læs mere
          </Link>
        </p>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground sm:rounded-md"
        aria-label="Skjul meddelelse om ny version"
      >
        <X className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
      </button>
    </div>
  );
}

/**
 * Top-of-page meta: subtle version label (left), optional new-release notice,
 * and live data freshness badge (right).
 */
export function SiteTopBadges({ fetchedAt }: SiteTopBadgesProps) {
  return (
    <>
      <div className="absolute top-3 left-3 z-10 flex max-w-[calc(100vw-5.5rem)] flex-col items-start gap-1 sm:max-w-[min(18rem,calc(100vw-7rem))] sm:gap-1.5">
        <VersionBadge />
        <NewVersionNotice />
      </div>
      <LastUpdatedBadge fetchedAt={fetchedAt} />
    </>
  );
}
