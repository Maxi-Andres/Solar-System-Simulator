import { mkdirSync, mkdtempSync, readFileSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DATA_PRODUCTS,
  dataFallbackDirectory,
  fatalError,
  planFallbacks,
  restoreProduct,
  settle,
  type DataProduct,
} from './fallback.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'data-fallback-'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

/** Writes `files` (relative paths) under `directory`, each holding its own name. */
function lay(directory: string, files: readonly string[]): void {
  for (const file of files) {
    mkdirSync(join(directory, file, '..'), { recursive: true });
    writeFileSync(join(directory, file), file);
  }
}

describe('settle', () => {
  it('turns a rejection into an outcome rather than an error', async () => {
    expect(await settle(Promise.resolve(3))).toEqual({ ok: true, value: 3 });
    const error = new Error('fetch failed');
    expect(await settle(Promise.reject(error))).toEqual({ ok: false, error });
  });
});

describe('planFallbacks', () => {
  const failed = (product: DataProduct, message = 'fetch failed') => ({ product, error: new Error(message) });

  it('copies a product whose every file the last run wrote', () => {
    lay(root, [...DATA_PRODUCTS.laniakea.complete, ...DATA_PRODUCTS.pulsars.complete]);
    const plan = planFallbacks([failed(DATA_PRODUCTS.laniakea), failed(DATA_PRODUCTS.pulsars)], root);
    expect(plan.restore.map(({ product }) => product)).toEqual([DATA_PRODUCTS.laniakea, DATA_PRODUCTS.pulsars]);
    expect(plan.fatal).toEqual([]);
  });

  it('fails a product with any file missing: a directory without its description was not written whole', () => {
    lay(root, ['stars.json', 'stars3d/tier0.bin', 'exoplanets.json']);
    const plan = planFallbacks([failed(DATA_PRODUCTS.stars)], root);
    expect(plan.restore).toEqual([]);
    expect(plan.fatal.map(({ product }) => product)).toEqual([DATA_PRODUCTS.stars]);
  });

  it('fails everything without a fallback directory, as a run always has', () => {
    const plan = planFallbacks([failed(DATA_PRODUCTS.localGroup)], null, () => true);
    expect(plan.fatal.map(({ product }) => product)).toEqual([DATA_PRODUCTS.localGroup]);
  });

  it('decides a product failed twice once, with both reasons', () => {
    const plan = planFallbacks(
      [failed(DATA_PRODUCTS.stars, 'Tycho-2 from no mirror'), failed(DATA_PRODUCTS.stars, 'the archive answered 503')],
      root,
      () => true,
    );
    expect(plan.restore).toHaveLength(1);
    expect(String(plan.restore[0]!.error)).toContain('Tycho-2 from no mirror; Error: the archive answered 503');
  });

  it('names every product nothing stood in for', () => {
    const plan = planFallbacks([failed(DATA_PRODUCTS.pulsars, 'HTTP 404'), failed(DATA_PRODUCTS.laniakea, 'TimeoutError')], null);
    const message = fatalError(plan.fatal, null).message;
    expect(message).toContain('2 products could not be built');
    expect(message).toContain('the pulsars: HTTP 404');
    expect(message).toContain('Laniakea: TimeoutError');
  });
});

describe('dataFallbackDirectory', () => {
  it('is null unset, or when the directory is not there (a first run)', () => {
    expect(dataFallbackDirectory(undefined, join(root, 'data'))).toBeNull();
    expect(dataFallbackDirectory('', join(root, 'data'))).toBeNull();
    expect(dataFallbackDirectory(join(root, 'nothing'), join(root, 'data'))).toBeNull();
  });

  it('is the directory when it is there', () => {
    mkdirSync(join(root, 'last-data'));
    expect(dataFallbackDirectory(join(root, 'last-data'), join(root, 'data'))).toBe(join(root, 'last-data'));
  });

  it('refuses the data directory itself, or one inside it: the run empties it before copying', () => {
    expect(() => dataFallbackDirectory(join(root, 'data'), join(root, 'data'))).toThrow('which this run empties');
    expect(() => dataFallbackDirectory(join(root, 'data', 'old'), join(root, 'data'))).toThrow('which this run empties');
    expect(() => dataFallbackDirectory(join(root, 'data-old'), join(root, 'data'))).not.toThrow();
  });
});

describe('restoreProduct', () => {
  it('copies every file of the product over whatever this run left, and warns on the run page', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    const from = join(root, 'last-data');
    const to = join(root, 'data');
    lay(from, ['laniakea/laniakea.json', 'laniakea/galaxies-0.bin', 'pulsars.json']);
    lay(to, ['laniakea/half-written.bin']);

    const builtOn = await restoreProduct({ product: DATA_PRODUCTS.laniakea, error: new Error('TimeoutError: aborted') }, from, to);

    expect(readFileSync(join(to, 'laniakea/galaxies-0.bin'), 'utf8')).toBe('laniakea/galaxies-0.bin');
    expect(existsSync(join(to, 'laniakea/laniakea.json'))).toBe(true);
    expect(existsSync(join(to, 'laniakea/half-written.bin'))).toBe(false);
    expect(existsSync(join(to, 'pulsars.json'))).toBe(false);
    expect(builtOn).toMatch(/^\d{4}-\d\d-\d\d$/);
    const lines = vi.mocked(console.log).mock.calls.map(([line]) => String(line));
    expect(lines).toContainEqual(expect.stringMatching(/^::warning title=Stale data%3A Laniakea::Laniakea could not be built .*TimeoutError: aborted/));
  });
});
