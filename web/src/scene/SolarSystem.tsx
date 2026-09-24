import type { BodyDefinition, BodyId, TextureSetId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
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
  CLOUD_SEGMENTS,
  CLOUD_TOP_ALTITUDE_KM,
  EARTH_CLOUD_MAP,
  EARTH_NIGHT_MAP,
  EARTH_WATER_MASK,
  earthExtrasUniforms,
  WATER_IOR,
  type EarthExtrasUniforms,
} from './earthExtras.ts';
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
import { starColor } from './blackbody.ts';
import { poleDirection } from './orientation.ts';
import { loadBodyTexture } from './textureCache.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import {
  angularRadiusPixels,
  focusOrbitOpacity,
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
/** The rotation axis in a body's own frame: SphereGeometry puts its poles on +/-y. */
const BODY_LOCAL_POLE = new THREE.Vector3(0, 1, 0);
const scratchPole = new THREE.Vector3();
const scratchSun = new THREE.Vector3();
const scratchBody = new THREE.Vector3();
const scratchCamera = new THREE.Vector3();
const scratchQuaternion = new THREE.Quaternion();
const scratchDrift = new THREE.Quaternion();

const DEG = Math.PI / 180;

/** The one body with night lights, clouds and oceans. See earthExtras.ts. */
const EARTH_ID = 'earth';

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

      // The Sun emits rather than receives, so it gets an unlit material -- and one
      // driven far past full scale, because a light source is not a lit surface. See
      // SUN_OVEREXPOSURE. Earth gets the physical material, for one reason: `ior`, which
      // only exists there, and which is what stops its oceans reflecting twice as much
      // light as water does. Everything else is a rough diffuse surface with no specular
      // worth paying for.
      const material =
        definition.kind === 'star'
          ? new THREE.MeshBasicMaterial({
              color: new THREE.Color(definition.color).multiplyScalar(SUN_OVEREXPOSURE),
            })
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
        const cloud = new THREE.Mesh(
          // Four times the planet's tessellation, and that is a correctness
          // requirement rather than polish: at 64 segments a chord sags 7.7 km inside
          // the sphere, the deck floats 5 km above it, and the drift rotation stops
          // the two grids lining up -- so the clouds sank into the planet in vertical
          // stripes, one per facet. See CLOUD_SEGMENTS.
          new THREE.SphereGeometry(kmToUnits(deckRadiusKm), CLOUD_SEGMENTS, CLOUD_SEGMENTS / 2),
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
          new THREE.SphereGeometry(
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
          cloudReady: false,
          nightRequested: false,
          waterRequested: false,
          cloudRequested: false,
        };
      }

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

      let glare: THREE.Mesh | null = null;
      if (definition.kind === 'star') {
        // The Sun's own colour, from its colour index through the same Planck and CIE
        // path the stars use: scattered sunlight is still sunlight.
        const [red, green, blue] = starColor(SUN_COLOR_INDEX);
        glare = new THREE.Mesh(
          new THREE.PlaneGeometry(1, 1),
          new THREE.ShaderMaterial({
            uniforms: {
              uLevel: { value: 0 },
              uTanRadius: { value: 1 },
              uSunRadiusDeg: { value: 0.27 },
              uColor: { value: new THREE.Color(red, green, blue) },
            },
            vertexShader: SOLAR_GLARE_VERTEX_SHADER,
            fragmentShader: SOLAR_GLARE_FRAGMENT_SHADER,
            // Light adds. Depth is read, so a planet crossing in front of the Sun hides
            // the halo behind it, and never written, because a veil has no surface.
            blending: THREE.AdditiveBlending,
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
        marker,
        orbit,
        ring,
        ringShadow,
        earth,
        glare,
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

      if (handle.glare !== null) {
        // Everything the veil does follows from one distance: how bright it is, how far
        // it reaches, and where the disc masks it. See solarGlare.ts.
        const radiusDeg = glareRadiusDeg(handle.definition.radiusEquatorialKm, distanceKm);
        handle.glare.visible = radiusDeg > 0;
        if (handle.glare.visible) {
          const uniforms = (handle.glare.material as THREE.ShaderMaterial).uniforms;
          uniforms.uLevel!.value = glareLevel(
            handle.definition.radiusEquatorialKm,
            distanceKm,
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
            // would now tint it. **Except on the Sun**, where the colour is not a
            // stand-in at all: it is the exposure. Resetting it here is what silently
            // undid the overexposure the first time -- the disc went back to unity the
            // moment its map arrived, which is exactly when anybody would be looking.
            if (handle.definition.kind === 'star') {
              meshMaterial.color
                .set(handle.definition.color)
                .multiplyScalar(SUN_OVEREXPOSURE);
            } else {
              meshMaterial.color.set('#ffffff');
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

      if (handle.orbit !== null) {
        // The focused body's own orbit fades out once the body overflows the frame. By
        // then the visible piece of it is a straight line drawn across the picture rather
        // than anything that says where the body goes. Every other orbit stays: those are
        // still saying where things are relative to the one you are standing at.
        const fade =
          handle.definition.id === focus ? focusOrbitOpacity(pixelRadius, size.height) : 1;
        (handle.orbit.line.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * fade;

        handle.orbit.line.visible = showOrbits && sun !== undefined && fade > 0.005;
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
