import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_PREFIX = 'hint-dismissed:';

/**
 * Manages a one-time interaction hint that only shows on first visit.
 *
 * The hint auto-dismisses after `autoDismissMs` (default 10 s) or when
 * `dismiss()` is called manually. Dismissal is persisted to localStorage
 * so the hint never reappears.
 *
 * @param key            - Unique storage key for this hint
 * @param autoDismissMs  - Auto-dismiss delay in ms (0 = no auto-dismiss)
 * @returns `{ visible, dismiss }` — whether the hint should render, and a
 *          function to dismiss it programmatically.
 *
 * @example
 * const { visible, dismiss } = useFirstVisitHint('map-click', 10_000);
 * if (visible) return <Overlay onClick={dismiss}>Click to explore</Overlay>;
 */
export function useFirstVisitHint(key: string, autoDismissMs = 10_000) {
  const storageKey = STORAGE_PREFIX + key;

  const [visible, setVisible] = useState(() => {
    try {
      return !localStorage.getItem(storageKey);
    } catch {
      return true;
    }
  });

  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(storageKey, '1');
    } catch { /* quota exceeded — silently ignore */ }
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [storageKey]);

  useEffect(() => {
    if (!visible || autoDismissMs <= 0) return;
    timerRef.current = setTimeout(dismiss, autoDismissMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [visible, autoDismissMs, dismiss]);

  return { visible, dismiss } as const;
}
