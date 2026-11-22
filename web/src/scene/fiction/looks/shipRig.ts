import * as THREE from 'three';

import { type Planetshine, type ShipFinish, setShipFinishes, setShipLight, shipMaterial } from './shipMaterial.ts';

/**
 * What every fictional ship shares, whatever its model: its sections drawn with the ship shader
 * (shipMaterial.ts), the star's shadow on itself, the switch to a silhouette when small on
 * screen, its running lights, and the compact vertex layout the shader reads.
 *
 * A ship is up to three sections -- parts that move against each other, as the Hail Mary's
 * crew section does in centrifuge mode -- each one mesh, one draw, all on one program. They
 * hang from `spin`, which the ship places (in metres), inside a group scaled to length one.
 */

// --- The vertex layout -------------------------------------------------------------------------

/**
 * A geometry in the ship shader's layout: positions, normals as sixteen-bit integers (four
 * components, the fourth unused, a format the GPU reads as it is), and four bytes of detail --
 * the sky's visibility, the finish's index in the ship's table, the section id.
 */
export function packedShipGeometry(
  positions: Float32Array,
  normals: Int16Array,
  detail: Uint8Array,
  indices: Uint16Array | Uint32Array,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 4, true));
  geometry.setAttribute('detail', new THREE.BufferAttribute(detail, 4, true));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Builds a section from three's own shapes, each placed by a matrix with its finish and its
 * occlusion -- for ships made in code. Every face is shaded flat, with its own normal: for
 * ships built of flat panels, as the Blip-A is.
 */
export class ShipBuilder {
  #positions: number[] = [];
  #normals: number[] = [];
  #detail: number[] = [];
  #indices: number[] = [];
  readonly #normalMatrix = new THREE.Matrix3();
  readonly #v = new THREE.Vector3();

  constructor(readonly section: number) {}

  /** Adds `geometry` placed by `matrix`, painted with finish `finish`, seeing `occlusion` of the sky. Disposes it. */
  add(geometry: THREE.BufferGeometry, matrix: THREE.Matrix4, finish: number, occlusion = 1): void {
    const flat = geometry.index === null ? geometry : geometry.toNonIndexed();
    flat.computeVertexNormals();
    const position = flat.getAttribute('position');
    const normal = flat.getAttribute('normal');
    this.#normalMatrix.getNormalMatrix(matrix);
    const base = this.#positions.length / 3;
    const sky = Math.round(Math.min(Math.max(occlusion, 0), 1) * 255);
    for (let i = 0; i < position.count; i += 1) {
      this.#v.fromBufferAttribute(position, i).applyMatrix4(matrix);
      this.#positions.push(this.#v.x, this.#v.y, this.#v.z);
      this.#v.fromBufferAttribute(normal, i).applyMatrix3(this.#normalMatrix).normalize();
      this.#normals.push(Math.round(this.#v.x * 32767), Math.round(this.#v.y * 32767), Math.round(this.#v.z * 32767), 0);
      this.#detail.push(sky, finish, this.section, 0);
      this.#indices.push(base + i);
    }
    if (flat !== geometry) flat.dispose();
    geometry.dispose();
  }

  get triangles(): number {
    return this.#indices.length / 3;
  }

  build(): THREE.BufferGeometry {
    const count = this.#positions.length / 3;
    return packedShipGeometry(
      new Float32Array(this.#positions),
      new Int16Array(this.#normals),
      new Uint8Array(this.#detail),
      count > 65535 ? new Uint32Array(this.#indices) : new Uint16Array(this.#indices),
    );
  }
}

// --- The star's shadow -------------------------------------------------------------------------

/** Shadow map size: 1,024 over the ship's bounding sphere, a texel every 4 cm for the Hail Mary in cruise. */
export const SHADOW_MAP_SIZE = 1024;

/** Above this share of the view's half-height -- about 200 pixels -- the star casts shadows. */
export const SHADOWS_ABOVE = 0.37;

/** Below this share of the view's half-height -- about 50 pixels on a 1080-line screen -- the silhouette is drawn. */
export const LOW_DETAIL_BELOW = 0.1;

/**
 * The shadow map holds depth from the star packed into eight-bit RGBA (three's packing chunk):
 * thirty-two bits across the ship's depth. Stored as a half float it had a step of 6 cm at
 * 50 m, as coarse as the bias, and the hull shadowed itself in patches.
 */
const DEPTH_VERTEX = /* glsl */ `
  varying float vDepth;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vDepth = -viewPosition.z;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const DEPTH_FRAGMENT = /* glsl */ `
  #include <packing>
  uniform vec2 uRange;
  varying float vDepth;
  void main() {
    gl_FragColor = packDepthToRGBA(clamp((vDepth - uRange.x) / (uRange.y - uRange.x), 0.0, 0.9999));
  }
`;

// --- Running lights ----------------------------------------------------------------------------

const GLOW_VERTEX = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  attribute vec3 color;
  uniform float uPixelsPerUnit;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    // A glow half a metre across, never less than three pixels: a light at a distance is a point.
    float radius = length((modelViewMatrix * vec4(0.5, 0.0, 0.0, 0.0)).xyz);
    gl_PointSize = clamp(2.0 * radius * uPixelsPerUnit / max(-viewPosition.z, 1e-6), 3.0, 48.0);
    gl_Position = projectionMatrix * viewPosition;
    #include <logdepthbuf_vertex>
  }
`;

const GLOW_FRAGMENT = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  varying vec3 vColor;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float glow = exp(-d * d * 7.0) * 1.2 + exp(-d * d * 60.0) * 3.0;
    gl_FragColor = vec4(vColor * glow, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** A running light: where it is in its section's frame (metres), its colour. */
export interface RigLight {
  readonly position: THREE.Vector3;
  readonly color: readonly [number, number, number];
  readonly section: number;
}

// --- The rig -----------------------------------------------------------------------------------

export interface ShipRigOptions {
  /** The object's name, and its sections' meshes' names, one to three. */
  readonly name: string;
  readonly sectionNames: readonly string[];
  /** The running lights' points' name; none drawn when there are no lights. */
  readonly lightsName: string;
  readonly lights: readonly RigLight[];
  /** Metres to one length unit: the object is this ship's length long. */
  readonly lengthM: number;
  readonly finishes: readonly ShipFinish[];
}

export interface ShipRig {
  readonly object: THREE.Group;
  /** The sections' parent, in metres, which the ship places and turns. */
  readonly spin: THREE.Group;
  readonly sections: readonly THREE.Mesh[];
  readonly material: THREE.ShaderMaterial;
  /** Whether the silhouette is drawn now. */
  readonly low: boolean;
  /** The ship's geometries are in: shadows may be drawn. */
  setReady(): void;
  /** Called when the silhouette is switched in or out: the ship picks its geometries. */
  onDetail: (low: boolean) => void;
  /** After a section or the spin moved, or a geometry changed: lights placed again, the shadow redrawn. */
  moved(): void;
  /** Each frame it is drawn; `span` is the ship's widest extent now, in lengths. */
  update(
    lightDirection: THREE.Vector3,
    camera: THREE.Camera,
    planetshine: Planetshine | undefined,
    lighting: { readonly sun: number; readonly ambient: number } | undefined,
    span: number,
  ): void;
  /** Frees the material, lights and shadow map; the geometries are the ship's to free. */
  dispose(): void;
}

export function createShipRig(options: ShipRigOptions): ShipRig {
  const material = shipMaterial();
  setShipFinishes(material, options.finishes);
  const empty = new THREE.BufferGeometry();
  const sections = options.sectionNames.map((name) => {
    const mesh = new THREE.Mesh(empty, material);
    mesh.name = name;
    mesh.frustumCulled = false;
    return mesh;
  });

  // The running lights' glow: one draw of sprites, placed with the sections.
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(options.lights.length * 3), 3));
  glowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(options.lights.flatMap((light) => light.color.map((c) => c * 0.6)), 3));
  const glowMaterial = new THREE.ShaderMaterial({
    vertexShader: GLOW_VERTEX,
    fragmentShader: GLOW_FRAGMENT,
    uniforms: { uPixelsPerUnit: { value: 500 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const glows = new THREE.Points(glowGeometry, glowMaterial);
  glows.name = options.lightsName;
  glows.frustumCulled = false;
  const drawingSize = new THREE.Vector2();
  glows.onBeforeRender = (renderer, _scene, camera) => {
    renderer.getDrawingBufferSize(drawingSize);
    glowMaterial.uniforms['uPixelsPerUnit']!.value = (drawingSize.y / 2) * camera.projectionMatrix.elements[5]!;
  };

  const spin = new THREE.Group();
  spin.add(...sections);
  if (options.lights.length > 0) spin.add(glows);
  const model = new THREE.Group();
  model.scale.setScalar(1 / options.lengthM);
  model.add(spin);
  const object = new THREE.Group();
  object.name = options.name;
  object.add(model);

  // The star's shadow: the sections again, sharing their geometry, drawn for depth from the
  // star into a small map, in the model's own frame (metres).
  const shadowTarget = new THREE.WebGLRenderTarget(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
  });
  const depthMaterial = new THREE.ShaderMaterial({
    vertexShader: DEPTH_VERTEX,
    fragmentShader: DEPTH_FRAGMENT,
    uniforms: { uRange: { value: new THREE.Vector2(0, 1) } },
    side: THREE.DoubleSide,
  });
  const shadowScene = new THREE.Scene();
  const proxies = sections.map((mesh) => {
    const proxy = new THREE.Mesh(mesh.geometry, depthMaterial);
    proxy.matrixAutoUpdate = false;
    proxy.frustumCulled = false;
    shadowScene.add(proxy);
    return proxy;
  });
  const shadowCamera = new THREE.OrthographicCamera();
  const lightInModel = new THREE.Vector3(1, 0, 0);
  const lastLight = new THREE.Vector3();
  const sectionMatrix = sections.map(() => new THREE.Matrix4());
  const scratchQuaternion = new THREE.Quaternion();
  const scratchPosition = new THREE.Vector3();
  const scratchScale = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const sphereCentre = new THREE.Vector3();
  const clear = new THREE.Color();
  const previousClear = new THREE.Color();
  let shadowWanted = false;
  let shadowDirty = true;
  let shadowFrame = -1;
  let ready = false;
  let low = false;

  const drawShadow = (renderer: THREE.WebGLRenderer): void => {
    if (!shadowWanted || !ready) return;
    // Once a frame at most, and only when something moved.
    if (!shadowDirty || renderer.info.render.frame === shadowFrame) return;
    spin.updateMatrix();
    sections.forEach((mesh, s) => {
      mesh.updateMatrix();
      sectionMatrix[s]!.multiplyMatrices(spin.matrix, mesh.matrix);
      proxies[s]!.geometry = mesh.geometry;
      proxies[s]!.visible = mesh.visible;
      proxies[s]!.matrix.copy(sectionMatrix[s]!);
    });
    // The bounds: every section's bounding sphere, wherever the ship has put it.
    const spheres = sections
      .map((mesh, s) => ({ sphere: mesh.geometry.boundingSphere, s }))
      .filter((entry): entry is { sphere: THREE.Sphere; s: number } => entry.sphere !== null && entry.sphere.radius > 0);
    if (spheres.length === 0) return;
    centre.set(0, 0, 0);
    for (const { sphere, s } of spheres) centre.add(sphereCentre.copy(sphere.center).applyMatrix4(sectionMatrix[s]!));
    centre.divideScalar(spheres.length);
    let radius = 0;
    for (const { sphere, s } of spheres) {
      radius = Math.max(radius, sphereCentre.copy(sphere.center).applyMatrix4(sectionMatrix[s]!).distanceTo(centre) + sphere.radius);
    }
    radius += 1;
    shadowCamera.left = -radius;
    shadowCamera.right = radius;
    shadowCamera.top = radius;
    shadowCamera.bottom = -radius;
    shadowCamera.near = 0.1;
    shadowCamera.far = 2 * radius + 10;
    shadowCamera.position.copy(centre).addScaledVector(lightInModel, radius + 5);
    shadowCamera.up.set(Math.abs(lightInModel.y) < 0.9 ? 0 : 1, Math.abs(lightInModel.y) < 0.9 ? 1 : 0, 0);
    shadowCamera.lookAt(centre);
    shadowCamera.updateMatrixWorld();
    shadowCamera.updateProjectionMatrix();

    const previousTarget = renderer.getRenderTarget();
    const autoClear = renderer.autoClear;
    renderer.getClearColor(previousClear);
    const previousAlpha = renderer.getClearAlpha();
    renderer.autoClear = false;
    renderer.setRenderTarget(shadowTarget);
    // Empty texels are as far as the map holds: lit.
    (depthMaterial.uniforms['uRange']!.value as THREE.Vector2).set(shadowCamera.near, shadowCamera.far);
    (material.uniforms['uShadowRange']!.value as THREE.Vector2).set(shadowCamera.near, shadowCamera.far);
    renderer.setClearColor(clear.setRGB(1, 1, 1, THREE.LinearSRGBColorSpace), 1);
    renderer.clear(true, true, false);
    renderer.render(shadowScene, shadowCamera);
    renderer.setRenderTarget(previousTarget);
    renderer.setClearColor(previousClear, previousAlpha);
    renderer.autoClear = autoClear;

    const views = material.uniforms['uShadowView']!.value as THREE.Matrix4[];
    sections.forEach((_, s) => views[s]!.multiplyMatrices(shadowCamera.matrixWorldInverse, sectionMatrix[s]!));
    (material.uniforms['uShadowProjection']!.value as THREE.Matrix4).copy(shadowCamera.projectionMatrix);
    material.uniforms['uShadowMap']!.value = shadowTarget.texture;
    material.uniforms['uShadowTexel']!.value = 1 / SHADOW_MAP_SIZE;
    material.uniforms['uShadowOn']!.value = 1;
    material.uniformsNeedUpdate = true;
    shadowDirty = false;
    shadowFrame = renderer.info.render.frame;
  };
  // Whichever section is drawn first draws the shadow, before any of them reads it.
  for (const mesh of sections) mesh.onBeforeRender = (renderer) => drawShadow(renderer);

  const glowPositions = glowGeometry.getAttribute('position') as THREE.BufferAttribute;
  const placeGlows = (): void => {
    options.lights.forEach((light, i) => {
      const section = sections[light.section]!;
      section.updateMatrix();
      scratchPosition.copy(light.position).applyMatrix4(section.matrix);
      glowPositions.setXYZ(i, scratchPosition.x, scratchPosition.y, scratchPosition.z);
    });
    glowPositions.needsUpdate = true;
  };

  const objectPosition = new THREE.Vector3();
  const cameraPosition = new THREE.Vector3();
  const rig: ShipRig = {
    object,
    spin,
    sections,
    material,
    get low() {
      return low;
    },
    setReady() {
      ready = true;
      shadowDirty = true;
    },
    onDetail: () => {},
    moved() {
      placeGlows();
      shadowDirty = true;
    },
    update(lightDirection, camera, planetshine, lighting, span) {
      setShipLight(material, lightDirection, camera, planetshine, lighting);
      // Detail from how much of the view the ship spans: its widest extent over its distance
      // against the view's half-height.
      object.getWorldPosition(objectPosition);
      camera.getWorldPosition(cameraPosition);
      const extent = object.matrixWorld.getMaxScaleOnAxis() * span;
      const distance = Math.max(objectPosition.distanceTo(cameraPosition), 1e-9);
      const halfView = camera instanceof THREE.PerspectiveCamera ? Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) : 1;
      const share = extent / distance / halfView;
      const nowLow = share < LOW_DETAIL_BELOW;
      if (nowLow !== low) {
        low = nowLow;
        // The lights stay: at a few pixels the running lights are what is seen of the ship.
        rig.onDetail(low);
        shadowDirty = true;
      }
      // The shadow: wanted only while large; redrawn when the star moves against the ship.
      shadowWanted = share > SHADOWS_ABOVE;
      if (!shadowWanted) {
        material.uniforms['uShadowOn']!.value = 0;
        return;
      }
      model.updateWorldMatrix(true, false);
      model.matrixWorld.decompose(scratchPosition, scratchQuaternion, scratchScale);
      lightInModel.copy(lightDirection).applyQuaternion(scratchQuaternion.invert()).normalize();
      if (lightInModel.distanceToSquared(lastLight) > 1e-8) {
        lastLight.copy(lightInModel);
        shadowDirty = true;
      }
    },
    dispose() {
      empty.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      depthMaterial.dispose();
      shadowTarget.dispose();
    },
  };
  placeGlows();
  return rig;
}
