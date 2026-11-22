import * as THREE from 'three';

import { gltfLoader, modelUrl } from '../../craftModels.ts';
import { type Planetshine, type ShipFinish, MARKING } from './shipMaterial.ts';
import { type RigLight, createShipRig, packedShipGeometry } from './shipRig.ts';

export { planetshineStrength, type Planetshine } from './shipMaterial.ts';
export { LOW_DETAIL_BELOW, SHADOW_MAP_SIZE, SHADOWS_ABOVE } from './shipRig.ts';

/**
 * The Hail Mary (Andy Weir, *Project Hail Mary*, 2021), drawn from a fan-made model of the ship
 * as the 2026 film shows it, given to the project, simplified for the app and fitted to the
 * scene's own lighting.
 *
 * **The file** (web/public/models/fiction/hail-mary.glb) was built from the 693,225-triangle
 * source by a script kept outside the repository: node transforms baked in; turned so the long
 * axis is +z, bow forward, stern at z = 0, in metres, 40 m long; welded on position; each part
 * simplified with meshoptimizer to an absolute error -- 5 cm for the full model, 80 cm for the
 * silhouette -- with the seams between materials locked so panels cannot crack, components
 * smaller than the error pruned, and the source's own normals carried onto the simplified
 * vertices (split at 35 degree creases where it has none), so a cylinder of a dozen faces still
 * shades as round; ambient occlusion baked into COLOR_0; positions and normals quantised and
 * meshopt-compressed. 45,835 triangles full, 5,780 for the silhouette, 552 KB.
 *
 * **It is drawn with our ship shader** (shipMaterial.ts), not the file's materials: each of
 * the model's materials is mapped to one of our finishes by its colour, metalness and
 * roughness (FINISHES), so the lighting modes, the star's shadow map, the baked occlusion,
 * planetshine and the Fresnel rim all apply.
 *
 * **Its sections.** The model's three nodes: the ship (drum, outer cylinders, radiators), the
 * habitat column (the crew section, its own node in the file), and the lines running from the
 * drum up the column. Centrifuge mode turns the habitat column 180 degrees about its aft end and
 * pays it out on five Zylon cables, as the novel describes; the lines stay with the ship.
 *
 * Loaded lazily, the first time the ship is updated (drawn), through the app's glTF loader and
 * three's meshopt decoder (craftModels.ts). Until it arrives only the running lights show.
 */

// --- Dimensions -------------------------------------------------------------------------------

/** Hull length, stern to bow tip. Canon, derived: Grace calls 20 m "half the length of the ship". */
export const HAIL_MARY_LENGTH_M = 40;

/**
 * The model's overall extent at that length, measured from the file: the radiator array spans
 * 46.6 m tip to tip across the ship, and the outer cylinders 11.3 m.
 */
export const RADIATOR_SPAN_M = 46.6;
export const HULL_WIDTH_M = 11.3;

/** Where the habitat column (the crew section) starts, from the stern. Measured from the model. */
export const CREW_AFT_Z_M = 13.3;

/** The control room's place on the column: its widest module, from the stern. Our reading of the model. */
export const CONTROL_ROOM_Z_M = 26;

/** Astrophage at launch. Summaries of the novel: about two million kilograms. */
export const FUEL_MASS_KG = 2e6;

/** Astrophage left at tau Ceti, used for the centre of mass. Invented: canon gives none. */
export const FUEL_AT_TAU_CETI_KG = 3e5;

/** Crew section (the habitat column) mass. Invented: pressurised modules on a spine. */
export const CREW_SECTION_MASS_KG = 6e4;

/** Everything else, dry: drum, drives, cylinders, radiators. Invented. */
export const FUEL_SECTION_DRY_MASS_KG = 1.8e5;

/** Control room to the centre of mass in centrifuge mode, cables fully out. Canon: 75 m. */
export const CENTRIFUGE_CONTROL_ROOM_RADIUS_M = 75;

/** The gravity the centrifuge is set for, at the control room. Canon: the design gives one g. */
export const CENTRIFUGE_GRAVITY_M_S2 = 9.80665;

/** The model's file, under web/public/models. */
export const HAIL_MARY_MODEL = 'fiction/hail-mary.glb';

const Z_NOSE = HAIL_MARY_LENGTH_M;
const HINGE_Z = CREW_AFT_Z_M;
/** The crew section's centre of mass: its modules sit around the control room. */
const CREW_CENTRE_Z = 25;
/** The fuel in the outer cylinders, and the dry mass about the drum. Read off the model. */
const FUEL_CENTRE_Z = 20;
const REAR_DRY_CENTRE_Z = 10;

/** The cruise centre of mass, from the stern (metres), with the fuel left at tau Ceti. */
export const CRUISE_CENTRE_OF_MASS_Z_M =
  (CREW_SECTION_MASS_KG * CREW_CENTRE_Z +
    FUEL_SECTION_DRY_MASS_KG * REAR_DRY_CENTRE_Z +
    FUEL_AT_TAU_CETI_KG * FUEL_CENTRE_Z) /
  (CREW_SECTION_MASS_KG + FUEL_SECTION_DRY_MASS_KG + FUEL_AT_TAU_CETI_KG);

/**
 * Centrifuge mode, worked out from the above.
 *
 * The habitat column turns 180 degrees about its aft end (its nose toward the rest of the
 * ship) and rides out on the cables until the control room is 75 m from the common centre of
 * mass, the novel's figure: the cables come out at about 100 m, Lokken's "hundred metres of separation". The spin is set for one g at the
 * control room: about 3.5 turns a minute, inside the 4 rpm usually given as the limit people
 * adapt to without motion sickness (Hall 1999). The rest of the column, further out, feels a
 * little more -- the gradient Grace notices with his pendulum.
 */
function centrifugeLayout(): { hingeZ: number; centreZ: number; spin: number } {
  const rearMass = FUEL_SECTION_DRY_MASS_KG + FUEL_AT_TAU_CETI_KG;
  const rearCentre = (FUEL_SECTION_DRY_MASS_KG * REAR_DRY_CENTRE_Z + FUEL_AT_TAU_CETI_KG * FUEL_CENTRE_Z) / rearMass;
  const total = rearMass + CREW_SECTION_MASS_KG;
  // Turned about the hinge, a crew point at cruise z lands at hinge - (z - HINGE_Z).
  const crewCentreOffset = CREW_CENTRE_Z - HINGE_Z;
  const controlOffset = CONTROL_ROOM_Z_M - HINGE_Z;
  const share = CREW_SECTION_MASS_KG / total;
  // control - centre = 75 with control = h - controlOffset, centre = (rear + crew (h - crewOffset)) / total.
  const hingeZ =
    (CENTRIFUGE_CONTROL_ROOM_RADIUS_M + controlOffset + (rearMass * rearCentre - CREW_SECTION_MASS_KG * crewCentreOffset) / total) /
    (1 - share);
  const centreZ = (rearMass * rearCentre + CREW_SECTION_MASS_KG * (hingeZ - crewCentreOffset)) / total;
  return { hingeZ, centreZ, spin: Math.sqrt(CENTRIFUGE_GRAVITY_M_S2 / CENTRIFUGE_CONTROL_ROOM_RADIUS_M) };
}

const CENTRIFUGE = centrifugeLayout();

/** Cable length paid out in centrifuge mode, the drum's front to the column's aft end (metres). */
export const CENTRIFUGE_CABLE_LENGTH_M = CENTRIFUGE.hingeZ - CREW_AFT_Z_M;

/** Spin rate in centrifuge mode, rad/s: one g at the control room. */
export const CENTRIFUGE_SPIN_RAD_S = CENTRIFUGE.spin;

/** The same, in turns a minute. */
export const CENTRIFUGE_RPM = (CENTRIFUGE_SPIN_RAD_S * 60) / (2 * Math.PI);

// --- Finishes ---------------------------------------------------------------------------------

const WHITE_PAINT: ShipFinish = { color: [0.8, 0.8, 0.74], metal: 0, rough: 0.6, pattern: MARKING.weathered };
const DARK_PAINT: ShipFinish = { color: [0.045, 0.045, 0.05], metal: 0, rough: 0.55 };
const GREY_PAINT: ShipFinish = { color: [0.42, 0.42, 0.42], metal: 0, rough: 0.6, pattern: MARKING.weathered };

/**
 * The model's materials, by name, as our finishes. Its colours are kept where they read: the
 * warm white of the hull, the gold, the radiators' deep blue, the blue of its lights. Its
 * metals keep their tone with a satin response; the "black metal" of its bands is drawn as the
 * dark paint it looks like.
 */
export const FINISHES: Readonly<Record<string, ShipFinish>> = {
  // Warm white, rough: the hull's paint.
  mat_0: WHITE_PAINT,
  mat_5: WHITE_PAINT,
  mat_7: WHITE_PAINT,
  // Black, rough: the dark bands.
  mat_10: DARK_PAINT,
  mat_4: DARK_PAINT,
  // Mid grey, unlit-looking: grey paint.
  mat_13: GREY_PAINT,
  // Greys with metalness: fittings and trusses, satin metal.
  mat_3: { color: [0.5, 0.49, 0.47], metal: 0.6, rough: 0.38, aniso: 0.3 },
  mat_2: { color: [0.82, 0.82, 0.82], metal: 0.55, rough: 0.26, aniso: 0.4 },
  mat_14: { color: [0.56, 0.56, 0.56], metal: 0.6, rough: 0.18, aniso: 0.4 },
  mat_9: { color: [0.32, 0.32, 0.33], metal: 0.5, rough: 0.25 },
  mat_18: { color: [0.55, 0.55, 0.55], metal: 0.55, rough: 0.5 },
  mat_17: { color: [0.5, 0.5, 0.5], metal: 0.8, rough: 0.22 },
  // Gold: foil at the joints, crinkled.
  mat_15: { color: [1.0, 0.76, 0.3], metal: 1, rough: 0.22, pattern: MARKING.foil },
  // Bronze and copper: the bells and fittings.
  mat_21: { color: [0.9, 0.68, 0.25], metal: 0.8, rough: 0.25, aniso: 0.4 },
  mat_19: { color: [0.85, 0.48, 0.18], metal: 0.7, rough: 0.3 },
  // The radiators' deep blue.
  mat_20: { color: [0.02, 0.03, 0.11], metal: 0.3, rough: 0.4 },
  // Blue: lamps and lenses.
  mat_1: { color: [0.06, 0.32, 0.65], metal: 0, rough: 0.45, glow: 0.4 },
};

/** A finish for a material the table does not know: grey paint. */
const UNKNOWN: ShipFinish = GREY_PAINT;

/** Zylon is golden-yellow. */
const ZYLON: ShipFinish = { color: [0.8, 0.6, 0.22], metal: 0, rough: 0.6 };

/** The shader's table of finishes: each distinct one once. A vertex carries its index here. */
const FINISH_TABLE: readonly ShipFinish[] = [...new Set([...Object.values(FINISHES), UNKNOWN, ZYLON])];

// --- Building our geometry from the file's ------------------------------------------------------

/** Section ids, for the shadow map's per-section transforms. */
const SECTION = { rear: 0, crew: 1, cables: 2 } as const;

/** The file's node names, full and silhouette. */
const NODES = {
  rear: 'Main_Ship',
  lines: 'Main_Habitat_Lines',
  crew: 'Habitat',
} as const;

/**
 * Merges every mesh under `root` into one indexed geometry in our ship shader's layout:
 * positions (dequantised, in the file's frame), the file's normals as sixteen-bit integers,
 * and four bytes of detail -- the baked occlusion from COLOR_0, the finish's index in the table,
 * the section id. Typed arrays throughout.
 */
export function shipGeometry(root: THREE.Object3D | undefined, section: number): THREE.BufferGeometry {
  const meshes: THREE.Mesh[] = [];
  root?.traverse((node) => {
    if ((node as THREE.Mesh).isMesh === true) meshes.push(node as THREE.Mesh);
  });
  let vertexCount = 0;
  let indexCount = 0;
  for (const mesh of meshes) {
    const count = mesh.geometry.getAttribute('position').count;
    vertexCount += count;
    indexCount += mesh.geometry.index?.count ?? count;
  }
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Int16Array(vertexCount * 4);
  const detail = new Uint8Array(vertexCount * 4);
  const indices = vertexCount > 65535 ? new Uint32Array(indexCount) : new Uint16Array(indexCount);

  // In the file's frame -- the scene the node hangs from -- so the node's own transform, which
  // carries the dequantisation of its positions, is applied with the rest.
  const frame = root?.parent ?? root;
  frame?.updateWorldMatrix(true, true);
  const rootInverse = frame === undefined || frame === null ? new THREE.Matrix4() : frame.matrixWorld.clone().invert();
  const local = new THREE.Matrix4();
  const normalMatrix = new THREE.Matrix3();
  let vertexBase = 0;
  let indexBase = 0;
  for (const mesh of meshes) {
    const geometry = mesh.geometry;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const finishIndex = FINISH_TABLE.indexOf(FINISHES[material?.name ?? ''] ?? UNKNOWN);
    local.multiplyMatrices(rootInverse, mesh.matrixWorld);
    normalMatrix.getNormalMatrix(local);
    const m = local.elements;
    const k = normalMatrix.elements;
    const position = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined;
    const colour = geometry.getAttribute('color') as THREE.BufferAttribute | undefined;
    for (let i = 0; i < position.count; i += 1) {
      const x = position.getX(i);
      const y = position.getY(i);
      const z = position.getZ(i);
      const o = (vertexBase + i) * 3;
      positions[o] = m[0]! * x + m[4]! * y + m[8]! * z + m[12]!;
      positions[o + 1] = m[1]! * x + m[5]! * y + m[9]! * z + m[13]!;
      positions[o + 2] = m[2]! * x + m[6]! * y + m[10]! * z + m[14]!;
      const q = (vertexBase + i) * 4;
      if (normal === undefined) {
        normals[q + 2] = 32767;
      } else {
        const nx = normal.getX(i);
        const ny = normal.getY(i);
        const nz = normal.getZ(i);
        const tx = k[0]! * nx + k[3]! * ny + k[6]! * nz;
        const ty = k[1]! * nx + k[4]! * ny + k[7]! * nz;
        const tz = k[2]! * nx + k[5]! * ny + k[8]! * nz;
        const scale = 32767 / (Math.hypot(tx, ty, tz) || 1);
        normals[q] = Math.round(tx * scale);
        normals[q + 1] = Math.round(ty * scale);
        normals[q + 2] = Math.round(tz * scale);
      }
      detail[q] = Math.round((colour === undefined ? 1 : colour.getX(i)) * 255);
      detail[q + 1] = finishIndex;
      detail[q + 2] = section;
    }
    const index = geometry.index;
    if (index === null) {
      for (let i = 0; i < position.count; i += 1) indices[indexBase + i] = vertexBase + i;
      indexBase += position.count;
    } else {
      for (let i = 0; i < index.count; i += 1) indices[indexBase + i] = vertexBase + index.getX(i);
      indexBase += index.count;
    }
    vertexBase += position.count;
  }
  return packedShipGeometry(positions, normals, detail, indices);
}

/** The five Zylon cables of centrifuge mode, from the drum's front to the turned column's aft end. */
function cableGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const segments = 6;
  const radius = 0.035;
  const turned = (point: THREE.Vector3): THREE.Vector3 => point.set(-point.x, point.y, CENTRIFUGE.hingeZ - (point.z - HINGE_Z));
  for (let i = 0; i < 5; i += 1) {
    const a = (i / 5) * Math.PI * 2;
    // From spools round the column's foot on the ship, to eyes round its aft end on the column.
    const spool = new THREE.Vector3(2.2 * Math.cos(a), 2.2 * Math.sin(a), CREW_AFT_Z_M - 0.4);
    const eye = turned(new THREE.Vector3(1.3 * Math.cos(a), 1.3 * Math.sin(a), CREW_AFT_Z_M + 0.3));
    const along = new THREE.Vector3().subVectors(eye, spool);
    const length = along.length();
    along.normalize();
    const side = new THREE.Vector3().crossVectors(along, Math.abs(along.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(side, along);
    const base = positions.length / 3;
    for (let k = 0; k <= segments; k += 1) {
      const t = (k / segments) * Math.PI * 2;
      const n = side.clone().multiplyScalar(Math.cos(t)).addScaledVector(up, Math.sin(t));
      for (const end of [0, length]) {
        const p = spool.clone().addScaledVector(along, end).addScaledVector(n, radius);
        positions.push(p.x, p.y, p.z);
        normals.push(n.x, n.y, n.z);
      }
    }
    for (let k = 0; k < segments; k += 1) {
      const p = base + k * 2;
      indices.push(p, p + 2, p + 1, p + 1, p + 2, p + 3);
    }
  }
  const count = positions.length / 3;
  const packedNormals = new Int16Array(count * 4);
  const detail = new Uint8Array(count * 4);
  const zylon = FINISH_TABLE.indexOf(ZYLON);
  for (let i = 0; i < count; i += 1) {
    for (let c = 0; c < 3; c += 1) packedNormals[i * 4 + c] = Math.round(normals[i * 3 + c]! * 32767);
    detail.set([255, zylon, SECTION.cables, 0], i * 4);
  }
  return packedShipGeometry(new Float32Array(positions), packedNormals, detail, new Uint16Array(indices));
}

// --- The object -------------------------------------------------------------------------------

const Y_AXIS = new THREE.Vector3(0, 1, 0);

/** How the ship is flown: drives at the stern, or split and spinning for gravity. */
export type ShipMode = 'cruise' | 'centrifuge';

/** The ship's widest extent against its length, for how much of the view it fills: the radiators. */
const CRUISE_SPAN = RADIATOR_SPAN_M / HAIL_MARY_LENGTH_M;
const CENTRIFUGE_SPAN = (CENTRIFUGE.hingeZ + 1) / HAIL_MARY_LENGTH_M;

/**
 * The running lights: red and green at the radiator tips, port and starboard, white strobes at
 * the bow tip and the stern -- places the model leaves bare, so ours do not sit on its detail.
 */
const LIGHTS: readonly RigLight[] = [
  { position: new THREE.Vector3(0, -(RADIATOR_SPAN_M / 2 + 0.3), 4.5), color: [1.0, 0.06, 0.03], section: SECTION.rear },
  { position: new THREE.Vector3(0, RADIATOR_SPAN_M / 2 + 0.3, 4.5), color: [0.05, 1.0, 0.15], section: SECTION.rear },
  { position: new THREE.Vector3(0, 0, Z_NOSE + 0.25), color: [1.0, 0.97, 0.9], section: SECTION.crew },
  { position: new THREE.Vector3(0, 2.6, 0.2), color: [1.0, 0.97, 0.9], section: SECTION.rear },
];

export interface HailMary {
  readonly object: THREE.Object3D;
  /**
   * Each frame it is drawn: the direction to the star (world space), the camera, the light of
   * a nearby world on the ship's dark side if there is one (see Planetshine), and the lighting
   * mode's star and ambient irradiance (shading.ts LIGHTING; Natural if absent). The first call
   * starts loading the model.
   */
  update(
    lightDirection: THREE.Vector3,
    camera: THREE.Camera,
    planetshine?: Planetshine,
    lighting?: { readonly sun: number; readonly ambient: number },
  ): void;
  /**
   * Cruise, or centrifuge mode at a spin angle (radians, about local y). In centrifuge mode the
   * habitat column is turned round and about 100 m out on its cables, the whole turning about
   * the common centre of mass -- which is the origin in either mode; the layer advances
   * `spinPhase` by CENTRIFUGE_SPIN_RAD_S a second. The model then spans about 2.9 ship lengths.
   */
  setMode(mode: ShipMode, spinPhase?: number): void;
  /** Resolves once the model is in (or failed to come), for a test or a still picture. */
  readonly loaded: Promise<void>;
  /** Triangles drawn at each detail, once loaded. */
  readonly triangles: { full: number; low: number };
  dispose(): void;
}

/** What the model file gives: its scene, its nodes named as in the file. */
export type LoadModel = () => Promise<THREE.Object3D>;

const loadFromFile: LoadModel = () => gltfLoader().then((loader) => loader.loadAsync(modelUrl(HAIL_MARY_MODEL)).then((gltf) => gltf.scene));

export function createHailMary(load: LoadModel = loadFromFile): HailMary {
  const rig = createShipRig({
    name: 'hail-mary',
    sectionNames: ['hail-mary-fuel-and-drives', 'hail-mary-crew', 'hail-mary-cables'],
    lightsName: 'hail-mary-lights',
    lights: LIGHTS,
    lengthM: HAIL_MARY_LENGTH_M,
    finishes: FINISH_TABLE,
  });
  const [rear, crew, cables] = rig.sections as [THREE.Mesh, THREE.Mesh, THREE.Mesh];
  const empty = rear.geometry;
  const geometries: Record<string, THREE.BufferGeometry> = {
    crewFull: empty,
    rearFull: empty,
    crewLow: empty,
    rearLow: empty,
    linesFull: empty,
    linesLow: empty,
    centrifugeCables: cableGeometry(),
  };
  const triangles = { full: 0, low: 0 };
  let mode: ShipMode = 'cruise';

  const showDetail = (): void => {
    const low = rig.low;
    crew.geometry = low ? geometries['crewLow']! : geometries['crewFull']!;
    rear.geometry = low ? geometries['rearLow']! : geometries['rearFull']!;
    cables.geometry = mode === 'centrifuge' ? geometries['centrifugeCables']! : low ? geometries['linesLow']! : geometries['linesFull']!;
  };
  rig.onDetail = showDetail;
  const place = (phase: number): void => {
    const spin = rig.spin;
    if (mode === 'cruise') {
      crew.position.set(0, 0, 0);
      crew.rotation.set(0, 0, 0);
      spin.rotation.set(0, 0, 0);
      spin.position.set(0, 0, -CRUISE_CENTRE_OF_MASS_Z_M);
    } else {
      // Turned about the column's aft end: (x, z) -> (-x, 2 hinge' - z), the hinge moved out.
      crew.rotation.set(0, Math.PI, 0);
      crew.position.set(0, 0, CENTRIFUGE.hingeZ + HINGE_Z);
      // About the centrifuge's own centre of mass: turned by the phase, then the centre to the origin.
      spin.rotation.set(0, phase, 0);
      spin.position.set(0, 0, -CENTRIFUGE.centreZ).applyAxisAngle(Y_AXIS, phase);
    }
    showDetail();
    rig.moved();
  };
  place(0);

  // The model, fetched on the first update.
  let disposed = false;
  let requested = false;
  let resolveLoaded: () => void = () => {};
  const loaded = new Promise<void>((resolve) => {
    resolveLoaded = resolve;
  });
  const fetchModel = (): void => {
    requested = true;
    load()
      .then((scene) => {
        if (disposed) return;
        const find = (name: string): THREE.Object3D | undefined => scene.getObjectByName(name);
        geometries['rearFull'] = shipGeometry(find(NODES.rear), SECTION.rear);
        geometries['crewFull'] = shipGeometry(find(NODES.crew), SECTION.crew);
        geometries['linesFull'] = shipGeometry(find(NODES.lines), SECTION.cables);
        geometries['rearLow'] = shipGeometry(find(`${NODES.rear}_LOW`), SECTION.rear);
        geometries['crewLow'] = shipGeometry(find(`${NODES.crew}_LOW`), SECTION.crew);
        geometries['linesLow'] = shipGeometry(find(`${NODES.lines}_LOW`), SECTION.cables);
        const count = (g: THREE.BufferGeometry): number => (g.index?.count ?? 0) / 3;
        triangles.full = count(geometries['rearFull']!) + count(geometries['crewFull']!) + count(geometries['linesFull']!);
        triangles.low = count(geometries['rearLow']!) + count(geometries['crewLow']!) + count(geometries['linesLow']!);
        showDetail();
        rig.setReady();
      })
      .catch(() => {
        // Left at its lights; the layer's marker stands in.
      })
      .finally(() => resolveLoaded());
  };

  return {
    object: rig.object,
    triangles,
    loaded,
    update(lightDirection, camera, planetshine, lighting) {
      if (!requested) fetchModel();
      rig.update(lightDirection, camera, planetshine, lighting, mode === 'cruise' ? CRUISE_SPAN : CENTRIFUGE_SPAN);
    },
    setMode(next, spinPhase = 0) {
      mode = next;
      place(spinPhase);
    },
    dispose() {
      disposed = true;
      for (const geometry of Object.values(geometries)) geometry.dispose();
      rig.dispose();
    },
  };
}
