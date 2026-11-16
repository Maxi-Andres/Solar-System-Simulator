import { inflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { ang2pixNest, pix2angNest } from './healpix.ts';
import { encodeGreyPng } from './png.ts';
import { encode, equirectangular, galacticOfMap, MICROKELVIN_PER_STEP, ZERO_LEVEL } from './prepareCmb.ts';

const lookup = (nside: number, z: number, phi: number): number => ang2pixNest(nside, z, Math.sqrt(Math.max(0, 1 - z * z)), phi);

describe('HEALPix, NESTED', () => {
  it('puts the twelve base pixels where the scheme puts them', () => {
    // Nside 1: the north cap's four centred on z = 2/3 at phi 45, 135, 225, 315 degrees; the
    // equator's four on z = 0 at 0, 90, 180, 270; the south cap's on z = -2/3 (Gorski et al. 2005, fig. 3).
    for (let face = 0; face < 12; face += 1) {
      const { z, phi } = pix2angNest(1, face);
      const ring = Math.floor(face / 4);
      expect(z).toBeCloseTo([2 / 3, 0, -2 / 3][ring]!, 12);
      expect((phi * 180) / Math.PI).toBeCloseTo(ring === 1 ? 90 * (face - 4) : 45 + 90 * (face % 4), 9);
    }
  });

  it('finds every pixel of a map from its own centre', () => {
    for (const nside of [1, 2, 16, 64]) {
      for (let pix = 0; pix < 12 * nside * nside; pix += 1) {
        const { z, phi } = pix2angNest(nside, pix);
        expect(lookup(nside, z, phi)).toBe(pix);
      }
    }
  });

  it('has pixels of equal area: a uniform scatter of directions fills them evenly', () => {
    const nside = 4;
    const counts = new Array<number>(12 * nside * nside).fill(0);
    const n = 192_000;
    // A Fibonacci lattice: n directions spread evenly over the sphere.
    for (let k = 0; k < n; k += 1) {
      const z = 1 - (2 * k + 1) / n;
      const phi = (k * Math.PI * (3 - Math.sqrt(5))) % (2 * Math.PI);
      counts[lookup(nside, z, phi)]! += 1;
    }
    const expected = n / counts.length;
    for (const count of counts) {
      expect(Math.abs(count - expected) / expected).toBeLessThan(0.03);
    }
  });

  it('keeps its digits at the poles', () => {
    // A direction 1e-9 rad from the north pole, by sin(theta) rather than 1 - z.
    const pix = ang2pixNest(2048, Math.cos(1e-9), Math.sin(1e-9), 0.3);
    const { z } = pix2angNest(2048, pix);
    expect(z).toBeGreaterThan(0.99999);
  });
});

describe('the equirectangular map', () => {
  it('has the Galactic centre in its middle, l growing to the left, north at the top', () => {
    expect(galacticOfMap(0.5, 0.5)).toEqual({ l: 0, b: 0 });
    expect(galacticOfMap(0.25, 0.5).l).toBeCloseTo(90, 12);
    expect(galacticOfMap(0.75, 0.5).l).toBeCloseTo(270, 12);
    expect(galacticOfMap(0.5, 0).b).toBe(90);
    expect(galacticOfMap(0.5, 1).b).toBe(-90);
  });

  it('reads a map that is its own longitude back as that longitude', () => {
    const nside = 64;
    const values = new Float32Array(12 * nside * nside);
    for (let pix = 0; pix < values.length; pix += 1) {
      values[pix] = Math.cos(pix2angNest(nside, pix).phi);
    }
    const width = 72;
    const height = 36;
    const map = equirectangular(values, nside, width, height, 2);
    for (const i of [9, 18, 27, 36, 45, 54]) {
      const { l } = galacticOfMap((i + 0.5) / width, 0.5);
      expect(map[(height / 2) * width + i]!).toBeCloseTo(Math.cos((l * Math.PI) / 180), 1);
    }
  });

  it('stores four microkelvin a step about 128, clipping past the byte', () => {
    const { bytes, clipped } = encode(new Float32Array([0, 400e-6, -400e-6, 1e-3, -1e-3]));
    expect(MICROKELVIN_PER_STEP).toBe(4);
    expect(ZERO_LEVEL).toBe(128);
    expect([...bytes]).toEqual([128, 228, 28, 255, 0]);
    expect(clipped).toBe(2);
  });
});

describe('the PNG', () => {
  it('holds the pixels it was given, row by row', () => {
    const width = 5;
    const height = 3;
    const pixels = Uint8Array.from({ length: width * height }, (_, k) => (k * 37) % 256);
    const png = encodeGreyPng(width, height, pixels);
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(png.readUInt32BE(16)).toBe(width);
    expect(png.readUInt32BE(20)).toBe(height);
    // The IDAT, inflated and unfiltered ("Up").
    const idatLength = png.readUInt32BE(33);
    expect(png.toString('latin1', 37, 41)).toBe('IDAT');
    const raw = inflateSync(png.subarray(41, 41 + idatLength));
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      expect(raw[y * (width + 1)]).toBe(2);
      for (let x = 0; x < width; x += 1) {
        const above = y === 0 ? 0 : out[(y - 1) * width + x]!;
        out[y * width + x] = (raw[y * (width + 1) + 1 + x]! + above) & 0xff;
      }
    }
    expect([...out]).toEqual([...pixels]);
  });
});
