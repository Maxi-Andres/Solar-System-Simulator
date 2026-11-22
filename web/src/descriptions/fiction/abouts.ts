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

/** Avatar's studio, Project Hail Mary's and Star Trek's, as their images are credited. */
const AVATAR_STUDIO = '© 20th Century Studios';
const HAIL_MARY_STUDIO = '© Amazon MGM Studios';
const STAR_TREK_STUDIO = '© CBS Studios';

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
 * An image from a work's official site (web/public/photos/fiction/film/): a 640-pixel thumbnail
 * and a large copy 800 pixels wide at most, no larger -- shown small, for illustration.
 */
function officialStill(
  name: string,
  site: { readonly studio: string; readonly name: string; readonly width?: number; readonly height?: number },
  title: string,
  caption: string,
  sourceUrl: string,
): FictionPhoto {
  return {
    file: `photos/fiction/film/${name}.webp`,
    largeFile: `photos/fiction/film/${name}-large.webp`,
    width: site.width ?? 640,
    height: site.height ?? 360,
    title,
    caption: `${caption} An image from the work’s own official site, shown small for illustration; it belongs to the studio.`,
    colour: 'true',
    credit: site.studio,
    licence: 'All rights reserved; shown small for illustration in a non-commercial project',
    date: site.name,
    sourceUrl,
    origin: 'film',
  };
}

/** Avatar's official site, its encyclopedia. */
const PANDORAPEDIA = { studio: AVATAR_STUDIO, name: 'avatar.com, Pandorapedia' } as const;

/** An image from Pandorapedia, 640 by 360. */
function filmStill(name: string, title: string, caption: string, sourceUrl: string): FictionPhoto {
  return officialStill(name, PANDORAPEDIA, title, caption, sourceUrl);
}

/** Star Trek's official site, startrek.com. */
const STARTREK_COM = { studio: STAR_TREK_STUDIO, name: 'startrek.com' } as const;

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

const ERID: FictionAbout = {
  kind: 'Planet',
  photos: [],
  story: [
    'Erid is the home world of Rocky, the alien engineer the Hail Mary’s pilot meets at τ Ceti in Andy Weir’s Project Hail Mary (2021). Its star, 40 Eridani A, is infected with Astrophage and dimming too, and Rocky’s ship, the Blip-A, was sent to τ Ceti for the same reason as the Hail Mary. Eridians live in a hot, crushing air of ammonia and know the world by sound.',
  ],
  canon: [
    'The novel gives a few numbers: Erid’s gravity, which Rocky gives as 20.48 m/s², a little over twice Earth’s; its air, ammonia; and his ship kept at 29 atmospheres and 210 °C, as at home. It puts 40 Eridani ten light years from τ Ceti.',
    'The rest is from Weir’s own Eridian Species Information Document, which he shared with readers. Erid is “the first planet orbiting Eridani A”, 0.224 AU out on an orbit of eccentricity 0.04, its year 42.245 days; 8.47 Earth masses and 12,835 km in radius, 2.09 g at the ground; 28 atmospheres of ammonia over a surface at 210 °C, where water stays liquid under the pressure and the oceans are at 202 °C; a day of 5.1104 hours, and a magnetic field about 25 times Earth’s. In a 2026 interview Weir put its year at 46 days; the document’s figure is used.',
  ],
  invented: [
    'The plane of its orbit, which neither source gives: tilted 60° to the sky, and shared with Vulcan’s, so the two orbits are seen open from Earth rather than edge on.',
    'The distance it is drawn at. The document’s 0.224 AU and 42.245 days together imply a star of 0.84 Suns, where 40 Eridani A is measured at 0.78 (Ma et al. 2018). The period, the number Weir took from the real candidate, is kept, and the orbit drawn at the 0.219 AU it gives about the real mass; the panel shows both. Its look, this app’s own procedural drawing, is derived from the physics in Weir’s document: a deep, hot ammonia haze over a dark ground, its limb wide because hot, light ammonia gives the air a scale height of some 9.5 km. The film does not show Erid from space.',
  ],
  reality: [
    '40 Eridani A is real: an orange dwarf a little smaller than the Sun, 16.3 light years away. A white dwarf and a red dwarf, 40 Eridani B and C, go round each other every 230 years, together some 400 AU from it; the app draws both where the star catalogue places them, and from Erid they would be the brightest stars in the sky.',
    'In 2018 a planet of at least 8.47 Earth masses was reported round A, 0.22 AU out with a period of 42.4 days (Ma et al. 2018): the candidate Weir built Erid on, which the press called Vulcan. In 2024 Burrows et al., in a paper titled “The Death of Vulcan”, showed with the NEID spectrograph that the signal is the star’s own activity — its spots coming round as it turns — and not a planet. The app does not draw it. At 0.22 AU, A gives some nine times the light Earth gets: an Earth-like world there would be far too hot, which is why Weir gave Erid its thick, hot air.',
  ],
};

const VULCAN: FictionAbout = {
  kind: 'Planet',
  photos: [
    officialStill(
      'vulcan-from-orbit',
      { ...STARTREK_COM, height: 269 },
      'Vulcan from orbit, as Star Trek shows it',
      'The Enterprise over Vulcan’s red-orange deserts and white cloud.',
      'https://www.startrek.com/news/vulcan-like-planet-found-for-real',
    ),
    officialStill(
      'vulcan-surface',
      { ...STARTREK_COM, width: 550, height: 300 },
      'Vulcan’s surface, as Star Trek shows it',
      'Red desert hills under a hazy sky, a ring of stone pillars on a height and a city beyond.',
      'https://www.startrek.com/news/vulcan-like-planet-found-for-real',
    ),
  ],
  story: [
    'Vulcan is the home world of Spock’s people in Star Trek, from the first series (1966) on: a hot, dry desert planet of thin air, whose people live by logic. In the later series, reunited with their Romulan cousins, they call it Ni’Var.',
  ],
  canon: [
    'Its star is 40 Eridani A. Star Trek: Picard names it on screen (“Maps and Legends”, 2020), Discovery shows it on a map (2017), and Enterprise puts Vulcan a little over 16 light years from Earth (“Home”, 2004). The choice goes back to a letter Gene Roddenberry signed with three astronomers in Sky & Telescope in July 1991, “Vulcan’s Sun”: 40 Eridani A is about four billion years old, time enough for life to rise, and its two companions would shine brilliantly in Vulcan’s sky.',
    'An older placement, in the Star Trek Spaceflight Chronology (1979), puts Vulcan at ε Eridani instead, a star of about a billion years; Roddenberry preferred 40 Eridani for its age.',
    'Of the world itself the canon gives little. Vulcan has no moon (Spock, “The Man Trap”, 1966); it is hot, its air thin (“Amok Time”, 1967); from orbit it is red-orange and tan desert. Its size, mass, day and orbit are given nowhere. That its gravity is stronger than Earth’s is an old assumption of the franchise, never given a figure on screen; the 1.4 g often quoted is fan lore, and is not used.',
  ],
  invented: [
    'Its orbit and its size. Vulcan is drawn 0.62 AU from 40 Eridani A, in the star’s habitable zone — A gives 0.46 of the Sun’s light, so Earth’s share falls at 0.68 AU — at 1.2 times the light Earth gets, warm enough for the desert the series shows. That is 0.4 AU outside Erid, far enough that both orbits stay stable; its year, by Kepler’s law, is about 202 days. The orbit is nearly circular and lies in Erid’s plane.',
    'Its radius is Earth’s, 6,371 km, and its mass 1.2 Earths, so that its gravity is 1.2 g: higher than Earth’s, as the franchise holds, without the fans’ figure. No moon is drawn, as Spock says; the large body seen in its sky in Star Trek: The Motion Picture (1979), which licensed books later called T’Khut, is not canon and not drawn. Its look, a red-orange desert under hazy air, is this app’s own procedural drawing after the series.',
  ],
  reality: [
    '40 Eridani is real, 16.3 light years away: A, an orange dwarf a little smaller than the Sun; B, a white dwarf, the first ever recognised, in 1910; and C, a red dwarf. B and C go round each other every 230 years, together some 400 AU from A, and from a world round A they would shine as a brilliant pair, as the 1991 letter said. The app draws all three where the star catalogue places them.',
    'In 2018 the press greeted a candidate planet round A as “Vulcan”: 0.22 AU out, far too close and too hot for the series’ world. In 2024 Burrows et al., in “The Death of Vulcan”, showed the signal was the star’s activity and not a planet. No planet is known round A today, and its habitable zone, near 0.6 to 0.7 AU, is as far as anyone can yet tell empty.',
  ],
};

const BLIP_A: FictionAbout = {
  kind: 'Starship',
  photos: [
    suppliedStill(
      'blip-a-and-hail-mary',
      { width: 640, height: 297 },
      HAIL_MARY_STUDIO,
      'Image from the film',
      'The Blip-A close, the Hail Mary beside it, as Project Hail Mary shows them',
      'The Blip-A’s dark bronze needles streaming past, its jagged core among them, and the white Hail Mary small beside it.',
    ),
    suppliedStill(
      'hail-mary-docked-at-blip-a',
      { width: 640, height: 294 },
      HAIL_MARY_STUDIO,
      'Image from the film',
      'The Hail Mary docked against the Blip-A, as Project Hail Mary shows them',
      'The Hail Mary, a small white craft, against the Blip-A’s core and its wide flat fan of needles.',
    ),
  ],
  story: [
    'The Blip-A is Rocky’s ship in Project Hail Mary: sent from Erid to τ Ceti, as the Hail Mary was from Earth, to learn why that star is not dimming. When the Hail Mary arrives only Rocky is left aboard.',
  ],
  canon: [
    'The novel: it has been at τ Ceti for 46 years when the Hail Mary arrives, in orbit close by — “maybe a few hundred meters away”, the pilot first judges; later it holds station 217 m off. Through his telescope it is “roughly triangle-shaped”, with “gable-like protrusions along its hull”, every face flat, a mottled grey and tan; at its centre is a diamond-shaped part about the size of the Hail Mary. It is built of xenonite, a material Eridians can make in any shape, and inside it keeps Erid’s air: ammonia at 29 atmospheres and 210 °C. Later the two ships are joined by a xenonite tunnel.',
    'The 2026 film’s ship looks nothing like the novel’s. It is not a hull at all but two vast spindles of needles side by side, each thousands of long, thin rods thickest at the middle and tapering to points at both ends, joined at their middles by a hub and clamped by a row of peaked frames, whose tops make a sawtooth seen from the side; dark bronze and gold. Docked beside it, the Hail Mary is a small craft.',
  ],
  invented: [
    'Its model takes the 2026 film’s general configuration, as the Hail Mary’s does, every detail this app’s own: two mirrored spindles of some 800 rods each, 46 m wide and 38 m through with a 42 m gap between them, 134 m across in all, joined by a faceted hub and clamped by five chevron frames, bronze and gold. Its length, which the novel never gives, is 400 m, scaled from the film’s stills against the Hail Mary’s 40 m — about ten Hail Marys. From the novel it keeps its flat faces, its xenonite and its lack of lights: Eridians have no eyes, so from afar it is a plain dot.',
    'Where it is: on the Hail Mary’s own orbit round Adrian, its needles along its motion, 400 m ahead of where the Hail Mary will be — “a few hundred meters”, as the novel says, and far enough that the film-sized ship and the Hail Mary’s spinning centrifuge stay clear of each other. It is there from 46 years before the Hail Mary’s arrival — 1993, as the app dates that arrival — on. The novel has it round τ Ceti when the Hail Mary comes, the two moving to Adrian later; as the Hail Mary’s arrival is made one, so is its stay. Its trip from Erid, which the canon does not describe, is not drawn.',
  ],
  reality: [
    'No such ship exists, nor any material like xenonite. τ Ceti is real, 11.9 light years from the Sun, and 40 Eridani 16.3; the two are about 10 light years apart, as the novel says. τ Ceti e, which Adrian is drawn over, is a candidate planet that studies since 2024 find more likely the star’s own activity.',
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
  erid: ERID,
  'blip-a': BLIP_A,
  vulcan: VULCAN,
};
