import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { LightingMode } from '../state/store.ts';
import { J2000_JD, type SimClock } from '../core/time.ts';
import { rebaseFrame } from './floatingOrigin.ts';
import { markerTexture } from './markerTexture.ts';
import { OrbitLine } from './orbitGeometry.ts';
import {
  angularRadiusPixels,
  kmToUnits,
  markerOpacity,
  meshOpacity,
  pixelsToWorldSize,
  rotationAngle,
} from './scale.ts';

/**
 * The scene graph, driven imperatively.
 *
 * React builds the objects once; after that, everything moves inside `useFrame` by
 * writing straight into the three.js objects. Re-rendering React sixty times a
 * second to move ten planets would be pure overhead, and the clock — not React
 * state — is already the source of truth for time.
 */

/** Marker diameter on screen, in CSS pixels. Matches the NASA Eyes look. */
const MARKER_PIXELS = 11;

/** Sphere tessellation. Generous, because a focused planet fills the screen. */
const SPHERE_SEGMENTS = 64;

export interface SolarSystemProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly showOrbits: boolean;
  readonly showIcons: boolean;
  readonly lighting: LightingMode;
  /** Body kinds currently switched on in the layers panel. */
  readonly visibleKinds: ReadonlySet<string>;
}

/**
 * Sun intensity and ambient fill per lighting mode.
 *
 * Only `natural` is physical: sunlight and nothing else, so the night side is truly
 * black. `shadow` adds a little fill so the unlit hemisphere still reads as a
 * sphere. `flood` abandons directional light entirely, which is unphysical but makes
 * every body identifiable at a glance — the tradeoff NASA Eyes makes too.
 */
const LIGHTING: Record<LightingMode, { sun: number; ambient: number }> = {
  flood: { sun: 0.15, ambient: 1.35 },
  shadow: { sun: 1.6, ambient: 0.08 },
  natural: { sun: 1.9, ambient: 0 },
};

interface BodyHandles {
  readonly definition: BodyDefinition;
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly marker: THREE.Sprite;
  readonly orbit: OrbitLine | null;
}

export function SolarSystem({
  store,
  clock,
  focus,
  showOrbits,
  showIcons,
  lighting,
  visibleKinds,
}: SolarSystemProps) {
  const rootRef = useRef<THREE.Group>(null);
  const sunLightRef = useRef<THREE.PointLight>(null);

  /**
   * Build every body once. The geometry is in real kilometres converted to scene
   * units, so a sphere's radius here is the body's actual radius — nothing is
   * inflated for visibility. Oblateness is applied by scaling the polar axis, which
   * makes Saturn and Jupiter visibly flattened, as they are.
   */
  const handles = useMemo<BodyHandles[]>(() => {
    const texture = markerTexture();

    return store.bodies.map((definition) => {
      const group = new THREE.Group();
      group.name = definition.id;

      const radiusUnits = kmToUnits(definition.radiusEquatorialKm);
      const geometry = new THREE.SphereGeometry(radiusUnits, SPHERE_SEGMENTS, SPHERE_SEGMENTS / 2);

      // The Sun emits rather than receives, so it gets an unlit material.
      const material =
        definition.kind === 'star'
          ? new THREE.MeshBasicMaterial({ color: definition.color })
          : new THREE.MeshStandardMaterial({
              color: definition.color,
              roughness: 1,
              metalness: 0,
            });

      const mesh = new THREE.Mesh(geometry, material);
      // Polar flattening: Saturn is 9.8% shorter pole to pole than across.
      mesh.scale.set(1, definition.radiusPolarKm / definition.radiusEquatorialKm, 1);
      // Axial tilt, about the x axis of the body's own frame.
      mesh.rotation.z = (definition.axialTiltDeg * Math.PI) / 180;
      group.add(mesh);

      const marker = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: texture,
          color: definition.color,
          transparent: true,
          depthTest: false,
          depthWrite: false,
          sizeAttenuation: true,
        }),
      );
      // Markers draw over everything: a planet behind the Sun still needs a label.
      marker.renderOrder = 10;
      // The sprite is scaled to a fixed pixel size, which at Pluto's distance
      // means tens of thousands of scene units; leave culling to the mesh.
      marker.frustumCulled = false;
      group.add(marker);

      let orbit: OrbitLine | null = null;
      const elements = store.elementsFor(definition.id);
      if (definition.drawOrbit && elements !== null) {
        // Segment count and float32 anchoring are both handled inside OrbitLine;
        // see that file for why a fixed 512 segments put Pluto 93 radii off its own
        // orbit.
        orbit = new OrbitLine(elements, definition.radiusEquatorialKm, definition.color);
      }

      return { definition, group, mesh, marker, orbit };
    });
  }, [store]);

  const { size, camera } = useThree();

  useFrame(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }

    const jd = clock.tdbJulianDay;
    const snapshot = rebaseFrame(store, focus, jd);
    const focusRadiusKm = store.body(focus).radiusEquatorialKm;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const cameraDistanceUnits = camera.position.length();

    // Orbits live in the Sun's frame, so they follow the Sun's rebased position.
    const sun = snapshot.bodies.get('sun');

    for (const handle of handles) {
      const rebased = snapshot.bodies.get(handle.definition.id);
      if (rebased === undefined) {
        handle.group.visible = false;
        if (handle.orbit !== null) {
          handle.orbit.line.visible = false;
        }
        continue;
      }

      // A body switched off in the layers panel disappears entirely, orbit and all.
      const kindVisible = visibleKinds.has(handle.definition.kind);
      handle.group.visible = kindVisible;
      if (!kindVisible) {
        if (handle.orbit !== null) {
          handle.orbit.line.visible = false;
        }
        continue;
      }

      handle.group.position.set(
        kmToUnits(rebased.positionKm.x),
        kmToUnits(rebased.positionKm.y),
        kmToUnits(rebased.positionKm.z),
      );

      // Spin the body on its own axis at its real sidereal rate.
      handle.mesh.rotation.y = rotationAngle(
        jd,
        J2000_JD,
        handle.definition.rotationPeriodHours,
      );

      // Distance from the camera, not from the focus: what the camera sees is what
      // decides whether a sphere is big enough to be worth drawing.
      const distanceUnits = handle.group.position.distanceTo(camera.position);
      const distanceKm = distanceUnits * 1000;

      const pixelRadius = angularRadiusPixels(
        handle.definition.radiusEquatorialKm,
        distanceKm,
        size.height,
        fov,
      );
      // Ring and sphere are independent: they overlap rather than swapping, so
      // nothing pops at any distance. See scale.ts.
      const ringOpacity = markerOpacity(pixelRadius);
      const sphereOpacity = meshOpacity(pixelRadius);

      handle.marker.visible = showIcons && ringOpacity > 0.005;
      if (handle.marker.visible) {
        (handle.marker.material as THREE.SpriteMaterial).opacity = ringOpacity;
        // Constant on-screen size, whatever the distance.
        const worldSize = pixelsToWorldSize(MARKER_PIXELS, distanceUnits, size.height, fov);
        handle.marker.scale.setScalar(worldSize);
      }

      handle.mesh.visible = sphereOpacity > 0.005;
      const meshMaterial = handle.mesh.material as THREE.Material;
      meshMaterial.transparent = sphereOpacity < 1;
      meshMaterial.opacity = sphereOpacity;

      if (handle.orbit !== null) {
        handle.orbit.line.visible = showOrbits && sun !== undefined;
        if (sun !== undefined) {
          // Rebuild tolerance scales with the focused body's radius: that is the
          // smallest thing on screen worth resolving, so drifting by less than that
          // cannot be seen.
          handle.orbit.update(sun.positionKm, focusRadiusKm * 0.25);
        }
      }
    }

    // The Sun is the only light source, which is what puts a real terminator on
    // every planet: the day/night line you see is geometry, not a shader trick.
    if (sunLightRef.current !== null && sun !== undefined) {
      sunLightRef.current.position.set(
        kmToUnits(sun.positionKm.x),
        kmToUnits(sun.positionKm.y),
        kmToUnits(sun.positionKm.z),
      );
    }

    void cameraDistanceUnits;
  });

  return (
    <group ref={rootRef}>
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
        color="#fff6e0"
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
    </group>
  );
}
