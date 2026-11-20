import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';

import {
  GALAXY_FRAMING_KM,
  LANIAKEA_FRAMING_KM,
  LIGHT_YEAR_KM,
  LOCAL_GROUP_FRAMING_KM,
  LOCAL_VOLUME_FRAMING_KM,
  MAX_VIEW_DISTANCE_KM,
  NEARBY_UNIVERSE_FRAMING_KM,
  OBSERVABLE_UNIVERSE_FRAMING_KM,
} from './scale.ts';
import {
  CMB_EMITTED_K,
  CMB_FROM_LY,
  cmbColour,
  cmbLut,
  cmbTexCoord,
  cmbVisibility,
  LAST_SCATTERING_RADIUS_KM,
  LUT_SIZE,
  PLANCK_RANGE_UK,
  planckColour,
} from './cmb.ts';
import { equatorialDirection, galacticDirection } from './galactic.ts';
import { glowDisplay } from './glowBuffer.ts';
import { equatorialToEcliptic } from './orientation.ts';

describe('the last-scattering sphere', () => {
  it('is 45.3 billion ly about the Sun, and was 2,973 K when its light left', () => {
    expect(LAST_SCATTERING_RADIUS_KM / LIGHT_YEAR_KM / 1e9).toBeCloseTo(45.27, 2);
    expect(CMB_EMITTED_K).toBeCloseTo(2973, 0);
  });

  it('is seen only from inside: the camera never goes past 0.9 of its radius', () => {
    expect(MAX_VIEW_DISTANCE_KM).toBeLessThan(0.9 * LAST_SCATTERING_RADIUS_KM);
    expect(OBSERVABLE_UNIVERSE_FRAMING_KM).toBeLessThan(MAX_VIEW_DISTANCE_KM);
    // Past the farthest record-holder, MoM-z14, 33.9 billion ly out, with room on its far side.
    expect(MAX_VIEW_DISTANCE_KM / LIGHT_YEAR_KM).toBeGreaterThan(33.9e9 + 5e9);
  });

  it('is never on the sky of the Solar System, the galaxy, the Local Group or Laniakea, and whole far out', () => {
    for (const km of [1, GALAXY_FRAMING_KM, LOCAL_GROUP_FRAMING_KM, LOCAL_VOLUME_FRAMING_KM, NEARBY_UNIVERSE_FRAMING_KM]) {
      expect(cmbVisibility(km)).toBe(0);
    }
    // Laniakea's view, 1.8 billion ly from its attractor: some 2 billion from the Sun.
    expect(cmbVisibility(LANIAKEA_FRAMING_KM + 0.4e9 * LIGHT_YEAR_KM)).toBe(0);
    expect(cmbVisibility(CMB_FROM_LY * LIGHT_YEAR_KM)).toBe(0);
    // Not until the scale bar reads a billion light years: 18.7 billion out on a 1080-pixel screen.
    expect(CMB_FROM_LY / 1e9).toBeCloseTo(18.74, 2);
    expect(cmbVisibility(15e9 * LIGHT_YEAR_KM)).toBe(0);
    expect(cmbVisibility(24e9 * LIGHT_YEAR_KM)).toBeGreaterThan(0);
    expect(cmbVisibility(24e9 * LIGHT_YEAR_KM)).toBeLessThan(1);
    expect(cmbVisibility(30e9 * LIGHT_YEAR_KM)).toBe(1);
    expect(cmbVisibility(OBSERVABLE_UNIVERSE_FRAMING_KM)).toBe(1);
    expect(cmbVisibility(MAX_VIEW_DISTANCE_KM)).toBe(1);
  });

  it('reads the map at each direction’s Galactic longitude and latitude, l = 0 in the middle, growing left', () => {
    const at = (l: number, b: number) => cmbTexCoord(galacticDirection(l, b));
    const [u0, v0] = at(0, 0);
    expect(u0).toBeCloseTo(0.5, 9);
    expect(v0).toBeCloseTo(0.5, 9);
    expect(at(90, 0)[0]).toBeCloseTo(0.25, 9);
    expect(at(270, 0)[0]).toBeCloseTo(0.75, 9);
    // The texture's v counts from the bottom row: the north Galactic pole is v = 1.
    expect(at(0, 90)[1]).toBeCloseTo(1, 6);
    expect(at(0, -45)[1]).toBeCloseTo(0.25, 9);
    // The Cold Spot (l 209, b -57) on the map's right half.
    expect(at(209, -57)[0]).toBeCloseTo(0.5 + 151 / 360, 9);
  });

  it('draws a hot spot yellower and brighter, a cold one redder and dimmer', () => {
    const [mr, mg, mb] = cmbColour(0);
    const [hr, hg, hb] = cmbColour(200);
    const [cr, cg, cb] = cmbColour(-200);
    const luminance = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
    expect(luminance(hr, hg, hb)).toBeGreaterThan(luminance(mr, mg, mb) * 1.5);
    expect(luminance(cr, cg, cb)).toBeLessThan(luminance(mr, mg, mb) / 1.5);
    expect(hb / hr).toBeGreaterThan(mb / mr);
    expect(cb / cr).toBeLessThan(mb / mr);
    // The mean is orange: red over green over blue.
    expect(mr).toBeGreaterThan(mg);
    expect(mg).toBeGreaterThan(mb);
  });

  it('shows its mean as a light orange through the glows’ display curve, not a tan', () => {
    const shown = cmbColour(0).map((x) => Math.round(glowDisplay(x) * 255));
    expect(shown[0]).toBeCloseTo(201, -1);
    expect(shown[1]).toBeCloseTo(159, -1);
    expect(shown[2]).toBeCloseTo(99, -1);
  });

  it('has a table entry every eight bytes of the map, the middle one the mean', () => {
    const lut = cmbLut({ zeroLevel: 128, microkelvinPerStep: 4 });
    expect(lut).toHaveLength(LUT_SIZE);
    expect(lut[16]).toEqual(cmbColour(0));
    const planck = cmbLut({ zeroLevel: 128, microkelvinPerStep: 4 }, 'planck');
    expect(planck).toHaveLength(LUT_SIZE);
    expect(planck[16]).toEqual(planckColour(0));
  });

  it('as Planck’s map, runs blue to cyan to cream to orange to red, over ±300 µK', () => {
    const byte = (dT: number) => planckColour(dT).map((x) => Math.round(x * 255));
    expect(byte(-PLANCK_RANGE_UK)).toEqual([0, 0, 255]);
    expect(byte(-1000)).toEqual([0, 0, 255]);
    expect(byte(PLANCK_RANGE_UK)).toEqual([100, 0, 0]);
    expect(byte(1000)).toEqual([100, 0, 0]);
    // The table's own entries (Planck_Parchment_RGB.txt): 85 cyan, 127 cream, 170 orange, 212 red.
    const at = (index: number) => (index / 255) * 2 * PLANCK_RANGE_UK - PLANCK_RANGE_UK;
    expect(byte(at(85))).toEqual([0, 221, 255]);
    expect(byte(at(127))).toEqual([255, 237, 217]);
    expect(byte(at(170))).toEqual([255, 180, 0]);
    expect(byte(at(212))).toEqual([255, 75, 0]);
    // And between them, as the table's to its rounding: entry 96 is (66, 225, 245), 200 is (255, 105, 0).
    const near = (got: number[], want: number[]) => got.forEach((x, c) => expect(Math.abs(x - want[c]!)).toBeLessThanOrEqual(1));
    near(byte(at(96)), [66, 225, 245]);
    near(byte(at(200)), [255, 105, 0]);
    // The mean a pale cream; cold blue, warm red.
    expect(Math.min(...planckColour(0))).toBeGreaterThan(0.8);
    expect(planckColour(-150)[2]).toBeGreaterThan(planckColour(-150)[0]);
    expect(planckColour(150)[0]).toBeGreaterThan(planckColour(150)[2]);
  });

  // Seen from inside, the sky as seen from here and not its mirror: the Cold Spot (Cruz et al.
  // 2007, RA 03h15m05s, Dec -19 deg 35 arcmin; Galactic l 209, b -57), placed through the scene's
  // own frame, falls on the map's coldest patch there -- and the patch mirrored in longitude, which
  // a map flipped east for west would put there, is not cold.
  it('puts the Cold Spot where it is in the sky', async () => {
    const dir = join(import.meta.dirname, '..', '..', 'public', 'cmb');
    const info = JSON.parse(await readFile(join(dir, 'cmb.json'), 'utf8')) as { file: string; zeroLevel: number; microkelvinPerStep: number };
    const png = PNG.sync.read(await readFile(join(dir, info.file)));
    const meanAround = (centre: { x: number; y: number; z: number }, radiusDeg: number): number => {
      let sum = 0;
      let count = 0;
      const cosRadius = Math.cos((radiusDeg * Math.PI) / 180);
      // Directions about the centre, every half degree, read through the shader's own lookup.
      for (let lat = -90; lat <= 90; lat += 0.5) {
        const step = 0.5 / Math.max(0.05, Math.cos((lat * Math.PI) / 180));
        for (let lon = 0; lon < 360; lon += step) {
          const d = galacticDirection(lon, lat);
          if (d.x * centre.x + d.y * centre.y + d.z * centre.z < cosRadius) continue;
          const [u, v] = cmbTexCoord(d);
          const x = Math.min(png.width - 1, Math.floor(u * png.width));
          const y = Math.min(png.height - 1, Math.floor((1 - v) * png.height));
          sum += (png.data[(y * png.width + x) * 4]! - info.zeroLevel) * info.microkelvinPerStep;
          count += 1;
        }
      }
      return sum / count;
    };
    const coldSpot = equatorialToEcliptic(equatorialDirection(48.771, -19.583));
    const catalogued = galacticDirection(209, -57);
    expect(coldSpot.x * catalogued.x + coldSpot.y * catalogued.y + coldSpot.z * catalogued.z).toBeGreaterThan(Math.cos(Math.PI / 180));
    expect(meanAround(coldSpot, 4)).toBeLessThan(-100);
    expect(meanAround(galacticDirection(151, -57), 4)).toBeGreaterThan(-30);
  });

  // From inside, its inside faces are all of it; its outside faces were, while the camera could be
  // outside, an opaque disc over the quasars, the deep fields and the record-holders.
  it('draws its inside, behind what it encloses', async () => {
    const source = await readFile(join(import.meta.dirname, 'CosmicMicrowaveBackground.tsx'), 'utf8');
    expect(source).toContain('side: THREE.BackSide');
    expect(source).not.toContain('THREE.FrontSide');
    expect(source).not.toContain('THREE.DoubleSide');
  });

  it('has its map committed, described and credited', async () => {
    const dir = join(import.meta.dirname, '..', '..', 'public', 'cmb');
    const info = JSON.parse(await readFile(join(dir, 'cmb.json'), 'utf8')) as { file: string; width: number; height: number; frame: string };
    expect(info.frame).toBe('galactic');
    expect(info.width).toBe(2 * info.height);
    const png = await readFile(join(dir, info.file));
    expect(png.readUInt32BE(16)).toBe(info.width);
    const credits = await readFile(join(dir, 'CREDITS.md'), 'utf8');
    expect(credits).toContain('ESA, Planck Collaboration');
    expect(credits).toContain(info.file);
  });
});
