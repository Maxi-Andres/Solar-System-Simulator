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
  medianNearestNeighbourPx,
  peakDisplayValue,
  PSF_SIGMA_PX,
  RENDER_SPARSITY,
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
  it('is the union of two catalogues, and says which star came from where', () => {
    // Neither is a sky on its own. Hipparcos supplies about 51,000 stars with measured
    // Johnson photometry; Tycho-2 adds the 9,000 it never completed. The other
    // direction matters just as much: Tycho-2's star mapper saturated on the bright
    // stars, so Sirius, Vega and Betelgeuse exist only in the Hipparcos half.
    expect(sky.sources).toHaveLength(2);
    const [hipparcos, tycho] = sky.sources;
    expect(hipparcos!.table).toBe('I/239/hip_main');
    expect(tycho!.table).toBe('I/259/tyc2');
    expect(hipparcos!.stars).toBeGreaterThan(tycho!.stars);
    expect(hipparcos!.stars + tycho!.stars).toBe(sky.count);
  });

  it('holds every star inside the stated magnitude limit', () => {
    expect(sky.count).toBeGreaterThan(45_000);
    expect(sky.magnitudeLimit).toBe(8);
    expect(Math.max(...sky.mag)).toBeLessThanOrEqual(8);
    // Nothing is dropped for want of a colour any more: every Hipparcos star missing a
    // B-V is one Tycho-2 has BT and VT for, so the merge recovers all of them.
    expect(sky.dropped.noColorIndex).toBe(0);
    expect(sky.dropped.noPosition).toBeLessThan(30);
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

  it('is complete where Hipparcos alone was not, and the sky says so', () => {
    // The test that forced the second catalogue. Count stars per unit solid angle
    // within 10 degrees of the galactic plane against those beyond 60. The real sky's
    // ratio must *rise* with depth -- fainter means further, further means more disc --
    // and Tycho-2's does: 2.31 at magnitude 7, 2.64 at 8.0, 2.87 at 8.5. Hipparcos
    // alone goes the wrong way: 2.29, then 2.22, then 2.04. A catalogue cannot lose
    // structure by going deeper, so that fall was the survey running out.
    //
    // The union at magnitude 8 comes out at 2.64, which is Tycho-2's own figure.
    const ratio = planeToPoleDensityRatio();
    expect(ratio).toBeGreaterThan(2.5);
    expect(ratio).toBeLessThan(3);
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
  /**
   * The geometry of the frames these numbers were measured in: 910 pixels tall at the
   * scene's own field of view. Not a round 1080 -- a coverage fraction and a pixel
   * separation both depend on how much sky a pixel covers, so the comparison has to be
   * made at the scale it was measured at.
   */
  const pixelsPerDegree = 910 / FOV_DEG;

  /**
   * The reference's plate scale, and it is not ours.
   *
   * Solving the two frames against each other under a transform free to scale and rotate
   * gives 0.876 to 0.879 and a rotation under 0.7 degrees, at three sample sizes -- 13
   * inliers of the brightest 25, 25 of 40, 37 of 60. So NASA Eyes was at a 30.6 degree
   * vertical field where this is at 27, and 1.14 of the 1.54 pixel gap in star separation
   * was the camera rather than the sky. Only the rest is this catalogue's business.
   */
  const REFERENCE_FOV_DEG = 30.6;
  const REFERENCE_SEPARATION_AT_OUR_SCALE = 17.4 * (REFERENCE_FOV_DEG / FOV_DEG);

  it('leaves the sky between the stars black, which is what went wrong last time', () => {
    // The photographic panorama lit 31.8% of the sky. Measured off the reference frame
    // itself, 0.405% of its pixels clear the display floor and 99.39% are exactly
    // black. This comes to 0.570% before the sampling correction -- it rose from 0.451%
    // when the point spread gained its wings, which is the cost of bright stars having
    // haloes. Still better than 99.4% black, which is the property that killed the
    // panorama and the one worth protecting as the model gets richer.
    const lit = skyCoverageFraction(sky.mag, coefficients, DISPLAY_FLOOR, pixelsPerDegree);
    expect(lit).toBeLessThan(0.0075);
  });

  it('paints about the bright fraction the reference paints', () => {
    // 0.121% of the reference frame sits above a display value of 0.05, counted off the
    // pixels; at its wider field that is 0.094% of one of ours. This sum runs high
    // against any real frame because it assumes every star lands on a pixel centre -- at
    // magnitude 7.5 it gave 0.169% where the render measured 0.074%, a factor of 2.3.
    // Corrected by that, this comes to about 0.08%. A tripwire, not a target: the sizes
    // and the separation are what were matched.
    const bright = skyCoverageFraction(sky.mag, coefficients, 0.05, pixelsPerDegree);
    expect(bright).toBeGreaterThan(0.0013);
    expect(bright).toBeLessThan(0.0022);
  });

  it('puts the stars as close together as the reference does, once the cameras agree', () => {
    // The measurement that set the magnitude limit. NASA Eyes measures a median distance
    // of 17.4 px from a star to its nearest neighbour, but at a wider field than this --
    // 19.8 px is what the same sky would measure through this camera. At magnitude 7.5
    // this sky rendered 26.8, and separation goes as the inverse square root of density,
    // so closing it takes 1.84 times the stars per square degree. The union at magnitude
    // 8 renders 20.0.
    const separation = medianNearestNeighbourPx(sky.count, pixelsPerDegree) * RENDER_SPARSITY;
    expect(REFERENCE_SEPARATION_AT_OUR_SCALE).toBeCloseTo(19.7, 1);
    expect(separation / REFERENCE_SEPARATION_AT_OUR_SCALE).toBeGreaterThan(0.95);
    expect(separation / REFERENCE_SEPARATION_AT_OUR_SCALE).toBeLessThan(1.05);
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
