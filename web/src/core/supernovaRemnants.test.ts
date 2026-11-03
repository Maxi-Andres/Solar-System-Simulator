import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EphemerisStore } from './ephemerisStore.ts';
import {
  ensureSupernovaRemnants,
  imageOffsetKm,
  remnantBodyId,
  remnantOf,
  remnantRadiusKm,
  remnantState,
  SUPERNOVA_REMNANTS,
} from './supernovaRemnants.ts';

const PARSEC_KM = (149_597_870.7 * 648_000) / Math.PI;
const byKey = (key: string) => SUPERNOVA_REMNANTS.find((remnant) => remnant.key === key)!;

describe('the supernova remnants', () => {
  it('are where their distances put them', () => {
    for (const remnant of SUPERNOVA_REMNANTS) {
      const p = remnantState(remnant).position;
      expect(Math.hypot(p.x, p.y, p.z) / PARSEC_KM).toBeCloseTo(remnant.distancePc, 3);
    }
  });

  it('are the size Green gives them at that distance: the Crab 3.5 pc across, the Cygnus Loop 41', () => {
    // The Crab's 6' mean at 2 kpc: 3.5 pc across, 1.7 in radius.
    expect(remnantRadiusKm(byKey('crab')) / PARSEC_KM).toBeCloseTo(1.75, 1);
    // The Cygnus Loop's 195' mean at 725 pc: 41 pc across.
    expect((2 * remnantRadiusKm(byKey('cygnus-loop'))) / PARSEC_KM).toBeCloseTo(41.1, 0);
  });

  it('sit round the pulsars that are theirs: the Crab’s pulsar inside its nebula', () => {
    // The Crab Pulsar's ATNF position, 05h34m31.97s +22d00m52.2s, against Green's centre to the arcminute.
    const crab = byKey('crab');
    const pulsarRa = (5 + 34 / 60 + 31.97 / 3600) * 15;
    const pulsarDec = 22 + 0 / 60 + 52.2 / 3600;
    const offArcmin = Math.hypot((pulsarRa - crab.raDeg) * Math.cos((pulsarDec * Math.PI) / 180), pulsarDec - crab.decDeg) * 60;
    expect(offArcmin).toBeLessThan(crab.sizeArcmin[1] / 2);
  });

  it('become bodies once, found by id', () => {
    const store = new EphemerisStore({
      manifest: { bodies: [], tables: {} },
      bodies: [],
      vectors: new Map(),
      elements: new Map(),
      generatedAt: new Date(0),
    } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
    ensureSupernovaRemnants(store);
    ensureSupernovaRemnants(store);
    for (const remnant of SUPERNOVA_REMNANTS) {
      expect(store.isPropagatedBody(remnantBodyId(remnant))).toBe(true);
      expect(remnantOf(remnantBodyId(remnant))).toBe(remnant);
    }
    expect(store.body('snr-crab').kind).toBe('supernova-remnant');
  });
});

const REMNANTS_DIR = join(import.meta.dirname, '../../public/remnants');

/** A baseline or progressive JPEG's width and height, from its first start-of-frame marker. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  let at = 2;
  while (at < bytes.length) {
    const marker = bytes[at + 1]!;
    const length = (bytes[at + 2]! << 8) | bytes[at + 3]!;
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { height: (bytes[at + 5]! << 8) | bytes[at + 6]!, width: (bytes[at + 7]! << 8) | bytes[at + 8]! };
    }
    at += 2 + length;
  }
  throw new Error('no start of frame');
}

describe('the supernova remnants’ photographs', () => {
  const withImages = SUPERNOVA_REMNANTS.filter((remnant) => remnant.image !== null);

  it('are each in web/public/remnants, credited there with its credit line and licence, and nothing else is', async () => {
    const credits = await readFile(join(REMNANTS_DIR, 'CREDITS.md'), 'utf8');
    const files = (await readdir(REMNANTS_DIR)).filter((file) => file !== 'CREDITS.md').sort();
    expect(files).toEqual(withImages.map((remnant) => remnant.image!.file).sort());
    for (const remnant of withImages) {
      const image = remnant.image!;
      const row = credits.split('\n').find((line) => line.startsWith(`| ${image.file} |`));
      expect(row, image.file).toBeDefined();
      expect(row).toContain(image.source);
      expect(row).toContain(image.credit);
      expect(row).toContain(image.licence);
    }
  });

  it('have the shape of the field of view they are drawn at', async () => {
    for (const remnant of withImages) {
      const image = remnant.image!;
      const { width, height } = jpegSize(new Uint8Array(await readFile(join(REMNANTS_DIR, image.file))));
      expect(width / height, image.file).toBeCloseTo(image.widthArcmin / image.heightArcmin, 2);
      expect(Math.max(width, height)).toBeLessThanOrEqual(2048);
    }
  });

  it('show their remnant: its centre within the frame, or the frame within its ring (Vela’s northern quarter)', () => {
    for (const remnant of withImages) {
      const image = remnant.image!;
      const { east, north } = imageOffsetKm(remnant, image);
      const arcminPerKm = 1 / (((remnant.distancePc * PARSEC_KM * Math.PI) / 180) / 60);
      const offArcmin = Math.hypot(east, north) * arcminPerKm;
      const halfDiagonal = Math.hypot(image.widthArcmin, image.heightArcmin) / 2;
      const radiusArcmin = (remnant.sizeArcmin[0] + remnant.sizeArcmin[1]) / 4;
      expect(offArcmin, remnant.key).toBeLessThan(remnant.key === 'vela' ? radiusArcmin : halfDiagonal);
    }
  });

  it('are placed by their own centres: the Crab’s within an arcminute of Green’s, the Cygnus Loop’s 22′ north of it', () => {
    const offArcmin = (key: string) => {
      const remnant = byKey(key);
      const { east, north } = imageOffsetKm(remnant, remnant.image!);
      const perKm = 1 / (((remnant.distancePc * PARSEC_KM * Math.PI) / 180) / 60);
      return { east: east * perKm, north: north * perKm };
    };
    const crab = offArcmin('crab');
    expect(Math.hypot(crab.east, crab.north)).toBeLessThan(1);
    // 20h51m38.4s +31d02m15s against 20h51m +30d40m: 8.2' east, 22.3' north.
    const loop = offArcmin('cygnus-loop');
    expect(loop.north).toBeCloseTo(22.3, 0);
    expect(loop.east).toBeCloseTo(8.2, 0);
  });
});
