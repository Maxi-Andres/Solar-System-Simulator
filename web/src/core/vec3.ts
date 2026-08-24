/**
 * Minimal double-precision 3-vector.
 *
 * Deliberately not three.js's Vector3: that one is float64 in JS but exists to feed
 * float32 buffers, and everything upstream of the renderer here must stay in full
 * double precision. Positions run to 10^10 km, and float32 would quantise Pluto's
 * position to steps of about 500 km. The conversion to scene units happens once, in
 * the floating origin, after all the arithmetic is done.
 */
export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO: Vec3 = { x: 0, y: 0, z: 0 };

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale(v: Vec3, factor: number): Vec3 {
  return { x: v.x * factor, y: v.y * factor, z: v.z * factor };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/** Euclidean length. Uses Math.hypot, which avoids overflow at Solar System scale. */
export function length(v: Vec3): number {
  return Math.hypot(v.x, v.y, v.z);
}

export function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function normalize(v: Vec3): Vec3 {
  const len = length(v);
  return len === 0 ? ZERO : scale(v, 1 / len);
}

/** Position and velocity together: what an ephemeris lookup returns. */
export interface StateVector {
  /** Position in km. */
  readonly position: Vec3;
  /** Velocity in km/s. */
  readonly velocity: Vec3;
}

export const ZERO_STATE: StateVector = { position: ZERO, velocity: ZERO };

export function addStates(a: StateVector, b: StateVector): StateVector {
  return {
    position: add(a.position, b.position),
    velocity: add(a.velocity, b.velocity),
  };
}

export function subtractStates(a: StateVector, b: StateVector): StateVector {
  return {
    position: subtract(a.position, b.position),
    velocity: subtract(a.velocity, b.velocity),
  };
}
