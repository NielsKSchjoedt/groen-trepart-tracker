import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared shell for a horizontal control bar row. */
export function ControlBar({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {children}
    </div>
  );
}

interface ControlBarTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Non-default filter / selection active */
  active?: boolean;
  fullWidth?: boolean;
}

/** Popover/dropdown trigger — indsatsområde, region, Projektfaser, Kortvisning. */
export const ControlBarTrigger = forwardRef<HTMLButtonElement, ControlBarTriggerProps>(
  function ControlBarTrigger({
    active = false,
    fullWidth = false,
    className,
    children,
    ...props
  }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors cursor-pointer shrink-0',
          fullWidth && 'w-full min-w-0',
          active
            ? 'border-primary/30 bg-primary/5 text-primary hover:bg-primary/10'
            : 'border-border bg-card text-foreground hover:bg-muted/50',
          className,
        )}
        {...props}
      >
        {children}
      </button>
    );
  },
);

export function ControlBarCountBadge({ count }: { count: number }) {
  return (
    <span
      className="ml-0.5 inline-flex items-center justify-center min-w-[16px] h-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-white tabular-nums"
    >
      {count}
    </span>
  );
}

export interface ControlBarSegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Hide label on small screens — icon-only tab buttons. */
  hideLabelOnMobile?: boolean;
}

interface ControlBarSegmentedProps<T extends string> {
  value: T;
  options: ControlBarSegmentedOption<T>[];
  onChange: (value: T) => void;
  'aria-label': string;
  className?: string;
}

/** Segmented toggle — Mod målet / Ift. ansvar, grundkort, projekt-tal m.fl. */
export function ControlBarSegmented<T extends string>({
  value,
  options,
  onChange,
  'aria-label': ariaLabel,
  className,
}: ControlBarSegmentedProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 rounded-lg border border-border bg-muted/40 p-0.5',
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors cursor-pointer',
              selected
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
            )}
          >
            {option.icon}
            {option.hideLabelOnMobile ? (
              <span className="hidden sm:inline">{option.label}</span>
            ) : (
              option.label
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Inline label + control — e.g. «Grundkort» before a segmented group on desktop map bars. */
export function ControlBarInlineField({
  label,
  tooltip,
  children,
}: {
  label?: string;
  tooltip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label && (
        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">{label}</span>
      )}
      {children}
      {tooltip}
    </div>
  );
}

/** Stacked label above control — popover / mobile map settings. */
export function ControlBarStackedField({
  label,
  tooltip,
  children,
}: {
  label: string;
  tooltip?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
        {tooltip}
      </span>
      {children}
    </div>
  );
}
