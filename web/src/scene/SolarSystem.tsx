import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import type { LightingMode } from '../state/store.ts';
import type { SimClock } from '../core/time.ts';
import { stateToOsculatingElements } from '../core/kepler.ts';
import { rebaseFrame } from './floatingOrigin.ts';
import { markerTexture } from './markerTexture.ts';
import { bodyOrientation } from './orientation.ts';
import { OrbitLine } from './orbitGeometry.ts';
import { loadBodyTexture } from './textureCache.ts';
import {
  angularRadiusPixels,
  kmToUnits,
  markerOpacity,
  meshOpacity,
  pixelsToWorldSize,
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
  /** Set once the surface map has been asked for, so it is asked for once. */
  textureRequested: boolean;
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
      // Applied in the body's own frame, where local y is the rotation axis, so it
      // stays correct once orientation.ts turns that frame to the real pole.
      mesh.scale.set(1, definition.radiusPolarKm / definition.radiusEquatorialKm, 1);
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

      return { definition, group, mesh, marker, orbit, textureRequested: false };
    });
  }, [store]);

  const { size, camera, gl } = useThree();

  useFrame(() => {
    const root = rootRef.current;
    if (root === null) {
      return;
    }

    const jd = clock.tdbJulianDay;
    const snapshot = rebaseFrame(store, focus, jd);
    const focusRadiusKm = store.body(focus).radiusEquatorialKm;
    const sunGm = store.body('sun').gmKm3S2;
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

      // Point the axis where the IAU says it points and turn the prime meridian to
      // where it is now. This is one assignment and it carries the axial tilt, the
      // rotation rate, its direction and the absolute phase all at once.
      handle.mesh.quaternion.copy(bodyOrientation(jd, handle.definition));

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
      const meshMaterial = handle.mesh.material as
        | THREE.MeshBasicMaterial
        | THREE.MeshStandardMaterial;
      meshMaterial.transparent = sphereOpacity < 1;
      meshMaterial.opacity = sphereOpacity;

      // Fetch the surface map the first time this body is worth looking at, and
      // never again. Until it arrives the flat colour keeps showing, so approaching
      // a planet degrades to the old render rather than to a blank sphere.
      if (
        !handle.textureRequested &&
        handle.definition.texture !== null &&
        pixelRadius >= TEXTURE_REQUEST_PX
      ) {
        handle.textureRequested = true;
        void loadBodyTexture(handle.definition.texture, {
          anisotropy: gl.capabilities.getMaxAnisotropy(),
        })
          .then((texture) => {
            meshMaterial.map = texture;
            // The catalog colour was standing in for the surface; left in place it
            // would now tint it.
            meshMaterial.color.set('#ffffff');
            meshMaterial.needsUpdate = true;
          })
          .catch((error: unknown) => {
            // Not fatal, and not silent: the body keeps its colour and stays
            // usable, but a missing map is a deployment problem worth seeing.
            console.error(`Could not load the surface map for ${handle.definition.id}`, error);
          });
      }

      if (handle.orbit !== null) {
        handle.orbit.line.visible = showOrbits && sun !== undefined;
        if (sun !== undefined) {
          // Re-derive the ellipse from where the body actually is right now. Elements
          // frozen at one epoch drift off the real path as perturbations accumulate;
          // the osculating ellipse of this instant passes through the body by
          // definition. OrbitLine throttles the rebuild internally.
          const heliocentric = store.stateRelativeTo(handle.definition.id, 'sun', jd);
          if (heliocentric !== null) {
            const live = stateToOsculatingElements(
              heliocentric,
              // Two-body mu is G(M + m); the planet's own mass shifts Jupiter's
              // period by ~0.05%, which is small but free to include.
              sunGm + handle.definition.gmKm3S2,
              jd,
              handle.definition.id,
              '500@10',
            );
            if (live !== null) {
              handle.orbit.setElements(live);
            }
          }

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
