import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import type { FictionLook } from '../../core/fictionLook.ts';
import { createFictionObject, createFictionWorldExtras, fictionWorldMaterial, planetshineStrength } from './fictionLooks.ts';
import { AIRLESS_FACE_SIZE, BARREN, ICY } from './looks/airless.ts';
import { SHELL_SHADERS, shellRadius } from './looks/atmosphereShell.ts';
import { rayCraterPlacements } from './looks/craters.ts';
import {
  CABLE_FARING_LENGTH_M,
  CENTRIFUGE_CABLE_LENGTH_M,
  CENTRIFUGE_CONTROL_ROOM_RADIUS_M,
  CENTRIFUGE_RPM,
  CENTRIFUGE_SPIN_RAD_S,
  CONTROL_ROOM_HEIGHT_M,
  DORMITORY_HEIGHT_M,
  FUEL_TANK_LENGTH_M,
  HAIL_MARY_LENGTH_M,
  LAB_HEIGHT_M,
  NOSE_CONE_LENGTH_M,
  SKIRT_LENGTH_M,
  SPIN_DRIVE_LENGTH_M,
  STORAGE_HEIGHT_M,
  createHailMary,
} from './looks/hailMary.ts';
import { SHIP_SHADERS } from './looks/shipMaterial.ts';
import { STORM_COUNT, stormPlacements } from './looks/bandedGiant.ts';
import { JUNGLE_MOON } from './looks/jungleMoon.ts';
import { seedFraction, seedHash } from './looks/noise.ts';
import { RING_SHADERS } from './looks/rings.ts';
import { bakeFragmentShader } from './looks/surfaceBake.ts';
import { worldShaderSources } from './looks/worldShader.ts';

type World = Extract<FictionLook, { kind: 'world' }>;

const PANDORA: World = { kind: 'world', palette: 'jungle-moon', seed: 2, clouds: 0.45 };
const POLYPHEMUS: World = { kind: 'world', palette: 'banded-giant', seed: 1, tint: [0.32, 0.55, 0.85] };
const RINGED: World = { ...POLYPHEMUS, rings: { inner: 1.3, outer: 2.3 } };

function shader(material: THREE.Material): THREE.ShaderMaterial {
  expect(material).toBeInstanceOf(THREE.ShaderMaterial);
  return material as THREE.ShaderMaterial;
}

describe('fictionWorldMaterial', () => {
  it("follows exoplanetSurface.ts's protocol: the scene's star and ambient are the shader's", () => {
    for (const look of [PANDORA, POLYPHEMUS]) {
      const material = shader(fictionWorldMaterial(look));
      const star = material.userData['starDirection'] as THREE.Vector3;
      const ambient = material.userData['ambient'] as { value: number };
      expect(star).toBeInstanceOf(THREE.Vector3);
      expect(typeof ambient.value).toBe('number');
      // The very objects, so the scene's per-frame writes reach the GPU.
      expect(material.uniforms['uStarDirection']!.value).toBe(star);
      expect(material.uniforms['uAmbient']).toBe(ambient);
      material.dispose();
    }
  });

  it('is one program per palette: seed and tint are uniforms, not defines', () => {
    const a = shader(fictionWorldMaterial(PANDORA));
    const b = shader(fictionWorldMaterial({ ...PANDORA, seed: 9000, tint: [1, 0, 0] }));
    expect(a.fragmentShader).toBe(b.fragmentShader);
    expect(a.vertexShader).toBe(b.vertexShader);
    expect(a.defines).toEqual(b.defines);
    expect(a.uniforms['uSeedHash']!.value).not.toBe(b.uniforms['uSeedHash']!.value);
    expect(a.uniforms['uTintWeight']!.value).toBe(0);
    expect(b.uniforms['uTintWeight']!.value).toBeGreaterThan(0);
    a.dispose();
    b.dispose();
  });

  it('gives each world its own uniform objects, so two giants keep their own storms', () => {
    const a = shader(fictionWorldMaterial(POLYPHEMUS));
    const b = shader(fictionWorldMaterial({ ...POLYPHEMUS, seed: 7 }));
    expect(a.uniforms['uStorms']).not.toBe(b.uniforms['uStorms']);
    a.dispose();
    b.dispose();
  });

  it('writes depth on the logarithmic scale and ends as the scene does', () => {
    // Without the depth chunks a custom shader writes depth on another scale from everything
    // else in the scene (atmosphere.test.ts has the story).
    const sources = worldShaderSources(JUNGLE_MOON);
    for (const [vertex, fragment] of [
      [sources.vertex, sources.fragment],
      [RING_SHADERS.vertex, RING_SHADERS.fragment],
      [SHELL_SHADERS.vertex, SHELL_SHADERS.fragment],
      [SHELL_SHADERS.annulusVertex, SHELL_SHADERS.fragment],
    ] as const) {
      expect(vertex).toContain('#include <logdepthbuf_pars_vertex>');
      expect(vertex).toContain('#include <logdepthbuf_vertex>');
      expect(fragment).toContain('#include <logdepthbuf_pars_fragment>');
      expect(fragment).toContain('#include <logdepthbuf_fragment>');
      expect(fragment).toContain('#include <tonemapping_fragment>');
      expect(fragment).toContain('#include <colorspace_fragment>');
    }
  });

  it('bakes each layer a look declares, and reads them back', () => {
    const sources = worldShaderSources(JUNGLE_MOON);
    for (let layer = 0; layer < JUNGLE_MOON.layers; layer += 1) {
      expect(sources.bake).toContain(`vec4 bakeLayer${layer}(`);
      expect(bakeFragmentShader(sources.bake, layer)).toContain(`bakeLayer${layer}(direction, footprint)`);
      expect(sources.fragment).toContain(`uniform samplerCube uLayer${layer};`);
    }
    const material = shader(fictionWorldMaterial(PANDORA));
    expect(material.uniforms['uLayer0']!.value).toBeInstanceOf(THREE.CubeTexture);
    expect(material.uniforms['uLayer1']!.value).toBeInstanceOf(THREE.CubeTexture);
    // Drawn flat until the bake is in.
    expect(material.uniforms['uBaked']!.value).toBe(0);
    material.dispose();
  });

  it("frees the bake's maps with the material", () => {
    // A render target frees its texture through the renderer, on its own dispose.
    const freed = vi.spyOn(THREE.WebGLCubeRenderTarget.prototype, 'dispose');
    const material = shader(fictionWorldMaterial(PANDORA));
    material.dispose();
    expect(freed).toHaveBeenCalledTimes(JUNGLE_MOON.layers);
    freed.mockRestore();
  });

  it('draws the palettes without a look yet in a flat colour, on the same protocol', () => {
    const material = fictionWorldMaterial({ kind: 'world', palette: 'desert', seed: 3 });
    expect(material.userData['starDirection']).toBeInstanceOf(THREE.Vector3);
    expect(material.userData['ambient']).toEqual({ value: 0 });
    material.dispose();
  });
});

describe('createFictionWorldExtras', () => {
  it("gives an atmosphere its halo, sharing the world's star and haze", () => {
    const material = shader(fictionWorldMaterial(PANDORA));
    const extras = createFictionWorldExtras(PANDORA, material)!;
    const meshes = extras.object.children as THREE.Mesh[];
    // The annulus seen from outside the air, the shell from inside it.
    expect(meshes).toHaveLength(2);
    const top = shellRadius(material.uniforms['uScaleHeight']!.value as number);
    for (const mesh of meshes) {
      const halo = mesh.material as THREE.ShaderMaterial;
      expect(halo.uniforms['uStarDirection']).toBe(material.uniforms['uStarDirection']);
      expect(halo.uniforms['uAmbient']).toBe(material.uniforms['uAmbient']);
      expect(halo.uniforms['uScaleHeight']).toBe(material.uniforms['uScaleHeight']);
      expect(halo.uniforms['uShellRadius']!.value).toBeCloseTo(top, 9);
      if (mesh.geometry.boundingSphere === null) mesh.geometry.computeBoundingSphere();
      expect(mesh.geometry.boundingSphere!.radius).toBeCloseTo(top, 5);
    }
    extras.dispose();
    material.dispose();
  });

  it('adds rings in the equator, in radii, with the profile the world is shadowed by', () => {
    const material = shader(fictionWorldMaterial(RINGED));
    const extras = createFictionWorldExtras(RINGED, material)!;
    const meshes = extras.object.children as THREE.Mesh[];
    expect(meshes).toHaveLength(3);
    const rings = meshes[2]!;
    const ringMaterial = rings.material as THREE.ShaderMaterial;
    expect(ringMaterial.uniforms['uRingRadii']).toBe(material.uniforms['uRingRadii']);
    expect(ringMaterial.uniforms['uRingSeed']).toBe(material.uniforms['uRingSeed']);
    expect((material.uniforms['uRingRadii']!.value as THREE.Vector2).toArray()).toEqual([1.3, 2.3]);
    const position = rings.geometry.getAttribute('position');
    let smallest = Infinity;
    let largest = 0;
    for (let i = 0; i < position.count; i += 1) {
      expect(position.getY(i)).toBe(0);
      const r = Math.hypot(position.getX(i), position.getZ(i));
      smallest = Math.min(smallest, r);
      largest = Math.max(largest, r);
    }
    expect(smallest).toBeCloseTo(1.3, 5);
    expect(largest).toBeCloseTo(2.3, 5);
    extras.dispose();
    material.dispose();
  });

  it('casts no ring shadow on a world without rings', () => {
    const material = shader(fictionWorldMaterial(POLYPHEMUS));
    expect((material.uniforms['uRingRadii']!.value as THREE.Vector2).toArray()).toEqual([0, 0]);
    material.dispose();
  });

  it('is null for a palette without a look yet', () => {
    const look: World = { kind: 'world', palette: 'crystal', seed: 1 };
    const material = fictionWorldMaterial(look);
    expect(createFictionWorldExtras(look, material)).toBeNull();
    material.dispose();
  });

  it('frees everything it made', () => {
    const material = shader(fictionWorldMaterial(RINGED));
    const extras = createFictionWorldExtras(RINGED, material)!;
    const freed = vi.fn();
    for (const mesh of extras.object.children as THREE.Mesh[]) {
      mesh.geometry.addEventListener('dispose', freed);
      (mesh.material as THREE.Material).addEventListener('dispose', freed);
    }
    extras.dispose();
    expect(freed).toHaveBeenCalledTimes(6);
    material.dispose();
  });
});

describe('seeds', () => {
  it('are fixed: the same seed the same world', () => {
    expect(seedHash(2)).toBe(seedHash(2));
    expect(seedFraction(5, 3)).toBe(seedFraction(5, 3));
  });

  it('are spread: neighbouring seeds as different as distant ones', () => {
    const hashes = new Set(Array.from({ length: 1000 }, (_, i) => seedHash(i)));
    expect(hashes.size).toBe(1000);
    const fractions = Array.from({ length: 1000 }, (_, i) => seedFraction(i, 0));
    const mean = fractions.reduce((a, b) => a + b, 0) / fractions.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
    for (const f of fractions) {
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it("place a giant's storms on the sphere, the great one first", () => {
    const storms = stormPlacements(1);
    expect(storms).toHaveLength(STORM_COUNT);
    for (const storm of storms) {
      expect(Math.hypot(storm.x, storm.y, storm.z)).toBeCloseTo(1, 6);
    }
    for (const small of storms.slice(1)) expect(small.w).toBeLessThan(storms[0]!.w);
  });
});

describe('airless moons (barren, icy)', () => {
  const BARREN_MOON: World = { kind: 'world', palette: 'barren', seed: 3 };
  const ICY_MOON: World = { kind: 'world', palette: 'icy', seed: 4 };

  it('are lit on the same protocol, through no air', () => {
    for (const look of [BARREN_MOON, ICY_MOON]) {
      const material = shader(fictionWorldMaterial(look));
      expect(material.uniforms['uStarDirection']!.value).toBe(material.userData['starDirection']);
      expect(material.uniforms['uAmbient']).toBe(material.userData['ambient']);
      expect((material.uniforms['uRayleighDepth']!.value as THREE.Vector3).toArray()).toEqual([0, 0, 0]);
      expect(material.uniforms['uMieDepth']!.value).toBe(0);
      // No halo and no rings: nothing beyond the sphere.
      expect(createFictionWorldExtras(look, material)).toBeNull();
      material.dispose();
    }
  });

  it('are one program per palette, whatever the seed or tint', () => {
    for (const look of [BARREN_MOON, ICY_MOON]) {
      const a = shader(fictionWorldMaterial(look));
      const b = shader(fictionWorldMaterial({ ...look, seed: 99, tint: [0.8, 0.5, 0.3] }));
      expect(a.fragmentShader).toBe(b.fragmentShader);
      expect(a.uniforms['uRays']).not.toBe(b.uniforms['uRays']);
      a.dispose();
      b.dispose();
    }
  });

  it('bake small: one cube map of 256 a face each, in half floats', () => {
    for (const surface of [BARREN, ICY]) {
      expect(surface.layers).toBe(1);
      expect(surface.faceSize).toBe(AIRLESS_FACE_SIZE);
      expect(worldShaderSources(surface).fragment).toContain('#include <logdepthbuf_fragment>');
    }
    const material = shader(fictionWorldMaterial(BARREN_MOON));
    const texture = material.uniforms['uLayer0']!.value as THREE.CubeTexture;
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect((texture.image as { width: number }[])[0]!.width).toBe(AIRLESS_FACE_SIZE);
    expect(material.uniforms['uLayer1']).toBeUndefined();
    material.dispose();
  });

  it('give a few seeds one or two rayed craters, and the rest none', () => {
    const counts = [0, 0, 0];
    for (let seed = 0; seed < 400; seed += 1) {
      const rays = rayCraterPlacements(seed);
      expect(rays).toHaveLength(2);
      const shown = rays.filter((ray) => ray.w > 0);
      for (const ray of shown) {
        expect(Math.hypot(ray.x, ray.y, ray.z)).toBeCloseTo(1, 6);
        expect(ray.w).toBeGreaterThan(0.02);
        expect(ray.w).toBeLessThan(0.07);
      }
      counts[shown.length]! += 1;
      expect(rayCraterPlacements(seed)).toEqual(rays);
    }
    // About half none, a third one, a sixth two.
    expect(counts[0]).toBeGreaterThan(150);
    expect(counts[1]).toBeGreaterThan(90);
    expect(counts[2]).toBeGreaterThan(30);
  });
});

describe('dense-haze (Adrian)', () => {
  const ADRIAN: World = { kind: 'world', palette: 'dense-haze', seed: 3 };

  it('hazes with methane: absorption strongest in the red, and a halo past the limb', () => {
    const material = shader(fictionWorldMaterial(ADRIAN));
    const absorption = (material.uniforms['uAbsorption']!.value as THREE.Vector3).toArray();
    expect(absorption[0]).toBeGreaterThan(absorption[1]!);
    expect(absorption[1]).toBeGreaterThan(absorption[2]!);
    expect(material.uniforms['uMieDepth']!.value).toBeGreaterThan(0.1);
    const extras = createFictionWorldExtras(ADRIAN, material)!;
    expect(extras.object.children.length).toBe(2);
    extras.dispose();
    material.dispose();
  });

  it('leaves the other worlds without absorption', () => {
    const material = shader(fictionWorldMaterial(PANDORA));
    expect((material.uniforms['uAbsorption']!.value as THREE.Vector3).toArray()).toEqual([0, 0, 0]);
    material.dispose();
  });
});

describe('the Hail Mary', () => {
  const metres = 1 / HAIL_MARY_LENGTH_M;

  function parts(object: THREE.Object3D): { crew: THREE.Mesh; rear: THREE.Mesh; cables: THREE.Mesh } {
    return {
      crew: object.getObjectByName('hail-mary-crew') as THREE.Mesh,
      rear: object.getObjectByName('hail-mary-fuel-and-drives') as THREE.Mesh,
      cables: object.getObjectByName('hail-mary-cables') as THREE.Mesh,
    };
  }

  it("adds its sections up to the novel's 40 m", () => {
    const sum =
      SPIN_DRIVE_LENGTH_M + FUEL_TANK_LENGTH_M + 0.3 + SKIRT_LENGTH_M + CABLE_FARING_LENGTH_M +
      STORAGE_HEIGHT_M + DORMITORY_HEIGHT_M + LAB_HEIGHT_M + NOSE_CONE_LENGTH_M;
    expect(sum).toBeCloseTo(HAIL_MARY_LENGTH_M, 6);
    expect(CONTROL_ROOM_HEIGHT_M).toBeLessThan(NOSE_CONE_LENGTH_M);
  });

  it('is length one along +z, bow forward, its centre of mass at the origin', () => {
    const ship = createFictionObject({ kind: 'ship', design: 'hail-mary' });
    ship.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ship.object);
    expect(box.max.z - box.min.z).toBeCloseTo(1, 2);
    // The tanks hold most of the mass: the origin lies aft of the middle.
    expect(box.max.z).toBeGreaterThan(0.5);
    expect(box.min.z).toBeGreaterThan(-0.5);
    // The nose is a point on the axis, at the front.
    const { crew } = parts(ship.object);
    crew.geometry.computeBoundingBox();
    expect(crew.geometry.boundingBox!.max.z).toBeCloseTo(HAIL_MARY_LENGTH_M, 3);
    ship.dispose();
  });

  it('is three draws on one program, and one of light glows', () => {
    const ship = createHailMary();
    const { crew, rear, cables } = parts(ship.object);
    expect(crew.material).toBe(rear.material);
    expect(cables.material).toBe(rear.material);
    let meshes = 0;
    let points = 0;
    ship.object.traverse((part) => {
      if ((part as THREE.Mesh).isMesh) meshes += 1;
      if ((part as THREE.Points).isPoints) points += 1;
    });
    expect(meshes).toBe(3);
    expect(points).toBe(1);
    expect(SHIP_SHADERS.vertex).toContain('#include <logdepthbuf_vertex>');
    expect(SHIP_SHADERS.fragment).toContain('#include <logdepthbuf_fragment>');
    expect(SHIP_SHADERS.fragment).toContain('#include <tonemapping_fragment>');
    expect(ship.triangles.full).toBeLessThan(40000);
    expect(ship.triangles.low).toBeLessThan(3000);
    ship.dispose();
  });

  it('draws its silhouette model when small on screen, and the full one close', () => {
    const ship = createHailMary();
    const { crew } = parts(ship.object);
    const full = crew.geometry;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e6);
    const light = new THREE.Vector3(1, 0, 0);
    camera.position.set(0, 0, 500);
    camera.updateMatrixWorld();
    ship.object.updateMatrixWorld(true);
    ship.update(light, camera);
    expect(crew.geometry).not.toBe(full);
    camera.position.set(0, 0, 3);
    camera.updateMatrixWorld();
    ship.update(light, camera);
    expect(crew.geometry).toBe(full);
    ship.dispose();
  });

  it("splits for centrifuge mode: crew section turned round, its control room 75 m from the centre", () => {
    const ship = createHailMary();
    const { crew, cables } = parts(ship.object);
    for (const phase of [0, 1.3]) {
      ship.setMode('centrifuge', phase);
      ship.object.updateMatrixWorld(true);
      // The control room's middle, in the crew section's own metres.
      const control = new THREE.Vector3(0, 0, HAIL_MARY_LENGTH_M - NOSE_CONE_LENGTH_M + CONTROL_ROOM_HEIGHT_M / 2).applyMatrix4(crew.matrixWorld);
      expect(control.length() / metres).toBeCloseTo(CENTRIFUGE_CONTROL_ROOM_RADIUS_M, 0);
      // The nose points in, toward the centre: nearer it than the storage bay.
      const nose = new THREE.Vector3(0, 0, HAIL_MARY_LENGTH_M).applyMatrix4(crew.matrixWorld);
      const storage = new THREE.Vector3(0, 0, HAIL_MARY_LENGTH_M - NOSE_CONE_LENGTH_M - LAB_HEIGHT_M - DORMITORY_HEIGHT_M - STORAGE_HEIGHT_M).applyMatrix4(crew.matrixWorld);
      expect(nose.length()).toBeLessThan(storage.length());
      // Spinning about local y: nothing leaves the xz plane it started in.
      expect(Math.abs(control.y)).toBeLessThan(1e-9);
    }
    expect(cables.visible).toBe(true);
    ship.setMode('cruise');
    ship.object.updateMatrixWorld(true);
    expect(new THREE.Vector3().setFromMatrixPosition(crew.matrixWorld).x).toBeCloseTo(0, 9);
    ship.dispose();
  });

  it('spins for one g at a rate people adapt to', () => {
    // One g at the lab floor: a lab's height and half the control room's beyond the control room.
    const labRadius = CENTRIFUGE_CONTROL_ROOM_RADIUS_M + CONTROL_ROOM_HEIGHT_M / 2 + LAB_HEIGHT_M;
    expect(CENTRIFUGE_SPIN_RAD_S ** 2 * labRadius / 9.80665).toBeCloseTo(1, 1);
    expect(CENTRIFUGE_RPM).toBeGreaterThan(2);
    expect(CENTRIFUGE_RPM).toBeLessThan(4);
    expect(CENTRIFUGE_CABLE_LENGTH_M).toBeGreaterThan(50);
    expect(CENTRIFUGE_CABLE_LENGTH_M).toBeLessThan(100);
  });

  it('works out how much sky each vertex sees: less in the gaps between the tanks', () => {
    const ship = createHailMary();
    ship.finishOcclusion();
    const { rear } = parts(ship.object);
    const position = rear.geometry.getAttribute('position');
    const detail = rear.geometry.getAttribute('detail');
    // A point on a tank facing the spine, and one on the same tank facing out.
    let inner = 1;
    let outer = 0;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      if (z < 6 || z > 12) continue;
      const r = Math.hypot(x, y);
      if (Math.abs(r - 0.47) < 0.05) inner = Math.min(inner, detail.getX(i));
      if (Math.abs(r - 6.46) < 0.05) outer = Math.max(outer, detail.getX(i));
    }
    expect(inner).toBeLessThan(0.6);
    expect(outer).toBeGreaterThan(0.85);
    ship.dispose();
  });

  it("casts the star's shadow only when large on screen", () => {
    const ship = createHailMary();
    const material = parts(ship.object).crew.material as THREE.ShaderMaterial;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e6);
    const light = new THREE.Vector3(0, 1, 0);
    camera.position.set(0, 0, 50);
    camera.updateMatrixWorld();
    ship.object.updateMatrixWorld(true);
    ship.update(light, camera);
    expect(material.uniforms['uShadowOn']!.value).toBe(0);
    ship.dispose();
  });

  it("takes a nearby world's light on its dark side, by albedo, lit fraction and size", () => {
    // Half the sky, fully lit, albedo 0.5: half the star's light.
    expect(planetshineStrength(0.5, 1, Math.PI / 2)).toBeCloseTo(0.5, 6);
    expect(planetshineStrength(0.5, 0, Math.PI / 2)).toBe(0);
    // Far away it fades as the square of the angular size.
    expect(planetshineStrength(0.5, 1, 0.01) / planetshineStrength(0.5, 1, 0.02)).toBeCloseTo(0.25, 2);
    const ship = createHailMary();
    const material = parts(ship.object).crew.material as THREE.ShaderMaterial;
    const camera = new THREE.PerspectiveCamera();
    camera.updateMatrixWorld();
    ship.update(new THREE.Vector3(1, 0, 0), camera, { direction: new THREE.Vector3(0, -1, 0), strength: 0.2 });
    expect(material.uniforms['uFillIrradiance']!.value).toBe(0.2);
    ship.update(new THREE.Vector3(1, 0, 0), camera);
    expect(material.uniforms['uFillIrradiance']!.value).toBe(0);
    ship.dispose();
  });

  it('keeps its running lights when small, so a few pixels still show a ship', () => {
    const ship = createHailMary();
    const glows = ship.object.getObjectByName('hail-mary-lights')!;
    const camera = new THREE.PerspectiveCamera(45, 1, 0.001, 1e6);
    camera.position.set(0, 0, 500);
    camera.updateMatrixWorld();
    ship.object.updateMatrixWorld(true);
    ship.update(new THREE.Vector3(1, 0, 0), camera);
    expect(glows.visible).toBe(true);
    ship.dispose();
  });

  it('frees what it made', () => {
    const ship = createHailMary();
    const freed = vi.fn();
    const { crew } = parts(ship.object);
    (crew.material as THREE.Material).addEventListener('dispose', freed);
    crew.geometry.addEventListener('dispose', freed);
    ship.dispose();
    expect(freed).toHaveBeenCalledTimes(2);
  });
});

describe('createFictionObject', () => {
  it('still builds the stand-ins, and frees them', () => {
    for (const look of [
      { kind: 'monolith' },
      { kind: 'cylinder', lengthOverDiameter: 4 },
      { kind: 'wormhole' },
    ] as const) {
      const made = createFictionObject(look);
      expect(made.object).toBeInstanceOf(THREE.Object3D);
      made.dispose();
    }
  });
});
