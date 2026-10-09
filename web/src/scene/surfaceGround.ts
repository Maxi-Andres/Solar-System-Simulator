import type { BodyDefinition, SurfaceTrack } from '@sss/tools/types';
import * as THREE from 'three';

import { KM_PER_UNIT } from './scale.ts';
import { TRAIL_COLOR, TRAIL_OPACITY } from './trajectoryLine.ts';

/**
 * The ground under a craft on another body's surface, and the way it came.
 *
 * The planet is a 64 x 32 sphere. Its vertices sit on the ellipsoid and its flat faces
 * between them sag inside it -- by up to 4 km on Mars, at the middle of a face. A rover
 * placed on the true ellipsoid would hang kilometres above the faces around it, which
 * at a rover's scale is the whole picture. So around each one this draws the ellipsoid
 * itself: a patch two degrees across, fine enough that its own faces sag by centimetres,
 * with the planet's material on it -- the same map, the same light. The sphere's faces
 * are all below the ellipsoid, so the patch always lies on top of them.
 *
 * Every vertex is relative to the craft, in the planet's own frame: small numbers, so
 * float32 keeps them to the millimetre where a frame centred on the planet would round
 * them to 20 cm. The object is meant to hang from the craft's group, turned with the
 * planet's mesh -- see `update`.
 *
 * The traverse is a white line through every stop so far, draped on the ellipsoid. It
 * joins where drives ended; the drives themselves went their own way between them.
 */

/** Half the patch's width, degrees of latitude and longitude: 59 km on Mars. */
export const PATCH_HALF_WIDTH_DEG = 1;

/** Faces along each side of the patch: 1.2 km each, sagging 5 cm inside the ellipsoid. */
export const PATCH_SEGMENTS = 96;

/** The patch is drawn while the camera is within this of its craft, km. */
export const PATCH_SHOWN_KM = 150;

/**
 * How far toward the camera the traverse is drawn, as a fraction of its distance.
 *
 * The line lies on the ground, so the depth buffer cannot separate the two by itself.
 * Moving each vertex toward the eye by this fraction leaves it at the same place on
 * screen and nearer in depth: 0.5 m at 50 km, 0.1 mm at 10 m -- four times the depth
 * buffer's step everywhere, see logDepth.ts.
 */
export const TRAVERSE_DEPTH_BIAS = 1e-5;

/** Longest a traverse segment may be before it is cut to follow the curve, km. */
const MAX_SEGMENT_KM = 0.2;

const DEG = Math.PI / 180;

/**
 * A point of the ellipsoid in the planet mesh's own frame, km, before the mesh's
 * flattening scale: +y the pole, -x the longitude the map starts at, +z 90 degrees east.
 */
export function meshFramePointKm(
  host: BodyDefinition,
  latitudeDeg: number,
  longitudeDeg: number,
  mapOriginDeg: number,
): THREE.Vector3 {
  const lat = latitudeDeg * DEG;
  const lon = (longitudeDeg - mapOriginDeg) * DEG;
  const a = host.radiusEquatorialKm;
  const c = host.radiusPolarKm;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const radius = 1 / Math.sqrt((cosLat * cosLat) / (a * a) + (sinLat * sinLat) / (c * c));
  return new THREE.Vector3(
    -radius * cosLat * Math.cos(lon),
    radius * sinLat,
    radius * cosLat * Math.sin(lon),
  );
}

/** The ellipsoid's outward normal at a point of it, in the same frame. */
function ellipsoidNormal(host: BodyDefinition, point: THREE.Vector3): THREE.Vector3 {
  const a2 = host.radiusEquatorialKm ** 2;
  const c2 = host.radiusPolarKm ** 2;
  return new THREE.Vector3(point.x / a2, point.y / c2, point.z / a2).normalize();
}

/**
 * The patch around one place: positions relative to it in scene units, normals, and the
 * map's coordinates as the planet's sphere lays them out -- u east from the map's first
 * column, v up from the south pole.
 */
export function patchGeometry(
  host: BodyDefinition,
  latitudeDeg: number,
  longitudeDeg: number,
  mapOriginDeg: number,
): THREE.BufferGeometry {
  const centre = meshFramePointKm(host, latitudeDeg, longitudeDeg, mapOriginDeg);
  // The map's columns count east from its first one, 0 to 1 across. The whole turns
  // between that column and the patch's centre are taken out once, so u is continuous
  // across the patch.
  const turns = Math.floor((longitudeDeg - mapOriginDeg) / 360) * 360;
  const side = PATCH_SEGMENTS + 1;
  const positions = new Float32Array(side * side * 3);
  const normals = new Float32Array(side * side * 3);
  const uvs = new Float32Array(side * side * 2);
  for (let row = 0; row < side; row += 1) {
    const lat = Math.max(
      -90,
      Math.min(90, latitudeDeg + PATCH_HALF_WIDTH_DEG * (1 - (2 * row) / PATCH_SEGMENTS)),
    );
    for (let column = 0; column < side; column += 1) {
      const lon = longitudeDeg + PATCH_HALF_WIDTH_DEG * ((2 * column) / PATCH_SEGMENTS - 1);
      const point = meshFramePointKm(host, lat, lon, mapOriginDeg);
      const normal = ellipsoidNormal(host, point);
      const k = row * side + column;
      positions[k * 3] = (point.x - centre.x) / KM_PER_UNIT;
      positions[k * 3 + 1] = (point.y - centre.y) / KM_PER_UNIT;
      positions[k * 3 + 2] = (point.z - centre.z) / KM_PER_UNIT;
      normals.set([normal.x, normal.y, normal.z], k * 3);
      // A patch straddling the map's edge runs a little past 0 or 1 there; none of the
      // craft here stands within a degree of it.
      uvs[k * 2] = (lon - mapOriginDeg - turns) / 360;
      uvs[k * 2 + 1] = (lat + 90) / 180;
    }
  }
  const indices: number[] = [];
  for (let row = 0; row < PATCH_SEGMENTS; row += 1) {
    for (let column = 0; column < PATCH_SEGMENTS; column += 1) {
      const a = row * side + column;
      const b = a + side;
      // Counter-clockwise seen from outside: rows run north to south, columns west to east.
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  // Hung from the craft and drawn only near it: never worth culling.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
  return geometry;
}

/**
 * The traverse up to stop `last`, draped on the ellipsoid, relative to stop `centre`,
 * scene units. A segment longer than MAX_SEGMENT_KM is cut so it follows the curve
 * rather than cutting under it.
 */
export function traversePoints(
  host: BodyDefinition,
  track: SurfaceTrack,
  last: number,
  centre: number,
  mapOriginDeg: number,
): Float32Array {
  const origin = meshFramePointKm(
    host,
    track.latitudeDeg[centre]!,
    track.longitudeDeg[centre]!,
    mapOriginDeg,
  );
  const points: number[] = [];
  const push = (lat: number, lon: number): void => {
    const point = meshFramePointKm(host, lat, lon, mapOriginDeg);
    points.push(
      (point.x - origin.x) / KM_PER_UNIT,
      (point.y - origin.y) / KM_PER_UNIT,
      (point.z - origin.z) / KM_PER_UNIT,
    );
  };
  push(track.latitudeDeg[0]!, track.longitudeDeg[0]!);
  for (let i = 1; i <= last; i += 1) {
    const lat0 = track.latitudeDeg[i - 1]!;
    const lon0 = track.longitudeDeg[i - 1]!;
    const lat1 = track.latitudeDeg[i]!;
    const lon1 = track.longitudeDeg[i]!;
    const lengthKm = meshFramePointKm(host, lat0, lon0, 0).distanceTo(
      meshFramePointKm(host, lat1, lon1, 0),
    );
    const pieces = Math.max(1, Math.ceil(lengthKm / MAX_SEGMENT_KM));
    for (let k = 1; k <= pieces; k += 1) {
      const f = k / pieces;
      push(lat0 + (lat1 - lat0) * f, lon0 + (lon1 - lon0) * f);
    }
  }
  return new Float32Array(points);
}

const TRAVERSE_VERTEX_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Toward the eye along its own line of sight: same pixel, nearer depth.
    mvPosition.xyz *= 1.0 - ${TRAVERSE_DEPTH_BIAS.toExponential()};
    gl_Position = projectionMatrix * mvPosition;
    #include <logdepthbuf_vertex>
  }
`;

const TRAVERSE_FRAGMENT_SHADER = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>

  uniform vec3 uColor;
  uniform float uOpacity;

  void main() {
    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(uColor, uOpacity);
  }
`;

/** The ground and the traverse for one craft. See the comment at the top. */
export class SurfaceGround {
  /** Hang from the craft's group; give it the planet mesh's orientation every frame. */
  readonly object = new THREE.Group();

  readonly #host: BodyDefinition;
  readonly #track: SurfaceTrack;
  readonly #patch: THREE.Mesh;
  readonly #traverse: THREE.Line;
  readonly #traverseMaterial: THREE.ShaderMaterial;
  #builtStop = -1;
  #builtOrigin = Number.NaN;

  constructor(host: BodyDefinition, track: SurfaceTrack, hostMaterial: THREE.Material) {
    this.#host = host;
    this.#track = track;
    this.#patch = new THREE.Mesh(new THREE.BufferGeometry(), hostMaterial);
    this.#patch.frustumCulled = false;
    this.#traverseMaterial = new THREE.ShaderMaterial({
      vertexShader: TRAVERSE_VERTEX_SHADER,
      fragmentShader: TRAVERSE_FRAGMENT_SHADER,
      uniforms: {
        uColor: { value: new THREE.Color(TRAIL_COLOR) },
        uOpacity: { value: TRAIL_OPACITY },
      },
      transparent: true,
      depthWrite: false,
    });
    this.#traverse = new THREE.Line(new THREE.BufferGeometry(), this.#traverseMaterial);
    this.#traverse.frustumCulled = false;
    this.object.add(this.#patch, this.#traverse);
  }

  /**
   * For one frame: the craft is at stop `stop`, the planet's map starts at
   * `mapOriginDeg`, and the patch and the traverse are each shown or not.
   * `traverseOpacity` scales the line, as a trail fades in with its planet's system.
   */
  update(
    stop: number,
    mapOriginDeg: number,
    showPatch: boolean,
    showTraverse: boolean,
    traverseOpacity: number,
  ): void {
    if (stop !== this.#builtStop || mapOriginDeg !== this.#builtOrigin) {
      const track = this.#track;
      this.#patch.geometry.dispose();
      this.#patch.geometry = patchGeometry(
        this.#host,
        track.latitudeDeg[stop]!,
        track.longitudeDeg[stop]!,
        mapOriginDeg,
      );
      this.#traverse.geometry.dispose();
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        'position',
        new THREE.BufferAttribute(traversePoints(this.#host, track, stop, stop, mapOriginDeg), 3),
      );
      geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), Infinity);
      this.#traverse.geometry = geometry;
      this.#builtStop = stop;
      this.#builtOrigin = mapOriginDeg;
    }
    this.#patch.visible = showPatch;
    this.#traverse.visible = showTraverse;
    this.#traverseMaterial.uniforms.uOpacity!.value = TRAIL_OPACITY * traverseOpacity;
  }

  dispose(): void {
    this.#patch.geometry.dispose();
    this.#traverse.geometry.dispose();
    this.#traverseMaterial.dispose();
  }
}
