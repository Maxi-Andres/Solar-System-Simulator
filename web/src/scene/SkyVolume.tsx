import type { BodyId } from '@sss/tools/types';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';

import type { EphemerisStore } from '../core/ephemerisStore.ts';
import {
  CHANNEL_WAVELENGTHS_UM,
  columnAt,
  extinctionCurve,
  galaxyHalfLightPc,
  GIANTS,
  YOUNG_COLOUR_INDEX,
} from '../core/localGroup.ts';
import { renderDemand } from '../core/renderDemand.ts';
import {
  depthTexels,
  parseSkyMap,
  SKY_STEPS,
  skyBox,
  skyFrame,
  skyScales,
  skyVolumesDrawn,
  type SkyFrame,
} from '../core/skyMap.ts';
import { PARSEC_KM } from '../core/stars3d.ts';
import type { SimClock } from '../core/time.ts';
import { starColor } from './blackbody.ts';
import { faceOnLevels, faceOnTexture, pngPixels } from './faceOnTexture.ts';
import { balmerColour, MARKS_FROM_LY, NEAR_SHARE, pointShare, WHITE_MU } from './LocalGroup.tsx';
import { galaxyVisibility } from './MilkyWay.tsx';
import { KM_PER_UNIT, LIGHT_YEAR_KM } from './scale.ts';
import { UNITS_PER_PC } from './stars3dShader.ts';

/**
 * A galaxy drawn from its sky map (core/skyMap.ts): the Small Magellanic Cloud, a cloud deeper
 * along our line of sight than it is wide, not a disc.
 *
 * Its maps are what is seen of it from Earth -- old stars, star formation, dust and glowing gas,
 * each a column on the sky -- and how deep each kind of star lies along each direction. Each
 * point of the sky map is spread along its line of sight by the Gaussian of its place: the old
 * stars' light by the old stars' (from RR Lyrae), the young stars', their gas's and the dust by
 * the young stars' (from Cepheids). So from Earth the column along every line of sight is the
 * map, and the cloud is its photographs; from beside it, it is a cigar pointing at the Sun --
 * its old stars 3.7 kpc either side of their mean along it, against some 2 across -- its young
 * stars nearer us in the north-east.
 *
 * ## Drawn
 *
 * As the Local Group's other volumes (LocalGroup.tsx): a box about the camera, back faces, its
 * ray marched front to back in SKY_STEPS (core/skyMap.ts) jittered steps. Each step finds its
 * point's direction from the Sun -- the point in the map's frame (east, north, away about its
 * centre) with the Sun referencePc behind, so every number is a few tens of kiloparsecs, which
 * float32 holds to 0.004 pc -- reads the sky map there and the depth grid, and adds the light of
 * each kind times its Gaussian at the point's distance, dimmed by the dust in front: its own
 * step's dust by half, as for light and dust mixed evenly through the step.
 *
 * The same exposure, shoulder, near limit and hand-off to a point when it is too small for a
 * pixel as the others; its smooth exponential ellipsoid in LocalGroup.tsx stands aside once the
 * maps are loaded (skyVolumesDrawn), its point staying.
 */

const VERTEX = /* glsl */ `
#include <common>
#include <logdepthbuf_pars_vertex>
uniform mat4 uLocal;
varying vec3 vRel;
void main() {
  vRel = (uLocal * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  #include <logdepthbuf_vertex>
}
`;

const FRAGMENT = /* glsl */ `
#include <logdepthbuf_pars_fragment>
uniform float uFade;
// The map's frame (rows: east, north, away), the camera in it about the centre, pc, and the box.
uniform mat3 uAxes;
uniform vec3 uCamera;
uniform vec3 uBoxCentre;
uniform vec3 uBoxHalf;
// The map's distance: the Sun is this far behind its centre, along away.
uniform float uReferencePc;
// Light nearer the camera than this, pc, is left out (LocalGroup.tsx).
uniform float uNear;
// The sky map (faceOnTexture.ts): old and young stars' light, L_Sun/pc^2, the dust's V optical
// depth, the gas's Balmer light; and its half side on the tangent plane, xi = east / away.
uniform sampler2D uSky;
uniform float uSkyHalf;
// The depth grid (skyMap.ts depthTexels): old mean less uReferencePc, old sigma, young the
// same, kpc; and its half side.
uniform sampler2D uDepth;
uniform float uDepthHalf;
uniform vec3 uOldGlow;
uniform vec3 uYoungGlow;
uniform vec3 uNebulaGlow;
uniform vec3 uDustTau;
// A screen pixel's angle, and a texel's on the tangent plane, radians: which mipmap to read.
uniform float uPixelAngle;
uniform float uTexelAngle;
varying vec3 vRel;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec2 slab(vec3 o, vec3 d, vec3 halfSize) {
  vec3 inv = 1.0 / d;
  vec3 a = (-halfSize - o) * inv;
  vec3 b = (halfSize - o) * inv;
  vec3 lo = min(a, b);
  vec3 hi = max(a, b);
  return vec2(max(max(lo.x, lo.y), max(lo.z, 0.0)), min(hi.x, min(hi.y, hi.z)));
}

void main() {
  #include <logdepthbuf_fragment>
  vec3 d = uAxes * normalize(vRel);
  vec2 span = slab(uCamera - uBoxCentre, d, uBoxHalf);
  span.x = max(span.x, uNear);
  if (span.y <= span.x) discard;
  float jitter = hash(gl_FragCoord.xy);
  float dt = (span.y - span.x) / float(${SKY_STEPS});
  // The camera about the Sun.
  vec3 q0 = uCamera + vec3(0.0, 0.0, uReferencePc);
  vec3 light = vec3(0.0);
  vec3 through = vec3(1.0);
  for (int i = 0; i < ${SKY_STEPS}; i++) {
    float t = span.x + (float(i) + jitter) * dt;
    vec3 q = q0 + d * t;
    // Its standard coordinates: its direction from the Sun on the tangent plane.
    vec2 st = q.xy / q.z;
    // The maps end in a circle short of their edge (tools/galaxies/prepare.py): nothing past it.
    if (dot(st, st) >= uSkyHalf * uSkyHalf) continue;
    float distancePc = length(q);
    vec4 depth = texture(uDepth, st / (2.0 * uDepthHalf) + 0.5) * 1000.0;
    // Each kind's Gaussian at this distance, times the step: old and young. Past 4.3 sigmas,
    // where it is a ten-thousandth of its peak, the map is not read.
    vec2 x = (vec2(distancePc - uReferencePc) - depth.xz) / depth.yw;
    vec2 g = exp(-0.5 * x * x);
    if (max(g.x, g.y) < 1e-4) continue;
    vec2 n = g / (2.5066283 * depth.yw) * dt;
    // The map averaged over the pixel's footprint as seen from the Sun, or, if longer, over the
    // step's sweep across the tangent plane -- texels: from beside the cloud a step crosses
    // tens of them, and read at one point they would be noise.
    float footprint = t * uPixelAngle / distancePc;
    float sweep = length(d.xy * q.z - q.xy * d.z) / (q.z * q.z) * dt;
    float lod = max(0.0, log2(max(footprint, sweep) / uTexelAngle));
    vec4 m = textureLod(uSky, st / (2.0 * uSkyHalf) + 0.5, lod);
    vec3 emitted = uOldGlow * (m.r * n.x) + (uYoungGlow * m.g + uNebulaGlow * m.a) * n.y;
    // The step's dust: half of it in front of its own light, all of it in front of what is behind.
    vec3 dimmed = exp(-0.5 * uDustTau * (m.b * n.y));
    light += through * dimmed * emitted;
    through *= dimmed * dimmed;
  }
  light = (1.0 - exp(-light)) * uFade;
  if (max(light.r, max(light.g, light.b)) < 0.0005) discard;
  // Half a display step of noise, as the others'.
  gl_FragColor = vec4(max(light + (hash(gl_FragCoord.xy + 17.0) - 0.5) / 255.0, 0.0), 1.0);
}
`;

/** A colour, linear, at unit luminance, over the white column: light per L_Sun/pc^2. */
function perColumn([r, g, b]: readonly [number, number, number]): THREE.Vector3 {
  return new THREE.Vector3(r, g, b).divideScalar(columnAt(WHITE_MU));
}

export interface SkyVolumeProps {
  /** The giant drawn (core/localGroup.ts GIANTS), whose maps are galaxies/<key>.png and .json. */
  readonly galaxyKey: string;
  readonly store: EphemerisStore;
  readonly clock: SimClock;
  readonly focus: BodyId;
  readonly visible: boolean;
}

const noRaycast = (): void => {};
const scratchSize = new THREE.Vector2();

export function SkyVolume({ galaxyKey, store, clock, focus, visible }: SkyVolumeProps) {
  const galaxy = useMemo(() => GIANTS.find((g) => g.key === galaxyKey) ?? null, [galaxyKey]);
  const group = useMemo(() => new THREE.Group(), []);
  const uniforms = useMemo(
    () => ({
      uFade: { value: 0 },
      uLocal: { value: new THREE.Matrix4() },
      uAxes: { value: new THREE.Matrix3() },
      uCamera: { value: new THREE.Vector3() },
      uBoxCentre: { value: new THREE.Vector3() },
      uBoxHalf: { value: new THREE.Vector3(1, 1, 1) },
      uReferencePc: { value: 1 },
      uNear: { value: 0 },
      uSky: { value: null as THREE.Texture | null },
      uSkyHalf: { value: 1 },
      uDepth: { value: null as THREE.Texture | null },
      uDepthHalf: { value: 1 },
      uOldGlow: { value: new THREE.Vector3() },
      uYoungGlow: { value: new THREE.Vector3() },
      uNebulaGlow: { value: new THREE.Vector3() },
      uDustTau: { value: new THREE.Vector3() },
      uPixelAngle: { value: 1e-3 },
      uTexelAngle: { value: 1e-3 },
    }),
    [],
  );
  const mesh = useMemo(() => {
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      toneMapped: false,
    });
    const box = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), material);
    box.frustumCulled = false;
    box.raycast = noRaycast;
    box.matrixAutoUpdate = false;
    box.visible = false;
    return box;
  }, [uniforms]);
  // What the loaded maps fix: the frame, the box, the light per unit before the hand-off to a point.
  const loaded = useRef<{
    frame: SkyFrame;
    box: ReturnType<typeof skyBox>;
    oldGlow: THREE.Vector3;
    youngGlow: THREE.Vector3;
    nebulaGlow: THREE.Vector3;
  } | null>(null);
  const requested = useRef(false);
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    group.add(mesh);
    return () => {
      group.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [group, mesh]);

  // The maps, asked for with the Local Group's catalogue and the discs' maps.
  useEffect(() => {
    if (!wanted || galaxy === null) {
      return;
    }
    let cancelled = false;
    const textures: THREE.Texture[] = [];
    const base = `${import.meta.env.BASE_URL}galaxies/${galaxy.key}`;
    const described = fetch(`${base}.json`).then((response) => response.json()).then(parseSkyMap);
    const gas = described.then((map) => (map.nebula === undefined ? null : pngPixels(`${base}-nebula.png`)));
    void Promise.all([described, pngPixels(`${base}.png`), gas])
      .then(([map, pixels, nebula]) => {
        const scales = skyScales(galaxy, map);
        if (cancelled || scales === null) {
          return;
        }
        const sky = faceOnTexture(faceOnLevels(pixels, map, scales, nebula));
        const m = map.depth.size;
        const half = new Uint16Array(m * m * 4);
        depthTexels(map.depth, map.referencePc).forEach((v, k) => {
          half[k] = THREE.DataUtils.toHalfFloat(v);
        });
        const depth = new THREE.DataTexture(half, m, m, THREE.RGBAFormat, THREE.HalfFloatType);
        depth.minFilter = THREE.LinearFilter;
        depth.magFilter = THREE.LinearFilter;
        depth.wrapS = THREE.ClampToEdgeWrapping;
        depth.wrapT = THREE.ClampToEdgeWrapping;
        depth.colorSpace = THREE.NoColorSpace;
        depth.needsUpdate = true;
        textures.push(sky, depth);
        const frame = skyFrame(map);
        const box = skyBox(map);
        const { east, north, away } = frame;
        uniforms.uAxes.value.set(east.x, east.y, east.z, north.x, north.y, north.z, away.x, away.y, away.z);
        uniforms.uBoxCentre.value.set(box.centre.x, box.centre.y, box.centre.z);
        uniforms.uBoxHalf.value.set(box.half.x, box.half.y, box.half.z);
        uniforms.uReferencePc.value = map.referencePc;
        uniforms.uSky.value = sky;
        uniforms.uSkyHalf.value = (map.halfDeg * Math.PI) / 180;
        uniforms.uTexelAngle.value = (2 * map.halfDeg * Math.PI) / 180 / map.size;
        uniforms.uDepth.value = depth;
        uniforms.uDepthHalf.value = (map.depth.halfDeg * Math.PI) / 180;
        uniforms.uDustTau.value.set(...(CHANNEL_WAVELENGTHS_UM.map((um) => extinctionCurve(um)) as [number, number, number]));
        loaded.current = {
          frame,
          box,
          oldGlow: perColumn(starColor(galaxy.colourIndex)),
          youngGlow: perColumn(starColor(YOUNG_COLOUR_INDEX)),
          nebulaGlow: nebula === null ? new THREE.Vector3() : perColumn(balmerColour()),
        };
        skyVolumesDrawn.add(galaxy.key);
        renderDemand.request();
      })
      .catch(() => {
        // No map: the smooth ellipsoid in LocalGroup.tsx stays.
      });
    return () => {
      cancelled = true;
      skyVolumesDrawn.delete(galaxy.key);
      loaded.current = null;
      mesh.visible = false;
      uniforms.uSky.value = null;
      uniforms.uDepth.value = null;
      for (const texture of textures) texture.dispose();
    };
  }, [wanted, galaxy, uniforms, mesh]);

  useFrame(({ camera, gl }) => {
    const sun = store.stateRelativeTo('sun', focus, clock.tdbJulianDay);
    if (sun === null || !visible || galaxy === null) {
      group.visible = false;
      return;
    }
    const cx = (camera.position.x * KM_PER_UNIT - sun.position.x) / PARSEC_KM;
    const cy = (camera.position.y * KM_PER_UNIT - sun.position.y) / PARSEC_KM;
    const cz = (camera.position.z * KM_PER_UNIT - sun.position.z) / PARSEC_KM;
    const fromSunKm = Math.hypot(cx, cy, cz) * PARSEC_KM;
    if (!requested.current && fromSunKm > (MARKS_FROM_LY / 2) * LIGHT_YEAR_KM) {
      requested.current = true;
      setWanted(true);
    }
    const fade = galaxyVisibility(fromSunKm);
    const maps = loaded.current;
    group.visible = fade > 0 && maps !== null;
    if (maps === null || fade <= 0) {
      return;
    }
    const { frame, box } = maps;
    // The map's centre about the camera, pc, in float64.
    const rx = frame.centrePc.x - cx;
    const ry = frame.centrePc.y - cy;
    const rz = frame.centrePc.z - cz;
    const distancePc = Math.hypot(rx, ry, rz);
    const fov = (camera as THREE.PerspectiveCamera).fov;
    const heightPx = gl.getDrawingBufferSize(scratchSize).y;
    const pixelsPerRadian = heightPx / (2 * Math.tan((fov * Math.PI) / 360));
    // Its volume's share of its light; the rest is its point's (LocalGroup.tsx).
    const share = 1 - pointShare((galaxyHalfLightPc(galaxy)! / distancePc) * pixelsPerRadian);
    mesh.visible = share > 0;
    if (share <= 0) {
      return;
    }
    group.position.copy(camera.position);
    group.updateMatrixWorld();
    uniforms.uFade.value = fade;
    uniforms.uOldGlow.value.copy(maps.oldGlow).multiplyScalar(share);
    uniforms.uYoungGlow.value.copy(maps.youngGlow).multiplyScalar(share);
    uniforms.uNebulaGlow.value.copy(maps.nebulaGlow).multiplyScalar(share);
    uniforms.uPixelAngle.value = ((fov * Math.PI) / 180) / heightPx;
    // The near limit as the others': a share of the camera's distance from the centre, never
    // less than half the galaxy's scale.
    const model = galaxy.model;
    const scale = model !== null && model.kind !== 'disc' ? model.majorPc : 0;
    uniforms.uNear.value = Math.max(NEAR_SHARE * distancePc, 0.5 * scale);
    const { east, north, away } = frame;
    uniforms.uCamera.value.set(
      -(rx * east.x + ry * east.y + rz * east.z),
      -(rx * north.x + ry * north.y + rz * north.z),
      -(rx * away.x + ry * away.y + rz * away.z),
    );
    // The box about the camera: its axes the frame's, its sides the box's, its centre off the map's.
    const c = box.centre;
    const s = UNITS_PER_PC;
    mesh.matrix.makeBasis(
      new THREE.Vector3(east.x, east.y, east.z).multiplyScalar(box.half.x * s),
      new THREE.Vector3(north.x, north.y, north.z).multiplyScalar(box.half.y * s),
      new THREE.Vector3(away.x, away.y, away.z).multiplyScalar(box.half.z * s),
    );
    mesh.matrix.setPosition(
      (rx + c.x * east.x + c.y * north.x + c.z * away.x) * s,
      (ry + c.x * east.y + c.y * north.y + c.z * away.y) * s,
      (rz + c.x * east.z + c.y * north.z + c.z * away.z) * s,
    );
    uniforms.uLocal.value.copy(mesh.matrix);
    mesh.matrixWorldNeedsUpdate = true;
  });

  return <primitive object={group} />;
}
