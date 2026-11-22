import type { FictionAboutKey } from './ids.ts';

/**
 * Each fictional thing's "about" (Phase F): a few short paragraphs, read from its panel as a real
 * body's description is, but its own page and its own module -- fiction is never mixed with data.
 * Four parts, always in this order: what it is in its story, no further than the premise; what
 * the canon gives, and where; what this app invented, and why; and the real science of where it
 * is put. Quotations are kept to a few words, attributed.
 */
export interface FictionAbout {
  /** For the page's head: what it is ("Moon", "Gas giant"). */
  readonly kind: string;
  readonly story: readonly string[];
  readonly canon: readonly string[];
  readonly invented: readonly string[];
  readonly reality: readonly string[];
}

const PANDORA: FictionAbout = {
  kind: 'Moon',
  story: [
    'Pandora is the world of James Cameron’s Avatar (2009): a habitable moon of the gas giant Polyphemus, covered in rainforest, home to the Na’vi, and mined by a human company for a mineral it calls unobtanium. Its air cannot be breathed by humans, who go about it in grown Na’vi bodies they drive from afar — the avatars of the title.',
  ],
  canon: [
    'The films give no numbers. They come from the official companion book, Avatar: A Confidential Report on the Biological and Social History of Pandora (Maria Wilhelm and Dirk Mathison, 2009), whose one table gives Pandora a diameter of 11,447 km, 0.72 Earth masses, a surface gravity of 0.8 g, and air 1.2 times as dense as Earth’s at 1.1 times the pressure. The book puts it about 4.4 light years away, round α Centauri A.',
    'The table does not quite agree with itself: its own diameter and mass give 0.89 g, not 0.8. The panel shows 0.8 as printed, and says so.',
    'The official Pandorapedia makes Pandora one of Polyphemus’ fourteen moons; Stephen Baxter’s licensed The Science of Avatar (2012), the fifth. The film itself gives the journey from Earth on the starship Venture Star: 5 years, 9 months and 22 days.',
  ],
  invented: [
    'The canon gives no orbit. Pandora is put 270,000 km from Polyphemus, where the giant spans about 10° of its sky, as it looms in the films; its period, 3.8 days, follows from Kepler’s law and Polyphemus’ mass, itself invented. It is taken to be tidally locked, its day as long as that period, as large moons close to their planets are; the sphere is not turned. Its orbit lies in the plane of α Centauri A and B’s orbit about each other, which the canon does not give either.',
    'Its surface is this app’s own procedural drawing from what the films show — ocean, forest, cloud — not imagery from the films.',
  ],
  reality: [
    'α Centauri A is real: a G2 star like the Sun, 1.1 times its mass and about 1.5 times as luminous, 4.37 light years away. Light like Earth’s falls about 1.2 AU from it, and B’s eccentric orbit leaves stable orbits round A only within about 2.8 AU (Holman & Wiegert 1999), so a giant with a temperate moon there breaks no known rule.',
    'No moon has yet been confirmed round any planet of another star. In 2025 JWST reported a candidate planet of about Saturn’s mass round A in that zone, not seen again in later images (Beichman et al. 2025): unconfirmed, and drawn by this app among the real data as a candidate.',
  ],
};

const POLYPHEMUS: FictionAbout = {
  kind: 'Gas giant',
  story: [
    'Polyphemus is the giant Pandora goes round in Avatar: banded in blue and cyan, it fills a large part of Pandora’s sky, with other moons seen against it. The Na’vi call it Naranawm, “great eye” (Pandorapedia).',
  ],
  canon: [
    'The official Pandorapedia says it is comparable in size to Neptune and has fourteen moons; the companion book, the Confidential Report (2009), that it goes round α Centauri A at a distance comparable to Earth’s from the Sun. Neither gives a figure.',
    'Fan wikis, drawing on Avatar: The Game (2009), add more — a distance of 1.2 AU, a size near Jupiter’s, three gas giants round A, an atmosphere of hydrogen and helium. None of it could be traced to a primary source, and none of it is used.',
  ],
  invented: [
    'Its radius is Neptune’s, 24,622 km, read from the canon’s comparison; its mass, which the canon never gives, Neptune’s too, 17.15 Earths. It is drawn 1.23 AU from A, where A’s light equals the Sun’s at Earth — “comparable to Earth’s” made a number — on a circle in A and B’s own orbital plane, going round in 1.3 years by Kepler’s law.',
    'No rings: the films show none. Its bands and its storm, the eye its Na’vi name is for, are this app’s own procedural drawing.',
  ],
  reality: [
    'A planet of Neptune’s or Saturn’s size 1.2 AU from α Centauri A is allowed: it is well inside the 2.8 AU within which B leaves orbits round A stable (Holman & Wiegert 1999). JWST’s mid-infrared images of 2024 showed a candidate there, a planet of about Saturn’s mass in A’s habitable zone, which later images did not recover (Beichman et al. 2025). If it is real, it is the nearest giant planet to the Sun outside the Solar System.',
  ],
};

const POLYPHEMUS_FAMILY: FictionAbout = {
  kind: 'Moons and Trojans',
  story: [
    'In Avatar, Pandora is one of several moons of Polyphemus, and others hang in its daytime sky.',
  ],
  canon: [
    'Pandorapedia gives Polyphemus fourteen moons, and Baxter’s The Science of Avatar (2012) makes Pandora the fifth. Nothing else about them is canon.',
    'The names of the two innermost, Dante and Hades, and of two bodies at Polyphemus’ Lagrange points, Poly-L4 and Poly-L5, come only from Avatar: The Game (2009), as a fan wiki quotes its in-game encyclopedia. They are shown, and marked unverified.',
  ],
  invented: [
    'Everything else. The unnamed moons are numbered by their order from the planet — Polyphemus III, IV, and VI to XIV; Pandora is Polyphemus V. Their orbits run from 68,000 km, outside the distance at which Polyphemus’ tides would pull a moon apart, to 1.94 million km, inside half the region where its gravity holds a moon against A’s (its Hill sphere, 4.6 million km). Neighbours are spaced so that their periods avoid the simple ratios that would lock them into resonance.',
    'Their radii run from 50 to 2,600 km; Hades, III, IV, VI and VII are made large enough to show as discs in Pandora’s sky, as moons do in the films. The inner nine go round near Pandora’s plane; the outer five are tilted, and the last goes round backwards. Poly-L4, the larger, and Poly-L5 share Polyphemus’ orbit, 60° ahead of it and 60° behind. Every number is written down, not drawn at random, and each one’s panel says it is invented.',
  ],
  reality: [
    'This is the pattern of the Solar System’s giants: Jupiter’s known moons number nearly a hundred and Saturn’s more than 270, large ones on near-circular orbits close in, small ones on tilted and often backward orbits far out — captured, most of them. Trojans are real too: thousands share Jupiter’s orbit at its L4 and L5. Round another star’s planet, no moon and no Trojan has yet been confirmed.',
  ],
};

/** Each page by its key (ids.ts). */
export const FICTION_ABOUTS: Readonly<Record<FictionAboutKey, FictionAbout>> = {
  pandora: PANDORA,
  polyphemus: POLYPHEMUS,
  'polyphemus-family': POLYPHEMUS_FAMILY,
};
