import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cachePath,
  DEFAULT_DOWNLOAD_CACHE,
  downloadCacheDirectory,
  throughCache,
  useDownloadCache,
  type CachedRequest,
} from './downloadCache.ts';

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

/** A table that reads only when it says it is one: what `read` checks stands in for a parser. */
function readTable(bytes: Uint8Array): string[] {
  const text = new TextDecoder().decode(bytes);
  if (!text.startsWith('table:')) {
    throw new Error(`not a table: ${text}`);
  }
  return text.slice('table:'.length).split(',');
}

let directory: string;

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'download-cache-'));
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  rmSync(directory, { recursive: true, force: true });
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  useDownloadCache(undefined);
});

function request(fetch: () => Promise<Uint8Array>, extra: Partial<CachedRequest<string[]>> = {}): CachedRequest<string[]> {
  return { key: 'https://example.org/table', label: 'the table', fetch, read: readTable, directory, ...extra };
}

describe('throughCache, static', () => {
  it('asks the host once, then answers from what it kept', async () => {
    const fetch = vi.fn(async () => encode('table:a,b'));
    expect(await throughCache(request(fetch))).toEqual(['a', 'b']);
    expect(await throughCache(request(fetch))).toEqual(['a', 'b']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readFileSync(cachePath(directory, 'https://example.org/table'), 'utf8')).toBe('table:a,b');
  });

  it('keys by the request: another query is another answer', async () => {
    await throughCache(request(async () => encode('table:a')));
    expect(await throughCache(request(async () => encode('table:z'), { key: 'https://example.org/other' }))).toEqual(['z']);
  });

  it('throws away a kept answer that no longer reads, and asks again', async () => {
    const path = cachePath(directory, 'https://example.org/table');
    writeFileSync(path, 'half a tab');
    const fetch = vi.fn(async () => encode('table:fresh'));
    expect(await throughCache(request(fetch))).toEqual(['fresh']);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readFileSync(path, 'utf8')).toBe('table:fresh');
  });

  it('keeps nothing the read refuses', async () => {
    await expect(throughCache(request(async () => encode('<html>busy</html>')))).rejects.toThrow('not a table');
    expect(existsSync(cachePath(directory, 'https://example.org/table'))).toBe(false);
  });

  it('fails as the host does when nothing is kept', async () => {
    await expect(throughCache(request(async () => Promise.reject(new Error('fetch failed'))))).rejects.toThrow('fetch failed');
  });

  it('keeps nothing without a directory', async () => {
    const fetch = vi.fn(async () => encode('table:a'));
    await throughCache(request(fetch, { directory: null }));
    await throughCache(request(fetch, { directory: null }));
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

describe('throughCache, living', () => {
  it('asks the host every time, and keeps the newest answer', async () => {
    await throughCache(request(async () => encode('table:old'), { policy: 'living' }));
    expect(await throughCache(request(async () => encode('table:new'), { policy: 'living' }))).toEqual(['new']);
    expect(readFileSync(cachePath(directory, 'https://example.org/table'), 'utf8')).toBe('table:new');
  });

  it('answers from what it kept when the host fails, and says so on the run page', async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    await throughCache(request(async () => encode('table:kept'), { policy: 'living' }));
    const failing = request(async () => Promise.reject(new Error('HTTP 503')), { policy: 'living' });
    expect(await throughCache(failing)).toEqual(['kept']);
    const lines = vi.mocked(console.log).mock.calls.map(([line]) => String(line));
    expect(lines.some((line) => line.startsWith('::warning title=the table%3A from ') && line.includes('HTTP 503'))).toBe(true);
  });

  it('answers from what it kept when the host answers with something that does not read', async () => {
    await throughCache(request(async () => encode('table:kept'), { policy: 'living' }));
    expect(await throughCache(request(async () => encode('<html>error</html>'), { policy: 'living' }))).toEqual(['kept']);
  });

  it("fails with the host's error when nothing is kept", async () => {
    const failing = request(async () => Promise.reject(new Error('HTTP 503')), { policy: 'living' });
    await expect(throughCache(failing)).rejects.toThrow('HTTP 503');
  });
});

describe('downloadCacheDirectory', () => {
  it('is tools/.cache/downloads by default, DOWNLOAD_CACHE when set, none when "off"', () => {
    vi.stubEnv('DOWNLOAD_CACHE', '');
    expect(downloadCacheDirectory()).toBe(DEFAULT_DOWNLOAD_CACHE);
    expect(DEFAULT_DOWNLOAD_CACHE.replaceAll('\\', '/')).toMatch(/tools\/\.cache\/downloads$/);
    vi.stubEnv('DOWNLOAD_CACHE', directory);
    expect(downloadCacheDirectory()).toBe(directory);
    vi.stubEnv('DOWNLOAD_CACHE', 'off');
    expect(downloadCacheDirectory()).toBeNull();
  });

  it('is what useDownloadCache set, over the environment', () => {
    vi.stubEnv('DOWNLOAD_CACHE', 'off');
    useDownloadCache(directory);
    expect(downloadCacheDirectory()).toBe(directory);
    useDownloadCache(undefined);
    expect(downloadCacheDirectory()).toBeNull();
  });
});
