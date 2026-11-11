import type { LocalGroupCatalog } from '@sss/tools/types';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { boxMatrix, NEAR_SHARE, plummerColumn, WHITE_MU } from '../scene/LocalGroup.tsx';
import { UNITS_PER_PC } from '../scene/stars3dShader.ts';
import { brightestStarV, CUT_SCALES } from './dwarfStars.ts';
import {
  BOX_FLOOR,
  brightestStarsV,
  catalogueShape,
  centralDensities,
  columnAt,
  FRAMING_NEAREST_RADII,
  FRAMING_STARS_V,
  galaxyAxes,
  galaxyExtentPc,
  galaxyFramingKm,
  galaxyHalfLightPc,
  GIANTS,
  GLOW_SHOWN_MU,
  indexLocalGroup,
  plummerCentreMu,
  type LocalGroupGalaxy,
  UNDRAWN_REASONS,
} from './localGroup.ts';
import { PARSEC_KM } from './stars3d.ts';

/**
 * Going to a galaxy of the Local Group (localGroup.ts galaxyFramingKm): a dwarf whose light
 * shows is framed whole, as before; a faint one is gone to where its brightest stars show. And
 * a dwarf's box (scene/LocalGroup.tsx boxMatrix) is the right way round, so its light is drawn
 * from inside it.
 */

/** McConnachie's entries (2021 version), as the published catalogue has them. */
const CATALOGUE: LocalGroupCatalog = {
  source: { url: '', version: '', queriedAt: '' },
  frame: '',
  count: 2,
  catalogueName: ['Hercules', 'Fornax'],
  name: ['Hercules', 'Fornax'],
  otherNames: [[], ['Fornax dSph']],
  ambiguous: [false, false],
  raDeg: [247.75833, 39.99708],
  decDeg: [12.79167, -34.44917],
  x: [0, 0],
  y: [0, 0],
  z: [0, 0],
  distanceModulus: [20.6, 20.84],
  distanceModulusUp: [0.2, 0.18],
  distanceModulusDown: [0.2, 0.18],
  distancePc: [131826, 147231],
  ebv: [0.062, 0.021],
  vMag: [14.77, 7.38],
  muV0: [26.82, 23.59],
  halfLightArcmin: [5.99, 18.4],
  ellipticity: [0.69, 0.28],
  positionAngleDeg: [-73, 46],
  radialVelocityKmS: [45.2, 55.3],
  sigmaStarsKmS: [3.7, 11.7],
  hiMassMillionSun: [0, 0.17],
  feH: [-2.41, -0.99],
  pmRaMasYr: [-0.03, 0.382],
  pmDecMasYr: [-0.36, -0.359],
};
// Indexed, so the framing reads their [Fe/H] from the catalogue as the app does.
const [HERCULES, FORNAX] = indexLocalGroup(CATALOGUE).galaxies.slice(GIANTS.length) as [LocalGroupGalaxy, LocalGroupGalaxy];
const majorPc = (galaxy: LocalGroupGalaxy): number => (galaxy.model as { majorPc: number }).majorPc;
const framingPc = (galaxy: LocalGroupGalaxy): number => galaxyFramingKm(galaxy) / PARSEC_KM;
/** The stars' limit, V: the star catalogue's. */
const STARS_LIMIT_V = 8;

describe('going to a galaxy', () => {
  it('takes the glow’s threshold from the exposure it is drawn on', () => {
    expect(GLOW_SHOWN_MU).toBe(WHITE_MU + 5);
  });

  it('counts a dwarf’s brightest stars from its population: Hercules’s brightest below the tip, its fifth fainter', () => {
    const tip = brightestStarV(-2.41);
    const first = brightestStarsV(HERCULES, -2.41, 1)!;
    const fifth = brightestStarsV(HERCULES, -2.41, 5)!;
    expect(tip).toBe(-2.7);
    expect(first).toBeGreaterThan(tip);
    expect(fifth).toBeGreaterThan(first);
    expect(first).toBeCloseTo(-2.35, 1);
    expect(fifth).toBeCloseTo(-1.55, 1);
  });

  it('frames Fornax whole, its glow showing, as before', () => {
    expect(plummerCentreMu(FORNAX)!).toBeLessThan(GLOW_SHOWN_MU);
    expect(framingPc(FORNAX)).toBeCloseTo(21 * majorPc(FORNAX), 6);
  });

  it('takes the camera to Hercules near enough for its brightest stars, no nearer than three half-light radii', () => {
    expect(plummerCentreMu(HERCULES)!).toBeGreaterThan(GLOW_SHOWN_MU);
    const pc = framingPc(HERCULES);
    expect(pc).toBeLessThan(1500);
    expect(pc).toBeGreaterThanOrEqual(FRAMING_NEAREST_RADII * galaxyHalfLightPc(HERCULES)! - 1e-9);
    expect(pc).toBeCloseTo(FRAMING_NEAREST_RADII * galaxyHalfLightPc(HERCULES)!, 6);
    // Its brightest show plainly, its fifth within a magnitude of FRAMING_STARS_V.
    const at = (mv: number) => mv + 5 * (Math.log10(pc) - 1);
    expect(at(brightestStarsV(HERCULES, -2.41, 1)!)).toBeLessThan(FRAMING_STARS_V);
    expect(at(brightestStarsV(HERCULES, -2.41)!)).toBeLessThan(FRAMING_STARS_V + 1);
    // And DwarfStars.tsx picks it: its brightest, at the near edge of what is sampled, within the limit.
    const near = Math.max(1e-3, pc - CUT_SCALES * majorPc(HERCULES));
    expect(brightestStarV(-2.41) + 5 * (Math.log10(near) - 1)).toBeLessThanOrEqual(STARS_LIMIT_V);
  });

  it('never takes the camera farther than before', () => {
    for (const galaxy of [HERCULES, FORNAX]) {
      expect(framingPc(galaxy)).toBeLessThanOrEqual(21 * majorPc(galaxy) + 1e-9);
    }
  });

  it('frames the four as before', () => {
    const m31 = GIANTS.find((galaxy) => galaxy.key === 'm31')!;
    const smc = GIANTS.find((galaxy) => galaxy.key === 'smc')!;
    expect(framingPc(m31)).toBeCloseTo(28 * 5300, 6);
    expect(framingPc(smc)).toBeCloseTo(28 * 1250, 6);
  });
});

describe('a galaxy’s box', () => {
  const determinant = (galaxy: LocalGroupGalaxy) => {
    const { u, v, w } = galaxyAxes(galaxy);
    return u.x * (v.y * w.z - v.z * w.y) + u.y * (v.z * w.x - v.x * w.z) + u.z * (v.x * w.y - v.y * w.x);
  };

  it('is the right way round, a dwarf’s axes being a mirror image', () => {
    expect(determinant(FORNAX)).toBeCloseTo(-1, 9);
    const box = boxMatrix(galaxyAxes(FORNAX), galaxyExtentPc(FORNAX)!, { x: 1, y: 2, z: 3 }, new THREE.Matrix4());
    expect(box.determinant()).toBeGreaterThan(0);
  });

  it('is the same box: its corners where the galaxy’s axes put them', () => {
    const { u, v, w } = galaxyAxes(FORNAX);
    const extent = galaxyExtentPc(FORNAX)!;
    const box = boxMatrix({ u, v, w }, extent, { x: 0, y: 0, z: 0 }, new THREE.Matrix4());
    const plain = new THREE.Matrix4().makeBasis(
      new THREE.Vector3(u.x, u.y, u.z).multiplyScalar(extent[0] * UNITS_PER_PC),
      new THREE.Vector3(v.x, v.y, v.z).multiplyScalar(extent[1] * UNITS_PER_PC),
      new THREE.Vector3(w.x, w.y, w.z).multiplyScalar(extent[2] * UNITS_PER_PC),
    );
    const corners = (m: THREE.Matrix4) =>
      [-1, 1]
        .flatMap((x) => [-1, 1].flatMap((y) => [-1, 1].map((z) => new THREE.Vector3(x, y, z).applyMatrix4(m))))
        .map((p) => [p.x, p.y, p.z].map((c) => c.toPrecision(6)).join(','))
        .sort();
    expect(corners(box)).toEqual(corners(plain));
  });

  it('keeps a disc’s, already the right way round', () => {
    const m31 = GIANTS.find((galaxy) => galaxy.key === 'm31')!;
    expect(determinant(m31)).toBeCloseTo(1, 9);
    const extent = galaxyExtentPc(m31)!;
    const box = boxMatrix(galaxyAxes(m31), extent, { x: 0, y: 0, z: 0 }, new THREE.Matrix4());
    expect(box.elements[8]! / galaxyAxes(m31).w.x).toBeGreaterThan(0);
  });

  it('has light from inside it: Fornax’s column, the camera within its box, finite and there', () => {
    const model = FORNAX.model as { majorPc: number; minorPc: number; depthPc: number };
    // Seven scale radii out along the line of sight, inside the box's eight, looking in.
    const u0 = [0, 0, -7 * (model.majorPc / model.depthPc)] as const;
    const near = NEAR_SHARE * 7 * model.majorPc;
    for (const d of [
      [0, 0, 1],
      [0.1, 0.05, 1],
      [0.6, -0.3, 0.74],
    ] as const) {
      const n = Math.hypot(...d);
      const v = [d[0] / n / model.majorPc, d[1] / n / model.minorPc, d[2] / n / model.depthPc] as const;
      const column = plummerColumn(u0, v, near);
      expect(Number.isFinite(column)).toBe(true);
      expect(column).toBeGreaterThan(0);
    }
  });
});

describe('the dwarfs McConnachie gives no size, sized from their own papers', () => {
  // As the published catalogue has them: V and distance, no half-light radius.
  const catalogue: LocalGroupCatalog = {
    source: { url: '', version: '', queriedAt: '' },
    frame: '',
    count: 3,
    catalogueName: ['LeoP', 'KK258', '*Hydra1'],
    name: ['Leo P', 'KK 258', 'Hydra I'],
    otherNames: [[], [], []],
    ambiguous: [false, false, true],
    raDeg: [155.43792, 340.18292, 133.9],
    decDeg: [18.08806, -30.79972, 3.6],
    x: [0, 0, 0],
    y: [0, 0, 0],
    z: [0, 0, 0],
    distanceModulus: [26.05, 26.85, 15.52],
    distanceModulusUp: [0.2, 0.07, 0.05],
    distanceModulusDown: [0.2, 0.07, 0.05],
    distancePc: [1621810, 2344229, 12706],
    ebv: [0.026, 0.013, 0.039],
    vMag: [16.9, 16.3, 13.02],
    muV0: [null, 26, null],
    halfLightArcmin: [null, null, null],
    ellipticity: [null, 0.5, null],
    positionAngleDeg: [null, null, null],
    radialVelocityKmS: [264, 92, 89.4],
    sigmaStarsKmS: [null, null, 8.4],
    hiMassMillionSun: [0.94, null, null],
    feH: [null, -1.6, -0.91],
    pmRaMasYr: [null, null, null],
    pmDecMasYr: [null, null, null],
  } as unknown as LocalGroupCatalog;
  const [leoP, kk258, hydra] = indexLocalGroup(catalogue).galaxies.slice(GIANTS.length) as [
    LocalGroupGalaxy,
    LocalGroupGalaxy,
    LocalGroupGalaxy,
  ];
  const arcsec = (pc: number, galaxy: LocalGroupGalaxy): number => (Math.atan(pc / galaxy.distancePc) * 180 * 3600) / Math.PI;

  it('draws Leo P as a Plummer ellipsoid of half its stars’ 70″ edge, at McQuinn et al.’s 0.52 and 335°', () => {
    const model = leoP.model as Extract<LocalGroupGalaxy['model'], { kind: 'plummer' }>;
    expect(model.kind).toBe('plummer');
    expect(arcsec(model.majorPc, leoP)).toBeCloseTo(35, 3);
    expect(model.minorPc / model.majorPc).toBeCloseTo(0.48, 6);
    expect(model.positionAngleDeg).toBe(335);
    expect(leoP.shapeSource).toContain('McQuinn et al. 2013');
    expect(catalogueShape(catalogue, 0).ellipticity).toBe(0.52);
  });

  it('draws KK 258 by ESO-LV’s half-light ellipse: 30.15″ along its major axis, b/a 0.65, at 43.1°', () => {
    const model = kk258.model as Extract<LocalGroupGalaxy['model'], { kind: 'plummer' }>;
    expect(arcsec(model.majorPc, kk258)).toBeCloseTo(30.15, 3);
    expect(model.minorPc / model.majorPc).toBeCloseTo(1 / 1.54, 6);
    expect(model.positionAngleDeg).toBe(43.1);
    expect(kk258.shapeSource).toContain('ESO-LV');
  });

  it('frames both whole, their glow showing: 21 half-light radii out', () => {
    for (const galaxy of [leoP, kk258]) {
      expect(plummerCentreMu(galaxy)!).toBeLessThan(GLOW_SHOWN_MU);
      expect(framingPc(galaxy)).toBeCloseTo(21 * majorPc(galaxy), 6);
    }
    // Leo P 5.8 kpc out, KK 258 7.2.
    expect(framingPc(leoP) / 1000).toBeCloseTo(5.8, 1);
    expect(framingPc(kk258) / 1000).toBeCloseTo(7.2, 1);
  });

  it('leaves the ones with no size as marks, and says why', () => {
    expect(hydra.model).toBeNull();
    expect(UNDRAWN_REASONS['*Hydra1']).toBeDefined();
    for (const name of ['*Bootes3', '*CanisMajor', 'HIZSS3(A)', 'HIZSS3B']) {
      expect(UNDRAWN_REASONS[name]).toBeDefined();
    }
    // An override never replaces a size the catalogue has.
    const sized = { ...catalogue, halfLightArcmin: [1, null, null] } as unknown as LocalGroupCatalog;
    expect(catalogueShape(sized, 0).halfLightArcmin).toBe(1);
    expect(catalogueShape(sized, 0).source).toContain('McConnachie');
  });
});

describe('a bright galaxy’s box', () => {
  it('reaches past where its light could show: M32’s, 77 times white at its centre, 30 scale radii out', () => {
    // M32 as McConnachie has it: V 8.1, (m-M)0 24.53, r_h 0.47', e 0.25.
    const m32 = indexLocalGroup({
      ...CATALOGUE,
      count: 1,
      catalogueName: ['M32'],
      name: ['M32'],
      otherNames: [[]],
      ambiguous: [false],
      raDeg: [10.67417],
      decDeg: [40.86528],
      distanceModulus: [24.53],
      distancePc: [10 ** (1 + 24.53 / 5)],
      vMag: [8.1],
      halfLightArcmin: [0.47],
      ellipticity: [0.25],
      positionAngleDeg: [170],
    } as unknown as LocalGroupCatalog).galaxies.slice(GIANTS.length)[0]!;
    const white = columnAt(WHITE_MU);
    const model = m32.model as Extract<LocalGroupGalaxy['model'], { kind: 'plummer' }>;
    const extent = galaxyExtentPc(m32, white)!;
    expect(extent[0] / model.majorPc).toBeGreaterThan(20);
    // Its brightest line of sight past the box is below the floor.
    const peak = ((4 / 3) * centralDensities(m32)!.main * Math.max(model.majorPc, model.minorPc, model.depthPc)) / white;
    const k = extent[0] / model.majorPc;
    expect(peak * (1 + k * k) ** -2).toBeLessThanOrEqual(BOX_FLOOR * 1.0001);
    // A faint one keeps its 8.
    expect(galaxyExtentPc(HERCULES, white)![0]).toBeCloseTo(8 * majorPc(HERCULES), 6);
    // And a disc reaches its floor edge-on, along its plane and off it.
    const m31 = GIANTS[0]!;
    const disc = m31.model as Extract<LocalGroupGalaxy['model'], { kind: 'disc' }>;
    const box = galaxyExtentPc(m31, white)!;
    const along = (centralDensities(m31)!.main / white) * disc.scaleLengthPc;
    const kr = box[0] / disc.scaleLengthPc;
    expect(along * Math.sqrt(2 * Math.PI * kr) * Math.exp(-kr)).toBeLessThan(BOX_FLOOR * 1.01);
    expect(2 * along * Math.exp(-box[2] / disc.scaleHeightPc)).toBeLessThan(BOX_FLOOR * 1.01);
  });
});
