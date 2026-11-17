import { describe, expect, it } from 'vitest';

import { stateToOsculatingElements } from './kepler.ts';
import {
  isActive,
  METEOR_SHOWERS,
  meteorShowerOf,
  peakJdNear,
  showerNow,
  solarLongitude,
  streamPath,
  streamState,
  sunTrueLongitudeOfDate,
} from './meteorShowers.ts';
import type { StateVector } from './vec3.ts';

const AU_KM = 149_597_870.7;
const GM_SUN = 1.32712440041e11;
const DEG = Math.PI / 180;

function jdOf(iso: string): number {
  return Date.parse(iso) / 86_400_000 + 2440587.5;
}

/** Earth on a circular orbit, opposite the Sun's longitude: enough to check a stream's shape. */
function circularEarth(solarLongitudeDeg: number): StateVector {
  const l = (solarLongitudeDeg + 180) * DEG;
  const v = Math.sqrt(GM_SUN / AU_KM);
  return {
    position: { x: AU_KM * Math.cos(l), y: AU_KM * Math.sin(l), z: 0 },
    velocity: { x: -v * Math.sin(l), y: v * Math.cos(l), z: 0 },
  };
}

function shower(id: string) {
  const found = meteorShowerOf(id);
  if (found === null) throw new Error(id);
  return found;
}

describe('solar longitude', () => {
  it('matches Meeus example 25.a', () => {
    // 1992 October 13.0 TD: true longitude 199.90988 degrees.
    expect(sunTrueLongitudeOfDate(2448908.5)).toBeCloseTo(199.90988, 4);
  });

  it('puts the Perseids at their maximum on 2026 August 12-13, as IMO does', () => {
    const peak = peakJdNear(shower('shower-perseids'), jdOf('2026-08-01T00:00:00Z'));
    expect(peak).toBeGreaterThan(jdOf('2026-08-12T12:00:00Z'));
    expect(peak).toBeLessThan(jdOf('2026-08-13T12:00:00Z'));
    expect(solarLongitude(peak)).toBeCloseTo(140.0, 3);
  });

  it('every maximum falls on the day IMO gives for 2026', () => {
    for (const s of METEOR_SHOWERS) {
      const [month, day] = s.peak;
      const near = Date.UTC(2026, month - 1, day) / 86_400_000 + 2440587.5;
      const peak = peakJdNear(s, near);
      expect(Math.abs(peak - (near + 0.5)), s.id).toBeLessThan(1.01);
    }
  });
});

describe('activity', () => {
  it('follows the IMO periods, across the turn of the year too', () => {
    expect(isActive(shower('shower-perseids'), jdOf('2026-08-01T00:00:00Z'))).toBe(true);
    expect(isActive(shower('shower-perseids'), jdOf('2026-09-01T00:00:00Z'))).toBe(false);
    expect(isActive(shower('shower-quadrantids'), jdOf('2027-01-02T00:00:00Z'))).toBe(true);
    expect(isActive(shower('shower-quadrantids'), jdOf('2026-12-30T00:00:00Z'))).toBe(true);
    expect(isActive(shower('shower-quadrantids'), jdOf('2026-06-30T00:00:00Z'))).toBe(false);
    // Another year, the same calendar.
    expect(isActive(shower('shower-leonids'), jdOf('1999-11-18T00:00:00Z'))).toBe(true);
  });

  it('says when, in a few words', () => {
    expect(showerNow(shower('shower-leonids'), jdOf('2026-11-15T00:00:00Z'))).toBe('Active · maximum in 3 days');
    expect(showerNow(shower('shower-perseids'), jdOf('2026-11-15T00:00:00Z'))).toBe('Next active Jul 17');
  });
});

describe('the streams', () => {
  it('are near-parabolic where their parents are: the Lyrids, of a 415-year comet', () => {
    const lyrids = shower('shower-lyrids');
    const { velocity } = streamState(lyrids, circularEarth(lyrids.peakSolarLongitudeDeg));
    const escape = Math.sqrt((2 * GM_SUN) / AU_KM);
    expect(Math.hypot(velocity.x, velocity.y, velocity.z) / escape).toBeGreaterThan(0.97);
    expect(Math.hypot(velocity.x, velocity.y, velocity.z) / escape).toBeLessThan(1.03);
  });

  it("lie near their parents' orbits", () => {
    const orbit = (id: string) =>
      stateToOsculatingElements(streamState(shower(id), circularEarth(shower(id).peakSolarLongitudeDeg)), GM_SUN, 0, id, 'sun') ?? {
        inclinationDeg: Number.NaN,
        periapsisKm: Number.NaN,
      };
    // 109P/Swift-Tuttle: inclination 113.5 degrees. 55P/Tempel-Tuttle: 162.5. 1P/Halley: 162.2.
    // (3200) Phaethon: perihelion 0.14 AU.
    expect(orbit('shower-perseids').inclinationDeg).toBeGreaterThan(110);
    expect(orbit('shower-perseids').inclinationDeg).toBeLessThan(117);
    expect(orbit('shower-leonids').inclinationDeg).toBeGreaterThan(158);
    expect(orbit('shower-orionids').inclinationDeg).toBeGreaterThan(158);
    expect(orbit('shower-geminids').periapsisKm / AU_KM).toBeGreaterThan(0.1);
    expect(orbit('shower-geminids').periapsisKm / AU_KM).toBeLessThan(0.2);
  });
});

describe('the stream path', () => {
  it('keeps to the conic: a circular orbit stays at 1 AU a quarter turn on', () => {
    const earth = circularEarth(0);
    const quarterYear = (2 * Math.PI * Math.sqrt(AU_KM ** 3 / GM_SUN)) / 86_400 / 4;
    const path = streamPath(earth, GM_SUN, quarterYear, quarterYear / 200);
    expect(path).toHaveLength(401);
    expect(path[200]).toEqual(earth.position);
    for (const p of [path[0]!, path[400]!]) {
      expect(Math.hypot(p.x, p.y, p.z) / AU_KM).toBeCloseTo(1, 8);
    }
    // A quarter turn ahead of the start, which is at longitude 180.
    expect(path[400]!.y / AU_KM).toBeCloseTo(-1, 6);
  });
});
