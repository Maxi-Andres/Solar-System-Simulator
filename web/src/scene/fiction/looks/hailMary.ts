import * as THREE from 'three';

import { MARKING, PartBuilder, type Finish, type Planetshine, setShipLight, shipMaterial } from './shipMaterial.ts';

export { planetshineStrength, type Planetshine } from './shipMaterial.ts';
import { renderDemand } from '../../../core/renderDemand.ts';
import { OcclusionJob, type Occluder } from './shipOcclusion.ts';

/**
 * The Hail Mary (Andy Weir, *Project Hail Mary*, 2021): our own model, from the layout the
 * novel describes, with the publisher's teaching-kit schematics as a cross-check (canon notes,
 * section 3b). Nothing here is from the 2026 film's ship or any concept art.
 *
 * What the novel fixes, nose to stern:
 *  - a "shiny silver, smooth hull, sharp nose cone";
 *  - the control room inside the nose cone, its airlock in the cone's wall, the four Beetles
 *    stowed in the nose;
 *  - the lab, the dormitory, a storage bay about a metre high;
 *  - the Cable Faring with its Zylon spools;
 *  - then the ship widening into three cylinders of fuel, nine bays in all, with red Astrophage
 *    pipes running along the hull;
 *  - the spin drives at the stern, and small spin drives on the sides for attitude;
 *  - a ring with two big hinges, about which the crew section turns round for centrifuge mode.
 *
 * What it leaves to us -- every diameter and deck height but the storage bay's -- is chosen
 * below, one named constant each with its reason, so the data can say they are invented and why.
 *
 * Built in metres, z from the stern's drive plates forward. `createHailMary` scales it to length
 * one, bow +z, its centre of mass at the origin, as core/fictionLook.ts asks.
 */

// --- Dimensions -------------------------------------------------------------------------------

/** Overall length. Canon, derived: Grace calls 20 m "half the length of the ship". */
export const HAIL_MARY_LENGTH_M = 40;

/** Crew section diameter. Invented: a round deck holding three beds in a triangle and a ladder. */
export const CREW_SECTION_DIAMETER_M = 6.4;

/** Nose cone length, control room included. Invented: sharp, about the crew section's width. */
export const NOSE_CONE_LENGTH_M = 7;

/** The control room's height at the cone's base. Invented: room to stand under tapering walls. */
export const CONTROL_ROOM_HEIGHT_M = 2.8;

/** Lab deck height. Invented: the tallest deck, the novel's pendulum hangs metres down in it. */
export const LAB_HEIGHT_M = 4.2;

/** Dormitory deck height. Invented: its ceiling hatch is "10 feet off the ground", plus floor. */
export const DORMITORY_HEIGHT_M = 3.6;

/** Storage bay height. Canon: about a metre. */
export const STORAGE_HEIGHT_M = 1;

/** Cable Faring length. Invented: five spools of Zylon cable a hundred metres long. */
export const CABLE_FARING_LENGTH_M = 2.2;

/** The skirt widening from the crew section to the tanks. Invented, to make up the canon length. */
export const SKIRT_LENGTH_M = 6.7;

/** Fuel tank diameter. Novel: the three cylinders are as wide as the crew compartment. */
export const FUEL_TANK_DIAMETER_M = 6;

/** Fuel tank length. Invented: three tanks of this hold the fuel at a density near 1.9 t/m^3. */
export const FUEL_TANK_LENGTH_M = 12.4;

/** Spin drives and their housings at the stern. Invented. */
export const SPIN_DRIVE_LENGTH_M = 2.6;

/** Astrophage at launch. Summaries of the novel: about two million kilograms. */
export const FUEL_MASS_KG = 2e6;

/** Astrophage left at tau Ceti, used for the centre of mass. Invented: canon gives none. */
export const FUEL_AT_TAU_CETI_KG = 3e5;

/** Crew section mass. Invented: three pressurised decks, like three ISS-sized modules. */
export const CREW_SECTION_MASS_KG = 6e4;

/** Fuel section dry mass: tanks, skirt, faring, drives. Invented. */
export const FUEL_SECTION_DRY_MASS_KG = 1.5e5;

/** Control room to the centre of mass in centrifuge mode, cables fully out. Canon: 75 m. */
export const CENTRIFUGE_CONTROL_ROOM_RADIUS_M = 75;

/** The gravity the centrifuge is set for, at the lab floor. Canon: the design gives one g. */
export const CENTRIFUGE_GRAVITY_M_S2 = 9.80665;

// The layout, z from the stern (metres).
const Z_TANKS = SPIN_DRIVE_LENGTH_M;
const Z_BULKHEAD = Z_TANKS + FUEL_TANK_LENGTH_M;
const Z_SKIRT = Z_BULKHEAD + 0.3;
const Z_FARING = Z_SKIRT + SKIRT_LENGTH_M;
const Z_CREW = Z_FARING + CABLE_FARING_LENGTH_M;
const Z_DORM = Z_CREW + STORAGE_HEIGHT_M;
/** The lab floor: the hinge ring is at the lab and dormitory's boundary (kit schematic). */
const Z_LAB = Z_DORM + DORMITORY_HEIGHT_M;
const Z_CONE = Z_LAB + LAB_HEIGHT_M;
const Z_NOSE = Z_CONE + NOSE_CONE_LENGTH_M;
const Z_CONTROL = Z_CONE + CONTROL_ROOM_HEIGHT_M / 2;
const CREW_R = CREW_SECTION_DIAMETER_M / 2;
const TANK_R = FUEL_TANK_DIAMETER_M / 2;
/** Three tanks touching, about the axis. */
const TANK_RING = TANK_R / Math.sin(Math.PI / 3);
const SKIRT_R = TANK_RING + TANK_R;
const TANK_ANGLES = [90, 210, 330].map((deg) => (deg * Math.PI) / 180);
const HINGE_Z = Z_LAB;
const CREW_CENTRE_Z = Z_CREW + (Z_NOSE - Z_CREW) * 0.42;
const FUEL_CENTRE_Z = Z_TANKS + FUEL_TANK_LENGTH_M / 2;
const REAR_DRY_CENTRE_Z = 9.5;

/** The cruise centre of mass, from the stern (metres), with the fuel left at tau Ceti. */
export const CRUISE_CENTRE_OF_MASS_Z_M =
  (CREW_SECTION_MASS_KG * CREW_CENTRE_Z +
    FUEL_SECTION_DRY_MASS_KG * REAR_DRY_CENTRE_Z +
    FUEL_AT_TAU_CETI_KG * FUEL_CENTRE_Z) /
  (CREW_SECTION_MASS_KG + FUEL_SECTION_DRY_MASS_KG + FUEL_AT_TAU_CETI_KG);

/**
 * Centrifuge mode, worked out from the above.
 *
 * The crew section turns 180 degrees about its hinges (nose toward the fuel section) and rides
 * out on the cables until the control room is 75 m from the common centre of mass, the novel's
 * figure. With the crew section a sixth of the mass, the centre of mass stays near the tanks,
 * and the cables come out at about 77 m -- Lokken's "hundred metres of separation" between the
 * two halves' far ends, near enough. The spin is set for one g at the lab floor: 3.3 turns a
 * minute, a turn every 19 s, inside the 4 rpm usually given as the limit people adapt to without
 * motion sickness (Hall 1999). The control room then feels 0.93 g and the dormitory floor 1.05 g,
 * the gentle gradient Grace notices with his pendulum.
 */
function centrifugeLayout(): { hingeZ: number; centreZ: number; spin: number } {
  const rearMass = FUEL_SECTION_DRY_MASS_KG + FUEL_AT_TAU_CETI_KG;
  const rearCentre = (FUEL_SECTION_DRY_MASS_KG * REAR_DRY_CENTRE_Z + FUEL_AT_TAU_CETI_KG * FUEL_CENTRE_Z) / rearMass;
  const total = rearMass + CREW_SECTION_MASS_KG;
  // Turned about the hinge, a crew point at cruise z lands at hinge - (z - HINGE_Z).
  const crewCentreOffset = CREW_CENTRE_Z - HINGE_Z;
  const controlOffset = Z_CONTROL - HINGE_Z;
  // control - centre = 75, with centre = (rearMass rearCentre + crewMass (h - crewOffset)) / total.
  const share = CREW_SECTION_MASS_KG / total;
  const hingeZ =
    (CENTRIFUGE_CONTROL_ROOM_RADIUS_M + controlOffset + (rearMass * rearCentre - CREW_SECTION_MASS_KG * crewCentreOffset) / total) /
    (1 - share);
  const centreZ = (rearMass * rearCentre + CREW_SECTION_MASS_KG * (hingeZ - crewCentreOffset)) / total;
  const labRadius = hingeZ - centreZ;
  return { hingeZ, centreZ, spin: Math.sqrt(CENTRIFUGE_GRAVITY_M_S2 / labRadius) };
}

const CENTRIFUGE = centrifugeLayout();

/** Cable length paid out in centrifuge mode, faring to hinge (metres). Derived above. */
export const CENTRIFUGE_CABLE_LENGTH_M = CENTRIFUGE.hingeZ - Z_FARING - CABLE_FARING_LENGTH_M / 2;

/** Spin rate in centrifuge mode, rad/s: one g at the lab floor. */
export const CENTRIFUGE_SPIN_RAD_S = CENTRIFUGE.spin;

/** The same, in turns a minute. */
export const CENTRIFUGE_RPM = (CENTRIFUGE_SPIN_RAD_S * 60) / (2 * Math.PI);

// --- Finishes ---------------------------------------------------------------------------------

/**
 * The novel's "shiny silver" hull: aluminium, satin and brushed. A mirror hull in space
 * reflects black space and reads black but for one glint; brushed, the star's highlight is a
 * streak across each plate that slides from plate to plate as the view turns.
 */
// Satin aluminium is not a mirror: its rolled, brushed, oxidised surface scatters most of the
// light it returns broadly, and lit plates read light grey to silver from nearly every angle, as
// in any photograph of the ISS or an Apollo service module. So the hull is a blend (`metal` well
// under one): a diffuse share at an albedo near 0.6, and the brushed metallic highlight on top.
const SILVER: Finish = { color: [0.88, 0.89, 0.9], metal: 0.35, rough: 0.32, plates: 1, aniso: 0.5 };
const SILVER_FINE: Finish = { color: [0.9, 0.9, 0.91], metal: 0.4, rough: 0.28, plates: 0.6, aniso: 0.45 };
const TANK_SKIN: Finish = { color: [0.84, 0.85, 0.86], metal: 0.32, rough: 0.38, plates: 1.5, aniso: 0.55 };
/** Plain trim, unbrushed. */
const TRIM: Finish = { color: [0.82, 0.83, 0.84], metal: 0.45, rough: 0.34 };
const DARK_METAL: Finish = { color: [0.36, 0.36, 0.38], metal: 0.5, rough: 0.4, aniso: 0.3 };
const GUNMETAL: Finish = { color: [0.22, 0.22, 0.23], metal: 0.5, rough: 0.48 };
/** Multi-layer insulation: gold-coloured Kapton, crinkled. */
const GOLD_FOIL: Finish = { color: [1.0, 0.74, 0.34], metal: 1, rough: 0.24, plates: MARKING.foil };
/** Radiator panels: matte white silicate paint, as on the ISS's, a little weathered. */
const RADIATOR: Finish = { color: [0.6, 0.6, 0.59], metal: 0, rough: 0.85 };
const RADIATOR_RIB: Finish = { color: [0.5, 0.5, 0.49], metal: 0, rough: 0.8 };
/** The novel's red Astrophage pipes: painted metal. */
const RED_PIPE: Finish = { color: [0.42, 0.03, 0.02], metal: 0, rough: 0.38 };
/** Zylon is golden-yellow. */
const ZYLON: Finish = { color: [0.8, 0.6, 0.22], metal: 0, rough: 0.6 };
const EMITTER: Finish = { color: [0.04, 0.04, 0.045], metal: 0.3, rough: 0.3 };
const LENS: Finish = { color: [0.02, 0.025, 0.03], metal: 0, rough: 0.05 };
const HAZARD: Finish = { color: [0.75, 0.5, 0.02], metal: 0, rough: 0.55, plates: MARKING.hazard };
const STENCIL: Finish = { color: [0.88, 0.89, 0.9], metal: 0.35, rough: 0.32, plates: MARKING.stencil };
/**
 * The spin drives' plates. Astrophage emits at 25.984 um, far infrared: the drive shows no
 * flame to the eye. The plates are drawn only warm -- a dull red at the limit of seeing -- and
 * the cells deep, their sides in their own shadow.
 */
const DRIVE_CELL: Finish = { color: [0.16, 0.14, 0.13], metal: 0.7, rough: 0.5, cavity: 0.45 };
const DRIVE_FACE: Finish = { color: [0.06, 0.05, 0.045], metal: 0.5, rough: 0.7, glow: -0.06, cavity: 0.7 };
const LIGHT_RED: Finish = { color: [1.0, 0.06, 0.03], metal: 0, rough: 0.5, glow: 6 };
const LIGHT_GREEN: Finish = { color: [0.05, 1.0, 0.15], metal: 0, rough: 0.5, glow: 6 };
const LIGHT_WHITE: Finish = { color: [1.0, 0.97, 0.9], metal: 0, rough: 0.5, glow: 8 };

/** Small parts: not in the sky-visibility pass, a fixed cavity instead. */
const SMALL = { occluded: false } as const;

// --- Geometry helpers -------------------------------------------------------------------------

const UP_TO_Z = new THREE.Matrix4().makeRotationX(Math.PI / 2);

/** A frustum along z from z0 (radius r0) to z1 (radius r1), about the axis; `rows` along it. */
function frustum(r0: number, r1: number, z0: number, z1: number, segments: number, open = false, rows = 1): [THREE.BufferGeometry, THREE.Matrix4] {
  const geometry = new THREE.CylinderGeometry(r1, r0, z1 - z0, segments, rows, open);
  const matrix = new THREE.Matrix4().makeTranslation(0, 0, (z0 + z1) / 2).multiply(UP_TO_Z);
  return [geometry, matrix];
}

function at(x: number, y: number, matrix: THREE.Matrix4): THREE.Matrix4 {
  return new THREE.Matrix4().makeTranslation(x, y, 0).multiply(matrix);
}

/**
 * The frame at angle `phi` and height `z` on a surface of revolution of radius `r` and slope
 * `slope` (dr/dz): x around, y up the surface, z out of it; `lift` above the surface.
 */
function surfaceFrame(phi: number, z: number, r: number, slope: number, lift = 0, cx = 0, cy = 0): THREE.Matrix4 {
  const around = new THREE.Vector3(-Math.sin(phi), Math.cos(phi), 0);
  const normal = new THREE.Vector3(Math.cos(phi), Math.sin(phi), -slope).normalize();
  const up = new THREE.Vector3().crossVectors(normal, around).normalize();
  const position = new THREE.Vector3(cx + r * Math.cos(phi), cy + r * Math.sin(phi), z).addScaledVector(normal, lift);
  return new THREE.Matrix4().makeBasis(around, up, normal).setPosition(position);
}

/** A box `w` around, `h` along, `d` out of a surface frame, sitting on it. */
function boxOn(frame: THREE.Matrix4, w: number, h: number, d: number): [THREE.BufferGeometry, THREE.Matrix4] {
  return [new THREE.BoxGeometry(w, h, d), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, d / 2))];
}

/**
 * A decal: a plate `w` by `h`, 3 mm proud of a surface frame, its outer face's texture
 * coordinates running 0..1 across it -- for stencils.
 */
function decalOn(frame: THREE.Matrix4, w: number, h: number): [THREE.BufferGeometry, THREE.Matrix4] {
  return [new THREE.PlaneGeometry(w, h), frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.004))];
}

/** A cylinder standing out of a surface frame, `length` long. */
function stalkOn(frame: THREE.Matrix4, radius: number, length: number, segments: number, from = 0): [THREE.BufferGeometry, THREE.Matrix4] {
  const turn = new THREE.Matrix4().makeRotationX(Math.PI / 2);
  return [
    new THREE.CylinderGeometry(radius, radius, length, segments),
    frame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, from + length / 2)).multiply(turn),
  ];
}

/** A thin tube from a to b. */
function tube(a: THREE.Vector3, b: THREE.Vector3, radius: number, segments: number): [THREE.BufferGeometry, THREE.Matrix4] {
  const length = a.distanceTo(b);
  const direction = new THREE.Vector3().subVectors(b, a).normalize();
  const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  const matrix = new THREE.Matrix4().compose(new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5), rotation, new THREE.Vector3(1, 1, 1));
  return [new THREE.CylinderGeometry(radius, radius, length, segments, 1, true), matrix];
}

/** The detail a section is built at: full, or a silhouette for when it is a few pixels. */
type Detail = 'full' | 'low';

const NOSE_SLOPE = -CREW_R / NOSE_CONE_LENGTH_M;
function noseRadius(z: number): number {
  return CREW_R * (1 - (z - Z_CONE) / NOSE_CONE_LENGTH_M);
}

/** Section ids, for the shadow map's per-section transforms. */
const SECTION = { rear: 0, crew: 1, cables: 2 } as const;

/** The large shapes the sky-visibility pass casts against, cruise coordinates (metres). */
function occluders(): Occluder[] {
  const shapes: Occluder[] = [
    { kind: 'cylinder', cx: 0, cy: 0, r: CREW_R, z0: Z_CREW, z1: Z_CONE },
    { kind: 'cone', r0: CREW_R, r1: 0.001, z0: Z_CONE, z1: Z_NOSE },
    { kind: 'cylinder', cx: 0, cy: 0, r: CREW_R + 0.14, z0: HINGE_Z - 0.35, z1: HINGE_Z + 0.35 },
    { kind: 'cylinder', cx: 0, cy: 0, r: CREW_R + 0.15, z0: Z_FARING, z1: Z_CREW },
    { kind: 'cone', r0: SKIRT_R, r1: CREW_R + 0.05, z0: Z_SKIRT, z1: Z_FARING },
    { kind: 'cylinder', cx: 0, cy: 0, r: SKIRT_R + 0.08, z0: Z_BULKHEAD, z1: Z_SKIRT },
    { kind: 'cylinder', cx: 0, cy: 0, r: 1.1, z0: 0.8, z1: Z_BULKHEAD },
  ];
  for (const angle of TANK_ANGLES) {
    const cx = TANK_RING * Math.cos(angle);
    const cy = TANK_RING * Math.sin(angle);
    shapes.push({ kind: 'cylinder', cx, cy, r: TANK_R, z0: Z_TANKS, z1: Z_BULKHEAD });
    shapes.push({ kind: 'cylinder', cx, cy, r: TANK_R * 0.98, z0: 0.0, z1: Z_TANKS });
    const valley = angle + Math.PI / 3;
    const inner = TANK_RING * 0.62;
    const outer = SKIRT_R + 0.4;
    const radial: [number, number, number] = [Math.cos(valley), Math.sin(valley), 0];
    const tangent: [number, number, number] = [-Math.sin(valley), Math.cos(valley), 0];
    shapes.push({
      kind: 'box',
      centre: [radial[0] * ((inner + outer) / 2), radial[1] * ((inner + outer) / 2), (Z_TANKS + 1.2 + Z_BULKHEAD - 1.0) / 2],
      axes: [radial, [0, 0, 1], tangent],
      half: [(outer - inner) / 2, (Z_BULKHEAD - 1.0 - (Z_TANKS + 1.2)) / 2, 0.05],
    });
  }
  for (const side of [1, -1]) {
    // The hinge discs, as short cylinders standing out of the ring (along y, so as boxes).
    shapes.push({ kind: 'box', centre: [0, side * (CREW_R + 0.45), HINGE_Z], axes: [[1, 0, 0], [0, 1, 0], [0, 0, 1]], half: [0.9, 0.3, 0.9] });
  }
  return shapes;
}

const OCCLUDERS = occluders();

/** The sky-visibility pass for a built section: it writes into the geometry's own attribute. */
function occlusionJob(builder: PartBuilder, geometry: THREE.BufferGeometry): OcclusionJob {
  const detail = geometry.getAttribute('detail') as THREE.BufferAttribute;
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const normal = geometry.getAttribute('normal') as THREE.BufferAttribute;
  return new OcclusionJob(position.array, normal.array, builder.occludedRanges, OCCLUDERS, (i, value) => {
    (detail.array as Float32Array)[i * 4] = value;
  });
}

/** Time a slice of the occlusion pass may take, ms: under a frame's worth of idle. */
const OCCLUSION_SLICE_MS = 6;

// --- The crew section -------------------------------------------------------------------------

/** Where the five cables meet the crew section, crew-cruise coordinates: two at each hinge, one aft of the ring. */
function cableAnchors(): THREE.Vector3[] {
  const hingeOut = CREW_R + 0.55;
  return [
    new THREE.Vector3(0.45, hingeOut, HINGE_Z),
    new THREE.Vector3(-0.45, hingeOut, HINGE_Z),
    new THREE.Vector3(0.45, -hingeOut, HINGE_Z),
    new THREE.Vector3(-0.45, -hingeOut, HINGE_Z),
    // The fifth, off the hinge axis, keeps the section from swinging about it.
    new THREE.Vector3(-(CREW_R + 0.3), 0, HINGE_Z),
  ];
}

/** Where the five cables leave the Cable Faring's spools, cruise coordinates. */
function spoolPoints(): THREE.Vector3[] {
  return [80, 100, 280, 260, 180].map((deg) => {
    const phi = (deg * Math.PI) / 180;
    return new THREE.Vector3((CREW_R + 0.35) * Math.cos(phi), (CREW_R + 0.35) * Math.sin(phi), Z_FARING + CABLE_FARING_LENGTH_M - 0.3);
  });
}

/** The running lights: crew section's (crew-cruise coordinates) and the fuel section's. */
const CREW_LIGHTS: readonly { position: THREE.Vector3; finish: Finish }[] = [
  { position: new THREE.Vector3(-(CREW_R + 0.2), 0, HINGE_Z + 0.5), finish: LIGHT_RED },
  { position: new THREE.Vector3(CREW_R + 0.2, 0, HINGE_Z + 0.5), finish: LIGHT_GREEN },
  ...[0, 1, 2, 3].map((i) => {
    const phi = Math.PI / 4 + (i * Math.PI) / 2;
    const z = Z_NOSE - 2.3 + 0.62;
    const r = noseRadius(z) + 0.05;
    return { position: new THREE.Vector3(r * Math.cos(phi), r * Math.sin(phi), z), finish: LIGHT_WHITE };
  }),
];
const REAR_LIGHTS: readonly { position: THREE.Vector3; finish: Finish }[] = [
  { position: new THREE.Vector3(-(SKIRT_R + 0.2), 0, Z_BULKHEAD + 0.15), finish: LIGHT_RED },
  { position: new THREE.Vector3(SKIRT_R + 0.2, 0, Z_BULKHEAD + 0.15), finish: LIGHT_GREEN },
  ...TANK_ANGLES.map((angle) => {
    const valley = angle + Math.PI / 3;
    return { position: new THREE.Vector3((SKIRT_R + 0.4) * Math.cos(valley), (SKIRT_R + 0.4) * Math.sin(valley), Z_TANKS + 1.0), finish: LIGHT_WHITE };
  }),
];

function buildCrew(detail: Detail): PartBuilder {
  const b = new PartBuilder(SECTION.crew);
  const full = detail === 'full';
  const seg = full ? 72 : 20;

  // The pressure hull: storage, dormitory, lab -- in rows, so occlusion can vary along it.
  b.add(...frustum(CREW_R, CREW_R, Z_CREW, Z_CONE, seg, true, full ? 10 : 4), SILVER);
  // The nose cone, control room and Beetles inside it, to a sharp point.
  b.add(...frustum(CREW_R, 0.0, Z_CONE, Z_NOSE, seg, true, full ? 8 : 3), SILVER_FINE);
  // The aft bulkhead, where it meets the faring.
  b.add(...frustum(CREW_R, CREW_R * 0.98, Z_CREW - 0.12, Z_CREW, seg), DARK_METAL);
  if (full) {
    // The separation joint: hazard-striped, as a line not to stand across.
    b.add(...frustum(CREW_R + 0.012, CREW_R + 0.012, Z_CREW + 0.02, Z_CREW + 0.32, seg, true), HAZARD, SMALL);
  }

  // The ring with its two big hinges, at the lab and dormitory's boundary.
  b.add(...frustum(CREW_R + 0.14, CREW_R + 0.14, HINGE_Z - 0.35, HINGE_Z + 0.35, seg, false, full ? 3 : 1), DARK_METAL);
  for (const side of [1, -1]) {
    const disc = new THREE.CylinderGeometry(1.0, 1.0, 0.45, full ? 40 : 10);
    b.add(disc, new THREE.Matrix4().makeTranslation(0, side * (CREW_R + 0.38), HINGE_Z), GUNMETAL);
    b.add(new THREE.CylinderGeometry(0.42, 0.5, 0.8, full ? 24 : 8), new THREE.Matrix4().makeTranslation(0, side * (CREW_R + 0.55), HINGE_Z), TRIM, SMALL);
    if (full) {
      // Bolts round the disc, and the two cable eyes.
      for (let i = 0; i < 12; i += 1) {
        const a = (i / 12) * Math.PI * 2;
        b.add(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 6), new THREE.Matrix4().makeTranslation(0.8 * Math.cos(a), side * (CREW_R + 0.63), HINGE_Z + 0.8 * Math.sin(a)), TRIM, SMALL);
      }
      for (const dx of [0.45, -0.45]) {
        b.add(new THREE.TorusGeometry(0.16, 0.05, 6, 12), new THREE.Matrix4().makeTranslation(dx, side * (CREW_R + 0.95), HINGE_Z).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), DARK_METAL, SMALL);
      }
    }
  }
  if (full) {
    // The fifth cable's eye on the ring.
    b.add(...boxOn(surfaceFrame(Math.PI, HINGE_Z, CREW_R + 0.14, 0), 0.5, 0.5, 0.25), GUNMETAL, SMALL);
  }

  // The airlock, in the cone's wall at the control room: a docking collar and its hatch.
  const airlockZ = Z_CONE + 1.4;
  const airlockFrame = surfaceFrame(0, airlockZ, noseRadius(airlockZ), NOSE_SLOPE);
  b.add(...stalkOn(airlockFrame, 1.0, 0.9, full ? 40 : 10, -0.35), TRIM);
  b.add(...stalkOn(airlockFrame, 1.06, 0.14, full ? 40 : 10, 0.5), DARK_METAL, SMALL);
  if (full) {
    // Docking ring, its alignment guides, the outer hatch and its handrails.
    b.add(new THREE.TorusGeometry(0.98, 0.07, 8, 40), airlockFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.66)), GUNMETAL, SMALL);
    // A hazard-striped band round the hatch, where the docking collar closes.
    b.add(new THREE.RingGeometry(0.8, 0.92, 40), airlockFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.645)), HAZARD, SMALL);
    for (let i = 0; i < 3; i += 1) {
      const a = (i / 3) * Math.PI * 2 + 0.3;
      b.add(...boxOn(airlockFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0.9 * Math.cos(a), 0.9 * Math.sin(a), 0.6)), 0.22, 0.22, 0.35), DARK_METAL, SMALL);
    }
    b.add(new THREE.CylinderGeometry(0.78, 0.78, 0.06, 32), airlockFrame.clone().multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.58)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2)), { ...GUNMETAL, cavity: 0.7 }, SMALL);
    for (const dx of [-0.55, 0.55]) {
      b.add(...boxOn(surfaceFrame(0.18 * Math.sign(dx), airlockZ - 1.4, CREW_R, 0, 0.12), 0.05, 1.6, 0.05), DARK_METAL, SMALL);
    }
  }

  // The Beetles' four bays in the nose: hatches flush with the cone, hazard-edged.
  const beetleZ = Z_NOSE - 2.3;
  for (let i = 0; i < 4; i += 1) {
    const phi = Math.PI / 4 + (i * Math.PI) / 2;
    if (full) {
      b.add(...boxOn(surfaceFrame(phi, beetleZ, noseRadius(beetleZ), NOSE_SLOPE, -0.02), 0.8, 1.1, 0.045), HAZARD, SMALL);
      b.add(...boxOn(surfaceFrame(phi, beetleZ, noseRadius(beetleZ), NOSE_SLOPE, -0.02), 0.66, 0.96, 0.055), { ...DARK_METAL, cavity: 0.8 }, SMALL);
    } else {
      b.add(...boxOn(surfaceFrame(phi, beetleZ, noseRadius(beetleZ), NOSE_SLOPE, -0.02), 0.7, 1.0, 0.05), DARK_METAL, SMALL);
    }
  }

  if (full) {
    // The instruments, on the cone's far side from the airlock: a telescope looking ahead and
    // the Petrovascope beside it, wrapped in foil, on a short pylon.
    const instrumentFrame = surfaceFrame(Math.PI, Z_CONE + 0.9, noseRadius(Z_CONE + 0.9), NOSE_SLOPE);
    b.add(...boxOn(instrumentFrame, 0.9, 0.9, 0.5), GOLD_FOIL, SMALL);
    const scopeBase = new THREE.Vector3().setFromMatrixPosition(instrumentFrame);
    const outward = new THREE.Vector3(-1, 0, 0);
    const telescope = scopeBase.clone().addScaledVector(outward, 0.85).add(new THREE.Vector3(0, 0.25, 0));
    b.add(...tube(telescope.clone().add(new THREE.Vector3(0, 0, -0.4)), telescope.clone().add(new THREE.Vector3(0, 0, 1.4)), 0.32, 24), TRIM, SMALL);
    const rim = frustum(0.35, 0.35, telescope.z + 1.38, telescope.z + 1.48, 24);
    b.add(rim[0], at(telescope.x, telescope.y, rim[1]), GUNMETAL, SMALL);
    const lens = frustum(0.29, 0.29, telescope.z + 1.3, telescope.z + 1.36, 24);
    b.add(lens[0], at(telescope.x, telescope.y, lens[1]), LENS, SMALL);
    const scope2 = scopeBase.clone().addScaledVector(outward, 0.7).add(new THREE.Vector3(0, -0.45, 0));
    b.add(...tube(scope2.clone().add(new THREE.Vector3(0, 0, -0.3)), scope2.clone().add(new THREE.Vector3(0, 0, 0.9)), 0.2, 16), GOLD_FOIL, SMALL);
    const cap = frustum(0.2, 0.2, scope2.z + 0.88, scope2.z + 0.92, 16);
    b.add(cap[0], at(scope2.x, scope2.y, cap[1]), LENS, SMALL);
  }

  // Small spin drives for attitude: four pods round the storage deck.
  for (let i = 0; i < 4; i += 1) {
    const phi = Math.PI / 4 + (i * Math.PI) / 2;
    const frame = surfaceFrame(phi, Z_CREW + 0.6, CREW_R, 0);
    b.add(...boxOn(frame, 0.7, 0.8, 0.35), DARK_METAL, SMALL);
    if (full) {
      for (const [dx, dz] of [[0.36, 0], [-0.36, 0], [0, 0.24]] as const) {
        const emitter = frame.clone().multiply(new THREE.Matrix4().makeTranslation(dx, 0, 0.18 + dz));
        const turn = dz > 0 ? new THREE.Matrix4().makeRotationX(Math.PI / 2) : new THREE.Matrix4().makeRotationZ(Math.PI / 2);
        b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), emitter.multiply(turn), EMITTER, SMALL);
      }
    }
  }

  if (full) {
    // The Astrophage pipes along the crew hull, and the temperature sensors every few metres.
    for (const phi of [Math.PI * 0.62, Math.PI * 1.38]) {
      const a = new THREE.Vector3((CREW_R + 0.08) * Math.cos(phi), (CREW_R + 0.08) * Math.sin(phi), Z_CREW);
      const c = a.clone().setZ(Z_CONE - 0.2);
      b.add(...tube(a, c, 0.06, 8), RED_PIPE, SMALL);
      for (let z = Z_CREW + 1.5; z < Z_CONE; z += 3) {
        b.add(...boxOn(surfaceFrame(phi + 0.06, z, CREW_R, 0), 0.12, 0.12, 0.08), DARK_METAL, SMALL);
      }
    }
    // Handrails from the airlock aft, for EVAs along the hull.
    for (const phi of [-0.22, 0.22]) {
      for (let z = Z_CREW + 0.8; z < Z_CONE - 0.2; z += 1.6) {
        b.add(...boxOn(surfaceFrame(phi, z, CREW_R, 0, 0.1), 0.05, 1.3, 0.05), TRIM, SMALL);
        b.add(...boxOn(surfaceFrame(phi, z - 0.6, CREW_R, 0), 0.04, 0.04, 0.12), TRIM, SMALL);
      }
    }
    // Stencils: the ship's name and the deck behind each stretch of hull. Ours, generic.
    b.add(...decalOn(surfaceFrame(-0.75, Z_LAB + 2.4, CREW_R, 0), 2.6, 0.42), STENCIL, { ...SMALL, label: 'HAIL MARY' });
    b.add(...decalOn(surfaceFrame(-0.75, Z_LAB + 1.6, CREW_R, 0), 1.4, 0.26), STENCIL, { ...SMALL, label: 'LAB' });
    b.add(...decalOn(surfaceFrame(-0.75, Z_DORM + 1.4, CREW_R, 0), 2.0, 0.26), STENCIL, { ...SMALL, label: 'DORMITORY' });
    b.add(...decalOn(surfaceFrame(0.55, airlockZ - 1.55, CREW_R, 0), 1.6, 0.26), STENCIL, { ...SMALL, label: 'AIRLOCK' });
    // The running lights' housings (their glow is drawn as sprites, see createHailMary).
    for (const light of CREW_LIGHTS) {
      b.add(new THREE.SphereGeometry(0.1, 8, 6), new THREE.Matrix4().makeTranslation(light.position.x, light.position.y, light.position.z), light.finish, SMALL);
    }
  }
  return b;
}

// --- The fuel and drive section ---------------------------------------------------------------

function buildRear(detail: Detail): PartBuilder {
  const b = new PartBuilder(SECTION.rear);
  const full = detail === 'full';
  const seg = full ? 72 : 20;
  const tankSeg = full ? 48 : 14;

  // The Cable Faring: a drum, foil between the five spool housings.
  b.add(...frustum(CREW_R + 0.05, CREW_R + 0.05, Z_FARING, Z_FARING + CABLE_FARING_LENGTH_M, seg, true, full ? 4 : 1), GOLD_FOIL);
  b.add(...frustum(CREW_R + 0.15, CREW_R + 0.15, Z_FARING + CABLE_FARING_LENGTH_M - 0.15, Z_FARING + CABLE_FARING_LENGTH_M, seg, true), DARK_METAL);
  b.add(...frustum(CREW_R + 0.15, CREW_R + 0.15, Z_FARING, Z_FARING + 0.15, seg, true), DARK_METAL);
  for (const deg of [90, 270, 180, 18, 342]) {
    const phi = (deg * Math.PI) / 180;
    b.add(...boxOn(surfaceFrame(phi, Z_FARING + CABLE_FARING_LENGTH_M / 2, CREW_R, 0), 1.0, 1.7, 0.42), TRIM);
    if (full) {
      b.add(...stalkOn(surfaceFrame(phi, Z_FARING + CABLE_FARING_LENGTH_M / 2, CREW_R, 0, 0.42), 0.32, 0.12, 20), DARK_METAL, SMALL);
    }
  }

  // The skirt, widening to the tanks, and the bulkhead under it.
  const skirtSlope = -(SKIRT_R - CREW_R) / SKIRT_LENGTH_M;
  b.add(...frustum(SKIRT_R, CREW_R + 0.05, Z_SKIRT, Z_FARING, seg, true, full ? 6 : 3), SILVER);
  b.add(...frustum(SKIRT_R + 0.08, SKIRT_R + 0.08, Z_BULKHEAD, Z_SKIRT, seg), DARK_METAL);

  // The three tanks: nine fuel bays, three to a tank, with jettison rings between them.
  for (const [index, angle] of TANK_ANGLES.entries()) {
    const cx = TANK_RING * Math.cos(angle);
    const cy = TANK_RING * Math.sin(angle);
    const axis = [cx, cy] as const;
    const tank = frustum(TANK_R, TANK_R, Z_TANKS, Z_BULKHEAD, tankSeg, true, full ? 9 : 4);
    b.add(tank[0], at(cx, cy, tank[1]), TANK_SKIN, { axis });
    for (let bay = 1; bay < 3; bay += 1) {
      const z = Z_TANKS + (bay * FUEL_TANK_LENGTH_M) / 3;
      const ring = frustum(TANK_R + 0.07, TANK_R + 0.07, z - 0.12, z + 0.12, tankSeg, true);
      b.add(ring[0], at(cx, cy, ring[1]), full ? HAZARD : DARK_METAL, { axis, occluded: false });
      if (full) {
        // Explosive-bolt housings round each separation ring.
        for (let k = 0; k < 8; k += 1) {
          const phi = angle + Math.PI + ((k - 3.5) / 8) * Math.PI * 1.6;
          b.add(...boxOn(surfaceFrame(phi, z, TANK_R + 0.07, 0, 0, cx, cy), 0.22, 0.34, 0.1), GUNMETAL, { axis, occluded: false });
        }
      }
    }
    if (full) {
      // Each bay's number, stencilled on its tank's outer face.
      for (let bay = 0; bay < 3; bay += 1) {
        const z = Z_TANKS + ((bay + 0.5) * FUEL_TANK_LENGTH_M) / 3;
        const label = `BAY ${index * 3 + bay + 1}`;
        b.add(...decalOn(surfaceFrame(angle + 0.25, z, TANK_R, 0, 0, cx, cy), 1.2, 0.3), STENCIL, { axis, occluded: false, label });
      }
    }
    // The tank's aft dome, half hidden by the drive housing.
    const dome = new THREE.SphereGeometry(TANK_R, tankSeg, full ? 12 : 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
    b.add(dome, new THREE.Matrix4().makeTranslation(cx, cy, Z_TANKS).multiply(new THREE.Matrix4().makeScale(1, 1, 0.35)).multiply(UP_TO_Z), TANK_SKIN, { axis });

    // The spin drive under it: a housing, the drive plate, and its cells.
    const housing = frustum(TANK_R * 0.86, TANK_R * 0.98, 1.0, Z_TANKS, tankSeg, false, full ? 3 : 1);
    b.add(housing[0], at(cx, cy, housing[1]), GUNMETAL, { axis });
    const plate = frustum(TANK_R * 0.9, TANK_R * 0.9, 0.55, 1.0, tankSeg);
    b.add(plate[0], at(cx, cy, plate[1]), DARK_METAL, { axis });
    if (full) {
      // A hexagonal array of drive cells, faces aft.
      const cell = 0.34;
      const pitch = cell * Math.sqrt(3) + 0.04;
      for (let q = -4; q <= 4; q += 1) {
        for (let r = -4; r <= 4; r += 1) {
          const x = pitch * (q + r / 2);
          const y = pitch * ((r * Math.sqrt(3)) / 2);
          if (Math.hypot(x, y) > TANK_R * 0.82) continue;
          const hex = frustum(cell, cell, 0.06, 0.55, 6);
          b.add(hex[0], at(cx + x, cy + y, hex[1]), DRIVE_CELL, SMALL);
          const face = frustum(cell * 0.82, cell * 0.82, 0, 0.06, 6);
          b.add(face[0], at(cx + x, cy + y, face[1]), DRIVE_FACE, SMALL);
        }
      }
    } else {
      const face = frustum(TANK_R * 0.86, TANK_R * 0.86, 0, 0.55, tankSeg);
      b.add(face[0], at(cx, cy, face[1]), DRIVE_FACE, SMALL);
    }

    if (full) {
      // Red Astrophage pipes up the tank's outer face to the skirt, and sensors along them.
      for (const offset of [-0.35, 0.35]) {
        const phi = angle + offset;
        const a = new THREE.Vector3(cx + (TANK_R + 0.1) * Math.cos(phi), cy + (TANK_R + 0.1) * Math.sin(phi), 1.2);
        const c = a.clone().setZ(Z_BULKHEAD);
        b.add(...tube(a, c, 0.07, 8), RED_PIPE, SMALL);
        const top = new THREE.Vector3((CREW_R + 0.12) * Math.cos(angle + offset * 0.5), (CREW_R + 0.12) * Math.sin(angle + offset * 0.5), Z_FARING + CABLE_FARING_LENGTH_M);
        const skirtFoot = new THREE.Vector3((SKIRT_R + 0.1) * Math.cos(angle + offset * 0.4), (SKIRT_R + 0.1) * Math.sin(angle + offset * 0.4), Z_SKIRT);
        b.add(...tube(c, skirtFoot, 0.07, 8), RED_PIPE, SMALL);
        b.add(...tube(skirtFoot, top, 0.07, 8), RED_PIPE, SMALL);
      }
      for (let z = Z_TANKS + 1.5; z < Z_BULKHEAD; z += 3) {
        b.add(...boxOn(surfaceFrame(angle + 0.5, z, TANK_R, 0, 0, cx, cy), 0.14, 0.14, 0.09), DARK_METAL, { axis, occluded: false });
      }
    }
  }

  // The spine between the tanks, and the radiators in the valleys between them: the generators'
  // and life support's heat, shed edge-on to the drive.
  b.add(...frustum(1.1, 1.1, 0.8, Z_BULKHEAD, full ? 24 : 8, false, full ? 8 : 2), GUNMETAL);
  for (const angle of TANK_ANGLES) {
    const valley = angle + Math.PI / 3;
    const inner = TANK_RING * 0.62;
    const outer = SKIRT_R + 0.4;
    const radial = new THREE.Vector3(Math.cos(valley), Math.sin(valley), 0);
    const tangent = new THREE.Vector3(-Math.sin(valley), Math.cos(valley), 0);
    const height = Z_BULKHEAD - 1.0 - (Z_TANKS + 1.2);
    const centre = radial.clone().multiplyScalar((inner + outer) / 2).setZ((Z_TANKS + 1.2 + Z_BULKHEAD - 1.0) / 2);
    const panel = new THREE.Matrix4().makeBasis(radial, new THREE.Vector3(0, 0, 1), tangent).setPosition(centre);
    // Subdivided, so the occlusion between the tanks can grade across it.
    b.add(new THREE.BoxGeometry(outer - inner, height, 0.08, full ? 5 : 2, full ? 8 : 3, 1), panel, RADIATOR);
    if (full) {
      // Coolant ribs across the panel, and headers along its edges.
      for (let k = 1; k < 10; k += 1) {
        const z = Z_TANKS + 1.2 + (k * height) / 10;
        const a = centre.clone().addScaledVector(radial, -(outer - inner) / 2).setZ(z);
        const c = centre.clone().addScaledVector(radial, (outer - inner) / 2).setZ(z);
        for (const side of [1, -1]) {
          b.add(...tube(a.clone().addScaledVector(tangent, side * 0.05), c.clone().addScaledVector(tangent, side * 0.05), 0.025, 4), RADIATOR_RIB, SMALL);
        }
      }
      for (const along of [-(outer - inner) / 2, (outer - inner) / 2]) {
        const edge = centre.clone().addScaledVector(radial, along);
        b.add(...tube(edge.clone().setZ(Z_TANKS + 1.2), edge.clone().setZ(Z_BULKHEAD - 1.0), 0.07, 8), DARK_METAL, SMALL);
      }
    }
  }

  // Small spin drives for attitude on the skirt's foot.
  for (let i = 0; i < 3; i += 1) {
    const phi = TANK_ANGLES[i]! + Math.PI / 3;
    const frame = surfaceFrame(phi, Z_SKIRT + 0.8, SKIRT_R - 0.8 * -skirtSlope, skirtSlope);
    b.add(...boxOn(frame, 0.8, 0.9, 0.4), DARK_METAL, SMALL);
    if (full) {
      for (const dx of [0.42, -0.42]) {
        b.add(new THREE.CylinderGeometry(0.14, 0.14, 0.04, 12), frame.clone().multiply(new THREE.Matrix4().makeTranslation(dx, 0, 0.2)).multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2)), EMITTER, SMALL);
      }
    }
  }

  if (full) {
    b.add(...decalOn(surfaceFrame(Math.PI * 0.5, Z_FARING + CABLE_FARING_LENGTH_M / 2 + 1.1, CREW_R + 0.42, 0), 1.6, 0.24), STENCIL, { ...SMALL, label: 'CABLE' });
    for (const light of REAR_LIGHTS) {
      b.add(new THREE.SphereGeometry(0.12, 8, 6), new THREE.Matrix4().makeTranslation(light.position.x, light.position.y, light.position.z), light.finish, SMALL);
    }
  }
  return b;
}

/** The five cables: along the hull in cruise, paid out to the turned crew section in centrifuge mode. */
function buildCables(mode: 'cruise' | 'centrifuge'): PartBuilder {
  const b = new PartBuilder(SECTION.cables);
  const spools = spoolPoints();
  const anchors = cableAnchors();
  for (let i = 0; i < 5; i += 1) {
    const spool = spools[i]!;
    const anchor = mode === 'cruise' ? anchors[i]!.clone() : crewToCentrifuge(anchors[i]!.clone());
    if (mode === 'cruise') {
      // Stowed along the hull, from the spool's head up to the hinge.
      const out = anchor.clone().setZ(spool.z);
      b.add(...tube(spool, out, 0.035, 6), ZYLON, SMALL);
      b.add(...tube(out, anchor, 0.035, 6), ZYLON, SMALL);
    } else {
      b.add(...tube(spool, anchor, 0.035, 6), ZYLON, SMALL);
    }
  }
  return b;
}

/** A crew-section point, cruise coordinates, where centrifuge mode puts it: turned about the hinge axis (y), the hinge moved out. */
function crewToCentrifuge(point: THREE.Vector3): THREE.Vector3 {
  return point.set(-point.x, point.y, CENTRIFUGE.hingeZ - (point.z - HINGE_Z));
}

// --- The star's shadow ------------------------------------------------------------------------

/** Shadow map size: 1,024 over the ship's 44 m bounding sphere, a texel every 4 cm in cruise. */
export const SHADOW_MAP_SIZE = 1024;

/** Above this share of the view's half-height -- about 200 pixels -- the star casts shadows. */
export const SHADOWS_ABOVE = 0.37;

/**
 * The shadow map holds depth from the star packed into eight-bit RGBA (three's packing chunk):
 * thirty-two bits across the ship's depth. Stored as a half float it had a step of 6 cm at
 * 50 m, as coarse as the bias, and the hull shadowed itself in patches.
 */
const DEPTH_VERTEX = /* glsl */ `
  varying float vDepth;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const DEPTH_FRAGMENT = /* glsl */ `
  #include <packing>
  uniform vec2 uRange;
  varying float vDepth;
  void main() {
    gl_FragColor = packDepthToRGBA(clamp((vDepth - uRange.x) / (uRange.y - uRange.x), 0.0, 0.9999));
  }
`;

// --- The object -------------------------------------------------------------------------------

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** How the ship is flown: drives at the stern, or split and spinning for gravity. */
export type ShipMode = 'cruise' | 'centrifuge';

/** Below this share of the view's half-height -- about 50 pixels on a 1080-line screen -- the silhouette model is drawn. */
export const LOW_DETAIL_BELOW = 0.1;

const GLOW_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 color;
  uniform float uPixelsPerUnit;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    // A glow half a metre across, never less than three pixels: a light at a distance is a point.
    float radius = length((modelViewMatrix * vec4(0.5, 0.0, 0.0, 0.0)).xyz);
    gl_PointSize = clamp(2.0 * radius * uPixelsPerUnit / max(-viewPosition.z, 1e-6), 3.0, 48.0);
    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = exp(-d * d * 7.0) * 1.2 + exp(-d * d * 60.0) * 3.0;
    gl_FragColor = vec4(vColor * glow, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export interface HailMary {
  readonly object: THREE.Object3D;
  /**
   * Each frame it is drawn: the direction to the star (world space), the camera, and the light
   * of a nearby world on the ship's dark side if there is one (see Planetshine).
   */
  update(lightDirection: THREE.Vector3, camera: THREE.Camera, planetshine?: Planetshine): void;
  /**
   * Cruise, or centrifuge mode at a spin angle (radians, about the hinge axis, local y). In
   * centrifuge mode the crew section is turned round and 77 m out on its cables, the whole
   * turning about the common centre of mass -- which is the origin in either mode; the layer
   * advances `spinPhase` by CENTRIFUGE_SPIN_RAD_S a second. The model then spans about 2.6
   * ship lengths. The drives cannot fire while split, so their plates are cold.
   */
  setMode(mode: ShipMode, spinPhase?: number): void;
  /** Triangles drawn at each detail, for the record. */
  readonly triangles: { readonly full: number; readonly low: number };
  /** Finishes the occlusion pass at once, rather than in idle slices (a still picture, a test). */
  finishOcclusion(): void;
  dispose(): void;
}

export function createHailMary(): HailMary {
  const material = shipMaterial();
  const crewFull = buildCrew('full');
  const rearFull = buildRear('full');
  const crewLow = buildCrew('low');
  const rearLow = buildRear('low');
  const cruiseCables = buildCables('cruise');
  const centrifugeCables = buildCables('centrifuge');
  const triangles = {
    full: crewFull.triangles + rearFull.triangles + cruiseCables.triangles,
    low: crewLow.triangles + rearLow.triangles,
  };
  const geometries = {
    crewFull: crewFull.build(),
    rearFull: rearFull.build(),
    crewLow: crewLow.build(),
    rearLow: rearLow.build(),
    cruiseCables: cruiseCables.build(),
    centrifugeCables: centrifugeCables.build(),
  };

  // The sky visibility, in idle slices; each section's attribute is uploaded when it is done.
  const jobs: [OcclusionJob, THREE.BufferGeometry][] = [
    [occlusionJob(crewLow, geometries.crewLow), geometries.crewLow],
    [occlusionJob(rearLow, geometries.rearLow), geometries.rearLow],
    [occlusionJob(crewFull, geometries.crewFull), geometries.crewFull],
    [occlusionJob(rearFull, geometries.rearFull), geometries.rearFull],
  ];
  let disposed = false;
  const idle: (work: () => void) => void =
    typeof requestIdleCallback === 'function' ? (work) => requestIdleCallback(work, { timeout: 200 }) : (work) => setTimeout(work, 0);
  const occludeSlice = (): void => {
    if (disposed) return;
    const job = jobs[0];
    if (job === undefined) return;
    if (job[0].step(OCCLUSION_SLICE_MS)) {
      (job[1].getAttribute('detail') as THREE.BufferAttribute).needsUpdate = true;
      jobs.shift();
      renderDemand.request(1);
    }
    if (jobs.length > 0) idle(occludeSlice);
  };
  idle(occludeSlice);

  const crew = new THREE.Mesh(geometries.crewFull, material);
  const rear = new THREE.Mesh(geometries.rearFull, material);
  const cables = new THREE.Mesh(geometries.cruiseCables, material);
  crew.name = 'hail-mary-crew';
  rear.name = 'hail-mary-fuel-and-drives';
  cables.name = 'hail-mary-cables';

  // The running lights' glow: one draw of sprites, placed with the sections.
  const lights = [...REAR_LIGHTS.map((light) => ({ ...light, crew: false })), ...CREW_LIGHTS.map((light) => ({ ...light, crew: true }))];
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(lights.length * 3), 3));
  glowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(lights.flatMap((light) => light.finish.color.map((c) => c * 0.6)), 3));
  const glowMaterial = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms: { uPixelsPerUnit: { value: 500 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glows = new THREE.Points(glowGeometry, glowMaterial);
  glows.name = 'hail-mary-lights';
  glows.frustumCulled = false;
  const drawingSize = new THREE.Vector2();
  glows.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(drawingSize);
    // Pixels per view-space unit at unit distance: half the buffer's height over tan(fov / 2).
    glowMaterial.uniforms['uPixelsPerUnit']!.value = (drawingSize.y / 2) * camera.projectionMatrix.elements[5]!;
  };

  // Metres, z from the stern -> length one, centre of mass at the origin.
  const spin = new THREE.Group();
  spin.add(rear, crew, cables, glows);
  const model = new THREE.Group();
  model.scale.setScalar(1 / HAIL_MARY_LENGTH_M);
  model.add(spin);
  const object = new THREE.Group();
  object.name = 'hail-mary';
  object.add(model);

  // The star's shadow: the three sections again, sharing their geometry, drawn for depth from
  // the star into a small map, in the model's own frame (metres, centre of mass at the origin).
  const shadowTarget = new THREE.WebGLRenderTarget(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  const depthMaterial = new THREE.ShaderMaterial({
    vertexShader: DEPTH_VERTEX,
    fragmentShader: DEPTH_FRAGMENT,
    uniforms: { uRange: { value: new THREE.Vector2(0, 1) } },
    side: THREE.DoubleSide,
  });
  const shadowScene = new THREE.Scene();
  const proxies = [rear, crew, cables].map((mesh) => {
    const proxy = new THREE.Mesh(mesh.geometry, depthMaterial);
    proxy.matrixAutoUpdate = false;
    proxy.frustumCulled = false;
    shadowScene.add(proxy);
    return proxy;
  });
  const shadowCamera = new THREE.OrthographicCamera();
  const lightInModel = new THREE.Vector3(1, 0, 0);
  const lastLight = new THREE.Vector3();
  let shadowWanted = false;
  let shadowDirty = true;
  let shadowFrame = -1;
  const sectionMatrix = [new THREE.Matrix4(), new THREE.Matrix4(), new THREE.Matrix4()];
  const scratchQuaternion = new THREE.Quaternion();
  const scratchPosition = new THREE.Vector3();
  const scratchScale = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const farEnd = new THREE.Vector3();
  const clear = new THREE.Color();
  const previousClear = new THREE.Color();

  const drawShadow = (renderer: THREE.WebGLRenderer): void => {
    if (!shadowWanted) return;
    // Once a frame at most, and only when something moved.
    if (!shadowDirty || renderer.info.render.frame === shadowFrame) return;
    spin.updateMatrix();
    const meshes = [rear, crew, cables];
    for (let s = 0; s < 3; s += 1) {
      meshes[s]!.updateMatrix();
      sectionMatrix[s]!.multiplyMatrices(spin.matrix, meshes[s]!.matrix);
      proxies[s]!.geometry = meshes[s]!.geometry;
      proxies[s]!.matrix.copy(sectionMatrix[s]!);
    }
    // The bounds: from the stern to the crew section's far end, wherever the mode puts them.
    centre.set(0, 0, 0).applyMatrix4(sectionMatrix[0]!);
    farEnd.set(0, 0, mode === 'cruise' ? Z_NOSE : Z_CREW).applyMatrix4(sectionMatrix[1]!);
    const radius = centre.distanceTo(farEnd) / 2 + 8;
    centre.add(farEnd).multiplyScalar(0.5);
    shadowCamera.left = -radius;
    shadowCamera.right = radius;
    shadowCamera.top = radius;
    shadowCamera.bottom = -radius;
    shadowCamera.near = 0.1;
    shadowCamera.far = 2 * radius + 10;
    shadowCamera.position.copy(centre).addScaledVector(lightInModel, radius + 5);
    shadowCamera.up.set(Math.abs(lightInModel.y) < 0.9 ? 0 : 1, Math.abs(lightInModel.y) < 0.9 ? 1 : 0, 0);
    shadowCamera.lookAt(centre);
    shadowCamera.updateMatrixWorld();
    shadowCamera.updateProjectionMatrix();

    const previousTarget = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.getClearColor(previousClear);
    const previousAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    renderer.setRenderTarget(shadowTarget);
    // Empty texels are as far as the map holds: lit.
    (depthMaterial.uniforms['uRange']!.value as THREE.Vector2).set(shadowCamera.near, shadowCamera.far);
    (material.uniforms['uShadowRange']!.value as THREE.Vector2).set(shadowCamera.near, shadowCamera.far);
    renderer.setClearColor(clear.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace), 1);
    renderer.clear(true, true, false);
    renderer.render(shadowScene, shadowCamera);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClear, previousAlpha);
    renderer.autoClear = autoClear;

    const views = material.uniforms['uShadowView']!.value as THREE.Matrix4[];
    for (let s = 0; s < 3; s += 1) views[s]!.multiplyMatrices(shadowCamera.matrixWorldInverse, sectionMatrix[s]!);
    (material.uniforms['uShadowProjection']!.value as THREE.Matrix4).copy(shadowCamera.projectionMatrix);
    material.uniforms['uShadowMap']!.value = shadowTarget.texture;
    material.uniforms['uShadowTexel']!.value = 1 / SHADOW_MAP_SIZE;
    material.uniforms['uShadowOn']!.value = 1;
    material.uniformsNeedUpdate = true;
    shadowDirty = false;
    shadowFrame = renderer.info.render.frame;
  };
  // Whichever section is drawn first draws the shadow, before any of them reads it.
  for (const mesh of [rear, crew, cables]) {
    mesh.onBeforeRender = (renderer) => drawShadow(renderer);
  }

  let mode: ShipMode = 'cruise';
  let low = false;
  const glowPositions = glowGeometry.getAttribute('position') as THREE.BufferAttribute;
  const placeGlows = (): void => {
    crew.updateMatrix();
    lights.forEach((light, i) => {
      scratchPosition.copy(light.position);
      if (light.crew) scratchPosition.applyMatrix4(crew.matrix);
      glowPositions.setXYZ(i, scratchPosition.x, scratchPosition.y, scratchPosition.z);
    });
    glowPositions.needsUpdate = true;
  };
  const place = (phase: number): void => {
    if (mode === 'cruise') {
      crew.position.set(0, 0, 0);
      crew.rotation.set(0, 0, 0);
      spin.rotation.set(0, 0, 0);
      spin.position.set(0, 0, -CRUISE_CENTRE_OF_MASS_Z_M);
      cables.geometry = geometries.cruiseCables;
      cables.visible = !low;
      material.uniforms['uDriveGlow']!.value = 1;
    } else {
      // Turned about the hinge axis: (x, z) -> (-x, 2 hinge' - z), the hinge moved out.
      crew.rotation.set(0, Math.PI, 0);
      crew.position.set(0, 0, CENTRIFUGE.hingeZ + HINGE_Z);
      // About the centrifuge's own centre of mass: turned by the phase, then the centre to the origin.
      spin.rotation.set(0, phase, 0);
      spin.position.set(0, 0, -CENTRIFUGE.centreZ).applyAxisAngle(Y_AXIS, phase);
      cables.geometry = geometries.centrifugeCables;
      cables.visible = true;
      material.uniforms['uDriveGlow']!.value = 0;
    }
    placeGlows();
    shadowDirty = true;
  };
  place(0);

  const objectPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  return {
    object,
    triangles,
    update(lightDirection, camera, planetshine) {
      setShipLight(material, lightDirection, camera, planetshine);
      // Detail from how much of the view the ship spans: its length over its distance against
      // the view's half-height.
      object.getWorldPosition(objectPosition);
      camera.getWorldPosition(cameraPosition);
      const length = object.matrixWorld.getMaxScaleOnAxis() * (mode === 'cruise' ? 1 : 2.6);
      const distance = Math.max(objectPosition.distanceTo(cameraPosition), 1e-9);
      const halfView = camera instanceof THREE.PerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) : 1;
      const share = length / distance / halfView;
      const nowLow = share < LOW_DETAIL_BELOW;
      if (nowLow !== low) {
        low = nowLow;
        crew.geometry = low ? geometries.crewLow : geometries.crewFull;
        rear.geometry = low ? geometries.rearLow : geometries.rearFull;
        if (mode === 'cruise') cables.visible = !low;
        // The glows stay: at a few pixels the running lights are what is seen of the ship.
      }
      // The shadow: wanted only while large; redrawn when the star moves against the ship.
      shadowWanted = share > SHADOWS_ABOVE;
      if (!shadowWanted) {
        if (material.uniforms['uShadowOn']!.value !== 0) {
          material.uniforms['uShadowOn']!.value = 0;
        }
        return;
      }
      model.updateWorldMatrix(true, false);
      model.matrixWorld.decompose(scratchPosition, scratchQuaternion, scratchScale);
      lightInModel.copy(lightDirection).applyQuaternion(scratchQuaternion.invert()).normalize();
      if (lightInModel.distanceToSquared(lastLight) > 1e-8) {
        lastLight.copy(lightInModel);
        shadowDirty = true;
      }
    },
    setMode(next, spinPhase = 0) {
      mode = next;
      place(spinPhase);
    },
    finishOcclusion() {
      for (const [job, geometry] of jobs) {
        job.step();
        (geometry.getAttribute('detail') as THREE.BufferAttribute).needsUpdate = true;
      }
      jobs.length = 0;
    },
    dispose() {
      disposed = true;
      for (const geometry of Object.values(geometries)) geometry.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      depthMaterial.dispose();
      shadowTarget.dispose();
    },
  };
}
