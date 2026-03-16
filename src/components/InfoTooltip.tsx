import { useState } from 'react';
import { Info, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface InfoTooltipProps {
  /** The info content — can be a string or JSX */
  content: React.ReactNode;
  /** Optional title shown in bold at the top */
  title?: string;
  /** Optional data source label */
  source?: string;
  /**
   * Optional anchor hash linking to a section on /data-og-metode
   * (e.g. "#kvalitet" or "#datakilder"). When provided, a "Læs mere"
   * link is rendered at the bottom of the popover.
   */
  methodLink?: string;
  /** Size of the info icon in pixels (default: 14) */
  size?: number;
  /** Extra className on the trigger button */
  className?: string;
  /** Popover side preference */
  side?: 'top' | 'right' | 'bottom' | 'left';
  /** Popover alignment */
  align?: 'start' | 'center' | 'end';
}

/**
 * Reusable info icon that opens a popover overlay on click/tap.
 * Explains what a UI element is, where the data comes from, and
 * how aggregated numbers are calculated.
 *
 * When `methodLink` is provided, a small "Læs mere i Data & metode"
 * anchor is rendered at the bottom, pointing to the relevant section
 * on the /data-og-metode page.
 *
 * @param content - Popover body (string or JSX)
 * @param title - Optional bold header
 * @param source - Optional "Kilde:" footer line
 * @param methodLink - Optional hash anchor on /data-og-metode (e.g. "#kvalitet")
 * @param size - Icon pixel size (default 14)
 * @param className - Extra classes on the trigger
 * @param side - Popover side preference
 * @param align - Popover alignment
 *
 * @example
 * <InfoTooltip
 *   title="Kvælstof"
 *   content="Ton N reduceret via projekter..."
 *   source="MARS API"
 *   methodLink="#kvalitet"
 * />
 */
export function InfoTooltip({
  content,
  title,
  source,
  methodLink,
  size = 14,
  className = '',
  side = 'top',
  align = 'center',
}: InfoTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          className={`inline-flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring p-0.5 cursor-pointer ${className}`}
          aria-label="Vis information"
          onClick={(e) => e.stopPropagation()}
        >
          <Info style={{ width: size, height: size }} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align={align}
        className="w-72 p-3.5 text-xs leading-relaxed z-[9999]"
        onPointerDownOutside={() => setOpen(false)}
      >
        {title && (
          <p className="font-semibold text-foreground text-[13px] mb-1.5">{title}</p>
        )}
        <div className="text-muted-foreground space-y-1.5">{content}</div>
        {(source || methodLink) && (
          <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between gap-2">
            {source && (
              <p className="text-[10px] text-muted-foreground/70 italic">
                Kilde: {source}
              </p>
            )}
            {methodLink && (
              <Link
                to={`/data-og-metode${methodLink}`}
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors whitespace-nowrap ml-auto"
              >
                <BookOpen className="w-2.5 h-2.5" />
                Læs mere
              </Link>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
