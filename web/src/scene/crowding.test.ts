import { describe, expect, it } from 'vitest';

import { FAINT_GALAXY_FLOOR } from './LocalGroup.tsx';
import { FLOOR_LEAST } from './Laniakea.tsx';
import {
  FLOOR_FULL_SEPARATION_PX,
  FLOOR_THIN,
  floorKept,
  floorSeparationPx,
  floorShown,
  halfCountRadiusPc,
  lineKept,
  lineSeparationPx,
  mapShown,
  MAP_FULL_LY,
  MAP_GONE_LY,
} from './crowding.ts';
import { MALAVASI_FULL_SEPARATION_PX, TEMPEL_FULL_SEPARATION_PX } from './CosmicWeb.tsx';
import { GLOW_FLOOR } from './glowBuffer.ts';

const LY_PC = 0.30660139378555057;
/** Pixels per radian of an 864 px tall view at 27 degrees. */
const PPR = 864 / (2 * Math.tan((13.5 * Math.PI) / 180));
/** Laniakea's catalogue as drawn: 86,899 galaxies, half within 153 Mpc. */
const LANIAKEA = { halfPc: 153e6, count: 86_899 };
/** The SDSS's and BOSS's: 1.8 million, half within 1.45 Gpc. */
const SDSS_HALF_PC = 1.446e9;
/** The camera from the Sun, pc, where the scale bar (120 px at most) first reads `ly`. */
const barFrom = (ly: number): number => ((ly * LY_PC) / 120) * PPR;

describe('the faint-galaxy floor as a catalogue crowds', () => {
  const kept = (ly: number) => floorKept(LANIAKEA.halfPc, LANIAKEA.count, ly * LY_PC, PPR);

  it('finds the radius holding half of a catalogue', () => {
    const positions = [1, 0, 0, 0, 2, 0, 0, 0, 3, 4, 0, 0, 0, 0, 5];
    expect(halfCountRadiusPc(positions, 5)).toBe(3);
  });

  it('keeps every dot from inside a catalogue and from its own views', () => {
    expect(floorKept(LANIAKEA.halfPc, LANIAKEA.count, 100e6, PPR)).toBe(1);
    expect(kept(1.5e9)).toBe(1);
  });

  it('holds the patch at the brightness of dots two pixels apart as they close up, not more and not less', () => {
    // Light on the patch: each dot's share over the square of its spacing.
    for (const ly of [5e9, 10e9, 20e9]) {
      const s = floorSeparationPx(LANIAKEA.halfPc, LANIAKEA.count, ly * LY_PC, PPR);
      expect(s).toBeLessThan(FLOOR_FULL_SEPARATION_PX);
      expect(kept(ly) / (s * s)).toBeCloseTo(1 / FLOOR_FULL_SEPARATION_PX ** 2, 10);
    }
  });

  it('keeps Laniakea all through a billion-light-year scale bar, and only less as the camera goes out', () => {
    // The bar reads a billion light years from 15 to 30 billion out.
    expect(floorShown(LANIAKEA.halfPc, barFrom(2e9) * 0.99, PPR)).toBe(1);
    let last = 1;
    for (let ly = 1e9; ly < 4e11; ly *= 1.2) {
      const k = kept(ly);
      expect(k).toBeLessThanOrEqual(last + 1e-12);
      last = k;
    }
  });

  it('takes it away before the observable universe is drawn, and when a catalogue is a speck', () => {
    expect(kept(MAP_GONE_LY)).toBe(0);
    expect(kept(250e9)).toBe(0);
    expect(floorShown(SDSS_HALF_PC, MAP_GONE_LY * LY_PC, PPR)).toBe(0);
    expect(floorShown(SDSS_HALF_PC, MAP_FULL_LY * LY_PC, PPR)).toBe(1);
    // A catalogue a few megaparsecs across (the Local Group's) is a speck from a billion light years.
    expect(floorKept(1e6, 144, 1e9 * LY_PC, PPR)).toBe(0);
    expect(floorKept(1e6, 144, 10e6, PPR)).toBe(1);
  });

  it('fades the map smoothly in the logarithm of the distance', () => {
    expect(mapShown(MAP_FULL_LY * LY_PC)).toBe(1);
    expect(mapShown(Math.sqrt(MAP_FULL_LY * MAP_GONE_LY) * LY_PC)).toBeCloseTo(0.5, 10);
    expect(mapShown(MAP_GONE_LY * LY_PC)).toBe(0);
  });

  it('draws fewer dots rather than ones the glow buffer would not keep', () => {
    // A neighbourless galaxy's dot at FLOOR_THIN is still over the glow's floor at its centre.
    expect(FAINT_GALAXY_FLOOR * FLOOR_LEAST * FLOOR_THIN).toBeGreaterThan(GLOW_FLOOR);
  });
});

describe('the filaments as they crowd', () => {
  // Malavasi et al.'s as drawn: 584,000 Mpc of them, half within 1.7 Gpc, on 18% of the sky; and
  // Tempel et al.'s, 177,000 Mpc, half within 300 Mpc, on 19% of it.
  const malavasi = (ly: number) => lineKept(1.715e9, 292e9, 0.181, ly * LY_PC, PPR, MALAVASI_FULL_SEPARATION_PX);
  const malavasiApart = (ly: number) => lineSeparationPx(1.715e9, 292e9, 0.181, ly * LY_PC, PPR);
  const tempel = (ly: number) => lineKept(0.2995e9, 88.3e9, 0.185, ly * LY_PC, PPR, TEMPEL_FULL_SEPARATION_PX);
  const tempelApart = (ly: number) => lineSeparationPx(0.2995e9, 88.3e9, 0.185, ly * LY_PC, PPR);

  it('keeps every line from inside the half of them nearest the Sun', () => {
    expect(lineSeparationPx(1.715e9, 292e9, 0.181, 1e9, PPR)).toBe(Infinity);
    expect(malavasi(3e9)).toBe(1);
  });

  it('dims them as the square of their spacing to half the full one, as from Laniakea’s own view', () => {
    // Tempel's from Laniakea's view, 2 billion light years out: 3.35 pixels apart, 31% of each line.
    expect(tempelApart(2e9)).toBeCloseTo(3.35, 1);
    expect(tempel(2e9)).toBeCloseTo((tempelApart(2e9) / TEMPEL_FULL_SEPARATION_PX) ** 2, 12);
  });

  it('then holds their light on the patch: each line as much dimmer as they are nearer', () => {
    expect(tempelApart(5e9)).toBeLessThan(TEMPEL_FULL_SEPARATION_PX / 2);
    expect(tempel(10e9) / tempelApart(10e9)).toBeCloseTo(tempel(5e9) / tempelApart(5e9), 12);
    expect(tempel(5e9)).toBeGreaterThan(0.01);
  });

  it('dims them only ever more as the camera goes out, Malavasi’s readable through a billion-light-year bar, all gone before the observable universe', () => {
    for (const kept of [malavasi, tempel]) {
      let last = 1;
      for (let ly = 1e9; ly < 4e11; ly *= 1.2) {
        const k = kept(ly);
        expect(k).toBeLessThanOrEqual(last + 1e-12);
        last = k;
      }
      expect(kept(MAP_GONE_LY)).toBe(0);
    }
    expect(malavasiApart(20e9)).toBeLessThan(MALAVASI_FULL_SEPARATION_PX * 2);
    expect(malavasi(barFrom(2e9) * 0.99 / LY_PC)).toBeGreaterThan(0.6);
  });
});
