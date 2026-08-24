import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { addStates, subtractStates, ZERO_STATE, type StateVector } from './vec3.ts';

/**
 * The reference-frame tree.
 *
 * Every body's ephemeris is stored relative to its parent. In v1 all ten bodies hang
 * off the Solar System barycenter, so the tree is one level deep and this module
 * looks like overkill. It is not: the moment a moon arrives with `parent: 'jupiter'`
 * and vectors requested at CENTER='500@599', its position in the root frame is its
 * own vector plus Jupiter's, and that sum has to happen in double precision before
 * anything reaches the GPU. Building the walk now is what keeps phases A through C
 * from becoming a renderer rewrite.
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

    const targetChain = [id, ...this.ancestorsOf(id)];
    const observerChain = [observerId, ...this.ancestorsOf(observerId)];
    const observerSet = new Set(observerChain);

    // Nearest frame both bodies are expressed in, walking up from the target.
    const commonIndex = targetChain.findIndex((frame) => observerSet.has(frame));

    // No shared ancestor other than the root: sum each side to the root.
    const targetLinks = commonIndex === -1 ? targetChain : targetChain.slice(0, commonIndex);
    const commonFrame = commonIndex === -1 ? null : (targetChain[commonIndex] ?? null);
    const observerLinks =
      commonFrame === null
        ? observerChain
        : observerChain.slice(0, observerChain.indexOf(commonFrame));

    const sum = (links: readonly BodyId[]): StateVector | null => {
      let total = ZERO_STATE;
      for (const link of links) {
        const state = provider(link);
        if (state === null) {
          return null;
        }
        total = addStates(total, state);
      }
      return total;
    };

    const targetState = sum(targetLinks);
    const observerState = sum(observerLinks);
    if (targetState === null || observerState === null) {
      return null;
    }

    return subtractStates(targetState, observerState);
  }
}
