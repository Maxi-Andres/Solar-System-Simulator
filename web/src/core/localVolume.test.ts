import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { LocalVolumeCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import {
  centralDensities,
  columnAt,
  DISC_FLATTENING,
  galaxyExtentPc,
  galaxyFramingKm,
  galaxyLuminosity,
  galaxyPositionPc,
  prugnielSimien,
  FRAMING_MU,
  SERSIC_REACH,
  sersicLightWithin,
  sersicUnitColumn,
  surfaceBrightness,
} from './localGroup.ts';
import {
  axisRatioFromInclination,
  BULGE_RE_OVER_H,
  bulgeShare,
  ELLIPTICAL_FITS,
  groupLabel,
  inclinationFromAxisRatio,
  indexLocalVolume,
  NAMED_V,
  parseLocalVolumeCatalog,
  regionOf,
  virgoCentre,
  volumeClass,
} from './localVolume.ts';
import { PARSEC_KM } from './stars3d.ts';

/**
 * The galaxies beyond the Local Group (localVolume.ts): which profile each is drawn as, from
 * its class; its size and orientation from the catalogue, and round where its orientation is
 * not measured; its light held whole by its profile; the named, the groups and the Virgo
 * Cluster's centre; and, if the published data is here, every one where its catalogue puts it.
 */

/** Five galaxies as the tool writes them, near enough. */
const CATALOGUE: LocalVolumeCatalog = {
  sources: {},
  frame: '',
  count: 6,
  sample: ['ungc', 'ungc', 'evcc', 'evcc', 'ungc', 'ungc'],
  name: ['NGC 253', 'KK 3', 'M87', 'VCC 21', 'NGC 4945', 'KK 999'],
  // M87 without its NGC number, so its fit (ELLIPTICAL_FITS) does not stand in: see below.
  otherNames: [['Sculptor Galaxy'], [], ['Virgo A'], ['EVCC 100'], [], []],
  raDeg: [11.888, 2.35, 187.706, 182.0, 196.364, 30],
  decDeg: [-25.288, -73.5, 12.391, 10.0, -49.468, 10],
  x: [0, 0, 0, 0, 0, 0],
  y: [0, 0, 0, 0, 0, 0],
  z: [0, 0, 0, 0, 0, 0],
  distancePc: [3.7e6, 2.1e6, 16.7e6, 16.2e6, 3.6e6, 5e6],
  distanceErrorPc: [0.1e6, null, 0.2e6, 0.6e6, 0.3e6, null],
  distanceMethod: ['TRGB', 'TRGB', 'SBF', 'cluster', 'TF', 'h'],
  distanceEstimated: [false, false, false, true, false, true],
  vMag: [7.1, 15.5, 8.6, 15.2, 8.3, null],
  colourIndex: [0.55, 0.47, 0.96, 0.8, 0.5, null],
  colourEstimated: [true, true, false, false, true, true],
  tType: [5, 10, -5, -5, 6, null],
  morphology: [null, 'Irr', 'E', 'dE,N', null, null],
  diameterArcmin: [29, 1.2, null, null, 23, null],
  halfLightArcmin: [6.5, 0.3, 1.7, 0.25, 4.8, null],
  halfLightEstimated: [true, true, false, false, true, false],
  axisRatio: [0.25, 0.6, 0.86, 0.7, null, null],
  inclinationDeg: [78, null, null, null, null, null],
  positionAngleDeg: [52, null, 160, 30, null, null],
  radialVelocityKmS: [243, 316, 1284, 1100, 563, null],
  logHiMassSun: [9.4, 6.6, null, null, 9.1, null],
  group: ['NGC 253', null, 'Virgo A', 'Virgo', 'Centaurus A', null],
};

const archive = indexLocalVolume(CATALOGUE);
const [ngc253, kk3, m87, vcc21, ngc4945, undrawn] = archive.galaxies as [
  (typeof archive.galaxies)[number],
  (typeof archive.galaxies)[number],
  (typeof archive.galaxies)[number],
  (typeof archive.galaxies)[number],
  (typeof archive.galaxies)[number],
  (typeof archive.galaxies)[number],
];
const arcminPc = (arcmin: number, distancePc: number) => Math.tan((arcmin / 60) * (Math.PI / 180)) * distancePc;

describe('which profile', () => {
  it('draws the dwarfs as the Local Group’s, the giant ellipticals by de Vaucouleurs’s law, the rest as discs', () => {
    expect(volumeClass(-5, 'dE,N', -16)).toBe('dwarf');
    expect(volumeClass(-1, 'Sph', -11)).toBe('dwarf');
    expect(volumeClass(10, 'Irr', -13)).toBe('dwarf');
    expect(volumeClass(9, null, -17)).toBe('dwarf');
    expect(volumeClass(null, 'BCD', -15)).toBe('dwarf');
    expect(volumeClass(-5, 'E', -22.5)).toBe('elliptical');
    // An elliptical fainter than M_V -17 is a dwarf.
    expect(volumeClass(-5, 'E', -16)).toBe('dwarf');
    expect(volumeClass(-2, 'S0', -20)).toBe('disc');
    expect(volumeClass(5, null, -21)).toBe('disc');
    expect(volumeClass(null, 'Sb', -20)).toBe('disc');
    expect(volumeClass(null, 'edge-on', -18)).toBe('disc');
    // Nothing known: a dwarf, as most are.
    expect(volumeClass(null, null, -12)).toBe('dwarf');
  });

  it('gives an early disc a bulge by Simien & de Vaucouleurs’s fit, a late one none', () => {
    expect(bulgeShare(-2)).toBeCloseTo(0.57, 2);
    expect(bulgeShare(1)).toBeCloseTo(0.39, 2);
    expect(bulgeShare(3)).toBeCloseTo(0.24, 2);
    expect(bulgeShare(5)).toBeCloseTo(0.1, 2);
    expect(bulgeShare(7)).toBeLessThan(0.025);
  });

  it('reads a disc’s inclination from its axis ratio, a disc as thick as these edge-on at 1/7.3', () => {
    for (const i of [0, 30, 60, 85, 90]) {
      expect(inclinationFromAxisRatio(axisRatioFromInclination(i))).toBeCloseTo(i, 6);
    }
    expect(axisRatioFromInclination(90)).toBeCloseTo(1 / DISC_FLATTENING, 10);
    expect(inclinationFromAxisRatio(1)).toBe(0);
  });
});

describe('a galaxy of the catalogue', () => {
  it('draws NGC 253 as a disc of its half-light radius, at its inclination and position angle, with a small bulge', () => {
    const model = ngc253.model!;
    expect(model.kind).toBe('disc');
    if (model.kind !== 'disc') return;
    expect(model.scaleLengthPc * 1.678).toBeCloseTo(arcminPc(6.5, 3.7e6), 3);
    expect(model.scaleHeightPc).toBeCloseTo(model.scaleLengthPc / DISC_FLATTENING, 6);
    expect(model.inclinationDeg).toBe(78);
    expect(model.positionAngleDeg).toBe(52);
    expect(model.bulge?.share).toBeCloseTo(bulgeShare(5), 10);
    expect(model.bulge?.effectiveRadiusPc).toBeCloseTo(BULGE_RE_OVER_H * model.scaleLengthPc, 6);
    expect(ngc253.shapeSource).toContain('radius estimated');
    expect(ngc253.distanceSource).toBe('tip of the red giant branch');
  });

  it('draws M87 by de Vaucouleurs’s law, its effective radius measured, and a dwarf elliptical as a Plummer ellipsoid', () => {
    const model = m87.model!;
    expect(model.kind).toBe('sersic');
    if (model.kind !== 'sersic') return;
    expect(model.sersicN).toBe(4);
    expect(model.majorPc).toBeCloseTo(arcminPc(1.7, 16.7e6), 3);
    expect(model.minorPc / model.majorPc).toBeCloseTo(0.86, 10);
    expect(model.depthPc).toBeCloseTo(Math.sqrt(model.majorPc * model.minorPc), 6);
    expect(vcc21.model?.kind).toBe('plummer');
    expect(vcc21.distanceSource).toBe('the cluster’s depth, estimated');
  });

  it('draws a galaxy whose position angle is not measured round: an irregular as deep as wide, a disc facing us', () => {
    const dwarf = kk3.model!;
    expect(dwarf.kind).toBe('plummer');
    if (dwarf.kind === 'plummer') {
      expect(dwarf.minorPc).toBe(dwarf.majorPc);
      expect(dwarf.depthPc).toBe(dwarf.majorPc);
    }
    const disc = ngc4945.model!;
    expect(disc.kind).toBe('disc');
    if (disc.kind === 'disc') {
      expect(disc.inclinationDeg).toBe(0);
    }
  });

  it('has no light drawn with no size or no V: its mark only', () => {
    expect(undrawn.model).toBeNull();
    expect(galaxyLuminosity(undrawn)).toBeNull();
  });

  it('draws the giant Virgo ellipticals by their own Sersic fits: M87’s index 11.8, 704" along its major axis', () => {
    const fitted = indexLocalVolume({ ...CATALOGUE, otherNames: [[], [], ['NGC 4486'], [], [], []] }).galaxies[2]!;
    const model = fitted.model as { kind: string; majorPc: number; sersicN: number };
    expect(model.kind).toBe('sersic');
    expect(model.sersicN).toBe(11.84);
    expect(model.majorPc).toBeCloseTo(Math.tan((703.91 / 3600) * (Math.PI / 180)) * 16.7e6, 3);
    // V_T less A_V, the fit's own light: brighter than the EVCC's aperture.
    expect(fitted.vMag).toBeCloseTo(ELLIPTICAL_FITS['4486']!.vTotal - 0.072, 10);
    expect(fitted.shapeSource).toBe('Kormendy et al. 2009');
  });

  it('knows how much of a Sersic profile’s light lies within so many effective radii', () => {
    for (const n of [1, 4, 5.99, 11.84]) {
      expect(sersicLightWithin(1, n)).toBeCloseTo(0.5, 2);
    }
    expect(sersicLightWithin(SERSIC_REACH, 4)).toBeGreaterThan(0.995);
    expect(sersicLightWithin(SERSIC_REACH, 11.84)).toBeLessThan(0.97);
  });

  it('holds all of an elliptical’s light in its profile, out to where it is drawn', () => {
    const model = m87.model as { majorPc: number; minorPc: number; depthPc: number; sersicN: number };
    const rho0 = centralDensities(m87)!.main;
    const { p, b } = prugnielSimien(model.sersicN);
    // In effective radii: 4 pi a b c rho0 times the integral of m^2 m^-p e^(-b m^(1/n)) dm, on m = x^4.
    let sum = 0;
    const steps = 200_000;
    for (let k = 0; k < steps; k += 1) {
      const x = (k + 0.5) / steps;
      const m = 100 * x ** 4;
      const dm = 400 * x ** 3 / steps;
      sum += m * m * m ** -p * Math.exp(-b * m ** (1 / model.sersicN)) * dm;
    }
    const light = 4 * Math.PI * model.majorPc * model.minorPc * model.depthPc * rho0 * sum;
    // Out to infinity, a little more: the light past where it is drawn put back inside it.
    expect((light * sersicLightWithin(SERSIC_REACH, model.sersicN)) / galaxyLuminosity(m87)!).toBeCloseTo(1, 3);
  });

  it('holds all of a disc’s and its bulge’s light, and boxes the bulge whole', () => {
    const model = ngc253.model as Extract<typeof ngc253.model, { kind: 'disc' }>;
    const { main, bulge } = centralDensities(ngc253)!;
    const disc = 4 * Math.PI * model.scaleLengthPc ** 2 * model.scaleHeightPc * main;
    const { unitLuminosity } = prugnielSimien(model.bulge!.sersicN);
    const sphere = unitLuminosity * model.bulge!.effectiveRadiusPc ** 3 * bulge;
    expect((disc + sphere) / galaxyLuminosity(ngc253)!).toBeCloseTo(1, 10);
    // Its box reaches at least eight effective radii of its bulge above the plane.
    const extent = galaxyExtentPc(ngc253, columnAt(21))!;
    expect(extent[2]).toBeGreaterThanOrEqual(8 * model.bulge!.effectiveRadiusPc);
  });

  it('frames an elliptical on its light out to 24 mag/arcsec², a steep one nearer than its effective radius', () => {
    const model = m87.model as { majorPc: number; depthPc: number; sersicN: number };
    const reach = galaxyFramingKm(m87) / PARSEC_KM / 7 / model.majorPc;
    expect(reach).toBeLessThan(3);
    const column = centralDensities(m87)!.main * model.depthPc * sersicUnitColumn(reach, model.sersicN);
    expect(surfaceBrightness(column)).toBeCloseTo(FRAMING_MU, 6);
    const fitted = indexLocalVolume({ ...CATALOGUE, otherNames: [[], [], ['NGC 4486'], [], [], []] }).galaxies[2]!;
    const steep = fitted.model as { majorPc: number };
    expect(galaxyFramingKm(fitted) / PARSEC_KM).toBeLessThan(7 * steep.majorPc);
  });
});

describe('the archive', () => {
  it('names the brightest, and finds the Virgo Cluster’s centre', () => {
    expect(archive.named.map((k) => CATALOGUE.name[k])).toEqual(['NGC 253', 'NGC 4945', 'M87']);
    for (const k of archive.named) {
      expect(CATALOGUE.vMag[k]!).toBeLessThanOrEqual(NAMED_V);
    }
    expect(virgoCentre(archive)).toBe(2);
  });

  it('groups them: the Local Volume’s by their group, the field last; the Virgo Cluster’s by its substructures', () => {
    expect(groupLabel('NGC 253', 'local-volume')).toBe('NGC 253 Group');
    expect(groupLabel(null, 'local-volume')).toBe('Field');
    expect(groupLabel('Virgo', 'virgo')).toBe('Outskirts');
    expect(groupLabel("Virgo W'", 'virgo')).toBe("W' Cloud");
    expect(regionOf(CATALOGUE, 2)).toBe('virgo');
    // Groups of fewer than three are listed with the field.
    expect(archive.groups.map((group) => `${group.region}:${group.label}`)).toEqual([
      'local-volume:Others',
      'virgo:Virgo A',
      'virgo:Outskirts',
    ]);
    const many = indexLocalVolume({
      ...CATALOGUE,
      group: ['NGC 253', 'NGC 253', 'Virgo A', 'Virgo', 'NGC 253', null],
    });
    expect(many.groups.map((group) => `${group.region}:${group.label}:${group.members.length}`)).toEqual([
      'local-volume:NGC 253 Group:3',
      'local-volume:Others:1',
      'virgo:Virgo A:1',
      'virgo:Outskirts:1',
    ]);
  });

  it('finds them by name and other names', () => {
    expect(archive.search.display[2]).toBe('m87');
    expect(archive.search.designation[2]).toContain('virgo a');
  });

  it('refuses a file that is not a catalogue', () => {
    expect(() => parseLocalVolumeCatalog({ count: 2, name: ['a'] })).toThrow();
    expect(() => parseLocalVolumeCatalog([])).toThrow();
  });

  it('has every galaxy in the published data where its catalogue puts it', async () => {
    const raw = await readFile(join(import.meta.dirname, '../../public/data/local-volume.json'), 'utf8').catch(() => null);
    if (raw === null) {
      return;
    }
    const catalog = parseLocalVolumeCatalog(JSON.parse(raw));
    const published = indexLocalVolume(catalog);
    for (let k = 0; k < catalog.count; k += 1) {
      const at = galaxyPositionPc(published.galaxies[k]!);
      const d = catalog.distancePc[k]!;
      const off = Math.hypot(at.x - catalog.x[k]!, at.y - catalog.y[k]!, at.z - catalog.z[k]!);
      expect(off / d, catalog.name[k]).toBeLessThan(1e-6);
    }
  });
});
