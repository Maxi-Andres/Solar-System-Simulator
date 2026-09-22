import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { StarCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { brightestMagnitude, parseStarCatalog } from '../core/starCatalog.ts';
import { cross, dot, normalize, type Vec3 } from '../core/vec3.ts';
import { starColor } from './blackbody.ts';
import { directionToGalactic, equatorialDirection } from './galactic.ts';
import { equatorialToEcliptic } from './orientation.ts';
import { FOV_DEG } from './scale.ts';
import { DISPLAY_FLOOR } from './shading.ts';
import { buildStarAttributes } from './starGeometry.ts';
import {
  magnitudeToPeakCoefficients,
  peakDisplayValue,
  PSF_SIGMA_PX,
  skyCoverageFraction,
} from './starRendering.ts';

/**
 * The sky, held against things with published answers.
 *
 * Every other test in this step proves the arithmetic is self-consistent, which is not
 * the same as right: a sky rotated ninety degrees is perfectly self-consistent. So this
 * one asks questions the literature already answers, on the shipped data, after every
 * transform the renderer applies.
 *
 * The one that makes the step worth doing rather than decorating is Orion's belt.
 * Nobody arranged those three stars: if the catalogue, the epoch shift, the proper
 * motion and the equatorial-to-ecliptic rotation are all right, they land in a row on
 * their own -- and if any one of them is wrong, they do not.
 *
 * Skipped when the data has not been generated, like the other data tests.
 */

const DATA_PATH = join(import.meta.dirname, '../../public/data/stars.json');

async function tryLoad(): Promise<StarCatalog | null> {
  try {
    return parseStarCatalog(JSON.parse(await readFile(DATA_PATH, 'utf8')) as unknown);
  } catch {
    return null;
  }
}

const catalog = await tryLoad();
const describeWithData = catalog === null ? describe.skip : describe;
const sky = catalog as StarCatalog;

/** Where a catalogue entry points, in the scene's own frame. */
function sceneDirection(index: number): Vec3 {
  return equatorialToEcliptic(
    equatorialDirection(sky.ra[index] as number, sky.dec[index] as number),
  );
}

/**
 * Stars per unit solid angle near the galactic plane, against those near its poles.
 *
 * The divisors are the solid angles themselves: |b| < 10 degrees is 17.36% of the
 * sphere and |b| > 60 is 13.40%, so a sky with no structure in it returns exactly 1.
 */
function planeToPoleDensityRatio(): number {
  let nearPlane = 0;
  let nearPole = 0;
  for (let index = 0; index < sky.count; index += 1) {
    const latitude = Math.abs(directionToGalactic(sceneDirection(index)).latitudeDeg);
    if (latitude < 10) {
      nearPlane += 1;
    } else if (latitude > 60) {
      nearPole += 1;
    }
  }
  return nearPlane / 0.1736 / (nearPole / 0.134);
}

/** The catalogue entry nearest a published position, and how far off it is. */
function nearest(raDeg: number, decDeg: number): { index: number; separationDeg: number } {
  const target = equatorialDirection(raDeg, decDeg);
  let best = -1;
  let bestCosine = -2;
  for (let index = 0; index < sky.count; index += 1) {
    const cosine = dot(target, equatorialDirection(sky.ra[index] as number, sky.dec[index] as number));
    if (cosine > bestCosine) {
      bestCosine = cosine;
      best = index;
    }
  }
  return {
    index: best,
    separationDeg: (Math.acos(Math.min(1, bestCosine)) * 180) / Math.PI,
  };
}

describeWithData('what is in the file', () => {
  it('holds every Hipparcos star inside the stated magnitude limit', () => {
    // 41,411 stars reach magnitude 8; 52 of them have no measured colour index and are
    // dropped rather than given one, which the file says out loud.
    expect(sky.count).toBeGreaterThan(41_000);
    expect(sky.magnitudeLimit).toBe(8);
    expect(Math.max(...sky.mag)).toBeLessThanOrEqual(8);
    expect(sky.dropped.noColorIndex).toBeLessThan(80);
    expect(sky.dropped.noPosition).toBe(0);
  });

  it('is at J2000, the epoch the rest of the project works in', () => {
    expect(sky.epoch).toBe('ICRS, J2000.0');
  });

  it('holds nothing impossible', () => {
    // Counted into one assertion rather than three per star: 41,000 stars times an
    // expect() each is slower than reading the file was.
    const bad: string[] = [];
    for (let index = 0; index < sky.count; index += 1) {
      const ra = sky.ra[index] as number;
      const dec = sky.dec[index] as number;
      if (!(ra >= 0 && ra < 360)) bad.push(`ra[${index}] = ${ra}`);
      if (!(Math.abs(dec) <= 90)) bad.push(`dec[${index}] = ${dec}`);
      if (!Number.isFinite(sky.bv[index])) bad.push(`bv[${index}] = ${sky.bv[index]}`);
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('stops where Hipparcos stops being complete, and the catalogue says where', () => {
    // The limit is not a taste setting and not the reference's: it is where this
    // survey runs out. Stars per unit solid angle within 10 degrees of the galactic
    // plane, against those more than 60 degrees from it, hold at 2.2 to 2.3 from
    // magnitude 6.5 through 8.0 and then fall away -- 2.04 at 8.5, 1.82 at 9.0 --
    // because the survey loses the crowded plane first. Drawing past 8.0 would thin
    // the sky exactly where the Milky Way is.
    const ratio = planeToPoleDensityRatio();
    expect(ratio).toBeGreaterThan(2.1);
    expect(ratio).toBeLessThan(2.45);
  });

  it('has about as many stars as the reference draws in the same field', () => {
    // Measured off a NASA Eyes frame pixel by pixel: 1,245 discrete stars above the
    // display floor in a 1,584 square degree field. This catalogue puts about 1,590 in
    // the same field before the sampling losses that cost the render roughly a third
    // of the faintest ones -- so the two land within about 20%, and what is left of
    // the gap is the survey running out rather than the exposure being wrong.
    const expected = (sky.count * 1584) / 41_253;
    expect(expected).toBeGreaterThan(1200);
    expect(expected).toBeLessThan(1800);
  });
});

describeWithData('positions, after every transform the renderer applies', () => {
  it('puts Sirius where Sirius is', () => {
    const brightest = brightestMagnitude(sky);
    expect(brightest).toBe(-1.44);

    const index = sky.mag.indexOf(brightest);
    // Sirius at J2000: 101.28715533, -16.71611586. The file holds the position after
    // the 8.75-year epoch shift, so this is checking that shift as much as the read.
    expect(sky.ra[index]).toBeCloseTo(101.2872, 3);
    expect(sky.dec[index]).toBeCloseTo(-16.7161, 3);
  });

  it('lines up Orion&apos;s belt, which nobody arranged', () => {
    // Alnitak, Alnilam, Mintaka -- three stars famous for being in a row. Found by
    // position, checked by magnitude, and then asked whether the row survives the
    // rotation into the scene's ecliptic frame.
    const alnitak = nearest(85.18969, -1.94258);
    const alnilam = nearest(84.05339, -1.20192);
    const mintaka = nearest(83.00167, -0.29909);

    for (const star of [alnitak, alnilam, mintaka]) {
      expect(star.separationDeg).toBeLessThan(0.01);
    }
    expect(sky.mag[alnitak.index]).toBeCloseTo(1.74, 2);
    expect(sky.mag[alnilam.index]).toBeCloseTo(1.69, 2);
    expect(sky.mag[mintaka.index]).toBeCloseTo(2.25, 2);

    const ends = [sceneDirection(alnitak.index), sceneDirection(mintaka.index)] as const;
    const middle = sceneDirection(alnilam.index);
    const normal = normalize(cross(ends[0], ends[1]));
    const offDegrees = (Math.asin(Math.abs(dot(normal, middle))) * 180) / Math.PI;

    // The real belt is not perfectly straight: Alnilam sits 0.09 degrees off the line
    // joining the other two, over a span of 2.74 degrees. Both numbers are the sky's,
    // and a pipeline with a rotation error in it reproduces neither.
    expect(offDegrees).toBeLessThan(0.12);
    expect((Math.acos(dot(ends[0], ends[1])) * 180) / Math.PI).toBeCloseTo(2.74, 1);
  });

  it('crowds the stars into the plane of the galaxy', () => {
    // Not something the pipeline could fake: the Milky Way is where the stars are, and
    // if the positions were scrambled this would come out flat. Uses the galactic
    // frame written for the panorama that was withdrawn -- its first real use since.
    //
    // Equal solid angles would give a ratio of exactly 1. This comes out at 2.22,
    // which is a real concentration and a mild one -- and the mildness is itself
    // correct: a magnitude 8 catalogue is dominated by nearby stars, and the solar
    // neighbourhood is far less flattened than the disc a faint survey sees.
    expect(planeToPoleDensityRatio()).toBeGreaterThan(2);
    expect(planeToPoleDensityRatio()).toBeLessThan(3);
  });
});

describeWithData('how it will look', () => {
  const coefficients = magnitudeToPeakCoefficients(brightestMagnitude(sky), sky.magnitudeLimit);
  // 1080 pixels over the scene's field of view: the scale the reference was measured at.
  const pixelsPerDegree = 1080 / FOV_DEG;

  it('leaves the sky between the stars black, which is what went wrong last time', () => {
    // The photographic panorama lit 31.8% of the sky. Measured off the reference frame
    // itself, 0.405% of its pixels clear the display floor and 99.39% are exactly
    // black. This catalogue paints 0.324%, so the sky between the stars stays black --
    // the property that killed the panorama and the one worth protecting.
    const lit = skyCoverageFraction(sky.mag, coefficients, DISPLAY_FLOOR, pixelsPerDegree);
    expect(lit).toBeGreaterThan(0.002);
    expect(lit).toBeLessThan(0.005);
  });

  it('paints the bright fraction the reference paints, and nothing was tuned to it', () => {
    // 0.121% of the reference frame sits above a display value of 0.05, counted off
    // the pixels. This catalogue, through a response fixed by the magnitude scale and
    // a sigma fixed by the median star size, gives 0.121%. Nothing here was aimed at
    // it: two constants set from two other measurements landing on a third is the
    // reason to believe the model rather than the numbers.
    const bright = skyCoverageFraction(sky.mag, coefficients, 0.05, pixelsPerDegree);
    expect(bright).toBeGreaterThan(0.001);
    expect(bright).toBeLessThan(0.0014);
  });

  it('is a different sky at a different sigma, so the constant is doing work', () => {
    const doubled = skyCoverageFraction(
      sky.mag,
      coefficients,
      0.05,
      pixelsPerDegree,
      PSF_SIGMA_PX * 2,
    );
    expect(doubled).toBeGreaterThan(0.003);
  });

  it('gives the brightest stars the brightest pixels, in catalogue order', () => {
    // The file is written brightest first, so this also pins the ordering the loader
    // relies on if the catalogue is ever streamed in rungs.
    const first = peakDisplayValue(sky.mag[0] as number, coefficients);
    const last = peakDisplayValue(sky.mag[sky.count - 1] as number, coefficients);
    expect(first).toBeGreaterThan(last);
    expect(first).toBeCloseTo(1, 6);
  });
});

describeWithData('the buffers handed to the GPU', () => {
  const attributes = buildStarAttributes(sky);

  it('is one unit vector, one proper motion, one magnitude and one colour per star', () => {
    expect(attributes.count).toBe(sky.count);
    expect(attributes.positions).toHaveLength(sky.count * 3);
    expect(attributes.properMotions).toHaveLength(sky.count * 2);
    expect(attributes.magnitudes).toHaveLength(sky.count);
    expect(attributes.colors).toHaveLength(sky.count * 3);
  });

  it('stores directions, not positions', () => {
    for (let index = 0; index < sky.count; index += 200) {
      const length = Math.hypot(
        attributes.positions[index * 3] as number,
        attributes.positions[index * 3 + 1] as number,
        attributes.positions[index * 3 + 2] as number,
      );
      expect(length).toBeCloseTo(1, 5);
    }
  });

  it('colours every star from its own measurement', () => {
    const reddest = sky.bv.indexOf(Math.max(...sky.bv));
    const bluest = sky.bv.indexOf(Math.min(...sky.bv));
    const [redR, , redB] = starColor(sky.bv[reddest] as number);
    const [blueR, , blueB] = starColor(sky.bv[bluest] as number);
    expect(redR / redB).toBeGreaterThan(blueR / blueB);
  });

  it('carries proper motion in radians a year, small enough to look like nothing', () => {
    // The fastest star in the set moves 7.06 arcseconds a year, which is 3.4e-5
    // radians -- invisible in a year and fifteen pixels over two centuries.
    const fastest = Math.max(
      ...Array.from(attributes.properMotions, (value) => Math.abs(value)),
    );
    expect(fastest).toBeGreaterThan(2e-5);
    expect(fastest).toBeLessThan(5e-5);
  });
});
