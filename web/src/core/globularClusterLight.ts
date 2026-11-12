import type { GlobularClusterCatalog } from '@sss/tools/types';

import { CLUSTER_LF_STEP, type ClusterPopulation } from './globularClusterPopulation.ts';
import { clusterPopulation, clusterStarCount, meanLuminosity, SUN_ABSOLUTE_V } from './globularClusters.ts';

/**
 * A globular cluster's light taken whole: what it is from far off, where its stars are not
 * drawn one by one (GlobularClusters.tsx) -- a point, as an unresolved galaxy is
 * (LocalGroup.tsx), on the galaxies' exposure.
 *
 * - **How bright**: the luminosity its stars are counted from (globularClusters.ts
 *   clusterStarCount), so the point and the stars hold the same light. Where the cluster has a
 *   V and a reddening, that is its V less its distance modulus and A_V = 3.1 E(B-V):
 *   Baumgardt et al.'s V and distance, Harris's reddening. Where it has no reddening, its mass
 *   times the population's light per solar mass.
 * - **Its colour**: the integrated B-V of the population it is drawn with (12 Gyr PARSEC,
 *   nearest its [M/H]; globularClusterPopulation.ts), its stars' light in B over their light
 *   in V. Harris lists an integrated B-V, but reddened, and it is not carried; the population's
 *   is the colour of the stars the cluster is drawn with when near.
 * - **Its size**: Baumgardt's projected half-light radius, pc, the half-light radius of the
 *   point's Gaussian.
 */

/** A cluster's whole V luminosity, solar units, its absolute V, and what it is from. */
export function clusterLuminosity(
  catalog: GlobularClusterCatalog,
  k: number,
): { readonly luminosity: number; readonly absoluteV: number; readonly from: 'light' | 'mass' } {
  const count = clusterStarCount(catalog, k);
  const luminosity = count.stars * meanLuminosity(clusterPopulation(catalog.feH[k] ?? null));
  return { luminosity, absoluteV: SUN_ABSOLUTE_V - 2.5 * Math.log10(luminosity), from: count.from };
}

/** A row's V light, solar units per star of the population, its middle magnitude taken. */
function rowLight(mv: number, share: number): number {
  return share * 10 ** (-0.4 * (mv + CLUSTER_LF_STEP / 2 - SUN_ABSOLUTE_V));
}

/** A population's integrated B-V: -2.5 log10 of its light in B over its light in V. */
export function populationColourIndex(population: ClusterPopulation): number {
  let v = 0;
  let b = 0;
  for (const [mv, share, bv] of population.rows) {
    const light = rowLight(mv, share);
    v += light;
    b += light * 10 ** (-0.4 * bv);
  }
  return -2.5 * Math.log10(b / v);
}

/**
 * The share of a population's V light in stars fainter than M_V `limit`: what is left
 * unresolved where the stars brighter than it are drawn one by one. A row the limit cuts
 * is shared in proportion, as its stars are spread across it.
 */
export function unresolvedShare(population: ClusterPopulation, limit: number): number {
  let total = 0;
  let fainter = 0;
  for (const [mv, share] of population.rows) {
    const light = rowLight(mv, share);
    total += light;
    fainter += light * Math.min(1, Math.max(0, (mv + CLUSTER_LF_STEP - limit) / CLUSTER_LF_STEP));
  }
  return fainter / total;
}

/**
 * Where a cluster's unresolved light comes in, by the size of its half-light radius on the
 * screen, CSS pixels: none while it spans more than UNRESOLVED_HIDDEN_PX, all of it once it
 * spans UNRESOLVED_FULL_PX or less, smoothly in the logarithm between.
 *
 * **A choice, and it drops light.** Near a cluster whose stars are drawn, its stars carry the
 * picture: the light of those too faint to be drawn, which a long exposure would show as a glow
 * under them, is left out while the cluster is large on the screen, and comes in as it shrinks
 * -- for every cluster alike, since it goes by what is on the screen, not by a distance. 140
 * pixels is where Maxi asked it to begin for Djor 2 (2026-11-11: twice as far as the 4 half-light
 * radii it began at, a scale bar of 10 ly rather than 5); the nuclear cluster, of nearly the
 * same half-light radius, begins with it at about 180 light years. From four times farther it is
 * all there, and stars and glow hold the cluster's light again.
 */
export const UNRESOLVED_HIDDEN_PX = 140;
export const UNRESOLVED_FULL_PX = 35;

/** The share of a sampled cluster's unresolved light drawn, its half-light radius `halfLightPx` CSS pixels across. */
export function unresolvedOnset(halfLightPx: number): number {
  const t = Math.min(
    1,
    Math.max(0, Math.log(UNRESOLVED_HIDDEN_PX / halfLightPx) / Math.log(UNRESOLVED_HIDDEN_PX / UNRESOLVED_FULL_PX)),
  );
  return t * t * (3 - 2 * t);
}
