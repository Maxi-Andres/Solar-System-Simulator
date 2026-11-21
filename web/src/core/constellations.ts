import type { ConstellationCatalog } from '@sss/tools/types';

import { equatorialToEcliptic } from '../scene/orientation.ts';
import { AU_KM } from '../scene/scale.ts';
import { tracked } from './loading.ts';
import { vec3, type Vec3 } from './vec3.ts';

/**
 * The IAU's 88 constellations (tools/src/constellations/): the Constellations layer, drawn by
 * scene/Constellations.tsx.
 *
 * ## What is the IAU's, and what is not
 *
 * - **The boundaries** are: Delporte's of 1930, the only official part of a constellation,
 *   along the meridians and parallels of B1875, precessed to J2000 by the data build.
 * - **The names** are the IAU's; where each is written, d3-celestial's choice.
 * - **The figures** are not: no standard joins the stars, and these lines are a tradition --
 *   d3-celestial's, after the IAU's charts. Each vertex is a catalogue star, by its Hipparcos
 *   number, so a line ends on the star drawn and moves with it.
 *
 * ## A view from here
 *
 * A constellation is how stars at very different distances line up seen from the Sun. So the
 * lines are drawn on the sky at infinity, as the stars with no distance are, and only near the
 * Sun: fully within FULL_FROM_SUN_KM, gone by GONE_FROM_SUN_KM (see constellationFade).
 */

/**
 * Drawn fully within 1,000 AU of the Sun: there the nearest figure star, Rigil Kentaurus (α
 * Centauri A, 1.34 pc), is at most 0.21° from where the Sun sees it, and every other less.
 */
export const FULL_FROM_SUN_KM = 1_000 * AU_KM;

/**
 * Gone by 10,000 AU, the Solar Neighbourhood's edge (scale.ts NEIGHBOURHOOD_FROM_KM): there
 * Rigil Kentaurus has moved up to 2.1°, Sirius 0.9°, and a line no longer ends on its star.
 */
export const GONE_FROM_SUN_KM = 10_000 * AU_KM;

/** How strongly the layer is drawn with the camera this far from the Sun: 1 to 0, log-linear between. */
export function constellationFade(cameraFromSunKm: number): number {
  if (!(cameraFromSunKm > FULL_FROM_SUN_KM)) return 1;
  if (cameraFromSunKm >= GONE_FROM_SUN_KM) return 0;
  return (
    1 -
    (Math.log(cameraFromSunKm) - Math.log(FULL_FROM_SUN_KM)) / (Math.log(GONE_FROM_SUN_KM) - Math.log(FULL_FROM_SUN_KM))
  );
}

const DEG = Math.PI / 180;
const MAS_TO_RAD = DEG / 3_600_000;

/** A J2000 direction in the scene's ecliptic frame. */
export function skyDirection(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return equatorialToEcliptic(vec3(Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)));
}

/**
 * Star `k` of the figures, at `years` from J2000: its direction carried by its proper motion
 * along the equatorial east and north at its place -- as the sky's stars are moved
 * (starGeometry.ts skyDirection) -- in the scene's frame.
 */
export function figureStarDirection(stars: ConstellationCatalog['stars'], k: number, years: number): Vec3 {
  const ra = stars.ra[k]! * DEG;
  const dec = stars.dec[k]! * DEG;
  const pmEast = stars.pmRa[k]! * MAS_TO_RAD * years;
  const pmNorth = stars.pmDec[k]! * MAS_TO_RAD * years;
  const x = Math.cos(dec) * Math.cos(ra) - Math.sin(ra) * pmEast - Math.sin(dec) * Math.cos(ra) * pmNorth;
  const y = Math.cos(dec) * Math.sin(ra) + Math.cos(ra) * pmEast - Math.sin(dec) * Math.sin(ra) * pmNorth;
  const z = Math.sin(dec) + Math.cos(dec) * pmNorth;
  const length = Math.hypot(x, y, z);
  return equatorialToEcliptic(vec3(x / length, y / length, z / length));
}

/** Writes directions as a line segment's two ends, into `out` at `at`; returns the next free slot. */
function writeSegment(out: Float32Array, at: number, a: Vec3, b: Vec3): number {
  out[at] = a.x;
  out[at + 1] = a.y;
  out[at + 2] = a.z;
  out[at + 3] = b.x;
  out[at + 4] = b.y;
  out[at + 5] = b.z;
  return at + 6;
}

/** How many segments the figures have: a polyline of n stars is n - 1. */
export function figureSegmentCount(catalog: ConstellationCatalog): number {
  return catalog.constellations.reduce((sum, c) => sum + c.figure.reduce((s, line) => s + Math.max(0, line.length - 1), 0), 0);
}

/**
 * The figures as line segments, unit directions in the scene's frame, at `years` from J2000:
 * six floats a segment, for a LineSegments' position attribute. Into `out` when given.
 */
export function figureSegments(catalog: ConstellationCatalog, years: number, out?: Float32Array): Float32Array {
  const positions = out ?? new Float32Array(figureSegmentCount(catalog) * 6);
  const directions = catalog.stars.ra.map((_, k) => figureStarDirection(catalog.stars, k, years));
  let at = 0;
  for (const constellation of catalog.constellations) {
    for (const line of constellation.figure) {
      for (let i = 1; i < line.length; i += 1) {
        at = writeSegment(positions, at, directions[line[i - 1]!]!, directions[line[i]!]!);
      }
    }
  }
  return positions;
}

/** The boundaries as line segments, unit directions in the scene's frame. They do not move. */
export function boundarySegments(catalog: ConstellationCatalog): Float32Array {
  const count = catalog.boundaries.reduce((sum, line) => sum + Math.max(0, line.length / 2 - 1), 0);
  const positions = new Float32Array(count * 6);
  let at = 0;
  for (const line of catalog.boundaries) {
    let previous = skyDirection(line[0]!, line[1]!);
    for (let i = 2; i < line.length; i += 2) {
      const next = skyDirection(line[i]!, line[i + 1]!);
      at = writeSegment(positions, at, previous, next);
      previous = next;
    }
  }
  return positions;
}

/** One name to write: its text, where, and its constellation's rank (1 the largest and brightest). */
export interface ConstellationLabel {
  readonly name: string;
  readonly direction: Vec3;
  readonly rank: number;
}

export function constellationLabels(catalog: ConstellationCatalog): ConstellationLabel[] {
  return catalog.constellations.flatMap((constellation) =>
    constellation.labels.map((label) => ({
      name: label.name,
      direction: skyDirection(label.ra, label.dec),
      rank: constellation.rank,
    })),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** The file as published, checked enough that drawing it cannot index past an array. */
export function parseConstellations(raw: unknown): ConstellationCatalog {
  if (!isRecord(raw) || !Array.isArray(raw['constellations']) || !Array.isArray(raw['boundaries']) || !isRecord(raw['stars'])) {
    throw new Error('constellations.json is not a catalogue of constellations.');
  }
  const catalog = raw as unknown as ConstellationCatalog;
  const count = catalog.stars.ra.length;
  for (const column of ['hip', 'dec', 'pmRa', 'pmDec', 'mag'] as const) {
    if (catalog.stars[column].length !== count) {
      throw new Error(`constellations.json's stars.${column} does not have one entry a star.`);
    }
  }
  for (const constellation of catalog.constellations) {
    for (const line of constellation.figure) {
      if (line.some((k) => !Number.isInteger(k) || k < 0 || k >= count)) {
        throw new Error(`constellations.json: ${constellation.abbr}'s figure names a star it does not have.`);
      }
    }
  }
  if (catalog.boundaries.some((line) => line.length % 2 !== 0)) {
    throw new Error('constellations.json: a boundary is not a list of positions.');
  }
  return catalog;
}

export function constellationsUrl(base: string = import.meta.env.BASE_URL): string {
  return `${base}data/constellations.json`;
}

let loading: Promise<ConstellationCatalog | null> | null = null;

/** The catalogue, fetched once when the layer is first drawn; null when the build has none. */
export function loadConstellations(): Promise<ConstellationCatalog | null> {
  loading ??= tracked(
    'the constellations',
    fetch(constellationsUrl())
      .then((response) => (response.ok ? (response.json() as Promise<unknown>) : null))
      .then((raw) => (raw === null ? null : parseConstellations(raw)))
      .catch((error: unknown) => {
        console.warn(`The constellations are not shown: ${String(error)}`);
        return null;
      }),
  );
  return loading;
}
