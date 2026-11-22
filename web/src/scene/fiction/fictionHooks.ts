import type * as THREE from 'three';

import type { BodyId } from '@sss/tools/types';

import { fictionWorldLook } from '../../core/fiction.ts';
import type { FictionLook } from '../../core/fictionLook.ts';
import type { FictionObject } from './fictionLooks.ts';

/**
 * Where the main chunk meets the Fiction layer's own (FictionLayer.tsx). SolarSystem builds
 * every body's sphere, a fictional world's too, but the looks (fictionLooks.ts) are the layer's
 * and come with its chunk: so the layer hands its makers in here when it loads, before it adds
 * a single body, and SolarSystem asks here. With the layer never switched on, nothing of it is
 * fetched and this stays empty. (The import above is of a type only, and costs no chunk.)
 */

type WorldLook = Extract<FictionLook, { kind: 'world' }>;

export interface FictionWorldMakers {
  /** The sphere's material (fictionLooks.ts fictionWorldMaterial). */
  readonly material: (look: WorldLook) => THREE.Material;
  /** Its haze and rings, about it in its radii, sharing `material`'s uniforms; null for none. */
  readonly extras: (look: WorldLook, material: THREE.Material) => FictionObject | null;
}

let makers: FictionWorldMakers | null = null;

/** Called by the Fiction layer's chunk as it loads. */
export function setFictionWorldMakers(next: FictionWorldMakers): void {
  makers = next;
}

/** A fictional world as drawn: its sphere's material and what goes about it. */
export interface FictionWorldParts {
  readonly material: THREE.Material;
  /** Built in the world's radii: a child of the sphere, scaled to its radius in scene units. */
  readonly extras: FictionObject | null;
}

/** A fictional world's parts, in its own look; null for every other body. */
export function fictionWorldFor(id: BodyId): FictionWorldParts | null {
  const look = fictionWorldLook(id);
  if (look === null || makers === null) return null;
  const material = makers.material(look);
  return { material, extras: makers.extras(look, material) };
}
