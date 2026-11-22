import * as THREE from 'three';

import { MARKING, type Planetshine, type ShipFinish } from './shipMaterial.ts';
import { LOW_DETAIL_BELOW, ShipBuilder, createShipRig } from './shipRig.ts';

/**
 * The Blip-A, Rocky's ship (Andy Weir, *Project Hail Mary*, 2021): configuration after the 2026
 * film, every detail our own (canon notes, section 4b).
 *
 * **What the film shows**, as a general idea only: not a hull but a vast spindle of needles. A
 * dense, dark core of jagged, angular structure, a row of sawtooth peaks along its top; from it,
 * thousands of long, thin, straight rods stream out both ways, parallel, of every length, in a
 * flattened fan -- tall across, thin through -- with clumps and gaps, and blocky clusters among
 * them. Dark bronze and gold, metal, glinting along the rods where the star catches them. The
 * Hail Mary, docked against it, is a small craft beside it.
 *
 * **What stays from the novel:** flat faces everywhere -- "Even the 'rods' have flat faces" --
 * the sawtooth peaks as its "gable-like protrusions", xenonite throughout. No running
 * lights: Eridians have no eyes.
 *
 * **Axes.** +z runs along the needles, toward the shorter fan; y across the fan, x through it.
 *
 * **How it is drawn.** The core is one merged mesh of a couple of hundred flat-faced blocks. The
 * needles are instanced, placed from a fixed seed: one draw for the rods, one for
 * the clusters. Each copy carries in its instance colour how deep in the bundle it sits (its
 * occlusion) and a tone, and its metal is brushed along its length, so the highlight runs down
 * the rod. Three levels of detail: 2,400 needles near; 600 thicker ones in the middle distance,
 * where thinner ones would be under a pixel and shimmer; and, small on screen, a few flat
 * diamonds for the two fans and a block for the core.
 */

// --- Dimensions --------------------------------------------------------------------------------

/**
 * Tip to tip along the needles. Scaled from the 2026 film's stills against the Hail Mary's 40 m:
 * with the Hail Mary docked beside it, the Blip-A spans about eight Hail Marys -- more, since the
 * Hail Mary is the nearer -- so ten.
 */
export const BLIP_A_LENGTH_M = 400;

/** How far the needles reach on each side of the core's centre: the aft fan the longer, as in the stills. */
export const FORE_REACH_M = 170;
export const AFT_REACH_M = BLIP_A_LENGTH_M - FORE_REACH_M;

/** The fan beside the core: its height across (y) and its thickness through (x). Scaled from the stills. */
export const FAN_HEIGHT_M = 84;
export const FAN_THICKNESS_M = 26;

/** The core: half-extents of the block cloud. The novel's "diamond", "about the size of my ship", grown to the film's mass. */
const CORE_HALF = new THREE.Vector3(20, 34, 30);

/** The sawtooth peaks on the core's top: count, base, height. */
const PEAKS = 5;
const PEAK_BASE_M = 13;
const PEAK_HEIGHT_M = 18;

/** Needles at each level of detail, and their widths. */
const NEEDLES_FULL = 2400;
const NEEDLES_MID = 600;
const CLUSTERS_FULL = 140;
const CLUSTERS_MID = 40;

/** Above this share of the view's half-height every needle is drawn; below it, the middle level. */
const FULL_DETAIL_ABOVE = 0.6;

/** Widest extent against length, for how much of the view it fills: its length. */
const SPAN = 1;

// --- Finishes ----------------------------------------------------------------------------------

/** The core: dark xenonite, bronze-brown as the film's, a little metallic. */
const CORE: ShipFinish = { color: [0.16, 0.105, 0.055], metal: 0.7, rough: 0.4 };
/** The needles: bronze-gold metal brushed along each rod. */
const NEEDLE: ShipFinish = { color: [0.6, 0.4, 0.17], metal: 0.9, rough: 0.34, aniso: 0.8, pattern: MARKING.needle };
/** The clusters among them: darker bronze. */
const CLUSTER: ShipFinish = { color: [0.36, 0.24, 0.12], metal: 0.8, rough: 0.42 };

const FINISHES: readonly ShipFinish[] = [CORE, NEEDLE, CLUSTER];
const FINISH = { core: 0, needle: 1, cluster: 2 } as const;

// --- Placement ---------------------------------------------------------------------------------

/** A small seeded generator (mulberry32): the same ship every time. */
function generator(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

/** One-dimensional value noise, for the fan's clumps and gaps across its height. */
function clumps(y: number, salt: number): number {
  const hash = (n: number): number => {
    const s = Math.sin(n * 127.1 + salt * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(y);
  const f = y - i;
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

/** A needle: centre, length, width, turn about its axis, how much sky it sees, its tone. */
interface Needle {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly length: number;
  readonly width: number;
  readonly turn: number;
  readonly sky: number;
  readonly tone: number;
}

/** The needles, from the core outward on both sides; long ones near the mid-plane, so the fans taper. */
function needles(count: number, widthScale: number, seed: number): Needle[] {
  const random = generator(seed);
  const result: Needle[] = [];
  let guard = 0;
  while (result.length < count && guard < count * 20) {
    guard += 1;
    const side = random() < 0.56 ? -1 : 1;
    const reach = side < 0 ? AFT_REACH_M : FORE_REACH_M;
    // Lengths of every size, more short than long.
    let reachShare = 0.12 + 0.88 * Math.pow(random(), 0.75);
    // Where a needle sits across the fan sets how long it may be -- long near the mid-plane, so
    // the fan tapers -- but loosely: one in six strays, and the fan's layers reach out by
    // different amounts, so the outline is ragged, not an ellipse.
    const profileShare = random() < 0.16 ? reachShare * random() : reachShare;
    const halfHeight = (FAN_HEIGHT_M / 2) * Math.pow(1 - Math.pow(profileShare, 1.6), 0.55) + 2;
    const halfThickness = (FAN_THICKNESS_M / 2) * Math.pow(1 - profileShare, 0.7) + 1;
    const across = 2 * random() - 1;
    // Clumps and gaps across the fan's height: a needle where the noise is low is thrown back.
    if (random() > smoothstep(0.3, 0.75, clumps(across * 6 + reachShare * 1.5, side))) continue;
    reachShare = Math.min(1, reachShare * (0.55 + 0.6 * clumps(across * halfHeight * 0.35 + 20, side + 3)));
    // Through the fan's thickness most sit in its outer layers: inside, a rod is hidden by the
    // rods around it and only costs fill -- thousands of rods overlap many deep.
    const shell = random() < 0.75;
    const through = shell ? (random() < 0.5 ? -1 : 1) * (0.6 + 0.4 * random()) : (2 * random() - 1) * 0.6;
    const start = side * CORE_HALF.z * 0.7 * random();
    const end = side * reach * reachShare;
    const width = widthScale * (0.1 + 0.8 * Math.pow(random(), 4));
    const depth = Math.max(Math.abs(across), Math.abs(through));
    result.push({
      x: through * halfThickness,
      y: across * halfHeight,
      z: (start + end) / 2,
      length: Math.abs(end - start),
      width,
      turn: random() * Math.PI,
      sky: 0.35 + 0.65 * depth,
      tone: 0.35 + 1.0 * Math.pow(random(), 1.5),
    });
  }
  return result;
}

/** Blocks among the needles, on the fans, near the core more than far. */
function clusters(count: number, seed: number): Needle[] {
  const random = generator(seed);
  return Array.from({ length: count }, () => {
    const side = random() < 0.56 ? -1 : 1;
    const reach = (side < 0 ? AFT_REACH_M : FORE_REACH_M) * Math.pow(random(), 1.6) * 0.7;
    const share = reach / (side < 0 ? AFT_REACH_M : FORE_REACH_M);
    const size = 1 + 4 * Math.pow(random(), 2.5);
    return {
      x: (2 * random() - 1) * (FAN_THICKNESS_M / 2) * (1 - share),
      y: (2 * random() - 1) * (FAN_HEIGHT_M / 2) * (1 - share * 0.8),
      z: side * (CORE_HALF.z * 0.8 + reach),
      length: size * (1 + 2 * random()),
      width: size,
      turn: random() * Math.PI,
      sky: 0.5 + 0.4 * random(),
      tone: 0.7 + 0.5 * random(),
    };
  });
}

/**
 * A rod's ribbon: one quad, across x from -0.5 to 0.5, along z. Two triangles a rod: thin, long
 * triangles are what the rasteriser pays for here, more than the shading -- measured, a rod
 * drawn black cost as much as a lit one.
 */
function ribbonGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, -0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, 0.5, 0, 0.5], 3));
  geometry.setIndex([0, 1, 3, 0, 3, 2]);
  return geometry;
}

/**
 * One instanced draw of `parts`, each a unit shape placed, sized and turned, its sky and tone in
 * its colour: rods as ribbons (`ribbon`), blocks as boxes.
 */
function instanced(parts: readonly Needle[], finish: number, name: string, ribbon: boolean): THREE.InstancedMesh {
  const builder = new ShipBuilder(0);
  builder.add(ribbon ? ribbonGeometry() : new THREE.BoxGeometry(1, 1, 1), new THREE.Matrix4(), finish, 1);
  const geometry = builder.build();
  const mesh = new THREE.InstancedMesh(geometry, undefined, parts.length);
  mesh.name = name;
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const colour = new THREE.Color();
  parts.forEach((part, i) => {
    rotation.setFromAxisAngle(new THREE.Vector3(0, 0, 1), part.turn);
    matrix.compose(position.set(part.x, part.y, part.z), rotation, scale.set(part.width, part.width, part.length));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, colour.setRGB(part.sky, part.tone, 0, THREE.LinearSRGBColorSpace));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

/** The core: a cloud of flat-faced blocks, the peaks on its top. */
function coreGeometry(seed: number): THREE.BufferGeometry {
  const random = generator(seed);
  const builder = new ShipBuilder(0);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  for (let i = 0; i < 220; i += 1) {
    // Inside an ellipsoid, denser toward the middle.
    let x = 0;
    let y = 0;
    let z = 0;
    do {
      x = 2 * random() - 1;
      y = 2 * random() - 1;
      z = 2 * random() - 1;
    } while (x * x + y * y + z * z > 1);
    const pull = 0.55 + 0.45 * random();
    at.set(x * CORE_HALF.x * pull, y * CORE_HALF.y * pull, z * CORE_HALF.z * pull);
    const big = random() < 0.12;
    const edge = big ? 10 + 14 * random() : 2 + 8 * Math.pow(random(), 1.5);
    size.set(edge * (0.4 + random()), edge * (0.4 + random()), edge * (0.5 + 1.5 * random()));
    // Mostly squared to the ship's axes, some knocked askew: fractured, not random rubble.
    const askew = random() < 0.35 ? 0.6 : 0.08;
    rotation.setFromEuler(euler.set((random() - 0.5) * askew, (random() - 0.5) * askew, (random() - 0.5) * askew * 2));
    const shape = random() < 0.2 ? new THREE.OctahedronGeometry(0.6, 0) : random() < 0.15 ? new THREE.TetrahedronGeometry(0.7, 0) : new THREE.BoxGeometry(1, 1, 1);
    builder.add(shape, matrix.compose(at, rotation, size), FINISH.core, 0.6 + 0.35 * Math.hypot(x, y, z));
  }
  // The peaks: triangular prisms along the top, ridges across the ship.
  for (let i = 0; i < PEAKS; i += 1) {
    const z = (i - (PEAKS - 1) / 2) * PEAK_BASE_M * 1.05 + 4;
    const radius = PEAK_BASE_M / Math.sqrt(3);
    const prism = new THREE.CylinderGeometry(radius, radius, 10 + 6 * random(), 3, 1).rotateZ(Math.PI / 2).rotateX(-Math.PI / 2);
    // Three's three-sided cylinder has a corner at local +z; turned, at +y: the peak's tip.
    const tip = PEAK_HEIGHT_M * (0.8 + 0.4 * random());
    builder.add(prism, matrix.compose(at.set(0, CORE_HALF.y * 0.82 + tip * 0.35, z), rotation.identity(), size.set(1, tip / (1.5 * radius), 1)), FINISH.core, 0.9);
  }
  return builder.build();
}

/** Small on screen: a flat diamond for each fan, a block for the core. */
function silhouetteGeometry(): THREE.BufferGeometry {
  const builder = new ShipBuilder(0);
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  for (const [reach, side] of [
    [AFT_REACH_M, -1],
    [FORE_REACH_M, 1],
  ] as const) {
    builder.add(
      new THREE.OctahedronGeometry(0.5, 0),
      matrix.compose(new THREE.Vector3(0, 0, (side * reach) / 2), rotation, new THREE.Vector3(FAN_THICKNESS_M * 0.5, FAN_HEIGHT_M * 0.8, reach)),
      FINISH.needle,
      0.6,
    );
  }
  builder.add(new THREE.BoxGeometry(1, 1, 1), matrix.compose(new THREE.Vector3(0, 0, 0), rotation, CORE_HALF.clone().multiplyScalar(1.6)), FINISH.core, 0.8);
  return builder.build();
}

/**
 * The centre of mass, from the core's centre along z: the core taken as heavy as all the needles
 * together, each needle's mass by its volume.
 */
function centreOfMass(parts: readonly Needle[]): number {
  let mass = 0;
  let moment = 0;
  for (const part of parts) {
    const m = part.width * part.width * part.length;
    mass += m;
    moment += m * part.z;
  }
  return moment / (2 * mass);
}

const SEED = 40;
const FULL_NEEDLES = needles(NEEDLES_FULL, 1, SEED);

/** The centre of mass, metres from the core's centre along +z (negative: toward the longer aft fan). */
export const BLIP_A_CENTRE_OF_MASS_Z_M = centreOfMass(FULL_NEEDLES);

// --- The object --------------------------------------------------------------------------------

export interface BlipA {
  readonly object: THREE.Object3D;
  /** Each frame it is drawn: the star's direction, the camera, planetshine, the lighting mode. */
  update(
    lightDirection: THREE.Vector3,
    camera: THREE.Camera,
    planetshine?: Planetshine,
    lighting?: { readonly sun: number; readonly ambient: number },
  ): void;
  /** Triangles drawn at each detail. */
  readonly triangles: { readonly full: number; readonly mid: number; readonly low: number };
  dispose(): void;
}

export function createBlipA(): BlipA {
  const rig = createShipRig({
    name: 'blip-a',
    sectionNames: ['blip-a-core'],
    lightsName: 'blip-a-lights',
    lights: [],
    lengthM: BLIP_A_LENGTH_M,
    finishes: FINISHES,
  });
  const core = rig.sections[0]!;
  const coreFull = coreGeometry(SEED + 1);
  const silhouette = silhouetteGeometry();
  core.geometry = coreFull;

  const needlesFull = instanced(FULL_NEEDLES, FINISH.needle, 'blip-a-needles', true);
  const needlesMid = instanced(needles(NEEDLES_MID, 2.6, SEED + 2), FINISH.needle, 'blip-a-needles-mid', true);
  const clustersFull = instanced(clusters(CLUSTERS_FULL, SEED + 3), FINISH.cluster, 'blip-a-clusters', false);
  const clustersMid = instanced(clusters(CLUSTERS_MID, SEED + 4), FINISH.cluster, 'blip-a-clusters-mid', false);
  const parts = [needlesFull, needlesMid, clustersFull, clustersMid];
  rig.addPart(needlesFull, { NEEDLE_RIBBON: '' });
  rig.addPart(needlesMid, { NEEDLE_RIBBON: '' });
  rig.addPart(clustersFull);
  rig.addPart(clustersMid);

  const trianglesOf = (geometry: THREE.BufferGeometry, copies = 1): number => ((geometry.index?.count ?? 0) / 3) * copies;
  const triangles = {
    full: trianglesOf(coreFull) + trianglesOf(needlesFull.geometry, needlesFull.count) + trianglesOf(clustersFull.geometry, clustersFull.count),
    mid: trianglesOf(coreFull) + trianglesOf(needlesMid.geometry, needlesMid.count) + trianglesOf(clustersMid.geometry, clustersMid.count),
    low: trianglesOf(silhouette),
  };

  let level: 'full' | 'mid' | 'low' | null = null;
  const show = (next: 'full' | 'mid' | 'low'): void => {
    if (next === level) return;
    level = next;
    core.geometry = next === 'low' ? silhouette : coreFull;
    needlesFull.visible = next === 'full';
    clustersFull.visible = next === 'full';
    needlesMid.visible = next === 'mid';
    clustersMid.visible = next === 'mid';
    rig.moved();
  };
  show('full');
  rig.spin.position.set(0, 0, -BLIP_A_CENTRE_OF_MASS_Z_M);
  rig.moved();
  rig.setReady();

  return {
    object: rig.object,
    triangles,
    update(lightDirection, camera, planetshine, lighting) {
      rig.update(lightDirection, camera, planetshine, lighting, SPAN);
      const share = rig.share;
      show(share < LOW_DETAIL_BELOW ? 'low' : share < FULL_DETAIL_ABOVE ? 'mid' : 'full');
    },
    dispose() {
      coreFull.dispose();
      silhouette.dispose();
      for (const part of parts) {
        part.geometry.dispose();
        part.dispose();
      }
      rig.dispose();
    },
  };
}
