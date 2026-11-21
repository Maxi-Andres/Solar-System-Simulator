import type { ConstellationCatalog, StarCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { AU_KM, LIGHT_YEAR_KM, NEIGHBOURHOOD_FROM_KM } from '../scene/scale.ts';
import { buildStarAttributes, EQUATORIAL_POLE_IN_SCENE, skyDirection as starSkyDirection } from '../scene/starGeometry.ts';
import {
  boundarySegments,
  constellationFade,
  constellationLabels,
  figureSegmentCount,
  figureSegments,
  FULL_FROM_SUN_KM,
  GONE_FROM_SUN_KM,
  parseConstellations,
  skyDirection,
} from './constellations.ts';

/** Crux, and Serpens in two parts: a catalogue as the build writes one. */
function catalogue(): ConstellationCatalog {
  return {
    sources: { boundaries: 'b', figures: 'f', queriedAt: '2026-11-21T00:00:00Z' },
    credits: [],
    frame: 'ICRS, J2000.0',
    boundaries: [
      [180, -55, 190, -55, 195, -55],
      [195, -55, 195, -64],
    ],
    stars: {
      hip: [60718, 61084, 62434, 59747, 87937],
      ra: [186.6496, 187.7915, 191.9303, 183.7863, 269.4521],
      dec: [-63.0991, -57.1132, -59.6888, -58.7489, 4.6934],
      pmRa: [-35.4, 27.9, -48.2, -36.7, -798.6],
      pmDec: [-14.7, -264.3, -12.8, -10.7, 10328.1],
      mag: [0.77, 1.59, 1.25, 2.79, 9.5],
    },
    constellations: [
      { abbr: 'Cru', labels: [{ name: 'Crux', ra: 187, dec: -60 }], rank: 2, figure: [[0, 1], [2, 3]] },
      {
        abbr: 'Ser',
        labels: [
          { name: 'Serpens Caput', ra: 232.5, dec: 5 },
          { name: 'Serpens Cauda', ra: 280.5, dec: 3 },
        ],
        rank: 3,
        figure: [[4, 0, 2]],
      },
    ],
  };
}

describe('when the constellations are drawn', () => {
  it('fully inside 1,000 AU of the Sun, where no figure star has moved a quarter of a degree', () => {
    expect(constellationFade(0)).toBe(1);
    expect(constellationFade(150 * AU_KM)).toBe(1);
    expect(constellationFade(FULL_FROM_SUN_KM)).toBe(1);
    // Rigil Kentaurus, 1.338 pc: the most the nearest figure star can be off, from there.
    const rigilKmFromSun = 1.338 * 3.0857e13;
    expect(Math.atan(FULL_FROM_SUN_KM / rigilKmFromSun) * (180 / Math.PI)).toBeLessThan(0.25);
  });

  it('fading out to nothing by the Solar Neighbourhood’s edge', () => {
    expect(GONE_FROM_SUN_KM).toBe(NEIGHBOURHOOD_FROM_KM);
    const half = Math.sqrt(FULL_FROM_SUN_KM * GONE_FROM_SUN_KM);
    expect(constellationFade(half)).toBeCloseTo(0.5, 6);
    expect(constellationFade(3_000 * AU_KM)).toBeGreaterThan(constellationFade(6_000 * AU_KM));
    expect(constellationFade(GONE_FROM_SUN_KM)).toBe(0);
    expect(constellationFade(LIGHT_YEAR_KM)).toBe(0);
    expect(constellationFade(1e6 * LIGHT_YEAR_KM)).toBe(0);
  });
});

describe('the lines', () => {
  it('put a J2000 direction in the scene’s ecliptic frame, the celestial pole on the sky’s', () => {
    const pole = skyDirection(0, 90);
    expect(pole.x).toBeCloseTo(EQUATORIAL_POLE_IN_SCENE.x, 12);
    expect(pole.y).toBeCloseTo(EQUATORIAL_POLE_IN_SCENE.y, 12);
    expect(pole.z).toBeCloseTo(EQUATORIAL_POLE_IN_SCENE.z, 12);
  });

  it('end on the stars as the sky draws them, proper motion included', () => {
    const catalog = catalogue();
    const stars = catalog.stars;
    const sky: StarCatalog = {
      sources: [],
      via: '',
      queriedAt: '',
      epoch: 'ICRS, J2000.0',
      magnitudeLimit: 10,
      count: stars.ra.length,
      dropped: { noPosition: 0, noColorIndex: 0 },
      ra: stars.ra,
      dec: stars.dec,
      mag: stars.mag.map((mag) => mag ?? 0),
      bv: stars.ra.map(() => 0.5),
      pmRa: stars.pmRa,
      pmDec: stars.pmDec,
    } as unknown as StarCatalog;
    const attributes = buildStarAttributes(sky);
    // Barnard's Star in Serpens' figure for the test: 10"/yr, half a degree in two centuries.
    for (const years of [0, 200, -1000]) {
      const positions = figureSegments(catalog, years);
      const drawn = starSkyDirection(attributes, 4, years);
      // Serpens' first segment starts at star 4.
      const at = 2 * 6;
      // The angle between them, from their cross product: float32 both, so to a few 1e-8 rad.
      const [x, y, z] = [positions[at]!, positions[at + 1]!, positions[at + 2]!];
      const angle = Math.hypot(y * drawn.z - z * drawn.y, z * drawn.x - x * drawn.z, x * drawn.y - y * drawn.x);
      expect(angle).toBeLessThan(1e-6);
    }
    const moved = figureSegments(catalog, 200);
    const still = figureSegments(catalog, 0);
    const shift = Math.acos(moved[12]! * still[12]! + moved[13]! * still[13]! + moved[14]! * still[14]!);
    expect(shift * (180 / Math.PI) * 3600).toBeCloseTo(200 * Math.hypot(0.7986, 10.3281), -1);
  });

  it('make a segment of each pair of stars a figure joins, and of each pair of boundary points', () => {
    const catalog = catalogue();
    expect(figureSegmentCount(catalog)).toBe(4);
    expect(figureSegments(catalog, 0)).toHaveLength(4 * 6);
    const boundaries = boundarySegments(catalog);
    expect(boundaries).toHaveLength(3 * 6);
    for (let k = 0; k < boundaries.length; k += 3) {
      expect(Math.hypot(boundaries[k]!, boundaries[k + 1]!, boundaries[k + 2]!)).toBeCloseTo(1, 6);
    }
    // A shared corner is one point: the first polyline's end is the second's start.
    expect(Array.from(boundaries.slice(9, 12))).toEqual(Array.from(boundaries.slice(12, 15)));
  });

  it('name Serpens twice, Caput and Cauda', () => {
    expect(constellationLabels(catalogue()).map((label) => [label.name, label.rank])).toEqual([
      ['Crux', 2],
      ['Serpens Caput', 3],
      ['Serpens Cauda', 3],
    ]);
  });
});

describe('the file', () => {
  it('is read as published', () => {
    expect(parseConstellations(JSON.parse(JSON.stringify(catalogue())))).toEqual(catalogue());
  });

  it('is refused when a figure names a star it does not have, or a column is short', () => {
    const bad = catalogue();
    expect(() => parseConstellations({ ...bad, constellations: [{ ...bad.constellations[0]!, figure: [[0, 9]] }] })).toThrow(/Cru/);
    expect(() => parseConstellations({ ...bad, stars: { ...bad.stars, pmDec: [0] } })).toThrow(/pmDec/);
    expect(() => parseConstellations({ boundaries: [] })).toThrow(/not a catalogue/);
  });
});
