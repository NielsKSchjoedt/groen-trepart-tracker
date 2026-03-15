import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';

const SWIPE_DISMISS_THRESHOLD = 80;

interface MobileBottomSheetProps {
  /**
   * Called after the sheet has finished animating out.
   * The parent should hide or remove the sheet content on this callback.
   */
  onClose: () => void;
  /** Content to render inside the scrollable sheet area. */
  children: ReactNode;
}

/**
 * Mobile-only bottom sheet that slides up from the bottom of the viewport.
 *
 * Dismissal methods (in order of naturalness):
 *   1. Swipe the drag handle downward past SWIPE_DISMISS_THRESHOLD (80 px)
 *   2. Tap the semi-transparent backdrop
 *   3. Press the ✕ button inside the child panel (the child calls onClose)
 *
 * The drag handle tracks the finger in real time (no transition while
 * dragging). On release: if past threshold, the sheet animates out and
 * calls onClose after the transition; otherwise it springs back.
 * The backdrop opacity follows the drag distance for extra feedback.
 *
 * Renders nothing on md+ screens (hidden via "md:hidden" class). The parent
 * is responsible for showing a side-panel on desktop instead.
 *
 * @param onClose  - Called after the sheet has finished animating out.
 * @param children - Detail panel content to render inside the sheet.
 *
 * @example
 *   <MobileBottomSheet onClose={closePanel}>
 *     <KommuneDetailPanel ... />
 *   </MobileBottomSheet>
 */
export function MobileBottomSheet({ onClose, children }: MobileBottomSheetProps) {
  const [visible, setVisible] = useState(false);
  const [dragY, setDragY] = useState(0);
  // isDraggingState drives the CSS transition (needs to be state so render updates).
  // isDragging ref is used only inside event handlers to guard against stale closures.
  const [isDraggingState, setIsDraggingState] = useState(false);
  const isDragging = useRef(false);
  const touchStartY = useRef(0);

  useEffect(() => {
    // Defer one frame so the initial translateY(100%) is painted before we
    // transition to translateY(0), giving a smooth slide-up.
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  /** Animate the sheet out, then fire onClose once the transition ends. */
  const dismiss = useCallback(() => {
    setVisible(false);
    setDragY(0);
    setTimeout(onClose, 300);
  }, [onClose]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = true;
    setIsDraggingState(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const delta = e.touches[0].clientY - touchStartY.current;
    // Only allow dragging downward (positive delta).
    setDragY(Math.max(0, delta));
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDragging.current = false;
    setIsDraggingState(false);
    if (dragY > SWIPE_DISMISS_THRESHOLD) {
      dismiss();
    } else {
      // Spring back to resting position.
      setDragY(0);
    }
  }, [dragY, dismiss]);

  const backdropOpacity = visible ? Math.max(0, 0.4 * (1 - dragY / 200)) : 0;
  const sheetTransform = visible ? `translateY(${dragY}px)` : 'translateY(100%)';

  return (
    <>
      {/* Backdrop — tapping closes the sheet */}
      <div
        className="md:hidden fixed inset-0 z-[199] bg-black transition-opacity duration-300"
        style={{ opacity: backdropOpacity }}
        onClick={dismiss}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="md:hidden fixed inset-x-0 bottom-0 z-[200] rounded-t-2xl bg-background border-t border-x border-border shadow-2xl overflow-hidden"
        style={{
          transform: sheetTransform,
          // Disable transition while the user is actively dragging so the
          // sheet follows the finger without lag; re-enable for snap-back
          // and open/close animations.
          transition: isDraggingState ? 'none' : 'transform 300ms ease-out',
          maxHeight: '65vh',
        }}
        role="dialog"
        aria-modal="true"
      >
        {/* Drag handle — the primary swipe-to-dismiss target */}
        <div
          className="flex justify-center items-center pt-3 pb-2 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-label="Træk ned for at lukke"
        >
          <div className="w-10 h-1 rounded-full bg-muted-foreground/40" />
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(65vh - 32px)' }}>
          {children}
        </div>
      </div>
    </>
  );
}
