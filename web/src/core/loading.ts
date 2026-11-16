/**
 * What is being fetched or built right now, by name, for the one line that says so
 * (ui/LoadingLine.tsx): the far layers load as the camera reaches them, and a sky that fills in
 * a few seconds later should not read as a sky that is empty.
 *
 * Each load says what it is when it starts and is done when it settles, however it ends. The
 * line shows the most recent one still going that someone is waiting for.
 *
 * A load can start quiet: fetched ahead of need (core/prefetch.ts), with no one waiting on it,
 * it is kept off the line -- a line naming what nobody asked for would only nag. It is named
 * the moment it is wanted (`wantLoading`), if it is still on its way then.
 */

type Listener = () => void;

interface Entry {
  readonly id: number;
  readonly what: string;
  quiet: boolean;
}

const active: Entry[] = [];
const listeners = new Set<Listener>();
let nextId = 0;
let snapshot: string | null = null;

function changed(): void {
  snapshot = null;
  for (let k = active.length - 1; k >= 0; k -= 1) {
    if (!active[k]!.quiet) {
      snapshot = active[k]!.what;
      break;
    }
  }
  for (const listener of listeners) listener();
}

/**
 * Starts a load named `what` ("the Local Group"), kept off the line while `quiet`; returns the
 * function that ends it, safe to call twice.
 */
export function beginLoading(what: string, quiet = false): () => void {
  const id = nextId;
  nextId += 1;
  active.push({ id, what, quiet });
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
export function tracked<T>(what: string, load: Promise<T>, quiet = false): Promise<T> {
  const end = beginLoading(what, quiet);
  return load.finally(end);
}

/** The quiet loads named `what`, wanted now: on the line from here until they settle. */
export function wantLoading(what: string): void {
  let any = false;
  for (const entry of active) {
    if (entry.what === what && entry.quiet) {
      entry.quiet = false;
      any = true;
    }
  }
  if (any) changed();
}

/** Whether a load named `what` is going, quiet or not. */
export function isLoading(what: string): boolean {
  return active.some((entry) => entry.what === what);
}

/** For useSyncExternalStore: what is loading that someone waits for, the latest first, or null. */
export function loadingNow(): string | null {
  return snapshot;
}

export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
