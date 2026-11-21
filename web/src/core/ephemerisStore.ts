import type {
  BodyDefinition,
  BodyId,
  Manifest,
  OsculatingElements,
  PathInfo,
  PathTable,
  SmallMoonBundle,
  TableInfo,
  SurfaceInfo,
  SurfaceTrack,
  VectorTable,
} from '@sss/tools/types';

import {
  ChunkBudget,
  CHUNK_BUDGET_BYTES,
  ChunkedTable,
  type ChunkLoader,
  RETRY_AFTER_MS,
  samplesBetween,
} from './chunkedTable.ts';
import { FrameTree, sharedSplit } from './frames.ts';
import { interpolateState } from './hermite.ts';
import { propagate } from './kepler.ts';
import { joinPathPieces, pieceIndexAt } from './pathPieces.ts';
import { stopIndexAt, surfaceState } from './surface.ts';
import { ZERO, type StateVector, type Vec3 } from './vec3.ts';

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
 * The tables come in chunks fetched as the clock reaches them -- see chunkedTable.ts --
 * and while one is on its way the body has no state at all, which is different from
 * having an approximate one. The planets' chunks at the clock are waited for before the
 * first frame (loadEphemerisStore); in data from before 2026-11-21 a planet's table is
 * one file, loaded whole at startup, and that is still read.
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
  /**
   * Fetches one piece of a trajectory published in pieces (PathInfo.chunks); absent or null
   * where nothing may be fetched.
   */
  readonly loadPathPiece?: ((id: BodyId, index: number) => Promise<PathTable>) | null;
  /** Fetches a surface craft's stops; absent or null where nothing may be fetched. */
  readonly loadSurface?: SurfaceLoader | null;
  /** Fetches one planet's small moons; absent or null where nothing may be fetched. */
  readonly loadSmallMoons?: ((planet: BodyId) => Promise<SmallMoonBundle>) | null;
}

/**
 * How a body added by addPropagatedBody is read. Every field is optional: none set is a
 * belt asteroid or a comet -- a state about the Sun, approximate everywhere, placed at
 * any instant.
 */
export interface PropagatedOptions {
  /**
   * The state function gives the body's state about its parent, not about the Sun: an
   * Earth satellite, whose SGP4 position is geocentric.
   */
  readonly aboutParent?: boolean;
  /**
   * The span it is placed in, TDB Julian days; outside it the body has no position at all,
   * as a spacecraft before launch has none. For a satellite, the days around its element
   * epoch its elements are good for.
   */
  readonly coverage?: { readonly startJd: number; readonly stopJd: number };
  /**
   * Not flagged APPROXIMATE inside its coverage. For a satellite on SGP4: the elements are
   * mean elements fitted for exactly that model, so SGP4 is how they are meant to be read
   * rather than a fallback from something better -- unlike a planet propagated from
   * osculating elements outside its table, off by thousands of kilometres.
   */
  readonly exact?: boolean;
}

/** Fetches the stops of a craft on another body's surface. */
export type SurfaceLoader = (id: BodyId) => Promise<SurfaceTrack>;

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
  // The manifest and the body definitions at once; the vector tables and the elements as soon
  // as the manifest says what there is, without waiting on bodies.json. A failure of either
  // first file fails the load; bodies.json's is observed here so it is not left unhandled
  // while the manifest is awaited, and reported by the Promise.all below.
  const manifestRequest = fetcher(`${basePath}data/manifest.json`) as Promise<Manifest>;
  const bodiesRequest = fetcher(`${basePath}data/bodies.json`) as Promise<BodyDefinition[]>;
  bodiesRequest.catch(() => undefined);
  const published = await manifestRequest;
  // Data generated before the trajectories has no paths. Everything else in it is still
  // good, so it is used, and the craft are drawn without their lines until it is
  // regenerated -- said once rather than failed on.
  const hasPaths = typeof published.paths === 'object' && published.paths !== null;
  if (!hasPaths) {
    console.warn('The published data predates spacecraft trajectories. Regenerate it to draw them.');
  }
  // Likewise data from before the rovers, which simply has none.
  const manifest: Manifest = {
    ...published,
    paths: hasPaths ? published.paths : {},
    surfaces: published.surfaces ?? {},
    smallMoons: published.smallMoons ?? {},
  };

  // Data generated before the moons has no table index. Say so plainly, rather than
  // failing later on a file that was never going to exist.
  if (typeof manifest.tables !== 'object' || manifest.tables === null) {
    throw new Error(
      'The published data predates the moons and has no table index. Regenerate it.',
    );
  }

  // Only the tables shipped whole; the chunked ones are fetched as they are needed. Data
  // from before 2026-11-21 ships the Sun's, the planets', Pluto's and the Moon's whole, 2.1
  // MB; newer data has none, and loadEphemerisStore waits for their chunks at the clock.
  // All in parallel: they are independent files.
  const whole = manifest.bodies.filter((id) => manifest.tables[id]?.chunks === null);
  const vectorsRequest = Promise.all(
    whole.map(
      async (id) => [id, (await fetcher(`${basePath}data/vectors/${id}.json`)) as VectorTable] as const,
    ),
  );

  // The elements, one file for every body (Manifest.elementsFile), fetched with the tables.
  // Data from before it has one file per body, each fetched once bodies.json says which.
  // The small moons are not here at all: see loadSmallMoons.
  const elementsFile = manifest.elementsFile;
  const elementsRequest: Promise<Readonly<Record<BodyId, OsculatingElements>>> =
    elementsFile !== undefined
      ? (fetcher(`${basePath}data/${elementsFile}`) as Promise<Record<BodyId, OsculatingElements>>)
      : bodiesRequest.then(async (list) =>
          Object.fromEntries(
            await Promise.all(
              list
                .filter((body) => body.drawOrbit)
                .map(
                  async (body) =>
                    [body.id, (await fetcher(`${basePath}data/elements/${body.id}.json`)) as OsculatingElements] as const,
                ),
            ),
          ),
        );

  const [bodies, vectorList, elementRecord] = await Promise.all([bodiesRequest, vectorsRequest, elementsRequest]);
  // Only a body whose orbit is drawn is propagated from its elements outside its table: the
  // bundle carries a spacecraft's too, which has no position outside its own span.
  const elementList = bodies.flatMap((body) => {
    const elements = elementRecord[body.id];
    return body.drawOrbit && elements !== undefined ? [[body.id, elements] as const] : [];
  });

  return {
    manifest,
    bodies,
    vectors: new Map(vectorList),
    elements: new Map(elementList),
    loadChunk: async (id, index) =>
      (await fetcher(`${basePath}data/vectors/${id}/${index}.json`)) as VectorTable,
    loadPath: async (id) => (await fetcher(`${basePath}data/paths/${id}.json`)) as PathTable,
    loadPathPiece: async (id, index) => (await fetcher(`${basePath}data/paths/${id}/${index}.json`)) as PathTable,
    loadSurface: async (id) =>
      (await fetcher(`${basePath}data/surface/${id}.json`)) as SurfaceTrack,
    loadSmallMoons: async (planet) =>
      (await fetcher(`${basePath}data/small-moons/${planet}.json`)) as SmallMoonBundle,
  };
}

export class EphemerisStore {
  readonly #data: EphemerisData;
  #tree: FrameTree;
  /**
   * The bodies, their elements and their tables: the startup files' at first, and each
   * planet's small moons added once its system is entered. See loadSmallMoons.
   */
  readonly #bodies: BodyDefinition[];
  readonly #elements: Map<BodyId, OsculatingElements>;
  readonly #tables: Map<BodyId, TableInfo>;
  readonly #smallMoonsLoaded = new Set<BodyId>();
  /**
   * Bodies with no table, and their state about the Sun; see addPropagatedBody. Null for
   * one with neither elements nor a state, which therefore has no position.
   */
  readonly #propagated = new Map<BodyId, ((jd: number) => StateVector | null) | null>();
  /** How each propagated body's state is to be read; see PropagatedOptions. */
  readonly #propagatedOptions = new Map<BodyId, PropagatedOptions>();
  readonly #smallMoonsPending = new Map<BodyId, Promise<void>>();
  readonly #smallMoonsFailedAt = new Map<BodyId, number>();
  #version = 0;
  readonly #listeners = new Set<() => void>();
  readonly #chunked = new Map<BodyId, ChunkedTable>();
  /** What every chunked table's fetched chunks share; see ChunkBudget. */
  readonly #chunkBudget: ChunkBudget;
  /**
   * Kept once fetched, and never let go like a chunk: one per spacecraft, so the map is
   * bounded by the catalog -- 40 path files, 5.8 MB of JSON and about 5 MB parsed if every
   * craft's trail were shown -- and each is what its whole line is drawn from.
   */
  readonly #paths = new Map<BodyId, PathTable>();
  readonly #pathsPending = new Map<BodyId, Promise<void>>();
  readonly #pathsFailedAt = new Map<BodyId, number>();
  /**
   * The pieces of the trajectories published in pieces, each kept once fetched, as a whole
   * path is: bounded by the paths themselves. Keyed by body, one slot per piece.
   */
  readonly #pathPieces = new Map<BodyId, (PathTable | undefined)[]>();
  readonly #pathPiecesPending = new Map<string, Promise<void>>();
  readonly #pathPiecesFailedAt = new Map<string, number>();
  /** The pieces last joined for each body, so the same stretch is the same object. */
  readonly #pathJoined = new Map<BodyId, { readonly first: number; readonly last: number; readonly path: PathTable }>();
  readonly #surfaces = new Map<BodyId, SurfaceTrack>();
  readonly #surfacesPending = new Map<BodyId, Promise<void>>();
  readonly #surfacesFailedAt = new Map<BodyId, number>();
  /**
   * Goes up whenever an answer of localState may have changed for the same instant: a
   * chunk, a path or a surface track arriving, bodies added or taken away. Chunks land
   * between frames even while the clock is paused, so the instant alone is not enough.
   */
  #generation = 0;
  /**
   * Each body's last local state, with the instant and generation it was for. One entry per
   * body, updated in place: a frame asks for the Sun's and Earth's hundreds of times --
   * every body on screen is rebased through them -- and they are worked out once. A trail
   * sampling other instants only overwrites the entries it touches. Nulls are not kept: a
   * chunk on its way is asked after again, as it was before, so its retry still runs.
   */
  readonly #localMemo = new Map<BodyId, { jd: number; generation: number; state: BodyState }>();
  /** sunFromFocus's last answer from each observer: the focus, and Earth for its own layers. */
  readonly #sunMemo = new Map<BodyId, { jd: number; generation: number; state: BodyState }>();

  /** `chunkBudgetBytes`: see CHUNK_BUDGET_BYTES; smaller only in tests. */
  constructor(data: EphemerisData, chunkBudgetBytes = CHUNK_BUDGET_BYTES) {
    this.#data = data;
    this.#chunkBudget = new ChunkBudget(chunkBudgetBytes);
    this.#tree = new FrameTree(data.bodies);
    this.#bodies = [...data.bodies];
    // Only closed orbits. A comet's published elements can be a hyperbola -- 2I and 3I
    // always, a long-period comet near e = 1 on some days (see famousComets.ts) -- and
    // there is no ellipse to draw or to propagate on. Without elements it is a body like a
    // spacecraft: exact inside its table, and absent outside it rather than misplaced.
    this.#elements = new Map([...data.elements].filter(([, elements]) => elements.eccentricity < 1));
    this.#tables = new Map(Object.entries(data.manifest.tables));

    for (const id of data.manifest.bodies) {
      // A surface craft is placed, not interpolated: it has no table.
      if (data.manifest.surfaces[id] !== undefined) {
        continue;
      }
      const info = data.manifest.tables[id];
      if (info === undefined) {
        throw new Error(`Manifest lists "${id}" but has no table entry for it.`);
      }
      if (info.chunks !== null) {
        this.#chunked.set(id, this.#chunkedTable(id, info));
      } else if (!data.vectors.has(id)) {
        throw new Error(`Manifest lists "${id}" but no vector table was loaded.`);
      }
    }
  }

  #chunkedTable(id: BodyId, info: TableInfo): ChunkedTable {
    return new ChunkedTable(id, info, this.#data.loadChunk, undefined, this.#chunkBudget, this.#bump);
  }

  /** Every remembered state is stale from here on; see #generation. */
  readonly #bump = (): void => {
    this.#generation += 1;
  };

  /** Bytes of chunk data held right now: what the budget keeps within bounds. */
  get chunkBytes(): number {
    return this.#chunkBudget.bytes;
  }

  get manifest(): Manifest {
    return this.#data.manifest;
  }

  get bodies(): readonly BodyDefinition[] {
    return this.#bodies;
  }

  /**
   * Goes up by one each time bodies are added. Anything that lists the bodies -- the
   * scene, the labels, the picker -- subscribes and redraws.
   */
  get version(): number {
    return this.#version;
  }

  /** Calls `listener` whenever bodies are added; returns the unsubscribe. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  /** How many small moons a planet has, and how many have a size; null for none. */
  smallMoonCount(planet: BodyId): { readonly count: number; readonly sized: number } | null {
    return this.#data.manifest.smallMoons?.[planet] ?? null;
  }

  /** True once a planet's small moons have been added. */
  hasSmallMoons(planet: BodyId): boolean {
    return this.#smallMoonsLoaded.has(planet);
  }

  /**
   * Fetches a planet's small moons and adds them: one file, asked for once, the first
   * time its system is entered. Until then they cost the app nothing -- not a body, not
   * a label, not a byte. A failure is logged and may be asked for again later.
   */
  loadSmallMoons(planet: BodyId): Promise<void> {
    const load = this.#data.loadSmallMoons ?? null;
    if (this.#smallMoonsLoaded.has(planet) || this.smallMoonCount(planet) === null || load === null) {
      return Promise.resolve();
    }
    const pending = this.#smallMoonsPending.get(planet);
    if (pending !== undefined) {
      return pending;
    }
    const failedAt = this.#smallMoonsFailedAt.get(planet);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    const promise = load(planet)
      .then((bundle) => {
        this.#addSmallMoons(bundle);
        this.#smallMoonsLoaded.add(planet);
        this.#smallMoonsFailedAt.delete(planet);
      })
      .catch((error: unknown) => {
        this.#smallMoonsFailedAt.set(planet, Date.now());
        console.error(`Could not load the small moons of ${planet}`, error);
      })
      .finally(() => {
        this.#smallMoonsPending.delete(planet);
      });
    this.#smallMoonsPending.set(planet, promise);
    return promise;
  }

  #addSmallMoons(bundle: SmallMoonBundle): void {
    for (const body of bundle.bodies) {
      const table = bundle.tables[body.id];
      const elements = bundle.elements[body.id];
      if (this.#tree.has(body.id) || table === undefined || table.chunks === null) {
        continue;
      }
      this.#bodies.push(body);
      this.#tables.set(body.id, table);
      this.#chunked.set(body.id, this.#chunkedTable(body.id, table));
      if (elements !== undefined) {
        this.#elements.set(body.id, elements);
      }
    }
    this.#tree = new FrameTree(this.#bodies);
    this.#bump();
    this.#localMemo.clear();
    this.#sunMemo.clear();
    this.#version += 1;
    for (const listener of this.#listeners) {
      listener();
    }
  }

  /**
   * Adds a body that has no table at all: one placed only by propagating its elements --
   * a belt asteroid chosen from search (see beltBodies.ts). It goes through the same
   * fallback every body outside its window does (see localState), so it is flagged
   * approximate wherever it is on screen, which is the truth about it: two-body motion
   * from osculating elements, not an ephemeris.
   *
   * The smallest change that makes such a thing focusable: the frame tree, the labels and
   * the scene take it from here as they take a small moon arriving.
   *
   * An Earth satellite is added the same way (see satelliteBodies.ts), with options: its
   * state is about Earth, it exists only in the days its elements are good for, and in
   * them it is not flagged approximate. See PropagatedOptions.
   */
  addPropagatedBody(
    body: BodyDefinition,
    elements: OsculatingElements | null,
    /**
     * Its state about the Sun, km and km/s, where elements cannot say it: a comet on a
     * parabola or hyperbola, which has no ellipse to propagate (see cometBodies.ts).
     * Without it, the elements are propagated. With `options.aboutParent`, its state
     * about its parent instead.
     */
    heliocentric: ((jd: number) => StateVector) | null = null,
    options: PropagatedOptions = {},
  ): void {
    this.addPropagatedBodies([{ body, elements, state: heliocentric, options }]);
  }

  /**
   * addPropagatedBody for many at once, with one rebuild of the frame tree and one notice
   * to the listeners: the named satellites arrive together, a hundred of them, and each
   * rebuild walks every body.
   */
  addPropagatedBodies(
    entries: readonly {
      readonly body: BodyDefinition;
      readonly elements: OsculatingElements | null;
      /** Null at an instant where it cannot be placed: a satellite SGP4 has lost. */
      readonly state: ((jd: number) => StateVector | null) | null;
      readonly options?: PropagatedOptions;
    }[],
  ): void {
    let added = false;
    for (const { body, elements, state, options = {} } of entries) {
      if (this.#tree.has(body.id) || this.#propagated.has(body.id)) {
        continue;
      }
      this.#bodies.push(body);
      if (elements !== null) {
        this.#elements.set(body.id, elements);
      }
      this.#propagated.set(body.id, state ?? (elements === null ? null : (jd) => propagate(elements, jd)));
      this.#propagatedOptions.set(body.id, options);
      added = true;
    }
    if (added) {
      this.#changed();
    }
  }

  /** Takes away a body addPropagatedBody added; any other is left alone. */
  removePropagatedBody(id: BodyId): void {
    if (!this.#propagated.has(id)) {
      return;
    }
    this.#propagated.delete(id);
    this.#propagatedOptions.delete(id);
    const index = this.#bodies.findIndex((body) => body.id === id);
    if (index >= 0) {
      this.#bodies.splice(index, 1);
    }
    this.#elements.delete(id);
    this.#changed();
  }

  /** True for a body added by addPropagatedBody. */
  isPropagatedBody(id: BodyId): boolean {
    return this.#propagated.has(id);
  }

  /** The tree rebuilt over the bodies as they now are, and everyone told. */
  #changed(): void {
    this.#tree = new FrameTree(this.#bodies);
    this.#bump();
    this.#localMemo.clear();
    this.#sunMemo.clear();
    this.#version += 1;
    for (const listener of this.#listeners) {
      listener();
    }
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
    return this.#elements.get(id) ?? null;
  }

  /**
   * The span a body's vectors cover -- or a satellite's window, the days its elements are
   * good for -- or null for a body with neither.
   */
  coverage(id: BodyId): { readonly startJd: number; readonly stopJd: number } | null {
    return (
      this.#tables.get(id) ??
      this.#data.manifest.surfaces[id] ??
      this.#propagatedOptions.get(id)?.coverage ??
      null
    );
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
    //
    // A propagated body is approximate unless it was added as exact -- a satellite, on the
    // very model its elements are fitted for -- and such a one has a window it is placed
    // in and is absent outside it, as a craft is.
    return ids.every((id) =>
      this.#propagated.has(id)
        ? this.#propagatedOptions.get(id)?.exact === true
        : this.isCoveredAt(id, jd) || !this.#elements.has(id),
    );
  }

  /**
   * True when `jd` is inside a body's table, whether or not its chunk has arrived.
   *
   * For a spacecraft this is the same as "exists at this instant": before its launch
   * and after its trajectory ends it has no state at all.
   */
  isCoveredAt(id: BodyId, jd: number): boolean {
    // A craft on the ground is there from touchdown on: past the last position NASA reported it
    // stands where that left it -- it may have driven since, and the panel says so -- rather than
    // vanishing, as a rover did days after each data build (Maxi, 2026-11-21: "el curiosity, el
    // perseverance … no me deja verlo, me pone until 2026").
    const surface = this.#data.manifest.surfaces[id];
    if (surface !== undefined) return jd >= surface.startJd;
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
    await Promise.all(
      ids.map((id) =>
        this.surfaceInfo(id) !== null ? this.requestSurface(id) : this.#chunked.get(id)?.whenLoadedAt(jd),
      ),
    );
  }

  /** Where a surface craft stands and over what span; null for anything else. */
  surfaceInfo(id: BodyId): SurfaceInfo | null {
    return this.#data.manifest.surfaces[id] ?? null;
  }

  /**
   * A surface craft's stops, or null until they have arrived. Asked for on the first
   * call, like a path: a few tens of kilobytes, fetched once the craft is wanted.
   */
  surfaceTrack(id: BodyId): SurfaceTrack | null {
    const track = this.#surfaces.get(id);
    if (track !== undefined) {
      return track;
    }
    void this.requestSurface(id);
    return null;
  }

  /** Asks for a surface craft's stops, once; resolves when they have arrived or failed. */
  requestSurface(id: BodyId): Promise<void> {
    const load = this.#data.loadSurface ?? null;
    if (this.#surfaces.has(id) || this.surfaceInfo(id) === null || load === null) {
      return Promise.resolve();
    }
    const pending = this.#surfacesPending.get(id);
    if (pending !== undefined) {
      return pending;
    }
    const failedAt = this.#surfacesFailedAt.get(id);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    const promise = load(id)
      .then((track) => {
        this.#surfaces.set(id, track);
        this.#surfacesFailedAt.delete(id);
        this.#bump();
      })
      .catch((error: unknown) => {
        this.#surfacesFailedAt.set(id, Date.now());
        console.error(`Could not load where ${id} stands`, error);
      })
      .finally(() => {
        this.#surfacesPending.delete(id);
      });
    this.#surfacesPending.set(id, promise);
    return promise;
  }

  /**
   * The stop a surface craft is at, at `jd`: its index in the track, or null outside
   * the craft's span or before its stops have arrived.
   */
  surfaceStopAt(id: BodyId, jd: number): { readonly track: SurfaceTrack; readonly index: number } | null {
    if (!this.isCoveredAt(id, jd)) {
      return null;
    }
    const track = this.surfaceTrack(id);
    if (track === null) {
      return null;
    }
    const index = stopIndexAt(track, jd);
    return index < 0 ? null : { track, index };
  }

  /** A surface craft's state relative to its host, or null. See surface.ts. */
  #surfaceState(id: BodyId, jd: number): StateVector | null {
    const stop = this.surfaceStopAt(id, jd);
    if (stop === null) {
      return null;
    }
    const { track, index } = stop;
    return surfaceState(
      this.body(track.host),
      track.latitudeDeg[index]!,
      track.longitudeDeg[index]!,
      jd,
    );
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
        this.#bump();
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
   * True for a craft whose trajectory is published in pieces (PathInfo.chunks): its trail
   * is drawn from pathBetween, not path. Data from before the pieces has one file per craft.
   */
  pathInPieces(id: BodyId): boolean {
    const info = this.pathInfo(id);
    return info !== null && info.count !== null && (info.chunks?.length ?? 0) > 0;
  }

  /**
   * The pieces of a craft's trajectory covering `startJd` to `stopJd`, joined into one
   * path, or null until every one of them is here -- or when the stretch is outside the
   * path altogether. Asks for the missing ones, and for the next one once the stretch is
   * three quarters into its last, so a clock running forward finds it there (as a chunked
   * table does; see PREFETCH_MARGIN). The same stretch of pieces comes back as the same
   * object, so a trail can tell it has nothing new.
   */
  pathBetween(id: BodyId, startJd: number, stopJd: number): PathTable | null {
    const chunks = this.pathInPieces(id) ? this.pathInfo(id)!.chunks! : null;
    if (chunks === null) {
      return null;
    }
    const from = Math.max(startJd, chunks[0]!.startJd);
    const to = Math.min(stopJd, chunks.at(-1)!.stopJd);
    if (!(from <= to)) {
      return null;
    }
    const first = pieceIndexAt(chunks, from);
    const last = pieceIndexAt(chunks, to);
    const lastChunk = chunks[last]!;
    if (last + 1 < chunks.length && to > lastChunk.startJd + (lastChunk.stopJd - lastChunk.startJd) * 0.75) {
      void this.#requestPathPiece(id, last + 1);
    }
    const loaded = this.#pathPieces.get(id);
    let missing = false;
    for (let index = first; index <= last; index += 1) {
      if (loaded?.[index] === undefined) {
        missing = true;
        void this.#requestPathPiece(id, index);
      }
    }
    if (missing) {
      return null;
    }
    // The last join, while it still covers the stretch with at most one piece to spare
    // behind: a trail's span is the osculating period, which wobbles with every turn of a
    // craft about a planet, and its start would otherwise flick across a boundary and back,
    // the line tessellated anew each time.
    const joined = this.#pathJoined.get(id);
    if (joined !== undefined && joined.first <= first && first - joined.first <= 1 && joined.last === last) {
      return joined.path;
    }
    const path = joinPathPieces(loaded!.slice(first, last + 1) as PathTable[]);
    this.#pathJoined.set(id, { first, last, path });
    return path;
  }

  /** Asks for one piece of a trajectory, once; resolves when it has arrived or failed. */
  #requestPathPiece(id: BodyId, index: number): Promise<void> {
    const load = this.#data.loadPathPiece ?? null;
    const count = this.pathInfo(id)?.chunks?.length ?? 0;
    if (load === null || index < 0 || index >= count || this.#pathPieces.get(id)?.[index] !== undefined) {
      return Promise.resolve();
    }
    const key = `${id}/${index}`;
    const pending = this.#pathPiecesPending.get(key);
    if (pending !== undefined) {
      return pending;
    }
    const failedAt = this.#pathPiecesFailedAt.get(key);
    if (failedAt !== undefined && Date.now() - failedAt < RETRY_AFTER_MS) {
      return Promise.resolve();
    }
    const promise = load(id, index)
      .then((piece) => {
        let pieces = this.#pathPieces.get(id);
        if (pieces === undefined) {
          pieces = new Array<PathTable | undefined>(count);
          this.#pathPieces.set(id, pieces);
        }
        pieces[index] = piece;
        this.#pathPiecesFailedAt.delete(key);
      })
      .catch((error: unknown) => {
        this.#pathPiecesFailedAt.set(key, Date.now());
        console.error(`Could not load piece ${index} of the trajectory of ${id}`, error);
      })
      .finally(() => {
        this.#pathPiecesPending.delete(key);
      });
    this.#pathPiecesPending.set(key, promise);
    return promise;
  }

  /**
   * How far from its parent a craft about a planet or a moon gets in the chunk of its table
   * covering `jd`, km (ChunkInfo.reachKm): published with the manifest, so known before the
   * chunk is fetched. Null for anything else, outside its table, or in data from before it.
   */
  reachKm(id: BodyId, jd: number): number | null {
    const chunks = this.#tables.get(id)?.chunks ?? null;
    if (chunks === null || chunks.length === 0 || jd < chunks[0]!.startJd || jd > chunks.at(-1)!.stopJd) {
      return null;
    }
    return chunks[pieceIndexAt(chunks, jd)]!.reachKm ?? null;
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
    if (this.surfaceInfo(id) !== null) {
      return this.#surfaces.has(id) ? this.#surfaceState(id, jd) : null;
    }
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
   *
   * Remembered per body for the instant last asked (see #localMemo): the same object comes
   * back until the instant or the data changes, so nobody may change its fields.
   */
  localState(id: BodyId, jd: number): BodyState | null {
    const memo = this.#localMemo.get(id);
    if (memo !== undefined && memo.jd === jd && memo.generation === this.#generation) {
      return memo.state;
    }
    const generation = this.#generation;
    const state = this.#computeLocalState(id, jd);
    // Kept only if nothing arrived while it was worked out: a propagated body's state can
    // read other bodies' (a Lagrange point's reads Earth's and the Sun's).
    if (state !== null && generation === this.#generation) {
      if (memo === undefined) {
        this.#localMemo.set(id, { jd, generation, state });
      } else {
        memo.jd = jd;
        memo.generation = generation;
        memo.state = state;
      }
    }
    return state;
  }

  #computeLocalState(id: BodyId, jd: number): BodyState | null {
    // A body with no table at all (see addPropagatedBody): its state about the Sun, put
    // in the root frame as every body without a parent is -- by adding the Sun's own
    // place there, which is up to 1.5 million km off the barycentre with Jupiter's pull.
    // Approximate unless added as exact: two-body motion is not an ephemeris.
    const propagated = this.#propagated.get(id);
    if (propagated !== undefined) {
      const options = this.#propagatedOptions.get(id) ?? {};
      const span = options.coverage;
      if (propagated === null || (span !== undefined && (jd < span.startJd || jd > span.stopJd))) {
        return null;
      }
      // A satellite's state is about Earth already, which is the frame the tree wants.
      const about = propagated(jd);
      if (about === null) {
        return null;
      }
      if (options.aboutParent === true) {
        return { position: about.position, velocity: about.velocity, approximate: options.exact !== true };
      }
      const sun = id === 'sun' ? null : this.localState('sun', jd);
      return {
        position: {
          x: about.position.x + (sun?.position.x ?? 0),
          y: about.position.y + (sun?.position.y ?? 0),
          z: about.position.z + (sun?.position.z ?? 0),
        },
        velocity: {
          x: about.velocity.x + (sun?.velocity.x ?? 0),
          y: about.velocity.y + (sun?.velocity.y ?? 0),
          z: about.velocity.z + (sun?.velocity.z ?? 0),
        },
        // Two-body motion is approximate; a catalogue star's linear motion is the
        // catalogue's own model, added as exact (see starBodies.ts).
        approximate: options.exact !== true,
      };
    }
    if (this.surfaceInfo(id) !== null) {
      const state = this.#surfaceState(id, jd);
      return state === null ? null : { ...state, approximate: false };
    }
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
    const elements = this.#elements.get(id);
    if (elements) {
      return { ...propagate(elements, jd), approximate: true };
    }

    return null;
  }

  /** A body's state in the root (barycentric) frame. */
  stateInRoot(id: BodyId, jd: number): BodyState | null {
    // FrameTree.resolveInRoot's walk, summed in place: the body's own state, then each
    // parent's, in the same order, so the same doubles come out.
    const chain = this.#tree.chainOf(id);
    let approximate = false;
    let px = 0;
    let py = 0;
    let pz = 0;
    let vx = 0;
    let vy = 0;
    let vz = 0;
    for (let index = 0; index < chain.length; index += 1) {
      const local = this.localState(chain[index]!, jd);
      if (local === null) {
        return null;
      }
      if (local.approximate) {
        approximate = true;
      }
      if (index === 0) {
        px = local.position.x;
        py = local.position.y;
        pz = local.position.z;
        vx = local.velocity.x;
        vy = local.velocity.y;
        vz = local.velocity.z;
      } else {
        px += local.position.x;
        py += local.position.y;
        pz += local.position.z;
        vx += local.velocity.x;
        vy += local.velocity.y;
        vz += local.velocity.z;
      }
    }
    return { position: { x: px, y: py, z: pz }, velocity: { x: vx, y: vy, z: vz }, approximate };
  }

  /**
   * A body's state as seen from another body — the floating origin's input.
   *
   * FrameTree.resolveRelative's walk, done here so the approximate flag is gathered on the
   * way without a closure, a spread or an intermediate state per link: it runs for every
   * body on screen every frame. Same links, same additions in the same order.
   */
  stateRelativeTo(id: BodyId, observerId: BodyId, jd: number): BodyState | null {
    if (id === observerId) {
      return { position: ZERO, velocity: ZERO, approximate: false };
    }
    const targetChain = this.#tree.chainOf(id);
    const observerChain = this.#tree.chainOf(observerId);
    const { targetLinks, observerLinks } = sharedSplit(targetChain, observerChain);
    let approximate = false;

    let tpx = 0;
    let tpy = 0;
    let tpz = 0;
    let tvx = 0;
    let tvy = 0;
    let tvz = 0;
    let targetMissing = false;
    for (let index = 0; index < targetLinks; index += 1) {
      const local = this.localState(targetChain[index]!, jd);
      if (local === null) {
        targetMissing = true;
        break;
      }
      if (local.approximate) {
        approximate = true;
      }
      tpx += local.position.x;
      tpy += local.position.y;
      tpz += local.position.z;
      tvx += local.velocity.x;
      tvy += local.velocity.y;
      tvz += local.velocity.z;
    }
    // The observer's side is asked for even when the target's failed, as it always was:
    // asking is what fetches a missing chunk.
    let opx = 0;
    let opy = 0;
    let opz = 0;
    let ovx = 0;
    let ovy = 0;
    let ovz = 0;
    for (let index = 0; index < observerLinks; index += 1) {
      const local = this.localState(observerChain[index]!, jd);
      if (local === null) {
        return null;
      }
      if (local.approximate) {
        approximate = true;
      }
      opx += local.position.x;
      opy += local.position.y;
      opz += local.position.z;
      ovx += local.velocity.x;
      ovy += local.velocity.y;
      ovz += local.velocity.z;
    }
    if (targetMissing) {
      return null;
    }
    return {
      position: { x: tpx - opx, y: tpy - opy, z: tpz - opz },
      velocity: { x: tvx - ovx, y: tvy - ovy, z: tvz - ovz },
      approximate,
    };
  }

  /**
   * The Sun as seen from `focus`: stateRelativeTo('sun', focus, jd), worked out once per
   * instant and shared. Nearly every layer of the scene places itself from the Sun, some
   * thirty of them a frame; the object that comes back is shared and must not be changed.
   */
  sunFromFocus(focus: BodyId, jd: number): BodyState | null {
    const memo = this.#sunMemo.get(focus);
    if (memo !== undefined && memo.jd === jd && memo.generation === this.#generation) {
      return memo.state;
    }
    const generation = this.#generation;
    const state = this.stateRelativeTo('sun', focus, jd);
    if (state !== null && generation === this.#generation) {
      this.#sunMemo.set(focus, { jd, generation, state });
    }
    return state;
  }

  /** Every body's state in the root frame, for one instant. */
  allStatesInRoot(jd: number): Map<BodyId, BodyState> {
    const states = new Map<BodyId, BodyState>();
    for (const body of this.#bodies) {
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

/**
 * The bodies the first frame waits for: those whose tables span the whole window -- the
 * Sun, the planets, Pluto and the Moon. Everything the scene places hangs off them, and
 * until 2026-11-21 their tables shipped whole and were all here before it. Now each is in
 * chunks (FULL_WINDOW_CHUNK_SAMPLES in tools), and only the chunk covering the clock is
 * waited for. In data from before, they are whole and there is nothing to wait for.
 */
export function startupBodies(bodies: readonly BodyDefinition[]): BodyId[] {
  return bodies
    .filter((body) => body.vectorWindow === 'full' && body.sampling === undefined)
    .map((body) => body.id);
}

/**
 * Loads everything and returns a ready store: with, at `startJd()` -- the clock as the
 * files arrive, TDB Julian day -- the chunk of each startupBodies table, so the first frame
 * has the Sun and the planets as it always had. A chunk that fails is not waited for again:
 * that body is absent until a later frame fetches it, as a moon's would be.
 *
 * Without `startJd`, every chunk of those tables, joined into the whole table each was
 * before it was cut: a store that answers for any instant of the window at once, as the
 * tests against the generated data ask of it.
 */
export async function loadEphemerisStore(
  fetcher: Fetcher,
  basePath = '/',
  startJd: (() => number) | null = null,
): Promise<EphemerisStore> {
  const data = await loadEphemerisData(fetcher, basePath);
  if (startJd === null) {
    return new EphemerisStore(await withStartupTablesWhole(data));
  }
  const store = new EphemerisStore(data);
  await store.whenLoadedAt(startJd(), startupBodies(store.bodies));
  return store;
}

/** `data` with every startupBodies table that is in chunks fetched whole: see loadEphemerisStore. */
async function withStartupTablesWhole(data: EphemerisData): Promise<EphemerisData> {
  const load = data.loadChunk;
  const ids = startupBodies(data.bodies).filter((id) => (data.manifest.tables[id]?.chunks ?? null) !== null);
  if (load === null || ids.length === 0) {
    return data;
  }
  const tables: Record<BodyId, TableInfo> = { ...data.manifest.tables };
  const vectors = new Map(data.vectors);
  await Promise.all(
    ids.map(async (id) => {
      const info = tables[id]!;
      const chunks = await Promise.all(info.chunks!.map((_, index) => load(id, index)));
      vectors.set(id, samplesBetween(chunks, -Infinity, Infinity)!);
      tables[id] = { startJd: info.startJd, stopJd: info.stopJd, chunks: null };
    }),
  );
  return { ...data, manifest: { ...data.manifest, tables }, vectors };
}

/** The browser fetcher: plain JSON GETs that fail loudly. */
export const httpFetcher: Fetcher = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
  }
  return response.json();
};
