import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  EphemerisStore,
  loadEphemerisStore,
  SPEED_OF_LIGHT_KM_S,
  type Fetcher,
} from './ephemerisStore.ts';
import { dateToTdb } from './time.ts';

/**
 * Integration tests against the real generated data.
 *
 * These read web/public/data straight off disk, so they exercise the whole chain —
 * Horizons output, the generator's serialization, the loader, the frame tree, the
 * interpolator — against JPL's actual numbers rather than fixtures we made up.
 *
 * They are skipped when the data has not been generated, so a fresh clone can still
 * run `pnpm test` before `pnpm fetch:data`.
 */

const DATA_ROOT = join(import.meta.dirname, '../../public');
const AU_KM = 149_597_870.7;

/** Reads the data files from disk with the same paths the browser would request. */
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

if (store === null) {
  console.warn('[ephemerisStore.test] No generated data found; run `pnpm fetch:data`. Skipping.');
}

describeWithData('EphemerisStore against the generated data', () => {
  const s = store!;
  const midWindow = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

  it('loads the full catalog and manifest', () => {
    expect(s.bodies).toHaveLength(10);
    expect(s.manifest.bodies).toContain('earth');
    expect(s.manifest.frame.center).toBe('500@0');
    expect(s.generatedAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('knows which instants it can answer exactly', () => {
    expect(s.isExactAt(midWindow)).toBe(true);
    expect(s.isExactAt(s.manifest.window.startJd - 1)).toBe(false);
    expect(s.isExactAt(s.manifest.window.stopJd + 1)).toBe(false);
  });

  it('reports exact states inside the window', () => {
    const state = s.stateInRoot('earth', midWindow);

    expect(state).not.toBeNull();
    expect(state!.approximate).toBe(false);
  });

  it('reproduces the official Earth-Sun distance across a full year', () => {
    // The headline claim of the whole project, checked end to end.
    let closest = Infinity;
    let farthest = 0;

    for (let day = 0; day < 366; day += 1) {
      const distance = s.distanceBetween('earth', 'sun', s.manifest.window.startJd + day);
      if (distance === null) continue;
      closest = Math.min(closest, distance);
      farthest = Math.max(farthest, distance);
    }

    expect(closest / AU_KM).toBeCloseTo(0.9833, 3);
    expect(farthest / AU_KM).toBeCloseTo(1.0167, 3);
  });

  it('reproduces every planet\'s known orbital speed', () => {
    // Mean orbital speeds, km/s, from the NASA planetary fact sheets.
    const expected: Record<string, number> = {
      mercury: 47.36,
      venus: 35.02,
      earth: 29.78,
      mars: 24.07,
      jupiter: 13.06,
      saturn: 9.68,
      uranus: 6.80,
      neptune: 5.43,
    };

    for (const [id, mean] of Object.entries(expected)) {
      const speed = s.speedRelativeTo(id, 'sun', midWindow);

      expect(speed).not.toBeNull();
      // Instantaneous speed varies with distance, so allow the eccentricity swing:
      // 25% covers Mercury, the most eccentric of the eight.
      expect(speed!).toBeGreaterThan(mean * 0.75);
      expect(speed!).toBeLessThan(mean * 1.25);
    }
  });

  it('orders the planets outward from the Sun, at their known distances', () => {
    const expectedAu: readonly (readonly [string, number])[] = [
      ['mercury', 0.387],
      ['venus', 0.723],
      ['earth', 1.0],
      ['mars', 1.524],
      ['jupiter', 5.204],
      ['saturn', 9.583],
      ['uranus', 19.191],
      ['neptune', 30.07],
    ];

    let previous = 0;
    for (const [id, semiMajorAu] of expectedAu) {
      const au = s.distanceBetween(id, 'sun', midWindow)! / AU_KM;

      expect(au).toBeGreaterThan(previous);
      // Within the eccentricity envelope of its semi-major axis.
      expect(au).toBeGreaterThan(semiMajorAu * 0.7);
      expect(au).toBeLessThan(semiMajorAu * 1.3);
      previous = au;
    }
  });

  it('puts the Sun near, but not at, the barycentric origin', () => {
    const sun = s.stateInRoot('sun', midWindow)!;
    const offset = Math.hypot(sun.position.x, sun.position.y, sun.position.z);

    // The Sun orbits the barycenter at up to ~1.5e6 km, mostly because of Jupiter.
    expect(offset).toBeGreaterThan(100_000);
    expect(offset).toBeLessThan(2_000_000);
  });

  it('is antisymmetric and self-consistent about distances', () => {
    expect(s.distanceBetween('mars', 'earth', midWindow)).toBeCloseTo(
      s.distanceBetween('earth', 'mars', midWindow)!,
      6,
    );
    expect(s.distanceBetween('earth', 'earth', midWindow)).toBe(0);
  });

  it('falls back to Kepler outside the window, and says so', () => {
    const farFuture = s.manifest.window.stopJd + 400;
    const state = s.stateInRoot('earth', farFuture);

    expect(state).not.toBeNull();
    expect(state!.approximate).toBe(true);

    // Still physically sane: about 1 AU from the origin.
    const r = Math.hypot(state!.position.x, state!.position.y, state!.position.z);
    expect(r / AU_KM).toBeGreaterThan(0.9);
    expect(r / AU_KM).toBeLessThan(1.1);
  });

  it('has no fallback for the Sun, which has no orbit to propagate', () => {
    expect(s.elementsFor('sun')).toBeNull();
    expect(s.stateInRoot('sun', s.manifest.window.stopJd + 400)).toBeNull();
  });

  it('agrees with the elements it stored: the body sits on its own orbit line', () => {
    // If the drawn ellipse and the interpolated position disagreed, every planet
    // would visibly float off its own orbit.
    const elements = s.elementsFor('mars')!;
    const fromVectors = s.stateRelativeTo('mars', 'sun', elements.epochJd)!;
    const r = Math.hypot(fromVectors.position.x, fromVectors.position.y, fromVectors.position.z);

    expect(r).toBeGreaterThan(elements.periapsisKm * 0.999);
    expect(r).toBeLessThan(elements.apoapsisKm * 1.001);
  });

  it('answers for right now, which is the whole point of LIVE mode', () => {
    const now = dateToTdb(new Date());
    const states = s.allStatesInRoot(now);

    expect(states.size).toBe(10);
    for (const [, state] of states) {
      expect(state.approximate).toBe(false);
    }
  });

  it('rejects a manifest that lists a body with no vector table', () => {
    expect(
      () =>
        new EphemerisStore({
          manifest: { ...s.manifest, bodies: [...s.manifest.bodies, 'nibiru'] },
          bodies: s.bodies,
          vectors: new Map(),
          elements: new Map(),
        }),
    ).toThrow(/no vector table/);
  });
});

describeWithData('cross-checked against NASA Eyes', () => {
  const s = store!;

  it('reproduces the Distance Tool reading for the Sun, surface to centre', () => {
    // NASA Eyes on 2026-08-24 reported 150.5 million km, 8 min 22 sec from the
    // Sun's SURFACE to Earth. Centre-to-centre is 151.2 million and 8 min 24 sec:
    // the 695,700 km solar radius is the whole difference, not a data discrepancy.
    const jd = dateToTdb(new Date('2026-08-24T17:33:29Z'));

    const centre = s.distanceBetween('earth', 'sun', jd)!;
    const fromSurface = centre - s.body('sun').radiusEquatorialKm;

    expect(centre / 1e6).toBeCloseTo(151.2, 1);
    expect(fromSurface / 1e6).toBeCloseTo(150.5, 1);
  });

  it('reproduces the reported light time either way', () => {
    const jd = dateToTdb(new Date('2026-08-24T17:33:29Z'));
    const centreSeconds = s.lightTimeSeconds('earth', 'sun', jd)!;
    const surfaceSeconds =
      (s.distanceBetween('earth', 'sun', jd)! - s.body('sun').radiusEquatorialKm) /
      SPEED_OF_LIGHT_KM_S;

    // 8 min 24 s centre-to-centre; 8 min 22 s from the surface, as NASA showed.
    expect(Math.round(centreSeconds)).toBe(504);
    expect(Math.round(surfaceSeconds)).toBe(502);
  });

  it('reproduces the reported relative speed', () => {
    // NASA showed 106.1 thousand km/hr.
    const jd = dateToTdb(new Date('2026-08-24T17:33:29Z'));
    const kmPerHour = s.speedRelativeTo('earth', 'sun', jd)! * 3600;

    expect(kmPerHour / 1000).toBeCloseTo(106.0, 0);
  });

  it('subtracts both radii in surface mode, and neither in centre mode', () => {
    const jd = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;
    const centre = s.distanceBetween('earth', 'sun', jd, 'center')!;
    const surface = s.distanceBetween('earth', 'sun', jd, 'surface')!;

    const expectedGap = s.body('sun').radiusEquatorialKm + s.body('earth').radiusEquatorialKm;
    expect(centre - surface).toBeCloseTo(expectedGap, 6);
  });

  it('gives light time straight from the speed of light', () => {
    const jd = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

    expect(s.lightTimeSeconds('mars', 'earth', jd)).toBeCloseTo(
      s.distanceBetween('mars', 'earth', jd)! / SPEED_OF_LIGHT_KM_S,
      9,
    );
    // Neptune is ~4 light hours out; a good sanity bound on the whole chain.
    const neptuneHours = s.lightTimeSeconds('neptune', 'sun', jd)! / 3600;
    expect(neptuneHours).toBeGreaterThan(3.5);
    expect(neptuneHours).toBeLessThan(4.5);
  });
});
