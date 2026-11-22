import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { EPHEMERIS_DIRS, prepareOutputDir } from './writeOutput.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'write-output-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

/** Writes `files` (relative paths) under `directory`. */
function lay(directory: string, files: readonly string[]): void {
  for (const file of files) {
    mkdirSync(join(directory, file, '..'), { recursive: true });
    writeFileSync(join(directory, file), file);
  }
}

describe('prepareOutputDir', () => {
  it('empties the ephemerides and leaves everything a run may not write', async () => {
    const data = join(root, 'data');
    const kept = ['cosmic-web/cosmic-web.json', 'quasars/quasars.json', 'laniakea/laniakea.json', 'satellites/satellites.json', 'pulsars.json', 'manifest.json'];
    lay(data, ['vectors/removed-body/0.json', 'paths/removed-body.json', 'surface/old.json', 'small-moons/mars.json', ...kept]);

    await prepareOutputDir(data);

    for (const directory of EPHEMERIS_DIRS) {
      expect(readdirSync(join(data, directory))).toEqual([]);
    }
    for (const file of kept) {
      expect(existsSync(join(data, file))).toBe(true);
    }
  });

  it('makes the ephemerides directories in a data directory not there yet', async () => {
    await prepareOutputDir(join(root, 'fresh'));
    for (const directory of EPHEMERIS_DIRS) {
      expect(existsSync(join(root, 'fresh', directory))).toBe(true);
    }
  });
});
