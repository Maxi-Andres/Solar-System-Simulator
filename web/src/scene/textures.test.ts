import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { decode } from 'jpeg-js';
import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { CATALOG, TEXTURE_SETS } from '@sss/tools/catalog';
import { EARTH_CLOUD_MAP, EARTH_NIGHT_MAP, EARTH_WATER_MASK } from './earthExtras.ts';
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

/**
 * Earth's three extras, which are a third kind again.
 *
 * None of them is a picture of a surface: one is emission, one is opacity and one is a
 * coverage fraction. So the surface-map checks are wrong for them in both directions --
 * the night map is 96% black by design, and the water mask is a 160 KB image of mostly
 * two values that is complete. They get the checks that do apply, below.
 */
const earthExtras = [EARTH_NIGHT_MAP, EARTH_CLOUD_MAP, EARTH_WATER_MASK];


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

  it("gives Earth's extras files that exist", () => {
    for (const file of earthExtras) {
      expect(files).toContain(file);
    }
  });

  it('ships no image that nothing uses', () => {
    const used = new Set([...surfaceMaps, ...ringMaps, ...earthExtras]);

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

    // 5.9 MB today: both map sets, the ring strip and Earth's three extras. It briefly
    // held a 3.8 MB sky panorama as well, which is why this number went to 12 and back.
    // The guard is on the repository as much as on the page: swapping in 8k body maps
    // would be a 40 MB decision, not an accident.
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

/**
 * Earth's night lights, clouds and land/water mask.
 *
 * Every one of these is checked against something outside itself, because all three
 * would look fine while being wrong: a night map that kept its background would glow
 * blue across the whole dark side, a cloud map decoded as colour would be the wrong
 * opacity everywhere, and a water mask half a turn out would put the glint in the
 * Sahara. So the tests are geographic where they can be, and quantitative where they
 * cannot.
 *
 * All three are equirectangular with the left edge at longitude 180 W, like every other
 * map here.
 */
const night = decode(await readFile(join(TEXTURE_DIR, EARTH_NIGHT_MAP)), { useTArray: true });
const clouds = decode(await readFile(join(TEXTURE_DIR, EARTH_CLOUD_MAP)), { useTArray: true });
const water = PNG.sync.read(await readFile(join(TEXTURE_DIR, EARTH_WATER_MASK)));

/** The value of a map's first channel at a point on the globe. */
const at = (
  image: { width: number; height: number; data: Uint8Array | Buffer },
  latitude: number,
  longitude: number,
  channels = 4,
) => {
  const x = Math.round(((longitude + 180) / 360) * image.width) % image.width;
  const y = Math.min(image.height - 1, Math.round(((90 - latitude) / 180) * image.height));
  return image.data[(y * image.width + x) * channels]!;
};

describe("Earth's extras", () => {
  it('are all the same 2k grid as the surface maps', () => {
    for (const image of [night, clouds, water]) {
      expect([image.width, image.height]).toEqual([2048, 1024]);
    }
  });

  it('put the city lights on the cities', () => {
    // The check that would have caught a 180-degree error, and the only one that can:
    // a night map is unrecognisable as a shape, so the evidence has to be that named
    // places are bright and named emptiness is not.
    for (const [name, lat, lon] of [
      ['Tokyo', 35.7, 139.7],
      ['London', 51.5, -0.1],
      ['New York', 40.7, -74],
      ['Delhi', 28.6, 77.2],
    ] as const) {
      expect(at(night, lat, lon), name).toBeGreaterThan(180);
    }

    for (const [name, lat, lon] of [
      ['mid-Pacific', 0, -150],
      ['central Sahara', 23, 10],
      ['Congo basin', 0, 22],
      ['central Antarctica', -80, 0],
    ] as const) {
      expect(at(night, lat, lon), name).toBeLessThan(12);
    }
  });

  it('left no base layer behind in the night map', () => {
    // The source composite draws land and sea in dark blue under the lights. Left in,
    // that blue would be emission: the entire night side would glow. It was removed by
    // taking the red channel and subtracting its pedestal, and what should remain is an
    // image that is almost entirely black.
    let dark = 0;
    for (let i = 0; i < night.width * night.height; i += 1) {
      if (night.data[i * 4]! < 8) {
        dark += 1;
      }
    }
    expect(dark / (night.width * night.height)).toBeGreaterThan(0.9);
  });

  it('keep the cloud map grey, because it is an opacity and not a colour', () => {
    let spread = 0;
    for (let i = 0; i < clouds.width * clouds.height; i += 1) {
      const o = i * 4;
      spread = Math.max(spread, Math.abs(clouds.data[o]! - clouds.data[o + 2]!));
    }
    // JPEG chroma is lossy, so this is "grey to within the encoder", not exactly grey.
    expect(spread).toBeLessThan(12);
  });

  it('give the cloud deck about the coverage the atmosphere has', () => {
    let sum = 0;
    for (let i = 0; i < clouds.width * clouds.height; i += 1) {
      sum += clouds.data[i * 4]!;
    }
    const mean = sum / (clouds.width * clouds.height) / 255;
    // The composite is optical thickness rather than cloud fraction, so this is not the
    // published 67% cloud cover and should not be. It is a check that the map is a
    // partly cloudy Earth rather than a blank or an overcast one.
    expect(mean).toBeGreaterThan(0.2);
    expect(mean).toBeLessThan(0.4);
  });

  it('classify the oceans as water and the continents as land', () => {
    const channels = water.data.length / (water.width * water.height);
    for (const [name, lat, lon] of [
      ['mid-Pacific', 0, -150],
      ['mid-Atlantic', 30, -40],
      ['Caspian Sea', 42, 51],
      ['Lake Superior', 47.6, -87.5],
    ] as const) {
      expect(at(water, lat, lon, channels), name).toBeGreaterThan(128);
    }

    for (const [name, lat, lon] of [
      ['central Sahara', 23, 10],
      ['Amazon basin', -4, -65],
      ['Greenland', 72, -40],
      ['Himalaya', 28, 86],
      ['central Antarctica', -85, 0],
    ] as const) {
      expect(at(water, lat, lon, channels), name).toBeLessThan(128);
    }
  });

  it('covers the fraction of Earth that is actually water, within about a point', () => {
    // The number this is really testing, and the one that says the derivation worked:
    // 70.8% of Earth's surface is water. Summed as coverage rather than counted as
    // pixels, because the mask carries fractions now -- and area-weighted by
    // cos(latitude), since an equirectangular row near the pole is a few hundred km of
    // ground, not a few thousand.
    const channels = water.data.length / (water.width * water.height);
    let wet = 0;
    let total = 0;
    for (let y = 0; y < water.height; y += 1) {
      const weight = Math.cos((((90 - ((y + 0.5) / water.height) * 180) * Math.PI) / 180));
      for (let x = 0; x < water.width; x += 1) {
        wet += (water.data[(y * water.width + x) * channels]! / 255) * weight;
        total += weight;
      }
    }
    const fraction = wet / total;

    // It comes out at 69.7%, about a point low, and the reason is known rather than
    // mysterious: the source draws the shallow continental shelves as sea floor instead
    // of filling them with its flat ocean colour, so a rim of every coast reads as land.
    // The bound is set where the derivation actually lands, not where it would be
    // comfortable. The binary version of this mask managed 68.6%, so reading the coastal
    // blend gained a point of accuracy as well as losing the blocky edge.
    expect(fraction).toBeGreaterThan(0.69);
    expect(fraction).toBeLessThan(0.708);
  });

  it('carries a soft coastline rather than a step, because 20 km cannot resolve one', () => {
    // The defect this fixes: a binary mask drew the coastline as the staircase the grid
    // makes rather than the one the sea makes, and the roughness jumped across it, so
    // wherever the Sun caught the water the coast came out visibly blocky.
    //
    // A texel here is 20 km. Nothing about a coastline is 20 km wide, so a hard edge is a
    // precision the grid does not have -- and the source's own antialiasing already
    // recorded the coverage, as a blend between its flat ocean colour and the land.
    const channels = water.data.length / (water.width * water.height);
    let partial = 0;
    for (let i = 0; i < water.width * water.height; i += 1) {
      const value = water.data[i * channels]! / 255;
      if (value > 0.02 && value < 0.98) {
        partial += 1;
      }
    }
    const fraction = partial / (water.width * water.height);

    // A band a few texels wide along every coast: enough to read as a shore, nowhere near
    // enough to be a blurred mask.
    expect(fraction).toBeGreaterThan(0.02);
    expect(fraction).toBeLessThan(0.12);
  });
});
