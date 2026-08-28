import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { decode } from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CATALOG, getBody } from '@sss/tools/catalog';
import type { BodyDefinition } from '@sss/tools/types';
import { J2000_JD } from '../core/time.ts';
import { add, scale, type Vec3 } from '../core/vec3.ts';
import { bodyOrientation, longitudeDirection, poleDirection } from './orientation.ts';

/**
 * Does the map land where the map says it lands?
 *
 * This is the test that was missing, and its absence let a real bug ship: every Solar
 * System Scope body was drawn half a turn out, so Earth showed Africa in daylight at a
 * moment when the Pacific should have been lit.
 *
 * Nothing else could have caught it. The sub-solar tests pass through
 * `directionToGeographic`, which is our own inverse of our own convention -- rotate
 * both halves by 180 degrees and they still agree perfectly with each other and with
 * JPL. The error lived in the one gap neither half crosses: between our idea of
 * longitude zero and the actual first column of pixels in the file. Solar System Scope
 * centres its maps on Greenwich; NASA's Pluto mosaic starts at longitude zero. Two
 * publishers, two conventions, and no way to know but to look.
 *
 * So this test looks. It takes a named feature, computes where the renderer puts it in
 * the scene, walks that back through a real THREE.SphereGeometry -- so the UV
 * convention comes from three.js rather than from a comment -- and reads the pixel.
 * The Sahara has to come out sand-coloured.
 */

const TEXTURE_DIR = join(import.meta.dirname, '../../public/textures');

/** Sample date. Any instant works: the test asks about the body, not about the sky. */
const JD = J2000_JD + 9736.5;

interface Pixel {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

interface Landmark {
  readonly name: string;
  readonly latitudeDeg: number;
  readonly longitudeDeg: number;
  readonly expect: (pixel: Pixel) => boolean;
  readonly describe: string;
}

const luminance = ({ r, g, b }: Pixel) => 0.299 * r + 0.587 * g + 0.114 * b;
const isOcean = (p: Pixel) => p.b > p.r + 30 && p.b > p.g + 20;
const isDesert = (p: Pixel) => p.r > 150 && p.r > p.b + 30;
const isVegetation = (p: Pixel) => p.g > p.r && p.g > p.b && luminance(p) < 110;
const isIce = (p: Pixel) => p.r > 195 && p.g > 195 && p.b > 195;

/**
 * A sphere at high tessellation, used purely as an oracle for three.js's own UV
 * convention. Reading the mapping off the geometry means this test cannot drift from
 * what the renderer actually does, the way a hand-written formula could.
 */
const SPHERE = new THREE.SphereGeometry(1, 360, 180);

/** The UV three.js assigns to the vertex nearest a direction in the body's frame. */
function uvForLocalDirection(local: THREE.Vector3): { u: number; v: number } {
  const positions = SPHERE.attributes.position!;
  const uvs = SPHERE.attributes.uv!;
  const unit = local.clone().normalize();

  let best = 0;
  let bestDot = -Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    const dot =
      positions.getX(i) * unit.x + positions.getY(i) * unit.y + positions.getZ(i) * unit.z;
    if (dot > bestDot) {
      bestDot = dot;
      best = i;
    }
  }
  return { u: uvs.getX(best), v: uvs.getY(best) };
}

/** Direction, in the scene frame, of a point on a body's surface. */
function surfaceDirection(body: BodyDefinition, landmark: Landmark, jd = JD): Vec3 {
  const latitude = (landmark.latitudeDeg * Math.PI) / 180;
  return add(
    scale(longitudeDirection(jd, body, landmark.longitudeDeg), Math.cos(latitude)),
    scale(poleDirection(jd, body), Math.sin(latitude)),
  );
}

/** Just enough of jpeg-js's return shape; its two variants differ only in the array. */
interface DecodedImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Buffer;
}

const images = new Map<string, DecodedImage>();

async function image(file: string): Promise<DecodedImage> {
  const cached = images.get(file);
  if (cached !== undefined) {
    return cached;
  }
  const decoded = decode(await readFile(join(TEXTURE_DIR, file)), {
    useTArray: true,
  }) as DecodedImage;
  images.set(file, decoded);
  return decoded;
}

/**
 * What the renderer shows at a point on a body's surface.
 *
 * The full round trip: surface point to scene direction, scene direction back into the
 * body's local frame through the orientation quaternion, local frame to UV through the
 * sphere geometry, UV to pixel. Every step is one the GPU also takes.
 */
async function texelAt(body: BodyDefinition, landmark: Landmark, jd = JD): Promise<Pixel> {
  const world = surfaceDirection(body, landmark, jd);
  const local = new THREE.Vector3(world.x, world.y, world.z).applyQuaternion(
    bodyOrientation(jd, body).clone().invert(),
  );

  const { u, v } = uvForLocalDirection(local);
  const { width, height, data } = await image(body.texture!);
  // Textures load with flipY, so v = 1 is the top row of the file.
  const x = Math.min(width - 1, Math.max(0, Math.round(u * width)));
  const y = Math.min(height - 1, Math.max(0, Math.round((1 - v) * height)));
  const offset = (y * width + x) * 4;

  return { r: data[offset]!, g: data[offset + 1]!, b: data[offset + 2]! };
}

const EARTH: readonly Landmark[] = [
  {
    name: 'the Sahara',
    latitudeDeg: 22,
    longitudeDeg: 12,
    expect: isDesert,
    describe: 'sand, not sea',
  },
  {
    name: 'the Amazon',
    latitudeDeg: -5,
    longitudeDeg: -62,
    expect: isVegetation,
    describe: 'dark green',
  },
  {
    name: 'Greenland',
    latitudeDeg: 72,
    longitudeDeg: -40,
    expect: isIce,
    describe: 'ice white',
  },
  {
    name: 'the central Pacific',
    latitudeDeg: 0,
    longitudeDeg: -150,
    expect: isOcean,
    describe: 'open ocean',
  },
  {
    name: 'the Indian Ocean',
    latitudeDeg: -25,
    longitudeDeg: 80,
    expect: isOcean,
    describe: 'open ocean',
  },
  {
    name: 'Sumatra',
    latitudeDeg: 0,
    longitudeDeg: 101,
    // Deliberately paired with the Pacific at the opposite longitude: if east and
    // west were mirrored these two would swap, and both assertions would fail.
    expect: (pixel) => !isOcean(pixel),
    describe: 'land, not the Pacific it would be if east ran the other way',
  },
];

describe('Earth is drawn the way the map is drawn', () => {
  it.each(EARTH)('finds $name where it belongs ($describe)', async (landmark) => {
    const pixel = await texelAt(getBody('earth'), landmark);

    expect(pixel, `${landmark.name}: got rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`).toSatisfy(
      landmark.expect,
    );
  });

  it('would fail if the image origin were half a turn out, which is the whole point', async () => {
    // The bug that motivated this file, reproduced deliberately. If this ever starts
    // passing, the test above has stopped being able to tell the difference.
    const wrong: BodyDefinition = {
      ...getBody('earth'),
      textureLongitudeOriginDeg: getBody('earth').textureLongitudeOriginDeg + 180,
    };
    const sahara = EARTH[0]!;

    expect(isDesert(await texelAt(wrong, sahara))).toBe(false);
    expect(isDesert(await texelAt(getBody('earth'), sahara))).toBe(true);
  });

  it('keeps a feature under the same longitude as the body turns', async () => {
    // The Sahara must stay the Sahara at every hour: the orientation rotates the body
    // in the scene, it does not slide the map across the surface.
    const sahara = EARTH[0]!;

    for (const hours of [0, 6, 13, 19]) {
      const pixel = await texelAt(getBody('earth'), sahara, JD + hours / 24);

      expect(isDesert(pixel), `${hours}h`).toBe(true);
    }
  });
});

describe('the other mapped bodies', () => {
  it('puts Syrtis Major dark and Hellas bright on Mars', async () => {
    const mars = getBody('mars');
    const syrtis = await texelAt(mars, {
      name: 'Syrtis Major',
      latitudeDeg: 8,
      longitudeDeg: 70,
      expect: () => true,
      describe: '',
    });
    const hellas = await texelAt(mars, {
      name: 'Hellas',
      latitudeDeg: -42,
      longitudeDeg: 70,
      expect: () => true,
      describe: '',
    });

    // Syrtis Major is the dark albedo feature every telescope shows; Hellas is the
    // bright basin below it. Same longitude, so this pins latitude as well.
    expect(luminance(syrtis)).toBeLessThan(90);
    expect(luminance(hellas)).toBeGreaterThan(luminance(syrtis) + 30);
  });

  it('puts Sputnik Planitia bright and Cthulhu Macula dark on Pluto', async () => {
    // Pluto's map comes from NASA and starts at longitude 0, not 180 like the Solar
    // System Scope set. Its heart is the check that the difference is honoured.
    const pluto = getBody('pluto');
    const sputnik = await texelAt(pluto, {
      name: 'Sputnik Planitia',
      latitudeDeg: 20,
      longitudeDeg: 175,
      expect: () => true,
      describe: '',
    });
    const cthulhu = await texelAt(pluto, {
      name: 'Cthulhu Macula',
      latitudeDeg: 0,
      longitudeDeg: 100,
      expect: () => true,
      describe: '',
    });

    expect(luminance(sputnik)).toBeGreaterThan(luminance(cthulhu) + 25);
  });
});

describe('the catalog says where every image starts', () => {
  it('gives each body a longitude origin that is actually on the circle', () => {
    for (const body of CATALOG) {
      expect(body.textureLongitudeOriginDeg, body.id).toBeGreaterThanOrEqual(0);
      expect(body.textureLongitudeOriginDeg, body.id).toBeLessThan(360);
    }
  });

  it('splits the two publishers the way their files are drawn', () => {
    // Nine from Solar System Scope, centred on the prime meridian. One from NASA,
    // starting at it. Pinned so a new body cannot quietly inherit the wrong one.
    const byOrigin = new Map<number, string[]>();
    for (const body of CATALOG) {
      const list = byOrigin.get(body.textureLongitudeOriginDeg) ?? [];
      list.push(body.id);
      byOrigin.set(body.textureLongitudeOriginDeg, list);
    }

    expect(byOrigin.get(0)).toEqual(['pluto']);
    expect(byOrigin.get(180)).toHaveLength(9);
  });

  it('places the north pole at the top of every file', () => {
    // uv.y = 1 at local +y, which the orientation maps to the IAU north pole, and
    // flipY puts uv.y = 1 on the first row of the image. Equirectangular maps are
    // drawn north-up, so this has to hold for all of them.
    const { v } = uvForLocalDirection(new THREE.Vector3(0, 1, 0));

    expect(v).toBe(1);
  });
});
