import type { OsculatingElements } from '@sss/tools/types';
import * as THREE from 'three';

import {
  eccentricFromTrueAnomaly,
  ORBIT_SAGITTA_RADII,
  orbitPointsKm,
  orbitSegmentsFor,
} from '../core/kepler.ts';
import type { Vec3 } from '../core/vec3.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * An orbit line that stays glued to its planet.
 *
 * Two things put a drawn orbit visibly off its body, and both had to be fixed:
 *
 *  1. Chord error. A polyline cuts inside the true ellipse by r*(1 - cos(pi/N)).
 *     At a fixed 512 segments that is a quarter of Earth's radius but ninety-three
 *     Pluto radii, because Pluto's orbit is enormous and Pluto is tiny. Segment
 *     count is now solved per body from its own radius.
 *
 *  2. Float32 cancellation. Vertices are naturally expressed relative to the Sun,
 *     which for Pluto means ~5.9e6 scene units. Focus Pluto and the GPU computes
 *     5.9e6 + (-5.9e6): an ulp there is 0.7 units, i.e. ~700 km of noise, while the
 *     camera sits a few thousand km away. The line frays off the planet no matter
 *     how many segments it has.
 *
 * The fix for (2) is the same idea as the floating origin: keep the authoritative
 * points in float64, and rebuild the float32 buffer around an anchor near the
 * camera. Near the focus the coordinates are small and precise; far from it they are
 * large but so distant that the error is far below a pixel. The buffer is only
 * rebuilt when the anchor goes stale, not every frame.
 *
 * A third cause turned up later, and it was the largest of all: the ellipse was built
 * from elements at a **fixed epoch**, while the planet moves on exact vectors that
 * include perturbations. Scrub eight years from that epoch and Neptune sat 135 body
 * radii off its own orbit, Pluto 4400. The ellipse is now recomputed from the body's
 * current state, which by definition passes through it — see `setElements`.
 *
 * And a fourth, with the named small bodies (step B1a): bodies too small for any uniform
 * polyline. The segment count is solved from the body's radius but capped at 16,384, and
 * Apophis, 170 m across on an orbit of 1.1 AU, would need 138,000; at the cap its line
 * sagged up to 3 km inside the ellipse, eighteen of its radii -- 350 pixels of an
 * 864-pixel screen with it focused, at the zoom where its own orbit is still drawn in
 * full. So where
 * the cap binds, the polyline is refined at the body itself (see orbitAnomalies) and
 * re-centred as the body moves along it -- see `#recentreE`.
 */
/**
 * How solid an orbit line is drawn, before any fade.
 *
 * Named because the focused body's own orbit is faded out against it when you get close
 * enough that the body overflows the frame; see `focusOrbitOpacity`.
 */
export const ORBIT_OPACITY = 0.55;

/**
 * Where an orbit line is refined: the body's eccentric anomaly, for a body the uniform
 * grid cannot hold within its sagitta because the segment count is capped -- or null
 * for every body it can, which is every planet and moon.
 */
export function refinementAnomaly(elements: OsculatingElements, bodyRadiusKm: number): number | null {
  const segments = orbitSegmentsFor(elements.apoapsisKm, bodyRadiusKm);
  const needed = orbitSegmentsFor(elements.apoapsisKm, bodyRadiusKm, ORBIT_SAGITTA_RADII, 256, Infinity);
  return needed > segments
    ? eccentricFromTrueAnomaly((elements.trueAnomalyDeg * Math.PI) / 180, elements.eccentricity)
    : null;
}

/** The points an OrbitLine draws for these elements: the one rule, for it and the tests. */
export function orbitLinePointsKm(elements: OsculatingElements, bodyRadiusKm: number): Float64Array {
  return orbitPointsKm(
    elements,
    orbitSegmentsFor(elements.apoapsisKm, bodyRadiusKm),
    refinementAnomaly(elements, bodyRadiusKm),
  );
}

export class OrbitLine {
  readonly line: THREE.LineLoop;
  /** Authoritative points, heliocentric, km, float64. */
  #pointsKm: Float64Array;
  #positions: Float32Array;
  /** The elements the current geometry was built from. */
  #builtFrom: OsculatingElements | null = null;
  /** Sun position relative to focus, in km, at the last rebuild. */
  #anchorKm: Vec3 = { x: 0, y: 0, z: 0 };
  #anchored = false;
  /** How far the anchor may drift before the buffer is rebuilt, in km. */
  #toleranceKm = 1;
  /**
   * The eccentric anomaly the polyline is refined at -- where the body was when it was
   * built -- or null for a body the uniform grid already holds.
   */
  #builtE: number | null = null;
  /**
   * How far, in eccentric anomaly, the body may move from #builtE before the refinement
   * is re-centred on it.
   *
   * The body moves off its vertex onto the run of chords closing in on it, and the chord
   * it is then on is no longer than the way it has come: a·ΔE at most, since |dr/dE| is
   * at most a. That chord sags inside the ellipse by its length squared over eight times
   * the radius of curvature, which is never less than a(1 - e²). Held to the sagitta the
   * uniform grids are held to, ΔE = sqrt(8·s·r·(1 - e²) / a): 4.9e-5 rad for Apophis,
   * a hundred seconds of its motion -- so at real time the line is rebuilt every hundred
   * seconds, and under warp every frame: 16,425 points, a fraction of a millisecond.
   */
  #recentreE = Infinity;

  readonly #bodyRadiusKm: number;

  constructor(elements: OsculatingElements, bodyRadiusKm: number, color: string) {
    this.#bodyRadiusKm = bodyRadiusKm;
    this.#pointsKm = this.#pointsFor(elements);
    this.#positions = new Float32Array(this.#pointsKm.length);
    this.#builtFrom = elements;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(this.#positions, 3));
    // The orbit never leaves the frustum in any useful sense, and its bounding
    // sphere would be recomputed on every rebuild for nothing.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);

    this.line = new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: ORBIT_OPACITY,
        depthWrite: false,
      }),
    );
    this.line.frustumCulled = false;
  }

  get segments(): number {
    return this.#pointsKm.length / 3;
  }

  /** The authoritative points for these elements, refined at the body where it needs it. */
  #pointsFor(elements: OsculatingElements): Float64Array {
    const r = this.#bodyRadiusKm;
    this.#builtE = refinementAnomaly(elements, r);
    this.#recentreE =
      this.#builtE === null
        ? Infinity
        : Math.sqrt(
            (8 * ORBIT_SAGITTA_RADII * r * (1 - elements.eccentricity ** 2)) /
              elements.semiMajorAxisKm,
          );
    return orbitLinePointsKm(elements, r);
  }

  /** How far the body is from where the refinement is, in eccentric anomaly. */
  #movedE(elements: OsculatingElements): number {
    if (this.#builtE === null) {
      return 0;
    }
    const now = eccentricFromTrueAnomaly(
      (elements.trueAnomalyDeg * Math.PI) / 180,
      elements.eccentricity,
    );
    const raw = Math.abs(now - this.#builtE) % (2 * Math.PI);
    return Math.min(raw, 2 * Math.PI - raw);
  }

  /**
   * Rebuilds the ellipse from fresh elements, if doing so would visibly move it.
   *
   * The trigger is how far the ellipse would shift, not how much time has passed.
   * Throttling on elapsed time looked reasonable and was wrong: at a four-hundredth
   * of the orbital period, Pluto's line was frozen for 226 days while Pluto's own
   * centre circles the Pluto-Charon barycentre every 6.4 days. It drifted off the
   * frozen ellipse and came back, over and over.
   *
   * Estimating the shift instead handles that automatically, and costs nothing: the
   * elements themselves are a few dozen operations, and only the polyline — up to
   * eleven thousand points for Pluto — is expensive. This rebuilds exactly when the
   * shift crosses what the eye could resolve.
   */
  setElements(elements: OsculatingElements): void {
    if (
      this.#builtFrom !== null &&
      this.#shiftKm(elements) < this.#bodyRadiusKm * 0.4 &&
      this.#movedE(elements) < this.#recentreE
    ) {
      return;
    }

    this.#pointsKm = this.#pointsFor(elements);
    this.#builtFrom = elements;

    if (this.#positions.length !== this.#pointsKm.length) {
      this.#positions = new Float32Array(this.#pointsKm.length);
      this.line.geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(this.#positions, 3),
      );
    }
    // Force the next update() to refill the buffer with the new shape.
    this.#anchored = false;
  }

  /**
   * Roughly how far the drawn ellipse would move if rebuilt from these elements.
   *
   * Each term is the displacement that change produces at orbital distance: a shift
   * in semi-major axis moves the curve directly, a shift in eccentricity moves the
   * focus by a*de, and a rotation of the orbital plane or of periapsis sweeps the
   * curve through a*dtheta. Taking the largest is enough for a threshold test.
   */
  #shiftKm(next: OsculatingElements): number {
    const previous = this.#builtFrom;
    if (previous === null) {
      return Infinity;
    }

    const a = next.semiMajorAxisKm;
    const radians = (degrees: number): number => (degrees * Math.PI) / 180;
    const angleShift = (from: number, to: number): number => {
      const raw = Math.abs(to - from) % 360;
      return radians(raw > 180 ? 360 - raw : raw) * a;
    };

    return Math.max(
      Math.abs(next.semiMajorAxisKm - previous.semiMajorAxisKm),
      Math.abs(next.eccentricity - previous.eccentricity) * a,
      angleShift(previous.inclinationDeg, next.inclinationDeg),
      angleShift(previous.ascendingNodeDeg, next.ascendingNodeDeg),
      angleShift(previous.argPeriapsisDeg, next.argPeriapsisDeg),
    );
  }

  /**
   * Updates the line for a frame.
   *
   * `sunRelativeToFocusKm` is where the Sun sits relative to the focused body — the
   * orbit's true origin in the current view.
   *
   * `toleranceKm` should scale with what is currently visible; the focused body's
   * radius is a good proxy, since that is the smallest thing on screen worth
   * resolving.
   */
  update(sunRelativeToFocusKm: Vec3, toleranceKm: number): void {
    this.#toleranceKm = Math.max(toleranceKm, 1);

    const drift = this.#anchored
      ? Math.hypot(
          sunRelativeToFocusKm.x - this.#anchorKm.x,
          sunRelativeToFocusKm.y - this.#anchorKm.y,
          sunRelativeToFocusKm.z - this.#anchorKm.z,
        )
      : Infinity;

    if (drift > this.#toleranceKm) {
      this.#rebuild(sunRelativeToFocusKm);
    }

    // Whatever drift remains is carried by the object transform, which is exact
    // enough because it is a small number.
    this.line.position.set(
      (sunRelativeToFocusKm.x - this.#anchorKm.x) / KM_PER_UNIT,
      (sunRelativeToFocusKm.y - this.#anchorKm.y) / KM_PER_UNIT,
      (sunRelativeToFocusKm.z - this.#anchorKm.z) / KM_PER_UNIT,
    );
  }

  /** Recomputes the float32 buffer with the vertices offset by the new anchor. */
  #rebuild(anchorKm: Vec3): void {
    const points = this.#pointsKm;
    const positions = this.#positions;

    for (let i = 0; i < positions.length; i += 3) {
      // Sum in float64, then narrow once. Doing this on the GPU instead is exactly
      // the cancellation this class exists to avoid.
      positions[i] = (points[i]! + anchorKm.x) / KM_PER_UNIT;
      positions[i + 1] = (points[i + 1]! + anchorKm.y) / KM_PER_UNIT;
      positions[i + 2] = (points[i + 2]! + anchorKm.z) / KM_PER_UNIT;
    }

    this.#anchorKm = { x: anchorKm.x, y: anchorKm.y, z: anchorKm.z };
    this.#anchored = true;

    const attribute = this.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    attribute.needsUpdate = true;
  }

  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
  }
}
