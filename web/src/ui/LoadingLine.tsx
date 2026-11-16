import { useEffect, useState, useSyncExternalStore } from 'react';

import { loadingNow, subscribeLoading } from '../core/loading.ts';

/**
 * One line, bottom right above the scale bar, while a layer further out is still on its way:
 * "Loading the Local Group…" (core/loading.ts). Nothing for a load over before SHOW_AFTER_MS,
 * so a quick one does not flicker.
 */
const SHOW_AFTER_MS = 400;

export function LoadingLine() {
  const what = useSyncExternalStore(subscribeLoading, loadingNow);
  const [shown, setShown] = useState<string | null>(null);

  useEffect(() => {
    if (what === null) {
      setShown(null);
      return;
    }
    // Already showing one: the next is named at once.
    if (shown !== null) {
      setShown(what);
      return;
    }
    const timer = setTimeout(() => setShown(what), SHOW_AFTER_MS);
    return () => clearTimeout(timer);
    // `shown` is read, not followed: a change of it alone asks nothing new.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [what]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'absolute',
        right: '1.25rem',
        bottom: '3.4rem',
        color: '#8a8a8a',
        fontSize: '0.66rem',
        letterSpacing: '0.12em',
        whiteSpace: 'nowrap',
        textShadow: '0 0 6px rgba(0,0,0,0.95)',
        pointerEvents: 'none',
        opacity: shown === null ? 0 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      {shown === null ? '' : `Loading ${shown}…`}
    </div>
  );
}
