import type { DescriptionPhoto } from '../types.ts';
import type { FictionAboutKey } from './ids.ts';

/**
 * A picture on a fictional thing's about: only the work's own -- an image from the film or the
 * franchise, few and small and credited to the studio, as an encyclopaedia shows a film's stills
 * (Maxi, 2026-11-22: only the works' images; without them the page does not show what the thing
 * is). From the film's official site, or supplied by the project's author; never a wallpaper or
 * scraper site. An about may have none. abouts.test.ts checks each one's studio, source and size.
 */
export interface FictionPhoto extends DescriptionPhoto {
  readonly origin: 'film';
  /**
   * For a film's image, what its note says it is: an official site's ("Official image", when
   * absent), a frame of the film, or the franchise's -- a licensed game's.
   */
  readonly filmNote?: 'Image from the film' | 'Image from the franchise';
}

/** Avatar's studio, and Project Hail Mary's, as their images are credited. */
const AVATAR_STUDIO = '© 20th Century Studios';
const HAIL_MARY_STUDIO = '© Amazon MGM Studios';

/**
 * The source of a film image the project's author supplied himself (Maxi, 2026-11-22), which has
 * no page to link to.
 */
export const SUPPLIED_BY_AUTHOR = 'supplied by the project’s author';

/**
 * A film image the author supplied (web/public/photos/fiction/film/), small as the official ones:
 * a 640-pixel thumbnail and a large copy 800 pixels wide at most, never enlarged.
 */
function suppliedStill(
  name: string,
  size: { readonly width: number; readonly height: number },
  studio: string,
  note: NonNullable<FictionPhoto['filmNote']>,
  title: string,
  caption: string,
): FictionPhoto {
  return {
    file: `photos/fiction/film/${name}.webp`,
    largeFile: `photos/fiction/film/${name}-large.webp`,
    ...size,
    title,
    caption: `${caption} Shown small for illustration; it belongs to the studio.`,
    colour: 'true',
    credit: studio,
    licence: 'All rights reserved; shown small for illustration in a non-commercial project',
    date: SUPPLIED_BY_AUTHOR,
    sourceUrl: SUPPLIED_BY_AUTHOR,
    origin: 'film',
    filmNote: note,
  };
}

/**
 * An image from the film's official site (web/public/photos/fiction/film/): a 640-pixel thumbnail
 * and a large copy 800 pixels wide at most, no larger -- shown small, for illustration.
 */
function filmStill(name: string, title: string, caption: string, sourceUrl: string): FictionPhoto {
  return {
    file: `photos/fiction/film/${name}.webp`,
    largeFile: `photos/fiction/film/${name}-large.webp`,
    width: 640,
    height: 360,
    title,
    caption: `${caption} An image from the film’s own official site, shown small for illustration; it belongs to the studio.`,
    colour: 'true',
    credit: AVATAR_STUDIO,
    licence: 'All rights reserved; shown small for illustration in a non-commercial project',
    date: 'avatar.com, Pandorapedia',
    sourceUrl,
    origin: 'film',
  };
}

const AVATAR_POLYPHEMUS_STILL = filmStill(
  'polyphemus-and-moons',
  'Polyphemus and its moons, as Avatar shows them',
  'Polyphemus’ blue bands and great storm, with five of its moons before it.',
  'https://www.avatar.com/pandorapedia/polyphemus',
);

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
  /** The works' own images only, the film's first; may be empty. */
  readonly photos: readonly FictionPhoto[];
  readonly story: readonly string[];
  readonly canon: readonly string[];
  readonly invented: readonly string[];
  readonly reality: readonly string[];
}

const PANDORA: FictionAbout = {
  kind: 'Moon',
  photos: [
    suppliedStill(
      'pandora-and-polyphemus-film',
      { width: 300, height: 168 },
      AVATAR_STUDIO,
      'Image from the film',
      'Pandora before Polyphemus, as Avatar shows them',
      'Pandora, green and blue under cloud, with Polyphemus and its great storm behind.',
    ),
    filmStill(
      'pandora-from-space',
      'Pandora from space, as Avatar shows it',
      'Pandora whole: green continents and blue seas under cloud.',
      'https://www.avatar.com/pandorapedia/pandora',
    ),
    filmStill(
      'hallelujah-mountains',
      'The Hallelujah Mountains, as Avatar shows them',
      'Pandora’s floating mountains, in their haze.',
      'https://www.avatar.com/pandorapedia/the-hallelujah-mountains',
    ),
  ],
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
  photos: [
    AVATAR_POLYPHEMUS_STILL,
    suppliedStill(
      'polyphemus-over-the-mountains',
      { width: 640, height: 360 },
      AVATAR_STUDIO,
      // A game's frame by its look -- Avatar: Frontiers of Pandora, under licence -- not the film's.
      'Image from the franchise',
      'Polyphemus over the floating mountains',
      'Polyphemus and its great storm filling Pandora’s night sky above the floating mountains, probably from the licensed game Avatar: Frontiers of Pandora.',
    ),
  ],
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
  photos: [
    AVATAR_POLYPHEMUS_STILL,
  ],
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

const ADRIAN: FictionAbout = {
  kind: 'Planet · drawn over τ Ceti e',
  photos: [
    suppliedStill(
      'adrian-from-orbit',
      { width: 640, height: 360 },
      HAIL_MARY_STUDIO,
      'Image from the film',
      'Adrian from orbit, as Project Hail Mary shows it',
      'Adrian’s green and amber clouds swirling below, a ship and a figure in a spacesuit before them.',
    ),
  ],
  story: [
    'In Andy Weir’s Project Hail Mary (2021), a microbe called Astrophage is dimming the Sun. τ Ceti, 11.9 light years away, is infected too but is not dimming, and the Hail Mary is sent to find out why. Adrian is the planet there that τ Ceti’s own line of Astrophage runs to.',
  ],
  canon: [
    'The novel gives few numbers. Adrian’s gravity is stronger than Earth’s, so a low orbit is “just over 12 kilometers per second”, and the ship must hold 12.6 to stay in orbit; its air is rich in carbon dioxide, with methane. The film’s shooting script labels the planet’s model “TAU CETI E”, and NASA’s explainer of the story’s science makes the same identification.',
    'Figures that circulate for it — 3.93 Earth masses, a radius of 10,318 km, 1.4 g, an air of 91% carbon dioxide — come from an AI-written wiki and are not in the text of the novel that could be checked. The first is simply the real candidate’s minimum mass. None of them is used here.',
  ],
  invented: [
    'Adrian is not drawn as a second planet: it is τ Ceti e itself, the real candidate the app draws from Feng et al.’s 2017 fit, seen in a fiction’s look while the Fiction layer is on. Its orbit, period and size stay that fit’s and its estimate’s; only the look — a deck of turbulent cloud in deep and yellow greens with amber and orange zones, wound into eddies under thick air, its limb glowing green, this app’s own procedural drawing after the 2026 film — and the name are the fiction’s. With the layer off, nothing about τ Ceti e changes.',
    'Its mass is invented for one purpose, the ship’s orbit. At the real candidate’s minimum, 3.93 Earths, the novel’s 12.6 km/s would put that orbit below the 11,530 km sphere the app draws; at 5.0 Earths, which an unknown tilt of the orbit allows, it is 12,550 km from the centre, a thousand kilometres up, and the gravity at the ground about 1.5 g.',
  ],
  reality: [
    'τ Ceti is real: a star like the Sun, a little smaller and poorer in metals, 11.9 light years away, ringed by a dust belt some ten times as massive as the Kuiper belt. Four planets were proposed for it in 2017 from tiny wobbles in its light; studies since, from 2024 and 2025, find the signals more likely the star’s own activity, so τ Ceti e is drawn grey, as a candidate. Were it real, it would be four Earth masses at least, taking about 1.8 times the light Earth takes from the Sun.',
  ],
};

const HAIL_MARY: FictionAbout = {
  kind: 'Starship',
  photos: [
    suppliedStill(
      'hail-mary-in-space',
      { width: 640, height: 360 },
      HAIL_MARY_STUDIO,
      'Image from the film',
      'The Hail Mary in space, as Project Hail Mary shows it',
      'The ship under way among the stars, its radiators to one side.',
    ),
    suppliedStill(
      'hail-mary-over-the-aurora',
      { width: 640, height: 360 },
      HAIL_MARY_STUDIO,
      'Image from the film',
      'The Hail Mary over Earth’s aurora',
      'The ship in Earth orbit before it leaves, above the green and red of an aurora.',
    ),
  ],
  story: [
    'The Hail Mary is the ship of Project Hail Mary: a last-ditch mission from Earth to τ Ceti, to learn why that star, alone among the Sun’s infected neighbours, is not dimming. It is driven by Astrophage itself, the microbe that stores starlight as mass and gives it back as infrared light.',
  ],
  canon: [
    'The novel gives the voyage as thirteen years as Earth counts them, and the ship’s speed in orbit about Adrian once there, 12.6 km/s. A constant acceleration of 1.5 g, turning over halfway, and some three years and nine months aboard are widely quoted from it but were not found in the text that could be checked; they are shown, marked unverified. Its crew is three. Its length is given in passing: when the centrifuge’s cables are paid out, its radius grows from 20 m, half the ship’s length, to 75 m — so about 40 m, not the 47 m an AI-written wiki gives.',
  ],
  invented: [
    'The launch date, which the canon does not give: 1 January 2026, so that the ship is in flight now and leaves from where the exact ephemerides place Earth. Its route, straight from where Earth is at launch to where τ Ceti e will be at arrival; and its orbit at the end, at the canon’s speed and 12,550 km from Adrian’s centre, from Adrian’s invented mass. The novel’s arrival — into orbit about τ Ceti first, then about Adrian — is made one. The model is a fan-made model of the ship as the 2026 film shows it — a wide white drum at the stern, two long cylinders splaying from it on fluted cones and a thinner, longer one between them, two strips of radiators to one side — scaled to the novel’s 40 m; its crew section parts from the rest on cables for the centrifuge, as in the novel.',
  ],
  reality: [
    'The relativity is real, worked out here from the trip’s two numbers alone. At a constant 1.5 g, turning over halfway, 11.9 light years take 13.1 years as Earth counts them and 3.9 aboard; at the turnover the ship is at 0.995 of light’s speed, its clock running ten times slower than Earth’s — the novel’s thirteen years and its quoted three years and nine months. Launched on 1 January 2026, it arrives in February 2039. The drive is the fiction: even turning fuel wholly into light, the trip would take some four hundred times the ship’s own mass of it.',
  ],
};

const PETROVA: FictionAbout = {
  kind: 'Line of Astrophage',
  photos: [],
  story: [
    'In Project Hail Mary, astronomers first notice the Sun’s trouble as a faint line of infrared light running from the Sun to Venus — the Petrova line, named for the astronomer who saw it. It is Astrophage, a microbe living at the Sun’s surface, on its way to Venus to breed and back, glowing as it goes. A second Petrova line, from τ Ceti to Adrian, shows that star infected too.',
  ],
  canon: [
    'The novel describes each line as a faint arc of light, dark red and seen only in the infrared, through an instrument it calls the Petrovascope: one from the Sun to Venus, one from τ Ceti to Adrian. It gives no width and no brightness for either.',
  ],
  invented: [
    'Each is drawn straight, from the star’s centre to the planet’s, a single faint line in dark red — the colour a choice, since infrared light has none an eye can see. With the Fiction layer off, neither is there and neither costs anything. Venus is the real Venus: nothing else about it changes.',
  ],
  reality: [
    'Nothing like it exists. The space between the Sun and Venus holds the thin solar wind and the zodiacal dust, watched by many spacecraft; and the Sun’s output, which the novel has falling, has been measured from orbit since 1978 and varies by about a tenth of a percent over each eleven-year cycle.',
  ],
};

/** Each page by its key (ids.ts). */
export const FICTION_ABOUTS: Readonly<Record<FictionAboutKey, FictionAbout>> = {
  pandora: PANDORA,
  polyphemus: POLYPHEMUS,
  'polyphemus-family': POLYPHEMUS_FAMILY,
  adrian: ADRIAN,
  'hail-mary': HAIL_MARY,
  petrova: PETROVA,
};
