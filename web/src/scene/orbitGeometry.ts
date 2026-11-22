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

/**
 * The points an OrbitLine draws for these elements: the one rule, for it and the tests.
 * `out`, when the right length, is refilled instead of a new array (orbitPointsKm).
 */
export function orbitLinePointsKm(
  elements: OsculatingElements,
  bodyRadiusKm: number,
  out?: Float64Array,
): Float64Array {
  return orbitPointsKm(
    elements,
    orbitSegmentsFor(elements.apoapsisKm, bodyRadiusKm),
    refinementAnomaly(elements, bodyRadiusKm),
    out,
  );
}

/**
 * How far an orbit line may be off and nobody see it, in pixels where it comes nearest the
 * camera. A quarter, as live mode's step (renderDemand.ts LIVE_STEP_PX).
 */
export const ORBIT_UNSEEN_PX = 0.25;

/**
 * The most an orbit line may move, km, and stay under ORBIT_UNSEEN_PX on screen: what that
 * many pixels span `nearestKm` away, where the line comes nearest the camera (OrbitLine's
 * `nearestKm`). A move seen from farther away shows smaller, so a move under this is under
 * the threshold everywhere on the line.
 *
 * Under warp, from the whole Solar System, the planets' osculating ellipses breathe by tens
 * of thousands of kilometres a month -- Earth's with the Moon, Pluto's with Charon -- and a
 * comet's, a few kilometres across, by far more than its size; each was rebuilt every frame,
 * up to sixteen thousand points, to move a ten-thousandth of a pixel. Held to this they are
 * rebuilt when it shows.
 */
export function orbitUnseenKm(nearestKm: number, pixelsPerRadian: number): number {
  return (Math.max(nearestKm, 0) * ORBIT_UNSEEN_PX) / pixelsPerRadian;
}

/** An ellipse as a curve: its centre, semi-axes, periapsis direction and pole, km. */
interface EllipseShape {
  readonly cx: number;
  readonly cy: number;
  readonly cz: number;
  readonly a: number;
  readonly b: number;
  /** Unit vectors: toward periapsis, and along the orbit's normal. */
  readonly px: number;
  readonly py: number;
  readonly pz: number;
  readonly wx: number;
  readonly wy: number;
  readonly wz: number;
}

function ellipseShape(elements: OsculatingElements): EllipseShape {
  const rad = Math.PI / 180;
  const node = elements.ascendingNodeDeg * rad;
  const inclination = elements.inclinationDeg * rad;
  const omega = elements.argPeriapsisDeg * rad;
  const cosNode = Math.cos(node);
  const sinNode = Math.sin(node);
  const cosI = Math.cos(inclination);
  const sinI = Math.sin(inclination);
  const cosOmega = Math.cos(omega);
  const sinOmega = Math.sin(omega);
  const a = elements.semiMajorAxisKm;
  const e = elements.eccentricity;
  const px = cosNode * cosOmega - sinNode * sinOmega * cosI;
  const py = sinNode * cosOmega + cosNode * sinOmega * cosI;
  const pz = sinOmega * sinI;
  // The centre is a·e from the focus, away from periapsis.
  return {
    cx: -a * e * px,
    cy: -a * e * py,
    cz: -a * e * pz,
    a,
    b: a * Math.sqrt(1 - e * e),
    px,
    py,
    pz,
    wx: sinNode * sinI,
    wy: -cosNode * sinI,
    wz: cosI,
  };
}

/** The angle between two unit vectors, radians: atan2, which holds up for tiny angles. */
function angleBetween(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
  const cx = ay * bz - az * by;
  const cy = az * bx - ax * bz;
  const cz = ax * by - ay * bx;
  return Math.atan2(Math.sqrt(cx * cx + cy * cy + cz * cz), ax * bx + ay * by + az * bz);
}

/**
 * How far the curve drawn for `from` is, at most, from the one for `to`, km: no point of
 * either more than this from the other.
 *
 * The ellipse is its centre plus a circle of the minor semi-axis, plus (a - b) cos t along
 * periapsis. Moving the centre moves every point by as much; the circle changes only with b
 * and with a tilt of its plane, by b times the tilt; turning it within its plane changes
 * nothing -- the same circle -- and the stretch along periapsis, (a - b), moves by its own
 * change and by (a - b) times the turn, twice over for the shift in t that keeps the circle
 * still. So: |dc| + |db| + |d(a - b)| + a·tilt + 2(a - b)·turn.
 *
 * Under warp it stands in for a guess (OrbitLine's #legacyShiftKm) that takes a turn of
 * periapsis as sweeping the whole curve through a·dtheta. For a near-circle that is nearly
 * nothing -- Venus, e = 0.007 -- and in the plane of the ecliptic the node and periapsis
 * trade off with no change at all; Earth's line, whose osculating periapsis swings with the
 * Moon, was taken to move five million km a frame, and rebuilt every frame for it.
 */
export function ellipseShiftKm(from: OsculatingElements, to: OsculatingElements): number {
  const p = ellipseShape(from);
  const n = ellipseShape(to);
  const tilt = angleBetween(p.wx, p.wy, p.wz, n.wx, n.wy, n.wz);
  const turn = angleBetween(p.px, p.py, p.pz, n.px, n.py, n.pz);
  return (
    Math.hypot(n.cx - p.cx, n.cy - p.cy, n.cz - p.cz) +
    Math.abs(n.b - p.b) +
    Math.abs(n.a - n.b - (p.a - p.b)) +
    Math.max(p.a, n.a) * tilt +
    2 * Math.max(p.a - p.b, n.a - n.b) * turn
  );
}

/**
 * Float32's relative precision, with a factor of two for the matrix and the vertex each
 * rounding: what an anchor's drift costs a line's points, as a share of the drift.
 */
const FLOAT32_DRIFT_ERROR = 2 * 2 ** -24;

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
  /** The longest chord of the uniform grid can be, km: a·ΔE, since |dr/dE| is at most a. */
  #chordKm = 0;
  /**
   * The camera's distance from the line, less half a chord, when last measured -- and from
   * where, relative to the body orbited: see nearestKm. NaN when the line has changed since.
   */
  #nearestKm = Number.NaN;
  #nearestFromX = 0;
  #nearestFromY = 0;
  #nearestFromZ = 0;
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
    this.#pointsKm = this.#pointsFor(elements, 0);
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
  #pointsFor(elements: OsculatingElements, unseenKm: number): Float64Array {
    const r = this.#bodyRadiusKm;
    this.#builtE = refinementAnomaly(elements, r);
    // The sagitta allowed at the body: a quarter of its radius, or what cannot be seen from
    // where the camera is, whichever is more.
    this.#recentreE =
      this.#builtE === null
        ? Infinity
        : Math.sqrt(
            (8 * Math.max(ORBIT_SAGITTA_RADII * r, unseenKm) * (1 - elements.eccentricity ** 2)) /
              elements.semiMajorAxisKm,
          );
    this.#chordKm =
      (elements.semiMajorAxisKm * 2 * Math.PI) / orbitSegmentsFor(elements.apoapsisKm, r);
    this.#nearestKm = Number.NaN;
    // The old points' buffer refilled, when the count is unchanged -- it always is for a
    // given body, but for a refined line crossing between the grid's two rules.
    return orbitLinePointsKm(elements, r, this.#pointsKm);
  }

  /**
   * How near the line comes to the camera, km, at least: the camera given relative to the
   * body orbited, as the points are.
   *
   * Measured against every point, less half the longest chord -- the most a chord between
   * two points can come nearer than both -- and kept: the camera may move by half of it
   * before it is measured again, the distance shrinking by what it moved meanwhile. So from
   * afar it is measured when the line is rebuilt and little else, and a pass over the points
   * is a fraction of what a rebuild costs. With the camera at the line it is measured every
   * frame, and is nothing -- the body's own orbit, seen from beside the body.
   */
  nearestKm(cameraX: number, cameraY: number, cameraZ: number): number {
    if (this.#nearestKm === this.#nearestKm) {
      const moved = Math.hypot(
        cameraX - this.#nearestFromX,
        cameraY - this.#nearestFromY,
        cameraZ - this.#nearestFromZ,
      );
      if (moved < this.#nearestKm / 2) {
        return this.#nearestKm - moved;
      }
    }
    const points = this.#pointsKm;
    let nearest = Infinity;
    for (let i = 0; i < points.length; i += 3) {
      const dx = points[i]! - cameraX;
      const dy = points[i + 1]! - cameraY;
      const dz = points[i + 2]! - cameraZ;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < nearest) {
        nearest = d2;
      }
    }
    this.#nearestKm = Math.max(0, Math.sqrt(nearest) - this.#chordKm / 2);
    this.#nearestFromX = cameraX;
    this.#nearestFromY = cameraY;
    this.#nearestFromZ = cameraZ;
    return this.#nearestKm;
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
   *
   * What the eye could resolve is four tenths of the body's radius, where the camera is by
   * the line, by a guess at the shift that errs high (#legacyShiftKm).
   *
   * **Under warp, `unseenKm`**: what a quarter of a pixel spans where the line comes nearest
   * the camera (orbitUnseenKm), when that is more -- and the shift measured as the curve
   * really moves (ellipseShiftKm). There the guess rebuilt every planet every frame from
   * afar, for nothing on screen. Not with the clock at real time or paused: there the line is
   * rebuilt as it always was, so a still view is the very picture it was. Leaving warp, the
   * next frame holds the line to that again, measured from what it was last built from.
   */
  setElements(elements: OsculatingElements, unseenKm: number | null = null): void {
    if (
      this.#builtFrom !== null &&
      (unseenKm === null
        ? this.#legacyShiftKm(elements) < this.#bodyRadiusKm * 0.4
        : ellipseShiftKm(this.#builtFrom, elements) < Math.max(this.#bodyRadiusKm * 0.4, unseenKm)) &&
      this.#movedE(elements) < this.#recentreE
    ) {
      return;
    }

    this.#pointsKm = this.#pointsFor(elements, unseenKm ?? 0);
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
   *
   * It errs high -- a turn of a near-circle's periapsis moves the curve hardly at all --
   * and so rebuilds sooner than the 0.4 radii it is held to; the line at real time and
   * paused is the line that makes. Under warp, ellipseShiftKm instead.
   */
  #legacyShiftKm(next: OsculatingElements): number {
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
   *
   * `unseenKm` is setElements's, under warp only: the anchor matters for float32's precision alone, and a
   * drift D since the buffer was filled costs the points nearest the camera about D times
   * float32's precision. Held under what cannot be seen it may run about nine hundred times
   * as far as the line is from the camera -- millions of km, from afar, where the focus's own
   * motion had the buffer refilled every frame under warp.
   */
  update(sunRelativeToFocusKm: Vec3, toleranceKm: number, unseenKm: number | null = null): void {
    this.#toleranceKm = Math.max(toleranceKm, 1, (unseenKm ?? 0) / FLOAT32_DRIFT_ERROR);

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
