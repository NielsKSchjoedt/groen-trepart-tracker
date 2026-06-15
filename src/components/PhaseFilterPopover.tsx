import { useState, type ReactNode } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { phasesDifferFromDefault, type KommunePhase } from '@/lib/kommune-metrics';
import { InfoTooltip } from '@/components/InfoTooltip';
import { PhaseFilter } from '@/components/PhaseFilter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ControlBarTrigger, ControlBarCountBadge } from '@/components/ControlBar';

interface PhaseFilterPopoverProps {
  selected: Set<KommunePhase>;
  onChange: (phases: Set<KommunePhase>) => void;
  tooltipContent: ReactNode;
  align?: 'start' | 'center' | 'end';
  footer?: ReactNode;
  className?: string;
  popoverClassName?: string;
}

/**
 * Collapsed phase filter — a compact "Projektfaser" button with a count badge
 * that opens a popover with the full multi-select pill bar.
 */
export function PhaseFilterPopover({
  selected,
  onChange,
  tooltipContent,
  align = 'end',
  footer,
  className,
  popoverClassName,
}: PhaseFilterPopoverProps) {
  const [open, setOpen] = useState(false);
  const selectedPhaseCount = selected.size;
  const filtersChanged = phasesDifferFromDefault(selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ControlBarTrigger
          aria-label="Projektfaser"
          active={filtersChanged}
          className={className}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={2.2} />
          Projektfaser
          <ControlBarCountBadge count={selectedPhaseCount} />
        </ControlBarTrigger>
      </PopoverTrigger>
      <PopoverContent align={align} className={`z-[10000] w-72 p-3.5 space-y-3 ${popoverClassName ?? ''}`}>
        <div>
          <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Med i beregningen — fase
            <InfoTooltip
              title="Projektfaser"
              content={tooltipContent}
              source="MARS"
              size={11}
              side="bottom"
              align="start"
            />
          </span>
          <PhaseFilter selected={selected} onChange={onChange} />
        </div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-2.5">
            {footer}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
