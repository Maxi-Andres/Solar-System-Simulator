import { LANIAKEA_FLAGS, LANIAKEA_RECORD_FLOATS, type LaniakeaInfo, type LaniakeaLandmark } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import {
  basinAt,
  distanceEstimated,
  distanceSource,
  FIELD,
  indexGroups,
  indexLaniakea,
  indexNames,
  invert4,
  laniakeaGalaxy,
  methodNames,
  parseBasins,
  parseDetails,
  parseGalaxyRecords,
  parseLaniakeaInfo,
  skyOf,
  structureFramingKm,
  structureRadiusPc,
  transformPoint,
} from './laniakea.ts';
import { galaxyHalfLightPc, galaxyLuminosity, galaxyPositionPc } from './localGroup.ts';
import { PARSEC_KM } from './stars3d.ts';
import { recordHalfLightPc } from '../scene/Laniakea.tsx';

/** A record: position, absolute V, B-V, half-light radius, axis ratio, PA, inclination, T, flags, group. */
function record(p: [number, number, number], fields: Partial<Record<keyof typeof FIELD, number>> = {}): number[] {
  const r = new Array<number>(LANIAKEA_RECORD_FLOATS).fill(Number.NaN);
  r[FIELD.x] = p[0];
  r[FIELD.y] = p[1];
  r[FIELD.z] = p[2];
  r[FIELD.flags] = 0;
  r[FIELD.group] = -1;
  for (const [key, value] of Object.entries(fields)) r[FIELD[key as keyof typeof FIELD]] = value!;
  return r;
}

const GRID = { size: [4, 4, 4] as [number, number, number], voxelPc: 10e6 };
// Voxels 10 Mpc, turned 90 degrees about z, the grid's corner at (-20, -20, -20) Mpc.
const VOXEL_TO_SCENE = [0, 10e6, 0, 0, -10e6, 0, 0, 0, 0, 0, 10e6, 0, 20e6, -20e6, -20e6, 1];

function info(count: number, landmarks: LaniakeaLandmark[] = []): LaniakeaInfo {
  return {
    galaxies: { count, recordFloats: LANIAKEA_RECORD_FLOATS, details: { file: 'details.bin', bytes: count * 29 } },
    groups: { count: 3 },
    landmarks,
    basins: {
      ...GRID,
      offset: [0, 0, 0],
      cubeVoxels: 4,
      voxelToScene: VOXEL_TO_SCENE,
      grids: ['galaxiesAttraction', 'galaxiesRepulsion', 'groupsAttraction'],
      home: { galaxiesAttraction: 1, galaxiesRepulsion: 0, groupsAttraction: 4 },
      basins: [
        { name: 'Laniakea', kind: 'attraction', grid: 'galaxiesAttraction', label: 1, voxels: 1, volumeMpc3: 1, paperVolumeMpcH3: 1 },
        { name: 'Shapley', kind: 'attraction', grid: 'groupsAttraction', label: 4, voxels: 1, volumeMpc3: 1, paperVolumeMpcH3: 1 },
      ],
    },
  } as unknown as LaniakeaInfo;
}

describe('the Laniakea catalogue, read', () => {
  it('takes laniakea.json only with the record it reads, and galaxies.bin only of its size', () => {
    expect(() => parseLaniakeaInfo({ galaxies: { recordFloats: 11, count: 1 }, landmarks: [], basins: {} })).toThrow();
    expect(parseLaniakeaInfo(info(2)).galaxies.count).toBe(2);
    expect(() => parseGalaxyRecords(new ArrayBuffer(10), 1)).toThrow();
    expect(parseGalaxyRecords(new ArrayBuffer(2 * 12 * 4), 2).length).toBe(24);
  });

  it('reads the details’ columns, little-endian, one after another', () => {
    const count = 2;
    const buffer = new ArrayBuffer(count * 29);
    const view = new DataView(buffer);
    view.setUint32(4, 44715, true);
    view.setFloat32(count * 4 * 1 + 4, 0.0231, true);
    view.setFloat32(count * 4 * 5, 12.5, true);
    new Uint8Array(buffer)[count * 4 * 7 + 1] = 2 | 4;
    const d = parseDetails(buffer, count);
    expect(d.pgc[1]).toBe(44715);
    expect(d.redshift[1]).toBeCloseTo(0.0231, 6);
    expect(d.vMag[0]).toBe(12.5);
    expect(methodNames(d.methods[1]!)).toEqual(['TF', 'FP']);
    expect(() => parseDetails(new ArrayBuffer(10), 1)).toThrow();
  });

  it('finds a basin’s label at a place, through the grid’s matrix both ways', () => {
    const labels = new Uint8Array(64 * 3);
    // galaxiesAttraction label 1 at voxel (2, 1, 3); groupsAttraction label 4 there too.
    labels[2 + 4 * (1 + 4 * 3)] = 1;
    labels[128 + 2 + 4 * (1 + 4 * 3)] = 4;
    const basins = parseBasins(labels.buffer, info(0));
    const at = transformPoint(VOXEL_TO_SCENE, [2, 1, 3]);
    expect(at).toEqual([10e6, 0, 10e6]);
    expect(transformPoint(invert4(VOXEL_TO_SCENE), at).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([2, 1, 3]);
    expect(basinAt(basins, 'galaxiesAttraction', [10e6 + 3e6, -4e6, 10e6])).toBe(1);
    expect(basinAt(basins, 'groupsAttraction', at)).toBe(4);
    expect(basinAt(basins, 'galaxiesAttraction', [0, 0, 0])).toBe(0);
    expect(basinAt(basins, 'galaxiesAttraction', [1e9, 0, 0])).toBe(0);
    expect(() => parseBasins(new ArrayBuffer(5), info(0))).toThrow();
  });

  it('makes each group’s brightest -- the first met, the records most luminous first -- its host, its radius held between bounds', () => {
    const records = new Float32Array([
      ...record([0, 0, 0], { group: 0 }),
      ...record([5e6, 0, 0], { group: 1 }),
      ...record([1e5, 0, 0], { group: 0 }),
      ...record([5e6, 4e6, 0], { group: 1 }),
      ...record([9e6, 0, 0]),
    ]);
    const groups = indexGroups(records, 5, 3);
    expect([...groups.brightest]).toEqual([0, 1, -1]);
    expect([...groups.members]).toEqual([2, 2, 0]);
    // 100 kpc from its brightest: held at the least, 150 kpc; 4 Mpc: at the most, 3 Mpc.
    expect(groups.radius[0]).toBe(150_000);
    expect(groups.radius[1]).toBe(3_000_000);
  });

  it('turns a place in the scene frame back into its RA, Dec and distance', () => {
    // The scene frame is ICRS turned about x by the obliquity: the vernal equinox stays put.
    expect(skyOf([1e8, 0, 0])).toEqual({ raDeg: 0, decDeg: 0, distancePc: 1e8 });
    const eps = (84381.448 / 3600) * (Math.PI / 180);
    const north = skyOf([0, Math.sin(eps) * 5e7, Math.cos(eps) * 5e7]);
    expect(north.decDeg).toBeCloseTo(90, 9);
    expect(north.distancePc).toBeCloseTo(5e7, 3);
  });

  it('makes a record a galaxy at its own place, of its own light, its shape by its type', () => {
    const p: [number, number, number] = [-3.1e7, 6.4e7, 2.2e7];
    const c = {
      records: new Float32Array([
        ...record(p, { absV: -22, bv: 0.95, rePc: 8000, q: 0.7, pa: 30, t: -5, flags: LANIAKEA_FLAGS.DISTANCE_GROUP }),
        ...record(p, { absV: -21, rePc: 6000, q: 0.3, pa: 120, incl: 75, t: 4, flags: LANIAKEA_FLAGS.DISTANCE_REDSHIFT }),
        ...record(p, { absV: -16, rePc: 1500, t: 10 }),
      ]),
    };
    const elliptical = laniakeaGalaxy(c, 0, 'NGC 1', ['PGC 1']);
    expect(elliptical.key).toBe('lk-0');
    expect(elliptical.laniakeaIndex).toBe(0);
    const at = galaxyPositionPc(elliptical);
    expect(Math.hypot(at.x - p[0], at.y - p[1], at.z - p[2])).toBeLessThan(1);
    // M_V -22: 10^(0.4 (4.81 + 22)) L_Sun, wherever it is placed.
    expect(galaxyLuminosity(elliptical)! / 10 ** (0.4 * 26.81)).toBeCloseTo(1, 6);
    expect(elliptical.model?.kind).toBe('sersic');
    expect(elliptical.colourIndex).toBeCloseTo(0.95, 6);
    expect(elliptical.distanceSource).toBe('its group’s, Cosmicflows-4');
    const disc = laniakeaGalaxy(c, 1);
    expect(disc.model?.kind).toBe('disc');
    expect(disc.model?.kind === 'disc' && disc.model.inclinationDeg).toBe(75);
    expect(disc.distanceSource).toBe('its redshift, estimated');
    expect(laniakeaGalaxy(c, 2).model?.kind).toBe('plummer');
    // The points' half-light radius is the model's, so point and volume hand over at one size.
    for (const k of [0, 1, 2]) {
      expect(recordHalfLightPc(c.records, k)).toBeCloseTo(galaxyHalfLightPc(laniakeaGalaxy(c, k))!, 3);
    }
  });

  it('says how each distance was had, and that a redshift’s is an estimate', () => {
    expect(distanceSource(LANIAKEA_FLAGS.DISTANCE_OWN)).toBe('Cosmicflows-4');
    expect(distanceSource(LANIAKEA_FLAGS.DISTANCE_LINKED)).toBe('its 2MASS group’s, Cosmicflows-4');
    expect(distanceSource(LANIAKEA_FLAGS.DISTANCE_REDSHIFT | LANIAKEA_FLAGS.GROUP_REDSHIFT)).toBe('its group’s redshift, estimated');
    expect(distanceEstimated(LANIAKEA_FLAGS.DISTANCE_REDSHIFT)).toBe(true);
    expect(distanceEstimated(LANIAKEA_FLAGS.DISTANCE_OWN)).toBe(false);
  });

  it('searches names and other names, typed whole', () => {
    const index = indexNames({ count: 2, name: ['NGC 4884', 'ESO 383-76'], otherNames: [[0, ['PGC 44715', 'NGC 4889']]] });
    expect(index.search.display).toEqual(['ngc 4884', 'eso 383 76']);
    expect(index.search.designation[0]).toContain('ngc 4889');
    expect(() => indexNames({ count: 3, name: ['a'], otherNames: [] })).toThrow();
  });

  it('indexes the named clusters by their groups, and frames a structure on its radius', () => {
    const coma = { name: 'Coma Cluster', kind: 'cluster', group: 2, radiusPc: 2.9e6, extentPc: null } as unknown as LaniakeaLandmark;
    const local = { name: 'Local Void', kind: 'void', group: -1, radiusPc: null, extentPc: [70e6, 40e6, 60e6] } as unknown as LaniakeaLandmark;
    const c = indexLaniakea(info(1, [coma, local]), new Float32Array(record([0, 0, 0])), null);
    expect(c.groupLandmark.get(2)).toBe(0);
    expect(structureRadiusPc(local)).toBe(35e6);
    expect(structureFramingKm(coma) / PARSEC_KM).toBeCloseTo(14.5e6, -3);
  });
});
