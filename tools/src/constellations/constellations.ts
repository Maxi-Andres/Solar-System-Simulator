import type { ConstellationCatalog } from '../types.ts';

/**
 * The IAU's 88 constellations, as seen from the Solar System: their boundaries, their names
 * and their figures, built into constellations.json.
 *
 * ## The boundaries are the IAU's
 *
 * Delporte drew them for the IAU in 1930 (Délimitation scientifique des constellations), and
 * they are the only part of a constellation that is official: since then every point of the
 * sky is in exactly one of 88. He drew them along arcs of constant right ascension and
 * declination -- of the equator and equinox of B1875, so that no star catalogued then would
 * change constellation. Read here from Davenhall & Leggett's machine-readable copy (CDS
 * VI/49), the file Bill J. Gray prepared from it in 2007 (constbnd.dat), which names the
 * constellation on each border's far side: every border is in it twice, once from each side,
 * and is drawn once.
 *
 * Moved to J2000 here, not taken from the catalogue's own J2000 file: a B1875 meridian is a
 * great circle, and stays one under precession -- a rotation -- so it needs its two ends only;
 * a B1875 parallel is a small circle about the old pole, which precession tilts, so it is
 * sampled finely enough that its chords stay within PARALLEL_SAG_DEG of it. The precession is
 * the IAU 1976 one (Lieske et al. 1977), from B1875.0 to J2000.0. The difference between FK4's
 * B1875 frame and the precessed FK5 one -- the E-terms of aberration, the equinox offset --
 * is under an arcsecond, and left out; so is the J2000 equator's from the ICRS, 0.02".
 *
 * ## The figures are a convention
 *
 * No standard joins the stars: the lines are a tradition, drawn differently by every atlas.
 * These are d3-celestial's (Olaf Frohn, BSD 3-Clause), drawn after the IAU's own charts,
 * which the IAU made with Sky & Telescope. Its file gives each vertex as a position; each is
 * found here among the app's own sky stars (stars.json's), the nearest within MATCH_DEG, and
 * written as that star -- its Hipparcos number, its position and proper motion -- so a line
 * ends exactly on the star drawn, and moves with it over the centuries.
 *
 * Names are written at d3-celestial's points for them, chosen by hand to fall inside the
 * figure and clear of its brightest stars.
 */

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;

/** A figure's vertex is the catalogue star nearest it within this, degrees: 36". */
export const MATCH_DEG = 0.01;

/** How far a parallel's chords may stray from the arc they stand for, degrees: 18". */
export const PARALLEL_SAG_DEG = 0.005;

/** The longest step along a parallel, degrees of arc, however gently it curves. */
export const PARALLEL_MAX_STEP_DEG = 2;

/** Positions are written to this many decimals of a degree: 0.36". */
const DECIMALS = 4;

/** The Julian day of Besselian epoch `year`: B1875.0 is JD 2405889.2586. */
export function besselianEpochJd(year: number): number {
  return 2415020.31352 + (year - 1900) * 365.242198781;
}

export const B1875_JD = besselianEpochJd(1875);
export const J2000_JD = 2451545.0;

/**
 * Moves a mean equatorial position from the equinox of `fromJd` to that of `toJd`, by the IAU
 * 1976 precession (Lieske et al. 1977, A&A 58, 1; as Meeus, Astronomical Algorithms, ch. 21,
 * gives it). Degrees in and out; right ascension in [0, 360).
 */
export function precess(raDeg: number, decDeg: number, fromJd: number, toJd: number): { ra: number; dec: number } {
  const T = (fromJd - J2000_JD) / 36525;
  const t = (toJd - fromJd) / 36525;
  const zeta =
    (2306.2181 + 1.39656 * T - 0.000139 * T * T) * t + (0.30188 - 0.000344 * T) * t * t + 0.017998 * t ** 3;
  const z = (2306.2181 + 1.39656 * T - 0.000139 * T * T) * t + (1.09468 + 0.000066 * T) * t * t + 0.018203 * t ** 3;
  const theta =
    (2004.3109 - 0.8533 * T - 0.000217 * T * T) * t - (0.42665 + 0.000217 * T) * t * t - 0.041833 * t ** 3;
  const a0 = raDeg * DEG + zeta * ARCSEC;
  const d0 = decDeg * DEG;
  const th = theta * ARCSEC;
  const A = Math.cos(d0) * Math.sin(a0);
  const B = Math.cos(th) * Math.cos(d0) * Math.cos(a0) - Math.sin(th) * Math.sin(d0);
  const C = Math.sin(th) * Math.cos(d0) * Math.cos(a0) + Math.cos(th) * Math.sin(d0);
  const ra = (Math.atan2(A, B) / DEG + z / 3600 + 720) % 360;
  return { ra, dec: Math.asin(Math.max(-1, Math.min(1, C))) / DEG };
}

/** One point of constbnd.dat: B1875 right ascension in hours, declination in degrees. */
export interface BoundaryPoint {
  readonly raHours: number;
  readonly dec: number;
  /** The constellation it bounds ("Ser1" and "Ser2" for Serpens' two parts). */
  readonly inside: string;
  /** The one across the border that ends here; null at a polygon's first point. */
  readonly outside: string | null;
}

/** constbnd.dat (VI/49), one polygon per constellation, Serpens two: its points in order. */
export function parseBoundaries(text: string): BoundaryPoint[][] {
  const polygons: BoundaryPoint[][] = [];
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const raHours = Number(line.slice(0, 8));
    const dec = Number(line.slice(9, 18));
    const inside = line.slice(19, 23).trim();
    const outside = line.slice(24, 28).trim();
    if (!Number.isFinite(raHours) || !Number.isFinite(dec) || inside === '' || raHours < 0 || raHours > 24 || Math.abs(dec) > 90) {
      throw new Error(`constbnd.dat: a line that is not a boundary point: "${line}"`);
    }
    if (outside === '') {
      polygons.push([]);
    } else if (polygons.length === 0 || polygons.at(-1)!.at(0)?.inside !== inside) {
      throw new Error(`constbnd.dat: ${inside}'s border does not start at a first point`);
    }
    polygons.at(-1)!.push({ raHours, dec, inside, outside: outside === '' ? null : outside });
  }
  // The neighbours as each constellation spells itself: the file has "PHE" once for "Phe".
  const spelled = new Map(polygons.map((polygon) => [polygon[0]!.inside.toLowerCase(), polygon[0]!.inside]));
  return polygons.map((polygon) =>
    polygon.map((point) => {
      if (point.outside === null) return point;
      const outside = spelled.get(point.outside.toLowerCase());
      if (outside === undefined) {
        throw new Error(`constbnd.dat: ${point.inside} borders "${point.outside}", which has no border of its own`);
      }
      return { ...point, outside };
    }),
  );
}

/** Right ascension from `from` to `to`, degrees, the short way round: in (-180, 180]. */
function raStep(from: number, to: number): number {
  let step = (to - from) % 360;
  if (step > 180) step -= 360;
  if (step <= -180) step += 360;
  return step;
}

/**
 * A border from one corner to the next, in B1875 degrees, as points to precess: its two ends
 * where it runs along a meridian -- a great circle -- and along a parallel enough between them
 * that no chord strays more than PARALLEL_SAG_DEG from the arc. The first point is left out,
 * so consecutive edges join without repeating their corner.
 */
export function edgePoints(from: { ra: number; dec: number }, to: { ra: number; dec: number }): { ra: number; dec: number }[] {
  const dRa = raStep(from.ra, to.ra);
  if (Math.abs(dRa) < 1e-9 || Math.abs(from.dec - to.dec) > 1e-9) {
    // A meridian; or a slanted edge, which the data does not have, taken as a great circle.
    if (Math.abs(dRa) > 1e-9 && Math.abs(from.dec - to.dec) > 1e-9) {
      throw new Error(`a boundary edge along neither a meridian nor a parallel: ${JSON.stringify([from, to])}`);
    }
    return [{ ra: to.ra, dec: to.dec }];
  }
  if (Math.abs(dRa) >= 180) {
    throw new Error(`a boundary edge along a parallel half way round the sky or more: ${JSON.stringify([from, to])}`);
  }
  // A small circle of angular radius 90 - |dec|: a chord of arc L sags by about tan|dec| L^2 / 8.
  const cosDec = Math.cos(from.dec * DEG);
  const tanDec = Math.abs(Math.tan(from.dec * DEG));
  const arcDeg = Math.abs(dRa) * cosDec;
  const maxStepDeg = Math.min(PARALLEL_MAX_STEP_DEG, tanDec < 1e-9 ? Infinity : Math.sqrt((8 * PARALLEL_SAG_DEG * DEG) / tanDec) / DEG);
  const steps = Math.max(1, Math.ceil(arcDeg / maxStepDeg));
  const points: { ra: number; dec: number }[] = [];
  for (let k = 1; k <= steps; k += 1) {
    points.push({ ra: (from.ra + (dRa * k) / steps + 360) % 360, dec: from.dec });
  }
  return points;
}

const round = (value: number): number => Number(value.toFixed(DECIMALS));

/**
 * Every border once, as J2000 polylines, flat [ra, dec, ...]: of each pair of constellations
 * the border is taken from the side whose name sorts first, and a constellation's consecutive
 * borders so taken are one polyline. Each side lists the whole of what the two share, so
 * taking one side draws it all, once.
 */
export function boundaryPolylines(polygons: readonly (readonly BoundaryPoint[])[]): number[][] {
  const lines: number[][] = [];
  for (const polygon of polygons) {
    let current: number[] | null = null;
    for (let i = 1; i < polygon.length; i += 1) {
      const a = polygon[i - 1]!;
      const b = polygon[i]!;
      if (b.outside === null || !(a.inside < b.outside)) {
        current = null;
        continue;
      }
      const from = { ra: a.raHours * 15, dec: a.dec };
      if (current === null) {
        const start = precess(from.ra, from.dec, B1875_JD, J2000_JD);
        current = [round(start.ra), round(start.dec)];
        lines.push(current);
      }
      for (const point of edgePoints(from, { ra: b.raHours * 15, dec: b.dec })) {
        const moved = precess(point.ra, point.dec, B1875_JD, J2000_JD);
        current.push(round(moved.ra), round(moved.dec));
      }
    }
  }
  return lines;
}

/** Checks every border is listed from both sides: a neighbour each constellation names names it back. */
export function unmatchedBorders(polygons: readonly (readonly BoundaryPoint[])[]): string[] {
  const pairs = new Set<string>();
  for (const polygon of polygons) {
    for (const point of polygon) {
      if (point.outside !== null) pairs.add(`${point.inside}|${point.outside}`);
    }
  }
  return [...pairs].filter((pair) => {
    const [inside, outside] = pair.split('|');
    return !pairs.has(`${outside}|${inside}`);
  });
}

/** d3-celestial's figure of one constellation: polylines of J2000 positions, degrees. */
export interface FigureSource {
  readonly abbr: string;
  readonly lines: readonly (readonly { ra: number; dec: number }[])[];
}

/** d3-celestial's name of one constellation, or one part of one, and its point. */
export interface NameSource {
  readonly abbr: string;
  readonly name: string;
  readonly rank: number;
  readonly ra: number;
  readonly dec: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A GeoJSON feature collection's features; throws on anything else. */
function features(raw: unknown, label: string): Record<string, unknown>[] {
  if (!isRecord(raw) || raw['type'] !== 'FeatureCollection' || !Array.isArray(raw['features'])) {
    throw new Error(`${label} is not a GeoJSON feature collection`);
  }
  return raw['features'].filter(isRecord);
}

/** A GeoJSON longitude, -180 to 180, as right ascension, 0 to 360. */
function raOf(longitude: number): number {
  return ((longitude % 360) + 360) % 360;
}

function position(value: unknown, label: string): { ra: number; dec: number } {
  if (!Array.isArray(value) || typeof value[0] !== 'number' || typeof value[1] !== 'number' || Math.abs(value[1]) > 90) {
    throw new Error(`${label}: not a position: ${JSON.stringify(value)}`);
  }
  return { ra: raOf(value[0]), dec: value[1] };
}

/** constellations.lines.json: a MultiLineString per feature, Serpens' two parts two features. */
export function parseFigures(raw: unknown): FigureSource[] {
  return features(raw, 'constellations.lines.json').map((feature) => {
    const abbr = feature['id'];
    const geometry = feature['geometry'];
    if (typeof abbr !== 'string' || !isRecord(geometry) || geometry['type'] !== 'MultiLineString' || !Array.isArray(geometry['coordinates'])) {
      throw new Error(`constellations.lines.json: a feature that is not a figure: ${JSON.stringify(feature).slice(0, 200)}`);
    }
    return {
      abbr,
      lines: geometry['coordinates'].map((line: unknown) => {
        if (!Array.isArray(line) || line.length < 2) throw new Error(`${abbr}: a line of fewer than two stars`);
        return line.map((point: unknown) => position(point, abbr));
      }),
    };
  });
}

/** constellations.json: a point per name, its IAU name and d3-celestial's rank. */
export function parseNames(raw: unknown): NameSource[] {
  return features(raw, 'constellations.json').map((feature) => {
    const abbr = feature['id'];
    const properties = feature['properties'];
    const geometry = feature['geometry'];
    if (typeof abbr !== 'string' || !isRecord(properties) || typeof properties['name'] !== 'string' || !isRecord(geometry)) {
      throw new Error(`constellations.json: a feature that is not a name: ${JSON.stringify(feature).slice(0, 200)}`);
    }
    const rank = Number(properties['rank']);
    return {
      abbr,
      name: properties['name'],
      rank: Number.isInteger(rank) && rank >= 1 && rank <= 3 ? rank : 3,
      ...position(geometry['coordinates'], abbr),
    };
  });
}

/** A star of the app's sky, as the figures are matched against: stars.json's, with its identity. */
export interface SkyCandidate {
  readonly raDeg: number;
  readonly decDeg: number;
  readonly vMag: number;
  readonly pmRaMasPerYear: number;
  readonly pmDecMasPerYear: number;
  readonly hip: number | null;
}

function unit(ra: number, dec: number): [number, number, number] {
  const c = Math.cos(dec * DEG);
  return [c * Math.cos(ra * DEG), c * Math.sin(ra * DEG), Math.sin(dec * DEG)];
}

/** Angle between two positions, degrees. */
export function separationDeg(a: { ra: number; dec: number }, b: { ra: number; dec: number }): number {
  const u = unit(a.ra, a.dec);
  const v = unit(b.ra, b.dec);
  const cross = Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]);
  return Math.atan2(cross, u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / DEG;
}

/**
 * The sky stars by one-degree cell, to find the one nearest a position: `nearest` returns
 * its index within `radiusDeg`, or -1.
 */
export function skyIndex(stars: readonly SkyCandidate[]): (at: { ra: number; dec: number }, radiusDeg: number) => number {
  const cells = new Map<string, number[]>();
  const cellOf = (ra: number, dec: number) => `${Math.floor(ra) % 360}:${Math.floor(dec)}`;
  stars.forEach((star, k) => {
    const key = cellOf(star.raDeg, star.decDeg);
    const list = cells.get(key);
    if (list === undefined) cells.set(key, [k]);
    else list.push(k);
  });
  return (at, radiusDeg) => {
    let best = -1;
    let bestDeg = radiusDeg;
    // Near a pole a degree of right ascension is a sliver: look all the way round there.
    const raCells = Math.abs(at.dec) > 85 ? 180 : 1;
    for (let dDec = -1; dDec <= 1; dDec += 1) {
      for (let dRa = -raCells; dRa <= raCells; dRa += 1) {
        const list = cells.get(cellOf((Math.floor(at.ra) + dRa + 360) % 360, Math.floor(at.dec) + dDec));
        for (const k of list ?? []) {
          const star = stars[k]!;
          const d = separationDeg(at, { ra: star.raDeg, dec: star.decDeg });
          if (d <= bestDeg) {
            bestDeg = d;
            best = k;
          }
        }
      }
    }
    return best;
  };
}

type FigureStarColumns = {
  -readonly [K in keyof ConstellationCatalog['stars']]: ConstellationCatalog['stars'][K] extends readonly (infer T)[] ? T[] : never;
};

/**
 * The figures' stars, gathered as their vertices are resolved: `vertex` finds the sky star at a
 * figure's vertex -- the nearest within MATCH_DEG -- and returns its index in `stars`, adding it
 * the first time. A vertex with none is kept where the figure put it, with no HIP number, and
 * listed in `unmatched`.
 */
export function figureStars(sky: readonly SkyCandidate[]) {
  const nearest = skyIndex(sky);
  const indexOf = new Map<string, number>();
  const stars: FigureStarColumns = { hip: [], ra: [], dec: [], pmRa: [], pmDec: [], mag: [] };
  const unmatched: string[] = [];
  let worstMatchDeg = 0;
  return {
    stars,
    unmatched,
    worstMatchDeg: () => worstMatchDeg,
    vertex(abbr: string, at: { ra: number; dec: number }): number {
      const k = nearest(at, MATCH_DEG);
      const key = k >= 0 ? `sky ${k}` : `at ${at.ra.toFixed(DECIMALS)} ${at.dec.toFixed(DECIMALS)}`;
      const known = indexOf.get(key);
      if (known !== undefined) return known;
      const index = stars.ra.length;
      indexOf.set(key, index);
      if (k >= 0) {
        const star = sky[k]!;
        worstMatchDeg = Math.max(worstMatchDeg, separationDeg(at, { ra: star.raDeg, dec: star.decDeg }));
        stars.hip.push(star.hip);
        stars.ra.push(round(star.raDeg));
        stars.dec.push(round(star.decDeg));
        stars.pmRa.push(Number(star.pmRaMasPerYear.toFixed(1)));
        stars.pmDec.push(Number(star.pmDecMasPerYear.toFixed(1)));
        stars.mag.push(Number(star.vMag.toFixed(2)));
      } else {
        unmatched.push(`${abbr} ${at.ra.toFixed(DECIMALS)} ${at.dec.toFixed(DECIMALS)}`);
        stars.hip.push(null);
        stars.ra.push(round(at.ra));
        stars.dec.push(round(at.dec));
        stars.pmRa.push(0);
        stars.pmDec.push(0);
        stars.mag.push(null);
      }
      return index;
    },
  };
}

export interface ConstellationSources {
  readonly boundaries: string;
  readonly figures: unknown;
  readonly names: unknown;
  readonly sky: readonly SkyCandidate[];
  readonly read: { readonly boundaries: string; readonly figures: string };
  readonly queriedAt: string;
}

export interface ConstellationsBuild {
  readonly catalog: ConstellationCatalog;
  /** Figure vertices with no sky star within MATCH_DEG: kept where d3-celestial put them. */
  readonly unmatched: readonly string[];
  /** The farthest a matched vertex was from its star, degrees. */
  readonly worstMatchDeg: number;
}

export const CONSTELLATION_CREDITS: readonly string[] = [
  'Constellation boundaries: Davenhall, A. C., & Leggett, S. K. 1989, Catalogue of Constellation Boundary Data (Royal Observatory Edinburgh), CDS VI/49, after Delporte, E. 1930, Délimitation scientifique des constellations (IAU; Cambridge University Press); constbnd.dat prepared by Bill J. Gray (Project Pluto), 2007. Via VizieR (CDS, Strasbourg).',
  'Constellation figures and name positions: d3-celestial (https://github.com/ofrohn/d3-celestial), its lines after the IAU’s constellation charts (IAU and Sky & Telescope); matched here to Hipparcos stars and rounded. Its licence follows.',
  // d3-celestial's LICENSE, word for word, as its clause 2 asks of a redistribution.
  'Copyright (c) 2015, Olaf Frohn. All rights reserved. ' +
    'Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: ' +
    '1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. ' +
    '2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution. ' +
    '3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission. ' +
    'THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.',
];

/** The 88 constellations' boundaries, names and figures, as constellations.json holds them. */
export function buildConstellations(sources: ConstellationSources): ConstellationsBuild {
  const polygons = parseBoundaries(sources.boundaries);
  const unpaired = unmatchedBorders(polygons);
  if (unpaired.length > 0) {
    throw new Error(`constbnd.dat: borders listed from one side only: ${unpaired.join(', ')}`);
  }
  const boundaries = boundaryPolylines(polygons);

  const figures = parseFigures(sources.figures);
  const names = parseNames(sources.names);
  const abbrs = [...new Set(names.map((name) => name.abbr))];
  if (abbrs.length !== 88) {
    throw new Error(`d3-celestial names ${abbrs.length} constellations, not 88`);
  }
  // By name regardless of case: the boundary file writes Corona Australis "Cra".
  const bounded = new Set(polygons.map((polygon) => polygon[0]!.inside.replace(/\d$/, '').toLowerCase()));
  const unbounded = abbrs.filter((abbr) => !bounded.has(abbr.toLowerCase()));
  if (unbounded.length > 0 || bounded.size !== 88) {
    throw new Error(`the boundaries and the names do not list the same 88 constellations (${unbounded.join(', ')})`);
  }

  const resolver = figureStars(sources.sky);

  const constellations = abbrs.map((abbr) => {
    const own = names.filter((name) => name.abbr === abbr);
    return {
      abbr,
      labels: own.map((name) => ({ name: name.name, ra: round(name.ra), dec: round(name.dec) })),
      rank: Math.min(...own.map((name) => name.rank)),
      figure: figures
        .filter((figure) => figure.abbr === abbr)
        .flatMap((figure) => figure.lines.map((line) => line.map((at) => resolver.vertex(abbr, at)))),
    };
  });
  const bare = constellations.filter((constellation) => constellation.figure.length === 0).map((c) => c.abbr);
  if (bare.length > 0) {
    throw new Error(`no figure for ${bare.join(', ')}`);
  }

  return {
    catalog: {
      sources: { boundaries: sources.read.boundaries, figures: sources.read.figures, queriedAt: sources.queriedAt },
      credits: CONSTELLATION_CREDITS,
      frame: 'ICRS, J2000.0',
      boundaries,
      stars: resolver.stars,
      constellations,
    },
    unmatched: resolver.unmatched,
    worstMatchDeg: resolver.worstMatchDeg(),
  };
}

/** Log lines for a build. */
export function describeConstellations(build: ConstellationsBuild): string[] {
  const { catalog } = build;
  const points = catalog.boundaries.reduce((sum, line) => sum + line.length / 2, 0);
  const segments = catalog.constellations.reduce((sum, c) => sum + c.figure.reduce((s, line) => s + line.length - 1, 0), 0);
  return [
    `[constellations] ${catalog.constellations.length} constellations; boundaries ${catalog.boundaries.length} polylines, ${points} points`,
    `[constellations] figures ${segments} lines through ${catalog.stars.ra.length} stars, matched within ` +
      `${(build.worstMatchDeg * 3600).toFixed(1)}"` +
      (build.unmatched.length > 0 ? `; NO STAR FOUND for ${build.unmatched.length}: ${build.unmatched.slice(0, 10).join('; ')}` : ''),
  ];
}
