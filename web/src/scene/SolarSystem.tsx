import type { BodyDefinition, BodyId, TextureSetId } from '@sss/tools/types';
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
import { ringGeometry } from './ringGeometry.ts';
import { MAX_RING_ALPHA, ringMaterial } from './ringMaterial.ts';
import {
  applyRingShadow,
  SHADOW_FLOOR,
  SHADOW_OPACITY_EXPONENT,
  SHADOW_OPACITY_GAIN,
  type RingShadowUniforms,
} from './ringShadow.ts';
import { LIGHTING } from './shading.ts';
import { poleDirection } from './orientation.ts';
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

/** Scratch objects for the frame loop, which must not allocate. */
const RING_LOCAL_NORMAL = new THREE.Vector3(0, 0, 1);
const scratchPole = new THREE.Vector3();
const scratchSun = new THREE.Vector3();
const scratchBody = new THREE.Vector3();
const scratchCamera = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();

/** Marker diameter on screen, in CSS pixels. Matches the NASA Eyes look. */
const MARKER_PIXELS = 11;

/** Sphere tessellation. Generous, because a focused planet fills the screen. */
const SPHERE_SEGMENTS = 64;

/**
 * Which of the catalog's surface-map sets is drawn.
 *
 * A picker for this existed briefly and was removed by request: the true-colour set
 * changes only three bodies and the comparison was not worth a permanent control. Both
 * sets are still in the catalog and both are still pixel-checked by
 * textureAlignment.test.ts, so flipping this constant is the whole of re-enabling it,
 * and restoring the picker means putting `textureSet` back in the view store and the
 * selector back in LightingPanel.
 */
const ACTIVE_TEXTURE_SET: TextureSetId = 'illustrative';

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

interface BodyHandles {
  readonly definition: BodyDefinition;
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  readonly marker: THREE.Sprite;
  readonly orbit: OrbitLine | null;
  /** Ring system mesh, for the one body here that has one. */
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

      let ring: THREE.Mesh | null = null;
      let ringShadow: RingShadowUniforms | null = null;
      if (definition.rings !== null) {
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
          uRingShadowFloor: { value: SHADOW_FLOOR },
          uRingShadowExponent: { value: SHADOW_OPACITY_EXPONENT },
          uRingShadowGain: { value: SHADOW_OPACITY_GAIN },
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

      let orbit: OrbitLine | null = null;
      const elements = store.elementsFor(definition.id);
      if (definition.drawOrbit && elements !== null) {
        // Segment count and float32 anchoring are both handled inside OrbitLine;
        // see that file for why a fixed 512 segments put Pluto 93 radii off its own
        // orbit.
        orbit = new OrbitLine(elements, definition.radiusEquatorialKm, definition.color);
      }

      return {
        definition,
        group,
        mesh,
        marker,
        orbit,
        ring,
        ringShadow,
        requestedFile: null,
        shownFile: null,
        shownOriginDeg: 0,
        ringRequested: false,
      };
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

      const variant = handle.definition.textures[ACTIVE_TEXTURE_SET];

      // Point the axis where the IAU says it points and turn the body so the image
      // lands where the image belongs. One assignment carrying the axial tilt, the
      // rotation rate, its direction and the absolute phase. Until a map is on the
      // material there is nothing to misalign, so the incoming origin is used.
      handle.mesh.quaternion.copy(
        bodyOrientation(
          jd,
          handle.definition,
          handle.shownFile === null ? variant.longitudeOriginDeg : handle.shownOriginDeg,
        ),
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
      const meshMaterial = handle.mesh.material as
        | THREE.MeshBasicMaterial
        | THREE.MeshStandardMaterial;
      meshMaterial.transparent = sphereOpacity < 1;
      meshMaterial.opacity = sphereOpacity;

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

        if (!handle.ringRequested && pixelRadius >= TEXTURE_REQUEST_PX) {
          handle.ringRequested = true;
          void loadBodyTexture(handle.definition.rings.texture, {
            anisotropy: gl.capabilities.getMaxAnisotropy(),
            // u is radius here, not longitude: repeating it would fold the outer
            // edge of the rings back onto the inner one.
            wrapS: THREE.ClampToEdgeWrapping,
          })
            .then((texture) => {
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

      // Fetch the surface map the first time this body is worth looking at, and
      // again only if the selected set asks for a different file. Until it arrives
      // whatever is already there keeps showing -- the flat colour on first approach,
      // or the previous set's map when switching -- so nothing ever blanks out.
      if (handle.requestedFile !== variant.file && pixelRadius >= TEXTURE_REQUEST_PX) {
        handle.requestedFile = variant.file;
        const wanted = variant;
        void loadBodyTexture(wanted.file, {
          anisotropy: gl.capabilities.getMaxAnisotropy(),
        })
          .then((texture) => {
            // The set may have been switched again while this was in flight; a stale
            // response must not overwrite a newer choice.
            if (handle.requestedFile !== wanted.file) {
              return;
            }
            meshMaterial.map = texture;
            // The catalog colour was standing in for the surface; left in place it
            // would now tint it.
            meshMaterial.color.set('#ffffff');
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
