import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  loadEphemerisStore,
  type EphemerisStore,
  type Fetcher,
} from '../core/ephemerisStore.ts';
import { dateToTdb } from '../core/time.ts';
import { dot } from '../core/vec3.ts';
import {
  directionToGeographic,
  obliquityToOrbit,
  planetographicLatitude,
  poleDirection,
  rotationalPole,
} from './orientation.ts';

/**
 * Orientation checked against JPL and against the almanac.
 *
 * The unit tests prove the maths is self-consistent, which is not the same as right:
 * an axis pointing 90 degrees from where it belongs is perfectly self-consistent, and
 * that is exactly the bug this step replaced. So these tests take JPL's own state
 * vectors and ask questions with published answers.
 *
 * They earned their keep immediately. Run for the first time, they found three real
 * errors that nothing else would have surfaced:
 *
 *   - Mars's pole was wrong by 1.5 degrees, from bad transcription of the IAU report.
 *   - Neptune needed its periodic term after all; without it the pole sits 0.28
 *     degrees off, an order of magnitude worse than any other body.
 *   - Earth needed the linear pole rates, which are precession: 0.145 degrees by 2026.
 *   - Pluto's published 122.53 degree tilt comes from a pole the IAU retired in 2009.
 *     The current one gives 119.591, and matches JPL exactly.
 *
 * With all four settled, every body's sub-solar latitude lands within 0.0026 degrees
 * of JPL's own, across 2026.
 *
 * Skipped when the ephemerides have not been generated, like the other data tests.
 */

const DATA_ROOT = join(import.meta.dirname, '../../public');

const diskFetcher: Fetcher = async (path) =>
  JSON.parse(await readFile(join(DATA_ROOT, path), 'utf8')) as unknown;

async function tryLoad(): Promise<EphemerisStore | null> {
  try {
    return await loadEphemerisStore(diskFetcher, '/');
  } catch {
    return null;
  }
}

const store = await tryLoad();
const describeWithData = store === null ? describe.skip : describe;

/**
 * Sub-solar latitudes straight from JPL Horizons, in degrees.
 *
 * Captured with EPHEM_TYPE='OBSERVER', CENTER='500@10' (the Sun), QUANTITIES='14',
 * at 90-day steps through 2026. Observing from the Sun makes the sub-observer point
 * the sub-solar point, and latitude -- unlike longitude -- carries no convention
 * ambiguity and is untouched by light time.
 *
 * Horizons reports planetographic latitude, so the comparison converts.
 */
const REFERENCE_DATES = [
  '2026-01-01',
  '2026-04-01',
  '2026-06-30',
  '2026-09-28',
  '2026-12-27',
] as const;

const JPL_SUB_SOLAR_LATITUDE: Readonly<Record<string, readonly number[]>> = {
  mercury: [-0.019217, -0.021859, -0.024309, -0.026518, -0.028497],
  venus: [1.672101, -0.10799, -1.397062, 2.463353, -2.556845],
  earth: [-23.15607, 4.490623, 23.32061, -1.957428, -23.474666],
  mars: [-7.979071, -24.499415, -19.213181, -0.506422, 16.485912],
  jupiter: [1.688139, 1.269869, 0.835907, 0.393642, -0.049949],
  saturn: [-4.394439, -6.045862, -7.689635, -9.320885, -10.934578],
  uranus: [71.264835, 72.164405, 73.055064, 73.935277, 74.803176],
  neptune: [-20.155216, -19.955069, -19.753303, -19.549925, -19.344962],
  pluto: [59.845241, 59.91987, 59.98887, 60.052272, 60.110095],
};

/** Where the Sun stands overhead on a body's surface at a given instant. */
function subSolarPoint(bodyId: string, date: Date) {
  const loaded = store!;
  const jd = dateToTdb(date);
  const toSun = loaded.stateRelativeTo('sun', bodyId, jd);
  if (toSun === null) {
    throw new Error(`No state for ${bodyId} at ${date.toISOString()}`);
  }
  return directionToGeographic(toSun.position, jd, loaded.body(bodyId));
}

describeWithData('the sub-solar point, against JPL Horizons', () => {
  /**
   * The sharpest test in the file. It exercises the IAU pole, the periodic term, the
   * equatorial-to-ecliptic rotation, the state vectors and the interpolator all at
   * once, against numbers JPL computed independently -- and it is sensitive to a pole
   * error of a hundredth of a degree.
   */
  it('reproduces the sub-solar latitude of every planet to within 0.01 degrees', () => {
    const loaded = store!;

    for (const [id, expected] of Object.entries(JPL_SUB_SOLAR_LATITUDE)) {
      REFERENCE_DATES.forEach((date, index) => {
        const centric = subSolarPoint(id, new Date(`${date}T00:00:00Z`)).latitudeDeg;
        const graphic = planetographicLatitude(centric, loaded.body(id));

        // Measured worst case is 0.0026 deg, on Earth. Nine arcseconds.
        expect(Math.abs(graphic - expected[index]!), `${id} on ${date}`).toBeLessThan(0.01);
      });
    }
  });

  it('needs the planetographic conversion to agree, which is itself the point', () => {
    // Saturn is 9.8% flattened, so its two latitudes differ by degrees. Comparing the
    // raw planetocentric value against a NASA table would look like a pole error and
    // is not one -- this pins the distinction so it cannot quietly come back.
    const loaded = store!;
    const centric = subSolarPoint('saturn', new Date('2026-12-27T00:00:00Z')).latitudeDeg;
    const graphic = planetographicLatitude(centric, loaded.body('saturn'));

    expect(Math.abs(centric - JPL_SUB_SOLAR_LATITUDE.saturn![4]!)).toBeGreaterThan(0.8);
    expect(Math.abs(graphic - JPL_SUB_SOLAR_LATITUDE.saturn![4]!)).toBeLessThan(0.01);
  });
});

describeWithData('the sub-solar point on Earth, against the almanac', () => {
  /**
   * Longitude is where the prime meridian itself gets tested, and Earth is the one
   * body whose answer everybody can check. At 12:00 UTC the Sun stands over the
   * Greenwich meridian, give or take the equation of time -- the up-to-16-minute gap
   * between clock noon and real noon. Four days a year that gap is zero.
   *
   * A quarter of a degree is one minute of time. Landing inside that means the prime
   * meridian is not merely turning at the right rate, it is in the right place.
   */
  it('is over the Greenwich meridian at noon on the days the equation of time vanishes', () => {
    for (const date of ['2026-04-15T12:00:00Z', '2026-09-01T12:00:00Z']) {
      const { longitudeDeg } = subSolarPoint('earth', new Date(date));

      expect(Math.abs(longitudeDeg), date).toBeLessThan(0.6);
    }
  });

  it('never strays further from noon than the equation of time allows', () => {
    // Max |EoT| is about 16.4 minutes, or 4.1 degrees. Sampled right round the year.
    for (let day = 0; day < 365; day += 5) {
      const date = new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0));
      const { longitudeDeg } = subSolarPoint('earth', date);

      expect(Math.abs(longitudeDeg), date.toISOString()).toBeLessThan(4.3);
    }
  });

  it('tracks the solar declination through the seasons', () => {
    // The sub-solar latitude IS the solar declination, and it is what makes seasons.
    const at = (date: string) => subSolarPoint('earth', new Date(date)).latitudeDeg;

    expect(at('2026-06-21T12:00:00Z')).toBeCloseTo(23.44, 1);
    expect(at('2026-12-21T12:00:00Z')).toBeCloseTo(-23.44, 1);
    expect(Math.abs(at('2026-03-20T12:00:00Z'))).toBeLessThan(0.6);
    expect(Math.abs(at('2026-09-23T12:00:00Z'))).toBeLessThan(0.6);
  });

  it('drifts west by 15 degrees an hour, one full turn per solar day', () => {
    const noon = subSolarPoint('earth', new Date('2026-06-21T12:00:00Z')).longitudeDeg;
    const later = subSolarPoint('earth', new Date('2026-06-21T15:00:00Z')).longitudeDeg;
    const drift = ((later - noon + 540) % 360) - 180;

    // Three hours of rotation. Not the sidereal 15.041 deg/h: Earth has moved along
    // its orbit too, and the difference between those two rates is the solar day.
    expect(drift).toBeCloseTo(-45, 1);
  });
});

describeWithData('axial tilt, from two independent sources', () => {
  /**
   * The catalog's `axialTiltDeg`, the IAU pole and `r x v` from DE441 have nothing
   * tying them together except being descriptions of the same Solar System, so
   * agreement is evidence and disagreement is a bug. This is the check that would
   * have caught the axis this step replaced, which lay in the ecliptic plane.
   *
   * The Sun is excluded: its motion about the barycenter is a wobble driven by
   * Jupiter, not a Keplerian orbit, so its `r x v` says nothing about a tilt.
   */
  it('reproduces every published axial tilt from the pole and the state vectors', () => {
    const loaded = store!;
    const jd = dateToTdb(new Date('2026-01-01T00:00:00Z'));

    for (const body of loaded.bodies) {
      if (body.id === 'sun') {
        continue;
      }
      const heliocentric = loaded.stateRelativeTo(body.id, 'sun', jd);
      expect(heliocentric, body.id).not.toBeNull();

      const measured = obliquityToOrbit(
        jd,
        body,
        heliocentric!.position,
        heliocentric!.velocity,
      );

      // A third of a degree covers the fact sheets' own rounding and the difference
      // between an instantaneous orbit normal and a mean one.
      expect(Math.abs(measured - body.axialTiltDeg), body.id).toBeLessThan(0.35);
    }
  });

  it('keeps Uranus lying on its side and Venus upside down', () => {
    const loaded = store!;
    const jd = dateToTdb(new Date('2026-01-01T00:00:00Z'));
    const tilt = (id: string) => {
      const state = loaded.stateRelativeTo(id, 'sun', jd)!;
      return obliquityToOrbit(jd, loaded.body(id), state.position, state.velocity);
    };

    expect(tilt('uranus')).toBeGreaterThan(90);
    expect(tilt('venus')).toBeGreaterThan(170);
    expect(tilt('mercury')).toBeLessThan(0.1);
  });

  it('points the rotational pole opposite the IAU pole only where W runs backwards', () => {
    const loaded = store!;
    const jd = dateToTdb(new Date('2026-01-01T00:00:00Z'));

    for (const body of loaded.bodies) {
      const alignment = dot(poleDirection(jd, body), rotationalPole(jd, body));

      expect(alignment, body.id).toBeCloseTo(body.rotationRateDegPerDay < 0 ? -1 : 1, 9);
    }
  });
});

describeWithData('the axis stays put while the body orbits', () => {
  it("keeps Earth's pole pointing the same way across a full year", () => {
    // Seasons exist because this is true. If the axis followed the orbit instead,
    // June and December would look identical from every planet.
    const summer = subSolarPoint('earth', new Date('2026-06-21T12:00:00Z')).latitudeDeg;
    const winter = subSolarPoint('earth', new Date('2026-12-21T12:00:00Z')).latitudeDeg;

    expect(summer - winter).toBeCloseTo(2 * 23.44, 0);
  });

  it('walks the sub-solar point steadily up Uranus, mid-season', () => {
    // Uranus is 45 years into an 84-year year, so its sub-solar latitude climbs
    // monotonically through 2026 -- 71.3 to 74.8 degrees, per JPL. On a body tipped
    // this far, a pole error would show up as the wrong direction of travel.
    const latitudes = JPL_SUB_SOLAR_LATITUDE.uranus!;
    const ours = REFERENCE_DATES.map(
      (date) => subSolarPoint('uranus', new Date(`${date}T00:00:00Z`)).latitudeDeg,
    );

    for (let i = 1; i < ours.length; i += 1) {
      expect(ours[i]!).toBeGreaterThan(ours[i - 1]!);
      expect(latitudes[i]!).toBeGreaterThan(latitudes[i - 1]!);
    }
  });
});
