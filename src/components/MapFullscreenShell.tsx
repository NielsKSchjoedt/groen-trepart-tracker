import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Maximize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MapFullscreenShellProps {
  /** Title shown in the fullscreen header bar */
  fullscreenTitle: string;
  /** Optional badge or subtitle beside the fullscreen title */
  fullscreenTitleAddon?: ReactNode;
  /** Layer toggles, base-map controls, etc. */
  controls?: ReactNode;
  /** Optional helper text below controls */
  hint?: ReactNode;
  /** Optional warning banners above the map */
  banners?: ReactNode;
  /** Optional controls rendered inside the map viewport, below the fullscreen affordance */
  mapOverlayControls?: ReactNode;
  /** Detail panel rendered beside the map (desktop) */
  sidePanel?: ReactNode;
  /** Called after toggling fullscreen so Leaflet can recalculate size */
  onResize?: () => void;
  /** Hide the expand affordance (e.g. stub maps) */
  expandDisabled?: boolean;
  /** Inline map height when not fullscreen */
  inlineMapHeight?: string;
  /** Controlled fullscreen (optional — for permalink restore). */
  isFullscreen?: boolean;
  onFullscreenChange?: (open: boolean) => void;
  children: (isFullscreen: boolean) => ReactNode;
}

/**
 * Wraps an interactive Leaflet map with an expand-to-fullscreen affordance.
 * Keeps a single DOM tree so the map instance is preserved across toggles.
 */
export function MapFullscreenShell({
  fullscreenTitle,
  fullscreenTitleAddon,
  controls,
  hint,
  banners,
  mapOverlayControls,
  sidePanel,
  onResize,
  expandDisabled = false,
  inlineMapHeight = '580px',
  isFullscreen: controlledFullscreen,
  onFullscreenChange,
  children,
}: MapFullscreenShellProps) {
  const [internalFullscreen, setInternalFullscreen] = useState(false);
  const isControlled = controlledFullscreen !== undefined;
  const isFullscreen = isControlled ? controlledFullscreen : internalFullscreen;

  const setFullscreen = useCallback(
    (open: boolean) => {
      if (!isControlled) setInternalFullscreen(open);
      onFullscreenChange?.(open);
    },
    [isControlled, onFullscreenChange],
  );

  const exitFullscreen = useCallback(() => setFullscreen(false), [setFullscreen]);
  const enterFullscreen = useCallback(() => setFullscreen(true), [setFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // Let portaled popovers/dropdowns (e.g. Lag-menu) close first.
      const openFloating = document.querySelector(
        '[data-radix-popper-content-wrapper], [data-state="open"][data-side]',
      );
      if (!openFloating) exitFullscreen();
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey, true);
    };
  }, [isFullscreen, exitFullscreen]);

  useEffect(() => {
    const timer = window.setTimeout(() => onResize?.(), 50);
    return () => window.clearTimeout(timer);
  }, [isFullscreen, onResize]);

  const controlsBlock = (controls || hint) && (
    <div
      className={cn(
        'space-y-2',
        isFullscreen && 'max-h-[45vh] overflow-y-auto border-b border-border bg-card/80 px-4 py-3',
        !isFullscreen && 'mb-0',
      )}
    >
      {controls && (
        <div className={cn('flex flex-wrap items-center gap-3', isFullscreen && 'justify-between')}>
          {controls}
        </div>
      )}
      {hint}
    </div>
  );

  return (
    <div
      className={cn(
        isFullscreen && 'fixed inset-0 z-[9999] flex flex-col bg-background',
        !isFullscreen && 'space-y-4',
      )}
    >
      {isFullscreen && (
        <div className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-2.5">
            <Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3
              className="truncate text-sm font-semibold text-foreground md:text-base"
              style={{ fontFamily: "'Fraunces', serif" }}
            >
              {fullscreenTitle}
            </h3>
            {fullscreenTitleAddon}
          </div>
          <button
            type="button"
            onClick={exitFullscreen}
            className="shrink-0 rounded-lg p-2 transition-colors hover:bg-muted"
            aria-label="Luk fuld skærm"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {controlsBlock}
      {banners && <div className={cn(isFullscreen && 'px-4 pt-3')}>{banners}</div>}

      <div className={cn(isFullscreen && 'flex min-h-0 flex-1 flex-col overflow-hidden p-3 md:p-4')}>
        <div className={cn('flex transition-all', isFullscreen && 'min-h-0 flex-1', sidePanel ? 'gap-0' : '')}>
          <div
            className={cn(
              'relative transition-all',
              sidePanel ? 'w-full md:w-3/5' : 'w-full',
              isFullscreen && 'min-h-0',
            )}
            style={!isFullscreen ? { minHeight: inlineMapHeight } : undefined}
          >
            <div
              className={cn('relative w-full', isFullscreen ? 'h-full min-h-0' : '')}
              style={!isFullscreen ? { height: inlineMapHeight } : undefined}
            >
              {children(isFullscreen)}

              {((!expandDisabled && !isFullscreen) || mapOverlayControls) && (
                <div className="absolute top-3 right-3 z-[600] flex flex-col items-end gap-2">
                  {!expandDisabled && !isFullscreen && (
                    <button
                      type="button"
                      onClick={enterFullscreen}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-background"
                      aria-label="Åbn kort i fuld skærm"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Fuld skærm</span>
                    </button>
                  )}
                  {mapOverlayControls}
                </div>
              )}
            </div>
          </div>

          {sidePanel && (
            <div className={cn(isFullscreen && 'flex h-full min-h-0 w-2/5 flex-col')}>
              {sidePanel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
