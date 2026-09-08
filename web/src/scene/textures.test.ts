import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { decode } from 'jpeg-js';
import { describe, expect, it } from 'vitest';

import { CATALOG, TEXTURE_SETS } from '@sss/tools/catalog';
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

/** Every (body, set) pair, flattened, since both sets ship. */
const variants = CATALOG.flatMap((body) =>
  TEXTURE_SETS.map((set) => ({ id: body.id, set: set.id, ...body.textures[set.id] })),
);

/**
 * Ring maps are a different kind of image and are tested differently.
 *
 * A surface map is an opaque equirectangular photograph. A ring map is a radial strip
 * that is mostly transparent and carries its meaning in the alpha channel. Checks
 * written for one are wrong for the other: the "no unmapped region" test reads a ring
 * map's transparent 6% as a hole, and the minimum-file-size floor reads its 10 KB as
 * a stub. Separating them is not a loosening -- each set gets the check that applies.
 */
const surfaceMaps = [...new Set(variants.map((v) => v.file))];
const ringMaps = [
  ...new Set(CATALOG.flatMap((body) => (body.rings === null ? [] : [body.rings.texture]))),
];

describe('the texture files', () => {
  it('gives every body in every set a map that exists', () => {
    for (const v of variants) {
      expect(files, `${v.id}/${v.set}`).toContain(v.file);
    }
  });

  it('gives every ring system a map that exists', () => {
    for (const file of ringMaps) {
      expect(files).toContain(file);
    }
    // One body with rings, and a test that says so: Jupiter, Uranus and Neptune all
    // have real ring systems, and all three are far too faint to draw at true
    // brightness. Saturn's are the only ones this catalog claims.
    expect(ringMaps).toEqual(['saturn-rings.png']);
  });

  it('ships no image that nothing uses', () => {
    const used = new Set([...surfaceMaps, ...ringMaps]);

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

    // 5.0 MB today across both sets. They are committed, so this is a guard on the
    // repository as much as on the page: swapping in 8k maps would be a 40 MB
    // decision, not an accident.
    expect(totalMb).toBeLessThan(8);
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

/**
 * No map may ship with a hole in it.
 *
 * Pluto's original mosaic has one: New Horizons flew past in July 2015, when Pluto's
 * southern hemisphere was in polar winter and simply could not be photographed. Thirty
 * percent of the file was black, and a black cap on a rendered body reads as a
 * rendering fault rather than as missing data.
 *
 * It is filled with the average colour of the mapped part, with the boundary relaxed so
 * there is no seam. That is invented, and it is labelled as invented in CREDITS.md, the
 * README and the About panel. This test exists so the next map with a gap is noticed
 * rather than shipped.
 */
describe('no map has an unfilled gap', () => {
  /**
   * Fraction of pixels that are *black*, not merely dark.
   *
   * The distinction is the whole test, and it took a false positive to see it. The
   * first version flagged anything under luminance 12, which failed Blue Marble: 20%
   * of true-colour Earth is deep ocean that genuinely renders that dark. Real dark
   * data has variation, spreads across latitudes and never reaches zero -- Blue
   * Marble's darkest pixels sit at luminance 2 to 12 with a standard deviation of 2.
   * An unmapped region is exactly zero, and survives JPEG as exactly zero, which is
   * what Pluto's polar night was before it was filled.
   *
   * So the threshold is near-zero rather than dark, and it still catches the case it
   * was written for by a factor of thirty.
   */
  const blackFraction = (pixels: {
    data: Uint8Array | Buffer;
    width: number;
    height: number;
  }) => {
    let black = 0;
    for (let i = 0; i < pixels.width * pixels.height; i += 1) {
      const o = i * 4;
      const luminance =
        0.299 * pixels.data[o]! + 0.587 * pixels.data[o + 1]! + 0.114 * pixels.data[o + 2]!;
      if (luminance < 2) {
        black += 1;
      }
    }
    return black / (pixels.width * pixels.height);
  };

  it.each(surfaceMaps)('is not a stub: %s', async (file) => {
    // The smallest surface map, Uranus, is a 76 KB featureless disc. Ring maps are
    // excluded: Saturn's is 10 KB and complete, because a radial strip of alpha is
    // genuinely that little information.
    const { size } = await stat(join(TEXTURE_DIR, file));

    expect(size).toBeGreaterThan(50_000);
  });

  it.each(surfaceMaps)('leaves no unmapped region in %s', async (file) => {
    const pixels = decode(await readFile(join(TEXTURE_DIR, file)), { useTArray: true });

    // Stray black pixels are normal; a hole is 30% of the image.
    expect(blackFraction(pixels)).toBeLessThan(0.01);
  });

  it("fills Pluto's polar night with the average of what was mapped", async () => {
    const { width, height, data } = decode(await readFile(join(TEXTURE_DIR, 'pluto.jpg')), {
      useTArray: true,
    });
    // Deep in the unmapped south, well past the boundary blend.
    const y = Math.round(((90 + 75) / 180) * height);
    let r = 0;
    for (let x = 0; x < width; x += 1) {
      r += data[(y * width + x) * 4]!;
    }

    // The fill colour, rgb(135, 112, 104). Flat, because it is not data.
    expect(r / width).toBeGreaterThan(125);
    expect(r / width).toBeLessThan(145);
  });
});
