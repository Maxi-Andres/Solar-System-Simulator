/**
 * Deterministic numbers from a name: what an invented placement is drawn from (fiction.ts
 * inventedOrbit, starWars.ts), so the same id gives the same choice in every session and browser.
 * Kept apart from fiction.ts so the data modules it gathers can use them without an import cycle.
 */

/** A 32-bit seed from an id (FNV-1a): the same id, the same seed, in every session and browser. */
export function idSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A generator of numbers in [0, 1) from a seed (mulberry32): deterministic, and plenty for placing. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
