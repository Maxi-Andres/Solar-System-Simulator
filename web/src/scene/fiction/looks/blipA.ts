import * as THREE from 'three';

import { MARKING, type Planetshine, type ShipFinish } from './shipMaterial.ts';
import { ShipBuilder, createShipRig } from './shipRig.ts';

/**
 * The Blip-A, Rocky's ship (Andy Weir, *Project Hail Mary*, 2021), our own model from the
 * novel's description -- the 2026 film's design is not described anywhere in words we could
 * find, so the novel's is followed (canon notes, section 4b).
 *
 * What the novel gives, through Grace's telescope: "roughly triangle-shaped", with "gable-like
 * protrusions along its hull"; built of "huge, flat surfaces", "every part of the hull is flat.
 * Even the 'rods' have flat faces". Its centre is "diamond-shaped ... an octahedron", "about
 * the size of my ship", joined "by three thick rods ... to a wide trapezoidal base" at the rear;
 * ahead of the diamond "a narrow stalk" with "four flat panels attached parallel to the main
 * ship axis" (solar panels, Grace guesses) runs on to "a pyramid-shaped nose cone". The hull is
 * "a mottled gray and tan ... like someone started mixing paint but stopped way too early" --
 * xenonite. A robot on a track in the hull: "a stalk sticking up with five articulated 'arms'".
 *
 * Ours, from that: the octahedron 40 m tip to tip; three square-section rods; the base a
 * triangular frustum, three-sided like the three rods it takes; the stalk square, its four
 * panels a cross of fins; a square pyramid for the nose; rows of gables on the octahedron's
 * faces and the base's sides; the robot on its track on one face; a darker plate on the base's
 * rear face where the engines are. Every face flat and flat-shaded. No running lights: Eridians
 * have no eyes, and a light would tell another Eridian nothing.
 *
 * Every dimension is invented unless said otherwise, each a named constant with its reason.
 */

// --- Dimensions --------------------------------------------------------------------------------

/** The octahedron, tip to tip. The novel: "about the size of my ship" -- the Hail Mary's 40 m. */
export const DIAMOND_SPAN_M = 40;

/** The base: a triangular frustum, its rear and front circumradii and its depth. Invented: wider than the diamond, so the whole reads "roughly triangle-shaped". */
export const BASE_REAR_RADIUS_M = 32;
export const BASE_FRONT_RADIUS_M = 19;
export const BASE_DEPTH_M = 13;

/** The gap the three rods span, base to diamond. Invented: long enough to read as rods, "thick" against it. */
export const ROD_GAP_M = 24;
export const ROD_THICKNESS_M = 3.2;

/** The stalk, ahead of the diamond, and its four panels. Invented: "narrow", the panels long along it. */
export const STALK_LENGTH_M = 38;
export const STALK_WIDTH_M = 3.6;
export const PANEL_LENGTH_M = 22;
export const PANEL_WIDTH_M = 9;

/** The nose pyramid. Invented. */
export const NOSE_LENGTH_M = 12;
export const NOSE_WIDTH_M = 7;

const DIAMOND_RADIUS = DIAMOND_SPAN_M / 2;
const Z_BASE_FRONT = BASE_DEPTH_M;
const Z_DIAMOND = Z_BASE_FRONT + ROD_GAP_M + DIAMOND_RADIUS;
const Z_STALK = Z_DIAMOND + DIAMOND_RADIUS;
const Z_NOSE = Z_STALK + STALK_LENGTH_M;

/** Stern to nose tip: 127 m, three times the Hail Mary, as the film's ship is "much bigger". */
export const BLIP_A_LENGTH_M = Z_NOSE + NOSE_LENGTH_M;

/**
 * The centre of mass, from the stern. Invented: the base (engines, and the fuel we put there)
 * taken as half the mass, the diamond (the crew's world, 29 atm of ammonia inside) as 40 %, the
 * rods, stalk and nose the rest.
 */
export const BLIP_A_CENTRE_OF_MASS_Z_M =
  0.5 * (BASE_DEPTH_M * 0.45) + 0.4 * Z_DIAMOND + 0.1 * (Z_STALK + STALK_LENGTH_M / 2);

/** Widest extent against length, for how much of the view it fills: its length. */
const SPAN = 1;

// --- Finishes ----------------------------------------------------------------------------------

/** Xenonite: grey mottled with tan (shipMaterial's mottled pattern), smooth, not metal. */
const XENONITE: ShipFinish = { color: [0.21, 0.2, 0.19], metal: 0, rough: 0.42, pattern: MARKING.mottled };
/** The engine plate: xenonite darkened by the drive's heat. */
const SCORCHED: ShipFinish = { color: [0.07, 0.065, 0.06], metal: 0, rough: 0.6 };
/** The four panels: dark, a little glossy, as solar panels are -- Grace's guess. */
const PANEL: ShipFinish = { color: [0.05, 0.055, 0.065], metal: 0.2, rough: 0.28 };
/** The robot and its track: Eridian steel, satin. */
const STEEL: ShipFinish = { color: [0.55, 0.54, 0.52], metal: 0.85, rough: 0.35, aniso: 0.3 };

const FINISHES: readonly ShipFinish[] = [XENONITE, SCORCHED, PANEL, STEEL];
const FINISH = { xenonite: 0, scorched: 1, panel: 2, steel: 3 } as const;

// --- Geometry ----------------------------------------------------------------------------------

const Z_AXIS = new THREE.Vector3(0, 0, 1);

/** A matrix placing a shape's local y along `along`, its local z along `out`, at `at`. */
function placed(at: THREE.Vector3, along: THREE.Vector3, out: THREE.Vector3): THREE.Matrix4 {
  const y = along.clone().normalize();
  const z = out.clone().addScaledVector(y, -out.dot(y)).normalize();
  const x = new THREE.Vector3().crossVectors(y, z);
  return new THREE.Matrix4().makeBasis(x, y, z).setPosition(at);
}

/** Axis-along-z frustum or pyramid with `sides` flat sides: three's cylinder, turned. */
function prism(radiusBack: number, radiusFront: number, length: number, sides: number, twist = 0): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(radiusFront, radiusBack, length, sides, 1)
    .rotateY(twist)
    .rotateX(Math.PI / 2);
}

/** A gable: a triangular prism `length` long, its ridge `height` above the face it sits on. */
function gable(builder: ShipBuilder, at: THREE.Vector3, along: THREE.Vector3, out: THREE.Vector3, length: number, height: number): void {
  // Three's three-sided cylinder has a corner at local +z: there, the ridge. Its base edge lies
  // at -r/2, so it sits on the face when lifted by that.
  const r = (2 * height) / 3;
  const shape = new THREE.CylinderGeometry(r, r, length, 3, 1);
  const position = at.clone().addScaledVector(out.clone().normalize(), r / 2);
  builder.add(shape, placed(position, along, out), FINISH.xenonite, 0.85);
}

/** The octahedron's eight faces: each its centroid and outward normal. */
function diamondFaces(): { centre: THREE.Vector3; normal: THREE.Vector3 }[] {
  const faces: { centre: THREE.Vector3; normal: THREE.Vector3 }[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        faces.push({
          centre: new THREE.Vector3(sx, sy, sz).multiplyScalar(DIAMOND_RADIUS / 3).add(new THREE.Vector3(0, 0, Z_DIAMOND)),
          normal: new THREE.Vector3(sx, sy, sz).normalize(),
        });
      }
    }
  }
  return faces;
}

/** The base's three corners at a depth: rear (z = 0) or front. */
function baseCorner(i: number, front: boolean): THREE.Vector3 {
  const r = front ? BASE_FRONT_RADIUS_M : BASE_REAR_RADIUS_M;
  // Three's cylinder puts its corners at angle 2 pi i / 3 from local +z; turned onto the z axis, local +z is -y.
  const a = (2 * Math.PI * i) / 3;
  return new THREE.Vector3(r * Math.sin(a), -r * Math.cos(a), front ? Z_BASE_FRONT : 0);
}

function buildHull(full: boolean): THREE.BufferGeometry {
  const builder = new ShipBuilder(0);
  const at = (z: number): THREE.Matrix4 => new THREE.Matrix4().makeTranslation(0, 0, z);

  // The base, and the engine plate on its rear face.
  builder.add(prism(BASE_REAR_RADIUS_M, BASE_FRONT_RADIUS_M, BASE_DEPTH_M, 3), at(BASE_DEPTH_M / 2), FINISH.xenonite, 0.92);
  builder.add(prism(BASE_REAR_RADIUS_M * 0.55, BASE_REAR_RADIUS_M * 0.55, 0.8, 3), at(-0.4), FINISH.scorched, 0.7);

  // The diamond: an octahedron, its tips on the axes.
  builder.add(new THREE.OctahedronGeometry(DIAMOND_RADIUS, 0), at(Z_DIAMOND), FINISH.xenonite, 0.95);

  // The three rods, square in section, from the base's front corners to the diamond's rear faces.
  for (let i = 0; i < 3; i += 1) {
    const from = baseCorner(i, true).multiplyScalar(0.8).setZ(Z_BASE_FRONT);
    const toward = baseCorner(i, true).setZ(0).normalize().multiplyScalar(DIAMOND_RADIUS * 0.32);
    const to = toward.setZ(Z_DIAMOND - DIAMOND_RADIUS * 0.6);
    const along = to.clone().sub(from);
    const rod = new THREE.BoxGeometry(ROD_THICKNESS_M, along.length() + 2, ROD_THICKNESS_M);
    builder.add(rod, placed(from.clone().add(to).multiplyScalar(0.5), along, from.clone().setZ(0)), FINISH.xenonite, 0.82);
  }

  // The stalk, its panels, the nose.
  builder.add(new THREE.BoxGeometry(STALK_WIDTH_M, STALK_WIDTH_M, STALK_LENGTH_M + 2), at(Z_STALK + STALK_LENGTH_M / 2 - 1), FINISH.xenonite, 0.88);
  const panelZ = Z_STALK + STALK_LENGTH_M * 0.55;
  for (let i = 0; i < 4; i += 1) {
    const out = new THREE.Vector3(Math.cos((i * Math.PI) / 2), Math.sin((i * Math.PI) / 2), 0);
    const centre = out.clone().multiplyScalar(STALK_WIDTH_M / 2 + PANEL_WIDTH_M / 2).setZ(panelZ);
    const panel = new THREE.BoxGeometry(0.35, PANEL_LENGTH_M, PANEL_WIDTH_M);
    builder.add(panel, placed(centre, Z_AXIS, out), FINISH.panel, 0.95);
    if (full) {
      // A spar from the stalk to each panel's root and tip.
      for (const end of [-1, 1]) {
        const spar = new THREE.BoxGeometry(0.6, 0.6, 1.4);
        const sparAt = out.clone().multiplyScalar(STALK_WIDTH_M / 2 + 0.5).setZ(panelZ + end * PANEL_LENGTH_M * 0.42);
        builder.add(spar, placed(sparAt, Z_AXIS, out), FINISH.xenonite, 0.8);
      }
    }
  }
  builder.add(prism(NOSE_WIDTH_M / Math.SQRT2, 0, NOSE_LENGTH_M, 4, Math.PI / 4), at(Z_NOSE + NOSE_LENGTH_M / 2), FINISH.xenonite, 0.95);

  if (full) {
    // Gables: two along each of the diamond's faces, ridges running fore and aft.
    for (const { centre, normal } of diamondFaces()) {
      const along = Z_AXIS.clone().addScaledVector(normal, -normal.z).normalize();
      const across = new THREE.Vector3().crossVectors(normal, along);
      for (const side of [-1, 1]) {
        gable(builder, centre.clone().addScaledVector(across, side * 3.2), along, normal, 7, 2.2);
      }
    }
    // And three along each of the base's sides, up its slope.
    for (let i = 0; i < 3; i += 1) {
      const rearA = baseCorner(i, false);
      const rearB = baseCorner(i + 1, false);
      const frontA = baseCorner(i, true);
      const frontB = baseCorner(i + 1, true);
      const rearMid = rearA.clone().add(rearB).multiplyScalar(0.5);
      const frontMid = frontA.clone().add(frontB).multiplyScalar(0.5);
      const up = frontMid.clone().sub(rearMid);
      const edge = rearB.clone().sub(rearA);
      const normal = new THREE.Vector3().crossVectors(edge, up).normalize();
      if (normal.dot(rearMid) < 0) normal.negate();
      for (const k of [-1, 0, 1]) {
        const centre = rearMid.clone().add(frontMid).multiplyScalar(0.5).addScaledVector(edge.clone().normalize(), k * 11);
        gable(builder, centre, up, normal, up.length() * 0.75, 1.4);
      }
    }
    // The hull robot on its track, across one of the diamond's upper faces.
    const face = diamondFaces().find((f) => f.normal.x > 0 && f.normal.y > 0 && f.normal.z > 0)!;
    const along = Z_AXIS.clone().addScaledVector(face.normal, -face.normal.z).normalize();
    const track = new THREE.BoxGeometry(0.5, 16, 0.3);
    builder.add(track, placed(face.centre.clone().addScaledVector(face.normal, 0.15), along, face.normal), FINISH.steel, 0.8);
    const foot = face.centre.clone().addScaledVector(along, 3).addScaledVector(face.normal, 0.3);
    const stalk = new THREE.BoxGeometry(0.5, 2.6, 0.5);
    builder.add(stalk, placed(foot.clone().addScaledVector(face.normal, 1.3), face.normal, along), FINISH.steel, 0.9);
    const top = foot.clone().addScaledVector(face.normal, 2.6);
    for (let i = 0; i < 5; i += 1) {
      const a = (2 * Math.PI * i) / 5;
      const side = new THREE.Vector3().crossVectors(face.normal, along);
      const reach = along.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a)).addScaledVector(face.normal, 0.5).normalize();
      const arm = new THREE.BoxGeometry(0.2, 1.6, 0.2);
      builder.add(arm, placed(top.clone().addScaledVector(reach, 0.8), reach, face.normal), FINISH.steel, 0.9);
    }
  }
  return builder.build();
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
  readonly triangles: { readonly full: number; readonly low: number };
  dispose(): void;
}

export function createBlipA(): BlipA {
  const rig = createShipRig({
    name: 'blip-a',
    sectionNames: ['blip-a-hull'],
    lightsName: 'blip-a-lights',
    lights: [],
    lengthM: BLIP_A_LENGTH_M,
    finishes: FINISHES,
  });
  const hull = rig.sections[0]!;
  const full = buildHull(true);
  const low = buildHull(false);
  const count = (g: THREE.BufferGeometry): number => (g.index?.count ?? 0) / 3;
  hull.geometry = full;
  rig.onDetail = (isLow) => {
    hull.geometry = isLow ? low : full;
  };
  rig.spin.position.set(0, 0, -BLIP_A_CENTRE_OF_MASS_Z_M);
  rig.moved();
  rig.setReady();
  return {
    object: rig.object,
    triangles: { full: count(full), low: count(low) },
    update(lightDirection, camera, planetshine, lighting) {
      rig.update(lightDirection, camera, planetshine, lighting, SPAN);
    },
    dispose() {
      full.dispose();
      low.dispose();
      rig.dispose();
    },
  };
}
