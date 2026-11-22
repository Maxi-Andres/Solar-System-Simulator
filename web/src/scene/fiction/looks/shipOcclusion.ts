/**
 * How much of the sky each point of a ship sees, worked out once when the ship is built: the
 * ambient occlusion that darkens the gaps between the Hail Mary's tanks, the skirt under the
 * faring, the roots of the radiators -- what makes a model read as solid rather than lit evenly
 * from everywhere.
 *
 * Rays are cast from each vertex over its hemisphere, cosine-weighted, against a handful of
 * simple shapes standing in for the ship's large parts (cylinders and cones along its axis,
 * thin boxes for the radiators): exact for those, and the small parts -- which these shapes
 * leave out -- carry a fixed `cavity` in their finish instead. A ray that meets one counts as
 * shadow, less the farther it went: occlusion is local, and a tank six metres away hides less
 * of the sky than one beside it. Vertices shared by several triangles are cast once.
 */

/** A cylinder along z about (cx, cy). */
export interface ZCylinder {
  readonly kind: 'cylinder';
  readonly cx: number;
  readonly cy: number;
  readonly r: number;
  readonly z0: number;
  readonly z1: number;
}

/** A cone (frustum) along the z axis, radius r0 at z0 to r1 at z1. */
export interface ZCone {
  readonly kind: 'cone';
  readonly r0: number;
  readonly r1: number;
  readonly z0: number;
  readonly z1: number;
}

/** A box: centre, three unit axes and half sizes along them. */
export interface Box {
  readonly kind: 'box';
  readonly centre: readonly [number, number, number];
  readonly axes: readonly (readonly [number, number, number])[];
  readonly half: readonly [number, number, number];
}

export type Occluder = ZCylinder | ZCone | Box;

/** How far a ray counts, metres: past it the sky is open. */
const REACH_M = 7;

/** Rays per vertex. */
const RAYS = 12;

/** Cosine-weighted hemisphere directions about +z, fixed, so the result is the same each build. */
const HEMISPHERE: readonly [number, number, number][] = Array.from({ length: RAYS }, (_, i) => {
  // A Fibonacci spiral over the disc, lifted onto the hemisphere: even and deterministic.
  const radius = Math.sqrt((i + 0.5) / RAYS);
  const angle = i * 2.399963229728653;
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  return [x, y, Math.sqrt(Math.max(0, 1 - x * x - y * y))];
});

function hitCylinder(o: number[], d: number[], c: ZCylinder): number {
  let best = Infinity;
  const ox = o[0]! - c.cx;
  const oy = o[1]! - c.cy;
  const a = d[0]! * d[0]! + d[1]! * d[1]!;
  if (a > 1e-12) {
    const b = ox * d[0]! + oy * d[1]!;
    const k = ox * ox + oy * oy - c.r * c.r;
    const disc = b * b - a * k;
    if (disc >= 0) {
      const root = Math.sqrt(disc);
      for (const t of [(-b - root) / a, (-b + root) / a]) {
        if (t > 1e-3 && t < best) {
          const z = o[2]! + t * d[2]!;
          if (z >= c.z0 && z <= c.z1) best = t;
        }
      }
    }
  }
  if (Math.abs(d[2]!) > 1e-9) {
    for (const zc of [c.z0, c.z1]) {
      const t = (zc - o[2]!) / d[2]!;
      if (t > 1e-3 && t < best) {
        const x = ox + t * d[0]!;
        const y = oy + t * d[1]!;
        if (x * x + y * y <= c.r * c.r) best = t;
      }
    }
  }
  return best;
}

function hitCone(o: number[], d: number[], c: ZCone): number {
  const slope = (c.r1 - c.r0) / (c.z1 - c.z0);
  const base = c.r0 - slope * c.z0;
  // x^2 + y^2 = (base + slope z)^2 along the ray.
  const rz = base + slope * o[2]!;
  const a = d[0]! * d[0]! + d[1]! * d[1]! - slope * slope * d[2]! * d[2]!;
  const b = o[0]! * d[0]! + o[1]! * d[1]! - rz * slope * d[2]!;
  const k = o[0]! * o[0]! + o[1]! * o[1]! - rz * rz;
  let best = Infinity;
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) {
      const t = -k / (2 * b);
      const z = o[2]! + t * d[2]!;
      if (t > 1e-3 && z >= c.z0 && z <= c.z1) best = t;
    }
    return best;
  }
  const disc = b * b - a * k;
  if (disc < 0) return best;
  const root = Math.sqrt(disc);
  for (const t of [(-b - root) / a, (-b + root) / a]) {
    if (t > 1e-3 && t < best) {
      const z = o[2]! + t * d[2]!;
      if (z >= c.z0 && z <= c.z1 && base + slope * z >= 0) best = t;
    }
  }
  return best;
}

function hitBox(o: number[], d: number[], box: Box): number {
  let near = -Infinity;
  let far = Infinity;
  for (let axis = 0; axis < 3; axis += 1) {
    const u = box.axes[axis]!;
    const offset = (o[0]! - box.centre[0]) * u[0] + (o[1]! - box.centre[1]) * u[1] + (o[2]! - box.centre[2]) * u[2];
    const speed = d[0]! * u[0] + d[1]! * u[1] + d[2]! * u[2];
    const half = box.half[axis]!;
    if (Math.abs(speed) < 1e-12) {
      if (Math.abs(offset) > half) return Infinity;
      continue;
    }
    let t0 = (-half - offset) / speed;
    let t1 = (half - offset) / speed;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0);
    far = Math.min(far, t1);
    if (near > far) return Infinity;
  }
  return near > 1e-3 ? near : Infinity;
}

/** A bounding sphere per occluder, so a point skips those out of reach. */
function bounds(occluder: Occluder): [number, number, number, number] {
  if (occluder.kind === 'cylinder') {
    const half = (occluder.z1 - occluder.z0) / 2;
    return [occluder.cx, occluder.cy, occluder.z0 + half, Math.hypot(occluder.r, half)];
  }
  if (occluder.kind === 'cone') {
    const half = (occluder.z1 - occluder.z0) / 2;
    return [0, 0, occluder.z0 + half, Math.hypot(Math.max(occluder.r0, occluder.r1), half)];
  }
  return [...occluder.centre, Math.hypot(...occluder.half)] as [number, number, number, number];
}

function nearest(o: number[], d: number[], occluders: readonly Occluder[]): number {
  let best = Infinity;
  for (const occluder of occluders) {
    const t =
      occluder.kind === 'cylinder' ? hitCylinder(o, d, occluder) : occluder.kind === 'cone' ? hitCone(o, d, occluder) : hitBox(o, d, occluder);
    if (t < best) best = t;
  }
  return best;
}

/** Sky visibility, 0 to 1, of a point with a unit normal. */
export function skyVisibility(point: readonly number[], normal: readonly number[], occluders: readonly Occluder[]): number {
  const n = normal;
  // A tangent frame about the normal.
  const helper = Math.abs(n[2]!) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const tx = [helper[1]! * n[2]! - helper[2]! * n[1]!, helper[2]! * n[0]! - helper[0]! * n[2]!, helper[0]! * n[1]! - helper[1]! * n[0]!];
  const tl = Math.hypot(tx[0]!, tx[1]!, tx[2]!);
  const t = tx.map((value) => value / tl);
  const b = [n[1]! * t[2]! - n[2]! * t[1]!, n[2]! * t[0]! - n[0]! * t[2]!, n[0]! * t[1]! - n[1]! * t[0]!];
  const origin = [point[0]! + n[0]! * 0.02, point[1]! + n[1]! * 0.02, point[2]! + n[2]! * 0.02];
  let blocked = 0;
  const direction = [0, 0, 0];
  for (const [x, y, z] of HEMISPHERE) {
    direction[0] = t[0]! * x + b[0]! * y + n[0]! * z;
    direction[1] = t[1]! * x + b[1]! * y + n[1]! * z;
    direction[2] = t[2]! * x + b[2]! * y + n[2]! * z;
    const hit = nearest(origin, direction, occluders);
    if (hit < REACH_M) blocked += 1 - (hit / REACH_M) ** 2;
  }
  return 1 - blocked / RAYS;
}

/**
 * The sky visibility of every vertex in `ranges`, shared vertices cast once, worked out a slice
 * at a time: `step(budgetMs)` does what fits in the budget and says whether it is done. A ship's
 * worth is a few hundred milliseconds of casting, too long to hold the page for in one go, so the
 * ship is drawn first, evenly lit, and its occlusion fills in over the next idle moments.
 */
export class OcclusionJob {
  readonly #cache = new Map<string, number>();
  readonly #spheres: [number, number, number, number][];
  readonly #near: Occluder[] = [];
  readonly #vertices: number[] = [];
  #next = 0;

  constructor(
    private readonly positions: ArrayLike<number>,
    private readonly normals: ArrayLike<number>,
    ranges: readonly (readonly [number, number])[],
    private readonly occluders: readonly Occluder[],
    private readonly set: (vertex: number, value: number) => void,
  ) {
    this.#spheres = occluders.map(bounds);
    for (const [start, end] of ranges) for (let i = start; i < end; i += 1) this.#vertices.push(i);
  }

  get done(): boolean {
    return this.#next >= this.#vertices.length;
  }

  step(budgetMs = Infinity): boolean {
    const until = performance.now() + budgetMs;
    const positions = this.positions;
    const normals = this.normals;
    const near = this.#near;
    while (this.#next < this.#vertices.length) {
      if ((this.#next & 63) === 63 && performance.now() > until) return false;
      const i = this.#vertices[this.#next]!;
      this.#next += 1;
      {
        const p = [positions[i * 3]!, positions[i * 3 + 1]!, positions[i * 3 + 2]!];
        const n = [normals[i * 3]!, normals[i * 3 + 1]!, normals[i * 3 + 2]!];
        const key = `${Math.round(p[0]! * 200)},${Math.round(p[1]! * 200)},${Math.round(p[2]! * 200)},${Math.round(n[0]! * 20)},${Math.round(n[1]! * 20)},${Math.round(n[2]! * 20)}`;
        let value = this.#cache.get(key);
        if (value === undefined) {
          // Only the occluders a ray could reach from here.
          near.length = 0;
          for (let k = 0; k < this.occluders.length; k += 1) {
            const s = this.#spheres[k]!;
            if (Math.hypot(p[0]! - s[0], p[1]! - s[1], p[2]! - s[2]) - s[3] < REACH_M) near.push(this.occluders[k]!);
          }
          value = skyVisibility(p, n, near);
          this.#cache.set(key, value);
        }
        this.set(i, value);
      }
    }
    return true;
  }
}
