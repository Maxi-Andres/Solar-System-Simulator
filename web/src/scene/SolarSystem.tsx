import type { BodyDefinition, BodyId, CraftShape } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { LightingMode } from '../state/store.ts';
import type { SimClock } from '../core/time.ts';
import { stateToOsculatingElements } from '../core/kepler.ts';
import {
  ATMOSPHERE_SEGMENTS,
  atmosphereMaterial,
  atmosphereRadiusRatio,
  configureAtmosphere,
} from './atmosphere.ts';
import {
  applyCloudDensity,
  applyEarthExtras,
  cloudDriftDeg,
  cloudDriftDegPerDay,
  CLOUD_SEGMENTS,
  CLOUD_TOP_ALTITUDE_KM,
  EARTH_CLOUD_MAP,
  EARTH_NIGHT_MAP,
  EARTH_WATER_MASK,
  earthExtrasUniforms,
  WATER_IOR,
  type EarthExtrasUniforms,
} from './earthExtras.ts';
import { bodiesToResolve, isShown, isSmallMoon } from './floatingOrigin.ts';
import { markerTexture, type MarkerShape } from './markerTexture.ts';
import { MarkerInstances } from './markerInstances.ts';
import { bodyFixedOrientation, bodyOrientation } from './orientation.ts';
import { OrbitLine, orbitUnseenKm, ViewChange } from './orbitGeometry.ts';
import { sphereGeometry } from './sphereGeometry.ts';
import { compileWithMap } from './mapCompile.ts';
import { ringGeometry } from './ringGeometry.ts';
import { cloudTopDriftDeg, cloudTopDriftRateDegPerDay, cloudTopMapOffset } from './cloudRotation.ts';
import { degPerDayToRadPerSec, pixelsPerRadian, solarSystemRate, surfaceRate, transverseRate } from './screenMotion.ts';
import { satelliteSwarmRate } from './satelliteMotion.ts';
import { drawnTexture, mapColourGain } from './drawnTexture.ts';
import { MAX_RING_ALPHA, ringMaterial } from './ringMaterial.ts';
import { ringFlatRadianceFactor, ringShadowSettings, ringStripTexture } from './ringBands.ts';
import { applyRingShadow, type RingShadowUniforms } from './ringShadow.ts';
import {
  applyEclipseShadow,
  EclipseSelector,
  mayShadow,
  occludingRadiusKm,
  type EclipseUniforms,
} from './eclipseShadow.ts';
import { LIGHTING } from './shading.ts';
import {
  glareLevel,
  glareRadiusDeg,
  glareWorldRadius,
  SOLAR_GLARE_FRAGMENT_SHADER,
  SOLAR_GLARE_VERTEX_SHADER,
  sunAngularRadiusDeg,
  SUN_COLOR_INDEX,
  SUN_OVEREXPOSURE,
} from './solarGlare.ts';
import { rebaseVisibleFrame, satelliteVisibility, type SharedFrame } from './satellites.ts';
import { blackbodyChromaticity, starColor } from './blackbody.ts';
import { NEUTRON_STAR_COLOR_K, NEUTRON_STAR_SURFACE_RATIO } from '../core/pulsars.ts';
import { poleDirection } from './orientation.ts';
import { loadBodyTexture, releaseBodyTexture } from './textureCache.ts';
import { loadShapeModel, releaseShapeModel, type LoadedShape } from './shapeModels.ts';
import { detailExpired, detailWanted } from './detailRelease.ts';
import { declutterMarkers, type MarkerCandidate } from './markerDeclutter.ts';
import { bodyFoldStrength, focusLineage, updateMarkHostsFromScene } from './markHosts.ts';
import { shadowSphereRadius } from '../core/schwarzschildLens.ts';
import { projectToScreen } from './screenProjection.ts';
import { labelRank } from './LabelProjector.tsx';
import { starDiscExposure, starDiscColorIndex } from '../core/starBodies.ts';
import { ambientShare, exoplanetMaterial } from './exoplanetSurface.ts';
import {
  fictionMakersReady,
  fictionObjectFor,
  fictionOverlayFor,
  fictionPlanetshine,
  fictionPose,
  fictionWorldFor,
  subscribeFictionMakers,
  type FictionWorldParts,
} from './fiction/fictionHooks.ts';
import type { FictionObject } from './fiction/fictionLooks.ts';
import { DEFAULT_ALBEDO, FICTION_LAYER, fictionShipOf, isFictionBody, overlayOf, PALETTE_ALBEDO, shipWorld } from '../core/fiction.ts';
import { starDiscColor, starDiscMaterial } from './starDisc.ts';
import { lensState } from './lens.ts';
import {
  countTriangles,
  craftBox,
  craftModelTriangles,
  craftOrientation,
  disposeObject,
  loadCraftModel,
  MODEL_REQUEST_PX,
  releaseCraftModel,
  SHAPE_SHOWN_PX,
  shapeShownPx,
  shapeVisible,
} from './craftModels.ts';
import {
  orbitalPeriodDays,
  TableTrail,
  tablePath,
  TRAIL_COLOR,
  trailCompileProbe,
  TrajectoryLine,
} from './trajectoryLine.ts';
import { compileFor } from './shaderPrecompile.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { renderDemand } from '../core/renderDemand.ts';
import { useStoreVersion } from '../core/useStoreVersion.ts';
import { labelsShown } from './labelBoard.ts';
import { headingDirection, surfaceFrame } from '../core/surface.ts';
import { PATCH_SHOWN_KM, SurfaceGround } from './surfaceGround.ts';
import {
  angularRadiusPixels,
  focusOrbitOpacity,
  KM_PER_UNIT,
  kmToUnits,
  markerOpacity,
  meshOpacity,
  MESH_FADE_END_PX,
  pixelsToWorldSize,
} from './scale.ts';
import { disposeOwnResources, neverDrawnAsSphere, NOT_A_SPHERE_KINDS, staleIds } from './bodyHandles.ts';

/**
 * The scene graph, driven imperatively.
 *
 * React builds the objects once; after that, everything moves inside `useFrame` by
 * writing straight into the three.js objects. Re-rendering React sixty times a
 * second to move ten planets would be pure overhead, and the clock — not React
 * state — is already the source of truth for time.
 */

/** Scratch objects for the frame loop, which must not allocate. */
const RING_LOCAL_NORMAL = new THREE.Vector3(0, 0, 1);
/** The rotation axis in a body's own frame: SphereGeometry puts its poles on +/-y. */
const BODY_LOCAL_POLE = new THREE.Vector3(0, 1, 0);
const scratchPole = new THREE.Vector3();
const scratchScreen = new THREE.Vector3();
const scratchMarkerView = new THREE.Vector3();


/** The south ecliptic pole, as a direction in the scene's frame. */
const ECLIPTIC_SOUTH = { x: 0, y: 0, z: -1 } as const;
/** An Earth satellite's velocity about Earth, reused each frame: its forward axis. */
const scratchForward = { x: 0, y: 0, z: 0 };
const scratchSun = new THREE.Vector3();
const scratchBody = new THREE.Vector3();
const scratchCamera = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchDrift = new THREE.Quaternion();

const DEG = Math.PI / 180;

/** The objects freezeMatrices stopped, to be started again: only those it stopped. */
const frozenByUs = new WeakSet<THREE.Object3D>();
const frozenGroups = new WeakSet<THREE.Object3D>();

/**
 * Stops three recomposing the matrices of a body nothing of which is drawn, or starts it again.
 *
 * Each frame the render walks the whole scene and recomposes every object's matrix from its
 * position, rotation and scale (matrixAutoUpdate), drawn or not: five hundred bodies, a
 * group, a sphere, a glare and more each, where a few dozen are drawn -- most are a marker,
 * drawn by the batch, or not there at all. Frozen, an object keeps the matrices it had; its
 * position may go on being set, and is composed again the frame it is unfrozen, before it is
 * drawn. Nothing reads these matrices but the render: this file places by positions.
 *
 * Only the group and what it was built with -- the sphere, clouds, sky, rings, glare, never
 * taken out of it -- and only what was composing, so what composes by hand stays as it was.
 * A model or ground patch added later is left to compose: it can be taken out and put back,
 * and one put back frozen would be drawn where it was.
 */
function freezeMatrices(handle: BodyHandles, frozen: boolean): void {
  const group = handle.group;
  if (frozenGroups.has(group) === frozen) {
    return;
  }
  if (frozen) {
    frozenGroups.add(group);
  } else {
    frozenGroups.delete(group);
  }
  const added = [handle.craftShape, handle.bodyShape?.object ?? null, handle.surfaceGround?.object ?? null];
  for (const object of [group, ...group.children]) {
    if (added.includes(object)) {
      continue;
    }
    if (frozen && object.matrixAutoUpdate) {
      object.matrixAutoUpdate = false;
      frozenByUs.add(object);
    } else if (!frozen && frozenByUs.delete(object)) {
      object.matrixAutoUpdate = true;
    }
  }
}

/**
 * A group that is never moved: what it holds carries its own place. Its matrix is not
 * recomposed each frame (three's matrixAutoUpdate), only its children's.
 */
function staticGroup(): THREE.Group {
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  return group;
}

/** The one body with night lights, clouds and oceans. See earthExtras.ts. */
const EARTH_ID = 'earth';

/**
 * The radius an orbit line is held to: the body's own, except for an Earth satellite.
 *
 * A line is drawn to a quarter of the body's radius and rebuilt when its shape would move
 * by four tenths of it (see OrbitLine). A satellite's radius is 50 m of camera framing,
 * not a size, and its orbit is the osculating ellipse of an SGP4 state -- which itself
 * breathes by ten kilometres a revolution as J2's short-period terms come and go. Held to
 * metres it would be rebuilt every frame for nothing anyone could see; held to this, the
 * line is within 250 m of the ellipse and rebuilt when it moves by 400.
 */
const SATELLITE_ORBIT_PRECISION_KM = 1;

function orbitPrecisionKm(definition: BodyDefinition): number {
  return definition.kind === 'satellite'
    ? Math.max(definition.radiusEquatorialKm, SATELLITE_ORBIT_PRECISION_KM)
    : definition.radiusEquatorialKm;
}

/** Marker diameter on screen, in CSS pixels. Matches the NASA Eyes look. */
const MARKER_PIXELS = 11;

/** Sphere tessellation. Generous, because a focused planet fills the screen. */
const SPHERE_SEGMENTS = 64;

/**
 * The small moons' sphere: unit radius, scaled per moon. Coarse, because the largest of
 * them that has a published size is Himalia at 85 km, and at 32 segments its faces sag
 * by 0.5% of the radius.
 */
const SMALL_MOON_SPHERE = new THREE.SphereGeometry(1, 32, 16);

/**
 * The material of every body never drawn as a sphere (bodyHandles.ts), with
 * SMALL_MOON_SPHERE as its geometry: its mesh is never shown, so one stands for all.
 */
const NEVER_DRAWN_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x000000 });

/** What a handle shares with others, and so is never freed with it. */
const SHARED_RESOURCES: ReadonlySet<THREE.BufferGeometry | THREE.Material> = new Set([
  SMALL_MOON_SPHERE,
  NEVER_DRAWN_MATERIAL,
]);

/**
 * On-screen radius, in pixels, at which a body's surface map is worth fetching.
 *
 * Above the marker ring's own size, so the request goes out while the body is still
 * a growing dot and the image has arrived by the time there is any detail to show.
 * Below that it is a few pixels of colour and a 500 KB download would buy nothing.
 */
const TEXTURE_REQUEST_PX = 6;

export interface SolarSystemProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly showOrbits: boolean;
  /** Spacecraft trajectories: the Trails layer. */
  readonly showTrails: boolean;
  readonly showIcons: boolean;
  readonly lighting: LightingMode;
  /** Body kinds currently switched on in the layers panel. */
  readonly visibleKinds: ReadonlySet<string>;
  /**
   * Written every frame: the bodies whose marker lost its spot to another's. The labels
   * read it, so a name goes with its marker. See markerDeclutter.ts.
   */
  readonly hiddenMarkers: Set<BodyId>;
  /** Written every frame: this frame's snapshot, for the labels. See SharedFrame. */
  readonly sharedFrame: SharedFrame;
}

/**
 * Earth's own bits, absent on every other body.
 *
 * A nullable field rather than a subclass or a second list: the frame loop already
 * walks one array of handles, and a body that has something extra is the same shape as
 * a body that has rings.
 */
interface EarthHandles {
  readonly uniforms: EarthExtrasUniforms;
  /** The cloud deck, a sibling of the surface sphere and slightly larger. */
  readonly cloud: THREE.Mesh;
  readonly cloudMaterial: THREE.MeshStandardMaterial;
  /** Equatorial radius the deck sits at, km. Sets its drift rate. */
  readonly deckRadiusKm: number;
  /** The sky, on a shell of its own outside everything else. */
  readonly atmosphere: THREE.Mesh;
  /** The sky's eclipse uniforms: Earth's own, in the shell's frame and in planet radii. */
  readonly skyEclipse: EclipseUniforms;
  /**
   * Until the cloud map arrives the deck is an opaque white sphere that would swallow
   * the planet, so it stays hidden rather than starting transparent: the alpha lives
   * in the map, and there is no alpha without it.
   */
  cloudReady: boolean;
  nightRequested: boolean;
  waterRequested: boolean;
  cloudRequested: boolean;
}

interface BodyHandles {
  readonly definition: BodyDefinition;
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  /**
   * The marker's colour, in the working space, and its shape. Drawn with every other body's
   * in one batch (markerInstances.ts), not as an object of its own.
   */
  readonly markerColor: THREE.Color;
  readonly markerShape: MarkerShape;
  /** Null for a body with no orbit drawn -- and for a small moon while it is not focused. */
  orbit: OrbitLine | null;
  /**
   * What the orbit is drawn around: the Sun for a planet, the planet for a moon.
   *
   * Along with the two fields below, it is the whole of what makes a moon's orbit
   * different from a planet's. The line is the same class, re-derived from the same
   * kind of live state; only the frame and the mass at the focus change.
   */
  readonly orbitParent: BodyId;
  /** Two-body mu for the orbit, G(M + m) with M the parent alone. */
  readonly orbitMu: number;
  /** Horizons center code of the parent, carried on the derived elements. */
  readonly orbitCenter: string;
  /**
   * Where a spacecraft's trajectory goes once its path has arrived; null for a natural
   * body. The group is in the scene from the start so the line can be added to it late.
   */
  readonly trajectoryGroup: THREE.Group | null;
  trajectory: TrajectoryLine | TableTrail | null;
  /** Ring system mesh, for the bodies here that have one: Saturn, Uranus and Neptune. */
  readonly ring: THREE.Mesh | null;
  /**
   * Texture bookkeeping, so a map is fetched once per file and the orientation always
   * matches the image actually on the material.
   *
   * `shown` trails `requested` while a load is in flight. That matters because the
   * orientation depends on where the image starts in longitude: turning the body to
   * suit a map that has not arrived yet would misalign the one still being displayed.
   * Both of this project's sets happen to agree on every body's origin, so nothing
   * currently depends on it -- which is exactly when it is cheap to get right.
   */
  requestedFile: string | null;
  shownFile: string | null;
  shownOriginDeg: number;
  /** Set once the ring map has been asked for, so it is asked for once. */
  ringRequested: boolean;
  /** Uniforms for the shadow the rings throw back onto the planet, if it has any. */
  readonly ringShadow: RingShadowUniforms | null;
  /**
   * Other bodies' shadows on this one, for a body lit by the Sun and drawn as a sphere;
   * null for everything else. See eclipseShadow.ts.
   */
  readonly eclipse: EclipseSelector | null;
  /** The bodies that may shadow this one: its planet, its moons, its sibling moons. */
  eclipseCandidates: readonly BodyHandles[];
  /** Night lights, clouds and oceans. Non-null for exactly one body. */
  readonly earth: EarthHandles | null;
  /**
   * The veil of scattered light around the Sun. Non-null for exactly one body.
   *
   * A billboard rather than anything attached to the sphere, because glare is not a
   * property of the Sun at all -- it is what the Sun does inside the eye looking at it.
   * See `solarGlare.ts`.
   */
  readonly glare: THREE.Mesh | null;
  /**
   * A spacecraft's model or box, once it has been asked for; null for a natural body
   * and for a craft still too small to be worth fetching one. See craftModels.ts.
   */
  craftShape: THREE.Object3D | null;
  craftShapeRequested: boolean;
  /**
   * The on-screen radius above which the shape is drawn, from its triangles, worked out
   * once as it arrives. See shapeShownPx.
   */
  craftShapeShownPx: number;
  /**
   * When the craft's shape and the body's maps were last big enough on screen to keep,
   * from performance.now(); see detailRelease.ts. -Infinity until they first are.
   */
  craftShapeWantedAt: number;
  texturesWantedAt: number;
  /**
   * An irregular body's shape model, once it has arrived; null until then, and for every
   * body without one. Asked for, drawn and let go by a craft's rules, with
   * `craftShapeWantedAt` as its clock. See shapeModels.ts.
   */
  bodyShape: LoadedShape | null;
  bodyShapeRequested: boolean;
  /**
   * For a craft on another body's surface: the ground drawn under it and the way it
   * came, once its stops have arrived. See surfaceGround.ts.
   */
  surfaceGround: SurfaceGround | null;
  /** Set once the body has left the store and its handle been freed: see disposeHandle. */
  disposed: boolean;
}

/**
 * The longitude a body's map starts at, as its mesh is turned this frame: the image on
 * the material, or the incoming one before any has arrived. See the orientation call.
 */
function meshMapOriginDeg(handle: BodyHandles): number {
  const variant = drawnTexture(handle.definition);
  return handle.shownFile === null ? (variant?.longitudeOriginDeg ?? 0) : handle.shownOriginDeg;
}

/**
 * Asks for a craft's model, or builds its box, once it is big enough to be worth it.
 *
 * A box is built on the spot. A model is fetched, and the marker carries on alone until
 * it arrives; a failed fetch is logged and may be asked for again.
 */
function requestCraftShape(handle: BodyHandles, shape: CraftShape, pixelRadius: number): void {
  if (handle.craftShapeRequested || pixelRadius < MODEL_REQUEST_PX) {
    return;
  }
  handle.craftShapeRequested = true;

  // The size it is drawn from is settled here, once: the frame loop compares a number.
  const attach = (object: THREE.Object3D, triangles: number): void => {
    object.visible = false;
    handle.group.add(object);
    handle.craftShape = object;
    handle.craftShapeShownPx = shapeShownPx(triangles);
  };

  if (shape.model === null) {
    if (shape.boxM !== null) {
      const box = craftBox(shape.boxM);
      attach(box, countTriangles(box));
    }
    return;
  }
  const model = shape.model;
  loadCraftModel(model, shape.metresPerUnit, shape.pivot)
    .then((object) => {
      // The body left the store while its model was on its way.
      if (handle.disposed) {
        releaseCraftModel(model);
        return;
      }
      attach(object, craftModelTriangles(model));
    })
    .catch((error: unknown) => {
      handle.craftShapeRequested = false;
      console.error(`Could not load the model of ${handle.definition.id}`, error);
    });
}

/**
 * Asks for an irregular body's shape model once it is big enough to be worth it, at the
 * size a craft's model is asked for. The marker carries on alone until it arrives; a
 * failed fetch is logged and may be asked for again.
 */
function requestBodyShape(handle: BodyHandles, pixelRadius: number, anisotropy: number): void {
  if (handle.bodyShapeRequested || pixelRadius < MODEL_REQUEST_PX) {
    return;
  }
  handle.bodyShapeRequested = true;
  loadShapeModel(handle.definition, anisotropy)
    .then((loaded) => {
      if (handle.disposed) {
        releaseShapeModel(loaded);
        return;
      }
      loaded.object.visible = false;
      handle.group.add(loaded.object);
      handle.bodyShape = loaded;
    })
    .catch((error: unknown) => {
      handle.bodyShapeRequested = false;
      console.error(`Could not load the shape of ${handle.definition.id}`, error);
    });
}

/**
 * Lets go of a body's detail once it has been small long enough: the craft's model or
 * box, an asteroid's shape model, and every map the body asked for. Each goes back to
 * how it was before it was fetched -- the marker, the catalog colour, no night lights --
 * and is asked for again when the body grows back. See detailRelease.ts.
 */
function releaseUnusedDetail(handle: BodyHandles, nowMs: number): void {
  // Only once it has arrived: one still on its way is let go the frame after it lands.
  if (handle.bodyShape !== null && detailExpired(handle.craftShapeWantedAt, nowMs)) {
    handle.group.remove(handle.bodyShape.object);
    releaseShapeModel(handle.bodyShape);
    handle.bodyShape = null;
    handle.bodyShapeRequested = false;
  }

  if (handle.craftShape !== null && detailExpired(handle.craftShapeWantedAt, nowMs)) {
    handle.group.remove(handle.craftShape);
    const model = (handle.definition.mission?.shape as CraftShape | undefined)?.model ?? null;
    if (model === null) {
      // A box is this craft's alone.
      disposeObject(handle.craftShape);
    } else {
      releaseCraftModel(model);
    }
    handle.craftShape = null;
    handle.craftShapeRequested = false;
  }

  if (!detailExpired(handle.texturesWantedAt, nowMs)) {
    return;
  }

  if (handle.requestedFile !== null) {
    const material = handle.mesh.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
    material.map = null;
    material.color.set(handle.definition.color);
    if (handle.definition.kind === 'star') {
      material.color.multiplyScalar(SUN_OVEREXPOSURE);
    }
    material.needsUpdate = true;
    releaseBodyTexture(handle.requestedFile);
    handle.requestedFile = null;
    handle.shownFile = null;
  }

  if (handle.ringRequested && handle.definition.rings !== null && handle.ring !== null) {
    const uniforms = (handle.ring.material as THREE.ShaderMaterial).uniforms;
    uniforms.uMap!.value = null;
    if (handle.ringShadow !== null) {
      handle.ringShadow.uRingShadowMap.value = null;
      handle.ringShadow.uRingShadowStrength.value = 0;
    }
    // A measured strip is the app's own and kept (ringBands.ts); only a fetched map is let go.
    if (handle.definition.rings.texture !== null) {
      releaseBodyTexture(handle.definition.rings.texture);
    }
    handle.ringRequested = false;
  }

  const earth = handle.earth;
  if (earth !== null) {
    if (earth.nightRequested) {
      earth.uniforms.uNightMap.value = null;
      earth.uniforms.uNightStrength.value = 0;
      releaseBodyTexture(EARTH_NIGHT_MAP);
      earth.nightRequested = false;
    }
    if (earth.waterRequested) {
      earth.uniforms.uWaterMask.value = null;
      earth.uniforms.uWaterStrength.value = 0;
      releaseBodyTexture(EARTH_WATER_MASK);
      earth.waterRequested = false;
    }
    if (earth.cloudRequested) {
      earth.cloudMaterial.alphaMap = null;
      earth.cloudMaterial.needsUpdate = true;
      earth.cloudReady = false;
      releaseBodyTexture(EARTH_CLOUD_MAP);
      earth.cloudRequested = false;
    }
  }
}

/**
 * Frees everything a handle holds once its body has left the store -- a searched asteroid,
 * a comet, a satellite or a catalogue star past its LRU turn (removePropagatedBody). React
 * has already taken its group and lines out of the scene; this gives back their memory.
 */
function disposeHandle(handle: BodyHandles, lateOrbits: THREE.Group): void {
  handle.disposed = true;
  // Its model, shape and maps, through their caches' counts, as if small for ever.
  releaseUnusedDetail(handle, Infinity);
  if (handle.orbit !== null) {
    lateOrbits.remove(handle.orbit.line);
    handle.orbit.dispose();
    handle.orbit = null;
  }
  if (handle.trajectory !== null) {
    handle.trajectory.dispose();
    handle.trajectory = null;
  }
  if (handle.surfaceGround !== null) {
    // Out of the group first: its patch wears the host's material, which stays.
    handle.group.remove(handle.surfaceGround.object);
    handle.surfaceGround.dispose();
    handle.surfaceGround = null;
  }
  // A fictional world's haze and rings, by their own dispose, taken off the sphere first so the
  // sweep below does not free them twice.
  const extras = handle.mesh.userData['fictionExtras'] as FictionObject | undefined;
  if (extras !== undefined) {
    handle.mesh.remove(extras.object);
    extras.dispose();
  }
  // A ship's model likewise, off its group.
  const model = handle.mesh.userData['fictionObject'] as FictionObject | undefined;
  if (model !== undefined) {
    handle.group.remove(model.object);
    model.dispose();
  }
  // A real body drawn over by a fiction (core/fiction.ts overlayOf): whichever of its two looks is
  // not on the sphere now is freed here; the sweep frees the one that is.
  const overlay = handle.mesh.userData['fictionOverlay'] as FictionWorldParts | null | undefined;
  const real = handle.mesh.userData['realMaterial'] as THREE.Material | undefined;
  if (overlay != null) {
    if (overlay.extras !== null) {
      handle.mesh.remove(overlay.extras.object);
      overlay.extras.dispose();
    }
    if (handle.mesh.material !== overlay.material) overlay.material.dispose();
  }
  if (real !== undefined && handle.mesh.material !== real) real.dispose();
  // The sphere, its own material, any ring, glare, cloud deck. Its marker is only numbers
  // written into the batch each frame, and a body no longer in the store is not written.
  disposeOwnResources(handle.group, SHARED_RESOURCES);
}

/**
 * The star that lights a body of another star: the nearest star up its branch of the frame tree
 * -- a planet's parent, a moon's planet's. A walk of a link or two, for the few bodies drawn so.
 */
function lightingStar(store: EphemerisStore, definition: BodyDefinition): BodyId {
  let id = definition.parent ?? 'sun';
  while (store.body(id).kind !== 'star') {
    const parent = store.body(id).parent;
    if (parent === null) break;
    id = parent;
  }
  return id;
}

/** A fictional ship's model's bow, before it is turned (FictionLook 'ship'). */
const SHIP_AXIS = new THREE.Vector3(0, 0, 1);
/** Scratch for a ship's pose and its light, written each frame rather than allocated. */
const scratchBow = new THREE.Vector3();
const scratchLight = new THREE.Vector3();

/** A world's light on a ship near it, written here each frame rather than allocated. */
const scratchShine = { direction: new THREE.Vector3(), strength: 0, color: new THREE.Color() };
const scratchShineWhite = { direction: scratchShine.direction, strength: 0 };
/** Below this angular radius, radians, a world sends a ship nothing worth drawing: sin² under 1e-5. */
const PLANETSHINE_MIN_RADIUS = 3e-3;

/**
 * The light `world`'s lit face sends a ship at `ship`, its star at `star` (all km, this frame's
 * rebased places): toward the world, a share of the star's light from its albedo -- the fiction's
 * look while the Fiction layer draws one over it (Adrian over τ Ceti e), an Earth-like 0.3
 * otherwise -- how much of the face the ship sees lit, from the phase angle at the world, and how
 * much sky it fills. Undefined far from it.
 */
function planetshine(
  world: BodyDefinition,
  worldKm: { x: number; y: number; z: number },
  starKm: { x: number; y: number; z: number },
  shipKm: { x: number; y: number; z: number },
  fictionOn: boolean,
): { readonly direction: THREE.Vector3; readonly strength: number; readonly color?: THREE.Color } | undefined {
  const toShipX = shipKm.x - worldKm.x;
  const toShipY = shipKm.y - worldKm.y;
  const toShipZ = shipKm.z - worldKm.z;
  const distance = Math.hypot(toShipX, toShipY, toShipZ);
  const angularRadius = Math.asin(Math.min(1, world.radiusEquatorialKm / Math.max(distance, 1e-9)));
  if (angularRadius < PLANETSHINE_MIN_RADIUS) return undefined;
  const toStarX = starKm.x - worldKm.x;
  const toStarY = starKm.y - worldKm.y;
  const toStarZ = starKm.z - worldKm.z;
  const cosPhase =
    (toShipX * toStarX + toShipY * toStarY + toShipZ * toStarZ) / (distance * Math.hypot(toStarX, toStarY, toStarZ));
  const overlay = fictionOn ? overlayOf(world.id) : null;
  const look = overlay?.look.kind === 'world' ? overlay.look : null;
  const shine = look?.tint === undefined ? scratchShineWhite : scratchShine;
  shine.direction.set(-toShipX, -toShipY, -toShipZ).normalize();
  shine.strength = fictionPlanetshine(look === null ? DEFAULT_ALBEDO : PALETTE_ALBEDO[look.palette], (1 + cosPhase) / 2, angularRadius);
  if (look?.tint !== undefined) scratchShine.color.setRGB(look.tint[0], look.tint[1], look.tint[2], THREE.LinearSRGBColorSpace);
  return shine;
}

/** The squared distance between two points, km². */
function lengthSq(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2;
}

/** How long a frame may spend building craft trails before leaving the rest to the next, ms. */
const TRAIL_BUILD_MS = 6;

export function SolarSystem({
  store,
  clock,
  focus,
  showOrbits,
  showTrails,
  showIcons,
  lighting,
  visibleKinds,
  hiddenMarkers,
  sharedFrame,
}: SolarSystemProps) {
  const rootRef = useRef<THREE.Group>(null);
  const sunLightRef = useRef<THREE.PointLight>(null);

  /**
   * Build every body once. The geometry is in real kilometres converted to scene
   * units, so a sphere's radius here is the body's actual radius — nothing is
   * inflated for visibility. Oblateness is applied by scaling the polar axis, which
   * makes Saturn and Jupiter visibly flattened, as they are.
   */
  // A body's handle is built once and kept: when a planet's small moons are added, only
  // theirs are built, and every other body keeps its meshes, maps and lines.
  const version = useStoreVersion(store);
  const handleCache = useMemo(() => new Map<BodyId, BodyHandles>(), [store]);
  const handles = useMemo<BodyHandles[]>(() => {
    const build = (definition: BodyDefinition): BodyHandles => {
      const group = new THREE.Group();
      group.name = definition.id;

      const radiusUnits = kmToUnits(definition.radiusEquatorialKm);
      // The small moons share one coarse unit sphere, scaled below: four hundred spheres
      // of their own would be 30 MB of geometry for bodies a few kilometres across.
      const smallMoon = isSmallMoon(definition);
      // An Earth satellite shares it too: it is never drawn as a sphere (no size is
      // published for it), and a hundred 64-segment spheres would be geometry for nothing.
      // And a catalogue star made a body (see starBodies.ts): no catalogue it comes from
      // publishes a radius, so it is never drawn as a sphere either -- the star renderer
      // draws its light.
      // And so does every body never drawn as a sphere at all, with one material for all of
      // them (bodyHandles.ts): some 400 nebulae, galaxies, regions, craft and unmeasured
      // bodies each had a 64-segment sphere and a lit material of their own -- 35 MB of
      // vertex arrays, measured.
      // Not a ringed one, though: its rings patch the sphere's material for their shadow.
      const neverSphere = neverDrawnAsSphere(definition) && definition.rings === null;
      const sharedSphere =
        smallMoon ||
        definition.kind === 'satellite' ||
        (definition.kind === 'star' && definition.id !== 'sun' && definition.radiusPublished === false);
      // Another star with a measured radius gets a disc of its own (starDisc.ts): its
      // blackbody colour at full brightness, limb-darkened.
      const otherStar = definition.kind === 'star' && definition.id !== 'sun';
      // A planet of another star -- its parent a star, where the Sun's planets have none --
      // whether its size is measured or estimated: lit by its own star.
      // A fictional world (core/fiction.ts) likewise, in its own look: a moon of a planet of
      // another star, Pandora, as much as a planet.
      const fiction = fictionWorldFor(definition.id);
      const fictionMaterial = fiction?.material ?? null;
      const exoplanet =
        fictionMaterial !== null ||
        definition.radiusEstimated === true ||
        (definition.kind === 'planet' && definition.parent !== null);
      const geometry = sharedSphere || neverSphere
        ? SMALL_MOON_SPHERE
        : sphereGeometry(radiusUnits, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2);

      // The Sun emits rather than receives, so it gets an unlit material -- and one
      // driven far past full scale, because a light source is not a lit surface. See
      // SUN_OVEREXPOSURE. Earth gets the physical material, for one reason: `ior`, which
      // only exists there, and which is what stops its oceans reflecting twice as much
      // light as water does. Everything else is a rough diffuse surface with no specular
      // worth paying for.
      // A black hole (blackHoles.ts) gives no light and takes none: black, unlit -- a sphere
      // of its horizon, scaled each frame to its shadow (see drawnRadiusKm below). A neutron
      // star (pulsars.ts) gives its own: unlit, in its blackbody colour at full brightness.
      const material = neverSphere
        ? NEVER_DRAWN_MATERIAL
        : definition.kind === 'black-hole'
          ? new THREE.MeshBasicMaterial({ color: 0x000000 })
          : definition.kind === 'neutron-star'
          ? new THREE.MeshBasicMaterial({ color: definition.color })
          : definition.kind === 'star'
          ? otherStar
            ? starDiscMaterial(
                starDiscColor(starDiscColorIndex(definition.id), SUN_OVEREXPOSURE * starDiscExposure(definition.id)),
              )
            : new THREE.MeshBasicMaterial({
                color: new THREE.Color(definition.color).multiplyScalar(SUN_OVEREXPOSURE),
              })
          : exoplanet
            ? (fictionMaterial ?? exoplanetMaterial(definition.color))
            : definition.id === EARTH_ID
            ? new THREE.MeshPhysicalMaterial({
                color: definition.color,
                roughness: 1,
                metalness: 0,
                ior: WATER_IOR,
              })
            : new THREE.MeshStandardMaterial({
                color: definition.color,
                roughness: 1,
                metalness: 0,
              });

      const mesh = new THREE.Mesh(geometry, material);
      // Polar flattening: Saturn is 9.8% shorter pole to pole than across.
      // Applied in the body's own frame, where local y is the rotation axis, so it
      // stays correct once orientation.ts turns that frame to the real pole.
      //
      // A triaxial moon is stretched on the third axis too, and the orientation below is
      // what makes that right: it puts local -x on the prime meridian, which for a locked
      // moon is the long axis pointing at its planet, and local +z ninety degrees east of
      // it. That holds for an image starting at 0 or 180 degrees; any other origin would
      // swing the long axis off the planet, which textureAlignment.test.ts rules out.
      const triaxial = definition.triaxialRadiiKm;
      mesh.scale.set(
        1,
        definition.radiusPolarKm / definition.radiusEquatorialKm,
        triaxial === null ? 1 : triaxial[1] / triaxial[0],
      );
      if (sharedSphere || neverSphere) {
        mesh.scale.multiplyScalar(radiusUnits);
      }
      group.add(mesh);
      // A fictional world's haze and rings (fictionLooks.ts), built in its radii about its centre:
      // a child of the sphere, so they turn, hide and fade out with it, at its radius. They share
      // its material's uniforms -- its star, its lighting -- so nothing of theirs is set per frame.
      if (fiction?.extras != null) {
        fiction.extras.object.scale.setScalar(radiusUnits);
        mesh.add(fiction.extras.object);
        mesh.userData['fictionExtras'] = fiction.extras;
      }
      // A fictional ship's model (fictionLooks.ts), a unit long along +z: scaled to its length,
      // twice the radius it is framed by, and turned each frame to its thrust (fictionPose).
      const model = fictionObjectFor(definition.id);
      if (model !== null) {
        model.object.scale.setScalar(2 * radiusUnits);
        model.object.visible = false;
        group.add(model.object);
        mesh.userData['fictionObject'] = model;
      }

      // Fiction's triangle is a shape nothing real is drawn with (core/fiction.ts).
      const markerShape: MarkerShape = isFictionBody(definition.id)
        ? 'triangle'
        : definition.kind === 'spacecraft' || definition.kind === 'satellite'
          ? 'diamond'
          : 'circle';

      // Shadowed by its planet and moons: a body of the Sun's lit by it and drawn as a
      // sphere. The patch goes on last, after whatever else the material carries.
      // A body never drawn as a sphere still casts its shadow as it did when it had a
      // lit material of its own: the shared one is not patched (below), but the selector
      // is what makes it a candidate occluder of its planet and siblings.
      const sunlitKind =
        definition.kind !== 'black-hole' && definition.kind !== 'neutron-star' && definition.kind !== 'star';
      const eclipse =
        (neverSphere ? sunlitKind : material instanceof THREE.MeshStandardMaterial) &&
        !sharedSphere &&
        !exoplanet &&
        definition.kind !== 'spacecraft'
          ? new EclipseSelector()
          : null;

      let earth: EarthHandles | null = null;
      if (definition.id === EARTH_ID) {
        const uniforms = earthExtrasUniforms(definition.radiusEquatorialKm);
        // Safe: the Sun is the only body with a Basic material, and it is not Earth.
        applyEarthExtras(material as THREE.MeshPhysicalMaterial, uniforms);

        // A sibling of the surface sphere, not a child, for the same reason the rings
        // are: the surface carries the polar flattening as a scale, and the deck needs
        // its own -- 5 km added to both radii flattens slightly less, not more.
        const deckRadiusKm = definition.radiusEquatorialKm + CLOUD_TOP_ALTITUDE_KM;
        const cloudMaterial = new THREE.MeshStandardMaterial({
          // White, because a cloud is white. The map is opacity, not colour: it goes
          // in as alphaMap, so what varies across the deck is how much of it there is.
          color: '#ffffff',
          roughness: 1,
          metalness: 0,
          transparent: true,
          // Clouds are drawn over the surface they float above; writing depth would
          // make the thin edges of the deck cut holes in the planet behind them.
          depthWrite: false,
        });
        // The map is a column depth, not a transparency. Reading it as one left the
        // deck thin and gauzy; see earthExtras.ts.
        applyCloudDensity(cloudMaterial, definition.radiusEquatorialKm);
        // The Moon's shadow darkens the clouds as it does the ground: Earth's own uniforms.
        if (eclipse !== null) {
          applyEclipseShadow(cloudMaterial, eclipse.uniforms);
        }
        const cloud = new THREE.Mesh(
          // Four times the planet's tessellation, and that is a correctness
          // requirement rather than polish: at 64 segments a chord sags 7.7 km inside
          // the sphere, the deck floats 5 km above it, and the drift rotation stops
          // the two grids lining up -- so the clouds sank into the planet in vertical
          // stripes, one per facet. See CLOUD_SEGMENTS.
          sphereGeometry(kmToUnits(deckRadiusKm), CLOUD_SEGMENTS, CLOUD_SEGMENTS / 2),
          cloudMaterial,
        );
        cloud.scale.set(
          1,
          (definition.radiusPolarKm + CLOUD_TOP_ALTITUDE_KM) / deckRadiusKm,
          1,
        );
        cloud.renderOrder = 1;
        cloud.visible = false;
        group.add(cloud);

        // The sky. Built in units of the planet's own radius and then scaled to it, so
        // the ray marching inside runs in a range float32 is comfortable in however far
        // away the camera happens to be.
        const sky = atmosphereMaterial();
        configureAtmosphere(sky, definition.radiusEquatorialKm, definition.radiusPolarKm);
        const atmosphere = new THREE.Mesh(
          // Coarser than the cloud deck, which needed its resolution to stay outside
          // the planet. This shell stands 100 km off the ground; see ATMOSPHERE_SEGMENTS.
          sphereGeometry(
            atmosphereRadiusRatio(definition.radiusEquatorialKm),
            ATMOSPHERE_SEGMENTS,
            ATMOSPHERE_SEGMENTS / 2,
          ),
          sky,
        );
        atmosphere.scale.setScalar(kmToUnits(definition.radiusEquatorialKm));
        // After the surface and the clouds: it is the air in front of both of them.
        atmosphere.renderOrder = 2;
        atmosphere.visible = false;
        group.add(atmosphere);

        earth = {
          uniforms,
          cloud,
          cloudMaterial,
          deckRadiusKm,
          atmosphere,
          // atmosphereMaterial gives the sky these uniforms; this is the same objects, typed.
          skyEclipse: sky.uniforms as unknown as EclipseUniforms,
          cloudReady: false,
          nightRequested: false,
          waterRequested: false,
          cloudRequested: false,
        };
      }

      let ring: THREE.Mesh | null = null;
      let ringShadow: RingShadowUniforms | null = null;
      if (definition.rings !== null) {
        const shadowSettings = ringShadowSettings(definition.rings);
        // The planet learns to be shadowed by its own rings. Only the bodies that have
        // rings pay for it: everything else keeps the stock material and its cached
        // program.
        ringShadow = {
          uRingShadowMap: { value: null },
          uRingShadowSunLocal: { value: new THREE.Vector3(0, 1, 0) },
          uRingShadowInner: { value: kmToUnits(definition.rings.innerRadiusKm) },
          uRingShadowOuter: { value: kmToUnits(definition.rings.outerRadiusKm) },
          // Zero until the ring map has loaded, so the shadow fades in with it rather
          // than appearing between one frame and the next.
          uRingShadowStrength: { value: 0 },
          uRingShadowMaxAlpha: { value: MAX_RING_ALPHA },
          // Saturn's corrections to an artist's opacity; none for a strip made from
          // measured depths (ringBands.ts).
          uRingShadowFloor: { value: shadowSettings.floor },
          uRingShadowExponent: { value: shadowSettings.exponent },
          uRingShadowGain: { value: shadowSettings.gain },
        };
        // Safe: only lit bodies get a Standard material, and only a planet has rings.
        applyRingShadow(
          material as THREE.MeshStandardMaterial,
          ringShadow,
          definition.radiusPolarKm / definition.radiusEquatorialKm,
        );

        // A sibling of the sphere, not a child: the sphere carries the polar
        // flattening scale, and a ring hung off it would be squashed by 9.8% too.
        // A ring is a slab of separated particles, not a surface, so it gets its own
        // scattering model rather than MeshStandardMaterial's Lambert term. See
        // ringMaterial.ts: with Lambert the rings all but vanished, because in 2026
        // the Sun sits 7 degrees above the ring plane.
        const ringSurface = ringMaterial();
        // The planet's own shape, so the shader can work out where its shadow falls.
        // Oblate, and it matters: Saturn is 9.8% flatter pole to pole, which narrows
        // the shadow it throws across its rings.
        ringSurface.uniforms.uEquatorialRadius!.value = kmToUnits(definition.radiusEquatorialKm);
        ringSurface.uniforms.uPolarRadius!.value = kmToUnits(definition.radiusPolarKm);
        // Saturn's calibrated brightness, or measured rings' as dark as their particles are.
        ringSurface.uniforms.uFlatRadianceFactor!.value = ringFlatRadianceFactor(definition.rings);

        ring = new THREE.Mesh(
          ringGeometry(definition.rings.innerRadiusKm, definition.rings.outerRadiusKm),
          ringSurface,
        );
        ring.renderOrder = 1;
        // Spans 2.35 planetary radii, so its own bounding sphere is a poor proxy for
        // whether Saturn is on screen; the group's position already decides that.
        ring.frustumCulled = false;
        group.add(ring);
      }

      if (eclipse !== null && !neverSphere) {
        applyEclipseShadow(material as THREE.MeshStandardMaterial, eclipse.uniforms);
      }

      let orbit: OrbitLine | null = null;
      const elements = store.elementsFor(definition.id);
      // A small moon's orbit is made when it is first focused: see the frame loop.
      if (definition.drawOrbit && elements !== null && !smallMoon) {
        // Segment count and float32 anchoring are both handled inside OrbitLine;
        // see that file for why a fixed 512 segments put Pluto 93 radii off its own
        // orbit.
        orbit = new OrbitLine(elements, orbitPrecisionKm(definition), definition.color);
      }

      // A planet orbits the Sun; a moon orbits its planet -- and orbits the planet
      // alone, not the planet plus every other moon. See `gmBodyOnlyKm3S2`.
      const orbitParent = definition.parent ?? 'sun';
      const parentDefinition = store.body(orbitParent);
      const orbitMu = parentDefinition.gmBodyOnlyKm3S2 + definition.gmKm3S2;
      const orbitCenter = `500@${parentDefinition.horizonsId}`;

      let glare: THREE.Mesh | null = null;
      // The Sun's, scaled by its drawn disc (solarGlare.ts), and every other star's that has
      // a disc -- a measured radius -- by the same equation and its own surface brightness.
      // A star with no radius is a point drawn by the star renderer, wings and all.
      // A neutron star too (pulsars.ts): twelve kilometres, at a million kelvin.
      const glareStar =
        definition.kind === 'neutron-star' ||
        (definition.kind === 'star' && (definition.id === 'sun' || definition.radiusPublished !== false));
      if (glareStar) {
        // The star's own colour, from its colour index through the same Planck and CIE
        // path the stars use: scattered starlight is still starlight.
        const [red, green, blue] =
          definition.kind === 'neutron-star'
            ? blackbodyChromaticity(NEUTRON_STAR_COLOR_K)
            : starColor(definition.id === 'sun' ? SUN_COLOR_INDEX : starDiscColorIndex(definition.id));
        glare = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            uniforms: {
              uLevel: { value: 0 },
              uTanRadius: { value: 1 },
              uSunRadiusDeg: { value: 0.27 },
              uColor: { value: new THREE.Color(red, green, blue) },
              // The Sun's disc is clipped white already; another star's is drawn at its
              // colour, and the veil lies over it as over everything (solarGlare.ts).
              uOverDisc: { value: definition.id === 'sun' ? 0 : 1 },
            },
            vertexShader: SOLAR_GLARE_VERTEX_SHADER,
            fragmentShader: SOLAR_GLARE_FRAGMENT_SHADER,
            // Light adds. Depth is read, so a planet or a ship in front of a star hides the
            // halo behind it -- the Sun's or any other's -- and never written, because a veil
            // has no surface. Its depth is just in front of the star's own disc
            // (solarGlare.ts), so another star's veil still lies over its own disc.
            blending: THREE.AdditiveBlending,
            depthTest: true,
            depthWrite: false,
            transparent: true,
            // The exposure is already chosen and stated, as it is for the stars.
            toneMapped: false,
          }),
        );
        // Over the photosphere, under the markers.
        glare.renderOrder = 5;
        // The quad is scaled to an angle, which at Neptune's distance is a very large
        // number of scene units; leave culling to the sphere it sits on.
        glare.frustumCulled = false;
        group.add(glare);
      }

      return {
        definition,
        group,
        mesh,
        markerColor: new THREE.Color(definition.color),
        markerShape,
        orbit,
        orbitParent,
        orbitMu,
        orbitCenter,
        trajectoryGroup: definition.kind === 'spacecraft' ? staticGroup() : null,
        trajectory: null,
        ring,
        ringShadow,
        eclipse,
        eclipseCandidates: [],
        earth,
        glare,
        requestedFile: null,
        shownFile: null,
        shownOriginDeg: 0,
        ringRequested: false,
        craftShape: null,
        craftShapeRequested: false,
        craftShapeShownPx: SHAPE_SHOWN_PX,
        craftShapeWantedAt: -Infinity,
        texturesWantedAt: -Infinity,
        bodyShape: null,
        bodyShapeRequested: false,
        surfaceGround: null,
        disposed: false,
      };
    };
    void version;
    const built = store.bodies.map((definition) => {
      const cached = handleCache.get(definition.id);
      if (cached !== undefined) {
        return cached;
      }
      const handle = build(definition);
      handleCache.set(definition.id, handle);
      return handle;
    });
    // Who may shadow whom, settled once per catalog rather than looked for each frame.
    for (const handle of built) {
      if (handle.eclipse !== null) {
        // Only what is drawn as a sphere casts a shadow: a landing site's 1-km point, a craft, a
        // moon of unmeasured size would otherwise darken its planet with a disc nobody sees.
        handle.eclipseCandidates = built.filter(
          (other) =>
            other.eclipse !== null &&
            !neverDrawnAsSphere(other.definition) &&
            mayShadow(handle.definition, other.definition),
        );
      }
    }
    return built;
  }, [store, version, handleCache]);
  // Orbits made after the first render -- a small moon's, once focused -- hang here.
  // Never moved: its lines carry their own positions (matrixAutoUpdate, see the root below).
  const lateOrbits = useMemo(() => {
    const group = new THREE.Group();
    group.matrixAutoUpdate = false;
    return group;
  }, []);
  // A body taken out of the store (removePropagatedBody) leaves its handle in the cache;
  // once React has committed the scene without it, its memory is given back. After the
  // commit, not while building, so no frame draws a freed handle.
  useEffect(() => {
    for (const id of staleIds(handleCache.keys(), handles.map((handle) => handle.definition.id))) {
      disposeHandle(handleCache.get(id)!, lateOrbits);
      handleCache.delete(id);
    }
  }, [handles, handleCache, lateOrbits]);
  const handleById = useMemo(
    () => new Map(handles.map((handle) => [handle.definition.id, handle] as const)),
    [handles],
  );

  const { size, camera, gl } = useThree();
  const scene = useThree((state) => state.scene);

  // A real body drawn over by a fiction -- τ Ceti e as Adrian (core/fiction.ts overlayOf) -- wears
  // the fiction's look while the Fiction layer is on and its own again the moment it is off: the
  // sphere's material swapped, the haze added and taken away. Its data is never touched. The look
  // is made once, the first time, and kept with the real one.
  const fictionOn = visibleKinds.has(FICTION_LAYER);
  const fictionReady = useSyncExternalStore(subscribeFictionMakers, fictionMakersReady);
  useEffect(() => {
    for (const handle of handles) {
      if (overlayOf(handle.definition.id) === null) continue;
      const data = handle.mesh.userData;
      if (fictionOn && fictionReady) {
        if (data['fictionOverlay'] === undefined) data['fictionOverlay'] = fictionOverlayFor(handle.definition.id);
        const overlay = data['fictionOverlay'] as FictionWorldParts | null;
        if (overlay === null || handle.mesh.material === overlay.material) continue;
        data['realMaterial'] ??= handle.mesh.material;
        handle.mesh.material = overlay.material;
        if (overlay.extras !== null) {
          overlay.extras.object.scale.setScalar(kmToUnits(handle.definition.radiusEquatorialKm));
          handle.mesh.add(overlay.extras.object);
        }
      } else if (data['realMaterial'] !== undefined && handle.mesh.material !== data['realMaterial']) {
        handle.mesh.material = data['realMaterial'] as THREE.Material;
        const overlay = data['fictionOverlay'] as FictionWorldParts | null | undefined;
        if (overlay?.extras != null) handle.mesh.remove(overlay.extras.object);
      }
    }
    renderDemand.request();
  }, [handles, fictionOn, fictionReady]);

  // Hidden layers are not resolved at all, which for the moons means not fetched.
  const wanted = useMemo(
    () => (void version, bodiesToResolve(store, visibleKinds, focus)),
    [store, visibleKinds, focus, version],
  );
  // The markers shown last frame, which keep their places. See markerDeclutter.ts.
  const heldMarkers = useMemo(() => new Set<BodyId>(), []);
  // Every body's marker, in one draw. See markerInstances.ts.
  const markerBatch = useMemo(() => {
    const batch = new MarkerInstances(markerTexture('circle'), markerTexture('diamond'), markerTexture('triangle'));
    // Never moved: each marker's place is in its instance data, in the camera's frame.
    batch.mesh.matrixAutoUpdate = false;
    return batch;
  }, []);
  useEffect(() => () => markerBatch.dispose(), [markerBatch]);
  const lastView = useMemo(() => new ViewChange(), []);
  // The craft's trails are made once their two programs are (trajectoryLine.ts
  // trailCompileProbe): the first trail drawn made them in that frame.
  const trailsCompiled = useRef(false);
  useEffect(() => {
    const probe = trailCompileProbe();
    let live = true;
    const done = (): void => {
      if (!live) return;
      trailsCompiled.current = true;
      renderDemand.request();
    };
    void compileFor(gl, camera, scene, probe.objects, 'canvas').then(done, done);
    return () => {
      live = false;
      probe.dispose();
    };
  }, [gl, camera, scene]);

  useFrame(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }

    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const snapshot = rebaseVisibleFrame(
      store,
      focus,
      jd,
      wanted,
      camera.position,
      size.height,
      fov,
    );
    sharedFrame.snapshot = snapshot;
    const focusRadiusKm = store.body(focus).radiusEquatorialKm;
    const sunRadiusKm = store.body('sun').radiusEquatorialKm;

    // Orbits live in the Sun's frame, so they follow the Sun's rebased position.
    const sun = snapshot.bodies.get('sun');
    // Every mark's host, from where the camera is this frame (markHosts.ts).
    updateMarkHostsFromScene(camera.position, sun?.positionKm, size.height, fov, focus);
    const lineage = focusLineage(store, focus);
    // Spacecraft paths live in the barycentric frame, whose origin is wherever the focus
    // is not: minus the focus's own barycentric position.
    const focusInRoot = store.stateInRoot(focus, jd);

    // Every marker's place on screen, to find the ones on top of each other. Through this
    // frame's camera: CameraRig has moved it, and the render has not yet caught up.
    camera.updateMatrixWorld();
    const markerCandidates: MarkerCandidate[] = [];
    const nowMs = performance.now();
    // Milliseconds spent building craft trails this frame, and whether any was put off.
    let trailWorkMs = 0;
    let trailsPutOff = false;
    markerBatch.begin();
    // The fastest anything drawn here crosses the view, radians per simulated second: live
    // mode draws a frame once it has moved a quarter of a pixel (renderDemand.ts clockMoved).
    // The camera in km from the focus, as the snapshot's positions are.
    let fastest = 0;
    const cameraKmX = camera.position.x * KM_PER_UNIT;
    const cameraKmY = camera.position.y * KM_PER_UNIT;
    const cameraKmZ = camera.position.z * KM_PER_UNIT;
    // Whether the view is moving: the camera about the focus, its lens, the focus itself or
    // the canvas changed a moment ago. Only then are orbit lines held to what shows rather than
    // to the still rule (OrbitLine.setElements) -- the first frame at rest goes back to it.
    const cameraMoved = lastView.moving(camera, focus, size.height, nowMs);

    for (const handle of handles) {
      const rebased = snapshot.bodies.get(handle.definition.id);
      if (rebased === undefined) {
        handle.group.visible = false;
        // Nothing of it is drawn: its matrices are left as they are (see freezeMatrices).
        freezeMatrices(handle, true);
        if (handle.orbit !== null) {
          handle.orbit.line.visible = false;
        }
        // A craft outside its coverage is not there, and neither is its line.
        if (handle.trajectoryGroup !== null) {
          handle.trajectoryGroup.visible = false;
        }
        continue;
      }

      // A body switched off in the layers panel disappears entirely, orbit and all.
      const kindVisible = isShown(handle.definition, visibleKinds);
      handle.group.visible = kindVisible;
      if (!kindVisible) {
        freezeMatrices(handle, true);
        if (handle.orbit !== null) {
          handle.orbit.line.visible = false;
        }
        if (handle.trajectoryGroup !== null) {
          handle.trajectoryGroup.visible = false;
        }
        continue;
      }

      if (handle.ring !== null) {
        // The rings lie in the equatorial plane, so their normal is the pole -- the
        // same pole the sphere is oriented by, from the same IAU elements. That is
        // the whole reason this step was cheap: 6a already established where the
        // axis points, and a ring is that axis with a disc around it.
        //
        // No rotation about the pole is applied, and that is deliberate. Ring
        // particles are on independent Keplerian orbits, so there is no rigid
        // rotation to apply; and the texture has no azimuthal structure, so none
        // would be visible if there were.
        const pole = poleDirection(jd, handle.definition);
        handle.ring.quaternion.setFromUnitVectors(
          RING_LOCAL_NORMAL,
          scratchPole.set(pole.x, pole.y, pole.z),
        );
      }

      handle.group.position.set(
        kmToUnits(rebased.positionKm.x),
        kmToUnits(rebased.positionKm.y),
        kmToUnits(rebased.positionKm.z),
      );

      // A body drawn from its shape model wears its map there, never on the sphere it
      // does not show. See shapeModels.ts.
      const shapeModel = handle.definition.shapeModel ?? null;
      const variant =
        shapeModel === null ? drawnTexture(handle.definition) : null;

      // Point the axis where the IAU says it points and turn the body so the image
      // lands where the image belongs. One assignment carrying the axial tilt, the
      // rotation rate, its direction and the absolute phase. Until a map is on the
      // material there is nothing to misalign, so the incoming origin is used.
      //
      // A body with no rotational elements -- the moons, for now -- is left unturned.
      // It is a sphere in flat colour, so every orientation of it looks the same, and
      // that is exactly why none is invented for it.
      if (handle.definition.rotation !== null) {
        bodyOrientation(
          jd,
          handle.definition,
          handle.shownFile === null
            ? (variant?.longitudeOriginDeg ?? 0)
            : handle.shownOriginDeg,
          handle.mesh.quaternion,
        );
      }

      // Venus's map is its cloud tops, and they super-rotate: slid westward round the body
      // once in 4.45 days while the body itself keeps its IAU frame. See cloudRotation.ts.
      const cloudDrift = cloudTopDriftDeg(handle.definition, jd);
      if (cloudDrift !== null) {
        const map = (handle.mesh.material as THREE.MeshStandardMaterial).map;
        if (map !== null) {
          map.offset.x = cloudTopMapOffset(cloudDrift);
        }
      }

      // Distance from the camera, not from the focus: what the camera sees is what
      // decides whether a sphere is big enough to be worth drawing.
      const distanceUnits = handle.group.position.distanceTo(camera.position);
      const distanceKm = distanceUnits * 1000;
      // Its marker, its name, its disc: all where it is, so as fast as it crosses the view.
      // Every body shown counts, on screen or not -- one just off it is a pixel from it.
      fastest = Math.max(
        fastest,
        transverseRate(
          rebased.positionKm.x - cameraKmX,
          rebased.positionKm.y - cameraKmY,
          rebased.positionKm.z - cameraKmZ,
          rebased.velocityKmS.x,
          rebased.velocityKmS.y,
          rebased.velocityKmS.z,
        ),
      );

      // A black hole is drawn as its shadow, not its horizon (schwarzschildLens.ts): a
      // sphere that hides exactly what the shadow hides from here, b_c sqrt(1 - r_s/D) --
      // 2.6 horizons from afar. Its radius is what the camera sees of it.
      const horizonKm = handle.definition.radiusEquatorialKm;
      const drawnRadiusKm =
        handle.definition.kind === 'black-hole'
          ? horizonKm * shadowSphereRadius(Math.max(distanceKm / horizonKm, 1))
          : horizonKm;
      if (handle.definition.kind === 'black-hole') {
        handle.mesh.scale.setScalar(drawnRadiusKm / horizonKm);
      }

      const pixelRadius = angularRadiusPixels(
        drawnRadiusKm,
        distanceKm,
        size.height,
        fov,
      );
      // A moon's marker and orbit wait until its system has opened up on screen, so
      // they do not bury the planet's own marker from far away. The sphere is not
      // faded: at that range it is far below a pixel anyway, and when it is not, it is
      // really there. See satellites.ts.
      const satellite = satelliteVisibility(
        store,
        snapshot,
        handle.definition,
        camera.position,
        size.height,
        fov,
      );

      // Ring and sphere are independent: they overlap rather than swapping, so
      // nothing pops at any distance. See scale.ts.
      //
      // A spacecraft has no sphere to hand over to: its radius is its span, there so the
      // camera can frame it, and a ball that size would be a shape it does not have. It
      // hands over to its model or box instead, once that is here -- until then the
      // marker stays at any range.
      const craft = handle.definition.mission;
      // Data generated before the models has no shape; such a craft keeps its marker.
      const craftShape = (craft?.shape as CraftShape | undefined) ?? null;
      if (craftShape !== null) {
        requestCraftShape(handle, craftShape, pixelRadius);
      }
      // Still big enough to keep what it has; see releaseUnusedDetail below the loop.
      if (detailWanted(pixelRadius, MODEL_REQUEST_PX)) {
        handle.craftShapeWantedAt = nowMs;
      }
      if (detailWanted(pixelRadius, TEXTURE_REQUEST_PX)) {
        handle.texturesWantedAt = nowMs;
      }
      // An irregular body with its team's shape model is drawn from that, never as the
      // ellipsoid of its radii; asked for at a craft's size, and the marker stands alone
      // until it lands.
      if (shapeModel !== null && handle.definition.rotation !== null) {
        requestBodyShape(handle, pixelRadius, gl.capabilities.getMaxAnisotropy());
      }
      // A moon whose size JPL does not publish is a marker at any range, like a craft
      // with no shape: a sphere would claim a size nobody has measured. So is an
      // asteroid whose shape cannot be drawn yet: an ellipsoid would claim a shape.
      // A planet of another star with its radius estimated from its mass is drawn as a
      // sphere, and every panel says the size is an estimate (exoplanets.ts).
      const sized =
        (handle.definition.radiusPublished !== false || handle.definition.radiusEstimated === true) &&
        handle.definition.shapeDrawn !== false &&
        shapeModel === null;
      // Lit by its own star, not by the Sun light years away: see exoplanetMaterial.
      const starDirection = (handle.mesh.material as THREE.Material).userData['starDirection'] as
        | THREE.Vector3
        | undefined;
      // Its star: the parent of a planet, and of a moon the star its planet goes round.
      const host = starDirection === undefined ? undefined : snapshot.bodies.get(lightingStar(store, handle.definition));
      const ambient = (handle.mesh.material as THREE.Material).userData['ambient'] as { value: number } | undefined;
      if (ambient !== undefined) {
        ambient.value = ambientShare(LIGHTING[lighting]);
      }
      if (starDirection !== undefined && host !== undefined) {
        starDirection
          .set(
            host.positionKm.x - rebased.positionKm.x,
            host.positionKm.y - rebased.positionKm.y,
            host.positionKm.z - rebased.positionKm.z,
          )
          .normalize();
      }
      // A fictional ship (core/hailMary.ts): its model, turned to its thrust, stands in for a sphere
      // as a craft's does, the marker handing over to it as it grows.
      const model = handle.mesh.userData['fictionObject'] as FictionObject | undefined;
      if (model !== undefined) {
        const pose = fictionPose(handle.definition.id, jd, scratchBow);
        model.object.visible = pose !== null && pixelRadius > MESH_FADE_END_PX;
        if (pose !== null && model.object.visible) {
          model.object.quaternion.setFromUnitVectors(SHIP_AXIS, scratchBow.normalize());
          model.setMode?.(pose.centrifuge ? 'centrifuge' : 'cruise', pose.spinPhase);
          // Lit by the nearer of the Sun and the star it is bound for.
          const ship = fictionShipOf(handle.definition.id);
          const bound = ship === null ? undefined : (shipWorld(ship) ?? undefined);
          const there = bound === undefined || !store.isPropagatedBody(bound) ? undefined : snapshot.bodies.get(lightingStar(store, store.body(bound)));
          const light = there !== undefined && (sun === undefined || lengthSq(there.positionKm, rebased.positionKm) < lengthSq(sun.positionKm, rebased.positionKm)) ? there : sun;
          if (light !== undefined && model.update !== undefined) {
            scratchLight.set(
              light.positionKm.x - rebased.positionKm.x,
              light.positionKm.y - rebased.positionKm.y,
              light.positionKm.z - rebased.positionKm.z,
            ).normalize();
            // And the world it goes round, once near it: its lit face on the ship's night side.
            const world = bound === undefined ? undefined : snapshot.bodies.get(bound);
            const shine =
              world === undefined || bound === undefined
                ? undefined
                : planetshine(store.body(bound), world.positionKm, light.positionKm, rebased.positionKm, fictionOn);
            model.update(scratchLight, camera, shine, LIGHTING[lighting]);
          }
        }
      }
      const shaped =
        model !== undefined
          ? true
          : craft !== null
            ? handle.craftShape !== null
            : shapeModel !== null
              ? handle.bodyShape !== null
              : sized;
      // Folded into its host's mark as the two come together on the screen (markFolding.ts):
      // a cluster into the Milky Way's, a satellite galaxy into its giant's.
      const folded = bodyFoldStrength(handle.definition, rebased.positionKm, sun?.positionKm, lineage);
      const ringOpacity = (shaped ? markerOpacity(pixelRadius) : 1) * satellite * folded;
      const sphereOpacity = craft === null && sized ? meshOpacity(pixelRadius) : 0;
      if (handle.bodyShape !== null && shapeModel !== null) {
        // A craft's rule, for the same reason: thousands of facets wait until they cover
        // pixels enough to be worth it, while the marker stands in -- from the catalog's
        // facet count, so it is settled before the file arrives. See shapeShownPx.
        const object = handle.bodyShape.object;
        const markerStandsIn = showIcons && ringOpacity > 0.005;
        object.visible = shapeVisible(
          pixelRadius,
          markerStandsIn ? shapeShownPx(shapeModel.facets) : SHAPE_SHOWN_PX,
          object.visible,
        );
        if (object.visible) {
          // Its own frame, the mission's: +z the pole, +x the prime meridian.
          bodyFixedOrientation(jd, handle.definition, object.quaternion);
        }
      }
      if (handle.craftShape !== null && craftShape !== null) {
        // A heavy model waits until it covers pixels enough to be worth its triangles --
        // but only while the marker is there to stand in for it. With the markers off it
        // is drawn from the floor, a speck, rather than leave nothing. See shapeShownPx.
        const markerStandsIn = showIcons && ringOpacity > 0.005;
        handle.craftShape.visible = shapeVisible(
          pixelRadius,
          markerStandsIn ? handle.craftShapeShownPx : SHAPE_SHOWN_PX,
          handle.craftShape.visible,
        );
        if (handle.craftShape.visible) {
          // Its pointing rule, toward the Earth or the Sun as seen from the craft -- or,
          // for Wind, the south ecliptic pole, a direction rather than a body. A craft on
          // the ground stands on it, its front along the heading NASA reports.
          if (craftShape.pointsAt === 'zenith') {
            const stop = store.surfaceStopAt(handle.definition.id, jd);
            if (stop !== null) {
              const { track, index } = stop;
              const frame = surfaceFrame(
                store.body(track.host),
                track.latitudeDeg[index]!,
                track.longitudeDeg[index]!,
                jd,
              );
              craftOrientation(
                craftShape,
                frame.up,
                handle.craftShape.quaternion,
                headingDirection(frame, track.headingDeg[index] ?? null),
              );
            }
          } else if (craftShape.pointsAt === 'nadir') {
            // An Earth satellite in LVLH: one side on Earth's centre and the forward axis
            // along its velocity about Earth -- both from the same state, Earth seen from
            // the satellite, whose velocity is the satellite's own reversed.
            const earth = store.stateRelativeTo('earth', handle.definition.id, jd);
            if (earth !== null) {
              const v = earth.velocity;
              scratchForward.x = -v.x;
              scratchForward.y = -v.y;
              scratchForward.z = -v.z;
              craftOrientation(craftShape, earth.position, handle.craftShape.quaternion, scratchForward);
            }
          } else {
            const toTarget =
              craftShape.pointsAt === 'ecliptic-south'
                ? ECLIPTIC_SOUTH
                : store.stateRelativeTo(craftShape.pointsAt, handle.definition.id, jd)?.position;
            if (toTarget !== undefined) {
              craftOrientation(craftShape, toTarget, handle.craftShape.quaternion);
            }
          }
        }
      }

      // The ground under a craft on another body, turned with that body's mesh -- which
      // the loop has already turned this frame, its host coming first in the catalog.
      const site = craft?.site ?? null;
      if (site !== null && site !== undefined) {
        const stop = store.surfaceStopAt(handle.definition.id, jd);
        const host = handleById.get(site.host);
        if (stop !== null && host !== undefined) {
          if (handle.surfaceGround === null) {
            handle.surfaceGround = new SurfaceGround(
              host.definition,
              stop.track,
              host.mesh.material as THREE.Material,
            );
            handle.group.add(handle.surfaceGround.object);
          }
          handle.surfaceGround.object.quaternion.copy(host.mesh.quaternion);
          handle.surfaceGround.update(
            stop.index,
            meshMapOriginDeg(host),
            distanceKm < PATCH_SHOWN_KM,
            showTrails && satellite > 0.005,
            satellite,
          );
        }
      }

      // A marker behind the camera is not drawn, as a sprite there was clipped: only one in
      // front is staged, and contends for its place on the screen.
      if (showIcons && ringOpacity > 0.005 && projectToScreen(handle.group.position, camera, scratchScreen)) {
        // Constant on-screen size, whatever the distance: the world size of MARKER_PIXELS at
        // the body's distance, at its depth in the camera's frame -- what an unattenuated
        // sprite drew, its scale a size per unit of depth. Handed to the shader as it is, never
        // squared: a world size overflowed float32 from 300 billion ly out when three's sprite
        // shader took length(modelMatrix[0].xyz), and the record-holders' rings were not drawn
        // (G4). The clamp is the sprite's, for a marker all but level with the camera.
        const worldSize = pixelsToWorldSize(MARKER_PIXELS, distanceUnits, size.height, fov);
        scratchMarkerView.copy(handle.group.position).applyMatrix4(camera.matrixWorldInverse);
        const depth = -scratchMarkerView.z;
        markerBatch.stage(
          handle.definition.id,
          scratchMarkerView,
          (worldSize / Math.max(depth, distanceUnits * 1e-6)) * depth,
          handle.markerColor,
          ringOpacity,
          handle.markerShape,
        );
        markerCandidates.push({
          id: handle.definition.id,
          x: (scratchScreen.x * 0.5 + 0.5) * size.width,
          y: (-scratchScreen.y * 0.5 + 0.5) * size.height,
          depth: distanceUnits,
          rank: labelRank(handle.definition.kind, handle.definition.parent),
        });
      }

      if (handle.glare !== null) {
        // Everything the veil does follows from one distance: how bright it is, how far
        // it reaches, and where the disc masks it. See solarGlare.ts.
        // Another star's by its surface brightness against the Sun's (its disc's exposure).
        const surfaceRatio =
          handle.definition.id === 'sun'
            ? 1
            : handle.definition.kind === 'neutron-star'
              ? NEUTRON_STAR_SURFACE_RATIO
              : starDiscExposure(handle.definition.id);
        const radiusDeg = glareRadiusDeg(handle.definition.radiusEquatorialKm, distanceKm, surfaceRatio);
        // Also while the lens draws the star (BlackHoleLens.tsx): the veil stays about where the
        // star is, not bent round the hole with its images -- right away from the hole, an
        // approximation close to it.
        handle.glare.visible = radiusDeg > 0;
        if (handle.glare.visible) {
          const uniforms = (handle.glare.material as THREE.ShaderMaterial).uniforms;
          uniforms.uLevel!.value = glareLevel(
            handle.definition.radiusEquatorialKm,
            distanceKm,
            surfaceRatio,
          );
          // The tangent, not the angle: a fragment's angle is the arctangent of its
          // offset over the distance, and close to the Sun the difference is 40%.
          uniforms.uTanRadius!.value = Math.tan((radiusDeg * Math.PI) / 180);
          uniforms.uSunRadiusDeg!.value = sunAngularRadiusDeg(
            handle.definition.radiusEquatorialKm,
            distanceKm,
          );
          handle.glare.scale.setScalar(2 * glareWorldRadius(distanceUnits, radiusDeg));
          // A billboard: the group carries position only, so the camera's own rotation
          // is the one that turns the quad to face it.
          handle.glare.quaternion.copy(camera.quaternion);
        }
      }

      // The star about a black hole is drawn through the lens instead, while it is on.
      // A globular cluster is a place, not a surface: its stars are drawn by GlobularClusters.tsx,
      // and a galaxy's light by LocalGroup.tsx.
      handle.mesh.visible =
        sphereOpacity > 0.005 &&
        !lensState.drawnByLens.has(handle.definition.id) &&
        !NOT_A_SPHERE_KINDS.has(handle.definition.kind);
      // A surface drawn turns with the body, and its map's clouds drift over it: its
      // equator's speed at the nearest it comes to the camera. A craft's model turns to keep
      // pointing where it points, about as fast as it goes round what it orbits; one on the
      // ground turns with the ground.
      if (
        handle.mesh.visible ||
        handle.bodyShape?.object.visible === true ||
        handle.craftShape?.visible === true
      ) {
        let spin = handle.definition.rotation === null ? 0 : degPerDayToRadPerSec(handle.definition.rotation.rotationRateDegPerDay);
        spin = Math.abs(spin);
        if (cloudDrift !== null) {
          spin += Math.abs(degPerDayToRadPerSec(cloudTopDriftRateDegPerDay(handle.definition) ?? 0));
        }
        if (handle.earth !== null) {
          spin += Math.abs(degPerDayToRadPerSec(cloudDriftDegPerDay(handle.earth.deckRadiusKm)));
        }
        if (craft !== null) {
          const about = snapshot.bodies.get(handle.definition.parent ?? 'sun');
          if (about !== undefined) {
            spin += transverseRate(
              rebased.positionKm.x - about.positionKm.x,
              rebased.positionKm.y - about.positionKm.y,
              rebased.positionKm.z - about.positionKm.z,
              rebased.velocityKmS.x - about.velocityKmS.x,
              rebased.velocityKmS.y - about.velocityKmS.y,
              rebased.velocityKmS.z - about.velocityKmS.z,
            );
          }
          const ground = site === null || site === undefined ? null : store.body(site.host).rotation;
          if (ground !== null) {
            spin += Math.abs(degPerDayToRadPerSec(ground.rotationRateDegPerDay));
          }
        }
        const radiusKm = handle.definition.radiusEquatorialKm;
        fastest = Math.max(fastest, surfaceRate(spin * radiusKm, radiusKm, distanceKm));
      }
      const meshMaterial = handle.mesh.material as
        | THREE.MeshBasicMaterial
        | THREE.MeshStandardMaterial;
      meshMaterial.transparent = sphereOpacity < 1;
      meshMaterial.opacity = sphereOpacity;

      // The bodies whose shadows can reach this one this frame, relative to it in float64
      // km and handed over as small numbers. Most frames there are none, and the shader
      // stops at the count. See eclipseShadow.ts.
      const eclipse = handle.eclipse;
      if (eclipse !== null) {
        eclipse.uniforms.uEclipseCount.value = 0;
        if (handle.mesh.visible && sun !== undefined) {
          const here = rebased.positionKm;
          // Velocities about the barycentre: the snapshot's are about the focus.
          const frameVx = focusInRoot?.velocity.x ?? 0;
          const frameVy = focusInRoot?.velocity.y ?? 0;
          const frameVz = focusInRoot?.velocity.z ?? 0;
          eclipse.begin(
            handle.definition.radiusEquatorialKm,
            sun.positionKm.x - here.x,
            sun.positionKm.y - here.y,
            sun.positionKm.z - here.z,
            sun.velocityKmS.x + frameVx,
            sun.velocityKmS.y + frameVy,
            sun.velocityKmS.z + frameVz,
            sunRadiusKm,
            KM_PER_UNIT,
          );
          eclipse.uniforms.uEclipseCentre.value.copy(handle.group.position);
          for (const other of handle.eclipseCandidates) {
            const there = snapshot.bodies.get(other.definition.id);
            // A body switched off in the layers panel is not drawn, and neither is its shadow.
            if (there === undefined || !isShown(other.definition, visibleKinds)) {
              continue;
            }
            eclipse.offer(
              there.positionKm.x - here.x,
              there.positionKm.y - here.y,
              there.positionKm.z - here.z,
              there.velocityKmS.x + frameVx,
              there.velocityKmS.y + frameVy,
              there.velocityKmS.z + frameVz,
              occludingRadiusKm(other.definition),
            );
          }
          // A shadow on it moves over it with the body casting it -- twice that, for the
          // edge's run across a surface it meets at a slant.
          if (eclipse.uniforms.uEclipseCount.value > 0) {
            for (const other of handle.eclipseCandidates) {
              const there = snapshot.bodies.get(other.definition.id);
              if (there !== undefined) {
                const relative = Math.hypot(
                  there.velocityKmS.x - rebased.velocityKmS.x,
                  there.velocityKmS.y - rebased.velocityKmS.y,
                  there.velocityKmS.z - rebased.velocityKmS.z,
                );
                fastest = Math.max(
                  fastest,
                  surfaceRate(2 * relative, handle.definition.radiusEquatorialKm, distanceKm),
                );
              }
            }
          }
        }
      }

      if (handle.ring !== null && handle.definition.rings !== null && sun !== undefined) {
        // Tied to the sphere's own fade rather than the ring's larger angular size,
        // so the two appear and disappear together. The alternative -- fading the
        // ring on its own 2.35x radius -- would grow rings on Saturn while Saturn
        // itself was still a marker dot, which reads as a glitch rather than as
        // scale.
        const uniforms = (handle.ring.material as THREE.ShaderMaterial).uniforms;
        handle.ring.visible = sphereOpacity > 0.005;
        uniforms.uFade!.value = sphereOpacity;
        uniforms.uSunIntensity!.value = LIGHTING[lighting].sun;
        uniforms.uAmbient!.value = LIGHTING[lighting].ambient;

        if (handle.ring.visible) {
          // The scattering model works in the ring's own frame, where the ring plane
          // is z = 0 and both elevation angles are just z components. So the Sun and
          // the camera are brought into that frame once per frame here, rather than
          // the shader undoing a rotation per fragment.
          const inverse = scratchQuaternion.copy(handle.ring.quaternion).invert();

          scratchSun
            .set(sun.positionKm.x, sun.positionKm.y, sun.positionKm.z)
            .sub(
              scratchBody.set(rebased.positionKm.x, rebased.positionKm.y, rebased.positionKm.z),
            )
            .normalize()
            .applyQuaternion(inverse);
          uniforms.uSunLocal!.value.copy(scratchSun);

          scratchCamera
            .copy(camera.position)
            .sub(handle.group.position)
            .applyQuaternion(inverse);
          uniforms.uCameraLocal!.value.copy(scratchCamera);
        }

        if (handle.ringShadow !== null) {
          // The Sun in the planet's own frame, where its pole is +y and the ring plane
          // is y = 0. One transform per body per frame, so the shader can answer "does
          // the ray to the Sun cross the rings" with a single division.
          scratchSun
            .set(sun.positionKm.x, sun.positionKm.y, sun.positionKm.z)
            .sub(
              scratchBody.set(rebased.positionKm.x, rebased.positionKm.y, rebased.positionKm.z),
            )
            .normalize()
            .applyQuaternion(scratchQuaternion.copy(handle.mesh.quaternion).invert());
          handle.ringShadow.uRingShadowSunLocal.value.copy(scratchSun);
        }

        if (!handle.ringRequested && pixelRadius >= TEXTURE_REQUEST_PX && handle.definition.rings.texture === null) {
          // Measured rings: their strip is made here, at once, from their radii and depths.
          handle.ringRequested = true;
          const strip = ringStripTexture(handle.definition.rings);
          uniforms.uMap!.value = strip;
          if (handle.ringShadow !== null) {
            handle.ringShadow.uRingShadowMap.value = strip;
            handle.ringShadow.uRingShadowStrength.value = 1;
          }
        }
        if (!handle.ringRequested && pixelRadius >= TEXTURE_REQUEST_PX && handle.definition.rings.texture !== null) {
          handle.ringRequested = true;
          void loadBodyTexture(handle.definition.rings.texture, {
            anisotropy: gl.capabilities.getMaxAnisotropy(),
            // u is radius here, not longitude: repeating it would fold the outer
            // edge of the rings back onto the inner one.
            wrapS: THREE.ClampToEdgeWrapping,
          })
            .then((texture) => {
              // Released while it was on its way: see releaseUnusedDetail.
              if (!handle.ringRequested) {
                return;
              }
              uniforms.uMap!.value = texture;
              // The same map serves both: what the rings look like, and what they
              // block. It is already loaded, so the shadow costs no extra bytes.
              if (handle.ringShadow !== null) {
                handle.ringShadow.uRingShadowMap.value = texture;
                handle.ringShadow.uRingShadowStrength.value = 1;
              }
            })
            .catch((error: unknown) => {
              handle.ringRequested = false;
              console.error(`Could not load the ring map for ${handle.definition.id}`, error);
            });
        }
      }

      const earth = handle.earth;
      if (earth !== null && sun !== undefined) {
        // The Sun in Earth's own frame, where the shader can compare it against the
        // sphere's parametric normal and know how far past sunset a point is. Same
        // transform the ring shadow uses, for the same reason: one per body per frame
        // here beats undoing a rotation per fragment there.
        scratchSun
          .set(sun.positionKm.x, sun.positionKm.y, sun.positionKm.z)
          .sub(scratchBody.set(rebased.positionKm.x, rebased.positionKm.y, rebased.positionKm.z))
          .normalize()
          .applyQuaternion(scratchQuaternion.copy(handle.mesh.quaternion).invert());
        earth.uniforms.uSunLocal.value.copy(scratchSun);

        // The sky shares the surface's orientation -- it needs the pole, for the
        // oblateness -- and reuses the Sun direction already computed in that frame.
        earth.atmosphere.visible = sphereOpacity > 0.005;
        if (earth.atmosphere.visible) {
          const sky = (earth.atmosphere.material as THREE.ShaderMaterial).uniforms;
          earth.atmosphere.quaternion.copy(handle.mesh.quaternion);
          sky.uSunLocal!.value.copy(scratchSun);
          sky.uSunIntensity!.value = LIGHTING[lighting].sun;
          sky.uFade!.value = sphereOpacity;
          // The same occluders, in the shell's frame: turned into Earth's and in its radii.
          handle.eclipse?.copyTransformed(
            earth.skyEclipse,
            scratchQuaternion.copy(handle.mesh.quaternion).invert(),
            KM_PER_UNIT / handle.definition.radiusEquatorialKm,
          );
          // The camera in the same frame and the same units the shell is built in:
          // planet radii, measured from the planet's centre.
          sky.uCameraLocal!.value
            .copy(camera.position)
            .sub(handle.group.position)
            .applyQuaternion(scratchQuaternion.copy(handle.mesh.quaternion).invert())
            .divideScalar(kmToUnits(handle.definition.radiusEquatorialKm));
        }

        // The deck follows the surface's orientation and then slips west on top of it.
        // Tied to the sphere's own fade, like the rings, so planet and clouds appear
        // and disappear together rather than the deck outliving the body.
        earth.cloud.visible = earth.cloudReady && sphereOpacity > 0.005;
        earth.cloudMaterial.opacity = sphereOpacity;
        if (earth.cloud.visible) {
          earth.cloud.quaternion
            .copy(handle.mesh.quaternion)
            .multiply(
              scratchDrift.setFromAxisAngle(
                BODY_LOCAL_POLE,
                cloudDriftDeg(jd, earth.deckRadiusKm) * DEG,
              ),
            );
        }

        if (pixelRadius >= TEXTURE_REQUEST_PX) {
          const anisotropy = gl.capabilities.getMaxAnisotropy();

          if (!earth.nightRequested) {
            earth.nightRequested = true;
            void loadBodyTexture(EARTH_NIGHT_MAP, { anisotropy })
              .then((texture) => {
                if (!earth.nightRequested) {
                  return;
                }
                earth.uniforms.uNightMap.value = texture;
                earth.uniforms.uNightStrength.value = 1;
              })
              .catch((error: unknown) => {
                earth.nightRequested = false;
                console.error('Could not load the night lights map', error);
              });
          }

          if (!earth.waterRequested) {
            earth.waterRequested = true;
            // NoColorSpace: this one is a measurement, not a picture. An sRGB decode
            // would bend a mask that is meant to be read at face value.
            void loadBodyTexture(EARTH_WATER_MASK, {
              anisotropy,
              colorSpace: THREE.NoColorSpace,
            })
              .then((texture) => {
                if (!earth.waterRequested) {
                  return;
                }
                earth.uniforms.uWaterMask.value = texture;
                earth.uniforms.uWaterStrength.value = 1;
              })
              .catch((error: unknown) => {
                earth.waterRequested = false;
                console.error('Could not load the land/water mask', error);
              });
          }

          if (!earth.cloudRequested) {
            earth.cloudRequested = true;
            void loadBodyTexture(EARTH_CLOUD_MAP, {
              anisotropy,
              colorSpace: THREE.NoColorSpace,
            })
              .then((texture) => {
                if (!earth.cloudRequested) {
                  return;
                }
                earth.cloudMaterial.alphaMap = texture;
                earth.cloudMaterial.needsUpdate = true;
                earth.cloudReady = true;
              })
              .catch((error: unknown) => {
                earth.cloudRequested = false;
                console.error('Could not load the cloud map', error);
              });
          }
        }
      }

      // Fetch the surface map the first time this body is worth looking at, and
      // again only if the selected set asks for a different file. Until it arrives
      // whatever is already there keeps showing -- the flat colour on first approach,
      // or the previous set's map when switching -- so nothing ever blanks out.
      // Never on the shared material of the bodies not drawn as spheres.
      if (
        variant !== null &&
        meshMaterial !== NEVER_DRAWN_MATERIAL &&
        handle.requestedFile !== variant.file &&
        pixelRadius >= TEXTURE_REQUEST_PX
      ) {
        handle.requestedFile = variant.file;
        const wanted = variant;
        void loadBodyTexture(wanted.file, {
          anisotropy: gl.capabilities.getMaxAnisotropy(),
        })
          .then(async (texture) => {
            // The set may have been switched again while this was in flight; a stale
            // response must not overwrite a newer choice.
            if (handle.requestedFile !== wanted.file) {
              return;
            }
            // Put on once its program is made, beside the page (mapCompile.ts): the Sun's,
            // made on its first draw, held the frame its map arrived in for half a second.
            await compileWithMap(gl, camera, scene, handle.mesh, texture);
            if (handle.requestedFile !== wanted.file || handle.disposed) {
              return;
            }
            meshMaterial.map = texture;
            // The catalog colour was standing in for the surface; left in place it
            // would now tint it. **Except on the Sun**, where the colour is not a
            // stand-in at all: it is the exposure. Resetting it here is what silently
            // undid the overexposure the first time -- the disc went back to unity the
            // moment its map arrived, which is exactly when anybody would be looking.
            if (handle.definition.kind === 'star') {
              meshMaterial.color
                .set(handle.definition.color)
                .multiplyScalar(SUN_OVEREXPOSURE);
            } else {
              // White, or a display compensation for the tone curve (drawnTexture.ts).
              meshMaterial.color.setRGB(...mapColourGain(handle.definition));
            }
            meshMaterial.needsUpdate = true;
            handle.shownFile = wanted.file;
            handle.shownOriginDeg = wanted.longitudeOriginDeg;
          })
          .catch((error: unknown) => {
            // Allow a retry rather than leaving the body stuck on its flat colour.
            if (handle.requestedFile === wanted.file) {
              handle.requestedFile = null;
            }
            // Not fatal, and not silent: the body stays usable, but a missing map is
            // a deployment problem worth seeing.
            console.error(`Could not load the surface map for ${handle.definition.id}`, error);
          });
      }

      // A small moon's orbit is drawn only while it is the focus: Saturn's together are a
      // tangle of hundreds, and each, sized to its kilometre, thousands of segments. Made
      // when it is focused and let go when it is not.
      if (isSmallMoon(handle.definition)) {
        const focused = handle.definition.id === focus;
        if (handle.orbit !== null && !focused) {
          lateOrbits.remove(handle.orbit.line);
          handle.orbit.dispose();
          handle.orbit = null;
        }
        const elements = store.elementsFor(handle.definition.id);
        if (focused && handle.orbit === null && elements !== null) {
          handle.orbit = new OrbitLine(
            elements,
            handle.definition.radiusEquatorialKm,
            handle.definition.color,
          );
          lateOrbits.add(handle.orbit.line);
        }
      }

      if (handle.orbit !== null) {
        // The focused body's own orbit fades out once the body overflows the frame. By
        // then the visible piece of it is a straight line drawn across the picture rather
        // than anything that says where the body goes. Every other orbit stays: those are
        // still saying where things are relative to the one you are standing at. A moon's
        // orbit also waits for its system to open up, with its marker.
        const fade =
          (handle.definition.id === focus ? focusOrbitOpacity(pixelRadius, size.height) : 1) *
          satellite;
        (handle.orbit.line.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * fade;

        // Orbits live in their parent's frame, so they follow the parent's rebased
        // position: the Sun's for a planet, the planet's for a moon.
        const parent = snapshot.bodies.get(handle.orbitParent);
        handle.orbit.line.visible = showOrbits && parent !== undefined && fade > 0.005;
        // A hidden line is left as it is. It re-derives itself on the first frame it is
        // shown again, and twenty moon orbits a frame is not free.
        if (parent !== undefined && handle.orbit.line.visible) {
          // Re-derive the ellipse from where the body actually is right now. Elements
          // frozen at one epoch drift off the real path as perturbations accumulate;
          // the osculating ellipse of this instant passes through the body by
          // definition. OrbitLine throttles the rebuild internally.
          const relative = store.stateRelativeTo(handle.definition.id, handle.orbitParent, jd);
          // Under warp, how far the line may move unseen from where the camera is
          // (orbitUnseenKm): from afar, far more than the body's radius it is otherwise held
          // to. At real time and paused, null while the camera is still: rebuilt as it always
          // was (OrbitLine.setElements); while it moves, held to either.
          let unseenKm: number | null = null;
          if (relative !== null) {
            const live = stateToOsculatingElements(
              relative,
              // Two-body mu is G(M + m); the planet's own mass shifts Jupiter's
              // period by ~0.05%, which is small but free to include.
              handle.orbitMu,
              jd,
              handle.definition.id,
              handle.orbitCenter,
            );
            if (live !== null && (clock.mode === 'warp' || cameraMoved)) {
              unseenKm = orbitUnseenKm(
                handle.orbit.nearestKm(
                  cameraKmX - parent.positionKm.x,
                  cameraKmY - parent.positionKm.y,
                  cameraKmZ - parent.positionKm.z,
                ),
                pixelsPerRadian(size.height, fov),
              );
            }
            if (live !== null) {
              handle.orbit.setElements(live, unseenKm, clock.mode !== 'warp');
            }
          }

          // Rebuild tolerance scales with the focused body's radius: that is the
          // smallest thing on screen worth resolving, so drifting by less than that
          // cannot be seen.
          handle.orbit.update(parent.positionKm, focusRadiusKm * 0.25, clock.mode === 'warp' ? unseenKm : null);
        }
      }

      if (handle.trajectoryGroup !== null) {
        const id = handle.definition.id;
        const parentId = handle.definition.parent;
        // The path's frame, relative to the focus: the barycentre, or the planet a craft
        // like JWST is hung from.
        const origin =
          parentId === null
            ? focusInRoot === null
              ? undefined
              : {
                  x: -focusInRoot.position.x,
                  y: -focusInRoot.position.y,
                  z: -focusInRoot.position.z,
                }
            : snapshot.bodies.get(parentId)?.positionKm;

        // Asked for only once the line is wanted: a layer that is off costs nothing.
        const wantedLine = showTrails && satellite > 0.005 && origin !== undefined;
        if (wantedLine && handle.trajectory === null && trailsCompiled.current) {
          const info = store.pathInfo(id);
          if (info !== null && info.count === null) {
            // A close orbiter: its trail from its own table, one turn at a time.
            handle.trajectory = new TableTrail((startJd, stopJd) => {
              const table = store.loadedSamples(id, startJd, stopJd);
              return table === null ? null : tablePath(table, info.seams, info.floorKm);
            }, TRAIL_COLOR);
            handle.trajectoryGroup.add(handle.trajectory.object);
          } else if (store.pathInPieces(id)) {
            // A path in pieces: drawn like a table trail, from the pieces the turn is in, and
            // nothing built ahead of the clock (see TableTrail's `ahead`).
            handle.trajectory = new TableTrail((startJd, stopJd) => store.pathBetween(id, startJd, stopJd), TRAIL_COLOR, 0);
            handle.trajectoryGroup.add(handle.trajectory.object);
          } else {
            const path = store.path(id);
            // TRAIL_BUILD_MS a frame, the rest the next: the thirty-odd lines built in one frame
            // as their paths came in were a task of 130 to 400 ms.
            if (path !== null && trailWorkMs < TRAIL_BUILD_MS) {
              const started = performance.now();
              handle.trajectory = new TrajectoryLine(path, TRAIL_COLOR);
              handle.trajectoryGroup.add(handle.trajectory.object);
              trailWorkMs += performance.now() - started;
            } else if (path !== null) {
              trailsPutOff = true;
            }
          }
        }

        handle.trajectoryGroup.visible = wantedLine && handle.trajectory !== null;
        if (handle.trajectoryGroup.visible && handle.trajectory !== null && origin !== undefined) {
          // A JWST line waits for Earth's system to open up, like a moon's orbit.
          handle.trajectory.setFade(satellite);
          // The trail reaches one turn of the orbit it is on now back, about what it
          // orbits: the Sun, or Earth for JWST. Recomputed every frame, so after a flyby
          // it is the new orbit's turn.
          const center = parentId ?? 'sun';
          const relative = store.stateRelativeTo(id, center, jd);
          const period =
            relative === null
              ? null
              : orbitalPeriodDays(relative, store.body(center).gmBodyOnlyKm3S2);
          // On no orbit -- Voyager, leaving -- the trail is the whole way it came, back to
          // the path's start; a whole path file says that by itself.
          const pieces = store.pathInPieces(id) ? store.pathInfo(id)!.chunks! : null;
          const spanDays = period ?? (pieces === null ? null : Math.max(jd - pieces[0]!.startJd, 1e-9));
          // A trail built from pieces is built on its first update: TRAIL_BUILD_MS of those a
          // frame too, as for the whole paths above.
          const unbuilt = handle.trajectory instanceof TableTrail && handle.trajectory.built.stopJd === -Infinity;
          if (unbuilt && trailWorkMs >= TRAIL_BUILD_MS) {
            trailsPutOff = true;
          } else {
            const started = unbuilt ? performance.now() : 0;
            handle.trajectory.update(
              jd,
              origin,
              (time) => store.loadedLocalState(id, time)?.position ?? null,
              spanDays,
            );
            if (unbuilt) {
              trailWorkMs += performance.now() - started;
            }
          }
        }
      }

      // Its matrices worked out by the render only while something in it is drawn: most
      // bodies are a marker, drawn by the batch, with their sphere, glare and the rest hidden.
      let drawn = false;
      for (const child of handle.group.children) {
        drawn ||= child.visible;
      }
      freezeMatrices(handle, !drawn);
    }

    if (trailsPutOff) {
      renderDemand.request(1);
    }

    // Earth's satellites, drawn as a swarm of dots (SatelliteSwarm.tsx) and not as bodies: as
    // fast as any of them could be, from where Earth is (satelliteMotion.ts: measured, never above screenMotion.ts swarmRate).
    const earthNow = snapshot.bodies.get(EARTH_ID);
    if (visibleKinds.has('satellite') && earthNow !== undefined) {
      fastest = Math.max(
        fastest,
        satelliteSwarmRate(
          cameraKmX - earthNow.positionKm.x,
          cameraKmY - earthNow.positionKm.y,
          cameraKmZ - earthNow.positionKm.z,
          store.body(EARTH_ID).gmBodyOnlyKm3S2,
          Math.hypot(earthNow.velocityKmS.x, earthNow.velocityKmS.y, earthNow.velocityKmS.z),
        ),
      );
    }
    // And what the scene does not bound one by one -- the belt's and the comets' dots, the orbit
    // and trail lines, all of them the Sun's -- as a whole, from where the Sun is: the live floor
    // holds only while they could show motion (renderDemand.ts LIVE_FRAME_MAX_MS).
    const sunNow = store.sunFromFocus(focus, jd);
    const floor =
      sunNow === null
        ? 0
        : solarSystemRate(
            Math.hypot(sunNow.position.x - cameraKmX, sunNow.position.y - cameraKmY, sunNow.position.z - cameraKmZ),
            store.body('sun').gmBodyOnlyKm3S2,
            Math.hypot(sunNow.velocity.x, sunNow.velocity.y, sunNow.velocity.z),
          );
    const pxPerRadian = pixelsPerRadian(size.height, fov);
    renderDemand.setMotion(fastest * pxPerRadian, floor * pxPerRadian);

    // Every body, shown or not: one switched off or out of its coverage was skipped
    // above, and that is exactly the one whose detail should go.
    for (const handle of handles) {
      releaseUnusedDetail(handle, nowMs);
    }

    // Markers on top of each other: the one behind goes, and its label with it.
    const hidden = declutterMarkers(markerCandidates, focus, MARKER_PIXELS, heldMarkers);
    hiddenMarkers.clear();
    heldMarkers.clear();
    for (const { id } of markerCandidates) {
      (hidden.has(id) ? hiddenMarkers : heldMarkers).add(id);
    }
    markerBatch.commit(
      (id) =>
        !hidden.has(id) &&
        // A named structure's ring only with its name: one whose name lost its spot to
        // another's would be a ring that says nothing (labelBoard.ts labelsShown). It comes
        // back with its name, nearer or once the others move off.
        !(labelsShown.active && id !== focus && !labelsShown.ids.has(id) && store.body(id).kind === 'structure'),
    );

    // The Sun is the only light source, which is what puts a real terminator on
    // every planet: the day/night line you see is geometry, not a shader trick.
    if (sunLightRef.current !== null && sun !== undefined) {
      sunLightRef.current.position.set(
        kmToUnits(sun.positionKm.x),
        kmToUnits(sun.positionKm.y),
        kmToUnits(sun.positionKm.z),
      );
    }

  });

  return (
    // Never moved, so never recomposed: the scene's root is static too (SolarSystemCanvas), and
    // with every ancestor static three no longer forces a world update on each body each
    // frame -- only on those that move, and not on those not drawn (freezeMatrices).
    <group ref={rootRef} matrixAutoUpdate={false}>
      {/*
        Point light with no distance falloff: inverse-square over interplanetary
        distances would underflow to black long before Neptune. Real illuminance
        does fall off, but reproducing that would make the outer planets invisible
        rather than dim, which is a worse lie than a flat light.
      */}
      <pointLight
        ref={sunLightRef}
        intensity={LIGHTING[lighting].sun}
        distance={0}
        decay={0}
        // White. Every map is the colour its body is in sunlight -- Neptune's and Mars's
        // checked against photometry white-balanced to the Sun (textures/CREDITS.md) -- so
        // tinting the light as well would count the Sun's colour twice. It was a cream
        // #fff6e0, which took a quarter off every map's blue: Neptune came out grey-cyan,
        // Uranus greener than blue, where Irwin et al. 2024's true colour has both blue-white.
        color="#ffffff"
      />
      <ambientLight intensity={LIGHTING[lighting].ambient} />

      {handles.map((handle) => (
        <primitive key={handle.definition.id} object={handle.group} />
      ))}
      {handles
        .filter((handle) => handle.orbit !== null)
        .map((handle) => (
          <primitive key={`${handle.definition.id}-orbit`} object={handle.orbit!.line} />
        ))}
      <primitive object={lateOrbits} />
      <primitive object={markerBatch.mesh} />
      {handles
        .filter((handle) => handle.trajectoryGroup !== null)
        .map((handle) => (
          <primitive
            key={`${handle.definition.id}-trajectory`}
            object={handle.trajectoryGroup!}
          />
        ))}
    </group>
  );
}
