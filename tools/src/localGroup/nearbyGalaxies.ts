import { NEARBY_GALAXIES_URL, NEARBY_GALAXIES_VERSION } from '../config.ts';
import { phaseSpace } from '../stars/build3d.ts';
import { parseSexagesimalDegrees, parseSexagesimalHours } from '../stars/buildStarCatalog.ts';
import type { LocalGroupCatalog } from '../types.ts';

/**
 * The Local Group and its neighbours, from McConnachie's catalogue of nearby galaxies
 * (config.ts): every galaxy within 3 Mpc it lists, at its distance and on its sky position,
 * with what is measured of its size and shape.
 *
 * ## The file
 *
 * A FITS file of two parts: a primary header whose data is the table's description as a
 * VOTable (read by nobody here), and one binary table, a row a galaxy -- its name, its centre
 * as sexagesimal text, then floats: E(B-V), the distance modulus, the radial velocity, V, the
 * position angle, ellipticity, central surface brightness and half-light radius, each with its
 * errors up and down, the velocity dispersions and rotation, the HI mass, [Fe/H], and the
 * proper motion. 999 stands for a value not measured, and NaN in the proper motions.
 *
 * ## Read as it is
 *
 * - **Distance**: 10^(1 + (m-M)0 / 5) pc, from the modulus the catalogue adopts for it.
 * - **V** is already corrected for the reddening in front of it: the catalogue says so, and
 *   its Update.log of May 2013 corrected the few that were not.
 * - **Names**: the catalogue's run together ("AndromedaXXI", "CanesVenatici(1)", "*Tucana3"):
 *   spaced, and numbered as the literature numbers them -- Roman numerals, but Segue's and
 *   Willman's Arabic (displayName). The asterisk marks an object whose nature is ambiguous,
 *   a dwarf galaxy or a star cluster; it is kept as a flag.
 * - **Position**: the centre at its distance, standing still. The proper motions and radial
 *   velocities are a few hundred km/s at most, which over the clock's few centuries move a
 *   galaxy a few tenths of a parsec -- less than any of them is across.
 */

// ---------------------------------------------------------------------------------------
// FITS binary tables

const BLOCK = 2880;
const CARD = 80;

export type FitsValue = string | number | null;

/** The header from `at`: its keywords' values, and where its data starts. */
export function readHeader(bytes: Uint8Array, at: number): { cards: Map<string, string>; dataAt: number } {
  const cards = new Map<string, string>();
  const text = new TextDecoder('latin1');
  for (let block = at; block + BLOCK <= bytes.length; block += BLOCK) {
    for (let card = block; card < block + BLOCK; card += CARD) {
      const line = text.decode(bytes.subarray(card, card + CARD));
      const key = line.slice(0, 8).trim();
      if (key === 'END') {
        return { cards, dataAt: block + BLOCK };
      }
      if (line.slice(8, 10) !== '= ') {
        continue;
      }
      const raw = line.slice(10).trim();
      const value = raw.startsWith("'") ? raw.slice(1, raw.indexOf("'", 1)).trim() : raw.split('/')[0]!.trim();
      cards.set(key, value);
    }
  }
  throw new Error('A FITS header with no END card: the file is cut short or is not FITS.');
}

/** How many bytes of data a header's NAXIS cards describe, padded to whole blocks. */
function dataBytes(cards: Map<string, string>): number {
  const axes = Number(cards.get('NAXIS') ?? 0);
  let size = axes === 0 ? 0 : Math.abs(Number(cards.get('BITPIX'))) / 8;
  for (let n = 1; n <= axes; n += 1) {
    size *= Number(cards.get(`NAXIS${n}`));
  }
  size += Number(cards.get('PCOUNT') ?? 0);
  return Math.ceil(size / BLOCK) * BLOCK;
}

const FORM_BYTES: Readonly<Record<string, number>> = { A: 1, L: 1, B: 1, I: 2, J: 4, K: 8, E: 4, D: 8 };

/** The first binary table in a FITS file, as rows keyed by column name. */
export function readFitsTable(bytes: Uint8Array): Record<string, FitsValue>[] {
  const head = new TextDecoder('latin1').decode(bytes.subarray(0, 9));
  if (head !== 'SIMPLE  =') {
    throw new Error('Not a FITS file: it does not start with SIMPLE.');
  }
  let at = 0;
  for (;;) {
    const { cards, dataAt } = readHeader(bytes, at);
    if (cards.get('XTENSION') === 'BINTABLE') {
      return readBinaryTable(bytes, cards, dataAt);
    }
    at = dataAt + dataBytes(cards);
    if (at >= bytes.length) {
      throw new Error('The FITS file has no binary table.');
    }
  }
}

function readBinaryTable(bytes: Uint8Array, cards: Map<string, string>, at: number): Record<string, FitsValue>[] {
  const rowBytes = Number(cards.get('NAXIS1'));
  const rows = Number(cards.get('NAXIS2'));
  const fields = Number(cards.get('TFIELDS'));
  if (at + rowBytes * rows > bytes.length) {
    throw new Error(`The FITS table should hold ${rows} rows of ${rowBytes} bytes, and the file is shorter.`);
  }
  const columns = [];
  let offset = 0;
  for (let n = 1; n <= fields; n += 1) {
    const form = /^(\d*)([A-Z])$/.exec(cards.get(`TFORM${n}`) ?? '');
    if (form === null || FORM_BYTES[form[2]!] === undefined) {
      throw new Error(`Column ${n} of the FITS table has a format this reader does not know: ${cards.get(`TFORM${n}`)}.`);
    }
    const repeat = form[1] === '' ? 1 : Number(form[1]);
    const type = form[2]!;
    const nullCard = cards.get(`TNULL${n}`);
    columns.push({ name: cards.get(`TTYPE${n}`) ?? `col${n}`, type, repeat, offset, nullValue: nullCard === undefined ? null : Number(nullCard) });
    offset += repeat * FORM_BYTES[type]!;
  }
  if (offset !== rowBytes) {
    throw new Error(`The FITS table's columns add up to ${offset} bytes a row, not its ${rowBytes}.`);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = new TextDecoder('latin1');
  const out: Record<string, FitsValue>[] = [];
  for (let r = 0; r < rows; r += 1) {
    const row: Record<string, FitsValue> = {};
    const base = at + r * rowBytes;
    for (const column of columns) {
      const p = base + column.offset;
      let value: FitsValue;
      switch (column.type) {
        case 'A':
          value = text.decode(bytes.subarray(p, p + column.repeat)).replace(/\0.*$/s, '').trim();
          break;
        case 'E':
          value = view.getFloat32(p, false);
          break;
        case 'D':
          value = view.getFloat64(p, false);
          break;
        case 'I':
          value = view.getInt16(p, false);
          break;
        case 'J':
          value = view.getInt32(p, false);
          break;
        case 'K':
          value = Number(view.getBigInt64(p, false));
          break;
        default:
          value = bytes[p]!;
      }
      if (typeof value === 'number' && (Number.isNaN(value) || value === column.nullValue)) {
        value = null;
      }
      row[column.name] = value;
    }
    out.push(row);
  }
  return out;
}

// ---------------------------------------------------------------------------------------
// Names

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];

/** Numbered in Arabic in the literature, not in Roman numerals. */
const ARABIC = new Set(['Segue', 'Willman']);

/** Names the catalogue runs together that are not just a constellation and a number. */
const SPELLED: Readonly<Record<string, string>> = {
  SagittariusdSph: 'Sagittarius Dwarf Spheroidal',
  SagittariusdIrr: 'Sagittarius Dwarf Irregular',
  PegasusdIrr: 'Pegasus Dwarf Irregular',
  LMC: 'Large Magellanic Cloud',
  SMC: 'Small Magellanic Cloud',
  Triangulum: 'Triangulum Galaxy',
  CanisMajor: 'Canis Major Overdensity',
  'HIZSS3(A)': 'HIZSS 3A',
  HIZSS3B: 'HIZSS 3B',
  'DESJ0225+0304': 'DES J0225+0304',
  'UKS2323-326': 'UKS 2323-326',
  'ESO294-G010': 'ESO 294-G010',
  'ESO410-G005': 'ESO 410-G005',
};

/** Other names, by the catalogue's: Messier's, and the ones the bright ones are known by. */
export const OTHER_NAMES: Readonly<Record<string, readonly string[]>> = {
  M32: ['NGC 221'],
  NGC205: ['M110'],
  Triangulum: ['M33', 'NGC 598'],
  LMC: ['LMC', 'Nubecula Major'],
  SMC: ['SMC', 'NGC 292', 'Nubecula Minor'],
  NGC6822: ["Barnard's Galaxy"],
  WLM: ['Wolf-Lundmark-Melotte', 'DDO 221'],
  IC1613: ['DDO 8'],
  SagittariusdIrr: ['SagDIG'],
  SagittariusdSph: ['Sgr dSph'],
  PegasusdIrr: ['DDO 216'],
  AndromedaII: ['And II'],
  Fornax: ['Fornax dSph'],
  Sculptor: ['Sculptor dSph'],
};

/**
 * The catalogue's name made readable: "AndromedaXXI" is Andromeda XXI, "CanesVenatici(1)"
 * Canes Venatici I, "Tucana3" Tucana III, "Segue(1)" Segue 1, "NGC6822" NGC 6822, "LeoA" Leo A.
 */
export function displayName(catalogueName: string): string {
  const name = catalogueName.replace(/^\*/, '');
  const spelled = SPELLED[name];
  if (spelled !== undefined) {
    return spelled;
  }
  // A catalogue designation: letters then a number, spaced -- NGC, IC, UGC, DDO, KK, GR, LGS.
  const designation = /^(NGC|IC|UGCA?|DDO|KKH|KKR|KKs|KK|GR|LGS)(\d.*)$/.exec(name);
  if (designation !== null) {
    return `${designation[1]} ${designation[2]}`;
  }
  // A constellation (camel-cased words), then a number, bare or in brackets, or a capital letter.
  const named = /^([A-Z][a-z]+(?:[A-Z][a-z]+)*?)(?:\((\d+)\)|(\d+)|([A-Z]|[IVX]+))?$/.exec(name);
  if (named === null) {
    return name;
  }
  const words = named[1]!.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^Bootes/, 'Boötes');
  const number = named[2] ?? named[3];
  if (number !== undefined) {
    const n = Number(number);
    return `${words} ${ARABIC.has(named[1]!) || n >= ROMAN.length ? n : ROMAN[n]}`;
  }
  return named[4] === undefined ? words : `${words} ${named[4]}`;
}

// ---------------------------------------------------------------------------------------
// The catalogue

/** 999 is the catalogue's "not measured". */
function measured(value: FitsValue): number | null {
  return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 999 ? value : null;
}

const round = (value: number, digits: number): number => Number(value.toFixed(digits));
const roundOrNull = (value: number | null, digits: number): number | null => (value === null ? null : round(value, digits));

export function buildLocalGroup(rows: readonly Record<string, FitsValue>[], queriedAt: string): LocalGroupCatalog {
  const kept = rows.filter((row) => measured(row['dmod'] ?? null) !== null);
  const galaxies = kept.map((row) => {
    const catalogueName = String(row['GalaxyName']);
    const raDeg = parseSexagesimalHours(String(row['RA']).replace(/:/g, ' '));
    const decDeg = parseSexagesimalDegrees(String(row['Dec']).replace(/:/g, ' '));
    const modulus = measured(row['dmod']!)!;
    const distancePc = 10 ** (1 + modulus / 5);
    const { position } = phaseSpace(raDeg, decDeg, 1000 / distancePc, 0, 0, 0);
    return { row, catalogueName, raDeg, decDeg, modulus, distancePc, position };
  });
  const column = (key: string, digits: number) => galaxies.map(({ row }) => roundOrNull(measured(row[key] ?? null), digits));
  return {
    source: { url: NEARBY_GALAXIES_URL, version: NEARBY_GALAXIES_VERSION, queriedAt },
    frame: 'Heliocentric; ICRS rotated about its x axis by the IAU 1976 obliquity, 84381.448": the scene frame.',
    count: galaxies.length,
    catalogueName: galaxies.map((g) => g.catalogueName),
    name: galaxies.map((g) => displayName(g.catalogueName)),
    otherNames: galaxies.map((g) => OTHER_NAMES[g.catalogueName.replace(/^\*/, '')] ?? []),
    ambiguous: galaxies.map((g) => g.catalogueName.startsWith('*')),
    raDeg: galaxies.map((g) => round(g.raDeg, 5)),
    decDeg: galaxies.map((g) => round(g.decDeg, 5)),
    x: galaxies.map((g) => round(g.position[0], 1)),
    y: galaxies.map((g) => round(g.position[1], 1)),
    z: galaxies.map((g) => round(g.position[2], 1)),
    distanceModulus: galaxies.map((g) => round(g.modulus, 3)),
    distanceModulusUp: column('dmod+', 3),
    distanceModulusDown: column('dmod-', 3),
    distancePc: galaxies.map((g) => Math.round(g.distancePc)),
    ebv: column('EB-V', 3),
    vMag: column('Vmag', 2),
    muV0: column('muVo', 2),
    halfLightArcmin: column('rh', 3),
    ellipticity: column('e=1-b/a', 3),
    positionAngleDeg: column('PA', 1),
    radialVelocityKmS: column('vh', 1),
    sigmaStarsKmS: column('sigma_s', 1),
    hiMassMillionSun: column('MHI', 3),
    feH: column('[Fe/H]', 2),
    pmRaMasYr: column('pmra', 3),
    pmDecMasYr: column('pmdec', 3),
  };
}

export function describeLocalGroup(catalog: LocalGroupCatalog): string[] {
  const sized = catalog.halfLightArcmin.filter((value) => value !== null).length;
  const ambiguous = catalog.ambiguous.filter(Boolean).length;
  return [
    `[local-group] ${catalog.count} galaxies from McConnachie's catalogue (${catalog.source.version}), ${sized} with a measured size, ${ambiguous} of ambiguous nature.`,
  ];
}
