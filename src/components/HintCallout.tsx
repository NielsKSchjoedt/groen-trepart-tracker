import { X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type ArrowSide = 'left' | 'right' | 'top' | 'bottom' | 'none';

interface HintCalloutProps {
  /** Lucide icon component */
  icon: LucideIcon;
  /** Short hint text */
  text: string;
  /** Which side the arrow points toward (i.e. where the target is) */
  arrow: ArrowSide;
  /** Called when the user clicks the close button */
  onDismiss: () => void;
  /** Extra className on the outer wrapper (use for positioning) */
  className?: string;
}

/**
 * Floating hint callout with a CSS triangle arrow pointing toward the
 * element it describes. Floats absolutely over content on all screen sizes
 * with a close (X) button in the top-right corner.
 *
 * On desktop the caller typically positions it to the right of content
 * (`translate-x-full`); on mobile it overlays the content area.
 *
 * @param icon      - Lucide icon to show beside the text
 * @param text      - Short hint message
 * @param arrow     - Side where the triangle arrow appears ('none' to hide it)
 * @param onDismiss - Called when the user clicks X
 * @param className - Positioning classes (applied to the outer wrapper)
 *
 * @example
 * <HintCallout
 *   icon={SlidersHorizontal}
 *   text="Prøv scenarievælgeren"
 *   arrow="left"
 *   onDismiss={hint.dismiss}
 *   className="absolute right-3 top-3 lg:-right-2 lg:top-4 lg:translate-x-full"
 * />
 */
export function HintCallout({ icon: Icon, text, arrow, onDismiss, className = '' }: HintCalloutProps) {
  return (
    <div
      className={`z-50 select-none cursor-pointer ${className}`}
      onClick={(e) => { e.stopPropagation(); onDismiss(); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onDismiss(); }}
    >
      <div className="relative hint-float-anim">
        {arrow !== 'none' && <span className={arrowClasses(arrow)} />}
        <div className="bg-primary/[0.25] backdrop-blur-sm border border-primary/45 rounded-xl pl-3.5 pr-8 py-2.5 shadow-md flex items-center gap-2 max-w-[240px]">
          <Icon className="w-4 h-4 text-primary flex-shrink-0" strokeWidth={1.8} />
          <span className="text-xs font-medium text-primary leading-snug">{text}</span>
        </div>
        <span
          className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-primary/50 hover:text-primary hover:bg-primary/10 transition-colors"
          aria-hidden="true"
        >
          <X className="w-3 h-3" strokeWidth={2.5} />
        </span>
      </div>
    </div>
  );
}

/**
 * Returns Tailwind classes for the CSS-triangle arrow on the specified side.
 *
 * Each arrow is a 0x0 element with transparent borders on three sides
 * and a colored border on the fourth, forming a triangle.
 */
function arrowClasses(side: ArrowSide): string {
  const base = 'absolute w-0 h-0';
  switch (side) {
    case 'left':
      return `${base} top-1/2 -translate-y-1/2 -left-2 border-y-[6px] border-y-transparent border-r-[8px] border-r-primary/45`;
    case 'right':
      return `${base} top-1/2 -translate-y-1/2 -right-2 border-y-[6px] border-y-transparent border-l-[8px] border-l-primary/45`;
    case 'top':
      return `${base} left-1/2 -translate-x-1/2 -top-2 border-x-[6px] border-x-transparent border-b-[8px] border-b-primary/45`;
    case 'bottom':
      return `${base} left-1/2 -translate-x-1/2 -bottom-2 border-x-[6px] border-x-transparent border-t-[8px] border-t-primary/45`;
    case 'none':
      return 'hidden';
  }
}
