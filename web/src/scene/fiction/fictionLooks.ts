import * as THREE from 'three';

import type { FictionLook, WorldPalette } from '../../core/fictionLook.ts';
import { exoplanetMaterial } from '../exoplanetSurface.ts';
import { BARREN, ICY, NO_HAZE } from './looks/airless.ts';
import { DENSE_HAZE, DENSE_HAZE_AIR } from './looks/denseHaze.ts';
import { createHailMary, type Planetshine, type ShipMode } from './looks/hailMary.ts';
import { atmosphereHalo } from './looks/atmosphereShell.ts';
import { BANDED_GIANT, BANDED_GIANT_HAZE } from './looks/bandedGiant.ts';
import { JUNGLE_MOON, JUNGLE_MOON_HAZE } from './looks/jungleMoon.ts';
import { ringAnnulus, ringMaterial } from './looks/rings.ts';
import { worldMaterial, type Haze, type SurfaceLook, type WorldLook } from './looks/worldShader.ts';

/**
 * The fictional objects' looks (core/fictionLook.ts): the worlds' surfaces our own, procedural,
 * made from what each canon describes -- never a franchise's texture or artwork. The Hail Mary
 * is a fan-made model of the ship, given to the project (looks/hailMary.ts).
 *
 * A world's palette is a surface look (looks/), drawn by the shared world shader
 * (looks/worldShader.ts) with the house's lighting and a haze; each look is one program, the
 * seed and tint uniforms. A palette not yet given a look is drawn as a real exoplanet is, in
 * a flat colour lit by its star. So is every other kind of object for now, in a plain stand-in
 * shape. The exported signatures are the contract the scene codes against.
 */

/** A palette's look: its surface, its air, and how far it leans toward a world's tint. */
interface PaletteLook {
  readonly surface: SurfaceLook;
  readonly haze: Haze;
  readonly tintWeight: number;
}

/** The palettes drawn procedurally so far. Each later one is one more entry. */
const PALETTE_LOOKS: Partial<Record<WorldPalette, PaletteLook>> = {
  'jungle-moon': { surface: JUNGLE_MOON, haze: JUNGLE_MOON_HAZE, tintWeight: 0.5 },
  // The tint is the giant's colour itself (bandedGiant.ts), not a lean.
  'banded-giant': { surface: BANDED_GIANT, haze: BANDED_GIANT_HAZE, tintWeight: 1 },
  barren: { surface: BARREN, haze: NO_HAZE, tintWeight: 0.6 },
  icy: { surface: ICY, haze: NO_HAZE, tintWeight: 0.4 },
  'dense-haze': { surface: DENSE_HAZE, haze: DENSE_HAZE_AIR, tintWeight: 0.6 },
};

/** A stand-in colour for the palettes without a look yet. */
const STUB_COLOUR: Record<WorldPalette, string> = {
  'jungle-moon': '#3f8f6a',
  'banded-giant': '#6f8fb8',
  desert: '#c9a066',
  arid: '#a5553a',
  'dense-haze': '#b8a878',
  'storm-rock': '#4a4a52',
  scorched: '#8a5a3a',
  temperate: '#4f7fa8',
  crystal: '#b8d8e8',
  barren: '#7a756c',
  icy: '#d0d8e0',
};

/**
 * The material of a fictional world's sphere. It follows exoplanetSurface.ts's protocol:
 * `userData.starDirection` (a world-space unit vector from the world to its star, set by the
 * scene every frame) and `userData.ambient` (`{ value }`, the lighting mode's ambient
 * share), so it is lit by its own star as the real exoplanets are.
 *
 * It works on any sphere centred on the mesh's origin with local y as the pole -- built at
 * the world's radius or at one and scaled -- since it reads only the direction of each vertex.
 */
export function fictionWorldMaterial(look: Extract<FictionLook, { kind: 'world' }>): THREE.Material {
  const palette = PALETTE_LOOKS[look.palette];
  if (palette === undefined) {
    return exoplanetMaterial(STUB_COLOUR[look.palette]);
  }
  return worldMaterial({ surface: palette.surface, world: look, tintWeight: palette.tintWeight, haze: palette.haze });
}

/** A fictional object that is not a world's sphere, at unit size (see FictionLook). */
export interface FictionObject {
  readonly object: THREE.Object3D;
  /**
   * Each frame it is drawn: the direction to the light that falls on it (world space), the
   * camera, and -- for a ship near a world -- that world's light on its dark side: the direction
   * to the world and `planetshineStrength(albedo, litFraction, angularRadius)`, a share of the
   * star's irradiance. Omit it, or pass strength 0, far from any world.
   */
  update?(
    lightDirection: THREE.Vector3,
    camera: THREE.Camera,
    planetshine?: Planetshine,
    /** The lighting mode's star and ambient irradiance (shading.ts LIGHTING); Natural if absent. */
    lighting?: { readonly sun: number; readonly ambient: number },
  ): void;
  /**
   * A ship's flight mode, for the ships that have more than one (looks/hailMary.ts): `cruise`,
   * or `centrifuge`, split and spinning for gravity, at `spinPhase` radians about local y. The
   * layer advances the phase by the ship's spin rate (CENTRIFUGE_SPIN_RAD_S) each frame.
   */
  setMode?(mode: ShipMode, spinPhase?: number): void;
  dispose(): void;
}

export type { Planetshine, ShipMode };
export { planetshineStrength } from './looks/hailMary.ts';

/**
 * What a world has beyond its sphere: the haze past its limb, and its rings if it has any.
 * Null for a world with neither, or whose palette has no look yet.
 *
 * Built in the world's radii, about its centre, in its equator (local xz): add `object` as a
 * child of the world's mesh -- scaled by the world's radius in scene units if the sphere was
 * built at that radius rather than scaled to it. It shares `material`'s uniforms, so the star
 * the scene sets on the world lights these too and nothing here needs updating per frame;
 * `material` must be the one fictionWorldMaterial made for `look`.
 */
export function createFictionWorldExtras(look: WorldLook, material: THREE.Material): FictionObject | null {
  if (PALETTE_LOOKS[look.palette] === undefined || !(material instanceof THREE.ShaderMaterial)) {
    return null;
  }
  const group = new THREE.Group();
  group.name = 'fiction-world-extras';
  const meshes: THREE.Mesh[] = [];
  if (PALETTE_LOOKS[look.palette]!.haze.rayleigh.some((depth) => depth > 0)) {
    meshes.push(...atmosphereHalo(material));
  }
  if (look.rings !== undefined && look.rings.outer > look.rings.inner) {
    const rings = new THREE.Mesh(ringAnnulus(look.rings.inner, look.rings.outer), ringMaterial(material));
    // After the haze, so the rings in front of the limb are drawn over it.
    rings.renderOrder = 1;
    meshes.push(rings);
  }
  if (meshes.length === 0) return null;
  group.add(...meshes);
  return {
    object: group,
    dispose() {
      for (const mesh of meshes) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
    },
  };
}

/** A fictional object that is not a world: a monolith, Rama, a wormhole's mouth. */
export function createFictionObject(look: Exclude<FictionLook, { kind: 'world' }>): FictionObject {
  if (look.kind === 'ship') {
    return createHailMary();
  }
  const geometry =
    look.kind === 'monolith'
      ? new THREE.BoxGeometry(1 / 9, 1, 4 / 9)
      : look.kind === 'cylinder'
        ? new THREE.CylinderGeometry(0.5 / look.lengthOverDiameter, 0.5 / look.lengthOverDiameter, 1, 48)
        : new THREE.SphereGeometry(1, 48, 32);
  const material = new THREE.MeshBasicMaterial({ color: look.kind === 'monolith' ? '#050505' : '#777777' });
  const mesh = new THREE.Mesh(geometry, material);
  return {
    object: mesh,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}
