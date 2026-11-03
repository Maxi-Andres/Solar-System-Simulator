import type { BodyId } from '@sss/tools/types';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { skyAxes } from '../core/exoplanets.ts';
import { renderDemand } from '../core/renderDemand.ts';
import {
  imageOffsetKm,
  REMNANT_COLOR,
  remnantBodyId,
  remnantRadiusKm,
  remnantState,
  SUPERNOVA_REMNANTS,
  type SupernovaRemnant,
} from '../core/supernovaRemnants.ts';
import type { SimClock } from '../core/time.ts';
import { ORBIT_OPACITY } from './orbitGeometry.ts';
import { angularRadiusPixels, KM_PER_UNIT, PARSEC_KM } from './scale.ts';

/**
 * Each supernova remnant (core/supernovaRemnants.ts): its photograph, where one is free to
 * use, and a ring of its mean radius.
 *
 * ## The photograph
 *
 * A real image of it -- Hubble's, ESO's, NOIRLab's, as each entry credits -- laid at the
 * remnant's place at its **true angular size and orientation**: the image's published field
 * of view at the remnant's distance, and its north turned to the sky's north as it would be
 * seen. Drawn facing the camera: from the Sun's side that is the remnant as it is seen from
 * Earth; from anywhere else it is still Earth's view of it, turned to the camera -- a remnant
 * is roughly a sphere, so roughly what one would see, but not what one would, and the About
 * says so. Added in light: the picture's black adds nothing, and the stars show through.
 *
 * **Its brightness is the photograph's, not the sky's.** A long exposure through a telescope
 * makes a remnant glow; to the eye almost none of them shows at all (the Crab is a faint smudge
 * in a small telescope). The picture is drawn as its makers stretched it, a convention said in
 * the About, and fades in only once it is a few pixels across.
 *
 * ## The ring
 *
 * A circle of its mean radius, in H-alpha's red: a mark of its size, drawn as an orbit is --
 * from a few pixels across, and gone once the camera is well inside it. Over a photograph it
 * is drawn fainter: the picture shows the size itself.
 */

const SEGMENTS = 128;
const HIDDEN_PX = 4;
const SHOWN_PX = 14;
/** The photograph fades in between these sizes on screen, half its width in pixels. */
const IMAGE_HIDDEN_PX = 8;
const IMAGE_SHOWN_PX = 30;
/** The ring over a photograph: this share of its own opacity. */
const RING_OVER_IMAGE = 0.35;

const ARCMIN = Math.PI / 180 / 60;

function ramp(value: number, gone: number, full: number): number {
  if (value <= gone) return 0;
  if (value >= full) return 1;
  return (value - gone) / (full - gone);
}

export interface SupernovaRemnantsProps {
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
}

interface Drawn {
  readonly remnant: SupernovaRemnant;
  readonly ring: THREE.LineLoop;
  readonly radiusKm: number;
  /** The photograph's quad, its texture asked for once it could show. */
  readonly picture: THREE.Mesh | null;
  /** Its half-size, km, at the remnant's distance; and the sky's north and east there. */
  readonly halfWidthKm: number;
  readonly halfHeightKm: number;
  /** Its centre from Green's, km east and north on the sky. */
  readonly offset: { readonly east: number; readonly north: number };
  readonly north: THREE.Vector3;
  readonly east: THREE.Vector3;
  requested: boolean;
}

const scratchView = new THREE.Vector3();
const scratchUp = new THREE.Vector3();
const scratchRight = new THREE.Vector3();
const scratchImageUp = new THREE.Vector3();
const scratchImageRight = new THREE.Vector3();
const scratchNormal = new THREE.Vector3();
const scratchCentre = new THREE.Vector3();
const scratchBasis = new THREE.Matrix4();

export function SupernovaRemnants({ store, clock, focus, visible }: SupernovaRemnantsProps) {
  const { camera, size } = useThree();
  const group = useMemo(() => new THREE.Group(), []);
  // Made here, added by the effect: a memo may run twice (StrictMode).
  const drawn = useMemo<Drawn[]>(() => {
    const points: THREE.Vector3[] = [];
    for (let k = 0; k < SEGMENTS; k += 1) {
      const a = (k / SEGMENTS) * 2 * Math.PI;
      points.push(new THREE.Vector3(Math.cos(a), Math.sin(a), 0));
    }
    const ringGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const quad = new THREE.PlaneGeometry(2, 2);
    return SUPERNOVA_REMNANTS.map((remnant) => {
      const ring = new THREE.LineLoop(
        ringGeometry,
        new THREE.LineBasicMaterial({ color: REMNANT_COLOR, transparent: true, opacity: 0, depthWrite: false }),
      );
      ring.frustumCulled = false;
      ring.visible = false;
      const image = remnant.image;
      let picture: THREE.Mesh | null = null;
      if (image !== null) {
        picture = new THREE.Mesh(
          quad,
          new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            toneMapped: false,
            side: THREE.DoubleSide,
          }),
        );
        picture.frustumCulled = false;
        picture.visible = false;
        picture.renderOrder = -0.25;
      }
      const at = remnantState(remnant).position;
      const n = Math.hypot(at.x, at.y, at.z);
      const axes = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
      return {
        remnant,
        ring,
        radiusKm: remnantRadiusKm(remnant),
        picture,
        halfWidthKm: image === null ? 0 : Math.tan((image.widthArcmin / 2) * ARCMIN) * remnant.distancePc * PARSEC_KM,
        halfHeightKm: image === null ? 0 : Math.tan((image.heightArcmin / 2) * ARCMIN) * remnant.distancePc * PARSEC_KM,
        offset: image === null ? { east: 0, north: 0 } : imageOffsetKm(remnant, image),
        north: new THREE.Vector3(axes.north.x, axes.north.y, axes.north.z),
        east: new THREE.Vector3(axes.east.x, axes.east.y, axes.east.z),
        requested: false,
      };
    });
  }, []);
  useEffect(() => {
    for (const entry of drawn) {
      group.add(entry.ring);
      if (entry.picture !== null) group.add(entry.picture);
    }
    return () => {
      for (const entry of drawn) {
        group.remove(entry.ring);
        (entry.ring.material as THREE.Material).dispose();
        if (entry.picture !== null) {
          group.remove(entry.picture);
          const material = entry.picture.material as THREE.MeshBasicMaterial;
          material.map?.dispose();
          material.dispose();
        }
      }
      drawn[0]?.ring.geometry.dispose();
      drawn.find((entry) => entry.picture !== null)?.picture!.geometry.dispose();
    };
  }, [group, drawn]);

  useFrame(() => {
    const jd = clock.tdbJulianDay;
    const fov = (camera as THREE.PerspectiveCamera).fov;
    for (const entry of drawn) {
      const { remnant, ring, radiusKm, picture } = entry;
      const state = visible ? store.stateRelativeTo(remnantBodyId(remnant), focus, jd) : null;
      if (state === null) {
        ring.visible = false;
        if (picture !== null) picture.visible = false;
        continue;
      }
      ring.position.set(state.position.x / KM_PER_UNIT, state.position.y / KM_PER_UNIT, state.position.z / KM_PER_UNIT);
      const fromCameraKm = ring.position.distanceTo(camera.position) * KM_PER_UNIT;
      const inside = ramp(fromCameraKm / radiusKm, 0.3, 0.8);

      // The photograph: its size on screen, its texture once it could show.
      let imageShown = 0;
      if (picture !== null && remnant.image !== null) {
        const halfPx = angularRadiusPixels(Math.max(entry.halfWidthKm, entry.halfHeightKm), fromCameraKm, size.height, fov);
        imageShown = ramp(halfPx, IMAGE_HIDDEN_PX, IMAGE_SHOWN_PX) * inside;
        const material = picture.material as THREE.MeshBasicMaterial;
        if (imageShown > 0 && !entry.requested) {
          entry.requested = true;
          new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}remnants/${remnant.image.file}`, (texture) => {
            texture.colorSpace = THREE.SRGBColorSpace;
            material.map = texture;
            material.needsUpdate = true;
            renderDemand.request();
          });
        }
        picture.visible = imageShown > 0 && material.map !== null;
        if (picture.visible) {
          // Its north to the sky's north as seen from here: the remnant's north, less its part
          // along the line of sight; east to the left of it, as on the sky.
          scratchView.copy(ring.position).sub(camera.position).normalize();
          scratchUp.copy(entry.north).addScaledVector(scratchView, -entry.north.dot(scratchView));
          if (scratchUp.lengthSq() < 1e-12) {
            scratchUp.copy(entry.east).addScaledVector(scratchView, -entry.east.dot(scratchView));
          }
          scratchUp.normalize();
          scratchRight.crossVectors(scratchView, scratchUp).normalize();
          // Its centre, off Green's by as much as on the sky: north up, east to the left.
          scratchCentre
            .copy(ring.position)
            .addScaledVector(scratchUp, entry.offset.north / KM_PER_UNIT)
            .addScaledVector(scratchRight, -entry.offset.east / KM_PER_UNIT);
          // The image's own axes: its north lies northRightOfVerticalDeg right of its vertical.
          const turn = (remnant.image.northRightOfVerticalDeg * Math.PI) / 180;
          scratchImageUp.copy(scratchUp).multiplyScalar(Math.cos(turn)).addScaledVector(scratchRight, -Math.sin(turn));
          scratchImageRight.copy(scratchRight).multiplyScalar(Math.cos(turn)).addScaledVector(scratchUp, Math.sin(turn));
          scratchNormal.copy(scratchView).negate();
          scratchBasis.makeBasis(
            scratchImageRight.multiplyScalar(entry.halfWidthKm / KM_PER_UNIT),
            scratchImageUp.multiplyScalar(entry.halfHeightKm / KM_PER_UNIT),
            scratchNormal,
          );
          scratchBasis.setPosition(scratchCentre);
          picture.matrixAutoUpdate = false;
          picture.matrix.copy(scratchBasis);
          picture.matrixWorldNeedsUpdate = true;
          material.opacity = imageShown;
        }
      }

      const px = angularRadiusPixels(radiusKm, fromCameraKm, size.height, fov);
      const visibility = ramp(px, HIDDEN_PX, SHOWN_PX) * inside * (1 - (1 - RING_OVER_IMAGE) * imageShown);
      ring.visible = visibility > 0;
      if (!ring.visible) {
        continue;
      }
      ring.quaternion.copy(camera.quaternion);
      ring.scale.setScalar(radiusKm / KM_PER_UNIT);
      (ring.material as THREE.LineBasicMaterial).opacity = ORBIT_OPACITY * visibility;
    }
  });

  return <primitive object={group} />;
}
