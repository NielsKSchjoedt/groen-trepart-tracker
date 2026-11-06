import { useState } from 'react';
import { Bug, X, ExternalLink } from 'lucide-react';

const REPO_URL = 'https://github.com/NielsKSchjoedt/groen-trepart-tracker';

/**
 * Build a GitHub "new issue" URL pre-filled with the current page URL
 * and a community-feedback label.
 *
 * @returns Fully encoded GitHub issue URL
 * @example buildIssueUrl() // "https://github.com/.../issues/new?title=&body=..."
 */
function buildIssueUrl(): string {
  const currentUrl = window.location.href;
  const body = `Fundet på: ${currentUrl}\n\nBeskrivelse:\n`;
  const params = new URLSearchParams({
    title: '',
    body,
    labels: 'community-feedback',
  });
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

/**
 * Floating action button that lives near the lower-left viewport corner.
 * Clicking opens a small popover with an invitation to report bugs or
 * suggest improvements, linking to GitHub Issues with the current URL
 * pre-filled in the issue body.
 *
 * Keeping it low avoids the map's left-side zoom controls on desktop.
 * The popover auto-dismisses when clicking outside.
 *
 * @example
 * // In App.tsx, outside <Routes>:
 * <BugReportFab />
 */
export function BugReportFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed left-3 bottom-4 z-[1050]">
      {/* Trigger tab */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Fejl, feedback eller ønsker"
        aria-expanded={open}
        className={[
          'flex items-center gap-1.5 rounded-full px-2.5 py-2 text-xs font-medium shadow-lg transition-all duration-200 cursor-pointer',
          'bg-foreground text-background hover:px-3.5',
          open ? 'px-3.5' : '',
        ].join(' ')}
      >
        <Bug className="w-3.5 h-3.5 flex-shrink-0" />
        <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${open ? 'max-w-[100px]' : 'max-w-0 md:max-w-[100px]'}`}>
          Feedback
        </span>
      </button>

      {/* Popover */}
      {open && (
        <>
          {/* Backdrop — closes popover on click */}
          <div
            className="fixed inset-0 z-[-1]"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 bottom-full mb-2 w-72 rounded-xl border border-border bg-background shadow-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Fejl, feedback eller ønsker</p>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                aria-label="Luk"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Har du fundet en fejl, set noget der kan forbedres, eller har du et ønske
              til siden? Opret et issue på GitHub — den aktuelle side-URL bliver automatisk
              inkluderet.
            </p>
            <a
              href={buildIssueUrl()}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="inline-flex items-center gap-2 w-full justify-center px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Opret issue på GitHub
            </a>
          </div>
        </>
      )}
    </div>
  );
}
