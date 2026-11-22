import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { HORIZONS_MAX_CONCURRENT } from '../config.ts';
import { callHorizons, horizonsLimiter } from './client.ts';
import { resetHorizonsCacheStats, useHorizonsCache } from './responseCache.ts';

/** A Horizons stand-in that answers after a tick, counting how many it is answering at once. */
function stubHorizons(): { calls: () => number; most: () => number } {
  let calls = 0;
  let running = 0;
  let most = 0;
  vi.stubGlobal('fetch', async () => {
    calls += 1;
    running += 1;
    most = Math.max(most, running);
    await new Promise((resolve) => setTimeout(resolve, 2));
    running -= 1;
    return new Response(JSON.stringify({ signature: { source: 'stub', version: '1.0' }, result: '$$SOE\n$$EOE' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { calls: () => calls, most: () => most };
}

const pastQuery = { COMMAND: '-96', CENTER: '500@0', START_TIME: '2019-01-01 00:00', STOP_TIME: '2019-01-02 00:00', STEP_SIZE: '1h' };

afterEach(() => {
  vi.unstubAllGlobals();
  useHorizonsCache(undefined);
  resetHorizonsCacheStats();
});

describe('callHorizons', () => {
  it('never has more than HORIZONS_MAX_CONCURRENT requests out, however many callers ask at once', async () => {
    const horizons = stubHorizons();
    // Three phases' worth of bodies, each asking two things together.
    await Promise.all(
      Array.from({ length: 12 }, (_, body) =>
        Promise.all([
          callHorizons({ COMMAND: String(body), STOP_TIME: '2099-01-01 00:00' }, `body ${body} vectors`),
          callHorizons({ COMMAND: String(body), TLIST: '2461000.5' }, `body ${body} elements`),
        ]),
      ),
    );
    expect(horizons.calls()).toBe(24);
    expect(horizons.most()).toBe(HORIZONS_MAX_CONCURRENT);
    expect(horizonsLimiter().peak).toBeLessThanOrEqual(HORIZONS_MAX_CONCURRENT);
    expect(horizonsLimiter().inFlight).toBe(0);
  });

  it('answers a query about the far past from the kept answer without asking again', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'horizons-client-'));
    try {
      useHorizonsCache(directory);
      const horizons = stubHorizons();
      const first = await callHorizons(pastQuery, 'past');
      const second = await callHorizons(pastQuery, 'past');
      expect(horizons.calls()).toBe(1);
      expect(second).toEqual(first);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('keeps nothing under vitest unless a directory is named', async () => {
    const horizons = stubHorizons();
    await callHorizons(pastQuery, 'past');
    await callHorizons(pastQuery, 'past');
    expect(horizons.calls()).toBe(2);
  });
});
