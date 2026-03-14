import { useState } from 'react';
import { Info } from 'lucide-react';
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
 * Reusable info (ℹ) icon that opens a popover overlay on click/tap.
 * Explains what a UI element is, where the data comes from, and
 * how aggregated numbers are calculated.
 */
export function InfoTooltip({
  content,
  title,
  source,
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
        {source && (
          <p className="text-[10px] text-muted-foreground/70 mt-2 pt-1.5 border-t border-border/50 italic">
            Kilde: {source}
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
