import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GALAXY_FRAMING_KM, LANIAKEA_FRAMING_KM, LIGHT_YEAR_KM, LOCAL_GROUP_FRAMING_KM, MAX_VIEW_DISTANCE_KM, OBSERVABLE_UNIVERSE_FRAMING_KM } from './scale.ts';
import {
  CMB_EMITTED_K,
  cmbColour,
  cmbLut,
  cmbTexCoord,
  cmbVisibility,
  LAST_SCATTERING_RADIUS_KM,
  LUT_SIZE,
} from './cmb.ts';
import { galacticDirection } from './galactic.ts';
import { glowDisplay } from './glowBuffer.ts';

describe('the last-scattering sphere', () => {
  it('is 45.3 billion ly about the Sun, and was 2,973 K when its light left', () => {
    expect(LAST_SCATTERING_RADIUS_KM / LIGHT_YEAR_KM / 1e9).toBeCloseTo(45.27, 2);
    expect(CMB_EMITTED_K).toBeCloseTo(2973, 0);
  });

  it('is never drawn from inside it, nor anywhere near: not on the sky of a galaxy or the Solar System', () => {
    for (const km of [1, GALAXY_FRAMING_KM, LOCAL_GROUP_FRAMING_KM, LANIAKEA_FRAMING_KM, LAST_SCATTERING_RADIUS_KM, 1.3 * LAST_SCATTERING_RADIUS_KM]) {
      expect(cmbVisibility(km)).toBe(0);
    }
    expect(cmbVisibility(OBSERVABLE_UNIVERSE_FRAMING_KM)).toBe(1);
    expect(cmbVisibility(MAX_VIEW_DISTANCE_KM)).toBe(1);
    expect(cmbVisibility(100e9 * LIGHT_YEAR_KM)).toBeGreaterThan(0);
    expect(cmbVisibility(100e9 * LIGHT_YEAR_KM)).toBeLessThan(1);
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
  });

  // Its near half drawn was an opaque disc over the quasars, the deep fields and the record-holders,
  // and from just outside, the sphere overfilling the frame, a brown fog over the whole view.
  it('draws only its far half, a bowl behind what it encloses', async () => {
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
