import type { PathTable } from '@sss/tools/types';
import * as THREE from 'three';

import { findInterval, interpolateState } from '../core/hermite.ts';
import { SECONDS_PER_DAY } from '../core/time.ts';
import type { StateVector, Vec3 } from '../core/vec3.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * A spacecraft's trajectory, drawn from JPL's samples rather than from a conic.
 *
 * A craft is not on an ellipse for long enough to draw one: Juice changes orbit at every
 * flyby, Parker shrinks its own nine times, and Voyager is not bound at all. So the line
 * is the path itself -- the craft's path table (see paths.ts in tools), which holds a
 * subset of its JPL samples chosen so that Hermite through them stays within a fixed
 * angle of the full path as seen from the nearest body.
 *
 * Drawing it takes three things, each for a reason:
 *
 *  1. **Tessellation.** Between two samples the path is a cubic, and a chord across it
 *     sags. Each interval is cut into as many chords as bring the sag inside the
 *     interval's own tolerance, so the line's error is at most twice the path's.
 *
 *  2. **The stretch around the craft.** Everything above is held to an angle seen from
 *     a body. The camera can also stand at the craft, metres away, and from there no
 *     tolerance a file could afford is small enough. So the interval the craft is in is
 *     redrawn every frame, from the same data the craft is drawn at, with vertices
 *     crowding in on the craft geometrically: at any zoom the line runs into the marker
 *     along the direction the craft is actually moving.
 *
 *  3. **Float32 anchoring**, as for the orbits: the points are kept in float64 and the
 *     GPU buffer is rebuilt around the current focus when it drifts. See OrbitLine.
 *
 * Behind the craft the line is drawn at the orbits' strength, ahead of it fainter --
 * where it has been, and where JPL says it is going. A seam in JPL's path is a gap,
 * never a stroke: nothing flew along it.
 */

/** Opacity of the stretch already flown. The same as an orbit's. */
export const PAST_OPACITY = ORBIT_OPACITY;

/** Opacity of the stretch still ahead: there, and plainly not yet travelled. */
export const FUTURE_OPACITY = ORBIT_OPACITY * 0.35;

/**
 * Most chords one interval is cut into.
 *
 * Never reached by a path built to its own tolerance -- Parker's worst interval asks for
 * a few dozen -- so it is a guard against a malformed file, not a budget.
 */
export const MAX_CHORDS_PER_INTERVAL = 256;

/**
 * How many times the stretch around the craft is halved toward it, on each side.
 *
 * Thirty halvings take a chord from the length of its interval to a billionth of it:
 * for Voyager's twenty-year interval a few metres, for Parker at perihelion less than a
 * millimetre. Either way the last chord is far shorter than anything the camera can
 * frame, so the line meets the marker along the craft's own tangent.
 */
export const CLOSE_IN_STEPS = 30;

/**
 * How many chords interval `i` is cut into, or zero for a gap.
 *
 * A cubic Hermite segment sits off its chord, at the middle, by |v0 - v1| * h / 8 -- the
 * sag of the parabola its velocities describe. Cutting it into n equal pieces divides
 * that by n squared.
 */
export function chordsFor(path: PathTable, i: number, gaps: ReadonlySet<number>): number {
  if (gaps.has(i)) {
    return 0;
  }
  const hSeconds = (path.t[i + 1]! - path.t[i]!) * SECONDS_PER_DAY;
  const sag =
    (Math.hypot(
      path.vx[i + 1]! - path.vx[i]!,
      path.vy[i + 1]! - path.vy[i]!,
      path.vz[i + 1]! - path.vz[i]!,
    ) *
      hSeconds) /
    8;
  // The tolerance is never below the full table's own kilometre; a zero can only come
  // from a malformed file, and is read as that kilometre rather than as infinite work.
  const tolerance = Math.max(path.toleranceKm[i] ?? 0, 1);
  return Math.min(MAX_CHORDS_PER_INTERVAL, Math.max(1, Math.ceil(Math.sqrt(sag / tolerance))));
}

/**
 * The period of the orbit a craft is on right now, days, or null when it is on none.
 *
 * Two-body, from vis-viva: `mu` is what it orbits -- the Sun, or Earth for JWST -- and
 * the state is relative to it. Null for a craft leaving on a hyperbola, as the Voyagers,
 * the Pioneers and New Horizons are: they have no period, and one line is all their
 * path ever is.
 */
export function orbitalPeriodDays(state: StateVector, mu: number): number | null {
  const r = Math.hypot(state.position.x, state.position.y, state.position.z);
  const v2 =
    state.velocity.x * state.velocity.x +
    state.velocity.y * state.velocity.y +
    state.velocity.z * state.velocity.z;
  const inverseA = 2 / r - v2 / mu;
  if (!(inverseA > 0) || mu <= 0) {
    return null;
  }
  const a = 1 / inverseA;
  return (2 * Math.PI * Math.sqrt((a * a * a) / mu)) / SECONDS_PER_DAY;
}

/** The path cut into chords, in its own frame, float64. */
export interface Tessellation {
  /** Both ends of every chord, km: six numbers per chord, in time order. */
  readonly pointsKm: Float64Array;
  /** When each chord starts and ends, Julian day TDB. */
  readonly chordStartJd: Float64Array;
  readonly chordStopJd: Float64Array;
  /**
   * Index of the first chord of each interval, plus the total at the end: interval `i`
   * is chords `firstChord[i]` up to `firstChord[i + 1]`. A gap has none.
   */
  readonly firstChord: Int32Array;
}

/** Hermite position of the path at `jd`, which must be inside it. */
function pathPosition(path: PathTable, jd: number): Vec3 {
  const state = interpolateState(path, jd);
  if (state === null) {
    throw new Error(`${path.id}: JD ${jd} is outside its path.`);
  }
  return state.position;
}

export function tessellatePath(path: PathTable): Tessellation {
  const gaps = new Set(path.gaps);
  const intervals = path.count - 1;
  const firstChord = new Int32Array(intervals + 1);
  for (let i = 0; i < intervals; i += 1) {
    firstChord[i + 1] = firstChord[i]! + chordsFor(path, i, gaps);
  }

  const total = firstChord[intervals]!;
  const pointsKm = new Float64Array(total * 6);
  const chordStartJd = new Float64Array(total);
  const chordStopJd = new Float64Array(total);
  let offset = 0;
  for (let i = 0; i < intervals; i += 1) {
    const chords = firstChord[i + 1]! - firstChord[i]!;
    const width = (path.t[i + 1]! - path.t[i]!) / chords;
    let previous: Vec3 = { x: path.x[i]!, y: path.y[i]!, z: path.z[i]! };
    for (let j = 1; j <= chords; j += 1) {
      const chord = firstChord[i]! + j - 1;
      chordStartJd[chord] = path.t[i]! + (j - 1) * width;
      chordStopJd[chord] = j === chords ? path.t[i + 1]! : path.t[i]! + j * width;
      // The last vertex is the sample itself rather than an interpolation landing on it.
      const next: Vec3 =
        j === chords
          ? { x: path.x[i + 1]!, y: path.y[i + 1]!, z: path.z[i + 1]! }
          : pathPosition(path, path.t[i]! + ((path.t[i + 1]! - path.t[i]!) * j) / chords);
      pointsKm.set([previous.x, previous.y, previous.z, next.x, next.y, next.z], offset);
      offset += 6;
      previous = next;
    }
  }
  return { pointsKm, chordStartJd, chordStopJd, firstChord };
}

/** The first chord ending after `jd`, or `total` if none does. */
function firstChordEndingAfter(stops: Float64Array, jd: number): number {
  let low = 0;
  let high = stops.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (stops[mid]! > jd) {
      high = mid;
    } else {
      low = mid + 1;
    }
  }
  return low;
}

/** One past the last chord starting before `jd`. */
function endOfChordsStartingBefore(starts: Float64Array, jd: number): number {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (starts[mid]! < jd) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

/**
 * The instants the stretch around the craft is drawn at: the interval's own chord ends,
 * plus a run closing in on `jd` from both sides inside the chord that contains it.
 *
 * Sorted, starting at `start` and ending at `stop`, and containing `jd` itself, which is
 * where the line splits into what is behind the craft and what is ahead.
 */
export function closeInTimes(start: number, stop: number, chords: number, jd: number): number[] {
  const width = (stop - start) / chords;
  const chord = Math.min(chords - 1, Math.max(0, Math.floor((jd - start) / width)));
  const before = start + chord * width;
  const after = chord === chords - 1 ? stop : start + (chord + 1) * width;

  const times: number[] = [];
  for (let j = 0; j <= chord; j += 1) {
    times.push(start + j * width);
  }
  for (let k = 1; k <= CLOSE_IN_STEPS; k += 1) {
    times.push(jd - (jd - before) * 2 ** -k);
  }
  times.push(jd);
  for (let k = CLOSE_IN_STEPS; k >= 1; k -= 1) {
    times.push(jd + (after - jd) * 2 ** -k);
  }
  for (let j = chord + 1; j < chords; j += 1) {
    times.push(start + j * width);
  }
  times.push(stop);
  // Where jd sits on a chord end, the run toward it collapses onto that end. Repeated
  // instants would be zero-length chords; harmless, but not worth drawing.
  return times.filter((time, index) => index === 0 || time > times[index - 1]!);
}

/** Where a path sits at an instant, in its own frame: whatever data is best, or null. */
export type PathSampler = (jd: number) => Vec3 | null;

function lineMaterial(color: string, opacity: number): THREE.LineBasicMaterial {
  return new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
}

/** Room for one side of the stretch around the craft, in vertices. */
const CLOSE_IN_CAPACITY = MAX_CHORDS_PER_INTERVAL + CLOSE_IN_STEPS + 2;

export class TrajectoryLine {
  /** Everything this line draws; add it to the scene once. */
  readonly object = new THREE.Group();

  readonly #path: PathTable;
  readonly #tessellation: Tessellation;
  readonly #gaps: ReadonlySet<number>;
  readonly #positions: Float32Array;
  readonly #attribute: THREE.BufferAttribute;
  readonly #past: THREE.LineSegments;
  readonly #future: THREE.LineSegments;
  /** The interval the craft is in, redrawn every frame: behind it and ahead of it. */
  readonly #nearBehind: THREE.Line;
  readonly #nearAhead: THREE.Line;
  readonly #pastMaterial: THREE.LineBasicMaterial;
  readonly #futureMaterial: THREE.LineBasicMaterial;

  /** Path frame origin relative to the focus at the last rebuild, km. */
  #anchorKm: Vec3 = { x: 0, y: 0, z: 0 };
  #anchored = false;

  constructor(path: PathTable, color: string) {
    this.#path = path;
    this.#gaps = new Set(path.gaps);
    this.#tessellation = tessellatePath(path);
    this.#positions = new Float32Array(this.#tessellation.pointsKm.length);
    this.#attribute = new THREE.BufferAttribute(this.#positions, 3);

    this.#pastMaterial = lineMaterial(color, PAST_OPACITY);
    this.#futureMaterial = lineMaterial(color, FUTURE_OPACITY);

    // Two geometries over one buffer: each draws its own range of the same chords, and
    // the vertices are uploaded once.
    const segments = (material: THREE.LineBasicMaterial): THREE.LineSegments => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', this.#attribute);
      return this.#prepare(new THREE.LineSegments(geometry, material));
    };
    const strip = (material: THREE.LineBasicMaterial): THREE.Line => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(new Float32Array(CLOSE_IN_CAPACITY * 3), 3),
      );
      geometry.setDrawRange(0, 0);
      return this.#prepare(new THREE.Line(geometry, material));
    };

    this.#past = segments(this.#pastMaterial);
    this.#future = segments(this.#futureMaterial);
    this.#nearBehind = strip(this.#pastMaterial);
    this.#nearAhead = strip(this.#futureMaterial);
  }

  #prepare<T extends THREE.Line>(line: T): T {
    // The path spans the Solar System; its bounding sphere says nothing about whether
    // any of it is on screen, and recomputing it on every rebuild would be waste.
    line.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
    line.frustumCulled = false;
    this.object.add(line);
    return line;
  }

  /** Chords in the static line, for tests and for the curious. */
  get chordCount(): number {
    return this.#tessellation.firstChord.at(-1)!;
  }

  /** Scales both strengths, for a line fading in with its planet's system. */
  setFade(fade: number): void {
    this.#pastMaterial.opacity = PAST_OPACITY * fade;
    this.#futureMaterial.opacity = FUTURE_OPACITY * fade;
  }

  /**
   * Draws the line for one frame.
   *
   * `originKm` is where the path's frame sits relative to the focus: the barycentre for
   * a craft about the Sun, its planet for one like JWST. `anchorToleranceKm` is how far
   * that may drift before the float32 buffer is rebuilt. `sample` answers for the
   * stretch around the craft, and should be the very data the craft is drawn from.
   *
   * `spanDays` is how much is drawn either side of the craft: one period of the orbit it
   * is on, so Parker shows the loop it is flying rather than all twenty-four of them
   * stacked. Null draws the whole path, for a craft on no orbit at all.
   */
  update(
    jd: number,
    originKm: Vec3,
    anchorToleranceKm: number,
    sample: PathSampler,
    spanDays: number | null = null,
  ): void {
    this.#anchor(originKm, anchorToleranceKm);

    const path = this.#path;
    const { firstChord } = this.#tessellation;
    const total = firstChord.at(-1)!;
    const i = findInterval(path.t, jd);

    let behind = total;
    let ahead = total;
    if (i < 0) {
      // Before the path starts all of it is ahead; after it ends, all of it is behind.
      behind = jd < path.t[0]! ? 0 : total;
      ahead = behind;
    } else {
      behind = firstChord[i]!;
      ahead = firstChord[i + 1]!;
    }
    // The window, cut to whole chords: a chord is a few hours at worst, and a trail
    // that ends within a chord of a period from now is one period long.
    const { chordStartJd, chordStopJd } = this.#tessellation;
    const oldest = spanDays === null ? 0 : firstChordEndingAfter(chordStopJd, jd - spanDays);
    const newest =
      spanDays === null ? total : endOfChordsStartingBefore(chordStartJd, jd + spanDays);
    const pastFrom = Math.min(oldest, behind);
    const futureTo = Math.max(newest, ahead);
    this.#past.geometry.setDrawRange(pastFrom * 2, (behind - pastFrom) * 2);
    this.#future.geometry.setDrawRange(ahead * 2, (futureTo - ahead) * 2);

    if (i < 0 || this.#gaps.has(i)) {
      this.#nearBehind.geometry.setDrawRange(0, 0);
      this.#nearAhead.geometry.setDrawRange(0, 0);
      return;
    }
    this.#drawNear(i, jd, originKm, sample);
  }

  /** The interval the craft is in, from the best data there is, split at the craft. */
  #drawNear(i: number, jd: number, originKm: Vec3, sample: PathSampler): void {
    const path = this.#path;
    const chords = chordsFor(path, i, this.#gaps);
    const times = closeInTimes(path.t[i]!, path.t[i + 1]!, chords, jd);
    const split = times.indexOf(jd);

    const write = (line: THREE.Line, from: number, to: number): void => {
      const attribute = line.geometry.getAttribute('position') as THREE.BufferAttribute;
      const array = attribute.array as Float32Array;
      const count = Math.min(to - from + 1, CLOSE_IN_CAPACITY);
      for (let k = 0; k < count; k += 1) {
        const time = times[from + k]!;
        // Where the chunk is not loaded, the path table stands in: within its own
        // tolerance, and a frame or two later the chunk is here anyway.
        const point = sample(time) ?? pathPosition(path, time);
        // Summed in float64 and narrowed once; these vertices are close to the camera
        // by construction, so they are small numbers.
        array[k * 3] = (point.x + originKm.x) / KM_PER_UNIT;
        array[k * 3 + 1] = (point.y + originKm.y) / KM_PER_UNIT;
        array[k * 3 + 2] = (point.z + originKm.z) / KM_PER_UNIT;
      }
      attribute.needsUpdate = true;
      line.geometry.setDrawRange(0, count);
    };

    write(this.#nearBehind, 0, split);
    write(this.#nearAhead, split, times.length - 1);
  }

  /** Rebuilds the float32 chords around a new anchor once the old one has drifted. */
  #anchor(originKm: Vec3, toleranceKm: number): void {
    const drift = this.#anchored
      ? Math.hypot(
          originKm.x - this.#anchorKm.x,
          originKm.y - this.#anchorKm.y,
          originKm.z - this.#anchorKm.z,
        )
      : Infinity;

    if (drift > Math.max(toleranceKm, 1)) {
      const points = this.#tessellation.pointsKm;
      const positions = this.#positions;
      for (let k = 0; k < positions.length; k += 3) {
        positions[k] = (points[k]! + originKm.x) / KM_PER_UNIT;
        positions[k + 1] = (points[k + 1]! + originKm.y) / KM_PER_UNIT;
        positions[k + 2] = (points[k + 2]! + originKm.z) / KM_PER_UNIT;
      }
      this.#attribute.needsUpdate = true;
      this.#anchorKm = { x: originKm.x, y: originKm.y, z: originKm.z };
      this.#anchored = true;
    }

    // What drift remains rides on the object transform, a small number.
    const offsetX = (originKm.x - this.#anchorKm.x) / KM_PER_UNIT;
    const offsetY = (originKm.y - this.#anchorKm.y) / KM_PER_UNIT;
    const offsetZ = (originKm.z - this.#anchorKm.z) / KM_PER_UNIT;
    this.#past.position.set(offsetX, offsetY, offsetZ);
    this.#future.position.set(offsetX, offsetY, offsetZ);
  }

  dispose(): void {
    for (const line of [this.#past, this.#future, this.#nearBehind, this.#nearAhead]) {
      line.geometry.dispose();
    }
    this.#pastMaterial.dispose();
    this.#futureMaterial.dispose();
  }
}
