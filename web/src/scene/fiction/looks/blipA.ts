import * as THREE from 'three';

import { type Planetshine, type ShipFinish } from './shipMaterial.ts';
import { LOW_DETAIL_BELOW, ShipBuilder, createShipRig } from './shipRig.ts';

/**
 * The Blip-A, Rocky's ship (Andy Weir, *Project Hail Mary*, 2021): configuration after the 2026
 * film, every detail our own (canon notes, section 4b).
 *
 * **What the film shows**, as a general idea only: two long spindles of rods, alike, side by side
 * and parallel in one plane, a gap about their own width between them; each thickest at its
 * middle and tapering to a point at both ends, made of long parallel rods packed tight, of
 * staggered lengths, so its ends are ragged, a few rods reaching farther. Between them at the
 * middle a compact hub, and across both spindles and the hub a set of frames -- parallel,
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
 * Each spindle at its middle, across (x) and through (y), and the gap between the two: in the
 * proportions of a fan's model of the film's ship -- a spindle about an eighth of the length
 * across, the gap about as wide.
 */
export const SPINDLE_WIDTH_M = 46;
export const SPINDLE_THICKNESS_M = 38;
export const SPINDLE_GAP_M = 42;

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
const FRAME_BAND_M = 6;
const FRAME_DEPTH_M = 2.4;
const FRAME_PEAK_M = 12;
const FRAME_LEAN = 0.2;

/** The hub between the spindles: half-extents. Compact: it fills the gap, a little proud of the spindles. */
const HUB_HALF = new THREE.Vector3(SPINDLE_GAP_M * 0.48, SPINDLE_THICKNESS_M * 0.62, 36);

/** Rods each spindle carries at each level of detail. */
const RODS_FULL = 800;
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
 * How far along z a rod at normalised radius `rho` (0 at the axis, 1 at the middle's edge)
 * reaches: the spindle's profile, full length at the axis, tapering to a point at both ends.
 */
function reachAt(rho: number): number {
  return (BLIP_A_LENGTH_M / 2) * Math.pow(Math.max(1 - rho * rho, 0), 0.75);
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
 * One spindle's rods, around its axis at x = `centreX`: on its outer layers, where they are seen,
 * each as long as the spindle's profile allows at its radius, its two ends staggered
 * independently, a few reaching on past the taper.
 */
function rods(count: number, widthScale: number, centreX: number, seed: number): Rod[] {
  const random = generator(seed);
  const result: Rod[] = [];
  for (let i = 0; i < count; i += 1) {
    // A point on the cross-section, in its outer layers (radius 0.55 to 1) -- but one rod in
    // twenty near the axis, the longest, which make the spindle's points.
    const angle = random() * Math.PI * 2;
    const axial = random() < 0.05;
    const rho = axial ? 0.3 * random() : 0.55 + 0.45 * Math.sqrt(random());
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    // The superellipse's radius in this direction.
    const edge = Math.pow(Math.pow(Math.abs(c), SECTION_EXPONENT) + Math.pow(Math.abs(s), SECTION_EXPONENT), -1 / SECTION_EXPONENT);
    const x = centreX + c * edge * rho * (SPINDLE_WIDTH_M / 2);
    const y = s * edge * rho * (SPINDLE_THICKNESS_M / 2);
    // Staggered ends: each a little short of the profile, now and then one reaching beyond it.
    const reach = reachAt(rho * 0.92);
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
      sky: axial ? 0.5 : 0.45 + 0.55 * Math.pow((rho - 0.55) / 0.45, 0.7),
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
    const rho = Math.sqrt(Math.max(1 - Math.pow(Math.abs(z), 1 / 0.75), 0));
    points.push(new THREE.Vector2(Math.max(rho, 1e-3), (z * BLIP_A_LENGTH_M) / 2));
  }
  for (const side of [-1, 1]) {
    const lathe = new THREE.LatheGeometry(points, 8).rotateY(Math.PI / 8).rotateX(Math.PI / 2);
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(side * SPINDLE_X, 0, 0),
      new THREE.Quaternion(),
      new THREE.Vector3((SPINDLE_WIDTH_M / 2) * scale, (SPINDLE_THICKNESS_M / 2) * scale, 0.72),
    );
    builder.add(lathe, matrix, finish, occlusion);
  }
}

// --- The middle --------------------------------------------------------------------------------

/** The hub and the frames: one mesh of flat faces, symmetric across x = 0 and fore and aft. */
function middleGeometry(builder: ShipBuilder): void {
  // The hub: a compact, faceted body between the spindles.
  const hub = new THREE.IcosahedronGeometry(1, 1);
  builder.add(hub, new THREE.Matrix4().makeScale(HUB_HALF.x, HUB_HALF.y, HUB_HALF.z), FINISH.hull, 0.8);
  // Orderly ribs along the hub's flanks.
  for (let k = -2; k <= 2; k += 1) {
    if (k === 0) continue;
    for (const side of [-1, 1]) {
      const rib = new THREE.BoxGeometry(2, HUB_HALF.y * 1.3, 3);
      builder.add(rib, new THREE.Matrix4().makeTranslation(side * HUB_HALF.x * 0.82, 0, k * 11), FINISH.hull, 0.75);
    }
  }

  // The frames: a band hugging each spindle, its top drawn up into a peak, the two bands joined
  // across the gap above and below the hub. Each band leans back from the middle plane -- the
  // two of a frame mirror each other -- so seen from above a frame is a chevron.
  for (let i = 0; i < FRAMES; i += 1) {
    const z = (i - (FRAMES - 1) / 2) * FRAME_PITCH_M;
    // The middle frame's peak stands tallest; the outer ones lower: the sawtooth steps down.
    const peak = FRAME_PEAK_M * (1 - 0.16 * Math.abs(i - (FRAMES - 1) / 2));
    for (const side of [-1, 1]) {
      const centre = new THREE.Vector3(side * SPINDLE_X, 0, z);
      const lean = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * FRAME_LEAN);
      const w = SPINDLE_WIDTH_M / 2 + 1.2;
      const t = SPINDLE_THICKNESS_M / 2 + 1.2;
      // The band's outline round the spindle's lozenge, the peak on top.
      const outline = [
        new THREE.Vector2(w, 0),
        new THREE.Vector2(w * 0.55, t * 0.85),
        new THREE.Vector2(w * 0.2, t + 0.15 * peak),
        new THREE.Vector2(0, t + peak),
        new THREE.Vector2(-w * 0.2, t + 0.15 * peak),
        new THREE.Vector2(-w * 0.55, t * 0.85),
        new THREE.Vector2(-w, 0),
        new THREE.Vector2(-w * 0.55, -t * 0.85),
        new THREE.Vector2(0, -t - 0.25 * peak),
        new THREE.Vector2(w * 0.55, -t * 0.85),
      ];
      outline.forEach((from, k) => {
        const to = outline[(k + 1) % outline.length]!;
        const mid = new THREE.Vector3((from.x + to.x) / 2, (from.y + to.y) / 2, 0);
        const along = new THREE.Vector3(to.x - from.x, to.y - from.y, 0);
        const segment = new THREE.BoxGeometry(along.length() + 1.6, FRAME_DEPTH_M, FRAME_BAND_M);
        const turn = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan2(along.y, along.x));
        // Its own outline's frame, then leaned, then placed on the spindle.
        const local = new THREE.Matrix4().compose(mid, turn, new THREE.Vector3(1, 1, 1));
        const placed = new THREE.Matrix4().compose(centre, lean, new THREE.Vector3(1, 1, 1)).multiply(local);
        builder.add(segment, placed, FINISH.hull, 0.85);
      });
    }
    // Across the gap, over and under the hub, joining the two bands.
    for (const ySide of [-1, 1]) {
      const strap = new THREE.BoxGeometry(SPINDLE_GAP_M + 4, FRAME_DEPTH_M, FRAME_BAND_M);
      builder.add(strap, new THREE.Matrix4().makeTranslation(0, ySide * (HUB_HALF.y + FRAME_DEPTH_M / 2), z), FINISH.hull, 0.8);
    }
  }
}

/** Small on screen: two thin lozenges and a bar across them. */
function silhouetteGeometry(): THREE.BufferGeometry {
  const builder = new ShipBuilder(0);
  for (const side of [-1, 1]) {
    builder.add(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.Matrix4().compose(
        new THREE.Vector3(side * SPINDLE_X, 0, 0),
        new THREE.Quaternion(),
        new THREE.Vector3(SPINDLE_WIDTH_M * 0.8, SPINDLE_THICKNESS_M * 0.8, BLIP_A_LENGTH_M),
      ),
      FINISH.rod,
      0.6,
    );
  }
  builder.add(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.Matrix4().makeScale(BLIP_A_WIDTH_M, SPINDLE_THICKNESS_M * 0.9, FRAMES * FRAME_PITCH_M),
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
  spindleCores(builder, 0.58, FINISH.core, 0.45);
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
