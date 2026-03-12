import { useState, useRef, useEffect } from 'react';
import { Share2, Check, Link2, Linkedin } from 'lucide-react';

interface ShareButtonProps {
  /** Danish label of the active pillar, shown in the share text and popover. */
  pillarLabel: string;
}

/**
 * Floating share button with clipboard copy and social share options.
 *
 * Opens a small popover with three actions:
 * - Copy the current URL to clipboard
 * - Share on X (Twitter)
 * - Share on LinkedIn
 *
 * @example
 * ```tsx
 * <ShareButton pillarLabel="Kvælstof" />
 * ```
 */
export function ShareButton({ pillarLabel }: ShareButtonProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close popover when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Er vi på sporet? Se ${pillarLabel.toLowerCase()}-fremskridt i Den Grønne Trepart`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setOpen(false);
      }, 1800);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = currentUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => { setCopied(false); setOpen(false); }, 1800);
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`;

  return (
    <div ref={containerRef} className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors border border-border rounded-full px-3 py-1.5 bg-card/80 hover:bg-card shadow-sm backdrop-blur-sm"
        aria-label={`Del ${pillarLabel}-visningen`}
        aria-expanded={open}
      >
        <Share2 className="w-3.5 h-3.5" />
        Del siden
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-card border border-border rounded-xl shadow-lg p-2.5 min-w-[190px] animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70 font-semibold px-2 pb-1.5">
            Del — {pillarLabel}
          </p>
          <div className="flex flex-col gap-0.5">
            <button
              role="menuitem"
              onClick={handleCopyLink}
              className="flex items-center gap-2.5 text-sm px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-left w-full text-foreground"
            >
              {copied
                ? <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                : <Link2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              }
              <span className={copied ? 'text-green-600 font-medium' : ''}>
                {copied ? 'Link kopieret!' : 'Kopier link'}
              </span>
            </button>

            <a
              role="menuitem"
              href={twitterUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 text-sm px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-foreground"
            >
              {/* X / Twitter icon — lucide doesn't have a Twitter icon so we use SVG */}
              <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.74l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              Del på X
            </a>

            <a
              role="menuitem"
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 text-sm px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-foreground"
            >
              <Linkedin className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              Del på LinkedIn
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
