import type {
  BodyDefinition,
  BodyId,
  Manifest,
  OsculatingElements,
  PathInfo,
  PathTable,
  VectorTable,
} from '@sss/tools/types';

import { ChunkedTable, type ChunkLoader, RETRY_AFTER_MS, samplesBetween } from './chunkedTable.ts';
import { FrameTree } from './frames.ts';
import { interpolateState } from './hermite.ts';
import { propagate } from './kepler.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Loads the generated ephemerides and answers "where is this body at this instant".
 *
 * Two sources, in priority order:
 *  1. The state vector tables, interpolated with cubic Hermite. Exact DE441 values,
 *     accurate to metres for Earth. This covers the generated window.
 *  2. Keplerian propagation from the osculating elements, for anything outside it.
 *     Approximate, and flagged as such so the UI can say so rather than quietly
 *     showing a planet in the wrong place.
 *
 * The tables come two ways. A planet's is one file, loaded at startup. A fast moon's is
 * split into chunks fetched as the clock reaches them -- see chunkedTable.ts -- and
 * while one is on its way the moon has no state at all, which is different from having
 * an approximate one.
 */

/**
 * Speed of light in vacuum, km/s. Exact by definition since the 1983 redefinition
 * of the metre, so this is not a measurement with an uncertainty.
 */
export const SPEED_OF_LIGHT_KM_S = 299_792.458;

/**
 * Where a distance is measured from.
 *
 * Centre-to-centre is what the ephemerides give directly. Surface-to-surface is what
 * NASA Eyes shows by default, and the two differ by more than they sound: the Sun's
 * radius alone is 695,700 km, which turns a 151.2 million km Sun-Earth distance into
 * 150.5 million and shifts the light time from 8 min 24 s to 8 min 22 s. Neither is
 * more correct; saying which one is on screen is what matters.
 */
export type DistanceMode = 'center' | 'surface';

/** A resolved state, plus whether it came from real data or the fallback. */
export interface BodyState extends StateVector {
  /** True when this came from Keplerian propagation instead of the vector tables. */
  readonly approximate: boolean;
}

export interface EphemerisData {
  readonly manifest: Manifest;
  readonly bodies: readonly BodyDefinition[];
  /** The tables shipped whole, loaded up front. */
  readonly vectors: ReadonlyMap<BodyId, VectorTable>;
  readonly elements: ReadonlyMap<BodyId, OsculatingElements>;
  /** Fetches one chunk of a chunked table, or null where nothing may be fetched. */
  readonly loadChunk: ChunkLoader | null;
  /** Fetches a spacecraft's trajectory, or null where nothing may be fetched. */
  readonly loadPath: PathLoader | null;
}

/** Fetches the drawable trajectory of a spacecraft. */
export type PathLoader = (id: BodyId) => Promise<PathTable>;

/** Fetch-like function, injected so the store is testable without a browser. */
export type Fetcher = (path: string) => Promise<unknown>;

/**
 * Reads the data directory.
 *
 * `basePath` must end in a slash. In the app it is `import.meta.env.BASE_URL`, which
 * carries the GitHub Pages prefix; hardcoding '/' would 404 on the published site.
 */
export async function loadEphemerisData(
  fetcher: Fetcher,
  basePath = '/',
): Promise<EphemerisData> {
  const published = (await fetcher(`${basePath}data/manifest.json`)) as Manifest;
  // Data generated before the trajectories has no paths. Everything else in it is still
  // good, so it is used, and the craft are drawn without their lines until it is
  // regenerated -- said once rather than failed on.
  const hasPaths = typeof published.paths === 'object' && published.paths !== null;
  if (!hasPaths) {
    console.warn('The published data predates spacecraft trajectories. Regenerate it to draw them.');
  }
  const manifest: Manifest = hasPaths ? published : { ...published, paths: {} };
  const bodies = (await fetcher(`${basePath}data/bodies.json`)) as BodyDefinition[];

  // Data generated before the moons has no table index. Say so plainly, rather than
  // failing later on a file that was never going to exist.
  if (typeof manifest.tables !== 'object' || manifest.tables === null) {
    throw new Error(
      'The published data predates the moons and has no table index. Regenerate it.',
    );
  }

  // Only the tables shipped whole; the chunked ones are fetched as they are needed.
  // All in parallel: they are independent files and this is the app's slowest
  // startup step.
  const whole = manifest.bodies.filter((id) => manifest.tables[id]?.chunks === null);
  const vectorList = await Promise.all(
    whole.map(
      async (id) => [id, (await fetcher(`${basePath}data/vectors/${id}.json`)) as VectorTable] as const,
    ),
  );

  const elementBodies = bodies.filter((body) => body.drawOrbit);
  const elementList = await Promise.all(
    elementBodies.map(
      async (body) =>
        [body.id, (await fetcher(`${basePath}data/elements/${body.id}.json`)) as OsculatingElements] as const,
    ),
  );

  return {
    manifest,
    bodies,
    vectors: new Map(vectorList),
    elements: new Map(elementList),
    loadChunk: async (id, index) =>
      (await fetcher(`${basePath}data/vectors/${id}/${index}.json`)) as VectorTable,
    loadPath: async (id) => (await fetcher(`${basePath}data/paths/${id}.json`)) as PathTable,
  };
}

export class EphemerisStore {
  readonly #data: EphemerisData;
  readonly #tree: FrameTree;
  readonly #chunked = new Map<BodyId, ChunkedTable>();
  readonly #paths = new Map<BodyId, PathTable>();
  readonly #pathsPending = new Map<BodyId, Promise<void>>();
  readonly #pathsFailedAt = new Map<BodyId, number>();

  constructor(data: EphemerisData) {
    this.#data = data;
    this.#tree = new FrameTree(data.bodies);

    for (const id of data.manifest.bodies) {
      const info = data.manifest.tables[id];
      if (info === undefined) {
        throw new Error(`Manifest lists "${id}" but has no table entry for it.`);
      }
      if (info.chunks !== null) {
        this.#chunked.set(id, new ChunkedTable(id, info, data.loadChunk));
      } else if (!data.vectors.has(id)) {
        throw new Error(`Manifest lists "${id}" but no vector table was loaded.`);
      }
    }
  }

  get manifest(): Manifest {
    return this.#data.manifest;
  }

  get bodies(): readonly BodyDefinition[] {
    return this.#data.bodies;
  }

  get tree(): FrameTree {
    return this.#tree;
  }

  /** When the data was generated — shown in the info panel so staleness is visible. */
  get generatedAt(): Date {
    return new Date(this.#data.manifest.generatedAt);
  }

  body(id: BodyId): BodyDefinition {
    return this.#tree.get(id);
  }

  elementsFor(id: BodyId): OsculatingElements | null {
    return this.#data.elements.get(id) ?? null;
  }

  /** The span a body's vectors cover, or null for a body with no table. */
  coverage(id: BodyId): { readonly startJd: number; readonly stopJd: number } | null {
    return this.#data.manifest.tables[id] ?? null;
  }

  /**
   * True when every one of `ids` has exact vectors at `jd`.
   *
   * Per body, because the bodies no longer share one window: the fast moons cover two
   * years, the planets twenty. Asked about the bodies actually on screen, this is what
   * decides whether the interface says APPROXIMATE.
   */
  isExactAt(jd: number, ids: readonly BodyId[] = this.#data.manifest.bodies): boolean {
    // A body with nothing to propagate -- a spacecraft -- is never approximate. Outside
    // its table it is simply not there: before launch, or past the end of its
    // trajectory, there is nowhere honest to put it.
    return ids.every(
      (id) => this.isCoveredAt(id, jd) || !this.#data.elements.has(id),
    );
  }

  /**
   * True when `jd` is inside a body's table, whether or not its chunk has arrived.
   *
   * For a spacecraft this is the same as "exists at this instant": before its launch
   * and after its trajectory ends it has no state at all.
   */
  isCoveredAt(id: BodyId, jd: number): boolean {
    const span = this.coverage(id);
    return span !== null && jd >= span.startJd && jd <= span.stopJd;
  }

  /**
   * Resolves once every chunked table among `ids` has the chunk covering `jd`.
   *
   * The app never waits on this -- a moon whose chunk is still coming is simply absent
   * for a frame or two. It exists for tests, which need an answer rather than a frame.
   */
  async whenLoadedAt(jd: number, ids: readonly BodyId[] = this.#data.manifest.bodies): Promise<void> {
    await Promise.all(ids.map((id) => this.#chunked.get(id)?.whenLoadedAt(jd)));
  }

  /** How a spacecraft's trajectory was cut, and where it jumps; null for anything else. */
  pathInfo(id: BodyId): PathInfo | null {
    return this.#data.manifest.paths[id] ?? null;
  }

  /**
   * A spacecraft's drawable trajectory, or null until it has arrived.
   *
   * Asked for on the first call and never waited on, like a moon's chunk: a craft's line
   * appears when its file does. A few kilobytes each, and nothing is fetched for a craft
   * whose line is never shown.
   */
  path(id: BodyId): PathTable | null {
    const path = this.#paths.get(id);
    if (path !== undefined) {
      return path;
    }
    void this.requestPath(id);
    return null;
  }

  /** Asks for a trajectory, once; resolves when it has arrived or has failed. */
  requestPath(id: BodyId): Promise<void> {
    const load = this.#data.loadPath;
    // A craft whose trail is drawn from its table has no path file to ask for.
    if (this.#paths.has(id) || (this.pathInfo(id)?.count ?? null) === null || load === null) {
      return Promise.resolve();
    }
    const pending = this.#pathsPending.get(id);
    if (pending !== undefined) {
      return pending;
    }
    const failedAt = this.#pathsFailedAt.get(id);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    const promise = load(id)
      .then((path) => {
        this.#paths.set(id, path);
        this.#pathsFailedAt.delete(id);
      })
      .catch((error: unknown) => {
        this.#pathsFailedAt.set(id, Date.now());
        console.error(`Could not load the trajectory of ${id}`, error);
      })
      .finally(() => {
        this.#pathsPending.delete(id);
      });
    this.#pathsPending.set(id, promise);
    return promise;
  }

  /**
   * A body's own samples from `startJd` to `stopJd` (see samplesBetween), from data
   * already here; null otherwise. Never fetches.
   */
  loadedSamples(id: BodyId, startJd: number, stopJd: number): VectorTable | null {
    const table = this.#data.vectors.get(id);
    if (table !== undefined) {
      return samplesBetween([table], startJd, stopJd);
    }
    return this.#chunked.get(id)?.samplesIfLoaded(startJd, stopJd) ?? null;
  }

  /**
   * A body's exact state relative to its parent, from data already here; null otherwise.
   *
   * Never fetches and never propagates. It is what a trajectory line samples its craft
   * with: exactly the curve the craft itself is drawn on, wherever that curve is loaded.
   */
  loadedLocalState(id: BodyId, jd: number): StateVector | null {
    const table = this.#data.vectors.get(id);
    if (table !== undefined) {
      return interpolateState(table, jd);
    }
    return this.#chunked.get(id)?.stateIfLoaded(jd) ?? null;
  }

  /**
   * A body's state relative to its own parent frame.
   *
   * This is the primitive the frame tree composes; callers usually want
   * `stateInRoot` or `stateRelativeTo` instead.
   */
  localState(id: BodyId, jd: number): BodyState | null {
    const table = this.#data.vectors.get(id);
    if (table) {
      const interpolated = interpolateState(table, jd);
      if (interpolated !== null) {
        return { ...interpolated, approximate: false };
      }
    }

    const chunked = this.#chunked.get(id);
    if (chunked?.covers(jd) === true) {
      // Inside the table: either the exact answer, or none yet while its chunk is on
      // the way. Never the propagated one, which would draw the moon somewhere
      // plausible and then jump it to where it actually is.
      const interpolated = chunked.stateAt(jd);
      return interpolated === null ? null : { ...interpolated, approximate: false };
    }

    // Outside the window. The elements were requested against the same center as the
    // vectors -- the Sun for a planet, the planet for a moon -- so propagating them
    // gives a state in the frame the tree expects either way.
    const elements = this.#data.elements.get(id);
    if (elements) {
      return { ...propagate(elements, jd), approximate: true };
    }

    return null;
  }

  /** A body's state in the root (barycentric) frame. */
  stateInRoot(id: BodyId, jd: number): BodyState | null {
    let approximate = false;
    const state = this.#tree.resolveInRoot(id, (link) => {
      const local = this.localState(link, jd);
      if (local?.approximate === true) {
        approximate = true;
      }
      return local;
    });
    return state === null ? null : { ...state, approximate };
  }

  /**
   * A body's state as seen from another body — the floating origin's input.
   */
  stateRelativeTo(id: BodyId, observerId: BodyId, jd: number): BodyState | null {
    let approximate = false;
    const state = this.#tree.resolveRelative(id, observerId, (link) => {
      const local = this.localState(link, jd);
      if (local?.approximate === true) {
        approximate = true;
      }
      return local;
    });
    return state === null ? null : { ...state, approximate };
  }

  /** Every body's state in the root frame, for one instant. */
  allStatesInRoot(jd: number): Map<BodyId, BodyState> {
    const states = new Map<BodyId, BodyState>();
    for (const body of this.#data.bodies) {
      const state = this.stateInRoot(body.id, jd);
      if (state !== null) {
        states.set(body.id, state);
      }
    }
    return states;
  }

  /**
   * Distance in km between two bodies at an instant.
   *
   * In 'surface' mode both bodies' equatorial radii are subtracted. That uses the
   * equatorial radius rather than the radius along the line of sight, which is what
   * NASA Eyes does too; for an oblate body like Saturn the difference is ~6000 km,
   * negligible against interplanetary distances but worth knowing it is an
   * approximation rather than an exact surface point.
   */
  distanceBetween(a: BodyId, b: BodyId, jd: number, mode: DistanceMode = 'center'): number | null {
    const relative = this.stateRelativeTo(a, b, jd);
    if (relative === null) {
      return null;
    }
    const { x, y, z }: Vec3 = relative.position;
    const centerToCenter = Math.hypot(x, y, z);

    if (mode === 'center' || a === b) {
      return centerToCenter;
    }
    const gap =
      centerToCenter - this.body(a).radiusEquatorialKm - this.body(b).radiusEquatorialKm;
    // Bodies cannot overlap in practice, but clamp rather than return a negative.
    return Math.max(0, gap);
  }

  /**
   * One-way light time in seconds between two bodies.
   *
   * The number NASA Eyes shows as "8 min 22 sec" for the Sun. Purely geometric: it
   * ignores the light-time correction itself, so it answers "how far is it in light
   * seconds right now", not "when did the light I am seeing leave".
   */
  lightTimeSeconds(
    a: BodyId,
    b: BodyId,
    jd: number,
    mode: DistanceMode = 'center',
  ): number | null {
    const distance = this.distanceBetween(a, b, jd, mode);
    return distance === null ? null : distance / SPEED_OF_LIGHT_KM_S;
  }

  /** Speed in km/s of one body relative to another. */
  speedRelativeTo(a: BodyId, b: BodyId, jd: number): number | null {
    const relative = this.stateRelativeTo(a, b, jd);
    if (relative === null) {
      return null;
    }
    const { x, y, z }: Vec3 = relative.velocity;
    return Math.hypot(x, y, z);
  }
}

/** Loads everything and returns a ready store. */
export async function loadEphemerisStore(
  fetcher: Fetcher,
  basePath = '/',
): Promise<EphemerisStore> {
  return new EphemerisStore(await loadEphemerisData(fetcher, basePath));
}

/** The browser fetcher: plain JSON GETs that fail loudly. */
export const httpFetcher: Fetcher = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response.json();
};
