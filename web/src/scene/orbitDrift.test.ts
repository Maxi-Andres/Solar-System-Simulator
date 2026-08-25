import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  loadEphemerisStore,
  type EphemerisStore,
  type Fetcher,
} from '../core/ephemerisStore.ts';
import {
  orbitPointsKm,
  orbitSegmentsFor,
  stateToOsculatingElements,
} from '../core/kepler.ts';

/**
 * Regression test for "the planets are far from their orbits".
 *
 * The generator downloads osculating elements at a single epoch. Drawing the ellipse
 * from those is exact at that instant and progressively wrong afterwards, because the
 * planet moves on real vectors that include perturbations while the ellipse does not.
 * Measured at eight years from the epoch: Neptune 135 body radii off its own orbit,
 * Pluto 4400.
 *
 * Deriving the ellipse from the body's current state removes the drift rather than
 * shrinking it — the osculating ellipse of an instant passes through the body by
 * definition, at every instant.
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

/** Perpendicular distance from a point to a line segment. */
function distanceToSegment(
  p: readonly number[],
  a: readonly number[],
  b: readonly number[],
): number {
  const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
  const ap = [p[0]! - a[0]!, p[1]! - a[1]!, p[2]! - a[2]!];
  const lengthSquared = ab[0]! ** 2 + ab[1]! ** 2 + ab[2]! ** 2;
  if (lengthSquared === 0) {
    return Math.hypot(ap[0]!, ap[1]!, ap[2]!);
  }
  const t = Math.max(
    0,
    Math.min(1, (ap[0]! * ab[0]! + ap[1]! * ab[1]! + ap[2]! * ab[2]!) / lengthSquared),
  );
  return Math.hypot(ap[0]! - t * ab[0]!, ap[1]! - t * ab[1]!, ap[2]! - t * ab[2]!);
}

/**
 * Non-singular eccentricity components, e*sin(longitude of periapsis) and
 * e*cos(longitude of periapsis).
 *
 * The classical argument of periapsis degenerates on a near-circular orbit; these two
 * combinations carry the same information and stay finite and stable as e goes to
 * zero, which is why they are the standard choice for comparing such orbits.
 */
function nonSingular(elements: {
  eccentricity: number;
  argPeriapsisDeg: number;
  ascendingNodeDeg: number;
}): [number, number] {
  const longitudeOfPeriapsis =
    ((elements.argPeriapsisDeg + elements.ascendingNodeDeg) * Math.PI) / 180;
  return [
    elements.eccentricity * Math.sin(longitudeOfPeriapsis),
    elements.eccentricity * Math.cos(longitudeOfPeriapsis),
  ];
}

/** Smallest separation between two angles in degrees, across the 0/360 wrap. */
function angleDifferenceDeg(a: number, b: number): number {
  const raw = Math.abs(a - b) % 360;
  return raw > 180 ? 360 - raw : raw;
}

/** Nearest distance from a point to a closed polyline, in km. */
function distanceToPolyline(points: Float64Array, target: readonly number[]): number {
  let nearest = Infinity;
  for (let i = 0; i < points.length; i += 3) {
    const j = (i + 3) % points.length;
    nearest = Math.min(
      nearest,
      distanceToSegment(
        target,
        [points[i]!, points[i + 1]!, points[i + 2]!],
        [points[j]!, points[j + 1]!, points[j + 2]!],
      ),
    );
  }
  return nearest;
}

/** How far the body sits from the orbit drawn for that same instant, in body radii. */
function driftInRadii(s: EphemerisStore, id: string, jd: number): number | null {
  const body = s.body(id);
  const state = s.stateRelativeTo(id, 'sun', jd);
  if (state === null) {
    return null;
  }

  const elements = stateToOsculatingElements(
    state,
    s.body('sun').gmKm3S2 + body.gmKm3S2,
    jd,
    id,
    '500@10',
  );
  if (elements === null) {
    return null;
  }

  const points = orbitPointsKm(
    elements,
    orbitSegmentsFor(elements.apoapsisKm, body.radiusEquatorialKm),
  );

  return (
    distanceToPolyline(points, [state.position.x, state.position.y, state.position.z]) /
    body.radiusEquatorialKm
  );
}

describeWithData('orbit drawn from the live state', () => {
  const s = store!;
  const { startJd, stopJd } = s.manifest.window;

  it('keeps every planet on its own orbit across the whole 20-year window', () => {
    for (const body of s.bodies.filter((candidate) => candidate.drawOrbit)) {
      // Ten instants spread over the full window, including both edges.
      for (let i = 0; i <= 10; i += 1) {
        const jd = startJd + ((stopJd - startJd) * i) / 10;
        const drift = driftInRadii(s, body.id, jd);

        expect(drift).not.toBeNull();
        // Under one body radius reads as "the line goes through the planet".
        expect(drift!).toBeLessThan(1);
      }
    }
  });

  it('is dramatically better than a fixed-epoch ellipse for the outer bodies', () => {
    // The bug, reproduced: Neptune against elements frozen at the generation epoch,
    // eight years later.
    const fixed = s.elementsFor('neptune')!;
    const body = s.body('neptune');
    const jd = fixed.epochJd + 8 * 365.25;

    const state = s.stateRelativeTo('neptune', 'sun', jd);
    expect(state).not.toBeNull();

    const stalePoints = orbitPointsKm(
      fixed,
      orbitSegmentsFor(fixed.apoapsisKm, body.radiusEquatorialKm),
    );
    const staleDrift =
      distanceToPolyline(stalePoints, [
        state!.position.x,
        state!.position.y,
        state!.position.z,
      ]) / body.radiusEquatorialKm;

    expect(staleDrift).toBeGreaterThan(50);
    expect(driftInRadii(s, 'neptune', jd)!).toBeLessThan(1);
  });
});

describeWithData('stateToOsculatingElements', () => {
  const s = store!;
  const jd = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

  it('reproduces every planet\'s known orbital period', () => {
    const expected: Record<string, number> = {
      mercury: 0.2408,
      venus: 0.6152,
      earth: 1.0,
      mars: 1.8808,
      jupiter: 11.862,
      saturn: 29.457,
      uranus: 84.021,
      neptune: 164.79,
    };

    for (const [id, years] of Object.entries(expected)) {
      const state = s.stateRelativeTo(id, 'sun', jd)!;
      const elements = stateToOsculatingElements(
        state,
        s.body('sun').gmKm3S2 + s.body(id).gmKm3S2,
        jd,
        id,
        '500@10',
      )!;
      const periodYears = elements.periodSec / 86_400 / 365.25;

      // Osculating values oscillate about the mean elements, so a few percent is the
      // honest tolerance: Uranus and Neptune are genuinely that perturbed.
      expect(periodYears).toBeGreaterThan(years * 0.97);
      expect(periodYears).toBeLessThan(years * 1.03);
    }
  });

  it('agrees with the elements Horizons itself computed', () => {
    // Same instant, same frame, so the two derivations must agree — but not to
    // arbitrary precision, and the reason is worth stating because it sets every
    // tolerance below.
    //
    // These elements are derived from the *interpolated* state. Neptune, sampled every
    // 32 days, carries 1.34 m/s of velocity error out of 5.47 km/s (2.4e-4); its
    // position agrees with Horizons to 360 km out of 4.47e9. Traced by comparing our
    // heliocentric state against Horizons directly — the Sun's contribution is
    // 0.00 m/s, so the residue is Neptune's own sampling.
    //
    // Every orbital element is a function of that velocity, and some amplify it. The
    // eccentricity vector is a difference of nearly equal terms, so at e = 0.01 it
    // magnifies velocity error by roughly 1/e. The orbit normal, and therefore the
    // inclination and node, rotate by about dv/v.
    //
    // Also checked: Horizons uses G(M + m), not GM(Sun) alone. With the planet's mass
    // included Earth matches to 0.0000% and Jupiter to 0.004%; without it Jupiter is
    // off by 0.097%.
    //
    // None of this moves a body off its drawn line — that is what the drift tests
    // above assert, and they hold to under one body radius.
    for (const id of ['earth', 'jupiter', 'neptune']) {
      const horizons = s.elementsFor(id)!;
      const state = s.stateRelativeTo(id, 'sun', horizons.epochJd)!;
      const derived = stateToOsculatingElements(
        state,
        s.body('sun').gmKm3S2 + s.body(id).gmKm3S2,
        horizons.epochJd,
        id,
        '500@10',
      )!;

      // Size: within 0.1%. Period gets 0.15%, since P scales as a^(3/2) and so
      // carries one and a half times the semi-major axis error.
      expect(Math.abs(derived.semiMajorAxisKm / horizons.semiMajorAxisKm - 1)).toBeLessThan(1e-3);
      expect(Math.abs(derived.periodSec / horizons.periodSec - 1)).toBeLessThan(1.5e-3);
      expect(Math.abs(derived.eccentricity - horizons.eccentricity)).toBeLessThan(5e-4);

      // Orientation of the plane: within a hundredth of a degree, tight enough that a
      // wrong rotation sequence or a sign error could not slip through.
      expect(Math.abs(derived.inclinationDeg - horizons.inclinationDeg)).toBeLessThan(0.01);
      expect(angleDifferenceDeg(derived.ascendingNodeDeg, horizons.ascendingNodeDeg))
        .toBeLessThan(0.2);

      // Where periapsis points is compared through the non-singular elements
      // e*cos(w+O) and e*sin(w+O), not through w itself. The argument of periapsis is
      // ill-conditioned as e approaches zero — on a circular orbit there is no
      // periapsis direction to speak of — so for Neptune at e = 0.01 a 1e-4 wobble in
      // e swings w by a couple of degrees while the actual ellipse barely moves. These
      // combinations are the standard fix and stay well behaved.
      const [derivedH, derivedK] = nonSingular(derived);
      const [horizonsH, horizonsK] = nonSingular(horizons);
      expect(Math.abs(derivedH - horizonsH)).toBeLessThan(1e-3);
      expect(Math.abs(derivedK - horizonsK)).toBeLessThan(1e-3);
    }
  });

  it('returns null for degenerate states rather than NaN elements', () => {
    const zero = { position: { x: 0, y: 0, z: 0 }, velocity: { x: 0, y: 0, z: 0 } };
    expect(stateToOsculatingElements(zero, 1, 0, 'x', 'y')).toBeNull();

    // Escape trajectory: no closed ellipse exists.
    const escaping = {
      position: { x: 1.5e8, y: 0, z: 0 },
      velocity: { x: 0, y: 100, z: 0 },
    };
    expect(stateToOsculatingElements(escaping, 1.327e11, 0, 'x', 'y')).toBeNull();
  });
});

/**
 * Two defects reported from the running app, both about the orbit leaving the planet.
 *
 *   "Neptune goes wrong near the end of the data"
 *   "Pluto is fine for a period, then goes, then is fine again"
 *
 * They had separate causes. The giants' tables ended short of the advertised window,
 * so in that gap they silently fell back to Keplerian propagation while the inner
 * planets stayed exact. And the orbit rebuild was throttled on elapsed time — a
 * four-hundredth of the orbital period — which for Pluto froze the ellipse for 226
 * days while Charon moves its centre every 6.4.
 */
describeWithData('reported orbit defects', () => {
  const s = store!;

  it('covers the advertised window for every body, including the giants', () => {
    // The end-of-data jump: with a 32-day step and no slack, Jupiter through Neptune
    // stopped eight days before the window the manifest claimed.
    for (const id of s.manifest.bodies) {
      const exact = s.stateInRoot(id, s.manifest.window.stopJd);

      expect(exact).not.toBeNull();
      expect(exact!.approximate).toBe(false);
    }
  });

  it('stays exact right up to both edges of the window', () => {
    const { startJd, stopJd } = s.manifest.window;

    for (const jd of [startJd, startJd + 0.5, stopJd - 0.5, stopJd]) {
      for (const id of s.manifest.bodies) {
        const state = s.stateInRoot(id, jd);
        expect(state).not.toBeNull();
        expect(state!.approximate).toBe(false);
      }
    }
  });

  it('keeps the outer planets on their lines near the end of the data', () => {
    // Sampled densely through the final month, where the fallback used to kick in.
    const { stopJd } = s.manifest.window;

    for (const id of ['jupiter', 'saturn', 'uranus', 'neptune']) {
      for (let back = 0; back <= 30; back += 2) {
        const drift = driftInRadii(s, id, stopJd - back);

        expect(drift).not.toBeNull();
        expect(drift!).toBeLessThan(1);
      }
    }
  });

  it('follows Pluto through a full Charon cycle without leaving it behind', () => {
    // Charon swings Pluto's centre 2131 km about their shared barycentre every 6.4
    // days — nearly two Pluto radii. Sampled finely across two cycles, the ellipse
    // derived at each instant must still pass through the body.
    const jd0 = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;

    for (let day = 0; day <= 13; day += 0.5) {
      const drift = driftInRadii(s, 'pluto', jd0 + day);

      expect(drift).not.toBeNull();
      expect(drift!).toBeLessThan(1);
    }
  });

  it('shows how far Pluto moves within one throttle window, which is why time-based throttling failed', () => {
    // The measurement behind the fix. Freeze the ellipse at one instant, then check
    // how far Pluto wanders from it over the 226 days the old throttle allowed.
    const jd0 = (s.manifest.window.startJd + s.manifest.window.stopJd) / 2;
    const body = s.body('pluto');
    const frozen = stateToOsculatingElements(
      s.stateRelativeTo('pluto', 'sun', jd0)!,
      s.body('sun').gmKm3S2 + body.gmKm3S2,
      jd0,
      'pluto',
      '500@10',
    )!;
    const frozenPoints = orbitPointsKm(
      frozen,
      orbitSegmentsFor(frozen.apoapsisKm, body.radiusEquatorialKm),
    );

    let worst = 0;
    for (let day = 0; day <= 226; day += 2) {
      const state = s.stateRelativeTo('pluto', 'sun', jd0 + day)!;
      worst = Math.max(
        worst,
        distanceToPolyline(frozenPoints, [
          state.position.x,
          state.position.y,
          state.position.z,
        ]) / body.radiusEquatorialKm,
      );
    }

    // Well over a body radius: visibly off, which is what was reported.
    expect(worst).toBeGreaterThan(1);
  });
});
