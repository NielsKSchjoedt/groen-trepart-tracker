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
 * Floating action button that lives on the left edge of the viewport.
 * Clicking opens a small popover with an invitation to report bugs or
 * suggest improvements, linking to GitHub Issues with the current URL
 * pre-filled in the issue body.
 *
 * On mobile the button is positioned at the bottom-left and is smaller.
 * The popover auto-dismisses when clicking outside.
 *
 * @example
 * // In App.tsx, outside <Routes>:
 * <BugReportFab />
 */
export function BugReportFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed left-0 bottom-6 md:bottom-auto md:top-1/2 md:-translate-y-1/2 z-[1050]">
      {/* Trigger tab */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Rapportér fejl eller forslag"
        aria-expanded={open}
        className={[
          'flex items-center gap-1.5 rounded-r-lg px-2.5 py-2 md:py-3 text-xs font-medium shadow-lg transition-all duration-200',
          'bg-foreground text-background hover:pr-4',
          open ? 'pr-4' : '',
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
          <div className="absolute left-0 bottom-full md:bottom-auto md:top-0 mb-2 md:mb-0 md:ml-0 md:left-full md:ml-2 w-72 rounded-xl border border-border bg-background shadow-xl p-4 animate-in fade-in slide-in-from-left-2 duration-200">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm font-semibold text-foreground">Fandt du en fejl?</p>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
                aria-label="Luk"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-4">
              Hvis du har fundet en fejl, unøjagtighed eller har et forslag til
              forbedring, kan du oprette et issue på GitHub. Den aktuelle side-URL
              bliver automatisk inkluderet.
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
