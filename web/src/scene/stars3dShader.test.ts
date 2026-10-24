import type { StarCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import {
  apparentMagnitude,
  KM_S_TO_PC_PER_YEAR,
  PARSEC_KM,
  STAR3D,
  STAR3D_FLAG,
  STAR3D_FLOATS,
  starNow,
  starState,
} from '../core/stars3d.ts';
import { J2000_JD } from '../core/time.ts';
import { vec3 } from '../core/vec3.ts';
import { AU_KM, FOV_DEG, LIGHT_YEAR_KM } from './scale.ts';
import { DISPLAY_FLOOR } from './shading.ts';
import { equatorialToEcliptic } from './orientation.ts';
import { mapStrength, SUN_ABSOLUTE_V } from './Starfield.tsx';
import { buildStarAttributes, skyDirection } from './starGeometry.ts';
import { magnitudeToPeakCoefficients, peakDisplayValue, SPHERE_RADIUS } from './starRendering.ts';
import {
  MAP_DOT_PEAK,
  mapDotPeak,
  peakLinear,
  splitHigh,
  splitLow,
  star3dPeak,
  STAR3D_VERTEX_SHADER,
  starSeenFrom,
} from './stars3dShader.ts';

/**
 * Stars written as the generator writes them (the contract in tools/src/types.ts), from
 * their published astrometry, so the renderer can be held to the sky before the data
 * exists. Real values, SIMBAD / Gaia DR3 / Hipparcos as quoted in each.
 */
interface Astrometry {
  readonly name: string;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly parallaxMas: number;
  readonly pmRaMasYr: number;
  readonly pmDecMasYr: number;
  readonly rvKmS: number | null;
  readonly v: number;
  readonly bv: number;
  /** Its row in the sky fixture, or -1 for a star fainter than the sky. */
  readonly sky: number;
}

const STARS: readonly Astrometry[] = [
  // Sirius A, Hipparcos new reduction.
  { name: 'Sirius', raDeg: 101.28715533, decDeg: -16.71611586, parallaxMas: 379.21, pmRaMasYr: -546.01, pmDecMasYr: -1223.07, rvKmS: -5.5, v: -1.46, bv: 0.0, sky: 0 },
  // Alpha Centauri A.
  { name: 'Alpha Centauri A', raDeg: 219.90205833, decDeg: -60.83399269, parallaxMas: 747.1, pmRaMasYr: -3679.25, pmDecMasYr: 473.67, rvKmS: -21.4, v: 0.01, bv: 0.71, sky: 1 },
  // Vega.
  { name: 'Vega', raDeg: 279.23473479, decDeg: 38.78368896, parallaxMas: 130.23, pmRaMasYr: 200.94, pmDecMasYr: 286.23, rvKmS: -13.9, v: 0.03, bv: 0.0, sky: 2 },
  // A sky star at the faint end, without a measured radial velocity.
  { name: 'faint', raDeg: 12.5, decDeg: 41.2, parallaxMas: 21.4, pmRaMasYr: 35.2, pmDecMasYr: -12.9, rvKmS: null, v: 7.48, bv: 1.1, sky: 3 },
  // Barnard's Star: V 9.5, not in the sky; the fastest proper motion there is.
  { name: "Barnard's Star", raDeg: 269.45207511, decDeg: 4.69339088, parallaxMas: 548.31, pmRaMasYr: -798.58, pmDecMasYr: 10328.12, rvKmS: -110.6, v: 9.51, bv: 1.57, sky: -1 },
];

const DEG = Math.PI / 180;

/** The record the contract describes, from astrometry. */
function record(star: Astrometry): number[] {
  const ra = star.raDeg * DEG;
  const dec = star.decDeg * DEG;
  const d = 1000 / star.parallaxMas;
  const u = vec3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec));
  const east = vec3(-Math.sin(ra), Math.cos(ra), 0);
  const north = vec3(-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec));
  const k = 4.740470463533348 * d / 1000;
  const rv = star.rvKmS ?? 0;
  const vEq = vec3(
    k * (star.pmRaMasYr * east.x + star.pmDecMasYr * north.x) + rv * u.x,
    k * (star.pmRaMasYr * east.y + star.pmDecMasYr * north.y) + rv * u.y,
    k * (star.pmRaMasYr * east.z + star.pmDecMasYr * north.z) + rv * u.z,
  );
  const p = equatorialToEcliptic(u);
  const v = equatorialToEcliptic(vEq);
  return [
    p.x * d,
    p.y * d,
    p.z * d,
    v.x,
    v.y,
    v.z,
    star.v + 5 * Math.log10(star.parallaxMas / 100),
    star.bv,
    star.sky,
    star.rvKmS === null ? 0 : STAR3D_FLAG.RADIAL_VELOCITY,
  ];
}

const RECORDS = new Float32Array(STARS.flatMap(record));

/** The sky rows of the same stars, as stars.json has them (at J2000). */
const SKY_STARS = STARS.filter((star) => star.sky >= 0);
const CATALOG: StarCatalog = {
  sources: [],
  via: 'test',
  queriedAt: '',
  epoch: 'ICRS, J2000.0',
  magnitudeLimit: 8,
  count: SKY_STARS.length,
  dropped: { noPosition: 0, noColorIndex: 0 },
  ra: SKY_STARS.map((star) => star.raDeg),
  dec: SKY_STARS.map((star) => star.decDeg),
  mag: SKY_STARS.map((star) => star.v),
  bv: SKY_STARS.map((star) => star.bv),
  pmRa: SKY_STARS.map((star) => star.pmRaMasYr),
  pmDec: SKY_STARS.map((star) => star.pmDecMasYr),
};
const ATTRIBUTES = buildStarAttributes(CATALOG);
const COEFFICIENTS = magnitudeToPeakCoefficients(-1.46, 8);

/** Pixels per radian in a 910-pixel frame at the scene's field of view. */
const PX_PER_RAD = 910 / (2 * Math.tan((FOV_DEG / 2) * DEG));

const AT_SUN = { x: 0, y: 0, z: 0 };
const YEARS_2026 = 26.8;

function angle(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  const cross = Math.hypot(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x) / (la * lb);
  return Math.atan2(cross, dot);
}

describe('the 3D stars, seen from the Sun, are the sky', () => {
  it('give back the sky’s V from the Sun at J2000, to float32', () => {
    STARS.forEach((star, i) => {
      expect(Math.abs(starSeenFrom(RECORDS, i, AT_SUN, 0).magnitude - star.v)).toBeLessThan(2e-5);
    });
  });

  it('land within a hundredth of a pixel of the sky’s direction, at J2000 and in 2026', () => {
    for (const years of [0, YEARS_2026, -100, 100]) {
      SKY_STARS.forEach((star, row) => {
        const i = STARS.indexOf(star);
        const seen = starSeenFrom(RECORDS, i, AT_SUN, years);
        const sky = skyDirection(ATTRIBUTES, row, years);
        // Over a century the two models part by perspective acceleration, the 3D one
        // being the right one; still a few hundredths of a pixel at Alpha Centauri.
        const limitPx = Math.abs(years) > 50 ? 0.05 : 0.01;
        expect(angle(seen, sky) * PX_PER_RAD).toBeLessThan(limitPx);
      });
    }
  });

  it('draw every sky star at the sky’s brightness, within a tenth of a code value', () => {
    SKY_STARS.forEach((star, row) => {
      const i = STARS.indexOf(star);
      const seen = starSeenFrom(RECORDS, i, AT_SUN, YEARS_2026);
      const peak = star3dPeak(seen.magnitude, COEFFICIENTS, CATALOG.magnitudeLimit, 0)!;
      const sky = peakDisplayValue(CATALOG.mag[row]!, COEFFICIENTS);
      expect(Math.abs(peak - sky) * 255).toBeLessThan(0.1);
    });
  });

  it('leave out a star fainter than the limit from where the camera is', () => {
    const barnard = STARS.findIndex((star) => star.sky < 0);
    const seen = starSeenFrom(RECORDS, barnard, AT_SUN, YEARS_2026);
    expect(seen.magnitude).toBeGreaterThan(CATALOG.magnitudeLimit);
    expect(star3dPeak(seen.magnitude, COEFFICIENTS, CATALOG.magnitudeLimit, 0)).toBeNull();
  });
});

describe('the 3D stars, seen from elsewhere', () => {
  const alphaCen = STARS.findIndex((star) => star.name === 'Alpha Centauri A');

  it('make the Sun a 0.4-magnitude star from Alpha Centauri', () => {
    const at = starState(RECORDS, alphaCen, J2000_JD + YEARS_2026 * 365.25).position;
    const distancePc = Math.hypot(at.x, at.y, at.z) / PARSEC_KM;
    expect(apparentMagnitude(SUN_ABSOLUTE_V, distancePc)).toBeCloseTo(0.44, 1);
  });

  it('make Alpha Centauri blaze from a light year off, past the sky’s brightest', () => {
    const star = starState(RECORDS, alphaCen, J2000_JD).position;
    const toward = Math.hypot(star.x, star.y, star.z);
    const pc = (toward - LIGHT_YEAR_KM) / PARSEC_KM;
    const camera = { x: (star.x / toward) * pc, y: (star.y / toward) * pc, z: (star.z / toward) * pc };
    const seen = starSeenFrom(RECORDS, alphaCen, camera, 0);
    expect(seen.magnitude).toBeCloseTo(-3.2, 1);
    const peak = star3dPeak(seen.magnitude, COEFFICIENTS, CATALOG.magnitudeLimit, 0)!;
    // Past full scale: the display clips the core and the light goes into the halo.
    expect(peak).toBeGreaterThan(1);
    expect(peakLinear(peak)).toBeGreaterThan(1);
  });

  it('place a star an AU away to 1e4 km of where float64 puts it, a century out', () => {
    for (const i of [0, alphaCen, STARS.length - 1]) {
      for (const years of [0, YEARS_2026, 100]) {
        const jd = J2000_JD + years * 365.25;
        const exact = starState(RECORDS, i, jd).position;
        const length = Math.hypot(exact.x, exact.y, exact.z);
        // One AU short of the star, along the line from the Sun.
        const scale = (length - AU_KM) / length / PARSEC_KM;
        const camera = { x: exact.x * scale, y: exact.y * scale, z: exact.z * scale };
        const seen = starSeenFrom(RECORDS, i, camera, years);
        const error = Math.hypot(
          seen.x * PARSEC_KM - (exact.x - camera.x * PARSEC_KM),
          seen.y * PARSEC_KM - (exact.y - camera.y * PARSEC_KM),
          seen.z * PARSEC_KM - (exact.z - camera.z * PARSEC_KM),
        );
        expect(error).toBeLessThan(years === 100 ? 3e4 : 1.5e4);
        // A twentieth of a pixel or less, from an AU.
        expect((error / AU_KM) * PX_PER_RAD).toBeLessThan(0.4);
      }
    }
  });

  it('split the camera so the high part carries all but 2^-48 of it', () => {
    const value = 123.456789012345;
    expect(Math.abs(splitHigh(value) + splitLow(value) - value) / value).toBeLessThan(2 ** -46);
  });

  it('move Barnard’s Star 10.4 arcseconds a year, and bring it closer', () => {
    const barnard = STARS.length - 1;
    const now = starNow(RECORDS, barnard, J2000_JD);
    expect(now.properMotionArcsecPerYear).toBeCloseTo(10.36, 1);
    expect(now.radialKmS).toBeCloseTo(-110.6, 0);
    expect(now.distancePc).toBeCloseTo(1.824, 2);
    // And with no radial velocity measured, says so rather than zero.
    expect(starNow(RECORDS, 3, J2000_JD).radialKmS).toBeNull();
    expect(KM_S_TO_PC_PER_YEAR * PARSEC_KM).toBeCloseTo(365.25 * 86_400, 0);
  });
});

describe('the map of the stars', () => {
  it('is nothing anywhere a body is being looked at', () => {
    expect(mapStrength(2000 * AU_KM)).toBe(0);
    expect(mapStrength(9_999 * AU_KM)).toBe(0);
    expect(mapStrength(1.6 * LIGHT_YEAR_KM)).toBe(1);
  });

  it('dims its dots where they crowd, and never past MAP_DOT_PEAK', () => {
    const census = 330_000;
    // Inside the census, among the nearest stars: not crowded.
    expect(mapDotPeak(census, 15, PX_PER_RAD)).toBe(MAP_DOT_PEAK);
    // The whole census from 3,000 ly: dimmed, still above the display floor.
    const far = mapDotPeak(census, (3000 * LIGHT_YEAR_KM) / PARSEC_KM, PX_PER_RAD);
    expect(far).toBeLessThan(MAP_DOT_PEAK / 5);
    expect(far).toBeGreaterThan(DISPLAY_FLOOR);
    expect(mapDotPeak(0, 15, PX_PER_RAD)).toBe(0);
  });

  it('makes every star at least a dot, and a bright one no dimmer for it', () => {
    expect(star3dPeak(12, COEFFICIENTS, 8, 0.1)).toBe(0.1);
    expect(star3dPeak(0, COEFFICIENTS, 8, 0.1)).toBe(peakDisplayValue(0, COEFFICIENTS));
  });
});

describe('the 3D vertex shader', () => {
  it('subtracts the camera high part first, then the low, then adds the motion', () => {
    expect(STAR3D_VERTEX_SHADER).toContain('((position - uCameraHigh) - uCameraLow) + velocity * uMotion');
  });

  it('is the sky’s response, carried past full scale', () => {
    expect(STAR3D_VERTEX_SHADER).toContain('uMagnitudeToPeak.x + uMagnitudeToPeak.y * m');
    expect(STAR3D_VERTEX_SHADER).toContain('pow((peak + 0.055) / 1.055, 2.4)');
  });

  it('reads one record of the contract’s length', () => {
    expect(RECORDS.length).toBe(STARS.length * STAR3D_FLOATS);
    expect(RECORDS[STAR3D.sky]).toBe(0);
  });

  it('keeps the sky sphere past every 3D star in this fixture', () => {
    for (let i = 0; i < STARS.length; i += 1) {
      const p = starState(RECORDS, i, J2000_JD).position;
      expect(Math.hypot(p.x, p.y, p.z) / 1000).toBeLessThan(SPHERE_RADIUS);
    }
  });
});
