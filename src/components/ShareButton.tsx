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

  const twitterUrl   = `https://twitter.com/intent/tweet?url=${encodeURIComponent(currentUrl)}&text=${encodeURIComponent(shareText)}`;
  const linkedInUrl  = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(currentUrl)}`;
  const facebookUrl  = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(currentUrl)}`;
  const redditUrl    = `https://www.reddit.com/submit?url=${encodeURIComponent(currentUrl)}&title=${encodeURIComponent(shareText)}`;

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

            <a
              role="menuitem"
              href={facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 text-sm px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-foreground"
            >
              {/* Facebook "f" wordmark */}
              <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z" />
              </svg>
              Del på Facebook
            </a>

            <a
              role="menuitem"
              href={redditUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 text-sm px-2 py-2 rounded-lg hover:bg-muted/60 transition-colors text-foreground"
            >
              {/* Reddit alien logo */}
              <svg className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
              </svg>
              Del på Reddit
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
