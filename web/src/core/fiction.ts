import type { BodyId } from '@sss/tools/types';

import type { FictionLook, WorldPalette } from './fictionLook.ts';
import { normalizeName } from './normalizeName.ts';

/**
 * Fiction (Phase F): worlds and things from novels and films, placed where their canon puts
 * them among the real ones -- Pandora about a gas giant of the real α Centauri A.
 *
 * **Fiction is never mixed with data.** Everything here is its own layer, off by default
 * (state/store.ts); its own colour and marker, which nothing real uses; a FICTION tag on its
 * label, its search result and its panel; its own section of the About, apart from the
 * sources. No fictional body is in a real catalogue's list, count or statistics: the
 * planetary systems (planetarySystems.ts), Alpha Centauri A's planets (alphaCenAPlanets.ts)
 * and the Exoplanet Archive never see one. They are bodies in the store only, so the frame
 * tree, the labels and the camera take them as they take any other.
 *
 * **Every number says where it is from** (FictionValue): the canon, with its source; or
 * invented here, with why -- a stand-in while the canon is still being read, or a value the
 * canon never gives and a sphere still needs. A value the work leaves out and nothing needs
 * is "canon silent". Filling in what the research finds is a change to the records below and
 * nothing else.
 *
 * Kept free of three.js and of the store, as the other data modules are: the scene places
 * these (fictionBodies.ts) and draws them (scene/fiction/).
 */

/** The colour of everything fictional: marker, orbit line, label tag. Nothing real is magenta. */
export const FICTION_COLOR = '#ff5fd2';

/** The Fiction layer among the visible kinds (App.tsx LAYER_KINDS, floatingOrigin.ts isShown). */
export const FICTION_LAYER = 'fiction';

/**
 * Why a stand-in is there: the research into the canon's numbers is not in yet. A record that
 * uses one marks it TODO(fiction-research), to be replaced by the canon's value or by an
 * invention the canon leaves room for. None does now.
 */
export const PENDING_RESEARCH = 'Stand-in until the canon is read.';

/** A stand-in pending the research: drawn, and shown as such. */
export function standIn<T>(value: T, why: string = PENDING_RESEARCH): FictionValue<T> {
  return { value, invented: true, why, pending: true };
}

/**
 * Where a canon value is from: short for the panel, in full for the record and its tooltip.
 * `unverified` for a source only known at second hand -- a licensed game's in-game text, as a
 * fan wiki quotes it -- shown as such wherever the value is.
 */
export interface CanonSource {
  readonly short: string;
  readonly full: string;
  readonly unverified?: true;
}

/**
 * One number of a fictional thing, and where it is from:
 * - from the canon, with its source -- and, where the canon gives a comparison rather than a
 *   figure ("comparable in size to Neptune"), the `basis` the figure is read from;
 * - invented here, with why (`pending` while the canon is still being read);
 * - canon silent: the work does not give it, and nothing needs it drawn.
 */
export type FictionValue<T = number> =
  | { readonly value: T; readonly source: CanonSource; readonly basis?: string }
  | { readonly value: T; readonly invented: true; readonly why: string; readonly pending?: true }
  | { readonly silent: true };

/** Invented for good, not pending: the canon is read, and silent on it. */
function invented<T>(value: T, why: string): FictionValue<T> {
  return { value, invented: true, why };
}


/** The value to draw with, or null where the canon is silent and nothing was invented. */
export function valueOf<T>(value: FictionValue<T>): T | null {
  return 'silent' in value ? null : value.value;
}

/**
 * How a value is shown beside it: its source, short, or which kind of invention it is; and the
 * longer line for its tooltip -- the full source, or why it was invented.
 */
export function valueNote(value: FictionValue<unknown>): {
  readonly text: string;
  readonly kind: 'canon' | 'unverified' | 'standIn' | 'invented' | 'silent';
  readonly detail: string;
} {
  if ('silent' in value) return { text: 'canon silent', kind: 'silent', detail: 'The work does not give it.' };
  if ('source' in value) {
    const text = value.basis === undefined ? value.source.short : `${value.basis} · ${value.source.short}`;
    return value.source.unverified === true
      ? { text: `${text} · unverified`, kind: 'unverified', detail: `${value.source.full} (unverified)` }
      : { text, kind: 'canon', detail: value.source.full };
  }
  return value.pending === true
    ? { text: 'stand-in · research pending', kind: 'standIn', detail: value.why }
    : { text: 'invented · canon silent', kind: 'invented', detail: value.why };
}

/** The work a fictional thing is from. */
export interface FictionWork {
  readonly title: string;
  readonly creator: string;
  readonly year: number;
  readonly medium: 'film' | 'novel' | 'series' | 'book';
}

/**
 * The real thing a fictional one is placed by, or another fictional one it belongs to. Each kind
 * is resolved to a body by fictionBodies.ts (resolveAnchor); a new kind of anchor -- a catalogue
 * star made a body (starBodies.ts), a Solar System body, a Lagrange point -- is a case there.
 */
export type FictionAnchor =
  /** One of Alpha Centauri's stars, bodies from the start (alphaCenBodies.ts). */
  | { readonly kind: 'alphaCen'; readonly member: 'A' | 'B' }
  /** Another fictional object, by its id: a moon's planet. */
  | { readonly kind: 'fiction'; readonly id: string }
  /**
   * A Lagrange point of another fictional object about its star (lagrange.ts): a Trojan, on
   * that object's orbit 60 degrees ahead (L4) or behind (L5).
   */
  | { readonly kind: 'lagrange'; readonly of: string; readonly point: 4 | 5 }
  /**
   * A real body the fiction says is this world -- Adrian is τ Ceti e -- drawn over it rather than
   * beside it (FICTION_OVERLAYS): with the Fiction layer on, the body's label, look and panel add
   * the fiction; off, nothing of the body changes. No body of its own, and the real data untouched.
   */
  | { readonly kind: 'overlay'; readonly body: BodyId };

/**
 * Where a fictional thing goes round its anchor: the elements exoplanets.ts draws a real planet
 * by, on the sky's axes at its star (inclination and node as a visual binary's), periastron at
 * J2000 -- the convention there for a phase nobody measured.
 */
export interface FictionOrbit {
  readonly semiMajorAxisKm: FictionValue;
  readonly eccentricity: FictionValue;
  readonly inclinationDeg: FictionValue;
  readonly nodeDeg: FictionValue;
  /** Absent: from Kepler's third law, with the two masses (fictionBodies.ts). */
  readonly periodDays?: FictionValue;
  /** Where along the orbit at J2000, degrees of mean anomaly; absent, at periastron. */
  readonly meanAnomalyDeg?: FictionValue;
}

/** A fact the panel lists besides size and orbit: a day's length, a gravity, an air. */
export interface FictionFact {
  readonly label: string;
  readonly value: FictionValue<number | string>;
  readonly unit?: string;
  /** A line under it: where the canon disagrees with itself, say. */
  readonly note?: string;
}

/** What every fictional thing has, a world, a ship or a line. */
export interface FictionBase {
  /** Unique among all of fiction's entries; a body's id is fictionBodyId(id). */
  readonly id: string;
  readonly name: string;
  /** Other names it is found by. */
  readonly aliases: readonly string[];
  readonly work: FictionWork;
  /** The anchor, said in a line: "Orbits the real α Centauri A". */
  readonly anchorLine: string;
  /** See FictionRecord. */
  readonly position: 'canon' | 'invented';
  readonly facts: readonly FictionFact[];
  /** One line: what is real about the anchor, and what is not. */
  readonly realityCheck: string;
}

export interface FictionRecord extends FictionBase {
  /**
   * What a world is in its system, as the scene draws it: a planet about a star, a moon about a
   * planet, a Trojan at a planet's L4 or L5 (its orbit then the planet's).
   */
  readonly kind: 'planet' | 'moon' | 'trojan';
  readonly anchor: FictionAnchor;
  /** The anchor, said in a line: "Orbits the real α Centauri A". */
  readonly anchorLine: string;
  /**
   * 'canon' where the work places it (by its anchor); 'invented' where it gives no place and
   * one is made up here, seeded from its id (inventedOrbit) -- fixed between sessions, and the
   * label and panel say so. No record uses it yet.
   */
  readonly position: 'canon' | 'invented';
  readonly look: FictionLook;
  readonly radiusKm: FictionValue;
  readonly massEarth: FictionValue;
  readonly orbit: FictionOrbit;
  readonly facts: readonly FictionFact[];
  /** One line: what is real about the anchor, and what is not. */
  readonly realityCheck: string;
}

const AVATAR: FictionWork = { title: 'Avatar', creator: 'James Cameron', year: 2009, medium: 'film' };

/**
 * Avatar's sources. The films give no numbers: they are the official companion book's, its one
 * table; Pandorapedia, the official site, for what the book does not say. Baxter's is a licensed
 * commentary, not canon of its own: used only for Pandora's place among the moons. Fan wikis'
 * figures (Polyphemus at 1.2 AU, Jupiter-sized; Pandora's air by the percent) are not used.
 */
const CONFIDENTIAL_REPORT: CanonSource = {
  short: 'Confidential Report, 2009',
  full:
    'Maria Wilhelm & Dirk Mathison, Avatar: A Confidential Report on the Biological and Social History of Pandora ' +
    '(HarperCollins/It Books, 2009), ch. 1, Pandora fact table',
};
const PANDORAPEDIA_PANDORA: CanonSource = {
  short: 'Pandorapedia',
  full: 'Pandorapedia, “Pandora”, avatar.com/pandorapedia/pandora',
};
const PANDORAPEDIA_POLYPHEMUS: CanonSource = {
  short: 'Pandorapedia',
  full: 'Pandorapedia, “Polyphemus”, avatar.com/pandorapedia/polyphemus',
};
const MOONS_OF_POLYPHEMUS: CanonSource = {
  short: 'Pandorapedia; Baxter, 2012',
  full:
    'Pandorapedia, “Polyphemus”, avatar.com/pandorapedia/polyphemus (fourteen moons); Stephen Baxter, ' +
    'The Science of Avatar (Orion, 2012), c. p. 89 (Pandora the fifth)',
};
const FILM_OPENING: CanonSource = {
  short: 'Avatar, 2009',
  full: 'Avatar (James Cameron, 2009), opening scene: Jake told the length of the trip on waking from cryosleep',
};

/**
 * The plane of Alpha Centauri A's fictional worlds: the plane of A and B's own orbit about each
 * other (alphaCentauri.ts AB_ORBIT, Kervella et al. 2016), on the sky. A world far inside the
 * pair's orbit in its plane is the configuration that stays stable longest; the canon gives none.
 */
const AB_PLANE = {
  inclinationDeg: invented(79.32, 'Canon silent: in A and B’s own orbital plane.'),
  nodeDeg: invented(205.064, 'Canon silent: in A and B’s own orbital plane.'),
} as const;

/** Neptune's equatorial radius, km, and mass, Earths (IAU 2015; JPL). */
const NEPTUNE_RADIUS_KM = 24_622;
const NEPTUNE_MASS_EARTH = 17.15;

/**
 * Polyphemus' orbit about A, which its Trojans share. A's luminosity is 1.5 Suns', so Earth's
 * sunlight falls at 1.23 AU.
 */
const POLYPHEMUS_ORBIT: FictionOrbit = {
  semiMajorAxisKm: invented(
    1.23 * 149_597_870.7,
    'Where α Cen A gives Earth’s sunlight; the canon says only comparable to Earth’s distance.',
  ),
  eccentricity: invented(0, 'Canon silent.'),
  ...AB_PLANE,
};

const POLYPHEMUS: FictionRecord = {
  id: 'polyphemus',
  name: 'Polyphemus',
  aliases: ['Naranawm'],
  work: AVATAR,
  kind: 'planet',
  anchor: { kind: 'alphaCen', member: 'A' },
  anchorLine: 'Orbits the real α Centauri A',
  position: 'canon',
  // Blue and cyan bands, and the storm its Na'vi name ("great eye") is for; no rings, as the
  // films show none.
  look: { kind: 'world', palette: 'banded-giant', seed: 1, tint: [0.32, 0.55, 0.85] },
  // No figure in the canon: "comparable in size to Neptune", read as Neptune's radius.
  radiusKm: { value: NEPTUNE_RADIUS_KM, source: PANDORAPEDIA_POLYPHEMUS, basis: 'as Neptune' },
  massEarth: invented(NEPTUNE_MASS_EARTH, 'Canon gives none; taken from its Neptune-like size.'),
  orbit: POLYPHEMUS_ORBIT,
  facts: [
    { label: 'Moons', value: { value: '14, Pandora the 5th', source: MOONS_OF_POLYPHEMUS } },
    { label: 'Na’vi name', value: { value: 'Naranawm, “great eye”', source: PANDORAPEDIA_POLYPHEMUS } },
  ],
  realityCheck:
    'A giant at about 1.2 AU from α Cen A is allowed; JWST saw a candidate Saturn-mass planet there in 2024, ' +
    'not yet confirmed (Beichman et al. 2025).',
};

const PANDORA: FictionRecord = {
  id: 'pandora',
  name: 'Pandora',
  aliases: ['Polyphemus V'],
  work: AVATAR,
  kind: 'moon',
  anchor: { kind: 'fiction', id: 'polyphemus' },
  anchorLine: 'Orbits Polyphemus, about the real α Centauri A',
  position: 'canon',
  look: { kind: 'world', palette: 'jungle-moon', seed: 2, clouds: 0.45 },
  // The table's diameter, 11,447 km.
  radiusKm: { value: 11_447 / 2, source: CONFIDENTIAL_REPORT },
  massEarth: { value: 0.72, source: CONFIDENTIAL_REPORT },
  orbit: {
    // Polyphemus 49,244 km across at 270,000 km: 10.4 degrees.
    semiMajorAxisKm: invented(
      270_000,
      'Chosen so Polyphemus spans about 10° of Pandora’s sky, as in the films; the canon gives no distance.',
    ),
    eccentricity: invented(0, 'Canon silent.'),
    ...AB_PLANE,
  },
  facts: [
    // As printed: its own diameter and mass give 0.72 / (11,447 / 12,742)^2 = 0.89 g.
    {
      label: 'Surface gravity',
      value: { value: 0.8, source: CONFIDENTIAL_REPORT },
      unit: 'g',
      note: 'its diameter and mass give 0.89 g',
    },
    { label: 'Air density', value: { value: 1.2, source: CONFIDENTIAL_REPORT }, unit: '× Earth' },
    { label: 'Surface pressure', value: { value: 1.1, source: CONFIDENTIAL_REPORT }, unit: '× Earth' },
    {
      label: 'Of Polyphemus’ moons',
      value: {
        value: '5th of 14',
        source: {
          short: MOONS_OF_POLYPHEMUS.short,
          full: `${PANDORAPEDIA_PANDORA.full} (one of fourteen); Stephen Baxter, The Science of Avatar (Orion, 2012), c. p. 89 (the fifth)`,
        },
      },
    },
    // Not modelled: the sphere does not turn. Said, not drawn.
    { label: 'Day', value: invented('tidally locked, = period', 'Assumed tidally locked; canon silent.') },
    { label: 'Trip from Earth', value: { value: '5 y 9 mo 22 d', source: FILM_OPENING } },
  ],
  realityCheck:
    'α Cen A is real, a G2 star 1.5× as luminous as the Sun; Earth-like light falls about 1.2 AU from it, ' +
    'and stable orbits reach out to about 2.8 AU (Holman & Wiegert 1999).',
};

/**
 * The names of Polyphemus' two innermost moons and of its Trojans, and Pandora's sisters' order
 * beyond what Pandorapedia and Baxter say: only from the licensed game's in-game encyclopedia, as
 * the fan wiki quotes it. Shown, and shown unverified.
 */
const GAME_VIA_WIKI: CanonSource = {
  short: 'Avatar: The Game, 2009',
  full: 'Avatar: The Game (Ubisoft, 2009), in-game Pandorapedia, via james-camerons-avatar.fandom.com',
  unverified: true,
};

/** A mass from an invented radius and a density: an icy moon's 1.5 g/cm³, a rocky one's 2.8. */
function massFromRadius(radiusKm: number, palette: 'icy' | 'barren'): number {
  const density = palette === 'icy' ? 1.5 : 2.8;
  const grams = (4 / 3) * Math.PI * (radiusKm * 1e5) ** 3 * density;
  return grams / 5.9722e27;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', '13th', '14th'];
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV'];

/**
 * Polyphemus' thirteen other moons (Pandorapedia's fourteen, Pandora the fifth). Canon gives none
 * of their numbers, so every one is invented here, fixed, and said so:
 *
 * - **Orbits** from 68,000 km, outside the Roche limit (some 50,000 to 70,000 km for rock to ice
 *   about a body of Polyphemus' size and mass), to 1,940,000 km, inside half its Hill sphere (4.6
 *   million km at 1.23 AU). The four inside Pandora's 270,000 km, the nine outside; spaced so no
 *   two neighbours' periods are within 1.5% of a first- or second-order resonance (fiction.test.ts).
 * - **Sizes** 50 to 2,600 km in radius. Hades, III, IV, VI and VII large enough to show as discs
 *   in Pandora's sky -- half a degree to three at their closest -- as several moons do in the films.
 * - **Planes**: the inner nine near Polyphemus' equator, taken as Pandora's plane; the outer five
 *   tilted, the last retrograde, as a giant's captured outer moons are.
 * - **Phases** spread round the orbits, so they are not lined up at J2000.
 */
const MOON_TABLE: readonly {
  readonly order: number;
  readonly name?: string;
  readonly aKm: number;
  readonly radiusKm: number;
  readonly e: number;
  /** Tilt to Pandora's plane, degrees; past 90, retrograde. */
  readonly tiltDeg: number;
  readonly phaseDeg: number;
  readonly palette: 'icy' | 'barren';
  readonly tint: readonly [number, number, number];
}[] = [
  { order: 1, name: 'Dante', aKm: 68_000, radiusKm: 420, e: 0.002, tiltDeg: 0.1, phaseDeg: 40, palette: 'barren', tint: [0.8, 0.66, 0.52] },
  { order: 2, name: 'Hades', aKm: 100_000, radiusKm: 1_500, e: 0.004, tiltDeg: 0.3, phaseDeg: 215, palette: 'barren', tint: [0.62, 0.6, 0.6] },
  { order: 3, aKm: 145_000, radiusKm: 1_200, e: 0.003, tiltDeg: 0.4, phaseDeg: 120, palette: 'icy', tint: [0.86, 0.92, 1] },
  { order: 4, aKm: 200_000, radiusKm: 900, e: 0.006, tiltDeg: 0.2, phaseDeg: 300, palette: 'barren', tint: [0.74, 0.7, 0.64] },
  { order: 6, aKm: 370_000, radiusKm: 2_600, e: 0.005, tiltDeg: 0.6, phaseDeg: 75, palette: 'icy', tint: [0.9, 0.93, 1] },
  { order: 7, aKm: 500_000, radiusKm: 1_800, e: 0.01, tiltDeg: 1.1, phaseDeg: 250, palette: 'icy', tint: [0.82, 0.88, 0.95] },
  { order: 8, aKm: 640_000, radiusKm: 700, e: 0.015, tiltDeg: 1.8, phaseDeg: 170, palette: 'barren', tint: [0.7, 0.64, 0.58] },
  { order: 9, aKm: 820_000, radiusKm: 350, e: 0.02, tiltDeg: 2.5, phaseDeg: 15, palette: 'barren', tint: [0.66, 0.66, 0.68] },
  { order: 10, aKm: 1_050_000, radiusKm: 1_100, e: 0.03, tiltDeg: 12, phaseDeg: 330, palette: 'icy', tint: [0.88, 0.9, 0.94] },
  { order: 11, aKm: 1_300_000, radiusKm: 220, e: 0.06, tiltDeg: 23, phaseDeg: 95, palette: 'barren', tint: [0.72, 0.62, 0.55] },
  { order: 12, aKm: 1_490_000, radiusKm: 120, e: 0.09, tiltDeg: 31, phaseDeg: 200, palette: 'icy', tint: [0.8, 0.84, 0.86] },
  { order: 13, aKm: 1_700_000, radiusKm: 80, e: 0.12, tiltDeg: 48, phaseDeg: 285, palette: 'barren', tint: [0.6, 0.57, 0.55] },
  { order: 14, aKm: 1_940_000, radiusKm: 50, e: 0.15, tiltDeg: 155, phaseDeg: 140, palette: 'barren', tint: [0.55, 0.53, 0.52] },
];

/**
 * A moon's plane, as the sky's elements: Pandora's plane (A and B's), tilted by \`tiltDeg\` about its
 * line of nodes -- for a tilt past 90, the same tilt from the reversed plane, the node turned half
 * a circle, so it goes round the other way.
 */
function tiltedPlane(tiltDeg: number): { inclinationDeg: number; nodeDeg: number } {
  const i = valueOf(AB_PLANE.inclinationDeg)!;
  const node = valueOf(AB_PLANE.nodeDeg)!;
  return tiltDeg <= 90 ? { inclinationDeg: i + tiltDeg, nodeDeg: node } : { inclinationDeg: 180 - i + (180 - tiltDeg), nodeDeg: (node + 180) % 360 };
}

const MOON_REALITY = 'No moon is known about any planet of another star; α Centauri A’s own giant is unconfirmed.';

function moonOfPolyphemus(row: (typeof MOON_TABLE)[number]): FictionRecord {
  const numeral = `Polyphemus ${NUMERALS[row.order - 1]}`;
  const plane = tiltedPlane(row.tiltDeg);
  return {
    id: `polyphemus-${row.order}`,
    name: row.name ?? numeral,
    aliases: row.name === undefined ? [] : [numeral],
    work: AVATAR,
    kind: 'moon',
    anchor: { kind: 'fiction', id: 'polyphemus' },
    anchorLine: 'Orbits Polyphemus, about the real α Centauri A',
    position: 'canon',
    look: { kind: 'world', palette: row.palette, seed: 100 + row.order, tint: row.tint },
    radiusKm: invented(
      row.radiusKm,
      row.radiusKm >= 900
        ? 'Canon silent: large enough to show as a disc in Pandora’s sky, as moons do in the films.'
        : 'Canon silent: a small moon.',
    ),
    massEarth: invented(massFromRadius(row.radiusKm, row.palette), `From its invented size, at ${row.palette === 'icy' ? 'an icy' : 'a rocky'} density.`),
    orbit: {
      semiMajorAxisKm: invented(
        row.aKm,
        row.order < 5
          ? 'Canon silent: inside Pandora’s orbit, outside the Roche limit, off resonance with its neighbours.'
          : 'Canon silent: outside Pandora’s orbit, inside half the Hill sphere, off resonance with its neighbours.',
      ),
      eccentricity: invented(row.e, 'Canon silent: small, as a regular moon’s.'),
      inclinationDeg: invented(
        plane.inclinationDeg,
        row.tiltDeg > 90
          ? 'Canon silent: retrograde and tilted, as a captured outer moon is.'
          : row.tiltDeg > 5
            ? 'Canon silent: tilted, as a giant’s outer moons are.'
            : 'Canon silent: near Polyphemus’ equator, taken as Pandora’s plane.',
      ),
      nodeDeg: invented(plane.nodeDeg, 'Canon silent: the line its plane crosses Pandora’s.'),
      meanAnomalyDeg: invented(row.phaseDeg, 'Canon silent: spread round the orbits.'),
    },
    facts: [
      row.name === undefined
        ? { label: 'Name', value: invented(numeral, 'Unnamed in canon: numbered by its order from Polyphemus.') }
        : { label: 'Name', value: { value: row.name, source: GAME_VIA_WIKI } },
      {
        label: 'Of Polyphemus’ moons',
        value:
          row.name === undefined
            ? invented(`${ORDINALS[row.order - 1]} of 14`, 'Of fourteen (Pandorapedia), Pandora the fifth (Baxter); its place invented.')
            : { value: `${ORDINALS[row.order - 1]} of 14`, source: GAME_VIA_WIKI },
      },
    ],
    realityCheck: MOON_REALITY,
  };
}

const MOONS = MOON_TABLE.map(moonOfPolyphemus);

/**
 * Poly-L4 and Poly-L5: bodies the game's encyclopedia places at Polyphemus' L4 and L5 about A, a
 * large one and a small one. Not among the fourteen moons. Placed at the points themselves
 * (lagrange.ts), on Polyphemus' orbit 60 degrees ahead and behind, so they share its orbit; their
 * sizes invented.
 */
function trojan(point: 4 | 5, radiusKm: number, tint: readonly [number, number, number]): FictionRecord {
  return {
    id: `poly-l${point}`,
    name: `Poly-L${point}`,
    aliases: [],
    work: AVATAR,
    kind: 'trojan',
    anchor: { kind: 'lagrange', of: 'polyphemus', point },
    anchorLine: `At Polyphemus’ L${point}, 60° ${point === 4 ? 'ahead' : 'behind'}, about the real α Centauri A`,
    position: 'canon',
    look: { kind: 'world', palette: 'barren', seed: 200 + point, tint },
    radiusKm: invented(radiusKm, point === 4 ? 'Canon says only large.' : 'Canon says only small.'),
    massEarth: invented(massFromRadius(radiusKm, 'barren'), 'From its invented size, at a rocky density.'),
    orbit: POLYPHEMUS_ORBIT,
    facts: [
      { label: 'Name', value: { value: `Poly-L${point}`, source: GAME_VIA_WIKI } },
      { label: 'Place', value: { value: `Polyphemus’ L${point}`, source: GAME_VIA_WIKI } },
    ],
    realityCheck: 'Trojans are real: Jupiter has thousands at its L4 and L5. None is known at another star’s planet.',
  };
}

/** The records: each value the canon's with its source, or invented with why. */
export const FICTION: readonly FictionRecord[] = [
  POLYPHEMUS,
  ...MOONS.slice(0, 4),
  PANDORA,
  ...MOONS.slice(4),
  trojan(4, 600, [0.7, 0.64, 0.58]),
  trojan(5, 150, [0.64, 0.62, 0.6]),
];

// --- Project Hail Mary -----------------------------------------------------------------------

const HAIL_MARY_NOVEL: FictionWork = { title: 'Project Hail Mary', creator: 'Andy Weir', year: 2021, medium: 'novel' };

/**
 * Project Hail Mary's sources. The novel's own words, found by full-text search, and nothing a
 * wiki says without one: the figures an AI-written wiki gives for Adrian (3.93 Earth masses,
 * 10,318 km, 1.4 g, 91% CO₂) are not used. What is widely quoted from the novel but was not found
 * in the text checked -- the 1.5 g, the ship's 3 years and 9 months -- is shown, marked so.
 */
const PHM_NOVEL: CanonSource = {
  short: 'Project Hail Mary, 2021',
  full: 'Andy Weir, Project Hail Mary (Ballantine, 2021); passages found by full-text search, Internet Archive item project-hail-mary-andy-weir-2021',
};
const PHM_QUOTED: CanonSource = {
  short: 'Project Hail Mary, as quoted',
  full: 'Andy Weir, Project Hail Mary (2021), as widely quoted; not found in the text checked',
  unverified: true,
};
const PHM_IDENTITY: CanonSource = {
  short: 'Shooting script; NASA',
  full:
    'Project Hail Mary shooting script (Internet Archive item project-hail-mary_202606): Grace’s model labelled “TAU CETI E”; ' +
    'NASA, “The Science Behind Project Hail Mary” (science.nasa.gov, updated May 2026)',
};

/** τ Ceti e's body (planetarySystems.ts): the real candidate Adrian is drawn over. */
export const TAU_CETI_E_ID: BodyId = 'tau-ceti-e';

/**
 * Adrian's mass, invented: the real candidate's minimum mass is 3.93 Earths (Feng et al. 2017), the
 * mass at an unknown tilt anything above it. 5.0 puts the canon's 12.6 km/s orbit a thousand
 * kilometres above the sphere the app draws for τ Ceti e (its radius estimated from that minimum
 * mass, exoplanets.ts) -- at the minimum itself that speed would be below the ground.
 */
const ADRIAN_MASS_EARTH = 5.0;

/**
 * Adrian, the world the Hail Mary is sent to: Tau Ceti e, which the app draws as the real candidate
 * Feng et al. 2017 fitted. An overlay: its orbit, size and every real value stay theirs.
 */
const ADRIAN: FictionRecord = {
  id: 'adrian',
  name: 'Adrian',
  aliases: [],
  work: HAIL_MARY_NOVEL,
  kind: 'planet',
  anchor: { kind: 'overlay', body: TAU_CETI_E_ID },
  anchorLine: 'Drawn over the real candidate τ Ceti e',
  position: 'canon',
  // No tint: the palette's own greens and ambers, after the 2026 film (looks/denseHaze.ts).
  look: { kind: 'world', palette: 'dense-haze', seed: 300 },
  // The real body's, estimated from its mass: nothing here changes it.
  radiusKm: { silent: true },
  massEarth: invented(
    ADRIAN_MASS_EARTH,
    'Canon says only heavier gravity than Earth’s; above the real candidate’s minimum 3.93, chosen so the novel’s 12.6 km/s orbit clears the drawn sphere.',
  ),
  // The real candidate's orbit (Feng et al. 2017), not the fiction's: these are not used.
  orbit: {
    semiMajorAxisKm: { silent: true },
    eccentricity: { silent: true },
    inclinationDeg: { silent: true },
    nodeDeg: { silent: true },
  },
  facts: [
    { label: 'Is', value: { value: 'τ Ceti e', source: PHM_IDENTITY } },
    { label: 'Gravity', value: { value: 'more than Earth’s', source: PHM_NOVEL } },
    { label: 'Low orbit', value: { value: 'just over 12', source: PHM_NOVEL }, unit: 'km/s' },
    { label: 'Ship’s orbit', value: { value: 12.6, source: PHM_NOVEL }, unit: 'km/s' },
    { label: 'Air', value: { value: 'CO₂-rich, with methane', source: PHM_NOVEL } },
    { label: 'Day', value: { silent: true } },
  ],
  realityCheck: 'τ Ceti e is a real candidate, 11.9 ly away; recent studies find it likely the star’s own activity, not a planet.',
};

/**
 * The Bond albedo of each look, for the light a world casts on a ship near it (planetshine): a
 * choice, from the real body each is most like -- Venus's 0.76 for a world under thick haze, the
 * Moon's 0.11 for bare rock, Europa's ice, Earth's 0.3 for oceans and cloud, Jupiter's 0.34.
 */
export const PALETTE_ALBEDO: Readonly<Record<WorldPalette, number>> = {
  'jungle-moon': 0.3,
  'banded-giant': 0.34,
  desert: 0.25,
  arid: 0.25,
  'dense-haze': 0.7,
  'storm-rock': 0.15,
  scorched: 0.12,
  temperate: 0.3,
  crystal: 0.5,
  barren: 0.12,
  icy: 0.6,
};

/** A world's albedo where no fiction is drawn over it: a rocky planet with some air, Earth's. */
export const DEFAULT_ALBEDO = 0.3;

/** The worlds drawn over real bodies (FictionAnchor 'overlay'). */
export const FICTION_OVERLAYS: readonly FictionRecord[] = [ADRIAN];

/** A ship's voyage, at constant proper acceleration, turning over at the midpoint (hailMary.ts). */
export interface FictionVoyage {
  /** From where the body is at launch, to where the destination is at arrival. */
  readonly from: BodyId;
  readonly to: BodyId;
  /** TDB Julian day. */
  readonly launchJd: FictionValue;
  /** Proper acceleration, g (9.80665 m/s²). */
  readonly accelerationG: FictionValue;
  /** The canon's Earth-frame duration, years: shown beside the one worked out. */
  readonly earthYears: FictionValue;
  /** The canon's ship time, years: shown beside the one worked out. */
  readonly shipYears: FictionValue;
  /** Its circular orbit about the destination once there, km/s; the radius from the destination's mass. */
  readonly orbitSpeedKmS: FictionValue;
  /** The destination's mass, Earths, for that radius. */
  readonly destinationMassEarth: FictionValue;
}

/** A fictional ship: a body of its own, drawn as its model (FictionLook 'ship'). */
export interface FictionShipRecord extends FictionBase {
  readonly kind: 'ship';
  readonly look: Extract<FictionLook, { kind: 'ship' }>;
  readonly lengthM: FictionValue;
  readonly voyage: FictionVoyage;
}

/** 1 January 2026, 0 h TDB. */
const JAN_2026_JD = 2_461_041.5;

const HAIL_MARY: FictionShipRecord = {
  id: 'hail-mary',
  name: 'Hail Mary',
  aliases: ['Project Hail Mary'],
  work: HAIL_MARY_NOVEL,
  kind: 'ship',
  anchorLine: 'From Earth to the real τ Ceti, then about τ Ceti e',
  position: 'canon',
  look: { kind: 'ship', design: 'hail-mary' },
  // Grace says the centrifuge's radius grew from 20 m, half the ship's length, to 75 m. The 47 m
  // an AI-written wiki gives is wrong by the novel's own numbers.
  lengthM: { value: 40, source: PHM_NOVEL, basis: 'twice its 20 m half-length' },
  voyage: {
    from: 'earth',
    to: TAU_CETI_E_ID,
    launchJd: invented(
      JAN_2026_JD,
      'Canon silent: 1 January 2026, so the ship is under way now and leaves from where the exact ephemerides place Earth (2016–2036).',
    ),
    accelerationG: { value: 1.5, source: PHM_QUOTED },
    earthYears: { value: 13, source: PHM_NOVEL },
    shipYears: { value: 3.75, source: PHM_QUOTED },
    orbitSpeedKmS: { value: 12.6, source: PHM_NOVEL },
    destinationMassEarth: ADRIAN.massEarth,
  },
  facts: [
    { label: 'Crew', value: { value: 'three', source: PHM_NOVEL } },
    { label: 'Fuel', value: { value: 'Astrophage', source: PHM_NOVEL } },
  ],
  realityCheck: 'The relativity is real: at 1.5 g, 11.9 ly take 13.1 years on Earth and 3.9 aboard. No such drive exists.',
};

/** The ships. */
export const FICTION_SHIPS: readonly FictionShipRecord[] = [HAIL_MARY];

/**
 * A line of something fictional from a star to one of its planets: the Petrova lines, Astrophage
 * glowing in the infrared on their way between a star and the planet they breed at.
 */
export interface FictionLineRecord extends FictionBase {
  readonly kind: 'line';
  /** The planet; the line runs from its star (the Sun for a planet of the Sun's). */
  readonly planet: BodyId;
  /** Linear RGB, 0..1: what it is drawn in. */
  readonly colour: readonly [number, number, number];
}

/** The novel's dark red, faint: Astrophage glow in the infrared, at the wavelength of CO₂'s absorption. */
const PETROVA_RED = [0.22, 0.02, 0.015] as const;

export const FICTION_LINES: readonly FictionLineRecord[] = [
  {
    id: 'petrova-sun',
    name: 'Petrova line',
    aliases: ['Petrova line (Sun–Venus)'],
    work: HAIL_MARY_NOVEL,
    kind: 'line',
    planet: 'venus',
    colour: PETROVA_RED,
    anchorLine: 'From the real Sun to the real Venus',
    position: 'canon',
    facts: [{ label: 'Seen', value: { value: 'in the infrared', source: PHM_NOVEL } }],
    realityCheck: 'Nothing glows between the Sun and Venus; the Sun’s output is measured and steady to a tenth of a percent.',
  },
  {
    id: 'petrova-tau-ceti',
    name: 'Petrova line',
    aliases: ['Petrova line (τ Ceti–Adrian)'],
    work: HAIL_MARY_NOVEL,
    kind: 'line',
    planet: TAU_CETI_E_ID,
    colour: PETROVA_RED,
    anchorLine: 'From the real τ Ceti to τ Ceti e, drawn as Adrian',
    position: 'canon',
    facts: [{ label: 'Seen', value: { value: 'in the infrared', source: PHM_NOVEL } }],
    realityCheck: 'τ Ceti is real, 11.9 ly away; τ Ceti e is only a candidate planet.',
  },
];

/** Every fictional thing: the worlds, the overlays, the ships, the lines. */
export type FictionEntry = FictionRecord | FictionShipRecord | FictionLineRecord;

export const FICTION_ENTRIES: readonly FictionEntry[] = [...FICTION, ...FICTION_OVERLAYS, ...FICTION_SHIPS, ...FICTION_LINES];

const ENTRY_BY_ID = new Map(FICTION_ENTRIES.map((entry) => [entry.id, entry] as const));

/** Any fictional entry by its id; null for none. */
export function fictionEntry(id: string): FictionEntry | null {
  return ENTRY_BY_ID.get(id) ?? null;
}

/** Every number an entry carries, its facts' among them: for the About's sources and the tests. */
export function valuesOfEntry(entry: FictionEntry): FictionValue<unknown>[] {
  const facts = entry.facts.map((fact) => fact.value);
  if (entry.kind === 'line') return facts;
  if (entry.kind === 'ship') {
    const { voyage } = entry;
    return [
      entry.lengthM,
      voyage.launchJd,
      voyage.accelerationG,
      voyage.earthYears,
      voyage.shipYears,
      voyage.orbitSpeedKmS,
      voyage.destinationMassEarth,
      ...facts,
    ];
  }
  const { orbit } = entry;
  return [
    entry.radiusKm,
    entry.massEarth,
    orbit.semiMajorAxisKm,
    orbit.eccentricity,
    orbit.inclinationDeg,
    orbit.nodeDeg,
    ...(orbit.periodDays === undefined ? [] : [orbit.periodDays]),
    ...(orbit.meanAnomalyDeg === undefined ? [] : [orbit.meanAnomalyDeg]),
    ...facts,
  ];
}

/** The overlay drawn over a real body, by the body's id; null for every other body. */
export function overlayOf(id: BodyId): FictionRecord | null {
  return FICTION_OVERLAYS.find((record) => record.anchor.kind === 'overlay' && record.anchor.body === id) ?? null;
}

const SHIP_BY_BODY = new Map<BodyId, FictionShipRecord>(FICTION_SHIPS.map((ship) => [`fiction-${ship.id}`, ship]));

/** The ship a body is, or null. */
export function fictionShipOf(id: BodyId): FictionShipRecord | null {
  return SHIP_BY_BODY.get(id) ?? null;
}

/** The body a fictional entry is found at: its own, or the real body it is drawn over or along. */
export function fictionTargetId(entry: FictionEntry): BodyId {
  if (entry.kind === 'line') return entry.planet;
  if (entry.kind !== 'ship' && entry.anchor.kind === 'overlay') return entry.anchor.body;
  return fictionBodyId(entry.id);
}

/**
 * The id a fictional entry's "about" is read by (the store's readAbout): its own page, apart from
 * the real descriptions' ids, so a page can be opened about the Petrova line while the focus is
 * Venus or about Adrian while it is τ Ceti e.
 */
export function fictionReadingId(id: string): string {
  return `fiction:${id}`;
}

/** The entry a reading id is for, or null for a real description's. */
export function fictionOfReading(reading: string): FictionEntry | null {
  return reading.startsWith('fiction:') ? fictionEntry(reading.slice('fiction:'.length)) : null;
}


const BY_ID = new Map(FICTION.map((record) => [record.id, record] as const));

/** Each record's body in the store. */
export function fictionBodyId(id: string): BodyId {
  return `fiction-${id}`;
}

const BY_BODY = new Map(FICTION.map((record) => [fictionBodyId(record.id), record] as const));

export function fictionRecord(id: string): FictionRecord | null {
  return BY_ID.get(id) ?? null;
}

/** The record a body is, or null for every real one. */
export function fictionOf(id: BodyId): FictionRecord | null {
  return BY_BODY.get(id) ?? null;
}

export function isFictionBody(id: BodyId): boolean {
  return BY_BODY.has(id) || SHIP_BY_BODY.has(id);
}

/** The entry a fictional body is -- a world or a ship -- or null for every real one. */
export function fictionEntryOfBody(id: BodyId): FictionRecord | FictionShipRecord | null {
  return BY_BODY.get(id) ?? SHIP_BY_BODY.get(id) ?? null;
}

/** The world's look, for a fictional body drawn as a sphere; null for any other body. */
export function fictionWorldLook(id: BodyId): Extract<FictionLook, { kind: 'world' }> | null {
  const look = BY_BODY.get(id)?.look;
  return look?.kind === 'world' ? look : null;
}

/**
 * The real anchor a fictional thing hangs from in the end: its own, or its planet's -- Pandora's
 * is Polyphemus's, Alpha Centauri A. Null for a chain of fictional anchors that never reaches a
 * real one, which fiction.test.ts rules out.
 */
export function realAnchorOf(record: FictionRecord): Extract<FictionAnchor, { kind: 'alphaCen' | 'overlay' }> | null {
  let current: FictionRecord | null = record;
  for (let steps = 0; current !== null && steps <= FICTION.length; steps += 1) {
    const anchor: FictionAnchor = current.anchor;
    if (anchor.kind === 'alphaCen' || anchor.kind === 'overlay') return anchor;
    current = fictionRecord(anchor.kind === 'fiction' ? anchor.id : anchor.of);
  }
  return null;
}

/**
 * The layer besides Fiction a fictional body needs on, as its real kind would: a planet's the
 * Planets, a moon's the Moons -- and a Trojan its planet's, the Planets (floatingOrigin.ts).
 */
export function fictionLayerKind(record: FictionRecord | FictionShipRecord): 'planet' | 'moon' | 'spacecraft' {
  return record.kind === 'moon' ? 'moon' : record.kind === 'ship' ? 'spacecraft' : 'planet';
}

/** The tag beside its name, on its label and in search: FICTION, and whether its place is invented. */
export function fictionTag(record: Pick<FictionBase, 'position'>): string {
  return record.position === 'invented' ? 'FICTION · POSITION INVENTED' : 'FICTION';
}

/** "Avatar (James Cameron, 2009)". */
export function workLine(work: FictionWork): string {
  return `${work.title} (${work.creator}, ${work.year})`;
}

/**
 * The records matching `query`, best first. Every word must match the name, another name, the
 * work's title or creator, or "fiction" itself -- so "avatar" lists the film's worlds and
 * "fiction" all of them -- a word in the name counting before one elsewhere, as search.ts does.
 */
export function searchFiction<T extends FictionBase = FictionEntry>(
  query: string,
  records: readonly T[] = FICTION_ENTRIES as readonly FictionBase[] as readonly T[],
): T[] {
  const words = normalizeName(query).split(' ').filter((word) => word.length > 0);
  if (words.length === 0) return [];
  const typed = words.join(' ');
  const scored: { record: T; score: number }[] = [];
  for (const record of records) {
    const names = [record.name, ...record.aliases].map(normalizeName);
    const nameWords = names.flatMap((name) => name.split(' '));
    const elsewhere = normalizeName(`${record.work.title} ${record.work.creator} fiction`);
    // A name typed whole first: "Polyphemus V" is Pandora, before Polyphemus VI.
    let score = names.includes(typed) ? -10 : 0;
    let matched = true;
    for (const word of words) {
      const inName = nameWords.includes(word)
        ? 0
        : nameWords.some((part) => part.startsWith(word))
          ? 1
          : names.some((name) => name.includes(word))
            ? 2
            : null;
      if (inName !== null) {
        score += inName;
      } else if (elsewhere.split(' ').some((part) => part.startsWith(word))) {
        score += 4;
      } else {
        matched = false;
        break;
      }
    }
    if (matched) scored.push({ record, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.record.name.localeCompare(b.record.name)).map(({ record }) => record);
}

// --- Invented positions -------------------------------------------------------------------

/**
 * A 32-bit seed from an id (FNV-1a): the same id, the same seed, in every session and browser.
 */
export function idSeed(id: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A generator of numbers in [0, 1) from a seed (mulberry32): deterministic, and plenty for placing. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** An orbit made up for a thing the canon gives no place. */
export interface InventedOrbit {
  readonly semiMajorAxisKm: number;
  readonly eccentricity: number;
  readonly inclinationDeg: number;
  readonly nodeDeg: number;
}

/**
 * The orbit a fictional thing gets where its canon gives none: drawn from its id, so it is
 * the same every time and changes only with the id. The distance spread evenly in its
 * logarithm between `minKm` and `maxKm` (a host's zone of plausible orbits, the caller's
 * choice); a mild eccentricity; a plane at any orientation, the inclination taken from the
 * sphere's even spread (its cosine uniform), as a random orbit's would be.
 */
export function inventedOrbit(
  id: string,
  bounds: { readonly minKm: number; readonly maxKm: number; readonly maxEccentricity?: number },
): InventedOrbit {
  const random = seededRandom(idSeed(id));
  const { minKm, maxKm, maxEccentricity = 0.2 } = bounds;
  return {
    semiMajorAxisKm: minKm * (maxKm / minKm) ** random(),
    eccentricity: maxEccentricity * random(),
    inclinationDeg: (Math.acos(1 - 2 * random()) * 180) / Math.PI,
    nodeDeg: 360 * random(),
  };
}
