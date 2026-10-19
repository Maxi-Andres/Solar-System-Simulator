import { describe, it } from 'vitest';

/**
 * `describe` for the integration tests that read the generated data, or -- when there is
 * none -- a single skipped test in its place.
 *
 * Not `describe.skip`. Vitest still runs a skipped suite's body to collect its tests, and
 * these bodies work out values from the data before any test runs (`s.manifest.window`,
 * the brightest star); with no data that is a TypeError, and the whole file fails instead
 * of skipping. That is how CI went red on 2026-10-16: the day's fetch hit a VizieR 503,
 * there was no cached data for the new generator, and six files fell over on `null`.
 * Here the body is never called without data, so nothing in it can run.
 */
export function describeWithData(ready: boolean): (name: string, body: () => void) => void {
  if (ready) {
    return (name, body) => describe(name, body);
  }
  return (name) => it.skip(`${name} (no generated data; run pnpm fetch:data)`, () => {});
}
