/**
 * What is measured of the sky's famous stars beyond what the star catalogue holds -- their
 * size, mass and light, what kind of star each is and why it is known -- for the info panel of
 * the catalogue star each one is (starBodies.ts, StarFacts.tsx). Polaris, Deneb, Altair,
 * Spica, Regulus, Fomalhaut, Mira, Algol, Castor and Orion's Belt: each is a 3D star already,
 * named by the IAU (wgsn.ts), found by search and gone to as any star is; this adds the facts.
 * Joined by Hipparcos number, which every one of them has among its designations.
 *
 * Each number is its paper's, and a size or a light is at the distance that paper took, which
 * is said where it is not the catalogue's. Where a star's distance is in dispute -- Polaris,
 * Deneb, the Belt -- the panel says so and names the other measurements; the catalogue's stays
 * the one it is drawn at, except the Belt's, which the catalogue has from the literature
 * (tools/src/stars/build3d.ts OVERRIDES): Alnilam's from its association, its own parallax
 * being no distance; Alnitak's from its companion's light (Hummel et al. 2013); Mintaka's from
 * its faint member delta Ori C's Gaia parallax (Oplištilová et al. 2023, 2301.10290).
 *
 * Drawn as a disc of its measured size only where that size is the star's alone, round and at
 * the catalogue's distance: Fomalhaut. Altair and Regulus are flattened by their spin, and
 * which way their poles point is not something the app turns a star by; Spica, Algol, Castor
 * and the Belt's stars are close multiples, one point in the catalogue for two or three stars;
 * Mira's size changes by a fifth over its cycle; Deneb's and Polaris's sizes are at distances
 * other than the catalogue's. Their companions' orbits are published for some (Algol, Castor,
 * Polaris), but none is a star of its own in the catalogue to put on one (orbitingStars.ts).
 *
 * ## Sources, by arXiv number where there is one
 *
 * Evans et al. 2024 (2407.09641); Bond et al. 2018 (1712.08139); Schiller & Przybilla 2008
 * (0712.0040); Monnier et al. 2007 (0706.0867); Tkachenko et al. 2016; McAlister et al. 2005
 * (astro-ph/0501261); Gies et al. 2020; Mamajek 2012 (1206.6353); MacGregor et al. 2017
 * (1705.05867); Woodruff et al. 2004 (astro-ph/0404248); Martin et al. 2007; Baron et al. 2012
 * (1205.0754); Torres et al. 2022 (2210.16322); Hummel et al. 2013 (1306.0330); Oplištilová et
 * al. 2025 (2507.02276); Shenar et al. 2015 (1503.03476).
 */

export interface BrightStar {
  readonly hip: number;
  /** Its IAU name, the catalogue's display name. */
  readonly name: string;
  /** What kind of star: "Classical Cepheid", "Eclipsing triple". */
  readonly type: string;
  /** Measured facts, label and value, as the panel shows them. */
  readonly rows: readonly (readonly [string, string])[];
  /** Why it is known. */
  readonly note: string;
  /** Where its distance is disputed or other than its own parallax: what else is measured. */
  readonly distanceNote: string | null;
  /** Where the catalogue's distance is a published one: whose, in a few words. */
  readonly distanceSource?: string;
  /** Whose facts the rows are. */
  readonly reference: string;
  /** A disc of its measured size, and its mass (starBodies.ts): only Fomalhaut, as the header says. */
  readonly disc?: { readonly radiusSun: number; readonly massSun: number };
}

const OPLISTILOVA = 'Oplištilová et al. 2025, A&A 704, A204';

export const BRIGHT_STARS: readonly BrightStar[] = [
  {
    hip: 11767,
    name: 'Polaris',
    type: 'Classical Cepheid',
    rows: [
      ['Radius', '46.3 R☉, at 136.9 pc'],
      ['Mass', '5.13 M☉, by its companion’s orbit'],
      ['Pulsation', 'every 3.97 days'],
    ],
    note: 'The pole star, 0.74° from the north celestial pole in 2000, and the nearest Cepheid: it swells and shrinks every 3.97 days. A companion 29.4 years about it weighs it.',
    distanceNote:
      'Disputed: 133 pc here (Hipparcos); 136.9 by its companion Polaris B’s Gaia parallax, which Evans et al. take; 160 by Hubble’s (Bond et al. 2018).',
    reference: 'Evans et al. 2024, ApJ 971, 190 (CHARA)',
  },
  {
    hip: 102098,
    name: 'Deneb',
    type: 'White supergiant',
    rows: [
      ['Radius', '203 R☉, at 802 pc'],
      ['Mass', '19 M☉, from its spectrum'],
      ['Luminosity', '196,000 L☉, at 802 pc'],
      ['Temperature', '8,525 K'],
    ],
    note: 'Among the most luminous stars the eye sees unaided: the farthest of the sky’s brightest, and how far is not known well.',
    distanceNote:
      'Uncertain: Hipparcos’s parallax, 2.31 ± 0.32 mas, gives 433 pc, drawn here; as a member of the Cygnus OB7 association, 802 ± 66 pc, at which its size and light are.',
    reference: 'Schiller & Przybilla 2008, A&A 479, 849',
  },
  {
    hip: 97649,
    name: 'Altair',
    type: 'Fast rotator',
    rows: [
      ['Radius', '2.03 R☉ at the equator, 1.63 at the poles'],
      ['Spin', '92% of the rate that would break it up'],
      ['Temperature', '8,450 K at the poles, 6,860 K at the equator'],
    ],
    note: 'So fast a spinner it is flattened, its equator darker and cooler than its poles: among the first stars beyond the Sun imaged across their surface.',
    distanceNote: null,
    reference: 'Monnier et al. 2007, Science 317, 342 (CHARA)',
  },
  {
    hip: 65474,
    name: 'Spica',
    type: 'Close binary',
    rows: [
      ['Masses', '11.4 and 7.2 M☉'],
      ['Radii', '7.5 and 3.7 R☉'],
      ['Orbit', '4.01 days'],
    ],
    note: 'Two hot stars so close that each pulls the other out of round; the brighter pulsates, a β Cephei star. One point here.',
    distanceNote: null,
    reference: 'Tkachenko et al. 2016, MNRAS 458, 1964',
  },
  {
    hip: 49669,
    name: 'Regulus',
    type: 'Fast rotator',
    rows: [
      ['Radius', '4.16 R☉ at the equator, 3.14 at the poles'],
      ['Mass', '3.4 M☉'],
      ['Luminosity', '347 L☉'],
      ['Spin', '86% of its break-up speed'],
    ],
    note: 'Spinning so fast its equator is a third wider than its poles. A white dwarf in the making circles it every 40 days (Gies et al. 2020, ApJ 902, 25).',
    distanceNote: null,
    reference: 'McAlister et al. 2005, ApJ 628, 439 (CHARA)',
  },
  {
    hip: 113368,
    name: 'Fomalhaut',
    type: 'Star with a debris disc',
    rows: [
      ['Radius', '1.84 R☉'],
      ['Mass', '1.92 M☉'],
      ['Luminosity', '16.6 L☉'],
      ['Age', '440 ± 40 Myr'],
      ['Debris ring', 'from 136 AU, 13.5 AU wide (ALMA)'],
    ],
    note: 'Ringed by a belt of dust and ice, not drawn (MacGregor et al. 2017, ApJ 842, 8). TW Piscis Austrini is its wide companion.',
    distanceNote: null,
    reference: 'Mamajek 2012, ApJ 754, L20',
    disc: { radiusSun: 1.842, massSun: 1.92 },
  },
  {
    hip: 10826,
    name: 'Mira',
    type: 'Long-period variable',
    rows: [
      ['Radius', '332 to 402 R☉ through its cycle, at 107 pc'],
      ['Cycle', 'about 332 days'],
    ],
    note: 'The prototype of its class: a red giant that swells and shrinks, from V 2 to 10 and back. A tail of shed gas 13 light years long trails it (Martin et al. 2007, Nature 448, 780).',
    distanceNote: 'Its size is at 107 pc, the distance Woodruff et al. took; 92 pc here (Hipparcos).',
    reference: 'Woodruff et al. 2004, A&A 421, 703 (VLTI)',
  },
  {
    hip: 14576,
    name: 'Algol',
    type: 'Eclipsing triple',
    rows: [
      ['Masses', '3.17, 0.70 and 1.76 M☉'],
      ['Radii', '2.73, 3.48 and 1.73 R☉'],
      ['Orbits', '2.867 days, and 680 days for the third'],
    ],
    note: 'The Demon Star: every 2 days 21 hours its dim subgiant passes in front of the bright star and it fades for hours. Its two orbits are at right angles. One point here.',
    distanceNote: null,
    reference: 'Baron et al. 2012, ApJ 752, 20 (CHARA)',
  },
  {
    hip: 36850,
    name: 'Castor',
    type: 'Sextuple star',
    rows: [
      ['Stars', 'six: three pairs'],
      ['Orbits', 'A–B about 450 years; A 9.2 days; B 2.9 days'],
      ['Age', '290 Myr'],
    ],
    note: 'Two close pairs, Castor A and B, about each other; and YY Geminorum, a pair of red dwarfs that eclipse each other, 71″ away. One point here.',
    distanceNote: null,
    reference: 'Torres et al. 2022, ApJ 941, 8 (CHARA)',
  },
  {
    hip: 26727,
    name: 'Alnitak',
    type: 'O supergiant, triple',
    rows: [['Masses', '14.0 and 7.4 M☉, the inner pair']],
    note: 'The eastern star of Orion’s Belt: a hot supergiant and its companion, 7 years about each other.',
    distanceNote:
      'Drawn at 387 ± 54 pc, from its companion ζ Ori B’s brightness, which Hummel et al. adopt. Its orbit gives 294 ± 21, from small velocities; Hipparcos 225, a fit blind to the orbit. Orion OB1b: 384 ± 8 (Oplištilová et al. 2025).',
    distanceSource: 'Hummel et al. 2013, photometric',
    reference: 'Hummel et al. 2013, A&A 554, A52 (NPOI)',
  },
  {
    hip: 26311,
    name: 'Alnilam',
    type: 'Blue supergiant',
    rows: [
      ['Radius', '27.6 R☉'],
      ['Mass', '28.4 M☉'],
      ['Temperature', '25,000 K'],
    ],
    note: 'The middle star of Orion’s Belt, spinning near break-up.',
    distanceNote:
      'Its own parallax, 1.65 ± 0.45 mas (Hipparcos), is no distance; its association’s, Orion OB1b, from Gaia: 384 ± 8 pc.',
    distanceSource: 'Orion OB1b’s',
    reference: OPLISTILOVA,
  },
  {
    hip: 25930,
    name: 'Mintaka',
    type: 'Eclipsing triple',
    rows: [['Orbit', '5.73 days, the eclipsing pair']],
    note: 'The western star of Orion’s Belt: an O giant and a smaller star eclipse each other; a third star farther out.',
    distanceNote:
      'Drawn at 381 ± 8 pc, the Gaia parallax of its faint member δ Ori C (Oplištilová et al. 2023), where its stars fit (Shenar et al. 2015). Hipparcos gave 212.',
    distanceSource: 'δ Ori C’s, Gaia DR3',
    reference: 'Shenar et al. 2015, ApJ 809, 135',
  },
];

const byHip = new Map(BRIGHT_STARS.map((star) => [star.hip, star]));

/** The facts of a star by its designations ("HIP 11767" among them), or null. */
export function brightStarOf(designations: readonly string[]): BrightStar | null {
  for (const designation of designations) {
    const hip = /^HIP (\d+)$/.exec(designation);
    if (hip !== null) {
      return byHip.get(Number(hip[1])) ?? null;
    }
  }
  return null;
}
