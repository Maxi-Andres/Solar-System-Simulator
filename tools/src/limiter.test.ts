import { afterEach, describe, expect, it, vi } from 'vitest';

import { createLimiter, limitFromEnv } from './limiter.ts';

/** A task that resolves when told to, recording when it started. */
function gate(log: string[], name: string): { task: () => Promise<string>; open: () => void } {
  let open!: () => void;
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return {
    task: async () => {
      log.push(`start ${name}`);
      await opened;
      log.push(`end ${name}`);
      return name;
    },
    open,
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i += 1) {
    await Promise.resolve();
  }
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createLimiter', () => {
  it('never lets more than maxConcurrent run, and runs the rest in the order asked', async () => {
    const limiter = createLimiter({ maxConcurrent: 2 });
    const log: string[] = [];
    const gates = ['a', 'b', 'c', 'd'].map((name) => gate(log, name));
    const results = gates.map((g) => limiter.run(g.task));
    await flush();
    expect(log).toEqual(['start a', 'start b']);
    expect(limiter.inFlight).toBe(2);

    gates[1]!.open();
    await flush();
    expect(log).toEqual(['start a', 'start b', 'end b', 'start c']);

    gates[0]!.open();
    gates[2]!.open();
    gates[3]!.open();
    expect(await Promise.all(results)).toEqual(['a', 'b', 'c', 'd']);
    expect(limiter.peak).toBe(2);
    expect(limiter.inFlight).toBe(0);
  });

  it('frees the slot when a task fails', async () => {
    const limiter = createLimiter({ maxConcurrent: 1 });
    await expect(limiter.run(async () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(limiter.inFlight).toBe(0);
    expect(await limiter.run(async () => 'next')).toBe('next');
  });

  it('caps many callers sharing it, as the phases of a run share one', async () => {
    const limiter = createLimiter({ maxConcurrent: 3 });
    let running = 0;
    let most = 0;
    const task = async (): Promise<void> => {
      running += 1;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 1));
      running -= 1;
    };
    // Two "phases", each with its own pool of four, each body asking two things at once.
    const phase = () =>
      Promise.all(Array.from({ length: 4 }, () => Promise.all([limiter.run(task), limiter.run(task)])));
    await Promise.all([phase(), phase()]);
    expect(most).toBe(3);
    expect(limiter.peak).toBe(3);
  });

  it('spaces the starts by minSpacingMs, even when slots are free', async () => {
    let clock = 1000;
    const waits: number[] = [];
    const limiter = createLimiter({
      maxConcurrent: 4,
      minSpacingMs: 250,
      now: () => clock,
      sleep: async (ms) => {
        waits.push(ms);
      },
    });
    const starts: number[] = [];
    await Promise.all([0, 1, 2].map(() => limiter.run(async () => starts.push(clock))));
    expect(waits).toEqual([250, 500]);
    clock += 10_000;
    await limiter.run(async () => undefined);
    expect(waits).toEqual([250, 500]);
  });

  it('refuses a limit of no slots', () => {
    expect(() => createLimiter({ maxConcurrent: 0 })).toThrow();
  });
});

describe('limitFromEnv', () => {
  it('reads a whole number, falls back when unset, and refuses anything else', () => {
    vi.stubEnv('TEST_LIMIT', '');
    expect(limitFromEnv('TEST_LIMIT', 3, 1)).toBe(3);
    vi.stubEnv('TEST_LIMIT', '5');
    expect(limitFromEnv('TEST_LIMIT', 3, 1)).toBe(5);
    vi.stubEnv('TEST_LIMIT', '0');
    expect(() => limitFromEnv('TEST_LIMIT', 3, 1)).toThrow();
    vi.stubEnv('TEST_LIMIT', 'lots');
    expect(() => limitFromEnv('TEST_LIMIT', 3, 1)).toThrow();
  });
});
