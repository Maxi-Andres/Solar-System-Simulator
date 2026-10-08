import type { PathTable, Seam, VectorTable } from '@sss/tools/types';
import * as THREE from 'three';

import { findInterval, interpolateState } from '../core/hermite.ts';
import { SECONDS_PER_DAY } from '../core/time.ts';
import type { StateVector, Vec3 } from '../core/vec3.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { KM_PER_UNIT } from './scale.ts';

/**
 * A spacecraft's trail: the way it came, drawn from JPL's samples rather than a conic.
 *
 * A craft is not on an ellipse for long enough to draw one: Juice changes orbit at every
 * flyby, Parker shrinks its own nine times, and Voyager is not bound at all. So the line
 * is the path itself -- the craft's path table (see paths.ts in tools), which holds a
 * subset of its JPL samples chosen so that Hermite through them stays within a fixed
 * angle of the full path as seen from the nearest body.
 *
 * It is a trail and not an orbit, the way NASA Eyes draws one: only where the craft has
 * been, one period of its current orbit back, fading with age -- full strength at the
 * craft, nothing a period ago. That is what makes one side of Parker's loop bright and
 * the other faint: the bright side is the stretch it has just flown.
 *
 * Drawing it takes three things, each for a reason:
 *
 *  1. **Tessellation.** Between two samples the path is a cubic, and a chord across it
 *     sags. Each interval is cut into as many chords as bring the sag inside the
 *     interval's own tolerance, so the line's error is at most twice the path's.
 *
 *  2. **The stretch at the craft.** Everything above is held to an angle seen from a
 *     body. The camera can also stand at the craft, metres away, and from there no
 *     tolerance a file could afford is small enough. So the interval the craft is in is
 *     redrawn every frame, from the same data the craft is drawn at, with vertices
 *     crowding in on the craft geometrically: at any zoom the line runs into the marker
 *     along the direction the craft is actually moving.
 *
 *  3. **Float32 anchoring**, as for the orbits: the points are kept in float64 and the
 *     GPU buffer is rebuilt around the current focus when it drifts. See OrbitLine.
 *
 * A seam in JPL's path is a gap, never a stroke: nothing flew along it.
 */

/**
 * Every craft's trail is white, as NASA Eyes draws them: the planets and moons keep their
 * colours on their orbits, and a white line reads as "a path something flew" rather than
 * one more orbit in the palette.
 */
export const TRAIL_COLOR = '#ffffff';

/** Opacity of the trail at the craft. The same as an orbit's; it fades from there. */
export const TRAIL_OPACITY = ORBIT_OPACITY;


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

/**
 * The trail's shader: a plain line whose alpha falls linearly with age.
 *
 * Each vertex carries its instant as days since the path began, in float32 -- 40 seconds
 * of resolution across eleven years, which a fade spread over months cannot show. The
 * log-depth chunks are not optional: the scene's depth buffer is logarithmic, and a line
 * without them would be sorted against the planets by the wrong depth.
 */
const TRAIL_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  attribute float aDays;
  varying float vDays;

  void main() {
    vDays = aDays;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const TRAIL_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uNowDays;
  uniform float uSpanDays;
  varying float vDays;

  void main() {
    #include <logdepthbuf_fragment>
    // trailFade(), below, is this line in TypeScript.
    float fade = clamp(1.0 - (uNowDays - vDays) / uSpanDays, 0.0, 1.0);
    gl_FragColor = vec4(uColor, uOpacity * fade);
  }
`;

/** How bright the trail is `ageDays` behind the craft, out of one: the shader's rule. */
export function trailFade(ageDays: number, spanDays: number): number {
  return Math.min(1, Math.max(0, 1 - ageDays / spanDays));
}

function trailMaterial(color: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: TRAIL_VERTEX_SHADER,
    fragmentShader: TRAIL_FRAGMENT_SHADER,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: TRAIL_OPACITY },
      uNowDays: { value: 0 },
      uSpanDays: { value: 1 },
    },
    transparent: true,
    depthWrite: false,
  });
}

/** Room for the stretch at the craft, in vertices. */
const CLOSE_IN_CAPACITY = MAX_CHORDS_PER_INTERVAL + CLOSE_IN_STEPS + 2;

export class TrajectoryLine {
  /** Everything this line draws; add it to the scene once. */
  readonly object = new THREE.Group();

  readonly #path: PathTable;
  readonly #tessellation: Tessellation;
  readonly #gaps: ReadonlySet<number>;
  readonly #positions: Float32Array;
  readonly #attribute: THREE.BufferAttribute;
  /** The trail's chords, drawn up to the interval the craft is in. */
  readonly #trail: THREE.LineSegments;
  /** That interval, from its start to the craft, redrawn every frame. */
  readonly #near: THREE.Line;
  readonly #material: THREE.ShaderMaterial;

  /** Path frame origin relative to the focus at the last rebuild, km. */
  #anchorKm: Vec3 = { x: 0, y: 0, z: 0 };
  #anchored = false;

  constructor(path: PathTable, color: string) {
    this.#path = path;
    this.#gaps = new Set(path.gaps);
    this.#tessellation = tessellatePath(path);
    this.#positions = new Float32Array(this.#tessellation.pointsKm.length);
    this.#attribute = new THREE.BufferAttribute(this.#positions, 3);
    this.#material = trailMaterial(color);

    // Each chord's two ends, as days since the path began: what the fade is read from.
    const { chordStartJd, chordStopJd } = this.#tessellation;
    const days = new Float32Array(chordStartJd.length * 2);
    for (let chord = 0; chord < chordStartJd.length; chord += 1) {
      days[chord * 2] = chordStartJd[chord]! - path.t[0]!;
      days[chord * 2 + 1] = chordStopJd[chord]! - path.t[0]!;
    }
    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', this.#attribute);
    trailGeometry.setAttribute('aDays', new THREE.BufferAttribute(days, 1));
    this.#trail = this.#prepare(new THREE.LineSegments(trailGeometry, this.#material));

    const nearGeometry = new THREE.BufferGeometry();
    nearGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(CLOSE_IN_CAPACITY * 3), 3),
    );
    nearGeometry.setAttribute(
      'aDays',
      new THREE.BufferAttribute(new Float32Array(CLOSE_IN_CAPACITY), 1),
    );
    nearGeometry.setDrawRange(0, 0);
    this.#near = this.#prepare(new THREE.Line(nearGeometry, this.#material));
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

  /** The material, for tests: the fade lives in its uniforms. */
  get material(): THREE.ShaderMaterial {
    return this.#material;
  }

  /** Scales the trail's strength, for one fading in with its planet's system. */
  setFade(fade: number): void {
    this.#material.uniforms.uOpacity!.value = TRAIL_OPACITY * fade;
  }

  /**
   * Draws the trail for one frame.
   *
   * `originKm` is where the path's frame sits relative to the focus: the barycentre for
   * a craft about the Sun, its planet for one like JWST. `anchorToleranceKm` is how far
   * that may drift before the float32 buffer is rebuilt. `sample` answers for the
   * stretch at the craft, and should be the very data the craft is drawn from.
   *
   * `spanDays` is how far back the trail reaches: one period of the orbit the craft is on,
   * so Parker shows the loop it has just flown rather than all twenty-four stacked. Null
   * for a craft on no orbit at all, whose trail reaches back to where its path starts.
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
    const { firstChord, chordStopJd } = this.#tessellation;
    const total = firstChord.at(-1)!;
    const i = findInterval(path.t, jd);
    const start = path.t[0]!;
    const span = spanDays ?? Math.max(jd - start, 1e-9);

    this.#material.uniforms.uNowDays!.value = jd - start;
    this.#material.uniforms.uSpanDays!.value = span;

    // Up to the interval the craft is in; all of it once the path has ended, none of it
    // before it starts.
    const behind = i >= 0 ? firstChord[i]! : jd < start ? 0 : total;
    const oldest = Math.min(firstChordEndingAfter(chordStopJd, jd - span), behind);
    this.#trail.geometry.setDrawRange(oldest * 2, (behind - oldest) * 2);

    if (i < 0 || this.#gaps.has(i)) {
      this.#near.geometry.setDrawRange(0, 0);
      return;
    }
    this.#drawNear(i, jd, originKm, sample);
  }

  /** The interval the craft is in, from its start to the craft, from the best data. */
  #drawNear(i: number, jd: number, originKm: Vec3, sample: PathSampler): void {
    const path = this.#path;
    const chords = chordsFor(path, i, this.#gaps);
    const times = closeInTimes(path.t[i]!, path.t[i + 1]!, chords, jd);
    const count = Math.min(times.indexOf(jd) + 1, CLOSE_IN_CAPACITY);

    const positions = this.#near.geometry.getAttribute('position') as THREE.BufferAttribute;
    const days = this.#near.geometry.getAttribute('aDays') as THREE.BufferAttribute;
    const xyz = positions.array as Float32Array;
    const age = days.array as Float32Array;
    for (let k = 0; k < count; k += 1) {
      const time = times[k]!;
      // Where the chunk is not loaded, the path table stands in: within its own
      // tolerance, and a frame or two later the chunk is here anyway.
      const point = sample(time) ?? pathPosition(path, time);
      // Summed in float64 and narrowed once; these vertices are close to the camera
      // by construction, so they are small numbers.
      xyz[k * 3] = (point.x + originKm.x) / KM_PER_UNIT;
      xyz[k * 3 + 1] = (point.y + originKm.y) / KM_PER_UNIT;
      xyz[k * 3 + 2] = (point.z + originKm.z) / KM_PER_UNIT;
      age[k] = time - path.t[0]!;
    }
    positions.needsUpdate = true;
    days.needsUpdate = true;
    this.#near.geometry.setDrawRange(0, count);
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
    this.#trail.position.set(
      (originKm.x - this.#anchorKm.x) / KM_PER_UNIT,
      (originKm.y - this.#anchorKm.y) / KM_PER_UNIT,
      (originKm.z - this.#anchorKm.z) / KM_PER_UNIT,
    );
  }

  dispose(): void {
    this.#trail.geometry.dispose();
    this.#near.geometry.dispose();
    this.#material.dispose();
  }
}

/** Two instants this close, days, are the same sample: the files round time to 1e-8. */
const SAME_INSTANT_DAYS = 1e-7;

/**
 * A stretch of a craft's own table as a path: every sample kept, each interval held to
 * `toleranceKm`, and an interval that spans one of `seams` a gap.
 */
export function tablePath(
  table: VectorTable,
  seams: readonly Seam[],
  toleranceKm: number,
): PathTable {
  const gaps: number[] = [];
  for (let i = 0; i + 1 < table.count; i += 1) {
    const start = table.t[i]!;
    const stop = table.t[i + 1]!;
    if (
      seams.some(
        (seam) =>
          seam.startJd >= start - SAME_INSTANT_DAYS && seam.stopJd <= stop + SAME_INSTANT_DAYS,
      )
    ) {
      gaps.push(i);
    }
  }
  return {
    ...table,
    toleranceKm: new Array<number>(Math.max(table.count - 1, 0)).fill(toleranceKm),
    gaps,
  };
}

/** Fetches the path for a stretch of time, or null while the data for it is not here. */
export type PathSource = (startJd: number, stopJd: number) => PathTable | null;

/**
 * How much more than the trail a table trail is built for, as a fraction of its span,
 * ahead and behind. The line is rebuilt once the clock carries the trail out of it: at
 * a quarter, every quarter of an orbit -- every 28 minutes for MRO at normal speed.
 */
export const TABLE_TRAIL_MARGIN = 0.25;

/** Span of a table trail with no orbit to measure one from, days. */
export const TABLE_TRAIL_FALLBACK_DAYS = 1;

/**
 * A trail drawn from the craft's own table, for a close orbiter with no path file.
 *
 * The same line as TrajectoryLine, built only over the stretch the trail covers -- one
 * turn, plus a margin -- and rebuilt as the clock moves on. See PathInfo.count in tools
 * for why: two hours of MRO's trail do not need six months of its orbits.
 */
export class TableTrail {
  readonly object = new THREE.Group();

  readonly #source: PathSource;
  readonly #color: string;
  #line: TrajectoryLine | null = null;
  #builtStart = Infinity;
  #builtStop = -Infinity;
  #fade = 1;

  constructor(source: PathSource, color: string) {
    this.#source = source;
    this.#color = color;
  }

  /** The stretch the current line was built for, days; empty before the first. */
  get built(): { readonly startJd: number; readonly stopJd: number } {
    return { startJd: this.#builtStart, stopJd: this.#builtStop };
  }

  setFade(fade: number): void {
    this.#fade = fade;
    this.#line?.setFade(fade);
  }

  update(
    jd: number,
    originKm: Vec3,
    anchorToleranceKm: number,
    sample: PathSampler,
    spanDays: number | null = null,
  ): void {
    const span = spanDays ?? TABLE_TRAIL_FALLBACK_DAYS;
    if (jd - span < this.#builtStart || jd > this.#builtStop) {
      const startJd = jd - span * (1 + TABLE_TRAIL_MARGIN);
      const stopJd = jd + span * TABLE_TRAIL_MARGIN;
      const path = this.#source(startJd, stopJd);
      if (path === null || path.count < 2) {
        // Not here yet: nothing rather than a trail of somewhere else.
        this.object.visible = false;
        return;
      }
      this.#line?.dispose();
      if (this.#line !== null) {
        this.object.remove(this.#line.object);
      }
      this.#line = new TrajectoryLine(path, this.#color);
      this.#line.setFade(this.#fade);
      this.object.add(this.#line.object);
      this.#builtStart = startJd;
      this.#builtStop = stopJd;
    }
    this.object.visible = true;
    this.#line!.update(jd, originKm, anchorToleranceKm, sample, spanDays ?? span);
  }

  dispose(): void {
    this.#line?.dispose();
  }
}
