import { dustColumn } from './nuclearCluster.ts';
import { PARSEC_KM } from './stars3d.ts';

/**
 * The dust in front of each globular cluster from the camera (GlobularClusters.tsx): A_V from
 * the Sun (Harris) times the share of the Sun's dust column to the cluster that lies between the
 * camera and it, in the galaxy model's dust disc (nuclearCluster.ts dustColumn).
 *
 * Two 400-step integrals a cluster, for 160 clusters, every time the camera has moved far
 * enough to change them -- every frame while it is moved about the galaxy, twelve milliseconds
 * of each. So:
 *
 * - **The Sun's column is kept** (`SunColumns`): it changes only as the cluster moves, a
 *   millionth of its distance in decades of simulated time at the fastest.
 * - **The camera's is worked out in a worker** (globularClusterDust.worker.ts), the answer
 *   taken when it comes, a frame or so after it was asked: the points' dimming lags the camera
 *   by that, as it already lagged it by up to POINT_DUST_REFRESH_SHARE of its distance to the
 *   nearest cluster. The first answer, and every answer where there is no worker, is worked
 *   out at once (`ClusterDust`).
 */

/** The scene's axes in the Galactic frame: each Galactic axis as a vector of the scene's (scene/galactic.ts GALACTIC_BASIS). */
export interface DustBasis {
  readonly x: { readonly x: number; readonly y: number; readonly z: number };
  readonly y: { readonly x: number; readonly y: number; readonly z: number };
  readonly z: { readonly x: number; readonly y: number; readonly z: number };
}

/** The clusters as the dust is worked out for them: plain arrays, so they can go to a worker. */
export interface ClusterDustCatalog {
  readonly count: number;
  /** Each centre, scene frame, pc about the Sun at J2000.0, and its velocity, km/s (globularClusters.ts). */
  readonly x: readonly number[];
  readonly y: readonly number[];
  readonly z: readonly number[];
  readonly vx: readonly number[];
  readonly vy: readonly number[];
  readonly vz: readonly number[];
  /** A_V from the Sun, magnitudes; NaN where Harris gives no reddening (globularClusters.ts clusterExtinctionV). */
  readonly extinctionV: readonly number[];
  readonly basis: DustBasis;
}

/**
 * A cluster's centre, Galactic frame, pc about the Sun, `motion` (km/s to pc: years times
 * KM_S_TO_PC_PER_YEAR) after J2000.0 -- as scene/NuclearCluster.tsx sceneToGalacticPc turns its
 * place in km, operation for operation, so the numbers are the same.
 */
export function clusterCentreGalactic(c: ClusterDustCatalog, k: number, motion: number): [number, number, number] {
  const vx = (c.x[k]! + c.vx[k]! * motion) * PARSEC_KM;
  const vy = (c.y[k]! + c.vy[k]! * motion) * PARSEC_KM;
  const vz = (c.z[k]! + c.vz[k]! * motion) * PARSEC_KM;
  const { x: bx, y: by, z: bz } = c.basis;
  return [
    (bx.x * vx + bx.y * vy + bx.z * vz) / PARSEC_KM,
    (by.x * vx + by.y * vy + by.z * vz) / PARSEC_KM,
    (bz.x * vx + bz.y * vy + bz.z * vz) / PARSEC_KM,
  ];
}

/**
 * The Sun's column to a cluster is worked out again once the cluster has moved this share of
 * its distance since: the column changes by about as much, a millionth, far below a magnitude's
 * thousandth.
 */
export const SUN_COLUMN_REFRESH_SHARE = 1e-6;

/** The Sun's dust column to each cluster (dustColumn from the origin), kept while the cluster stays put. */
export class SunColumns {
  private readonly value: Float64Array;
  private readonly at: Float64Array;

  constructor(count: number) {
    this.value = new Float64Array(count).fill(Number.NaN);
    this.at = new Float64Array(count * 3).fill(Number.NaN);
  }

  /** Cluster k's, its centre at `centre` (Galactic, pc). */
  column(k: number, centre: readonly [number, number, number]): number {
    const at = this.at;
    const dx = centre[0] - at[k * 3]!;
    const dy = centre[1] - at[k * 3 + 1]!;
    const dz = centre[2] - at[k * 3 + 2]!;
    const moved = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const distance = Math.sqrt(centre[0] * centre[0] + centre[1] * centre[1] + centre[2] * centre[2]);
    // Never worked out (NaN), or moved enough.
    if (!(moved <= SUN_COLUMN_REFRESH_SHARE * distance)) {
      this.value[k] = dustColumn([0, 0, 0], centre);
      at[k * 3] = centre[0];
      at[k * 3 + 1] = centre[1];
      at[k * 3 + 2] = centre[2];
    }
    return this.value[k]!;
  }
}

/**
 * Every cluster's A_V from the camera (Galactic frame, pc about the Sun), `motion` after
 * J2000.0, into `out`: 0 where Harris gives none, or none above 0.
 */
export function clusterExtinctions(
  c: ClusterDustCatalog,
  sun: SunColumns,
  camera: readonly [number, number, number],
  motion: number,
  out: Float64Array,
): Float64Array {
  for (let k = 0; k < c.count; k += 1) {
    const fromSun = c.extinctionV[k]!;
    let value = 0;
    if (fromSun > 0) {
      const centre = clusterCentreGalactic(c, k, motion);
      const share = dustColumn(camera, centre) / Math.max(sun.column(k, centre), 1e-30);
      value = fromSun * Math.min(1, share);
    }
    out[k] = value;
  }
  return out;
}

/** What the worker is sent: the catalogue once, then a camera at a time. */
export type ClusterDustRequest =
  | { readonly type: 'catalog'; readonly catalog: ClusterDustCatalog }
  | { readonly type: 'dust'; readonly id: number; readonly camera: readonly [number, number, number]; readonly motion: number };

/** And answers: each cluster's A_V, the array transferred. */
export interface ClusterDustAnswer {
  readonly id: number;
  readonly extinction: Float64Array;
}

/** The worker as the client sees it (a Worker, or a stand-in in the tests). */
export interface DustPort {
  onmessage: ((event: MessageEvent<ClusterDustAnswer>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  postMessage(message: ClusterDustRequest): void;
  terminate(): void;
}

/**
 * The dust for one catalogue: worked out at once (`now`), or asked of a worker and taken when
 * it answers (`ask`). One question at a time: asked while one is out, `ask` says no. With no
 * worker (`attach`), or once it fails, every question is answered at once.
 */
export class ClusterDust {
  readonly catalog: ClusterDustCatalog;
  private readonly sun: SunColumns;
  private port: DustPort | null = null;
  private waiting: { id: number; answer: (extinction: Float64Array) => void; camera: readonly [number, number, number]; motion: number } | null =
    null;
  private nextId = 1;

  constructor(catalog: ClusterDustCatalog) {
    this.catalog = catalog;
    this.sun = new SunColumns(catalog.count);
  }

  /** Asks the questions of `port` from now on, until `detach`. */
  attach(port: DustPort): void {
    this.detach();
    this.port = port;
    port.onmessage = (event) => {
      const waiting = this.waiting;
      if (this.port !== port || waiting === null || event.data.id !== waiting.id) return;
      this.waiting = null;
      waiting.answer(event.data.extinction);
    };
    port.onerror = (event) => {
      if (this.port !== port) return;
      console.error('The globular clusters’ dust worker failed; working the dust out here', event);
      this.fail();
    };
    port.postMessage({ type: 'catalog', catalog: this.catalog });
  }

  /** Whether a question is out. */
  get busy(): boolean {
    return this.waiting !== null;
  }

  /** Every cluster's A_V from `camera`, here and now. */
  now(camera: readonly [number, number, number], motion: number): Float64Array {
    return clusterExtinctions(this.catalog, this.sun, camera, motion, new Float64Array(this.catalog.count));
  }

  /**
   * Cluster k's A_V from `camera`, here and now, for the cluster whose stars are drawn: 0 where
   * Harris gives none, or 0.
   */
  one(k: number, camera: readonly [number, number, number], motion: number): number {
    const fromSun = this.catalog.extinctionV[k]!;
    if (Number.isNaN(fromSun) || fromSun === 0) return 0;
    const centre = clusterCentreGalactic(this.catalog, k, motion);
    const share = dustColumn(camera, centre) / Math.max(this.sun.column(k, centre), 1e-30);
    return fromSun * Math.min(1, share);
  }

  /**
   * Asks for every cluster's A_V from `camera`; `answer` is called with it when it comes -- at
   * once where there is no worker. False, and nothing asked, while a question is out.
   */
  ask(camera: readonly [number, number, number], motion: number, answer: (extinction: Float64Array) => void): boolean {
    if (this.waiting !== null) return false;
    if (this.port === null) {
      answer(this.now(camera, motion));
      return true;
    }
    const id = this.nextId++;
    this.waiting = { id, answer, camera, motion };
    this.port.postMessage({ type: 'dust', id, camera, motion });
    return true;
  }

  /** Stops the worker; a question out is not answered, and the next is answered here until another is attached. */
  detach(): void {
    this.port?.terminate();
    this.port = null;
    this.waiting = null;
  }

  private fail(): void {
    this.port?.terminate();
    this.port = null;
    const waiting = this.waiting;
    this.waiting = null;
    if (waiting !== null) waiting.answer(this.now(waiting.camera, waiting.motion));
  }
}

/** The worker's side: the catalogue kept, each camera answered (globularClusterDust.worker.ts). */
export function clusterDustResponder(): (request: ClusterDustRequest) => ClusterDustAnswer | null {
  let catalog: ClusterDustCatalog | null = null;
  let sun: SunColumns | null = null;
  return (request) => {
    if (request.type === 'catalog') {
      catalog = request.catalog;
      sun = new SunColumns(catalog.count);
      return null;
    }
    if (catalog === null || sun === null) {
      throw new Error('The globular clusters’ dust worker was asked before it had the catalogue.');
    }
    return {
      id: request.id,
      extinction: clusterExtinctions(catalog, sun, request.camera, request.motion, new Float64Array(catalog.count)),
    };
  };
}
