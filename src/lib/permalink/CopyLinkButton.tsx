import { Link } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentPermalink } from './compose';
import { usePermalinkPatch } from './useViewState';

interface CopyLinkButtonProps {
  className?: string;
  /** Button label (default: «Kopiér link»). Hidden when iconOnly. */
  label?: string;
  /** Icon only — no text label. */
  iconOnly?: boolean;
  /** Optional override URL builder; defaults to current location after flush. */
  getUrl?: () => string;
}

/**
 * Copy the current view permalink to clipboard.
 * Flushes pending debounced URL updates first so toggles are captured.
 */
export function CopyLinkButton({
  className = '',
  label = 'Kopiér link',
  iconOnly = false,
  getUrl,
}: CopyLinkButtonProps) {
  const { flush } = usePermalinkPatch();

  const handleCopy = async () => {
    flush();
    // Allow React to commit URL after flush
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const url = getUrl?.() ?? getCurrentPermalink();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link kopieret');
    } catch {
      toast.error('Kunne ikke kopiere link');
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        'inline-flex items-center gap-1.5 rounded-md text-xs font-medium',
        iconOnly ? 'p-1.5' : 'px-2 py-1',
        'text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors',
        className,
      ].join(' ')}
      title="Kopiér link til denne visning"
      aria-label="Kopiér link til denne visning"
    >
      <Link className={iconOnly ? 'w-4 h-4 shrink-0' : 'w-3.5 h-3.5 shrink-0'} aria-hidden />
      {!iconOnly && <span className="truncate">{label}</span>}
    </button>
  );
}
