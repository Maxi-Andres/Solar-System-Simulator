import { gunzipSync } from 'node:zlib';

import type { PulsarDistanceMethod } from '../types.ts';

/**
 * The ATNF Pulsar Catalogue (Manchester, Hobbs, Teoh & Hobbs 2005, AJ 129, 1993), read from
 * the public database the ATNF ships with its `psrcat` program (config.ts ATNF_PACKAGE_URL).
 *
 * ## The database
 *
 * psrcat.db is plain text: one block per pulsar, ended by a line of "@---", each line a
 * parameter, its value, then optionally its uncertainty and the reference code of the paper
 * it is from -- "PX  0.6  5  bst+23". The uncertainty is in units of the value's last
 * quoted digit (0.6 +- 0.5 there), unless it has a decimal point of its own, when it is
 * absolute: psrcat's errscale(), readCatalogue.c. A parameter may appear twice, from two
 * papers; the first is read, as psrcat reads it. Lines starting "#" are notes.
 *
 * ## Where it is
 *
 * RAJ and DECJ: J2000 equatorial, sexagesimal, at POSEPOCH (MJD; where there is none,
 * PEPOCH, the period's epoch, which is how the timing solutions that omit it are fitted).
 * 241 pulsars have only ELONG and ELAT: ecliptic coordinates as pulsar timing fits them, on
 * the IERS 2003 obliquity, 84381.4059 arcseconds (psrcat's own conversion,
 * defineParams.c), rotated here to the equator by that angle. Their proper motions likewise
 * (PMELONG, PMELAT).
 *
 * ## How far
 *
 * psrcat's DIST, "best estimate of pulsar distance", worked out as psrcat works it out
 * (defineParams.c defineDistance), and each pulsar keeps which branch gave it:
 *
 * 1. DIST_A where there is one: a distance measured some other way than by the pulsar's own
 *    signal -- its globular cluster, its supernova remnant, HI absorption, a companion's
 *    optical parallax.
 * 2. Else 1 / PX, where the parallax is more than three times its uncertainty.
 * 3. Else, where DIST_AMN and DIST_AMX bound it, DIST_DM held between them.
 * 4. Else DIST_DM: the dispersion measure through YMW16 (Yao, Manchester & Wang 2017).
 *
 * **Except where DIST_DM is no distance:** where a pulsar's dispersion is more than the
 * model's electrons can give along its line of sight, YMW16 does not say how far; it returns
 * the edge of what it models, 25,000 pc in the Galaxy and 100,000 pc toward the Magellanic
 * Clouds (the model's documentation; the third Fermi-LAT pulsar catalogue, Smith et al.
 * 2023, ApJ 958, 191, meets it among its own pulsars). 177 and 8 pulsars carry exactly those in
 * version 2.9.0. That is taken as no DIST_DM -- psrcat itself would put them all on the
 * Galaxy's far rim -- so such a pulsar is placed only if something else places it.
 *
 * A pulsar with none of these -- most of them seen only at high energies, with no dispersion
 * measure, or past the model's edge as above -- is not placed. The magnetars among them
 * McGill places (mcgill.ts).
 */

/** What YMW16 returns, kpc, for a dispersion past its model's reach: no distance (see above). */
export const YMW16_CEILINGS_KPC: readonly number[] = [25, 100];

/** One parameter line: its value as written, its uncertainty (absolute), its reference code. */
export interface AtnfValue {
  readonly text: string;
  readonly error: number | null;
  readonly ref: string | null;
}

/** One pulsar's block: parameter name to its first line. */
export type AtnfRecord = ReadonlyMap<string, AtnfValue>;

export interface AtnfDatabase {
  /** "2.9.0", from the "#CATALOGUE" line. */
  readonly version: string;
  readonly records: readonly AtnfRecord[];
}

/**
 * The size of one unit of the last digit a value is written to: "0.6" 0.1, "2.097E-15"
 * 1e-18, "55806" 1. As errscale() in psrcat's readCatalogue.c, less its quirk for values
 * with positive exponents, which no uncertainty here uses.
 */
export function lastDigitUnit(value: string): number {
  const match = /^[+-]?\d*(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(value.trim());
  if (match === null) {
    return 1;
  }
  const decimals = match[1]?.length ?? 0;
  const exponent = match[2] === undefined ? 0 : Number(match[2]);
  return 10 ** (exponent - decimals);
}

/** An uncertainty as written beside its value, made absolute. */
export function absoluteError(value: string, error: string): number {
  if (error.startsWith('-') || error.includes('.')) {
    return Math.abs(Number(error));
  }
  return Number(error) * lastDigitUnit(value);
}

/** Parses psrcat.db: its version and one record per pulsar. */
export function parseAtnfDatabase(text: string): AtnfDatabase {
  const version = /^#CATALOGUE\s+(\S+)/m.exec(text)?.[1];
  if (version === undefined) {
    throw new Error('psrcat.db has no "#CATALOGUE" line: not the ATNF database.');
  }
  const records: AtnfRecord[] = [];
  let current = new Map<string, AtnfValue>();
  for (const line of text.split('\n')) {
    if (line.startsWith('@')) {
      if (current.size > 0) {
        records.push(current);
      }
      current = new Map();
      continue;
    }
    if (line.startsWith('#') || line.trim() === '') {
      continue;
    }
    const [key, value, third, fourth] = line.trim().split(/\s+/);
    if (key === undefined || value === undefined || current.has(key)) {
      continue;
    }
    // The column after the value is an uncertainty if it starts with a digit, else the
    // reference (readCatalogue.c: isdigit).
    const hasError = third !== undefined && /^[0-9]/.test(third);
    current.set(key, {
      text: value,
      error: hasError ? absoluteError(value, third) : null,
      ref: (hasError ? fourth : third) ?? null,
    });
  }
  if (current.size > 0) {
    records.push(current);
  }
  return { version, records };
}

/**
 * The one file wanted out of a tar archive, as text. A tar is 512-byte blocks: a header
 * with the name (bytes 0-99, NUL-padded, and a prefix at 345-499 in the ustar format) and
 * the size in octal (124-135), then the file rounded up to whole blocks.
 */
export function fileFromTar(tar: Uint8Array, wanted: string): string {
  const decoder = new TextDecoder();
  const field = (start: number, length: number): string =>
    decoder.decode(tar.subarray(start, start + length)).replace(/\0.*$/s, '');
  let offset = 0;
  while (offset + 512 <= tar.length) {
    const name = field(offset, 100);
    if (name === '') {
      break;
    }
    const prefix = field(offset + 345, 155);
    const path = prefix === '' ? name : `${prefix}/${name}`;
    const size = parseInt(field(offset + 124, 12).trim(), 8);
    const start = offset + 512;
    if (path === wanted || path.endsWith(`/${wanted}`)) {
      return decoder.decode(tar.subarray(start, start + size));
    }
    offset = start + Math.ceil(size / 512) * 512;
  }
  throw new Error(`The archive has no ${wanted}.`);
}

/** psrcat.db and psrcat_ref out of the package as downloaded. */
export function unpackAtnf(gzipped: Uint8Array): { readonly database: string; readonly references: string } {
  const tar = gunzipSync(gzipped);
  return { database: fileFromTar(tar, 'psrcat.db'), references: fileFromTar(tar, 'psrcat_ref') };
}

const JOURNALS: Readonly<Record<string, string>> = {
  aap: 'A&A',
  aaps: 'A&AS',
  aj: 'AJ',
  apj: 'ApJ',
  apjl: 'ApJL',
  apjs: 'ApJS',
  mnras: 'MNRAS',
  nat: 'Nature',
  natas: 'Nature Astronomy',
  sci: 'Science',
  pasa: 'PASA',
  pasj: 'PASJ',
  pasp: 'PASP',
  raa: 'RAA',
};

/**
 * psrcat_ref, the references' long forms, shortened to what a panel can hold: "Abbate et
 * al. 2023, MNRAS 524, 2966". Each entry is "***code  code:  Authors, YEAR. Title.
 * journal, volume, pages." spread over lines; one that does not read that way is kept as
 * its first 120 characters.
 */
export function parseAtnfReferences(text: string): ReadonlyMap<string, string> {
  const references = new Map<string, string>();
  for (const block of text.split(/^\*\*\*/m).slice(1)) {
    const flat = block.replace(/\s+/g, ' ').trim();
    const head = /^(\S+)\s+\S+:\s*(.*)$/.exec(flat);
    if (head === null) {
      continue;
    }
    const [, code, body] = head as unknown as [string, string, string];
    const authors = /^(.*?),\s*((?:1[89]|20)\d\d)[a-z]?\.\s*(.*)$/.exec(body);
    if (authors === null) {
      references.set(code, body.slice(0, 120));
      continue;
    }
    const [, names, year, rest] = authors as unknown as [string, string, string, string];
    const surname = names.split(',')[0]!.trim();
    const others = /&|\bet al\b/.test(names) || names.split(',').length > 3;
    const where = /\.\s*([a-z]+),\s*([0-9]+)(?:\([^)]*\))?,\s*([A-Za-z]?[0-9]+)/.exec(rest);
    const journal = where === null ? null : (JOURNALS[where[1]!] ?? where[1]!);
    const citation = `${surname}${others ? ' et al.' : ''} ${year}`;
    references.set(code, where === null ? citation : `${citation}, ${journal} ${where[2]}, ${where[3]}`);
  }
  return references;
}

const DEG = Math.PI / 180;
/** The obliquity pulsar timing's ecliptic coordinates are on: IERS 2003, as psrcat converts them. */
export const TIMING_OBLIQUITY_ARCSEC = 84381.4059;

/** Sexagesimal "05:34:31.93357" hours, or "+22:00:52.1758" degrees, to degrees. */
export function parseColonSexagesimal(text: string, hours: boolean): number {
  const trimmed = text.trim();
  const sign = trimmed.startsWith('-') ? -1 : 1;
  const parts = trimmed.replace(/^[+-]/, '').split(':').map(Number);
  if (parts.length === 0 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Not a sexagesimal angle: "${text}"`);
  }
  const [a = 0, b = 0, c = 0] = parts;
  return sign * (a + b / 60 + c / 3600) * (hours ? 15 : 1);
}

/** An ecliptic direction and proper motion (timing's obliquity) as equatorial ones. */
export function eclipticToEquatorial(
  lonDeg: number,
  latDeg: number,
  pmLonMasYr: number,
  pmLatMasYr: number,
): { raDeg: number; decDeg: number; pmRaMasYr: number; pmDecMasYr: number } {
  const eps = (TIMING_OBLIQUITY_ARCSEC / 3600) * DEG;
  const lon = lonDeg * DEG;
  const lat = latDeg * DEG;
  // The direction and its east and north unit vectors, ecliptic frame, rotated to the
  // equator about x by +eps: y' = y cos eps - z sin eps, z' = y sin eps + z cos eps.
  const rotate = (v: readonly [number, number, number]): [number, number, number] => [
    v[0],
    v[1] * Math.cos(eps) - v[2] * Math.sin(eps),
    v[1] * Math.sin(eps) + v[2] * Math.cos(eps),
  ];
  const u = rotate([Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]);
  const eastEcl = rotate([-Math.sin(lon), Math.cos(lon), 0]);
  const northEcl = rotate([-Math.sin(lat) * Math.cos(lon), -Math.sin(lat) * Math.sin(lon), Math.cos(lat)]);
  const motion = [0, 1, 2].map((k) => pmLonMasYr * eastEcl[k]! + pmLatMasYr * northEcl[k]!);
  const ra = Math.atan2(u[1], u[0]);
  const dec = Math.asin(Math.max(-1, Math.min(1, u[2])));
  const east = [-Math.sin(ra), Math.cos(ra), 0];
  const north = [-Math.sin(dec) * Math.cos(ra), -Math.sin(dec) * Math.sin(ra), Math.cos(dec)];
  const dot = (a: readonly number[], b: readonly number[]): number => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  return {
    raDeg: ((ra / DEG) % 360 + 360) % 360,
    decDeg: dec / DEG,
    pmRaMasYr: dot(motion, east),
    pmDecMasYr: dot(motion, north),
  };
}

/** The Julian year of a Modified Julian Date. */
export function mjdToJulianYear(mjd: number): number {
  return 2000 + (mjd + 2_400_000.5 - 2_451_545) / 365.25;
}

/** A pulsar's place on the sky, at its epoch: degrees, mas/yr, Julian year. */
export interface AtnfAstrometry {
  readonly raDeg: number;
  readonly decDeg: number;
  readonly pmRaMasYr: number;
  readonly pmDecMasYr: number;
  readonly epochYear: number;
}

function numberOf(record: AtnfRecord, key: string): number | null {
  const value = record.get(key);
  if (value === undefined) {
    return null;
  }
  const n = Number(value.text);
  return Number.isFinite(n) ? n : null;
}

/** Where a record puts its pulsar on the sky; null for one with no position. */
export function atnfAstrometry(record: AtnfRecord): AtnfAstrometry | null {
  const epochMjd = numberOf(record, 'POSEPOCH') ?? numberOf(record, 'PEPOCH');
  const epochYear = epochMjd === null ? 2000 : mjdToJulianYear(epochMjd);
  const ra = record.get('RAJ');
  const dec = record.get('DECJ');
  if (ra !== undefined && dec !== undefined) {
    const pmRa = numberOf(record, 'PMRA');
    const pmDec = numberOf(record, 'PMDEC');
    let pmRaMasYr = pmRa ?? 0;
    let pmDecMasYr = pmDec ?? 0;
    // Some give their motion on the ecliptic only, beside an equatorial position.
    if (pmRa === null && pmDec === null) {
      const pmLon = numberOf(record, 'PMELONG');
      const pmLat = numberOf(record, 'PMELAT');
      const lon = numberOf(record, 'ELONG');
      const lat = numberOf(record, 'ELAT');
      if ((pmLon !== null || pmLat !== null) && lon !== null && lat !== null) {
        const converted = eclipticToEquatorial(lon, lat, pmLon ?? 0, pmLat ?? 0);
        pmRaMasYr = converted.pmRaMasYr;
        pmDecMasYr = converted.pmDecMasYr;
      }
    }
    return {
      raDeg: parseColonSexagesimal(ra.text, true),
      decDeg: parseColonSexagesimal(dec.text, false),
      pmRaMasYr,
      pmDecMasYr,
      epochYear,
    };
  }
  const lon = numberOf(record, 'ELONG');
  const lat = numberOf(record, 'ELAT');
  if (lon === null || lat === null) {
    return null;
  }
  const converted = eclipticToEquatorial(lon, lat, numberOf(record, 'PMELONG') ?? 0, numberOf(record, 'PMELAT') ?? 0);
  return { ...converted, epochYear };
}

/** A pulsar's distance, kpc, which branch of psrcat's rule gave it, and whose it is. */
export interface AtnfDistance {
  readonly kpc: number;
  readonly method: Exclude<PulsarDistanceMethod, 'magnetar'>;
  /** The reference code, where the catalogue gives one. */
  readonly ref: string | null;
}

/** psrcat's DIST, as defineParams.c defineDistance works it out; null where there is none. */
export function atnfDistance(record: AtnfRecord): AtnfDistance | null {
  const independent = record.get('DIST_A');
  if (independent !== undefined && Number(independent.text) > 0) {
    return { kpc: Number(independent.text), method: 'independent', ref: independent.ref };
  }
  const px = record.get('PX');
  // psrcat tests |PX|; a parallax significantly below zero would give no distance at all.
  if (px !== undefined && px.error !== null && px.error > 0 && Number(px.text) / px.error > 3) {
    return { kpc: 1 / Number(px.text), method: 'parallax', ref: px.ref };
  }
  const dmRead = record.get('DIST_DM');
  const dm = dmRead !== undefined && YMW16_CEILINGS_KPC.includes(Number(dmRead.text)) ? undefined : dmRead;
  const low = record.get('DIST_AMN');
  const high = record.get('DIST_AMX');
  if (low !== undefined && high !== undefined) {
    const min = Number(low.text);
    const max = Number(high.text);
    const ref = low.ref ?? high.ref;
    if (dm === undefined) {
      return { kpc: (min + max) / 2, method: 'bounded', ref };
    }
    return { kpc: Math.min(max, Math.max(min, Number(dm.text))), method: 'bounded', ref };
  }
  if (dm !== undefined && Number(dm.text) > 0) {
    return { kpc: Number(dm.text), method: 'dm', ref: dm.ref };
  }
  return null;
}

/** A pulsar's spin period, s, and its derivative: P0 and P1, or from F0 and F1. */
export function atnfSpin(record: AtnfRecord): { periodS: number | null; periodDerivative: number | null } {
  const p0 = numberOf(record, 'P0');
  const f0 = numberOf(record, 'F0');
  const periodS = p0 ?? (f0 !== null && f0 > 0 ? 1 / f0 : null);
  const p1 = numberOf(record, 'P1');
  const f1 = numberOf(record, 'F1');
  // P1 = -F1 / F0^2.
  const periodDerivative = p1 ?? (f1 !== null && f0 !== null && f0 > 0 ? -f1 / (f0 * f0) : null);
  return { periodS, periodDerivative };
}

/** TYPE's codes, its references stripped: "HE[wcp+18]" -> ["HE"]; "(?)" kept off. */
export function atnfTypes(record: AtnfRecord): string[] {
  const raw = record.get('TYPE')?.text;
  if (raw === undefined) {
    return [];
  }
  const codes = raw
    .replace(/\[[^\]]*\]/g, '')
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code !== '' && !code.endsWith('(?)'));
  return [...new Set(codes)];
}

/** The globular cluster and supernova remnant ASSOC names, "GC:47Tuc(NGC104)" -> "47Tuc(NGC104)". */
export function atnfAssociations(record: AtnfRecord): { globularCluster: string | null; remnant: string | null } {
  const raw = record.get('ASSOC')?.text ?? '';
  const parts = raw.replace(/\[[^\]]*\]/g, '').split(',');
  const of = (kind: string): string | null => {
    const found = parts.find((part) => part.startsWith(`${kind}:`) && !part.endsWith('?'));
    const name = found?.slice(kind.length + 1).trim();
    return name === undefined || name === '' ? null : name;
  };
  return { globularCluster: of('GC'), remnant: of('SNR') };
}

/** Its orbit, days, and its companion's kind, where it has one. */
export function atnfBinary(record: AtnfRecord): { periodDays: number | null; companion: string | null } {
  const companion = record.get('BINCOMP')?.text.replace(/\[[^\]]*\]/g, '').replace(/\(\?\)/g, '') ?? null;
  return { periodDays: numberOf(record, 'PB'), companion: companion === '' ? null : companion };
}
