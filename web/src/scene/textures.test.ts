import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { CATALOG } from '@sss/tools/catalog';
import { textureUrl } from './textureCache.ts';

/**
 * The surface maps as files on disk, and the promise made about them.
 *
 * CREDITS.md says "every file added here must be recorded below with its source and
 * license". That was an instruction to a future person, which is another way of
 * saying it was going to be broken eventually. These tests make it a rule the build
 * enforces: an unattributed image cannot ship, and a body cannot point at a map that
 * is not there.
 *
 * Cheap to run and they cover the failure that is hardest to notice -- a texture that
 * 404s in production leaves the body flat-coloured, which looks exactly like a body
 * that was never given a texture at all.
 */

const TEXTURE_DIR = join(import.meta.dirname, '../../public/textures');

const files = (await readdir(TEXTURE_DIR)).filter((name) => !name.endsWith('.md'));
const credits = await readFile(join(TEXTURE_DIR, 'CREDITS.md'), 'utf8');

describe('the texture files', () => {
  it('gives every body in the catalog a map that exists', async () => {
    for (const body of CATALOG) {
      expect(body.texture, body.id).not.toBeNull();
      expect(files, body.id).toContain(body.texture);
    }
  });

  it('ships no image that no body uses', () => {
    const used = new Set(CATALOG.map((body) => body.texture));

    for (const file of files) {
      expect(used, file).toContain(file);
    }
  });

  it('records every file in CREDITS.md, with a source and a licence', () => {
    for (const file of files) {
      const row = credits.split('\n').find((line) => line.includes(`\`${file}\``));

      expect(row, `${file} is not credited`).toBeDefined();
      // A markdown table row: file, body, source link, licence.
      expect(row!.split('|').filter((cell) => cell.trim() !== '').length, file).toBe(4);
      expect(row, file).toMatch(/https?:\/\//);
    }
  });

  it('keeps the whole set small enough to ship', async () => {
    const sizes = await Promise.all(
      files.map(async (file) => (await stat(join(TEXTURE_DIR, file))).size),
    );
    const totalMb = sizes.reduce((sum, size) => sum + size, 0) / 1024 / 1024;

    // 4.3 MB today. They are committed, so this is a guard on the repository as much
    // as on the page: swapping in 8k maps would be a 40 MB decision, not an accident.
    expect(totalMb).toBeLessThan(6);
    // And nothing is a stub: the smallest, Uranus, is a 76 KB featureless disc.
    expect(Math.min(...sizes)).toBeGreaterThan(50_000);
  });
});

describe('textureUrl', () => {
  it('builds a path under the site base, not the server root', () => {
    // In the published build the base is /Solar-System-Simulator/. Hardcoding a
    // leading slash works locally and 404s on Pages, which is the classic way a
    // project site breaks.
    expect(textureUrl('earth.jpg')).toBe(`${import.meta.env.BASE_URL}textures/earth.jpg`);
    expect(textureUrl('earth.jpg')).toContain('textures/earth.jpg');
  });
});
