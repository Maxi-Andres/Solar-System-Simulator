/**
 * Work that can wait for the page to be idle: run once the browser has nothing else to do --
 * the first frames drawn, the files they needed in -- or after `timeoutMs` whatever happens, so
 * it is never put off for long. What the first view does not show goes here, so that view is
 * not held back by it. Returns a function that cancels it.
 *
 * Safari has no requestIdleCallback; there it waits a frame's worth of milliseconds after the
 * page's own work, which is close enough.
 */
export function whenIdle(work: () => void, timeoutMs = 2000): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(work, { timeout: timeoutMs });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(work, Math.min(timeoutMs, 200));
  return () => clearTimeout(handle);
}
