import { describe, expect, it } from 'vitest';

import {
  B1875_JD,
  besselianEpochJd,
  boundaryPolylines,
  edgePoints,
  figureStars,
  J2000_JD,
  MATCH_DEG,
  PARALLEL_SAG_DEG,
  parseBoundaries,
  parseFigures,
  parseNames,
  precess,
  separationDeg,
  unmatchedBorders,
  type SkyCandidate,
} from './constellations.ts';

const ARCSEC_DEG = 1 / 3600;

/** Crux and its neighbours' sides of it, as constbnd.dat has them (the first Crux block is its own). */
const CRUX = [
  '11.83333 -55.00000 Cru',
  '12.83333 -55.00000 Cru  Cen',
  '12.83333 -64.00000 Cru  Cen',
  '11.83333 -64.00000 Cru  Mus',
  '11.83333 -55.00000 Cru  Cen',
  // Its neighbours, reduced to the side they share with it.
  '12.83333 -55.00000 Cen',
  '12.83333 -64.00000 Cen  Cru',
  '11.83333 -64.00000 Mus',
  '12.83333 -64.00000 Mus  Cru',
].join('\n');

describe('precession, B1875 to J2000', () => {
  it('puts B1875.0 where the Besselian epoch is', () => {
    expect(besselianEpochJd(1900)).toBeCloseTo(2415020.31352, 5);
    expect(B1875_JD).toBeCloseTo(2405889.25855, 4);
  });

  // The catalogue's own J2000 corners (VI/49 bound_20.dat, the "O" points), against the same
  // corners in B1875 (bound_18.dat) moved here.
  it.each([
    { name: 'Andromeda, 2h31m B1875 +50.5', raHours: 2.51667, dec: 50.5, ra: 39.885479, decJ: 51.0423737 },
    { name: 'Cepheus, 23h +88', raHours: 23, dec: 88, ra: 339.260988, decJ: 88.663887 },
    { name: 'Cepheus, 8h +88', raHours: 8, dec: 88, ra: 135.832471, decJ: 87.5689163 },
    { name: 'Cepheus, 23h +86.16666', raHours: 23, dec: 86.16666, ra: 343.510666, decJ: 86.8368912 },
  ])('lands $name on VI/49 within 0.2"', ({ raHours, dec, ra, decJ }) => {
    const moved = precess(raHours * 15, dec, B1875_JD, J2000_JD);
    expect(separationDeg(moved, { ra, dec: decJ })).toBeLessThan(0.2 * ARCSEC_DEG);
  });

  it('comes back where it started', () => {
    const there = precess(123.4, -56.7, B1875_JD, J2000_JD);
    const back = precess(there.ra, there.dec, J2000_JD, B1875_JD);
    expect(separationDeg(back, { ra: 123.4, dec: -56.7 })).toBeLessThan(1e-3 * ARCSEC_DEG);
  });

  it('moves the equinox by 125 years of general precession, 1.74 degrees along the ecliptic', () => {
    // The equinox slides west 50.3"/yr, so the B1875 one is that times 125 years east of J2000's.
    const moved = precess(0, 0, B1875_JD, J2000_JD);
    const longitude = Math.atan2(
      Math.sin((moved.ra * Math.PI) / 180) * Math.cos((23.4393 * Math.PI) / 180) +
        Math.tan((moved.dec * Math.PI) / 180) * Math.sin((23.4393 * Math.PI) / 180),
      Math.cos((moved.ra * Math.PI) / 180),
    );
    expect(((longitude * 180) / Math.PI + 360) % 360).toBeCloseTo(1.7457, 3);
  });
});

describe('the boundary file', () => {
  it('reads each constellation as a polygon whose first point has no neighbour', () => {
    const [crux, cen, mus] = parseBoundaries(CRUX);
    expect(crux).toHaveLength(5);
    expect(cen).toHaveLength(2);
    expect(mus![1]!.outside).toBe('Cru');
    expect(crux![0]).toEqual({ raHours: 11.83333, dec: -55, inside: 'Cru', outside: null });
    expect(crux![3]!.outside).toBe('Mus');
  });

  it('spells a neighbour as it spells itself', () => {
    const text = ['01.00000 -40.00000 Phe', '02.00000 -40.00000 Phe  Eri', '', '02.00000 -40.00000 Eri', '01.00000 -40.00000 Eri  PHE'].join('\n');
    const polygons = parseBoundaries(text);
    expect(polygons[1]![1]!.outside).toBe('Phe');
    expect(unmatchedBorders(polygons)).toEqual([]);
  });

  it('refuses a neighbour with no border of its own, and a line that is not a point', () => {
    expect(() => parseBoundaries('01.00000 -40.00000 Phe\n02.00000 -40.00000 Phe  Xyz')).toThrow(/Xyz/);
    expect(() => parseBoundaries('<html>')).toThrow(/not a boundary point/);
  });

  it('finds a border listed from one side only', () => {
    expect(unmatchedBorders(parseBoundaries(CRUX))).toEqual([]);
    const lopsided = [
      '01.00000 +00.00000 Aaa',
      '02.00000 +00.00000 Aaa  Bbb',
      '01.00000 +00.00000 Bbb',
      '02.00000 +00.00000 Bbb  Ccc',
      '01.00000 +00.00000 Ccc',
      '02.00000 +00.00000 Ccc  Bbb',
    ].join('\n');
    expect(unmatchedBorders(parseBoundaries(lopsided))).toEqual(['Aaa|Bbb']);
  });
});

describe('boundary edges', () => {
  it('takes a meridian by its two ends: precession keeps a great circle one', () => {
    expect(edgePoints({ ra: 30, dec: 10 }, { ra: 30, dec: 40 })).toEqual([{ ra: 30, dec: 40 }]);
  });

  it('samples a parallel so that no chord strays more than the allowed sag', () => {
    const from = { ra: 350, dec: 80 };
    const to = { ra: 20, dec: 80 };
    const points = [from, ...edgePoints(from, to)];
    // The short way, through 0h.
    expect(points.every((p) => p.ra >= 350 || p.ra <= 20)).toBe(true);
    expect(points.at(-1)).toEqual({ ra: 20, dec: 80 });
    for (let k = 1; k < points.length; k += 1) {
      const a = points[k - 1]!;
      const b = points[k]!;
      // The chord's midpoint against the arc's, as seen from the sphere's centre.
      const unit = (p: { ra: number; dec: number }) => {
        const r = Math.PI / 180;
        return [Math.cos(p.dec * r) * Math.cos(p.ra * r), Math.cos(p.dec * r) * Math.sin(p.ra * r), Math.sin(p.dec * r)];
      };
      const [ua, ub] = [unit(a), unit(b)];
      const mid = ua.map((v, i) => (v + ub[i]!) / 2);
      const midRa = (Math.atan2(mid[1]!, mid[0]!) * 180) / Math.PI;
      const midDec = (Math.atan2(mid[2]!, Math.hypot(mid[0]!, mid[1]!)) * 180) / Math.PI;
      const arcMid = { ra: a.ra + ((((b.ra - a.ra + 540) % 360) - 180) / 2), dec: 80 };
      expect(separationDeg({ ra: midRa, dec: midDec }, arcMid)).toBeLessThan(PARALLEL_SAG_DEG * 1.05);
    }
  });

  it('refuses an edge along neither', () => {
    expect(() => edgePoints({ ra: 10, dec: 10 }, { ra: 20, dec: 20 })).toThrow(/neither/);
  });

  it('draws every border once, whichever side lists it', () => {
    // Two squares side by side, each listing the border they share.
    const text = [
      '01.00000 +00.00000 Aaa',
      '02.00000 +00.00000 Aaa  Out',
      '02.00000 +10.00000 Aaa  Bbb',
      '01.00000 +10.00000 Aaa  Out',
      '01.00000 +00.00000 Aaa  Out',
      '02.00000 +00.00000 Bbb',
      '03.00000 +00.00000 Bbb  Out',
      '03.00000 +10.00000 Bbb  Out',
      '02.00000 +10.00000 Bbb  Out',
      '02.00000 +00.00000 Bbb  Aaa',
      '01.00000 +00.00000 Out',
      '01.00000 +10.00000 Out  Aaa',
    ].join('\n');
    const lines = boundaryPolylines(parseBoundaries(text));
    // Each segment drawn, as its two ends.
    const segments = lines.flatMap((line) =>
      Array.from({ length: line.length / 2 - 1 }, (_, k) => [
        { ra: line[2 * k]!, dec: line[2 * k + 1]! },
        { ra: line[2 * k + 2]!, dec: line[2 * k + 3]! },
      ]),
    );
    const near = (a: { ra: number; dec: number }, b: { ra: number; dec: number }) => separationDeg(a, b) < 1e-3;
    const count = (from: { ra: number; dec: number }, to: { ra: number; dec: number }) => {
      const a = precess(from.ra, from.dec, B1875_JD, J2000_JD);
      const b = precess(to.ra, to.dec, B1875_JD, J2000_JD);
      return segments.filter(([p, q]) => (near(p!, a) && near(q!, b)) || (near(p!, b) && near(q!, a))).length;
    };
    // The border Aaa and Bbb share, listed by both: drawn once, from Aaa's side.
    expect(count({ ra: 30, dec: 0 }, { ra: 30, dec: 10 })).toBe(1);
    // Aaa's west side, listed by Aaa and by Out: once.
    expect(count({ ra: 15, dec: 10 }, { ra: 15, dec: 0 })).toBe(1);
    // Bbb's east side, listed by Bbb only: once.
    expect(count({ ra: 45, dec: 0 }, { ra: 45, dec: 10 })).toBe(1);
  });
});

describe('the figures', () => {
  const figures = {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', id: 'Cru', properties: { rank: '2' }, geometry: { type: 'MultiLineString', coordinates: [[[-173.39, -63.099], [-172.096, -57.113]], [[-168.04, -59.689], [-176.098, -58.749]]] } },
    ],
  };
  const names = {
    type: 'FeatureCollection',
    features: [{ type: 'Feature', id: 'Cru', properties: { name: 'Crux', rank: '2' }, geometry: { type: 'Point', coordinates: [-173, -60] } }],
  };

  it('reads GeoJSON longitudes as right ascension from 0 to 360', () => {
    const [crux] = parseFigures(figures);
    expect(crux!.abbr).toBe('Cru');
    expect(crux!.lines).toHaveLength(2);
    expect(crux!.lines[0]![0]!.ra).toBeCloseTo(186.61, 6);
    expect(parseNames(names)).toEqual([{ abbr: 'Cru', name: 'Crux', rank: 2, ra: 187, dec: -60 }]);
  });

  it('refuses what is not a feature collection of figures', () => {
    expect(() => parseFigures({ type: 'Feature' })).toThrow(/feature collection/);
    expect(() => parseFigures({ type: 'FeatureCollection', features: [{ id: 'Cru', geometry: { type: 'Point' } }] })).toThrow(/not a figure/);
  });

  // Acrux, Gacrux, Mimosa, Imai -- and Acrux's companion a few arcseconds off, fainter.
  const sky: SkyCandidate[] = [
    { raDeg: 186.6496, decDeg: -63.0991, vMag: 0.77, pmRaMasPerYear: -35.4, pmDecMasPerYear: -14.7, hip: 60718 },
    { raDeg: 186.6510, decDeg: -63.0980, vMag: 4.9, pmRaMasPerYear: 0, pmDecMasPerYear: 0, hip: 99999 },
    { raDeg: 187.7915, decDeg: -57.1132, vMag: 1.59, pmRaMasPerYear: 27.9, pmDecMasPerYear: -264.3, hip: 61084 },
    { raDeg: 191.9303, decDeg: -59.6888, vMag: 1.25, pmRaMasPerYear: -48.2, pmDecMasPerYear: -12.8, hip: 62434 },
    { raDeg: 183.7863, decDeg: -58.7489, vMag: 2.79, pmRaMasPerYear: -36.7, pmDecMasPerYear: -10.7, hip: 59747 },
  ];

  it('joins each vertex to the catalogue star there, each star once, by its HIP number', () => {
    const resolver = figureStars(sky);
    const first = resolver.vertex('Cru', { ra: 186.6496, dec: -63.0991 });
    const again = resolver.vertex('Cru', { ra: 186.64961, dec: -63.09912 });
    const mimosa = resolver.vertex('Cru', { ra: 191.9303, dec: -59.6889 });
    expect(again).toBe(first);
    expect(resolver.stars.hip).toEqual([60718, 62434]);
    expect(resolver.stars.ra[mimosa]).toBe(191.9303);
    expect(resolver.stars.pmDec[mimosa]).toBe(-12.8);
    expect(resolver.unmatched).toEqual([]);
    expect(resolver.worstMatchDeg()).toBeLessThan(1e-3);
  });

  it('keeps a vertex with no star within reach where the figure put it, and says so', () => {
    const resolver = figureStars(sky);
    const index = resolver.vertex('Cru', { ra: 190, dec: -60 + 2 * MATCH_DEG });
    expect(resolver.stars.hip[index]).toBeNull();
    expect(resolver.stars.ra[index]).toBe(190);
    expect(resolver.unmatched).toHaveLength(1);
  });

  it('finds a star across 0h and near the pole', () => {
    const polar: SkyCandidate[] = [
      { raDeg: 359.999, decDeg: 10, vMag: 3, pmRaMasPerYear: 0, pmDecMasPerYear: 0, hip: 1 },
      { raDeg: 37.95, decDeg: 89.2641, vMag: 2, pmRaMasPerYear: 44, pmDecMasPerYear: -11.7, hip: 11767 },
    ];
    const resolver = figureStars(polar);
    resolver.vertex('Psc', { ra: 0.001, dec: 10 });
    resolver.vertex('UMi', { ra: 37.9, dec: 89.2641 });
    expect(resolver.stars.hip).toEqual([1, 11767]);
  });
});
