/**
 * What is being fetched or built right now, by name, for the one line that says so
 * (ui/LoadingLine.tsx): the far layers load as the camera reaches them, and a sky that fills in
 * a few seconds later should not read as a sky that is empty.
 *
 * Each load says what it is when it starts and is done when it settles, however it ends. The
 * line shows the most recent one still going.
 */

type Listener = () => void;

const active: { readonly id: number; readonly what: string }[] = [];
const listeners = new Set<Listener>();
let nextId = 0;
let snapshot: string | null = null;

function changed(): void {
  snapshot = active.length === 0 ? null : active[active.length - 1]!.what;
  for (const listener of listeners) listener();
}

/** Starts a load named `what` ("the Local Group"); returns the function that ends it, safe to call twice. */
export function beginLoading(what: string): () => void {
  const id = nextId;
  nextId += 1;
  active.push({ id, what });
  changed();
  let ended = false;
  return () => {
    if (ended) return;
    ended = true;
    const at = active.findIndex((entry) => entry.id === id);
    if (at >= 0) active.splice(at, 1);
    changed();
  };
}

/** Runs `load` as a load named `what`. */
export function tracked<T>(what: string, load: Promise<T>): Promise<T> {
  const end = beginLoading(what);
  return load.finally(end);
}

/** For useSyncExternalStore: what is loading, the latest first, or null. */
export function loadingNow(): string | null {
  return snapshot;
}

export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
