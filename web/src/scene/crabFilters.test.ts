import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import { SUPERNOVA_REMNANTS } from '../core/supernovaRemnants.ts';
import {
  CRAB_SULPHUR_SCALE,
  CRAB_TRUE_COLOUR_GAIN,
  crabUnmixing,
  PHOTO_SYNCHROTRON,
  SULPHUR_SHARE_OF_GREEN,
  synchrotronInFilter,
  CRAB_FILTERS,
  OXYGEN_COMPACT_SHARE,
  OXYGEN_DIFFUSE_LEVELS,
  trueColour,
} from './crabFilters.ts';
import { REMNANT_MAP_FRAGMENT_SHADER } from './remnantMap.ts';
import { srgbToLinear } from './starRendering.ts';

/**
 * The Crab unmixed from ESO's three filters into its lines' own colours (crabFilters.ts): the
 * two numbers taken from the picture recomputed from the shipped files, and the result in the
 * colours it should be.
 */

const DIR = join(import.meta.dirname, '../../public/remnants');
const photo = PNG.sync.read(await readFile(join(DIR, 'crab.png')));
const share = PNG.sync.read(await readFile(join(DIR, 'crab-continuum.png')));
const crab = SUPERNOVA_REMNANTS.find((remnant) => remnant.key === 'crab')!;

const luminance = (c: readonly number[]) => 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;

/** Every pixel: its linear colour and its linear synchrotron share. */
function* pixels(): Generator<[[number, number, number], number]> {
  for (let i = 0; i < photo.width * photo.height; i += 1) {
    yield [
      [srgbToLinear(photo.data[i * 4]! / 255), srgbToLinear(photo.data[i * 4 + 1]! / 255), srgbToLinear(photo.data[i * 4 + 2]! / 255)],
      srgbToLinear(share.data[i * 4]! / 255),
    ];
  }
}

describe('the Crab in its own colours', () => {
  it('is drawn by unmixing its picture’s filters, with the synchrotron colour the picture has', () => {
    expect(crab.map!.colour).toBe('filters');
    expect(crab.map!.continuum!.colour).toEqual(PHOTO_SYNCHROTRON);
    expect(REMNANT_MAP_FRAGMENT_SHADER).toContain('uFilters');
  });

  it('scales green against blue by the synchrotron’s power law', () => {
    // The B and R filters pass about as much of an nu^-0.7 spectrum each; the picture's
    // synchrotron is 0.81 as green as blue, so its green was scaled down a little.
    expect(synchrotronInFilter(CRAB_FILTERS.green) / synchrotronInFilter(CRAB_FILTERS.blue)).toBeCloseTo(0.976, 3);
    expect(crabUnmixing().greenScale).toBeCloseTo(0.834, 3);
  });

  it('takes red’s scale and the gain from the shipped picture, as pinned', () => {
    const u = crabUnmixing();
    const all = [...pixels()];
    let red = 0;
    let green = 0;
    for (const [rgb, s] of all) {
      red += Math.max(rgb[0] - s * PHOTO_SYNCHROTRON[0], 0);
      green += Math.max(rgb[1] - s * PHOTO_SYNCHROTRON[1], 0) / u.greenScale;
    }
    const scale = red / (SULPHUR_SHARE_OF_GREEN * green);

    // The coarse level the diffuse [O III] is read at: blocks of 2^levels pixels averaged, as
    // the mipmap does.
    const block = 2 ** OXYGEN_DIFFUSE_LEVELS;
    const side = photo.width / block;
    const coarse: [[number, number, number], number][] = [];
    for (let by = 0; by < side; by += 1) {
      for (let bx = 0; bx < side; bx += 1) {
        const sum = [0, 0, 0, 0];
        for (let y = 0; y < block; y += 1) {
          for (let x = 0; x < block; x += 1) {
            const [rgb, s] = all[(by * block + y) * photo.width + bx * block + x]!;
            sum[0]! += rgb[0];
            sum[1]! += rgb[1];
            sum[2]! += rgb[2];
            sum[3]! += s;
          }
        }
        const n = block * block;
        coarse.push([[sum[0]! / n, sum[1]! / n, sum[2]! / n], sum[3]! / n]);
      }
    }
    let shown = 0;
    let drawn = 0;
    for (const [i, [rgb, s]] of all.entries()) {
      const [crgb, cs] = coarse[Math.floor(Math.floor(i / photo.width) / block) * side + Math.floor((i % photo.width) / block)]!;
      shown += luminance(rgb);
      drawn += luminance(trueColour(rgb, s, crgb, cs, 1, scale));
    }

    expect(SULPHUR_SHARE_OF_GREEN).toBeCloseTo(0.8 / 2.6, 12);
    expect(Math.abs(scale / CRAB_SULPHUR_SCALE - 1)).toBeLessThan(0.002);
    expect(Math.abs(shown / drawn / CRAB_TRUE_COLOUR_GAIN - 1)).toBeLessThan(0.002);
  });

  it('draws the filaments red to pink, the [O III] teal, and the synchrotron bluish white', () => {
    const u = crabUnmixing();
    const hue = (c: readonly number[]) => c.map((v) => v / Math.max(...c));
    // [S II] at 672 nm: red, nothing else in gamut.
    expect(hue(u.sulphur)).toEqual([1, 0, 0]);
    // H-alpha's group: red, H-beta's touch of blue making it pink, no green.
    const red = hue(u.red);
    expect(red[0]).toBe(1);
    expect(red[1]!).toBeLessThan(0.05);
    expect(red[2]!).toBeGreaterThan(0.1);
    expect(red[2]!).toBeLessThan(0.3);
    // [O III] 500.7: green-blue.
    const oxygen = hue(u.oxygen);
    expect(oxygen[1]).toBe(1);
    expect(oxygen[0]).toBe(0);
    // The synchrotron: blue strongest, red and green close behind -- a bluish white, not the
    // picture's cyan, whose red was 0.07.
    const syn = hue(u.synchrotron);
    expect(syn[2]).toBe(1);
    expect(syn[0]!).toBeGreaterThan(0.7);
    expect(syn[1]!).toBeGreaterThan(0.7);
  });

  it('keeps most of the [O III] off the filaments, as Hubble found it (Sankrit et al. 1998)', () => {
    expect(OXYGEN_COMPACT_SHARE).toBe(0.1);
    // A lone filament on empty sky: its own red, and only a tenth of its [O III] with it.
    const u = crabUnmixing();
    const band = 0.1;
    const lone = trueColour([band * SULPHUR_SHARE_OF_GREEN * CRAB_SULPHUR_SCALE, band * u.greenScale, 0], 0, [0, 0, 0], 0);
    expect(lone[0]).toBeGreaterThan(lone[1]);
    expect(lone[0]).toBeGreaterThan(lone[2]);
  });

  it('turns the picture’s green filaments red where it is sulphur, and leaves the empty sky empty', () => {
    // A filament with sulphur and hydrogen as the spectrum has them, no synchrotron:
    // the picture's red channel at the pinned scale, its green the whole R band.
    const u = crabUnmixing();
    const band = 0.1;
    const filament = trueColour([band * SULPHUR_SHARE_OF_GREEN * CRAB_SULPHUR_SCALE, band * u.greenScale, 0], 0);
    expect(filament.every((v) => v >= 0)).toBe(true);
    // Pure sulphur where the picture's red is all of its green.
    const sulphur = trueColour([band * CRAB_SULPHUR_SCALE, band * u.greenScale, 0], 0);
    expect(sulphur[0]).toBeGreaterThan(0);
    expect(sulphur[1]).toBe(0);
    expect(trueColour([0, 0, 0], 0)).toEqual([0, 0, 0]);
  });
});
