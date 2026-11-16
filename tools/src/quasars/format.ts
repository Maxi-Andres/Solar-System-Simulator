/**
 * quasars/: what tools/src/quasars/ writes and the app reads (web/src/core/quasars.ts). Kept
 * apart from types.ts, which other layers' work shares, and exported as @sss/tools/quasars.
 */

/**
 * A `quasars/` position's unit, parsecs: positions are Int16, scene frame (as cosmic-web/'s:
 * heliocentric, ICRS rotated about its x axis by the IAU 1976 obliquity), at the comoving
 * distance of the redshift in Planck 2018 -- so +-9,830 Mpc, 32 billion light years, z 11.6,
 * in steps of 0.3 Mpc. The cosmic web's 0.1 Mpc reaches only z 0.98. A quasar's redshift is
 * uncertain by a few hundred km/s at the least (its broad lines are shifted by the gas that
 * makes them: Shen et al. 2016, ApJ 831, 7), a few Mpc at z 2: the step is far under that, and
 * across the sky it is 7 arcseconds at the farthest.
 */
export const QUASAR_POSITION_UNIT_PC = 300_000;

/**
 * Bytes per quasar in a `quasars/quasars-<k>.bin` chunk of n quasars, one column after
 * another, little-endian (as cosmic-web/'s galaxies, so the app reads both alike):
 *
 *   Int16 [3n]  x, y, z interleaved, QUASAR_POSITION_UNIT_PC
 *   Uint8 [n]   absolute V, Vega, rest frame: QUASAR_ABS_V.min + code x step (255: not known)
 *   Uint8 [n]   B-V, Vega, rest frame: QUASAR_BV.min + code x step (255: not known)
 *   Uint8 [n]   QUASAR_FLAGS bits
 *
 * The chunks together are one list ordered by absolute V, most luminous first, those without
 * one last: any number of chunks from the first is the catalogue's most luminous quasars.
 */
export const QUASAR_BYTES = 9;
export const QUASAR_ABS_V = { min: -31, step: 0.05, unknown: 255 } as const;
export const QUASAR_BV = { min: -0.25, step: 0.01, unknown: 255 } as const;

/** The bits of a quasar's flags. */
export const QUASAR_FLAGS = {
  /** Its redshift from a person's look at its spectrum (DR16Q SOURCE_Z "VI"), not a pipeline's. */
  REDSHIFT_VISUAL: 1,
  /** Past z 5.49, the end of Richards et al. 2006's K-corrections: the last carried on along the continuum. */
  K_EXTRAPOLATED: 2,
  /**
   * Its colour the composite quasar's: its g - i says nothing of its optical continuum (g is in
   * the Lyman-alpha forest past z 2.2) or was not measured.
   */
  COLOUR_COMPOSITE: 4,
  /** A broad absorption line quasar, by DR16Q's BAL_PROB of 0.75 or more. */
  BAL: 8,
  /** One of the app's record-holders (web/src/core/recordHolders.ts): drawn as its mark, so the app draws no dot for it. */
  RECORD_HOLDER: 16,
} as const;

/** A survey's footprint on the sky, as cosmic-web.json's (CosmicWebFootprint). */
export interface QuasarFootprint {
  readonly name: string;
  /** Base64 of a bit a cell of `footprint.grid` (cosmic-web.json's grid): set where it has a quasar. */
  readonly cells: string;
  readonly cellCount: number;
  readonly areaDeg2: number;
  readonly zMin: number;
  readonly zMax: number;
  readonly note: string;
}

/** A source as its publisher asks for it to be credited. */
export interface QuasarSource {
  readonly citation: string;
  readonly url: string;
  readonly queriedAt: string;
  readonly rows: number | null;
  readonly licence: string;
  readonly credit: string;
}

/** One record-holder quasar as the catalogue was searched for it. */
export interface RecordHolderCheck {
  readonly key: string;
  readonly name: string;
  readonly z: number;
  /** The catalogue's quasar within RECORD_HOLDER_MATCH_ARCSEC, if any: how far apart, and its z. */
  readonly matched: { readonly separationArcsec: number; readonly z: number; readonly offsetMpc: number } | null;
  readonly note: string;
}

/**
 * `quasars/quasars.json`: what the other files in `quasars/` hold and how they were made. Written
 * last, so a run cut short leaves none -- which the app reads as no quasars.
 */
export interface QuasarsInfo {
  readonly generatedAt: string;
  readonly sources: Readonly<Record<string, QuasarSource>>;
  readonly frame: string;
  readonly positionUnitPc: typeof QUASAR_POSITION_UNIT_PC;
  readonly cosmology: { readonly name: string; readonly h0KmSMpc: number; readonly omegaM: number; readonly t0K: number; readonly nEff: number; readonly note: string };
  readonly quasars: {
    readonly count: number;
    readonly bytesPerQuasar: typeof QUASAR_BYTES;
    readonly chunks: readonly { readonly file: string; readonly bytes: number; readonly count: number; readonly absVBrightest: number; readonly absVFaintest: number }[];
    readonly absV: typeof QUASAR_ABS_V;
    readonly bv: typeof QUASAR_BV;
    readonly flags: typeof QUASAR_FLAGS;
    /** Kept, and why the rest were not. */
    readonly counts: Readonly<Record<string, number>>;
    /** Redshift and comoving distance, pc: nearest, median, farthest. */
    readonly zRange: { readonly min: number; readonly median: number; readonly max: number };
    readonly distanceRangePc: { readonly min: number; readonly median: number; readonly max: number };
    /** Absolute V at the 5th, 50th and 95th percentile: the dots' weights run between the first and the last. */
    readonly absVPercentiles: { readonly p5: number; readonly p50: number; readonly p95: number };
    /** The median distance from the Sun of the quasars, pc: for the crowding (crowding.ts). */
    readonly halfCountPc: number;
    readonly photometryNote: string;
    readonly placementNote: string;
  };
  readonly footprint: {
    readonly grid: { readonly decBands: number; readonly raCells: number; readonly cellDeg2: number };
    readonly survey: QuasarFootprint;
  };
  /** Quasars a shell of `widthPc`, comoving: how the catalogue thins with distance. */
  readonly shells: { readonly widthPc: number; readonly counts: readonly number[] };
  readonly checks: Readonly<Record<string, { readonly passed: boolean; readonly value: number; readonly note: string }>>;
  readonly recordHolders: readonly RecordHolderCheck[];
  /** The Planck SZ clusters (sz-clusters.bin), if this run read them. */
  readonly clusters: SzClustersInfo | null;
  readonly coverage: readonly string[];
}

/**
 * Bytes per cluster in `quasars/sz-clusters.bin`, n clusters, little-endian, columns:
 *
 *   Float32 [3n] x, y, z interleaved, scene frame, pc
 *   Float32 [n]  its redshift
 *   Float32 [n]  M_SZ, 10^14 solar masses (NaN: not given)
 */
export const SZ_CLUSTER_BYTES = 20;

export interface SzClustersInfo {
  readonly file: string;
  readonly bytes: number;
  readonly count: number;
  readonly counts: Readonly<Record<string, number>>;
  readonly massRange: { readonly min: number; readonly median: number; readonly max: number };
  readonly zRange: { readonly min: number; readonly median: number; readonly max: number };
  readonly cosmologyNote: string;
  /** Clusters the app already draws by name, left out here: which, and as what. */
  readonly leftOut: readonly { readonly psz2: string; readonly as: string; readonly separationArcmin: number }[];
  /** A few named in the PSZ2's cross-identifications, for the About and the checklist. */
  readonly named: readonly { readonly psz2: string; readonly name: string; readonly z: number; readonly massE14: number }[];
}

export const QUASARS_DIR = 'quasars';
export const QUASARS_INFO_FILE = 'quasars.json';
