import {
  AU_KM,
  STAR3D_COMBINED_RADIUS_ARCSEC,
  STAR3D_COMPONENT_RADIUS_ARCSEC,
  STAR3D_MATCH_MAGNITUDE,
  STAR3D_MATCH_RADIUS_ARCSEC,
  STAR3D_MAX_RUWE,
  STAR3D_OBLIQUITY_ARCSEC,
  STAR3D_PARALLAX_SNR,
  STAR3D_TIER_LIMITS,
  STARS3D_NAMES_FILE,
} from '../config.ts';
import {
  STAR3D_FLAGS,
  STAR3D_KM_S_TO_PC_PER_YEAR,
  STAR3D_RECORD_FLOATS,
  type Star3dTier,
  type Stars3dInfo,
  type Stars3dNames,
} from '../types.ts';
import { applyProperMotion, type SkyBuild } from './buildStarCatalog.ts';
import { johnsonFromGaia } from './photometry.ts';
import type { BrightGaiaRow, GcnsTable, Hipparcos2Row } from './sources3d.ts';

/**
 * Puts the stars at their distances (step D2).
 *
 * **Two kinds of star, and each appears once.** The sky's own stars (stars.json, V <= 8)
 * get a distance where a parallax is good enough, and keep everything else they had --
 * direction, V, B-V, proper motion, exactly as stars.json has them, so the sky seen from
 * the Sun cannot change by a hair. Then every star of the Gaia Catalogue of Nearby Stars
 * the sky does not already hold, which is nearly all of them: the census is dominated by
 * M dwarfs and white dwarfs far too faint for the sky.
 *
 * **Which parallax a sky star gets.** Two may compete: Gaia DR3's, through the star's
 * Gaia counterpart, and the Hipparcos new reduction's (van Leeuwen 2007). Each must reach
 * S/N 5 (config.ts says why), Gaia's must also come from a well-behaved solution (RUWE
 * <= 1.4, or a GCNS star, whose classifier already vetted it), and of the ones that
 * qualify the smaller standard error wins. That is Gaia for nearly every star fainter than
 * about G 4, and Hipparcos for the brightest, which saturate Gaia's detectors -- Sirius,
 * Vega, Canopus, Betelgeuse have no usable Gaia parallax at all. Neither: the star stays
 * at infinity, drawn exactly as before D2.
 *
 * **Which Gaia source is a sky star's.** By identifier first: Gaia DR3's own Hipparcos
 * cross-match (gaiadr3.hipparcos2_best_neighbour), which DPAC computed from the full
 * astrometric covariances. By position otherwise -- every Tycho-2 star, every Hipparcos
 * star that cross-match left out, and every star on a day it cannot be read: the sky
 * star carried on its proper motion to J2016, Gaia's epoch, and the nearest Gaia source
 * within 2" whose G is within 1.5 mag of the star's V. The count of each is published.
 *
 * **The one published parallax that replaces the catalogues'.** See OVERRIDES.
 *
 * Positions are at J2000.0 in the scene's frame. A Gaia star's position, published at
 * J2016.0, is carried back along its proper motion -- linear on the sphere, the same
 * expression the sky uses (applyProperMotion) -- so the two kinds of star share an epoch
 * and a convention. Distance is 1/parallax for every star.
 *
 * Held in typed columns throughout (Star3dTable), for the memory reason GcnsTable gives.
 */

const DEG = Math.PI / 180;
const ARCSEC = DEG / 3600;
/** One AU per year in km/s, 4.740470463533348: the 4.74 of v = 4.74 mu / parallax. */
const KM_S_PER_AU_PER_YEAR = AU_KM / (365.25 * 86_400);
const GAIA_EPOCH_SHIFT_YEARS = 2000 - 2016;
const SKY_EPOCH_TO_GAIA_YEARS = 2016 - 2000;
const MATCH_RADIUS = STAR3D_MATCH_RADIUS_ARCSEC * ARCSEC;

/**
 * Published system parallaxes that replace the catalogues', where the catalogues are
 * known to be wrong.
 *
 * **Alpha Centauri A and B.** Gaia DR3 has no parallax for either -- at V -0.01 and 1.33
 * they saturate it -- and Hipparcos's two disagree by 42 mas, 754.81 +/- 4.11 for A and
 * 796.92 +/- 25.90 for B: taken at their word they would put B 0.07 pc, fourteen thousand
 * AU, in front of A, around which it orbits at 11 to 36 AU. Kervella et al. (2016, A&A
 * 594, A107) fix one parallax for the pair from its astrometry, 747.17 +/- 0.61 mas:
 * 1.3384 pc. Proxima, the third member, keeps its own Gaia DR3 parallax: it is 13,000 AU
 * from the pair, and its measurement stands on its own.
 */
export const OVERRIDES: readonly {
  readonly hip: number;
  readonly star: string;
  readonly parallaxMas: number;
  readonly parallaxErrorMas: number;
  readonly reference: string;
}[] = [
  {
    hip: 71683,
    star: 'Alpha Centauri A (HIP 71683)',
    parallaxMas: 747.17,
    parallaxErrorMas: 0.61,
    reference: 'Kervella et al. 2016, A&A 594, A107: the AB system parallax',
  },
  {
    hip: 71681,
    star: 'Alpha Centauri B (HIP 71681)',
    parallaxMas: 747.17,
    parallaxErrorMas: 0.61,
    reference: 'Kervella et al. 2016, A&A 594, A107: the AB system parallax',
  },
];

/**
 * Every star placed in 3D, column by column, in the order they were placed: the sky's
 * first, then the GCNS's. `order` in Stars3dBuild gives the order they are written in.
 */
export interface Star3dTable {
  count: number;
  /** Scene frame, parsecs, J2000.0. */
  readonly x: Float64Array;
  readonly y: Float64Array;
  readonly z: Float64Array;
  /** Scene frame, km/s. */
  readonly vx: Float64Array;
  readonly vy: Float64Array;
  readonly vz: Float64Array;
  readonly absMag: Float64Array;
  /** Apparent V from the Sun, for ordering the names index. */
  readonly vMag: Float64Array;
  readonly bv: Float64Array;
  /** ICRS direction at J2000.0, degrees: for matching names by position. */
  readonly raDeg: Float64Array;
  readonly decDeg: Float64Array;
  readonly parallaxMas: Float64Array;
  readonly parallaxErrorMas: Float64Array;
  /** stars.json row, or -1. */
  readonly sky: Int32Array;
  readonly flags: Uint8Array;
  readonly hip: Uint32Array;
  /** Gaia DR3 source_id, 0 for none. */
  readonly gaiaId: BigUint64Array;
}

function allocateTable(capacity: number): Star3dTable {
  return {
    count: 0,
    x: new Float64Array(capacity),
    y: new Float64Array(capacity),
    z: new Float64Array(capacity),
    vx: new Float64Array(capacity),
    vy: new Float64Array(capacity),
    vz: new Float64Array(capacity),
    absMag: new Float64Array(capacity),
    vMag: new Float64Array(capacity),
    bv: new Float64Array(capacity),
    raDeg: new Float64Array(capacity),
    decDeg: new Float64Array(capacity),
    parallaxMas: new Float64Array(capacity),
    parallaxErrorMas: new Float64Array(capacity),
    sky: new Int32Array(capacity),
    flags: new Uint8Array(capacity),
    hip: new Uint32Array(capacity),
    gaiaId: new BigUint64Array(capacity),
  };
}

/** Unit vector of an ICRS direction. */
function unit(raDeg: number, decDeg: number): [number, number, number] {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

const EPS = STAR3D_OBLIQUITY_ARCSEC * ARCSEC;
const COS_EPS = Math.cos(EPS);
const SIN_EPS = Math.sin(EPS);

/** ICRS equatorial to the scene's ecliptic: the rotation orientation.ts applies to the sky. */
export function toScene(v: readonly [number, number, number]): [number, number, number] {
  return [v[0], v[1] * COS_EPS + v[2] * SIN_EPS, -v[1] * SIN_EPS + v[2] * COS_EPS];
}

/**
 * Position and space velocity, both in the scene's frame, of a star at an ICRS direction.
 *
 * The velocity is the radial velocity along the line of sight plus the tangential one,
 * 4.74047 km/s per (mas/yr) per mas of parallax along east and north -- an AU per year
 * at one parsec, which is what the 4.74 is. Zero radial component when it is unknown.
 */
export function phaseSpace(
  raDeg: number,
  decDeg: number,
  parallaxMas: number,
  pmRaMasPerYear: number,
  pmDecMasPerYear: number,
  rvKmS: number,
): { position: [number, number, number]; velocity: [number, number, number] } {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const u = unit(raDeg, decDeg);
  const east = [-Math.sin(ra), Math.cos(ra), 0] as const;
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)] as const;
  const distancePc = 1000 / parallaxMas;
  const vEast = (KM_S_PER_AU_PER_YEAR * pmRaMasPerYear) / parallaxMas;
  const vNorth = (KM_S_PER_AU_PER_YEAR * pmDecMasPerYear) / parallaxMas;
  const radial = Number.isFinite(rvKmS) ? rvKmS : 0;
  const velocity: [number, number, number] = [0, 0, 0];
  for (let axis = 0; axis < 3; axis += 1) {
    velocity[axis] = radial * u[axis]! + vEast * east[axis]! + vNorth * north[axis]!;
  }
  return {
    position: toScene([u[0] * distancePc, u[1] * distancePc, u[2] * distancePc]),
    velocity: toScene(velocity),
  };
}

/** Absolute magnitude from apparent V and parallax: V + 5 log10(parallax / 100 mas). */
export function absoluteMagnitude(vMag: number, parallaxMas: number): number {
  return vMag + 5 * Math.log10(parallaxMas / 100);
}

/**
 * A grid of unit vectors for finding everything within a small angle of a direction.
 * Cells a few times the search radius on a side, keyed by integer coordinates on the
 * unit sphere's bounding cube; a query looks in its cell and the 26 around it.
 */
export class SphereGrid<T> {
  private readonly cells = new Map<string, { vector: [number, number, number]; item: T }[]>();
  // A plain field, not a constructor parameter property: Node runs this file by stripping
  // its types, and parameter properties are not types.
  private readonly cellSize: number;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  private key(i: number, j: number, k: number): string {
    return `${i},${j},${k}`;
  }

  add(vector: [number, number, number], item: T): void {
    const key = this.key(
      Math.floor(vector[0] / this.cellSize),
      Math.floor(vector[1] / this.cellSize),
      Math.floor(vector[2] / this.cellSize),
    );
    let cell = this.cells.get(key);
    if (cell === undefined) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push({ vector, item });
  }

  /** Items within `radius` radians, nearest first. */
  near(vector: readonly [number, number, number], radius: number): { item: T; separation: number }[] {
    const found: { item: T; separation: number }[] = [];
    const i = Math.floor(vector[0] / this.cellSize);
    const j = Math.floor(vector[1] / this.cellSize);
    const k = Math.floor(vector[2] / this.cellSize);
    for (let di = -1; di <= 1; di += 1) {
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let dk = -1; dk <= 1; dk += 1) {
          for (const entry of this.cells.get(this.key(i + di, j + dj, k + dk)) ?? []) {
            // Chord length is 2 sin(separation / 2): as good as the angle at arcseconds.
            const chord = Math.hypot(
              entry.vector[0] - vector[0],
              entry.vector[1] - vector[1],
              entry.vector[2] - vector[2],
            );
            const separation = 2 * Math.asin(Math.min(1, chord / 2));
            if (separation <= radius) {
              found.push({ item: entry.item, separation });
            }
          }
        }
      }
    }
    return found.sort((a, b) => a.separation - b.separation);
  }
}

/** A sky star's direction at Gaia's epoch, J2016, on its own unrounded proper motion. */
function skyAtGaiaEpoch(sky: SkyBuild, row: number): [number, number, number] {
  const star = sky.stars[row]!;
  const moved = applyProperMotion(
    star.raDeg,
    star.decDeg,
    star.pmRaMasPerYear,
    star.pmDecMasPerYear,
    SKY_EPOCH_TO_GAIA_YEARS,
  );
  return unit(moved.raDeg, moved.decDeg);
}

/**
 * Which bright Gaia sources are worth keeping: those that could be some sky star's
 * counterpart, by HIP number or by position and magnitude. Given to fetchBrightGaia so
 * the other hundred thousand are dropped page by page instead of held.
 */
export function skyCounterpartFilter(sky: SkyBuild): (row: BrightGaiaRow) => boolean {
  const hips = new Set<number>();
  const grid = new SphereGrid<number>(MATCH_RADIUS * 4);
  sky.stars.forEach((star, row) => {
    if (star.hip !== null) {
      hips.add(star.hip);
    }
    grid.add(skyAtGaiaEpoch(sky, row), row);
  });
  return (row) =>
    (row.hip > 0 && hips.has(row.hip)) ||
    grid
      .near(unit(row.raDeg, row.decDeg), MATCH_RADIUS)
      .some(({ item }) => Math.abs(row.g - sky.stars[item]!.vMag) <= STAR3D_MATCH_MAGNITUDE);
}

/** Where each part of the input was read, for the output's `sources`. */
export interface SourceNote {
  readonly name: string;
  readonly table: string;
  readonly via: string;
  readonly rows: number;
  readonly note: string;
}

export interface Build3dInput {
  readonly sky: SkyBuild;
  readonly gcns: GcnsTable;
  readonly hipparcos2: readonly Hipparcos2Row[];
  /**
   * The sky stars' candidate Gaia counterparts (fetchBrightGaia, filtered by
   * skyCounterpartFilter), or null when neither service delivered them.
   */
  readonly brightGaia: readonly BrightGaiaRow[] | null;
  /**
   * Radial velocities from the Pulkovo compilation by HIP (pulkovo.ts), for stars Gaia
   * gave none; null when it could not be read.
   */
  readonly literatureRv?: ReadonlyMap<number, number> | null;
  readonly sources: readonly SourceNote[];
  readonly queriedAt: string;
  readonly tierLimits?: readonly number[];
}

export interface Stars3dBuild {
  readonly info: Omit<Stars3dInfo, 'names'>;
  readonly table: Star3dTable;
  /** Table indices in the order they are written: by tier, then within the tier by Mv. */
  readonly order: Uint32Array;
  /** Per tier, the position in `order` of its first star. */
  readonly tierStarts: readonly number[];
}

/** A Gaia source as a sky star sees it, from the bright set or from the GCNS. */
interface GaiaCandidate {
  readonly sourceId: bigint;
  readonly raDeg: number;
  readonly decDeg: number;
  readonly parallaxMas: number;
  readonly parallaxErrorMas: number;
  readonly ruwe: number;
  readonly rvKmS: number;
  readonly g: number;
  readonly hip: number;
}

interface Choice {
  readonly parallaxMas: number;
  readonly parallaxErrorMas: number;
  readonly flags: number;
}

export function build3d({
  sky,
  gcns,
  hipparcos2,
  brightGaia,
  literatureRv = null,
  sources,
  queriedAt,
  tierLimits = STAR3D_TIER_LIMITS,
}: Build3dInput): Stars3dBuild {
  /**
   * A star's radial velocity and the flags saying whose: Gaia's where it has one, else the
   * Pulkovo compilation's by HIP, else none (NaN) -- and the star moves across the sky only.
   */
  const radialVelocity = (gaiaRv: number, hip: number): { rv: number; flags: number } => {
    if (Number.isFinite(gaiaRv)) {
      return { rv: gaiaRv, flags: STAR3D_FLAGS.RADIAL_VELOCITY };
    }
    const literature = hip > 0 ? literatureRv?.get(hip) : undefined;
    return literature === undefined
      ? { rv: Number.NaN, flags: 0 }
      : { rv: literature, flags: STAR3D_FLAGS.RADIAL_VELOCITY | STAR3D_FLAGS.LITERATURE_RADIAL_VELOCITY };
  };
  const dropped: Record<string, number> = {
    skyNoParallax: 0,
    gcnsParallaxBelowSnr: 0,
    gcnsNoColour: 0,
    gcnsComponentOfSkyEntry: 0,
  };
  const catalog = sky.catalog;
  const hip2ByHip = new Map(hipparcos2.map((row) => [row.hip, row]));
  const overrideByHip = new Map(OVERRIDES.map((entry) => [entry.hip, entry]));

  // The Gaia side of the sky match. The bright set when it was read; when it was not,
  // the GCNS's own bright stars stand in for it -- every sky star within 100 pc is among
  // them -- so the sky still gets Gaia distances inside the census.
  const candidates: GaiaCandidate[] = [];
  if (brightGaia !== null) {
    for (const row of brightGaia) {
      candidates.push({ ...row, sourceId: BigInt(row.sourceId) });
    }
  } else {
    for (let k = 0; k < gcns.count; k += 1) {
      if (gcns.g[k]! < 9.5) {
        candidates.push({
          sourceId: gcns.sourceId[k]!,
          raDeg: gcns.raDeg[k]!,
          decDeg: gcns.decDeg[k]!,
          parallaxMas: gcns.parallaxMas[k]!,
          parallaxErrorMas: gcns.parallaxErrorMas[k]!,
          ruwe: Number.NaN,
          rvKmS: gcns.rvKmS[k]!,
          g: gcns.g[k]!,
          hip: gcns.hip[k]!,
        });
      }
    }
  }
  // Which candidates are in the census, and its clean-sample distance for them.
  const candidateIds = new Set(candidates.map((candidate) => candidate.sourceId));
  const censusDistance = new Map<bigint, number>();
  for (let k = 0; k < gcns.count; k += 1) {
    if (candidateIds.has(gcns.sourceId[k]!)) {
      censusDistance.set(gcns.sourceId[k]!, gcns.dist50Pc[k]!);
    }
  }

  const candidateByHip = new Map<number, GaiaCandidate>();
  const grid = new SphereGrid<GaiaCandidate>(MATCH_RADIUS * 4);
  for (const candidate of candidates) {
    if (candidate.hip > 0 && !candidateByHip.has(candidate.hip)) {
      candidateByHip.set(candidate.hip, candidate);
    }
    grid.add(unit(candidate.raDeg, candidate.decDeg), candidate);
  }

  const table = allocateTable(catalog.count + gcns.count);
  const place = (
    position: readonly number[],
    velocity: readonly number[],
    values: {
      absMag: number;
      vMag: number;
      bv: number;
      raDeg: number;
      decDeg: number;
      parallaxMas: number;
      parallaxErrorMas: number;
      sky: number;
      flags: number;
      hip: number;
      gaiaId: bigint;
    },
  ): void => {
    const k = table.count;
    table.x[k] = position[0]!;
    table.y[k] = position[1]!;
    table.z[k] = position[2]!;
    table.vx[k] = velocity[0]!;
    table.vy[k] = velocity[1]!;
    table.vz[k] = velocity[2]!;
    table.absMag[k] = values.absMag;
    table.vMag[k] = values.vMag;
    table.bv[k] = values.bv;
    table.raDeg[k] = values.raDeg;
    table.decDeg[k] = values.decDeg;
    table.parallaxMas[k] = values.parallaxMas;
    table.parallaxErrorMas[k] = values.parallaxErrorMas;
    table.sky[k] = values.sky;
    table.flags[k] = values.flags;
    table.hip[k] = values.hip;
    table.gaiaId[k] = values.gaiaId;
    table.count += 1;
  };

  const claimed = new Set<bigint>();
  let byId = 0;
  let byPosition = 0;

  for (let row = 0; row < sky.stars.length; row += 1) {
    const star = sky.stars[row]!;
    // The values stars.json holds, rounded as it holds them: the sky's own star.
    const raDeg = catalog.ra[row]!;
    const decDeg = catalog.dec[row]!;
    const vMag = catalog.mag[row]!;

    let gaia: GaiaCandidate | undefined =
      star.hip !== null ? candidateByHip.get(star.hip) : undefined;
    if (gaia !== undefined && !claimed.has(gaia.sourceId)) {
      byId += 1;
    } else {
      gaia = grid
        .near(skyAtGaiaEpoch(sky, row), MATCH_RADIUS)
        .find(
          ({ item }) =>
            !claimed.has(item.sourceId) && Math.abs(item.g - star.vMag) <= STAR3D_MATCH_MAGNITUDE,
        )?.item;
      if (gaia !== undefined) {
        byPosition += 1;
      }
    }
    // Claimed whether or not its parallax is used, so the census cannot add it again.
    if (gaia !== undefined) {
      claimed.add(gaia.sourceId);
    }
    const census = gaia !== undefined ? censusDistance.get(gaia.sourceId) : undefined;

    const options: Choice[] = [];
    if (
      gaia !== undefined &&
      gaia.parallaxMas >= STAR3D_PARALLAX_SNR * gaia.parallaxErrorMas &&
      (census !== undefined || gaia.ruwe <= STAR3D_MAX_RUWE)
    ) {
      options.push({ parallaxMas: gaia.parallaxMas, parallaxErrorMas: gaia.parallaxErrorMas, flags: 0 });
    }
    const hip2 = star.hip !== null ? hip2ByHip.get(star.hip) : undefined;
    if (hip2 !== undefined && hip2.parallaxMas >= STAR3D_PARALLAX_SNR * hip2.parallaxErrorMas) {
      options.push({
        parallaxMas: hip2.parallaxMas,
        parallaxErrorMas: hip2.parallaxErrorMas,
        flags: STAR3D_FLAGS.HIPPARCOS_PARALLAX,
      });
    }
    const override = star.hip !== null ? overrideByHip.get(star.hip) : undefined;
    const chosen: Choice | undefined =
      override !== undefined
        ? {
            parallaxMas: override.parallaxMas,
            parallaxErrorMas: override.parallaxErrorMas,
            flags: STAR3D_FLAGS.LITERATURE_PARALLAX,
          }
        : options.sort((a, b) => a.parallaxErrorMas - b.parallaxErrorMas)[0];
    if (chosen === undefined) {
      dropped.skyNoParallax! += 1;
      continue;
    }

    const { rv, flags: rvFlags } = radialVelocity(gaia?.rvKmS ?? Number.NaN, star.hip ?? gaia?.hip ?? 0);
    const { position, velocity } = phaseSpace(
      raDeg,
      decDeg,
      chosen.parallaxMas,
      catalog.pmRa[row]!,
      catalog.pmDec[row]!,
      rv,
    );
    let flags = chosen.flags | rvFlags;
    if (census !== undefined) {
      flags |= STAR3D_FLAGS.GCNS;
      if (census < 100) {
        flags |= STAR3D_FLAGS.GCNS_WITHIN_100PC;
      }
    }
    place(position, velocity, {
      absMag: absoluteMagnitude(vMag, chosen.parallaxMas),
      vMag,
      bv: catalog.bv[row]!,
      raDeg,
      decDeg,
      parallaxMas: chosen.parallaxMas,
      parallaxErrorMas: chosen.parallaxErrorMas,
      sky: row,
      flags,
      hip: star.hip ?? gaia?.hip ?? 0,
      gaiaId: gaia?.sourceId ?? 0n,
    });
  }
  const skyPlaced = table.count;

  // The census, less the stars the sky already placed or left at infinity, and less the
  // components of sky entries (STAR3D_COMPONENT_RADIUS_ARCSEC says why).
  const componentRadius = STAR3D_COMPONENT_RADIUS_ARCSEC * ARCSEC;
  const combinedRadius = STAR3D_COMBINED_RADIUS_ARCSEC * ARCSEC;
  const skyGrid = new SphereGrid<number>(combinedRadius * 2);
  /** Whether a sky entry near this direction already carries this star's light. */
  const inSkyEntry = (direction: [number, number, number]): boolean =>
    skyGrid.near(direction, combinedRadius).some(({ item, separation }) => {
      const entry = sky.stars[item]!;
      if (entry.componentLight) {
        // Hipparcos resolved the pair and gave V for one component only: the other is
        // not in the sky at all, and is this star -- Mizar B, eta Cassiopeiae B.
        return false;
      }
      return entry.combinedLight || separation <= componentRadius;
    });
  for (let row = 0; row < sky.stars.length; row += 1) {
    skyGrid.add(skyAtGaiaEpoch(sky, row), row);
  }
  let clamped = 0;
  let brighterThanSky = 0;
  for (let k = 0; k < gcns.count; k += 1) {
    const sourceId = gcns.sourceId[k]!;
    if (claimed.has(sourceId)) {
      continue;
    }
    const parallax = gcns.parallaxMas[k]!;
    if (parallax < STAR3D_PARALLAX_SNR * gcns.parallaxErrorMas[k]!) {
      dropped.gcnsParallaxBelowSnr! += 1;
      continue;
    }
    const g = gcns.g[k]!;
    const bpRp = gcns.bp[k]! - gcns.rp[k]!;
    if (!Number.isFinite(g) || !Number.isFinite(bpRp)) {
      // No colour, and none is invented: the sky's rule for a star with no B-V.
      dropped.gcnsNoColour! += 1;
      continue;
    }
    const johnson = johnsonFromGaia(g, bpRp);
    if (johnson.v <= catalog.magnitudeLimit) {
      if (inSkyEntry(unit(gcns.raDeg[k]!, gcns.decDeg[k]!))) {
        dropped.gcnsComponentOfSkyEntry! += 1;
        continue;
      }
      brighterThanSky += 1;
    }
    if (johnson.clamped) {
      clamped += 1;
    }
    const pmRa = gcns.pmRaMasPerYear[k]!;
    const pmDec = gcns.pmDecMasPerYear[k]!;
    const at2000 = applyProperMotion(gcns.raDeg[k]!, gcns.decDeg[k]!, pmRa, pmDec, GAIA_EPOCH_SHIFT_YEARS);
    const { rv, flags: rvFlags } = radialVelocity(gcns.rvKmS[k]!, gcns.hip[k]!);
    const { position, velocity } = phaseSpace(at2000.raDeg, at2000.decDeg, parallax, pmRa, pmDec, rv);
    let flags = STAR3D_FLAGS.GCNS | STAR3D_FLAGS.GAIA_PHOTOMETRY | rvFlags;
    if (gcns.dist50Pc[k]! < 100) {
      flags |= STAR3D_FLAGS.GCNS_WITHIN_100PC;
    }
    place(position, velocity, {
      absMag: absoluteMagnitude(johnson.v, parallax),
      vMag: johnson.v,
      bv: johnson.bv,
      raDeg: at2000.raDeg,
      decDeg: at2000.decDeg,
      parallaxMas: parallax,
      parallaxErrorMas: gcns.parallaxErrorMas[k]!,
      sky: -1,
      flags,
      hip: gcns.hip[k]!,
      gaiaId: sourceId,
    });
  }

  // Most luminous first, then split at the tier limits: the belt's ordering, by Mv
  // rather than H. Equal Mv by stars.json row and then Gaia id, so a rebuild of the same
  // data writes the same bytes.
  const order = new Uint32Array(table.count);
  order.forEach((_, index) => {
    order[index] = index;
  });
  order.sort(
    (a, b) =>
      table.absMag[a]! - table.absMag[b]! ||
      table.sky[a]! - table.sky[b]! ||
      (table.gaiaId[a]! < table.gaiaId[b]! ? -1 : table.gaiaId[a]! > table.gaiaId[b]! ? 1 : 0),
  );

  const tierStarts: number[] = [];
  const tiers: Star3dTier[] = [];
  const bounds = [null, ...tierLimits, null];
  let start = 0;
  for (let tier = 0; tier < bounds.length - 1; tier += 1) {
    const faintest = bounds[tier + 1] ?? null;
    let end = start;
    while (end < order.length && (faintest === null || table.absMag[order[end]!]! < faintest)) {
      end += 1;
    }
    const count = end - start;
    tierStarts.push(start);
    tiers.push({
      file: `tier-${tier}.bin`,
      count,
      bytes: count * STAR3D_RECORD_FLOATS * 4,
      brightestMv: bounds[tier] ?? null,
      faintestMv: faintest,
      details: `details-${tier}.bin`,
      detailsBytes: count * DETAILS_BYTES_PER_STAR,
    });
    start = end;
  }

  let gaiaParallax = 0;
  let hipparcosParallax = 0;
  let literatureParallax = 0;
  let withRadialVelocity = 0;
  let literatureRadialVelocity = 0;
  let inGcns = 0;
  let withinTenParsecs = 0;
  for (let k = 0; k < table.count; k += 1) {
    const flags = table.flags[k]!;
    if ((flags & STAR3D_FLAGS.HIPPARCOS_PARALLAX) !== 0) {
      hipparcosParallax += 1;
    } else if ((flags & STAR3D_FLAGS.LITERATURE_PARALLAX) !== 0) {
      literatureParallax += 1;
    } else {
      gaiaParallax += 1;
    }
    withRadialVelocity += (flags & STAR3D_FLAGS.RADIAL_VELOCITY) !== 0 ? 1 : 0;
    literatureRadialVelocity += (flags & STAR3D_FLAGS.LITERATURE_RADIAL_VELOCITY) !== 0 ? 1 : 0;
    inGcns += (flags & STAR3D_FLAGS.GCNS) !== 0 ? 1 : 0;
    withinTenParsecs += table.parallaxMas[k]! > 100 ? 1 : 0;
  }

  const info: Omit<Stars3dInfo, 'names'> = {
    sources,
    queriedAt,
    epochJulianYear: 2000,
    frame:
      'Heliocentric; ICRS rotated about its x axis by the obliquity below: the ecliptic and ' +
      'mean equinox of J2000 as JPL Horizons defines them, the scene frame.',
    obliquityArcsec: STAR3D_OBLIQUITY_ARCSEC,
    parallaxSnrLimit: STAR3D_PARALLAX_SNR,
    photometry:
      'Sky stars: stars.json V and B-V unchanged. Gaia-only stars: V = G - (G-V) and B-V, ' +
      'both interpolated in BP-RP along the dwarf sequence of Mamajek (2022.04.16; Pecaut & ' +
      `Mamajek 2013, ApJS 208, 9), B9V to M8.5V; ${clamped} stars outside it take its ` +
      'nearest end.',
    count: table.count,
    recordFloats: STAR3D_RECORD_FLOATS,
    kmPerSecondToParsecPerYear: STAR3D_KM_S_TO_PC_PER_YEAR,
    tiers,
    sky: { rows: catalog.count, placed: skyPlaced, atInfinity: catalog.count - skyPlaced },
    counts: {
      gaiaParallax,
      hipparcosParallax,
      literatureParallax,
      radialVelocity: withRadialVelocity,
      literatureRadialVelocity,
      gcns: inGcns,
      withinTenParsecs,
      gaiaOnlyBrighterThanSkyLimit: brighterThanSky,
    },
    crossMatch: { byId, byPosition, positionalRadiusArcsec: STAR3D_MATCH_RADIUS_ARCSEC },
    overrides: OVERRIDES.map(({ star, parallaxMas, parallaxErrorMas, reference }) => ({
      star,
      parallaxMas,
      parallaxErrorMas,
      reference,
    })),
    dropped,
  };

  return { info, table, order, tierStarts };
}

/** Bytes per star in a details file: u64 Gaia id, u32 HIP, f32 parallax, f32 its error. */
export const DETAILS_BYTES_PER_STAR = 8 + 4 + 4 + 4;

/** Records for the stars `indices` names, in that order: STAR3D_RECORD_FLOATS float32 each. */
export function tierRecordBytes(table: Star3dTable, indices: Uint32Array): Uint8Array {
  const records = new Float32Array(indices.length * STAR3D_RECORD_FLOATS);
  indices.forEach((k, index) => {
    const base = index * STAR3D_RECORD_FLOATS;
    records[base] = table.x[k]!;
    records[base + 1] = table.y[k]!;
    records[base + 2] = table.z[k]!;
    records[base + 3] = table.vx[k]!;
    records[base + 4] = table.vy[k]!;
    records[base + 5] = table.vz[k]!;
    records[base + 6] = table.absMag[k]!;
    records[base + 7] = table.bv[k]!;
    records[base + 8] = table.sky[k]!;
    records[base + 9] = table.flags[k]!;
  });
  // Typed arrays are in the machine's byte order; the file is little-endian. Every
  // machine this runs on is, but a DataView pass makes it a statement, not an accident.
  const bytes = new Uint8Array(records.length * 4);
  const view = new DataView(bytes.buffer);
  records.forEach((value, index) => view.setFloat32(index * 4, value, true));
  return bytes;
}

/** The details of the stars `indices` names: the columns Star3dTier.details describes. */
export function tierDetailsBytes(table: Star3dTable, indices: Uint32Array): Uint8Array {
  const n = indices.length;
  const bytes = new Uint8Array(n * DETAILS_BYTES_PER_STAR);
  const view = new DataView(bytes.buffer);
  indices.forEach((k, index) => {
    view.setBigUint64(index * 8, table.gaiaId[k]!, true);
    view.setUint32(n * 8 + index * 4, table.hip[k]!, true);
    view.setFloat32(n * 12 + index * 4, table.parallaxMas[k]!, true);
    view.setFloat32(n * 16 + index * 4, table.parallaxErrorMas[k]!, true);
  });
  return bytes;
}

/** The search index's entry in Stars3dInfo, given its serialised text. */
export function namesEntry(names: Stars3dNames, json: string): Stars3dInfo['names'] {
  return { file: STARS3D_NAMES_FILE, count: names.count, bytes: Buffer.byteLength(json, 'utf8') };
}
