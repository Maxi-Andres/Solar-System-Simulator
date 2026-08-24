import type {
  BodyDefinition,
  BodyId,
  Manifest,
  OsculatingElements,
  VectorTable,
} from '@sss/tools/types';

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
  readonly vectors: ReadonlyMap<BodyId, VectorTable>;
  readonly elements: ReadonlyMap<BodyId, OsculatingElements>;
}

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
  const manifest = (await fetcher(`${basePath}data/manifest.json`)) as Manifest;
  const bodies = (await fetcher(`${basePath}data/bodies.json`)) as BodyDefinition[];

  // All bodies in parallel: they are independent files and this is the app's
  // slowest startup step.
  const vectorList = await Promise.all(
    manifest.bodies.map(
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
  };
}

export class EphemerisStore {
  readonly #data: EphemerisData;
  readonly #tree: FrameTree;

  constructor(data: EphemerisData) {
    this.#data = data;
    this.#tree = new FrameTree(data.bodies);

    for (const id of data.manifest.bodies) {
      if (!data.vectors.has(id)) {
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

  /** True when `jd` falls inside the downloaded vector window. */
  isExactAt(jd: number): boolean {
    const { startJd, stopJd } = this.#data.manifest.window;
    return jd >= startJd && jd <= stopJd;
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

    // Outside the window. Keplerian propagation is heliocentric, so it is only a
    // valid stand-in for bodies whose parent frame is effectively the Sun.
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
