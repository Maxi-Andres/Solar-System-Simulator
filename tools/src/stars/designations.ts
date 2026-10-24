/**
 * Bayer and Flamsteed designations, between the three ways they are written.
 *
 * A Bayer designation is a Greek letter and a constellation; the catalogues abbreviate
 * both, each its own way: the Bright Star Catalogue as "Alp CMa", SIMBAD as "alf CMa",
 * the IAU's star-name list in Greek as "α CMa". A person searching types "Alpha Canis
 * Majoris", or "alpha CMa", or "Sirius". So the index carries the spelled-out name as the
 * display and SIMBAD's form as a designation, and these tables turn one into the other.
 *
 * The genitives are the IAU's (The IAU Style Manual, Wilkins 1989, Table 11), the forms
 * a designation takes: "Alpha Centauri", not "Alpha Centaurus".
 */

/** Greek letters, in order: [SIMBAD's abbreviation, the BSC's, the letter, its name]. */
const GREEK: readonly (readonly [string, string, string, string])[] = [
  ['alf', 'Alp', 'α', 'Alpha'],
  ['bet', 'Bet', 'β', 'Beta'],
  ['gam', 'Gam', 'γ', 'Gamma'],
  ['del', 'Del', 'δ', 'Delta'],
  ['eps', 'Eps', 'ε', 'Epsilon'],
  ['zet', 'Zet', 'ζ', 'Zeta'],
  ['eta', 'Eta', 'η', 'Eta'],
  ['tet', 'The', 'θ', 'Theta'],
  ['iot', 'Iot', 'ι', 'Iota'],
  ['kap', 'Kap', 'κ', 'Kappa'],
  ['lam', 'Lam', 'λ', 'Lambda'],
  ['mu.', 'Mu', 'μ', 'Mu'],
  ['nu.', 'Nu', 'ν', 'Nu'],
  ['ksi', 'Xi', 'ξ', 'Xi'],
  ['omi', 'Omi', 'ο', 'Omicron'],
  ['pi.', 'Pi', 'π', 'Pi'],
  ['rho', 'Rho', 'ρ', 'Rho'],
  ['sig', 'Sig', 'σ', 'Sigma'],
  ['tau', 'Tau', 'τ', 'Tau'],
  ['ups', 'Ups', 'υ', 'Upsilon'],
  ['phi', 'Phi', 'φ', 'Phi'],
  ['chi', 'Chi', 'χ', 'Chi'],
  ['psi', 'Psi', 'ψ', 'Psi'],
  ['ome', 'Ome', 'ω', 'Omega'],
];

/** IAU abbreviation to genitive, all 88 constellations. */
export const CONSTELLATION_GENITIVE: Readonly<Record<string, string>> = {
  And: 'Andromedae', Ant: 'Antliae', Aps: 'Apodis', Aqr: 'Aquarii', Aql: 'Aquilae',
  Ara: 'Arae', Ari: 'Arietis', Aur: 'Aurigae', Boo: 'Boötis', Cae: 'Caeli',
  Cam: 'Camelopardalis', Cnc: 'Cancri', CVn: 'Canum Venaticorum', CMa: 'Canis Majoris',
  CMi: 'Canis Minoris', Cap: 'Capricorni', Car: 'Carinae', Cas: 'Cassiopeiae',
  Cen: 'Centauri', Cep: 'Cephei', Cet: 'Ceti', Cha: 'Chamaeleontis', Cir: 'Circini',
  Col: 'Columbae', Com: 'Comae Berenices', CrA: 'Coronae Australis',
  CrB: 'Coronae Borealis', Crv: 'Corvi', Crt: 'Crateris', Cru: 'Crucis', Cyg: 'Cygni',
  Del: 'Delphini', Dor: 'Doradus', Dra: 'Draconis', Equ: 'Equulei', Eri: 'Eridani',
  For: 'Fornacis', Gem: 'Geminorum', Gru: 'Gruis', Her: 'Herculis', Hor: 'Horologii',
  Hya: 'Hydrae', Hyi: 'Hydri', Ind: 'Indi', Lac: 'Lacertae', Leo: 'Leonis',
  LMi: 'Leonis Minoris', Lep: 'Leporis', Lib: 'Librae', Lup: 'Lupi', Lyn: 'Lyncis',
  Lyr: 'Lyrae', Men: 'Mensae', Mic: 'Microscopii', Mon: 'Monocerotis', Mus: 'Muscae',
  Nor: 'Normae', Oct: 'Octantis', Oph: 'Ophiuchi', Ori: 'Orionis', Pav: 'Pavonis',
  Peg: 'Pegasi', Per: 'Persei', Phe: 'Phoenicis', Pic: 'Pictoris', Psc: 'Piscium',
  PsA: 'Piscis Austrini', Pup: 'Puppis', Pyx: 'Pyxidis', Ret: 'Reticuli',
  Sge: 'Sagittae', Sgr: 'Sagittarii', Sco: 'Scorpii', Scl: 'Sculptoris', Sct: 'Scuti',
  Ser: 'Serpentis', Sex: 'Sextantis', Tau: 'Tauri', Tel: 'Telescopii', Tri: 'Trianguli',
  TrA: 'Trianguli Australis', Tuc: 'Tucanae', UMa: 'Ursae Majoris', UMi: 'Ursae Minoris',
  Vel: 'Velorum', Vir: 'Virginis', Vol: 'Volantis', Vul: 'Vulpeculae',
};

/** A Bayer or Flamsteed designation, parsed: one of `letter` and `number`, or both. */
export interface Designation {
  /** Index into the Greek alphabet, 0 for alpha; null for a Flamsteed-only star. */
  readonly letter: number | null;
  /** The superscript that tells apart alpha-1 and alpha-2 Capricorni; null if none. */
  readonly superscript: number | null;
  /** Flamsteed number; null for a star that has none. */
  readonly flamsteed: number | null;
  /** IAU abbreviation, "CMa". */
  readonly constellation: string;
}

/**
 * Reads the Bright Star Catalogue's Name field, bytes 5-14: Flamsteed number in 5-7,
 * Greek letter in 8-10, superscript in 11, constellation in 12-14 -- "  9Alp CMa",
 * " 61    Cyg", "   Alp1Cen". Null for a star with neither (most of the catalogue).
 */
export function parseBscName(field: string): Designation | null {
  const padded = field.padEnd(10);
  const constellation = padded.slice(7, 10).trim();
  if (constellation === '' || CONSTELLATION_GENITIVE[constellation] === undefined) {
    return null;
  }
  const flamsteedText = padded.slice(0, 3).trim();
  const letterText = padded.slice(3, 6).trim();
  const superscriptText = padded.slice(6, 7).trim();
  const letter = letterText === '' ? -1 : GREEK.findIndex(([, bsc]) => bsc === letterText);
  if (letter === -1 && letterText !== '') {
    return null;
  }
  const flamsteed = flamsteedText === '' ? null : Number(flamsteedText);
  if (letter === -1 && flamsteed === null) {
    return null;
  }
  return {
    letter: letter === -1 ? null : letter,
    superscript: superscriptText === '' ? null : Number(superscriptText),
    flamsteed: flamsteed !== null && Number.isInteger(flamsteed) ? flamsteed : null,
    constellation,
  };
}

/**
 * Reads the Greek form the IAU list uses: "α Cen", "θ1 Eri", "ν2 Draconis", "80 UMa".
 * The constellation is an abbreviation or a spelled-out genitive.
 */
export function parseGreekDesignation(text: string): Designation | null {
  const match = /^(\S+?)(\d*)\s+(.+)$/u.exec(text.trim());
  if (match === null) {
    return null;
  }
  const [, head = '', digits = '', rest = ''] = match;
  const constellation =
    CONSTELLATION_GENITIVE[rest] !== undefined
      ? rest
      : Object.entries(CONSTELLATION_GENITIVE).find(([, genitive]) => genitive === rest)?.[0];
  if (constellation === undefined) {
    return null;
  }
  if (/^\d+$/.test(head + digits)) {
    return { letter: null, superscript: null, flamsteed: Number(head + digits), constellation };
  }
  const letter = GREEK.findIndex(([, , greek]) => greek === head);
  if (letter === -1) {
    return null;
  }
  return {
    letter,
    superscript: digits === '' ? null : Number(digits),
    flamsteed: null,
    constellation,
  };
}

/** "Alpha Centauri", "Theta1 Eridani", "61 Cygni": the name a person would type. */
export function spelledOut(designation: Designation): string {
  const genitive = CONSTELLATION_GENITIVE[designation.constellation] ?? designation.constellation;
  if (designation.letter !== null) {
    const name = GREEK[designation.letter]![3];
    return `${name}${designation.superscript ?? ''} ${genitive}`;
  }
  return `${designation.flamsteed ?? ''} ${genitive}`;
}

/** SIMBAD's short forms: ["alf Cen"] or ["alf01 Cap", "5 Cap"] or ["61 Cyg"]. */
export function shortForms(designation: Designation): string[] {
  const forms: string[] = [];
  if (designation.letter !== null) {
    const abbreviation = GREEK[designation.letter]![0].replace('.', '');
    const superscript =
      designation.superscript === null ? '' : String(designation.superscript).padStart(2, '0');
    forms.push(`${abbreviation}${superscript} ${designation.constellation}`);
  }
  if (designation.flamsteed !== null) {
    forms.push(`${designation.flamsteed} ${designation.constellation}`);
  }
  return forms;
}
