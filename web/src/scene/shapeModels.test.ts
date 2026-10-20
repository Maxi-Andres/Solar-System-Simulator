import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import { decode } from 'jpeg-js';
import { CATALOG, getBody } from '@sss/tools/catalog';
import type { BodyDefinition } from '@sss/tools/types';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { describe, expect, it } from 'vitest';

import { J2000_JD } from '../core/time.ts';
import { MODEL_REQUEST_PX, shapeShownPx } from './craftModels.ts';
import {
  bodyFixedOrientation,
  directionToGeographic,
  longitudeDirection,
  poleDirection,
} from './orientation.ts';
import { kmToUnits } from './scale.ts';
import { buildShape, shapeSurfaceColor } from './shapeModels.ts';

/**
 * The asteroids' shape models: that each file is the one the catalog says, credited,
 * and -- the test that matters -- turned the right way.
 *
 * A shape model turned wrong looks exactly as convincing as one turned right: it is the
 * same lumpy rock either way. So, as textureAlignment.test.ts does for the maps, this goes
 * through the renderer's own transform -- the file decoded by the app's loader, the mesh
 * `buildShape` makes of it, `bodyFixedOrientation` at an instant -- and asks where a named
 * feature comes out in the sky's frame. The feature is found by the shape alone: the
 * highest point of a boulder that stands out of the ground around it, looked for around
 * where the Gazetteer puts it. Turned wrong, there is no such boulder there.
 *
 * Two halves are held separately, because either can be wrong on its own. The rotation:
 * the catalog's against NAIF's own SPICE toolkit evaluating the mission's PCK. The model:
 * its features against the IAU Gazetteer, whose coordinates the mission teams measured
 * in that same frame.
 */

const SHAPE_DIR = join(import.meta.dirname, '../../public/shapes');

const shaped = CATALOG.filter((body) => body.shapeModel !== undefined);
const files = (await readdir(SHAPE_DIR)).filter((name) => !name.endsWith('.md'));
const credits = await readFile(join(SHAPE_DIR, 'CREDITS.md'), 'utf8');

/** A file decoded by the loader the app uses, meshopt and all. */
async function loadScene(file: string): Promise<THREE.Object3D> {
  const bytes = await readFile(join(SHAPE_DIR, file));
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  return (await loader.parseAsync(buffer, '')).scene;
}

const built = new Map<string, ReturnType<typeof buildShape>>();
/** The shape as the scene builds it, once per body. */
async function shapeOf(body: BodyDefinition): Promise<ReturnType<typeof buildShape>> {
  let shape = built.get(body.id);
  if (shape === undefined) {
    shape = buildShape(body, await loadScene(body.shapeModel!.file), null);
    built.set(body.id, shape);
  }
  return shape;
}

/**
 * Every vertex as the renderer places it, relative to the body's centre, in kilometres:
 * through the mesh's own transform, the holder's scale and the orientation at `jdTdb`.
 * At `jdTdb` null, unturned: the file's body-fixed frame.
 */
async function placedVertices(body: BodyDefinition, jdTdb: number | null): Promise<THREE.Vector3[]> {
  const { object, mesh } = await shapeOf(body);
  if (jdTdb === null) {
    object.quaternion.identity();
  } else {
    bodyFixedOrientation(jdTdb, body, object.quaternion);
  }
  object.updateMatrixWorld(true);
  const positions = mesh.geometry.getAttribute('position');
  const toKm = 1 / kmToUnits(1);
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < positions.count; i += 1) {
    out.push(
      new THREE.Vector3()
        .fromBufferAttribute(positions, i)
        .applyMatrix4(mesh.matrixWorld)
        .multiplyScalar(toKm),
    );
  }
  return out;
}

const DEG = Math.PI / 180;

/** Sample instant: 2026-10-20 00:00 TDB. Any works; the claim is about the body. */
const JD = 2461333.5;

/** The scene-frame direction of a planetocentric latitude and east longitude on `body`. */
function sceneDirection(body: BodyDefinition, latitudeDeg: number, longitudeDeg: number): THREE.Vector3 {
  const equator = longitudeDirection(JD, body, longitudeDeg);
  const pole = poleDirection(JD, body);
  const lat = latitudeDeg * DEG;
  return new THREE.Vector3(
    Math.cos(lat) * equator.x + Math.sin(lat) * pole.x,
    Math.cos(lat) * equator.y + Math.sin(lat) * pole.y,
    Math.cos(lat) * equator.z + Math.sin(lat) * pole.z,
  );
}

interface Peak {
  /** Where the highest vertex in the window comes out, through the renderer. */
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  /** Its angle from the window's centre, degrees. */
  readonly offsetDeg: number;
  /** How far it stands above the median of the ring around the window, metres. */
  readonly prominenceM: number;
}

/** The highest point within `windowDeg` of a place, as the scene draws the body. */
function highestNear(
  body: BodyDefinition,
  vertices: readonly THREE.Vector3[],
  latitudeDeg: number,
  longitudeDeg: number,
  windowDeg: number,
): Peak {
  const centre = sceneDirection(body, latitudeDeg, longitudeDeg);
  const cosWindow = Math.cos(windowDeg * DEG);
  const cosRing = Math.cos(2 * windowDeg * DEG);
  let best: THREE.Vector3 | null = null;
  const ring: number[] = [];
  for (const vertex of vertices) {
    const radius = vertex.length();
    const cos = vertex.dot(centre) / radius;
    if (cos >= cosWindow) {
      if (best === null || radius > best.length()) {
        best = vertex;
      }
    } else if (cos >= cosRing) {
      ring.push(radius);
    }
  }
  ring.sort((a, b) => a - b);
  const top = best!;
  const where = directionToGeographic(top, JD, body);
  return {
    latitudeDeg: where.latitudeDeg,
    longitudeDeg: where.longitudeDeg,
    offsetDeg: Math.acos(Math.min(1, top.dot(centre) / top.length())) / DEG,
    prominenceM: (top.length() - ring[ring.length >> 1]!) * 1000,
  };
}

describe('the shape files', () => {
  const used = new Set(
    shaped.flatMap((body) => [body.shapeModel!.file, body.shapeModel!.map?.file ?? []].flat()),
  );

  it('give every shaped body files that exist, and ship none unused', () => {
    for (const file of used) {
      expect(files, file).toContain(file);
    }
    for (const file of files) {
      expect(used, file).toContain(file);
    }
  });

  it('records every file in CREDITS.md, with a source and a licence', () => {
    for (const file of files) {
      const row = credits.split('\n').find((line) => line.startsWith(`| \`${file}\``));
      expect(row, `${file} is not credited`).toBeDefined();
      // A markdown table row: file, body, product and source link, licence.
      expect(row!.split('|').filter((cell) => cell.trim() !== '').length, file).toBe(4);
      expect(row, file).toMatch(/https?:\/\//);
    }
  });

  it('keeps the set small enough to ship', async () => {
    const sizes = await Promise.all(files.map(async (file) => (await stat(join(SHAPE_DIR, file))).size));
    // 6.5 MB today, Donaldjohanson's 548,000 facets the most of it. Nothing is fetched
    // until its body is on screen; the guard is on the repository.
    expect(sizes.reduce((sum, size) => sum + size, 0) / 1024 / 1024).toBeLessThan(8);
  });

  it('are drawn only for bodies a rotation turns, in place of a marker', () => {
    for (const body of shaped) {
      expect(body.rotation, body.id).not.toBeNull();
      expect(body.shapeDrawn, body.id).not.toBe(false);
      // The map is the shape's: a `textures` map would be put on the sphere.
      expect(body.textures, body.id).toBeNull();
    }
  });

  it('are the visited bodies whose teams released one', () => {
    expect(shaped.map((body) => body.id).sort()).toEqual(
      ['arrokoth', 'bennu', 'didymos', 'donaldjohanson', 'ryugu'].sort(),
    );
  });

  it.each(shaped.map((body) => [body.id, body] as const))(
    "%s: holds the catalog's facets, at the catalog's size, with outward normals",
    async (_id, body: BodyDefinition) => {
      const shape = body.shapeModel!;
      const { mesh } = await shapeOf(body);
      expect(mesh.geometry.getIndex()!.count / 3).toBe(shape.facets);

      const vertices = await placedVertices(body, null);
      const size = new THREE.Box3().setFromPoints(vertices).getSize(new THREE.Vector3());
      // The catalog's radii are the published extents; the file is the same body.
      const radii = body.triaxialRadiiKm ?? [
        body.radiusEquatorialKm,
        body.radiusEquatorialKm,
        body.radiusPolarKm,
      ];
      const extents = [size.x, size.y, size.z];
      for (let axis = 0; axis < 3; axis += 1) {
        const ratio = extents[axis]! / (2 * radii[axis]!);
        expect(ratio, `${body.id} axis ${axis}`).toBeGreaterThan(0.95);
        expect(ratio, `${body.id} axis ${axis}`).toBeLessThan(1.15);
      }

      // The facets wind counter-clockwise seen from outside -- the enclosed volume comes
      // out positive -- and the normals agree with them, or the lit side would be the
      // dark one. Not "the normal points away from the centre": Arrokoth's neck faces in.
      const index = mesh.geometry.getIndex()!;
      const normals = mesh.geometry.getAttribute('normal');
      const normal = new THREE.Vector3();
      const facet = new THREE.Vector3();
      const edge = new THREE.Vector3();
      let volume = 0;
      let agreeing = 0;
      for (let f = 0; f < index.count; f += 3) {
        const [a, b, c] = [index.getX(f), index.getX(f + 1), index.getX(f + 2)];
        const [p, q, r] = [vertices[a]!, vertices[b]!, vertices[c]!];
        volume += p.dot(new THREE.Vector3().crossVectors(q, r)) / 6;
        facet.subVectors(q, p).cross(edge.subVectors(r, p));
        agreeing += normal.fromBufferAttribute(normals, a).dot(facet) > 0 ? 1 : 0;
      }
      expect(volume, body.id).toBeGreaterThan(0);
      expect(agreeing / (index.count / 3), body.id).toBeGreaterThan(0.99);
    },
  );

  it.each(shaped.filter((body) => body.shapeModel!.map !== null).map((body) => [body.id, body] as const))(
    "%s: puts each vertex on its own longitude and latitude of the map",
    async (_id, body: BodyDefinition) => {
      const map = body.shapeModel!.map!;
      const { mesh } = await shapeOf(body);
      const vertices = await placedVertices(body, null);
      const uv = mesh.geometry.getAttribute('uv');
      expect(uv, body.id).toBeDefined();
      let worst = 0;
      for (let i = 0; i < uv.count; i += 1) {
        const v = vertices[i]!;
        const lon = Math.atan2(v.y, v.x) / DEG;
        const lat = Math.atan2(v.z, Math.hypot(v.x, v.y)) / DEG;
        // Away from the poles, where longitude means nothing.
        if (Math.abs(lat) > 85) {
          continue;
        }
        const mapLon = uv.getX(i) * 360 + map.longitudeOriginDeg;
        const dLon = ((((mapLon - lon) % 360) + 540) % 360) - 180;
        // three.js reads an image with v = 1 at its top row: the north.
        const dLat = uv.getY(i) * 180 - 90 - lat;
        worst = Math.max(worst, Math.abs(dLon), Math.abs(dLat));
      }
      // 16-bit texture coordinates: a hundredth of a degree.
      expect(worst, body.id).toBeLessThan(0.02);
    },
  );

  it.each(shaped.filter((body) => body.shapeModel!.map !== null).map((body) => [body.id, body] as const))(
    "%s: knows its map's mean, measured from the pixels",
    async (_id, body: BodyDefinition) => {
      const map = body.shapeModel!.map!;
      const image = decode(await readFile(join(SHAPE_DIR, map.file)), { useTArray: true });
      let sum = 0;
      for (let i = 0; i < image.data.length; i += 4) {
        const value = image.data[i]! / 255;
        sum += value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      }
      // A global map, equirectangular: twice as wide as tall.
      expect(image.width, body.id).toBe(2 * image.height);
      expect(sum / (image.width * image.height), body.id).toBeCloseTo(map.meanLinear, 3);
    },
  );
});

/**
 * The rotation, against NAIF's own toolkit. Body-fixed +x and +z in ECLIPJ2000, from
 * SPICE's TIPBOD (CSPICE N0067, via spiceypy 8.0) with each mission's PCK loaded --
 * bennu_v17, ryugu_v10, didymos_system_15, nh_arrokoth_002, donaldjohanson_v12 -- at the
 * New Horizons flyby, 2019-01-01 05:31 TDB, and at 2026-10-20 00:00 TDB.
 *
 * SPICE's ecliptic is IAU 1976's, 0.042 arcseconds from the IAU 2006 one the scene uses:
 * two parts in ten million, inside the tolerance.
 */
const SPICE_AXES = [
  { id: 'bennu', jd: 2458484.73, x: [0.935478129, -0.353383126, -0.00101809], z: [0.039152116, 0.106506112, -0.99354092] },
  { id: 'bennu', jd: 2461333.5, x: [0.999231708, -0.002419664, 0.039116987], z: [0.039152116, 0.106506112, -0.99354092] },
  { id: 'ryugu', jd: 2458484.73, x: [-0.997354453, 0.057220251, 0.044832325], z: [-0.044865118, 0.000712052, -0.9989928] },
  { id: 'ryugu', jd: 2461333.5, x: [0.470054469, -0.882369651, -0.021739238], z: [-0.044865118, 0.000712052, -0.9989928] },
  { id: 'didymos', jd: 2458484.73, x: [0.324072204, 0.942218796, -0.084858398], z: [0.104839674, -0.124915785, -0.986612735] },
  { id: 'didymos', jd: 2461333.5, x: [0.139462685, -0.980429674, 0.13895256], z: [0.104839674, -0.124915785, -0.986612735] },
  { id: 'arrokoth', jd: 2458484.73, x: [-0.655777516, -0.502742843, -0.563209981], z: [0.684485127, -0.710656758, -0.162625593] },
  { id: 'arrokoth', jd: 2461333.5, x: [0.253407815, 0.022767728, 0.967091573], z: [0.684485127, -0.710656758, -0.162625593] },
  { id: 'donaldjohanson', jd: 2458484.73, x: [-0.051659146, 0.996836346, 0.060403905], z: [0.513838637, -0.025332797, 0.857512743] },
  { id: 'donaldjohanson', jd: 2461333.5, x: [-0.814897383, -0.326863698, 0.478646402], z: [0.513838637, -0.025332797, 0.857512743] },
] as const;

describe('bodyFixedOrientation', () => {
  it.each(SPICE_AXES.map((row) => [row.id, row.jd, row] as const))(
    '%s at JD %s: turns the model as SPICE turns the PCK frame',
    (id, jd, row) => {
      const q = bodyFixedOrientation(jd, getBody(id));
      const x = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      // 1e-5 rad is 2 arcseconds: a millimetre on Bennu, 0.2 m on Arrokoth.
      expect(x.distanceTo(new THREE.Vector3(...row.x)), id).toBeLessThan(1e-5);
      expect(z.distanceTo(new THREE.Vector3(...row.z)), id).toBeLessThan(1e-5);
    },
  );

  it('carries Bennu’s YORP term: without it, 2026 is half a turn out', () => {
    const bennu = getBody('bennu');
    const constant = {
      ...bennu,
      rotation: { ...bennu.rotation!, primeMeridianAccelDegPerDay2: 0 },
    };
    const x = new THREE.Vector3(1, 0, 0).applyQuaternion(bodyFixedOrientation(JD, constant));
    const expected = new THREE.Vector3(...SPICE_AXES[1].x);
    expect(x.angleTo(expected) / DEG).toBeGreaterThan(150);
  });

  it('is a pure rotation, and +z is the pole the catalog reports', () => {
    for (const body of shaped) {
      const q = bodyFixedOrientation(JD, body);
      expect(q.length(), body.id).toBeCloseTo(1, 12);
      const z = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const pole = poleDirection(JD, body);
      expect(z.distanceTo(new THREE.Vector3(pole.x, pole.y, pole.z)), body.id).toBeLessThan(1e-12);
    }
  });
});

/**
 * Named boulders, found in the shape by height and placed through the renderer. Each is
 * looked for within `window` of the Gazetteer's centre, and must come out within
 * `within` of it and stand `above` metres over the ground around: the published size of
 * each is what sets the last. The same search half a turn round finds no such boulder,
 * which is what gives the test its teeth.
 *
 * Gazetteer of Planetary Nomenclature (planetarynames.wr.usgs.gov), planetocentric,
 * east-positive, read 2026-10-20. Benben Saxum is Bennu's highest boulder, 22 m tall and
 * 52 m across; Roc Saxum its largest, 96 m. Otohime Saxum is Ryugu's largest, 160 m;
 * Catafo Saxum is the 50 m boulder its prime meridian is anchored to.
 */
const BOULDERS = [
  { id: 'bennu', name: 'Benben Saxum', lat: -45.86, lon: 127.59, window: 10, within: 2, above: 15 },
  { id: 'bennu', name: 'Roc Saxum', lat: -23.46, lon: 25.36, window: 12, within: 3, above: 12 },
  { id: 'ryugu', name: 'Otohime Saxum', lat: -69.8, lon: 274.4, window: 10, within: 1.5, above: 50 },
  { id: 'ryugu', name: 'Catafo Saxum', lat: -5.5, lon: 0, window: 4, within: 1.5, above: 15 },
] as const;

describe('the named boulders land where the Gazetteer puts them', () => {
  it.each(BOULDERS.map((row) => [row.id, row.name, row] as const))(
    '%s: %s',
    async (id, _name, row) => {
      const body = getBody(id);
      const vertices = await placedVertices(body, JD);
      const peak = highestNear(body, vertices, row.lat, row.lon, row.window);
      expect(peak.offsetDeg, `${row.name} at ${peak.latitudeDeg}, ${peak.longitudeDeg}`).toBeLessThan(row.within);
      expect(peak.prominenceM, row.name).toBeGreaterThan(row.above);

      // Half a turn round, as a body turned by the wrong prime meridian would put it.
      const wrong = highestNear(body, vertices, row.lat, row.lon + 180, row.window);
      expect(wrong.offsetDeg < row.within && wrong.prominenceM > row.above, row.name).toBe(false);
    },
  );
});

/**
 * Where no feature is resolved -- Didymos's anchor boulder is a 2.7 m bump at 4.7 m
 * facets, Arrokoth's names carry placeholder coordinates -- the frame is held to what the
 * teams define it by.
 */
describe('the frames the teams define', () => {
  it('turns Didymos about its short axis, its equatorial ridge on the equator', async () => {
    const vertices = await placedVertices(getBody('didymos'), null);
    const band = (low: number, high: number) => {
      const radii = vertices
        .filter((v) => {
          const lat = Math.abs(Math.atan2(v.z, Math.hypot(v.x, v.y)) / DEG);
          return lat >= low && lat < high;
        })
        .map((v) => v.length());
      return radii.reduce((sum, r) => sum + r, 0) / radii.length;
    };
    // A spinning top: the equator stands well out of the poles.
    expect(band(0, 15) / band(60, 90)).toBeGreaterThan(1.2);
  });

  it("puts Arrokoth's larger lobe, Wenu, on the prime meridian", async () => {
    const vertices = await placedVertices(getBody('arrokoth'), null);
    const width = (side: number) =>
      Math.max(...vertices.filter((v) => v.x * side > 0).map((v) => Math.abs(v.y)));
    // Wenu 19.8 km across, Weeyo 14.4 (Porter et al. 2024, Table 2), each at its widest.
    expect(width(1) / width(-1)).toBeGreaterThan(1.1);
  });

  it("puts Donaldjohanson's long axis on the prime meridian", async () => {
    const vertices = await placedVertices(getBody('donaldjohanson'), null);
    const size = new THREE.Box3().setFromPoints(vertices).getSize(new THREE.Vector3());
    expect(size.x).toBeGreaterThan(1.8 * size.y);
    expect(size.y).toBeGreaterThan(size.z);
  });
});

describe('shapeSurfaceColor', () => {
  const luminance = (color: THREE.Color) => 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;

  it("draws a shape without a map at its albedo, in its catalog colour's hue", () => {
    for (const body of shaped.filter((candidate) => candidate.shapeModel!.map === null)) {
      const shape = body.shapeModel!;
      const color = shapeSurfaceColor(body.color, shape);
      expect(luminance(color), body.id).toBeCloseTo(shape.albedo, 9);
      const catalog = new THREE.Color(body.color);
      expect(color.r / color.g, body.id).toBeCloseTo(catalog.r / catalog.g, 9);
    }
  });

  it('scales a map so its mean comes out at the albedo', () => {
    for (const body of shaped.filter((candidate) => candidate.shapeModel!.map !== null)) {
      const shape = body.shapeModel!;
      const color = shapeSurfaceColor(body.color, shape);
      expect(color.g * shape.map!.meanLinear, body.id).toBeCloseTo(shape.albedo, 9);
      expect(color.r, body.id).toBe(color.g);
    }
  });

  it('keeps a dark body dark: Bennu and Ryugu far darker than their markers', () => {
    for (const id of ['bennu', 'ryugu']) {
      const body = getBody(id);
      const shape = body.shapeModel!;
      // The mean drawn reflectance, map and colour together, against the marker's.
      const drawn = shapeSurfaceColor(body.color, shape).g * (shape.map?.meanLinear ?? 1);
      expect(drawn, id).toBeLessThan(luminance(new THREE.Color(body.color)) / 2.5);
    }
  });
});

describe('when a shape is drawn', () => {
  it('is fetched before it may be drawn, and drawn by the triangles-per-pixel rule', () => {
    for (const body of shaped) {
      const shownPx = shapeShownPx(body.shapeModel!.facets);
      expect(shownPx, body.id).toBeLessThanOrEqual(MODEL_REQUEST_PX);
      // Every one of these is heavier than a planet's sphere: none is drawn at a speck.
      expect(shownPx, body.id).toBeGreaterThan(1.5);
    }
  });

  it('is in scene units, from kilometres', async () => {
    for (const body of shaped) {
      const { object } = await shapeOf(body);
      expect(object.scale.x, body.id).toBe(kmToUnits(1));
    }
  });

  it('spins at the PCK rate the catalog carries, about J2000', () => {
    const ryugu = getBody('ryugu');
    const a = new THREE.Vector3(1, 0, 0).applyQuaternion(bodyFixedOrientation(J2000_JD, ryugu));
    // A sidereal period later the prime meridian is back where it was.
    const period = 360 / ryugu.rotation!.rotationRateDegPerDay;
    const b = new THREE.Vector3(1, 0, 0).applyQuaternion(bodyFixedOrientation(J2000_JD + period, ryugu));
    expect(a.distanceTo(b)).toBeLessThan(1e-9);
  });
});
