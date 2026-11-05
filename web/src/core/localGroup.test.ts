import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { LocalGroupCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import {
  MIN_SIGMA_PX,
  plummerColumn,
  pointPeak,
  pointShare,
  RESOLVED_PX,
  UNRESOLVED_PX,
} from '../scene/LocalGroup.tsx';
import {
  catalogueGalaxy,
  centralDensities,
  colourIndex,
  columnAt,
  decodeMapChannel,
  extinctionCurve,
  faceOnScales,
  galaxyAxes,
  galaxyHalfLightPc,
  galaxyKey,
  galaxyLuminosity,
  galaxyPositionPc,
  gamma,
  GIANTS,
  indexLocalGroup,
  parseFaceOnMap,
  prugnielSimien,
  surfaceBrightness,
  YOUNG_V_PER_SFR,
} from './localGroup.ts';

/**
 * The Local Group's light (localGroup.ts, scene/LocalGroup.tsx): that the profiles hold the
 * luminosity they are given, that the closed-form column through a Plummer ellipsoid is the
 * integral it stands for, that the four face the way their papers say, and that a dwarf
 * drawn from the catalogue's size and V comes out as bright at its centre as the catalogue
 * measures it.
 */

const byKey = (key: string) => GIANTS.find((galaxy) => galaxy.key === key)!;
const dot = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }) => a.x * b.x + a.y * b.y + a.z * b.z;

/** A catalogue of one, Fornax as McConnachie gives it. */
const FORNAX: LocalGroupCatalog = {
  source: { url: '', version: '', queriedAt: '' },
  frame: '',
  count: 1,
  catalogueName: ['Fornax'],
  name: ['Fornax'],
  otherNames: [[]],
  ambiguous: [false],
  raDeg: [39.997],
  decDeg: [-34.449],
  x: [0],
  y: [0],
  z: [0],
  distanceModulus: [20.84],
  distanceModulusUp: [0.18],
  distanceModulusDown: [0.18],
  distancePc: [147231],
  ebv: [0.021],
  vMag: [7.38],
  muV0: [23.4],
  halfLightArcmin: [18.4],
  ellipticity: [0.28],
  positionAngleDeg: [46],
  radialVelocityKmS: [55.3],
  sigmaStarsKmS: [11.7],
  hiMassMillionSun: [0.17],
  feH: [-0.99],
  pmRaMasYr: [null],
  pmDecMasYr: [null],
};

describe('a galaxy’s light', () => {
  it('has the closed-form column of a Plummer ellipsoid equal to its integral', () => {
    for (const [u0, v] of [
      [[-30, 2, 0.5], [1, 0.05, 0]],
      [[0.2, -0.1, 0.3], [0.3, 0.6, -0.2]],
      [[-4, 0, 0], [1, 0, 0]],
    ] as const) {
      // Midpoint rule from the camera far past the galaxy.
      let sum = 0;
      const dt = 1e-3;
      for (let t = dt / 2; t < 200; t += dt) {
        const m2 = (u0[0] + t * v[0]) ** 2 + (u0[1] + t * v[1]) ** 2 + (u0[2] + t * v[2]) ** 2;
        sum += (1 + m2) ** -2.5 * dt;
      }
      expect(plummerColumn(u0, v) / sum).toBeCloseTo(1, 4);
    }
  });

  it('leaves out the light nearer the camera than its near limit', () => {
    const u0 = [0.1, 0.2, -0.3] as const;
    const v = [0.4, -0.2, 0.5] as const;
    let sum = 0;
    const dt = 1e-3;
    for (let t = 2 + dt / 2; t < 200; t += dt) {
      const m2 = (u0[0] + t * v[0]) ** 2 + (u0[1] + t * v[1]) ** 2 + (u0[2] + t * v[2]) ** 2;
      sum += (1 + m2) ** -2.5 * dt;
    }
    expect(plummerColumn(u0, v, 2) / sum).toBeCloseTo(1, 4);
    expect(plummerColumn(u0, v, 2)).toBeLessThan(plummerColumn(u0, v));
  });

  it('draws Fornax as bright at its centre as McConnachie measures it', () => {
    const fornax = catalogueGalaxy(FORNAX, 0);
    const model = fornax.model!;
    expect(model.kind).toBe('plummer');
    const rho0 = centralDensities(fornax)!.main;
    // Through the centre along the line of sight: (4/3) rho0 c.
    const centre = surfaceBrightness((4 / 3) * rho0 * (model as { depthPc: number }).depthPc);
    expect(Math.abs(centre - FORNAX.muV0[0]!)).toBeLessThan(0.3);
  });

  it('draws a dwarf young where it is rich in gas, and Fornax, with a trace of it, old', () => {
    expect(catalogueGalaxy(FORNAX, 0).colourIndex).toBe(0.75);
    // IC 1613: 65 million solar masses of HI to 100 million solar luminosities; Sculptor 0.22 to 1.8.
    expect(colourIndex(65, 1e8)).toBe(0.45);
    expect(colourIndex(0.22, 1.8e6)).toBe(0.75);
    expect(colourIndex(null, 1e7)).toBe(0.75);
  });

  it('puts all of a disc’s and a bulge’s light in their profiles', () => {
    const m31 = byKey('m31');
    const model = m31.model as Extract<(typeof m31)['model'], { kind: 'disc' }>;
    const { main, bulge } = centralDensities(m31)!;
    // The disc, numerically: 2 pi R dR times 2 h_z.
    let disc = 0;
    for (let r = 5; r < 40 * model.scaleLengthPc; r += 10) {
      disc += 2 * Math.PI * r * 10 * Math.exp(-r / model.scaleLengthPc) * 2 * model.scaleHeightPc * main;
    }
    // The bulge: 4 pi r^2 dr.
    const { p, b } = prugnielSimien(model.bulge!.sersicN);
    const re = model.bulge!.effectiveRadiusPc;
    let sphere = 0;
    for (let r = 0.05; r < 60 * re; r += 0.1) {
      sphere += 4 * Math.PI * r * r * 0.1 * bulge * (r / re) ** -p * Math.exp(-b * (r / re) ** (1 / model.bulge!.sersicN));
    }
    const luminosity = galaxyLuminosity(m31)!;
    expect((disc + sphere) / luminosity).toBeCloseTo(1, 2);
    expect(sphere / luminosity).toBeCloseTo(model.bulge!.share, 2);
  });

  it('has Andromeda’s disc about 21 mag/arcsec^2 face-on, as discs are', () => {
    const m31 = byKey('m31');
    const model = m31.model as Extract<(typeof m31)['model'], { kind: 'disc' }>;
    const faceOn = centralDensities(m31)!.main * 2 * model.scaleHeightPc;
    // Freeman's law: discs' central B surface brightness near 21.65, V some 0.7 brighter.
    expect(surfaceBrightness(faceOn)).toBeGreaterThan(20);
    expect(surfaceBrightness(faceOn)).toBeLessThan(22);
  });

  it('puts all of a galaxy too small for a pixel in its point, and hands it to its volume as it grows', () => {
    // A Gaussian of the narrowest sigma, its peak from pointPeak, summed over pixels of 1 pc.
    const sigma = MIN_SIGMA_PX;
    let sum = 0;
    for (let x = -10; x <= 10; x += 1) {
      for (let y = -10; y <= 10; y += 1) {
        sum += pointPeak(1000, sigma) * Math.exp((-0.5 * (x * x + y * y)) / (sigma * sigma));
      }
    }
    expect(sum / 1000).toBeCloseTo(1, 2);
    expect(pointShare(UNRESOLVED_PX)).toBe(1);
    expect(pointShare(RESOLVED_PX)).toBe(0);
    expect(pointShare((UNRESOLVED_PX + RESOLVED_PX) / 2)).toBeCloseTo(0.5, 10);
  });

  it('has an exponential ellipsoid half its light within 2.027 scale lengths on the sky', () => {
    // Its column at R: twice the integral of e^-sqrt(R^2 + z^2) over z; summed over rings.
    const column = (r: number) => {
      let s = 0;
      for (let z = 0.0025; z < 40; z += 0.005) s += Math.exp(-Math.sqrt(r * r + z * z)) * 0.005;
      return 2 * s;
    };
    const smc = byKey('smc');
    const scale = (smc.model as { majorPc: number }).majorPc;
    const within = galaxyHalfLightPc(smc)! / scale;
    let inside = 0;
    for (let r = 0.005; r < within; r += 0.01) inside += 2 * Math.PI * r * column(r) * 0.01;
    // All of it: 8 pi.
    expect(inside / (8 * Math.PI)).toBeCloseTo(0.5, 2);
  });

  it('dims each colour by Cardelli et al.’s curve: V by A_V, B by A_V (1 + 1 / R_V)', () => {
    expect(extinctionCurve(0.55)).toBeCloseTo(1, 1);
    // A_B / A_V = (E(B-V) + A_V) / A_V = 1 + 1 / 3.1, CCM's own, within its fit.
    expect(Math.abs(extinctionCurve(0.44) - (1 + 1 / 3.1))).toBeLessThan(0.03);
    expect(extinctionCurve(0.61)).toBeLessThan(extinctionCurve(0.55));
    expect(extinctionCurve(0.46)).toBeGreaterThan(extinctionCurve(0.55));
  });

  it('decodes a map’s channel as the tool encodes it: log10 between its bounds, 0 for none', () => {
    const bounds = [-2, 3] as const;
    expect(decodeMapChannel(0, bounds)).toBe(0);
    expect(decodeMapChannel(1, bounds)).toBeCloseTo(0.01, 10);
    expect(decodeMapChannel(255, bounds)).toBeCloseTo(1000, 6);
    expect(Math.log10(decodeMapChannel(128, bounds))).toBeCloseTo(-2 + (127 / 254) * 5, 10);
  });

  it('puts all of Andromeda’s disc light in its map, the young stars’ and the old', () => {
    const m31 = byKey('m31');
    const model = m31.model as Extract<(typeof m31)['model'], { kind: 'disc' }>;
    const map = { size: 1024, halfPc: 25_000, bounds: { old: [-2, 3], sfr: [-5, 0], dust: [-1, 3] }, oldSum: 4.2e7, sfrSum: 0.4 } as const;
    const scales = faceOnScales(m31, map)!;
    const disc = (1 - model.bulge!.share) * galaxyLuminosity(m31)!;
    expect((scales.old * map.oldSum + YOUNG_V_PER_SFR * map.sfrSum) / disc).toBeCloseTo(1, 10);
    // 10^20 H2 per cm^2: 2 x 10^20 H, A_V 0.107, tau 0.0985.
    expect(scales.dustTauV).toBeCloseTo(0.0985, 3);
    expect(scales.heightsPc[0]).toBeCloseTo(5300 / 7.3, 6);
  });

  it('converts surface brightness both ways', () => {
    expect(surfaceBrightness(columnAt(23.4))).toBeCloseTo(23.4, 10);
    expect(gamma(5)).toBeCloseTo(24, 10);
    expect(gamma(0.5)).toBeCloseTo(Math.sqrt(Math.PI), 10);
  });
});

describe('where the galaxies are and which way they face', () => {
  it('has Andromeda tipped 77 degrees, its north-west side nearer', () => {
    const m31 = byKey('m31');
    const { u, v, w } = galaxyAxes(m31);
    const at = galaxyPositionPc(m31);
    const n = Math.hypot(at.x, at.y, at.z);
    const away = { x: at.x / n, y: at.y / n, z: at.z / n };
    expect((Math.acos(Math.abs(dot(w, away))) * 180) / Math.PI).toBeCloseTo(77, 6);
    expect(dot(u, away)).toBeCloseTo(0, 9);
    // The far half of the disc goes away from us.
    expect(dot(v, away)).toBeGreaterThan(0);
    expect(n).toBeCloseTo(761_000, -3);
  });

  it('lists the four first, then the catalogue less the three it replaces', () => {
    const archive = indexLocalGroup({ ...FORNAX, count: 2, catalogueName: ['Fornax', 'LMC'], name: ['Fornax', 'Large Magellanic Cloud'] } as never);
    expect(archive.galaxies.map((galaxy) => galaxy.key)).toEqual(['m31', 'm33', 'lmc', 'smc', 'fornax']);
  });

  it('keys each by its catalogue name', () => {
    expect(galaxyKey('AndromedaXXI')).toBe('andromeda-xxi');
    expect(galaxyKey('*Tucana3')).toBe('tucana-3');
    expect(galaxyKey('NGC6822')).toBe('ngc-6822');
    expect(galaxyKey('CanesVenatici(1)')).toBe('canes-venatici-1');
  });

  it('has every face-on map credited, and every disc’s map there', async () => {
    const folder = join(import.meta.dirname, '../../public/galaxies');
    const credits = await readFile(join(folder, 'CREDITS.md'), 'utf8');
    for (const name of await readdir(folder)) {
      if (name !== 'CREDITS.md') {
        expect(credits, name).toContain(name);
      }
    }
    for (const galaxy of GIANTS) {
      const model = galaxy.model;
      if (model?.kind === 'disc' && model.faceOnMap !== null) {
        const map = parseFaceOnMap(JSON.parse(await readFile(join(folder, `${model.faceOnMap}.json`), 'utf8')));
        expect(map.size).toBeGreaterThan(0);
        expect(credits).toContain(`${model.faceOnMap}.png`);
      }
    }
  });

  it('has every galaxy in the published data at the distance of its modulus', async () => {
    const path = join(import.meta.dirname, '../../public/data/local-group.json');
    const raw = await readFile(path, 'utf8').catch(() => null);
    if (raw === null) {
      return;
    }
    const catalog = JSON.parse(raw) as LocalGroupCatalog;
    for (let k = 0; k < catalog.count; k += 1) {
      const at = galaxyPositionPc(catalogueGalaxy(catalog, k));
      expect(Math.hypot(at.x, at.y, at.z) / catalog.distancePc[k]!).toBeCloseTo(1, 6);
    }
  });
});
