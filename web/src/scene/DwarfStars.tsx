import type { BodyId, StarCatalog } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import * as THREE from 'three';

import {
  brightestStarV,
  CUT_SCALES,
  dwarfExtinctionV,
  dwarfSampleRequest,
  lightFainterThan,
  type DwarfSample,
} from '../core/dwarfStars.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { galaxyPositionPc, type LocalGroupArchive, type LocalGroupGalaxy } from '../core/localGroup.ts';
import { dustColumn } from '../core/nuclearCluster.ts';
import { renderDemand } from '../core/renderDemand.ts';
import type { LazySource } from '../core/satellites.ts';
import { brightestMagnitude } from '../core/starCatalog.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { lensState } from './lens.ts';
import { clusterMaterial, clusterUniforms, sceneToGalacticPc } from './NuclearCluster.tsx';
import { KM_PER_UNIT } from './scale.ts';
import { magnitudeToPeakCoefficients } from './starRendering.ts';
import { splitHigh, splitLow } from './stars3dShader.ts';

/**
 * The stars of the dwarf galaxy the camera is near (core/dwarfStars.ts), one by one, as a
 * globular cluster's are (GlobularClusters.tsx): a sample of the model made from its light,
 * size and shape, each star of its own brightness, through the nuclear cluster's shader -- the
 * same response, limit and point spread as every star, the dust in front added, the lens near
 * Sgr A*.
 *
 * ## Which galaxy
 *
 * The nearest whose brightest stars could show from the camera -- its population's brightest,
 * at the near edge of what is sampled of it -- as a cluster is chosen. One at a time; sampled in
 * a worker when it first could show, kept until another takes its place. With the Local Group
 * layer, as its light is.
 *
 * ## Its light, and its stars
 *
 * Its volume (LocalGroup.tsx) is all of its stars' light. Those drawn one by one are taken out
 * of it, so no light is counted twice: what stays a glow is the share of the population's light
 * in stars fainter than the faintest that shows (lightFainterThan) -- seen from as far as most
 * of its light is, the camera's distance from its centre and never less than its half-light
 * radius, and no fainter than what was sampled there. From afar that is all of it, and the
 * glow goes over to stars as the camera comes in.
 *
 * ## The dust in front
 *
 * From the Sun, A_V = 3.1 E(B-V), the catalogue's reddening; from anywhere else, that times the
 * share of the Sun's dust column to the galaxy that lies between the camera and it -- none, from
 * beside it, a hundred kiloparsecs out of the Milky Way's disc.
 *
 * ## Precision
 *
 * The sample is float32 parsecs about the galaxy's centre, at most eight scale radii out --
 * 6 kpc for Fornax, to a thousandth of a parsec. The camera about the centre is worked out in
 * float64 and handed over as a float32 pair.
 */

/** The extinction is worked out again when the camera has moved this share of its distance to the galaxy. */
const EXTINCTION_REFRESH_SHARE = 0.01;

/**
 * The galaxy whose stars are drawn, and the share of its light its volume keeps: LocalGroup.tsx
 * reads it each frame. Its key, null when none.
 */
export const dwarfStarsDrawn: { key: string | null; glowShare: number } = { key: null, glowShare: 1 };

export interface DwarfStarsProps {
  readonly source: LazySource<LocalGroupArchive>;
  readonly catalog: StarCatalog;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  /** The Local Group layer. */
  readonly visible: boolean;
}

interface Candidate {
  readonly galaxy: LocalGroupGalaxy;
  readonly centre: THREE.Vector3;
  readonly feH: number | null;
  readonly extinctionV: number;
  readonly brightestV: number;
  /** How far out it is sampled, pc. */
  readonly reachPc: number;
  readonly majorPc: number;
  readonly seed: number;
}

const scratchCamera = new THREE.Vector3();
const scratchSun = new THREE.Vector3();
const scratchCameraPc = new THREE.Vector3();

export function DwarfStars({ source, catalog, store, clock, focus, visible }: DwarfStarsProps) {
  const archive = useSyncExternalStore(source.subscribe, () => source.value);
  const group = useMemo(() => new THREE.Group(), []);

  // The dwarfs that can be sampled: a Plummer model and a V.
  const candidates = useMemo<readonly Candidate[]>(() => {
    if (archive === null) {
      return [];
    }
    return archive.galaxies.flatMap((galaxy) => {
      const k = galaxy.catalogueIndex;
      const model = galaxy.model;
      if (k === null || model === null || model.kind !== 'plummer' || galaxy.vMag === null) {
        return [];
      }
      const feH = archive.catalog?.feH[k] ?? null;
      const at = galaxyPositionPc(galaxy);
      return [
        {
          galaxy,
          centre: new THREE.Vector3(at.x, at.y, at.z),
          feH,
          extinctionV: dwarfExtinctionV(archive.catalog?.ebv[k] ?? null),
          brightestV: brightestStarV(feH),
          reachPc: CUT_SCALES * model.majorPc,
          majorPc: model.majorPc,
          seed: 20261111 + k,
        },
      ];
    });
  }, [archive]);

  const coefficients = useMemo(
    () => magnitudeToPeakCoefficients(brightestMagnitude(catalog), catalog.magnitudeLimit),
    [catalog],
  );
  const uniforms = useMemo(() => clusterUniforms(coefficients, catalog.magnitudeLimit), [coefficients, catalog]);
  const materials = useMemo(
    () => ({ stars: clusterMaterial(uniforms), twin: clusterMaterial({ ...uniforms, uLensImage: { value: 1 } }) }),
    [uniforms],
  );
  const drawn = useRef<{ candidate: Candidate; points: THREE.Points; twin: THREE.Points; sample: DwarfSample } | null>(null);
  const pending = useRef<Candidate | null>(null);
  const worker = useRef<Worker | null>(null);
  const extinction = useRef<{ key: string | null; value: number; cameraPc: THREE.Vector3 | null }>({
    key: null,
    value: 0,
    cameraPc: null,
  });

  useEffect(
    () => () => {
      worker.current?.terminate();
      worker.current = null;
      pending.current = null;
      const old = drawn.current;
      if (old !== null) {
        group.remove(old.points, old.twin);
        old.points.geometry.dispose();
        drawn.current = null;
      }
      materials.stars.dispose();
      materials.twin.dispose();
      dwarfStarsDrawn.key = null;
      dwarfStarsDrawn.glowShare = 1;
    },
    [materials, group],
  );

  useFrame(({ camera, gl }) => {
    const jd = clock.tdbJulianDay;
    const sun = store.stateRelativeTo('sun', focus, jd);
    const hide = (): void => {
      group.visible = false;
      dwarfStarsDrawn.key = null;
      dwarfStarsDrawn.glowShare = 1;
    };
    if (sun === null || !visible || candidates.length === 0) {
      hide();
      return;
    }
    // The camera about the Sun, pc, float64.
    scratchSun.set(
      camera.position.x * KM_PER_UNIT - sun.position.x,
      camera.position.y * KM_PER_UNIT - sun.position.y,
      camera.position.z * KM_PER_UNIT - sun.position.z,
    );
    const cameraPc = scratchCameraPc.copy(scratchSun).multiplyScalar(1 / PARSEC_KM);
    const limit = catalog.magnitudeLimit;

    // Which galaxy's stars, if any, could show.
    let best: Candidate | null = null;
    let bestPc = Infinity;
    for (const candidate of candidates) {
      const d = cameraPc.distanceTo(candidate.centre);
      const near = Math.max(1e-3, d - candidate.reachPc);
      if (candidate.brightestV + 5 * (Math.log10(near) - 1) <= limit && d < bestPc) {
        best = candidate;
        bestPc = d;
      }
    }
    if (best !== null && drawn.current?.candidate !== best && pending.current !== best) {
      const request = dwarfSampleRequest(best.galaxy, best.feH, best.seed);
      if (request !== null) {
        pending.current = best;
        worker.current?.terminate();
        const made = new Worker(new URL('../core/dwarfStars.worker.ts', import.meta.url), { type: 'module' });
        worker.current = made;
        const candidate = best;
        made.onmessage = (event: MessageEvent<DwarfSample>) => {
          const sample = event.data;
          const colors = new Float32Array(sample.count * 3);
          for (let i = 0; i < sample.count; i += 1) {
            const [r, g, b] = starColor(sample.colorIndex[i]!);
            colors.set([r, g, b], i * 3);
          }
          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.BufferAttribute(sample.positions, 3));
          geometry.setAttribute('absMag', new THREE.BufferAttribute(sample.absoluteV, 1));
          geometry.setAttribute('starColor', new THREE.BufferAttribute(colors, 3));
          const old = drawn.current;
          if (old !== null) {
            group.remove(old.points, old.twin);
            old.points.geometry.dispose();
          }
          const points = new THREE.Points(geometry, materials.stars);
          const twin = new THREE.Points(geometry, materials.twin);
          for (const each of [points, twin]) {
            each.frustumCulled = false;
            each.renderOrder = -1;
            group.add(each);
          }
          drawn.current = { candidate, points, twin, sample };
          pending.current = null;
          made.terminate();
          worker.current = null;
          renderDemand.request();
        };
        made.postMessage(request);
      }
    }

    const current = drawn.current;
    if (current === null || current.candidate !== best) {
      hide();
      return;
    }
    group.visible = true;
    const { candidate, sample } = current;
    // The camera about the galaxy's centre, pc, float64; the group at the camera.
    scratchCamera.copy(cameraPc).sub(candidate.centre);
    group.position.copy(camera.position);
    (uniforms['uCameraHigh']!.value as THREE.Vector3).set(splitHigh(scratchCamera.x), splitHigh(scratchCamera.y), splitHigh(scratchCamera.z));
    (uniforms['uCameraLow']!.value as THREE.Vector3).set(splitLow(scratchCamera.x), splitLow(scratchCamera.y), splitLow(scratchCamera.z));
    uniforms['uPixelRatio']!.value = gl.getPixelRatio();

    // The dust between, again only once the camera has moved enough to change it.
    const last = extinction.current;
    const key = candidate.galaxy.key;
    const distancePc = scratchCamera.length();
    if (
      last.key !== key ||
      last.cameraPc === null ||
      last.cameraPc.distanceTo(scratchCamera) > EXTINCTION_REFRESH_SHARE * Math.max(distancePc, 1)
    ) {
      if (candidate.extinctionV === 0) {
        last.value = 0;
      } else {
        const centre = sceneToGalacticPc(candidate.centre.clone().multiplyScalar(PARSEC_KM));
        const share = dustColumn(sceneToGalacticPc(scratchSun), centre) / Math.max(dustColumn([0, 0, 0], centre), 1e-30);
        last.value = candidate.extinctionV * Math.min(1, share);
      }
      last.key = key;
      last.cameraPc = scratchCamera.clone();
    }
    uniforms['uExtinction']!.value = last.value;
    current.twin.visible = lensState.on;

    // What its volume keeps: the light of the stars too faint to show (see the header).
    const most = Math.max(distancePc, candidate.majorPc);
    const shows = limit - last.value - 5 * (Math.log10(most) - 1);
    const sampled = Math.max(sample.allV, sample.limitV - 5 * (Math.log10(candidate.majorPc) - 1));
    dwarfStarsDrawn.key = key;
    dwarfStarsDrawn.glowShare = lightFainterThan(candidate.feH, Math.min(shows, sampled));
  });

  return <primitive object={group} />;
}
