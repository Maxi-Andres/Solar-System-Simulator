import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { addStates, ZERO_STATE, type StateVector } from './vec3.ts';

/**
 * The reference-frame tree.
 *
 * Every body's ephemeris is stored relative to its parent. In v1 all ten bodies hung
 * off the Solar System barycenter, so the tree was one level deep and this module
 * looked like overkill. It was not: Io arrives with `parent: 'jupiter'` and vectors
 * requested at CENTER='500@599', so its position in the root frame is its own vector
 * plus Jupiter's, and that sum has to happen in double precision before anything
 * reaches the GPU. The moons landed without a line of this file changing, which is
 * what it was built for.
 *
 * Root frame is the Solar System barycenter, and `parent: null` means "measured
 * against the root".
 */

/** Resolves a body's state relative to its own parent. */
export type StateProvider = (id: BodyId) => StateVector | null;

export class FrameTree {
  readonly #bodies: ReadonlyMap<BodyId, BodyDefinition>;
  /** Root-ward chain for each body, nearest parent first. Precomputed once. */
  readonly #ancestry: ReadonlyMap<BodyId, readonly BodyId[]>;
  /** Each body followed by its ancestry: the links a state is summed over. Precomputed once. */
  readonly #chains: ReadonlyMap<BodyId, readonly BodyId[]>;

  constructor(bodies: readonly BodyDefinition[]) {
    const byId = new Map<BodyId, BodyDefinition>();
    for (const body of bodies) {
      if (byId.has(body.id)) {
        throw new Error(`Duplicate body id in catalog: ${body.id}`);
      }
      byId.set(body.id, body);
    }

    for (const body of bodies) {
      if (body.parent !== null && !byId.has(body.parent)) {
        throw new Error(`Body "${body.id}" declares unknown parent "${body.parent}".`);
      }
    }

    const ancestry = new Map<BodyId, readonly BodyId[]>();
    for (const body of bodies) {
      const chain: BodyId[] = [];
      const seen = new Set<BodyId>([body.id]);
      let current = body.parent;
      while (current !== null) {
        if (seen.has(current)) {
          throw new Error(`Cycle in the frame tree at "${body.id}" via "${current}".`);
        }
        seen.add(current);
        chain.push(current);
        current = byId.get(current)?.parent ?? null;
      }
      ancestry.set(body.id, chain);
    }

    this.#bodies = byId;
    this.#ancestry = ancestry;
    this.#chains = new Map([...ancestry].map(([id, chain]) => [id, [id, ...chain]]));
  }

  get bodies(): readonly BodyDefinition[] {
    return [...this.#bodies.values()];
  }

  has(id: BodyId): boolean {
    return this.#bodies.has(id);
  }

  get(id: BodyId): BodyDefinition {
    const body = this.#bodies.get(id);
    if (!body) {
      throw new Error(`Unknown body: ${id}`);
    }
    return body;
  }

  /** The chain of parents from this body up to the root, nearest first. */
  ancestorsOf(id: BodyId): readonly BodyId[] {
    const chain = this.#ancestry.get(id);
    if (!chain) {
      throw new Error(`Unknown body: ${id}`);
    }
    return chain;
  }

  /** The body itself, then its parents up to the root, nearest first. */
  chainOf(id: BodyId): readonly BodyId[] {
    const chain = this.#chains.get(id);
    if (!chain) {
      throw new Error(`Unknown body: ${id}`);
    }
    return chain;
  }

  /** Direct children of a body, or of the root when `id` is null. */
  childrenOf(id: BodyId | null): readonly BodyDefinition[] {
    return [...this.#bodies.values()].filter((body) => body.parent === id);
  }

  /**
   * A body's state in the root frame.
   *
   * Walks up the tree summing the parent-relative states. Returns null if any link in
   * the chain has no data, since a partial sum would be worse than no answer.
   */
  resolveInRoot(id: BodyId, provider: StateProvider): StateVector | null {
    const own = provider(id);
    if (own === null) {
      return null;
    }

    let total = own;
    for (const ancestor of this.ancestorsOf(id)) {
      const parentState = provider(ancestor);
      if (parentState === null) {
        return null;
      }
      total = addStates(total, parentState);
    }
    return total;
  }

  /**
   * One body's state as seen from another — what the floating origin needs every
   * frame to rebase the scene onto the focused body.
   *
   * Resolving both to the root and subtracting is correct but does more arithmetic
   * than necessary for a moon viewed from its own planet. Cancelling the shared
   * ancestry first keeps the subtraction between numbers of similar magnitude, which
   * is where the precision actually lives: Io relative to Jupiter is ~4x10^5 km, and
   * computing it as a difference of two ~7x10^8 km barycentric vectors throws away
   * three digits for nothing.
   */
  resolveRelative(id: BodyId, observerId: BodyId, provider: StateProvider): StateVector | null {
    if (id === observerId) {
      return ZERO_STATE;
    }

    // The rebase asks this for every body on screen every frame, so it walks the
    // precomputed chains in place instead of building arrays and a set per call. The sums
    // are the same additions in the same order, from zero, so the result is bit-identical.
    const targetChain = this.chainOf(id);
    const observerChain = this.chainOf(observerId);
    const { targetLinks, observerLinks } = sharedSplit(targetChain, observerChain);

    let tpx = 0;
    let tpy = 0;
    let tpz = 0;
    let tvx = 0;
    let tvy = 0;
    let tvz = 0;
    let targetMissing = false;
    for (let index = 0; index < targetLinks; index += 1) {
      const state = provider(targetChain[index]!);
      if (state === null) {
        targetMissing = true;
        break;
      }
      tpx += state.position.x;
      tpy += state.position.y;
      tpz += state.position.z;
      tvx += state.velocity.x;
      tvy += state.velocity.y;
      tvz += state.velocity.z;
    }
    let opx = 0;
    let opy = 0;
    let opz = 0;
    let ovx = 0;
    let ovy = 0;
    let ovz = 0;
    for (let index = 0; index < observerLinks; index += 1) {
      const state = provider(observerChain[index]!);
      if (state === null) {
        return null;
      }
      opx += state.position.x;
      opy += state.position.y;
      opz += state.position.z;
      ovx += state.velocity.x;
      ovy += state.velocity.y;
      ovz += state.velocity.z;
    }
    if (targetMissing) {
      return null;
    }
    return {
      position: { x: tpx - opx, y: tpy - opy, z: tpz - opz },
      velocity: { x: tvx - ovx, y: tvy - ovy, z: tvz - ovz },
    };
  }
}

/** Scratch for sharedSplit's answer, which is read before the next call. */
const SPLIT = { targetLinks: 0, observerLinks: 0 };

/**
 * How many links of each chain lie below the nearest frame both share: all of each when
 * they share none but the root. Chains are a few links long, so a linear scan beats a set.
 */
export function sharedSplit(
  targetChain: readonly BodyId[],
  observerChain: readonly BodyId[],
): { readonly targetLinks: number; readonly observerLinks: number } {
  SPLIT.targetLinks = targetChain.length;
  SPLIT.observerLinks = observerChain.length;
  for (let index = 0; index < targetChain.length; index += 1) {
    const shared = observerChain.indexOf(targetChain[index]!);
    if (shared >= 0) {
      SPLIT.targetLinks = index;
      SPLIT.observerLinks = shared;
      break;
    }
  }
  return SPLIT;
}
