import * as THREE from 'three';

import { type Planetshine, type ShipFinish } from './shipMaterial.ts';
import { LOW_DETAIL_BELOW, ShipBuilder, createShipRig } from './shipRig.ts';

/**
 * The Blip-A, Rocky's ship (Andy Weir, *Project Hail Mary*, 2021): configuration after the 2026
 * film, every detail our own (canon notes, section 4b).
 *
 * **What the film shows**, as a general idea only: two long spindles of rods, alike, side by side
 * and parallel in one plane, all but touching at the middle; each thickest at its
 * middle and tapering to a point at both ends, made of long parallel rods packed tight, of
 * staggered lengths, so its ends are ragged, a few rods reaching farther. They meet at the
 * middle, all but touching round a small hub, and open into a V toward the tips; across both
 * and the hub a set of frames -- parallel,
 * angled bands like ribs clamping it all together, whose peaked tops are the sawtooth seen from
 * the side. Symmetric across the plane between the spindles, and fore and aft. Dark bronze and
 * brown, metal, the star glinting gold along the rods.
 *
 * **What stays from the novel:** flat faces everywhere -- "Even the 'rods' have flat faces" --
 * xenonite, and the frames' peaks as its "gable-like protrusions". No running lights: Eridians
 * have no eyes.
 *
 * **Axes.** +z runs along the spindles; x across, from one spindle to the other; y through them,
 * the frames' peaks toward +y. The centre of mass is the middle: the ship is symmetric.
 *
 * **How it is drawn.** Each spindle is an opaque faceted core with rods around it: the rods on its
 * outside, where they are seen, the core filling what they would hide. Rods are instanced
 * camera-facing quads from a fixed seed (shipMaterial.ts), brushed along their length; the hub
 * and the frames one merged mesh of flat faces. Three levels of detail: every rod near; fewer,
 * thicker rods in the middle distance, where thin ones would be under a pixel and shimmer; and,
 * small on screen, two thin lozenges and a bar.
 */

// --- Dimensions --------------------------------------------------------------------------------

/**
 * Tip to tip along the spindles. Scaled from the 2026 film's stills against the Hail Mary's 40 m:
 * with the Hail Mary docked beside it, the Blip-A spans about eight Hail Marys -- more, since the
 * Hail Mary is the nearer -- so ten.
 */
export const BLIP_A_LENGTH_M = 400;

/** How far the rods reach each way from the middle: the ship is symmetric fore and aft. */
export const FORE_REACH_M = BLIP_A_LENGTH_M / 2;
export const AFT_REACH_M = BLIP_A_LENGTH_M / 2;

/**
 * Each spindle at its middle, across (x) and through (y), and the gap between the two there.
 * The spindles in the proportions of a fan's model of the film's ship, about an eighth of the
 * length across; the gap as the film shows it -- the two wings all but touching at the middle,
 * round a small hub, and opening into a V toward the tips as they taper.
 */
export const SPINDLE_WIDTH_M = 46;
export const SPINDLE_THICKNESS_M = 38;
export const SPINDLE_GAP_M = 3;

/** Across both spindles and the gap. */
export const BLIP_A_WIDTH_M = 2 * SPINDLE_WIDTH_M + SPINDLE_GAP_M;

/** Each spindle's axis, either side of the middle plane. */
const SPINDLE_X = (SPINDLE_GAP_M + SPINDLE_WIDTH_M) / 2;

/**
 * The frames: how many, their spacing along z, each band's width along z and depth, how high its
 * peak stands above the spindle, and how far each band leans back from the middle plane.
 */
const FRAMES = 5;
const FRAME_PITCH_M = 12;
const FRAME_BAND_M = 2;
const FRAME_DEPTH_M = 1.2;
const FRAME_PEAK_M = 12;
const FRAME_LEAN = 0.55;

/** The hub where the wings meet: small, faceted, standing a little proud of them above and below. */
const HUB_HALF = new THREE.Vector3(10, SPINDLE_THICKNESS_M / 2 + 5, 16);

/** Rods each spindle carries at each level of detail. */
const RODS_FULL = 600;
const RODS_MID = 300;

/** Above this share of the view's half-height every rod is drawn; below it, the middle level. */
const FULL_DETAIL_ABOVE = 0.6;

/** Widest extent against length, for how much of the view it fills: its length. */
const SPAN = 1;

/** The centre of mass from the middle along +z: the middle, by symmetry. */
export const BLIP_A_CENTRE_OF_MASS_Z_M = 0;

// --- Finishes ----------------------------------------------------------------------------------

/** Hub and frames: dark xenonite, bronze-brown as the film's, a little metallic. */
const HULL: ShipFinish = { color: [0.16, 0.105, 0.055], metal: 0.7, rough: 0.4 };
/** The rods: bronze-gold metal brushed along each one (shipMaterial's rod path). */
const ROD: ShipFinish = { color: [0.6, 0.4, 0.17], metal: 0.9, rough: 0.34, aniso: 0.8 };
/** Each spindle's core, between the rods: dark, mostly unseen. */
const CORE: ShipFinish = { color: [0.08, 0.055, 0.03], metal: 0.5, rough: 0.5 };

const FINISHES: readonly ShipFinish[] = [HULL, ROD, CORE];
const FINISH = { hull: 0, rod: 1, core: 2 } as const;

// --- The spindles ------------------------------------------------------------------------------

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

/** The spindle's cross-section, rounded lozenge: a superellipse of this exponent. */
const SECTION_EXPONENT = 1.5;

/**
 * The spindle's taper: its radius at a share `s` of the half-length from the middle is
 * (1 - s)^TAPER of the middle's -- 15 % at 70 % of the way out, the last stretch a few long rods.
 */
const TAPER = 1.6;

/**
 * How far along z a rod at normalised radius `rho` (0 at the axis, 1 at the middle's edge)
 * reaches: the inverse of the taper, full length at the axis.
 */
function reachAt(rho: number): number {
  return (BLIP_A_LENGTH_M / 2) * (1 - Math.pow(Math.min(Math.max(rho, 0), 1), 1 / TAPER));
}

/** A rod: centre, length, width, how much sky it sees, its tone. */
interface Rod {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly length: number;
  readonly width: number;
  readonly sky: number;
  readonly tone: number;
}

/**
 * One spindle's rods, around its axis at x = `centreX`, spread evenly over its cross-section,
 * each as long as the taper allows at its radius -- the outer ones short, the inner ones running
 * on toward the tips -- its two ends staggered independently, a few reaching past the taper.
 */
function rods(count: number, widthScale: number, centreX: number, seed: number): Rod[] {
  const random = generator(seed);
  const result: Rod[] = [];
  for (let i = 0; i < count; i += 1) {
    // A point on the cross-section, evenly over its area -- and one rod in twenty near the axis,
    // the longest, which make the spindle's points.
    const angle = random() * Math.PI * 2;
    const axial = random() < 0.05;
    const rho = axial ? 0.15 * random() : Math.sqrt(random());
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // The superellipse's radius in this direction.
    const edge = Math.pow(Math.pow(Math.abs(c), SECTION_EXPONENT) + Math.pow(Math.abs(s), SECTION_EXPONENT), -1 / SECTION_EXPONENT);
    const x = centreX + c * edge * rho * (SPINDLE_WIDTH_M / 2);
    const y = s * edge * rho * (SPINDLE_THICKNESS_M / 2);
    // Staggered ends: each a little short of the profile, now and then one reaching beyond it.
    const reach = reachAt(rho * 0.97);
    const stray = (): number => (axial ? 0.9 + 0.1 * random() : random() < 0.06 ? 1.05 + 0.25 * random() : 0.72 + 0.28 * random());
    const fore = Math.min(reach * stray(), BLIP_A_LENGTH_M / 2);
    const aft = Math.min(reach * stray(), BLIP_A_LENGTH_M / 2);
    if (i === 0) {
      // The first rod runs the spindle's full length on its axis: the ship is its length, tip to tip.
      result.push({ x: centreX, y: 0, z: 0, length: BLIP_A_LENGTH_M, width: widthScale * 0.9, sky: 0.6, tone: 0.8 });
      continue;
    }
    result.push({
      x,
      y,
      z: (fore - aft) / 2,
      length: fore + aft,
      width: widthScale * (0.25 + 1.0 * Math.pow(random(), 3)),
      sky: axial ? 0.5 : 0.35 + 0.65 * Math.pow(rho, 0.7),
      tone: 0.4 + 0.9 * Math.pow(random(), 1.4),
    });
  }
  return result;
}

/**
 * The spindles' faceted cores, one geometry for both: a lozenge in section, its profile the rods'
 * own, a little inside them so the rods stand on it.
 */
function spindleCores(builder: ShipBuilder, scale: number, finish: number, occlusion: number): void {
  const points: THREE.Vector2[] = [];
  const steps = 14;
  for (let k = 0; k <= steps; k += 1) {
    const z = -1 + (2 * k) / steps;
    const rho = Math.pow(1 - Math.abs(z), TAPER);
    points.push(new THREE.Vector2(Math.max(rho, 1e-3), (z * BLIP_A_LENGTH_M) / 2));
  }
  for (const side of [-1, 1]) {
    const lathe = new THREE.LatheGeometry(points, 8).rotateY(Math.PI / 8).rotateX(Math.PI / 2);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(side * SPINDLE_X, 0, 0),
      new THREE.Quaternion(),
      new THREE.Vector3((SPINDLE_WIDTH_M / 2) * scale, (SPINDLE_THICKNESS_M / 2) * scale, 0.85),
    );
    builder.add(lathe, matrix, finish, occlusion);
  }
}

// --- The middle --------------------------------------------------------------------------------

/** The hub and the frames: one mesh of flat faces, symmetric across x = 0 and fore and aft. */
function middleGeometry(builder: ShipBuilder): void {
  // The hub, where the wings meet: a small faceted body, ribbed along its flanks.
  const hub = new THREE.IcosahedronGeometry(1, 1);
  builder.add(hub, new THREE.Matrix4().makeScale(HUB_HALF.x, HUB_HALF.y, HUB_HALF.z), FINISH.hull, 0.8);
  for (let k = -2; k <= 2; k += 1) {
    if (k === 0) continue;
    for (const side of [-1, 1]) {
      const rib = new THREE.BoxGeometry(1, HUB_HALF.y * 1.3, 1.5);
      builder.add(rib, new THREE.Matrix4().makeTranslation(side * HUB_HALF.x * 0.82, 0, k * 5), FINISH.hull, 0.75);
    }
  }

  // The frames: each one band round both wings and the hub as one bundle, a peak over each wing,
  // a shallower notch between them. Each band runs back from the middle, so seen from above a
  // frame is a chevron, its point ahead at the middle.
  const w = SPINDLE_WIDTH_M / 2 + 1.2;
  const t = SPINDLE_THICKNESS_M / 2 + 1.2;
  const slope = Math.tan(FRAME_LEAN);
  const zAxis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < FRAMES; i += 1) {
    const zc = (i - (FRAMES - 1) / 2) * FRAME_PITCH_M;
    // The middle frame's peaks stand tallest; the outer ones lower: the sawtooth steps down.
    const peak = FRAME_PEAK_M * (1 - 0.16 * Math.abs(i - (FRAMES - 1) / 2));
    // The right half of the outline, top then bottom, from the outer edge in; the left mirrors it.
    const right: [number, number][] = [
      [SPINDLE_X + w, 0],
      [SPINDLE_X + w * 0.55, t * 0.85],
      [SPINDLE_X + w * 0.2, t + 0.15 * peak],
      [SPINDLE_X, t + peak],
      [SPINDLE_X - w * 0.2, t + 0.15 * peak],
      [SPINDLE_X - w * 0.6, t * 0.8],
      [0, HUB_HALF.y + 1.5],
    ];
    const rightBottom: [number, number][] = [
      [0, -HUB_HALF.y - 1.5],
      [SPINDLE_X - w * 0.6, -t * 0.8],
      [SPINDLE_X, -t - 0.25 * peak],
      [SPINDLE_X + w * 0.55, -t * 0.85],
    ];
    const loop: [number, number][] = [
      ...right,
      ...right.slice(0, -1).reverse().map(([x, y]): [number, number] => [-x, y]),
      ...rightBottom.slice(1).reverse().map(([x, y]): [number, number] => [-x, y]),
      ...rightBottom,
    ];
    // Placed: the band runs back from the middle with distance out, the chevron.
    const at = ([x, y]: [number, number]): THREE.Vector3 => new THREE.Vector3(x, y, zc + (SPINDLE_X - Math.abs(x)) * slope);
    loop.forEach((point, k) => {
      const from = at(point);
      const to = at(loop[(k + 1) % loop.length]!);
      const along = to.clone().sub(from);
      const length = along.length();
      if (length < 1e-3) return;
      const xAxis = along.divideScalar(length);
      const across = zAxis.clone().addScaledVector(xAxis, -zAxis.dot(xAxis)).normalize();
      const yAxis = new THREE.Vector3().crossVectors(across, xAxis);
      const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, across).setPosition(from.add(to).multiplyScalar(0.5));
      builder.add(new THREE.BoxGeometry(length + 1.2, FRAME_DEPTH_M, FRAME_BAND_M), matrix, FINISH.hull, 0.85);
    });
  }
}

/** Small on screen: two thin lozenges, touching, and the hub between them. */
function silhouetteGeometry(): THREE.BufferGeometry {
  const builder = new ShipBuilder(0);
  for (const side of [-1, 1]) {
    builder.add(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.Matrix4().compose(
        new THREE.Vector3(side * SPINDLE_X, 0, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(SPINDLE_WIDTH_M * 0.6, SPINDLE_THICKNESS_M * 0.6, BLIP_A_LENGTH_M),
      ),
      FINISH.rod,
      0.6,
    );
  }
  builder.add(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.Matrix4().makeScale(HUB_HALF.x * 2, HUB_HALF.y * 2, HUB_HALF.z * 2),
    FINISH.hull,
    0.8,
  );
  return builder.build();
}

// --- Instancing --------------------------------------------------------------------------------

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

/** One instanced draw of rods: each a ribbon placed and sized, its sky and tone in its colour. */
function instancedRods(parts: readonly Rod[], name: string): THREE.InstancedMesh {
  const builder = new ShipBuilder(0);
  builder.add(ribbonGeometry(), new THREE.Matrix4(), FINISH.rod, 1);
  const mesh = new THREE.InstancedMesh(builder.build(), undefined, parts.length);
  mesh.name = name;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const colour = new THREE.Color();
  parts.forEach((part, i) => {
    matrix.compose(position.set(part.x, part.y, part.z), rotation, scale.set(part.width, part.width, part.length));
    mesh.setMatrixAt(i, matrix);
    mesh.setColorAt(i, colour.setRGB(part.sky, part.tone, 0, THREE.LinearSRGBColorSpace));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor !== null) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
  return mesh;
}

const SEED = 40;

/** Both spindles' rods, mirrored: the second the first reflected across x = 0. */
function bothSpindles(count: number, widthScale: number, seed: number): Rod[] {
  const one = rods(count, widthScale, SPINDLE_X, seed);
  return [...one, ...one.map((rod) => ({ ...rod, x: -rod.x }))];
}

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
  const body = rig.sections[0]!;
  const builder = new ShipBuilder(0);
  middleGeometry(builder);
  spindleCores(builder, 0.5, FINISH.core, 0.4);
  const bodyFull = builder.build();
  const silhouette = silhouetteGeometry();
  body.geometry = bodyFull;

  const rodsFull = instancedRods(bothSpindles(RODS_FULL, 1, SEED), 'blip-a-rods');
  const rodsMid = instancedRods(bothSpindles(RODS_MID, 2.4, SEED + 2), 'blip-a-rods-mid');
  rig.addPart(rodsFull, { NEEDLE_RIBBON: '' });
  rig.addPart(rodsMid, { NEEDLE_RIBBON: '' });

  const trianglesOf = (geometry: THREE.BufferGeometry, copies = 1): number => ((geometry.index?.count ?? 0) / 3) * copies;
  const triangles = {
    full: trianglesOf(bodyFull) + trianglesOf(rodsFull.geometry, rodsFull.count),
    mid: trianglesOf(bodyFull) + trianglesOf(rodsMid.geometry, rodsMid.count),
    low: trianglesOf(silhouette),
  };

  let level: 'full' | 'mid' | 'low' | null = null;
  const show = (next: 'full' | 'mid' | 'low'): void => {
    if (next === level) return;
    level = next;
    body.geometry = next === 'low' ? silhouette : bodyFull;
    rodsFull.visible = next === 'full';
    rodsMid.visible = next === 'mid';
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
      bodyFull.dispose();
      silhouette.dispose();
      for (const part of [rodsFull, rodsMid]) {
        part.geometry.dispose();
        part.dispose();
      }
      rig.dispose();
    },
  };
}
