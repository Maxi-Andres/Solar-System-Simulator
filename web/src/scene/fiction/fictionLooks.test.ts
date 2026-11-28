import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';

import { FICTION, FICTION_OVERLAYS } from '../../core/fiction.ts';
import type { FictionLook } from '../../core/fictionLook.ts';
import { createFictionObject, createFictionWorldExtras, fictionWorldMaterial, planetshineStrength } from './fictionLooks.ts';
import { AIRLESS_FACE_SIZE, BARREN, ICY } from './looks/airless.ts';
import { SHELL_SHADERS, shellRadius } from './looks/atmosphereShell.ts';
import { rayCraterPlacements } from './looks/craters.ts';
import {
  CENTRIFUGE_CABLE_LENGTH_M,
  CENTRIFUGE_CONTROL_ROOM_RADIUS_M,
  CENTRIFUGE_RPM,
  CENTRIFUGE_SPIN_RAD_S,
  CONTROL_ROOM_Z_M,
  CREW_AFT_Z_M,
  CRUISE_CENTRE_OF_MASS_Z_M,
  FINISHES,
  HAIL_MARY_LENGTH_M,
  HAIL_MARY_MODEL,
  type HailMary,
  createHailMary,
} from './looks/hailMary.ts';
import { SHIP_SHADERS } from './looks/shipMaterial.ts';
import { type Manifest, prebakedFiles } from './looks/prebakedSurfaces.ts';
import { AMMONIA_HAZE, AMMONIA_HAZE_AIR } from './looks/ammoniaHaze.ts';
import { ARID, ARID_AIR } from './looks/arid.ts';
import { AFT_REACH_M, BLIP_A_CENTRE_OF_MASS_Z_M, BLIP_A_LENGTH_M, FORE_REACH_M, createBlipA } from './looks/blipA.ts';
import { DENSE_HAZE_AIR } from './looks/denseHaze.ts';
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

  it('counts only the air ahead of a camera inside it', () => {
    // The whole line's column counted the air behind the camera too: from the top of Adrian's
    // air the sky straight up was as opaque as the limb, in two green bands either side.
    for (const vertex of [SHELL_SHADERS.vertex, SHELL_SHADERS.annulusVertex]) {
      expect(vertex).toContain('vCamera = ');
    }
    expect(SHELL_SHADERS.fragment).toContain('varying vec3 vCamera;');
    expect(SHELL_SHADERS.fragment).toContain('chapman(mu)');
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

  it('hazes green: methane takes the red, an organic haze the blue, and a halo past the limb', () => {
    const material = shader(fictionWorldMaterial(ADRIAN));
    const absorption = (material.uniforms['uAbsorption']!.value as THREE.Vector3).toArray();
    expect(absorption[0]).toBeGreaterThan(10 * absorption[1]!);
    expect(absorption[2]).toBeGreaterThan(10 * absorption[1]!);
    expect(material.uniforms['uMieDepth']!.value).toBeGreaterThan(0);
    // Scattering most in the green: the limb's colour.
    const scattering = (material.uniforms['uRayleighDepth']!.value as THREE.Vector3).toArray();
    expect(scattering[1]).toBeGreaterThan(Math.max(scattering[0]!, scattering[2]!));
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

  /** A stand-in for the model file, laid out as it is: the ship, the column, the lines. */
  function standIn(): Promise<THREE.Object3D> {
    const scene = new THREE.Group();
    const part = (name: string, z0: number, z1: number, width: number, material: string, occlusion = 0.5): void => {
      const geometry = new THREE.BoxGeometry(width, width, z1 - z0).translate(0, 0, (z0 + z1) / 2);
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 4).fill(occlusion), 4));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ name: material }));
      mesh.name = name;
      scene.add(mesh);
    };
    for (const suffix of ['', '_LOW']) {
      part(`Main_Ship${suffix}`, 0, 34, 11, 'mat_0');
      part(`Habitat${suffix}`, CREW_AFT_Z_M, HAIL_MARY_LENGTH_M, 3, 'mat_15', 0.8);
      part(`Main_Habitat_Lines${suffix}`, 12, 26, 0.4, 'mat_3');
    }
    return Promise.resolve(scene);
  }

  async function loadedShip(): Promise<HailMary> {
    const ship = createHailMary(standIn);
    ship.update(new THREE.Vector3(1, 0, 0), camera(3));
    await ship.loaded;
    return ship;
  }

  function camera(distance: number): THREE.PerspectiveCamera {
    const c = new THREE.PerspectiveCamera(45, 1, 0.001, 1e6);
    c.position.set(0, 0, distance);
    c.updateMatrixWorld();
    return c;
  }

  it('maps every material of the model file to one of our finishes', () => {
    const inFile = ['mat_0', 'mat_10', 'mat_3', 'mat_14', 'mat_4', 'mat_2', 'mat_9', 'mat_19', 'mat_18', 'mat_21', 'mat_5', 'mat_15', 'mat_13', 'mat_20', 'mat_17', 'mat_1', 'mat_7'];
    for (const name of inFile) expect(FINISHES[name], name).toBeDefined();
    // White paint is paint, not metal: "es blanco, no plateado".
    expect(FINISHES['mat_0']!.metal).toBe(0);
  });

  it('is length one along +z, bow forward, its centre of mass at the origin', async () => {
    const ship = await loadedShip();
    ship.object.updateMatrixWorld(true);
    const { crew, rear } = parts(ship.object);
    const box = new THREE.Box3().setFromObject(crew).union(new THREE.Box3().setFromObject(rear));
    expect(box.max.z - box.min.z).toBeCloseTo(1, 3);
    expect(box.max.z).toBeGreaterThan(0.5);
    expect(box.min.z).toBeGreaterThan(-0.5);
    expect(box.max.z).toBeCloseTo((HAIL_MARY_LENGTH_M - CRUISE_CENTRE_OF_MASS_Z_M) * metres, 3);
    ship.dispose();
  });

  it("carries the model's occlusion and finishes into our shader's attributes", async () => {
    const ship = await loadedShip();
    const { crew } = parts(ship.object);
    const detail = crew.geometry.getAttribute('detail');
    // Eight bits: the occlusion to 1/255, the finish an index into the material's table.
    expect(detail.getX(0)).toBeCloseTo(0.8, 2);
    const finish = Math.round(detail.getY(0) * 255);
    const table = (crew.material as THREE.ShaderMaterial).uniforms['uSurface']!.value as THREE.Vector3[];
    expect(table[finish]!.toArray()).toEqual([...FINISHES['mat_15']!.color].map((c) => expect.closeTo(c, 5)));
    expect(Math.round(detail.getZ(0) * 255)).toBe(1);
    // The model's own normals, kept: the box's first face looks along +x.
    const normal = crew.geometry.getAttribute('normal');
    expect([normal.getX(0), normal.getY(0), normal.getZ(0)]).toEqual([expect.closeTo(1, 4), expect.closeTo(0, 4), expect.closeTo(0, 4)]);
    ship.dispose();
  });

  it('is three draws on one program, and one of light glows', async () => {
    const ship = await loadedShip();
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
    ship.dispose();
  });

  it('shows only its running lights until the model is in', () => {
    const ship = createHailMary(() => new Promise(() => {}));
    const { crew } = parts(ship.object);
    expect(crew.geometry.getAttribute('position')).toBeUndefined();
    expect(ship.object.getObjectByName('hail-mary-lights')!.visible).toBe(true);
    ship.dispose();
  });

  it('draws its silhouette model when small on screen, and the full one close', async () => {
    const ship = await loadedShip();
    const { crew } = parts(ship.object);
    const full = crew.geometry;
    const light = new THREE.Vector3(1, 0, 0);
    ship.object.updateMatrixWorld(true);
    ship.update(light, camera(500));
    expect(crew.geometry).not.toBe(full);
    expect(ship.object.getObjectByName('hail-mary-lights')!.visible).toBe(true);
    ship.update(light, camera(3));
    expect(crew.geometry).toBe(full);
    ship.dispose();
  });

  it('casts the star’s shadow only when large on screen', async () => {
    const ship = await loadedShip();
    const material = parts(ship.object).crew.material as THREE.ShaderMaterial;
    ship.object.updateMatrixWorld(true);
    ship.update(new THREE.Vector3(0, 1, 0), camera(50));
    expect(material.uniforms['uShadowOn']!.value).toBe(0);
    ship.dispose();
  });

  it('splits for centrifuge mode: the habitat column turned round, its control room 75 m from the centre', async () => {
    const ship = await loadedShip();
    const { crew, cables } = parts(ship.object);
    const stowed = cables.geometry;
    for (const phase of [0, 1.3]) {
      ship.setMode('centrifuge', phase);
      ship.object.updateMatrixWorld(true);
      const control = new THREE.Vector3(0, 0, CONTROL_ROOM_Z_M).applyMatrix4(crew.matrixWorld);
      expect(control.length() / metres).toBeCloseTo(CENTRIFUGE_CONTROL_ROOM_RADIUS_M, 0);
      // The bow points in, toward the centre: nearer it than the column's aft end.
      const nose = new THREE.Vector3(0, 0, HAIL_MARY_LENGTH_M).applyMatrix4(crew.matrixWorld);
      const aft = new THREE.Vector3(0, 0, CREW_AFT_Z_M).applyMatrix4(crew.matrixWorld);
      expect(nose.length()).toBeLessThan(aft.length());
      expect(Math.abs(control.y)).toBeLessThan(1e-9);
    }
    // The model's stowed lines give way to the five cables.
    expect(cables.geometry).not.toBe(stowed);
    ship.setMode('cruise');
    ship.object.updateMatrixWorld(true);
    expect(cables.geometry).toBe(stowed);
    ship.dispose();
  });

  it('spins for one g at the control room at a rate people adapt to', () => {
    expect((CENTRIFUGE_SPIN_RAD_S ** 2 * CENTRIFUGE_CONTROL_ROOM_RADIUS_M) / 9.80665).toBeCloseTo(1, 6);
    expect(CENTRIFUGE_RPM).toBeGreaterThan(2);
    expect(CENTRIFUGE_RPM).toBeLessThan(4);
    expect(CENTRIFUGE_CABLE_LENGTH_M).toBeGreaterThan(50);
    expect(CENTRIFUGE_CABLE_LENGTH_M).toBeLessThan(110);
  });

  it("takes a nearby world's light on its dark side, by albedo, lit fraction and size", async () => {
    expect(planetshineStrength(0.5, 1, Math.PI / 2)).toBeCloseTo(0.5, 6);
    expect(planetshineStrength(0.5, 0, Math.PI / 2)).toBe(0);
    expect(planetshineStrength(0.5, 1, 0.01) / planetshineStrength(0.5, 1, 0.02)).toBeCloseTo(0.25, 2);
    const ship = await loadedShip();
    const material = parts(ship.object).crew.material as THREE.ShaderMaterial;
    const c = camera(3);
    ship.update(new THREE.Vector3(1, 0, 0), c, { direction: new THREE.Vector3(0, -1, 0), strength: 0.2 });
    expect(material.uniforms['uFillIrradiance']!.value).toBe(0.2);
    ship.update(new THREE.Vector3(1, 0, 0), c);
    expect(material.uniforms['uFillIrradiance']!.value).toBe(0);
    ship.dispose();
  });

  it('ships the model compressed, simplified, and laid out as the code expects', async () => {
    const file = await readFile(join(import.meta.dirname, '../../../public/models', HAIL_MARY_MODEL));
    // 2026-11-27 (Maxi: simplified too far): 3 mm error, not 1.5 cm.
    expect(file.byteLength).toBeLessThan(3.5e6);
    // The GLB's JSON chunk: nodes, meshes, accessors -- no need to decode the buffers for these.
    const jsonLength = file.readUInt32LE(12);
    const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString('utf8')) as {
      nodes: { name: string; mesh?: number }[];
      meshes: { primitives: { indices: number }[] }[];
      accessors: { count: number }[];
      extensionsUsed?: string[];
    };
    expect(gltf.extensionsUsed).toContain('EXT_meshopt_compression');
    const trianglesOf = (name: string): number => {
      const node = gltf.nodes.find((n) => n.name === name)!;
      return gltf.meshes[node.mesh!]!.primitives.reduce((sum, p) => sum + gltf.accessors[p.indices]!.count / 3, 0);
    };
    const full = ['Main Ship', 'Habitat', 'Main Habitat Lines'].reduce((sum, n) => sum + trianglesOf(n), 0);
    const low = ['Main Ship LOW', 'Habitat LOW', 'Main Habitat Lines LOW'].reduce((sum, n) => sum + trianglesOf(n), 0);
    expect(full).toBeGreaterThan(250000);
    expect(full).toBeLessThan(350000);
    expect(low).toBeLessThan(20000);
  });

  it('frees what it made', async () => {
    const ship = await loadedShip();
    const freed = vi.fn();
    const { crew } = parts(ship.object);
    (crew.material as THREE.Material).addEventListener('dispose', freed);
    crew.geometry.addEventListener('dispose', freed);
    ship.dispose();
    expect(freed).toHaveBeenCalledTimes(2);
  });
});

describe('ammonia-haze (Erid) and arid (Vulcan)', () => {
  const ERID: World = { kind: 'world', palette: 'ammonia-haze', seed: 4 };
  const VULCAN: World = { kind: 'world', palette: 'arid', seed: 5 };

  it("draws Erid as a haze deck, its haze yellowed by blue absorbed, its limb wider than Adrian's", () => {
    const material = shader(fictionWorldMaterial(ERID));
    expect(material.fragmentShader).toContain('layer0');
    const absorption = AMMONIA_HAZE_AIR.absorption!;
    expect(absorption[2]).toBeGreaterThan(absorption[1]);
    expect(absorption[1]).toBeGreaterThan(absorption[0]);
    expect(AMMONIA_HAZE_AIR.mie).toBeGreaterThan(DENSE_HAZE_AIR.mie);
    // Ammonia (17 g/mol) at 480 K against carbon dioxide (44) on Adrian: twice the scale height
    // in proportion, for all of Erid's 2.09 g.
    expect(AMMONIA_HAZE_AIR.scaleHeight / DENSE_HAZE_AIR.scaleHeight).toBeCloseTo(2, 1);
    expect(AMMONIA_HAZE.faceSize).toBe(512);
    material.dispose();
  });

  it('draws Vulcan with relief in half floats under thin, dusty air', () => {
    const material = shader(fictionWorldMaterial(VULCAN));
    expect(material.fragmentShader).toContain('reliefAt');
    expect(ARID.halfFloat).toBe(true);
    expect(ARID_AIR.scaleHeight).toBeLessThan(DENSE_HAZE_AIR.scaleHeight / 2);
    expect(ARID_AIR.absorption![2]).toBeGreaterThan(ARID_AIR.absorption![0]);
    material.dispose();
  });
});

describe('the Blip-A', () => {
  function camera(distance: number): THREE.PerspectiveCamera {
    const c = new THREE.PerspectiveCamera(45, 1, 0.001, 1e6);
    c.position.set(0, distance, 0);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    return c;
  }

  it("is length one along +z, the needles' axis, its centre of mass at the origin", () => {
    const ship = createBlipA();
    ship.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(ship.object);
    expect(box.max.z - box.min.z).toBeCloseTo(1, 1);
    expect(box.max.z).toBeCloseTo((FORE_REACH_M - BLIP_A_CENTRE_OF_MASS_Z_M) / BLIP_A_LENGTH_M, 1);
    expect(AFT_REACH_M + FORE_REACH_M).toBe(BLIP_A_LENGTH_M);
    // Ten Hail Marys: the film's stills, against its 40 m.
    expect(BLIP_A_LENGTH_M).toBe(400);
    // Two spindles side by side: wide across, thin through.
    expect(box.max.x - box.min.x).toBeGreaterThan(1.5 * (box.max.y - box.min.y));
    // Symmetric across the plane between the spindles.
    expect(box.max.x).toBeCloseTo(-box.min.x, 3);
    ship.dispose();
  });

  it('draws its rods instanced on the ship shader, and carries no running lights', () => {
    const ship = createBlipA();
    let instancedMeshes = 0;
    let points = 0;
    const programs = new Set<THREE.Material>();
    ship.object.traverse((part) => {
      if ((part as THREE.InstancedMesh).isInstancedMesh) instancedMeshes += 1;
      if ((part as THREE.Points).isPoints) points += 1;
      if ((part as THREE.Mesh).isMesh) programs.add((part as THREE.Mesh).material as THREE.Material);
    });
    expect(instancedMeshes).toBe(2);
    expect(points).toBe(0);
    // The ship's material, and its variant for the rods, on the very same uniforms.
    expect(programs.size).toBe(2);
    const [first, second] = [...programs] as THREE.ShaderMaterial[];
    expect(first!.uniforms).toBe(second!.uniforms);
    expect(SHIP_SHADERS.vertex).toContain('USE_INSTANCING');
    ship.dispose();
  });

  it('keeps to its budget, and thins out with distance: every needle near, fewer and thicker further, a few shapes small', () => {
    const ship = createBlipA();
    // Two triangles a rod: the thin, long triangles are what costs.
    expect(ship.triangles.full).toBeLessThan(20000);
    expect(ship.triangles.mid).toBeLessThan(ship.triangles.full);
    expect(ship.triangles.low).toBeLessThan(100);
    const needles = ship.object.getObjectByName('blip-a-rods')!;
    const middle = ship.object.getObjectByName('blip-a-rods-mid')!;
    const core = ship.object.getObjectByName('blip-a-core') as THREE.Mesh;
    const coreFull = core.geometry;
    ship.object.updateMatrixWorld(true);
    ship.update(new THREE.Vector3(1, 0, 0), camera(1));
    expect(needles.visible).toBe(true);
    ship.update(new THREE.Vector3(1, 0, 0), camera(6));
    expect([needles.visible, middle.visible]).toEqual([false, true]);
    ship.update(new THREE.Vector3(1, 0, 0), camera(500));
    expect([needles.visible, middle.visible]).toEqual([false, false]);
    expect(core.geometry).not.toBe(coreFull);
    ship.dispose();
  });

  it('takes planetshine and the lighting mode', () => {
    const ship = createBlipA();
    const material = (ship.object.getObjectByName('blip-a-core') as THREE.Mesh).material as THREE.ShaderMaterial;
    ship.update(new THREE.Vector3(1, 0, 0), camera(2), { direction: new THREE.Vector3(0, -1, 0), strength: 0.3 }, { sun: 0.4, ambient: 1.5 });
    expect(material.uniforms['uFillIrradiance']!.value).toBe(0.3);
    expect(material.uniforms['uAmbient']!.value).toBe(1.5);
    ship.dispose();
  });

  it('is what createFictionObject builds for its design', () => {
    const made = createFictionObject({ kind: 'ship', design: 'blip-a' });
    expect(made.object.name).toBe('blip-a');
    made.dispose();
  });
});

describe('the ships, for framing and drawing', () => {
  it('have finite, non-empty bounds -- every part, instanced ones over all their copies -- and draw from any distance', async () => {
    for (const design of ['hail-mary', 'blip-a'] as const) {
      const ship = createFictionObject({ kind: 'ship', design });
      const camera = new THREE.PerspectiveCamera(45, 1, 1e-6, 1e9);
      // From far, near, and from the very centre: no division by a zero distance, no NaN placed.
      for (const at of [new THREE.Vector3(0, 0, 50), new THREE.Vector3(0.3, 0.2, 0.4), new THREE.Vector3(0, 0, 0)]) {
        camera.position.copy(at);
        camera.updateMatrixWorld();
        ship.update?.(new THREE.Vector3(1, 0.3, 0.2).normalize(), camera);
      }
      if ('loaded' in ship) await (ship as { loaded: Promise<void> }).loaded;
      ship.object.updateMatrixWorld(true);
      ship.object.traverse((part) => {
        expect(part.matrixWorld.elements.every(Number.isFinite), `${design} ${part.name}`).toBe(true);
        const instanced = part as THREE.InstancedMesh;
        if (instanced.isInstancedMesh) {
          instanced.computeBoundingSphere();
          expect(Number.isFinite(instanced.boundingSphere!.radius) && instanced.boundingSphere!.radius > 0, part.name).toBe(true);
        }
      });
      const box = new THREE.Box3().setFromObject(ship.object);
      if (design === 'blip-a') {
        expect([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite)).toBe(true);
        expect(box.max.z - box.min.z).toBeGreaterThan(0.9);
      }
      ship.dispose();
    }
  });
});

describe('the worlds baked ahead into images', () => {
  it('has images for every world the app draws with a look, made from that look as it is now', async () => {
    const folder = join(import.meta.dirname, '../../../public/textures/fiction');
    const manifest = JSON.parse(await readFile(join(folder, 'manifest.json'), 'utf8')) as Manifest;
    let worlds = 0;
    for (const record of [...FICTION, ...FICTION_OVERLAYS]) {
      if (record.look.kind !== 'world') continue;
      const material = shader(fictionWorldMaterial(record.look));
      const key = material.userData['surfaceKey'] as string | undefined;
      material.dispose();
      // A palette not drawn yet has no bake, and no images to need.
      if (key === undefined) continue;
      worlds += 1;
      const entry = manifest.worlds[record.id];
      // Re-run web/scripts/bakeFictionSurfaces.mjs after changing a look.
      expect(entry?.key, `${record.id}: its images are missing or were made from an older look`).toBe(key);
      entry!.layers.forEach((layer, i) => {
        expect(existsSync(join(folder, record.id, prebakedFiles.preview(i))), `${record.id} preview ${i}`).toBe(true);
        for (let face = 0; face < 6; face += 1) {
          expect(existsSync(join(folder, record.id, prebakedFiles.colour(i, face))), `${record.id} ${i}/${face}`).toBe(true);
          if (layer.alpha !== 'none') expect(existsSync(join(folder, record.id, prebakedFiles.alpha(i, face))), `${record.id} ${i}/${face} alpha`).toBe(true);
        }
      });
    }
    expect(worlds).toBeGreaterThanOrEqual(20);
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
