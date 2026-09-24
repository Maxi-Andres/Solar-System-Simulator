import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { decode } from 'jpeg-js';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { CATALOG, getBody, TEXTURE_SETS } from '@sss/tools/catalog';
import type { BodyDefinition, TextureSetId, TextureVariant } from '@sss/tools/types';
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
async function texelAt(
  body: BodyDefinition,
  landmark: Landmark,
  variant: TextureVariant,
  jd = JD,
): Promise<Pixel> {
  const world = surfaceDirection(body, landmark, jd);
  const local = new THREE.Vector3(world.x, world.y, world.z).applyQuaternion(
    bodyOrientation(jd, body, variant.longitudeOriginDeg).clone().invert(),
  );

  const { u, v } = uvForLocalDirection(local);
  const { width, height, data } = await image(variant.file);
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

const SET_IDS = TEXTURE_SETS.map((set) => set.id);

/**
 * Every set is checked, not just the one that happens to be the default.
 *
 * A second map set doubles the number of places a longitude origin can be wrong, and
 * two of the three new files come from publishers whose convention we had not handled
 * before. Running the landmark checks per set is what makes adding a map safe.
 */
describe.each(SET_IDS)('Earth is drawn the way the map is drawn (%s)', (setId) => {
  const earth = getBody('earth');
  const variant = earth.textures![setId as TextureSetId];

  it.each(EARTH)('finds $name where it belongs ($describe)', async (landmark) => {
    const pixel = await texelAt(earth, landmark, variant);

    expect(pixel, `${landmark.name}: got rgb(${pixel.r}, ${pixel.g}, ${pixel.b})`).toSatisfy(
      landmark.expect,
    );
  });

  it('would fail if the image origin were half a turn out, which is the whole point', async () => {
    // The bug that motivated this file, reproduced deliberately. If this ever starts
    // passing, the test above has stopped being able to tell the difference.
    const wrong: TextureVariant = {
      file: variant.file,
      longitudeOriginDeg: variant.longitudeOriginDeg + 180,
    };
    const sahara = EARTH[0]!;

    expect(isDesert(await texelAt(earth, sahara, wrong))).toBe(false);
    expect(isDesert(await texelAt(earth, sahara, variant))).toBe(true);
  });

  it('keeps a feature under the same longitude as the body turns', async () => {
    // The Sahara must stay the Sahara at every hour: the orientation rotates the body
    // in the scene, it does not slide the map across the surface.
    const sahara = EARTH[0]!;

    for (const hours of [0, 6, 13, 19]) {
      const pixel = await texelAt(earth, sahara, variant, JD + hours / 24);

      expect(isDesert(pixel), `${hours}h`).toBe(true);
    }
  });
});

/** A landmark with no colour test: used where only relative brightness matters. */
const spot = (name: string, latitudeDeg: number, longitudeDeg: number): Landmark => ({
  name,
  latitudeDeg,
  longitudeDeg,
  expect: () => true,
  describe: '',
});

describe.each(SET_IDS)('the other mapped bodies (%s)', (setId) => {
  const variantOf = (id: string) => getBody(id).textures![setId as TextureSetId];

  it('puts Syrtis Major dark and Hellas bright on Mars', async () => {
    // Two different publishers between the sets -- Solar System Scope and NASA 3D
    // Resources -- so this runs twice and pins both.
    const mars = getBody('mars');
    const syrtis = await texelAt(mars, spot('Syrtis Major', 8, 70), variantOf('mars'));
    const hellas = await texelAt(mars, spot('Hellas', -42, 70), variantOf('mars'));

    // Syrtis Major is the dark albedo feature every telescope shows; Hellas is the
    // bright basin below it. Same longitude, so this pins latitude as well.
    expect(luminance(syrtis)).toBeLessThan(115);
    expect(luminance(hellas)).toBeGreaterThan(luminance(syrtis) + 25);
  });

  it('puts Sputnik Planitia bright and Cthulhu Macula dark on Pluto', async () => {
    // Pluto's map comes from NASA and starts at longitude 0, not 180 like the Solar
    // System Scope set. Its heart is the check that the difference is honoured.
    const pluto = getBody('pluto');
    const sputnik = await texelAt(pluto, spot('Sputnik Planitia', 20, 175), variantOf('pluto'));
    const cthulhu = await texelAt(pluto, spot('Cthulhu Macula', 0, 100), variantOf('pluto'));

    expect(luminance(sputnik)).toBeGreaterThan(luminance(cthulhu) + 25);
  });

  it('keeps the bright limb of the Sun toward its own equator', async () => {
    // Not a landmark test -- the Sun has no fixed features. It checks that the map is
    // not upside down, which the granulation pattern cannot reveal but the poles can:
    // every published solar map is darker at the poles than at the equator.
    const sun = getBody('sun');
    const equator = await texelAt(sun, spot('equator', 0, 40), variantOf('sun'));
    const pole = await texelAt(sun, spot('north pole', 84, 40), variantOf('sun'));

    expect(luminance(equator)).toBeGreaterThan(luminance(pole));
  });
});

/**
 * The moons, through the same round trip as the planets: named feature, IAU rotation,
 * three.js UV, pixel.
 *
 * Every check is a feature against the point on the opposite meridian, at the same
 * latitude, and in the direction the albedo says. That is the shape an origin error
 * takes -- half a turn -- so each of these would fail if the map were drawn the wrong way
 * round, which is the reason they exist. Coordinates are the USGS Gazetteer's, turned
 * east-positive where it gives them west.
 *
 * Only the maps with a feature bright or dark enough to read from the pixels are here.
 * The rest -- greyscale mosaics of cratered ice, where a feature is a shadow rather than
 * an albedo -- were placed from their ISIS labels and checked by eye; CREDITS.md lists
 * the feature used for each.
 */
describe('the moons are drawn the way their maps are drawn', () => {
  const variantOf = (id: string) => getBody(id).textures!.illustrative;

  /** Luminance averaged over a patch two degrees across, which one texel is too noisy for. */
  async function patch(id: string, latitudeDeg: number, longitudeEastDeg: number): Promise<number> {
    const body = getBody(id);
    let sum = 0;
    let count = 0;
    for (const dLat of [-1, 0, 1]) {
      for (const dLon of [-1, 0, 1]) {
        sum += luminance(
          await texelAt(body, spot('patch', latitudeDeg + dLat, longitudeEastDeg + dLon), variantOf(id)),
        );
        count += 1;
      }
    }
    return sum / count;
  }

  /** How much brighter a feature is than the opposite meridian at its latitude. */
  async function contrast(id: string, latitudeDeg: number, longitudeEastDeg: number): Promise<number> {
    return (
      (await patch(id, latitudeDeg, longitudeEastDeg)) -
      (await patch(id, latitudeDeg, longitudeEastDeg + 180))
    );
  }

  it.each([
    // [moon, feature, latitude, longitude east, bright or dark]
    ['moon', 'Mare Crisium', 16.18, 59.1, 'dark'],
    ['moon', 'Tycho', -43.3, -11.22, 'bright'],
    ['io', 'Loki Patera', 13.01, 360 - 308.79, 'dark'],
    ['ganymede', 'Tros', 11.14, 360 - 27.26, 'bright'],
    ['callisto', 'Valhalla', 14.7, 360 - 56, 'bright'],
    ['titan', 'Xanadu', -15, 360 - 100, 'bright'],
    ['titan', 'Belet', -5, 360 - 255, 'dark'],
    ['ariel', 'Laica', -21.3, 44.4, 'bright'],
    ['oberon', 'Hamlet', -46.1, 44.4, 'dark'],
  ] as const)('puts %s’s %s where the Gazetteer does', async (id, _name, lat, lon, kind) => {
    const difference = await contrast(id, lat, lon);

    // Twenty code values either way. The weakest measured is Loki's, 25; flipped, every
    // one of these reverses sign.
    if (kind === 'bright') {
      expect(difference).toBeGreaterThan(20);
    } else {
      expect(difference).toBeLessThan(-20);
    }
  });

  it("puts Iapetus's dark leading face ahead of it, which is the one thing Iapetus is known for", async () => {
    // Cassini Regio covers the hemisphere Iapetus leads with, centred on 90 W. Averaged
    // across the whole equatorial band rather than read at a point, because the
    // dichotomy is a hemisphere, not a feature.
    let leading = 0;
    let trailing = 0;
    for (let lon = -40; lon <= 40; lon += 10) {
      for (const lat of [-20, 0, 20]) {
        leading += await patch('iapetus', lat, 270 + lon);
        trailing += await patch('iapetus', lat, 90 + lon);
      }
    }
    expect(trailing - leading).toBeGreaterThan(9 * 3 * 15);
  });

  it('would fail on a map drawn half a turn out, which is the whole point', async () => {
    const titan = getBody('titan');
    const variant = variantOf('titan');
    const flipped = { ...variant, longitudeOriginDeg: variant.longitudeOriginDeg + 180 };
    const xanadu = spot('Xanadu', -15, 260);
    const belet = spot('Belet', -5, 105);

    const right = luminance(await texelAt(titan, xanadu, variant)) - luminance(await texelAt(titan, belet, variant));
    const wrong =
      luminance(await texelAt(titan, xanadu, flipped)) - luminance(await texelAt(titan, belet, flipped));

    expect(right).toBeGreaterThan(50);
    expect(wrong).toBeLessThan(0);
  });
});

describe('the catalog says where every image starts', () => {
  const variants = CATALOG.flatMap((body) =>
    body.textures === null
      ? []
      : SET_IDS.map((setId) => ({ id: body.id, setId, ...body.textures![setId as TextureSetId] })),
  );

  it('gives every map in every set a longitude origin on the circle', () => {
    for (const v of variants) {
      expect(v.longitudeOriginDeg, `${v.id}/${v.setId}`).toBeGreaterThanOrEqual(0);
      expect(v.longitudeOriginDeg, `${v.id}/${v.setId}`).toBeLessThan(360);
    }
  });

  it('splits the publishers the way their files are drawn', () => {
    // Solar System Scope, NASA Blue Marble and the NASA 3D Resources maps all centre
    // on the prime meridian, so their left edge is 180 W. NASA's Pluto mosaic starts
    // at 0, and so do the USGS products centred on 180 -- Europa, Ganymede, Callisto,
    // Enceladus and Titan -- where the rest of USGS's moons centre on 0. Each measured
    // from its ISIS label and against named features; see CREDITS.md. Pinned so a new
    // map cannot quietly inherit the wrong one.
    const startingAtZero = variants.filter((v) => v.longitudeOriginDeg === 0);
    const startingAt180 = variants.filter((v) => v.longitudeOriginDeg === 180);

    expect(new Set(startingAtZero.map((v) => v.id))).toEqual(
      new Set(['pluto', 'europa', 'ganymede', 'callisto', 'enceladus', 'titan']),
    );
    expect(startingAtZero.length + startingAt180.length).toBe(variants.length);
  });

  it('starts every map of a triaxial body at 0 or 180 degrees, where its long axis stays put', () => {
    // The renderer stretches a triaxial moon along the mesh's local x axis, and the
    // orientation puts the image's first column on local -x. Only a map starting on the
    // prime meridian or its antipode leaves the long axis on the prime meridian -- on
    // the planet. Any other origin would draw Mimas stretched sideways.
    for (const body of CATALOG) {
      if (body.triaxialRadiiKm === null || body.textures === null) {
        continue;
      }
      for (const setId of SET_IDS) {
        const origin = body.textures[setId as TextureSetId].longitudeOriginDeg;
        expect(origin % 180, `${body.id}/${setId}`).toBe(0);
      }
    }
  });

  it('places the north pole at the top of every file', () => {
    // uv.y = 1 at local +y, which the orientation maps to the IAU north pole, and
    // flipY puts uv.y = 1 on the first row of the image. Equirectangular maps are
    // drawn north-up, so this has to hold for all of them.
    const { v } = uvForLocalDirection(new THREE.Vector3(0, 1, 0));

    expect(v).toBe(1);
  });

  it('changes the map for exactly the bodies with a better-sourced one', () => {
    // Three of ten. Pinned because the UI states the count, and a silently growing or
    // shrinking set would make that text a lie.
    const differing = CATALOG.filter(
      (body) =>
        body.textures !== null &&
        body.textures.illustrative.file !== body.textures.photometric.file,
    ).map((body) => body.id);

    expect(differing).toEqual(['earth', 'mars', 'neptune']);
  });
});
