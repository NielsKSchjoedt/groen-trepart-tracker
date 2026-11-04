import { Link } from 'lucide-react';
import { toast } from 'sonner';
import { buildSectionPermalink } from './slices/section';
import { usePermalinkPatch } from './useViewState';

interface SectionLinkCopyProps {
  sectionId: string;
  className?: string;
}

/**
 * Compact link icon shown on hover; copies a permalink to the section anchor.
 */
export function SectionLinkCopy({ sectionId, className = '' }: SectionLinkCopyProps) {
  const { flush } = usePermalinkPatch();

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    flush();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const url = buildSectionPermalink(sectionId);
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
      aria-label="Kopiér link til sektion"
      title="Kopiér link til sektion"
      className={[
        'inline-flex shrink-0 items-center justify-center rounded p-0.5',
        'text-muted-foreground/70 hover:text-foreground hover:bg-muted/60',
        'opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
        className,
      ].join(' ')}
    >
      <Link className="h-3 w-3" aria-hidden />
    </button>
  );
}
