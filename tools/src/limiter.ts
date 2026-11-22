/**
 * A limit on how many requests a process sends one service at once, and how close together.
 *
 * Each phase of a run used to keep its own pool -- two bodies at a time -- while each body
 * could have two requests in flight of its own (a planet's vectors and its elements, a
 * craft's two coverage probes), so what JPL saw was "two, sometimes four", and two phases
 * could not overlap without doubling it. One limiter shared by every call caps what the
 * service sees, whatever the callers do, so the callers are free to keep more work queued:
 * the slots stay busy while a body is being refined or thinned between its requests.
 *
 * First come, first served. A slot is held for one attempt only: a request waiting out its
 * retry backoff holds none, so a busy minute on one body does not stall the rest.
 */

export interface LimiterOptions {
  /** Requests in flight at once, at most. */
  readonly maxConcurrent: number;
  /** Least time between the starts of two requests, ms; 0 for none. */
  readonly minSpacingMs?: number;
  /** For tests: the clock and the wait. */
  readonly now?: () => number;
  readonly sleep?: (ms: number) => Promise<void>;
}

export interface Limiter {
  /** Runs `task` once a slot is free, holding the slot until it settles. */
  run<T>(task: () => Promise<T>): Promise<T>;
  /** In flight now, and the most there have ever been at once: for the log and the tests. */
  readonly inFlight: number;
  readonly peak: number;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

export function createLimiter(options: LimiterOptions): Limiter {
  const maxConcurrent = Math.floor(options.maxConcurrent);
  if (!(maxConcurrent >= 1)) {
    throw new Error(`A limiter needs at least one slot, not ${options.maxConcurrent}.`);
  }
  const spacing = Math.max(0, options.minSpacingMs ?? 0);
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;

  let inFlight = 0;
  let peak = 0;
  // The earliest instant the next request may start; requests reserve their start in turn,
  // so two let through together are still spaced.
  let nextStart = -Infinity;
  const waiting: (() => void)[] = [];

  const release = (): void => {
    const next = waiting.shift();
    if (next === undefined) {
      inFlight -= 1;
    } else {
      // The slot passes straight on: inFlight stays as it is.
      next();
    }
  };

  const acquire = async (): Promise<void> => {
    if (inFlight < maxConcurrent && waiting.length === 0) {
      inFlight += 1;
    } else {
      await new Promise<void>((resolve) => {
        waiting.push(resolve);
      });
    }
    peak = Math.max(peak, inFlight);
    if (spacing > 0) {
      const at = Math.max(now(), nextStart);
      nextStart = at + spacing;
      const wait = at - now();
      if (wait > 0) {
        await sleep(wait);
      }
    }
  };

  return {
    async run<T>(task: () => Promise<T>): Promise<T> {
      await acquire();
      try {
        return await task();
      } finally {
        release();
      }
    },
    get inFlight() {
      return inFlight;
    },
    get peak() {
      return peak;
    },
  };
}

/**
 * A positive integer from the environment, or `fallback` when unset or empty. Anything else
 * is a mistake in the workflow and fails loudly rather than running unlimited.
 */
export function limitFromEnv(name: string, fallback: number, minimum: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name}=${raw} is not a whole number of at least ${minimum}.`);
  }
  return value;
}
