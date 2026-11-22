import type * as THREE from 'three';

import type { BodyId } from '@sss/tools/types';

import { fictionShipOf, fictionWorldLook, overlayOf } from '../../core/fiction.ts';
import type { FictionLook } from '../../core/fictionLook.ts';
import type { FictionObject } from './fictionLooks.ts';

/**
 * Where the main chunk meets the Fiction layer's own (FictionLayer.tsx). SolarSystem builds
 * every body's sphere and marker, a fictional world's and a ship's too, but the looks
 * (fictionLooks.ts) are the layer's and come with its chunk: so the layer hands its makers in here
 * when it loads, before it adds a single body, and SolarSystem asks here. With the layer never
 * switched on, nothing of it is fetched and this stays empty. (The imports above of fictionLooks
 * are of a type only, and cost no chunk.)
 */

type WorldLook = Extract<FictionLook, { kind: 'world' }>;

export interface FictionMakers {
  /** The sphere's material (fictionLooks.ts fictionWorldMaterial). */
  readonly material: (look: WorldLook) => THREE.Material;
  /** Its haze and rings, about it in its radii, sharing `material`'s uniforms; null for none. */
  readonly extras: (look: WorldLook, material: THREE.Material) => FictionObject | null;
  /** Anything else -- a ship -- at unit size (fictionLooks.ts createFictionObject). */
  readonly object: (look: Exclude<FictionLook, { kind: 'world' }>) => FictionObject;
  /**
   * A ship's bow direction at `jd`, into `out`, and its centrifuge with how far round it has
   * spun, radians (core/hailMary.ts Voyage.pose; looks/hailMary.ts CENTRIFUGE_SPIN_RAD_S).
   */
  readonly pose: (id: BodyId, jd: number, out: { x: number; y: number; z: number }) => ShipPose | null;
}

export interface ShipPose {
  readonly centrifuge: boolean;
  readonly spinPhase: number;
}

let makers: FictionMakers | null = null;
const listeners = new Set<() => void>();

/** Called by the Fiction layer's chunk as it loads. */
export function setFictionMakers(next: FictionMakers): void {
  makers = next;
  for (const listener of listeners) listener();
}

/** Whether the layer's chunk is in: for useSyncExternalStore, with the subscription below. */
export function fictionMakersReady(): boolean {
  return makers !== null;
}

export function subscribeFictionMakers(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A fictional world as drawn: its sphere's material and what goes about it. */
export interface FictionWorldParts {
  readonly material: THREE.Material;
  /** Built in the world's radii: a child of the sphere, scaled to its radius in scene units. */
  readonly extras: FictionObject | null;
}

function worldParts(look: WorldLook): FictionWorldParts | null {
  if (makers === null) return null;
  const material = makers.material(look);
  return { material, extras: makers.extras(look, material) };
}

/** A fictional world's parts, in its own look; null for every other body. */
export function fictionWorldFor(id: BodyId): FictionWorldParts | null {
  const look = fictionWorldLook(id);
  return look === null ? null : worldParts(look);
}

/**
 * The look a real body takes while the Fiction layer is on, where a fiction is drawn over it --
 * τ Ceti e as Adrian (core/fiction.ts overlayOf); null for every other body, or before the layer's
 * chunk is in.
 */
export function fictionOverlayFor(id: BodyId): FictionWorldParts | null {
  const look = overlayOf(id)?.look;
  return look?.kind === 'world' ? worldParts(look) : null;
}

/** A fictional ship's model, at unit length along +z; null for any other body or before the chunk. */
export function fictionObjectFor(id: BodyId): FictionObject | null {
  const ship = fictionShipOf(id);
  return ship === null || makers === null ? null : makers.object(ship.look);
}

/** A ship's pose at `jd` (FictionMakers.pose); null where there is none. */
export function fictionPose(id: BodyId, jd: number, out: { x: number; y: number; z: number }): ShipPose | null {
  return makers === null ? null : makers.pose(id, jd, out);
}
