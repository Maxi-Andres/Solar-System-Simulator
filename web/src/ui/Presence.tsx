import { createContext, useContext, useEffect, useState } from 'react';

/**
 * Keeps a panel on screen for the length of its closing animation.
 *
 * Opening needs nothing: a panel mounts and its CSS animation runs. Closing is the hard
 * half, because the toolbar unmounts a panel the instant it is closed and there is then
 * nothing left to animate. So `Presence` holds on to its children for `exitMs` after
 * `show` goes false, and tells them through context that they are on their way out --
 * `Panel` reads that and swaps its entering animation for the leaving one.
 */

/** How long the leaving animation runs, in ms. Must match `panel-out` in index.css. */
export const PANEL_EXIT_MS = 160;

const ClosingContext = createContext(false);

/** True while the surrounding panel is playing its closing animation. */
export function useClosing(): boolean {
  return useContext(ClosingContext);
}

export function Presence({
  show,
  exitMs = PANEL_EXIT_MS,
  children,
}: {
  show: boolean;
  exitMs?: number;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(show);

  useEffect(() => {
    if (show) {
      setMounted(true);
      return;
    }
    const timer = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(timer);
  }, [show, exitMs]);

  if (!show && !mounted) {
    return null;
  }
  return <ClosingContext.Provider value={!show}>{children}</ClosingContext.Provider>;
}
