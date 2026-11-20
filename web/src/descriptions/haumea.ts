import type { Description } from './types.ts';

/**
 * Haumea. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of it
 * is read off its catalog entry (tools/src/smallBodies.ts) and its moons'
 * (tools/src/moons/minorPlanetMoons.ts).
 */
export const HAUMEA: Description = {
  id: 'haumea',
  lead: [
    'Haumea is the strangest shape among the large worlds: it spins so fast — a day lasts under four hours — that it is stretched into the shape of a flattened rugby ball, more than twice as long as it is thick. It carries a ring, two moons and a family of icy fragments thrown off in some ancient collision, and yet no one has ever seen it as more than a few pixels. It is named for the Hawaiian goddess of childbirth, whose many children sprang from different parts of her body: apt for a world that scattered pieces of itself across the outer Solar System.',
    'Haumea is a dwarf planet in the Kuiper belt, beyond Neptune. It is about 2,300 kilometres long but only about 1,000 kilometres from pole to pole, and its surface is bright crystalline water ice. It weighs about a third as much as Pluto.',
    'Its rotation, once every 3.9 hours, was when measured the fastest known for any body in the Solar System larger than 100 kilometres. That spin, its two moons — Hiʻiaka and Namaka — and a family of smaller icy bodies on similar orbits, with the same water-ice surfaces, are all thought to come from one giant collision billions of years ago, which knocked off much of its icy outer layer.',
    'In 2017 astronomers at several observatories timed a star as Haumea passed in front of it, and found something no one expected: a narrow ring, about 70 kilometres wide, circling it 2,290 kilometres from its centre, in the plane of its equator. It was the first ring found around anything beyond Neptune.',
    'Haumea goes round the Sun in about 283 years, between 35 and 51 times Earth’s distance, on an orbit tilted 28°; sunlight now takes about seven hours to reach it. Its discovery was disputed: a team in Spain and a team in the United States both found it, and the official record credits observations at the Sierra Nevada Observatory in Spain on 7 March 2003. There are no close-up pictures: no spacecraft has been there, and the only images show it as a dot.',
  ],
  photos: [
    {
      file: 'photos/haumea/hubble-2015.webp',
      largeFile: 'photos/haumea/hubble-2015-large.webp',
      width: 231,
      height: 130,
      title: 'Haumea and its two moons from Hubble, 30 June 2015',
      caption:
        'Haumea is the bright dot in the centre; its moons are the two faint dots on either side of it. None of the three is resolved — this is all any telescope has shown of it. NASA publishes it only at this small size. Black and white, from Hubble’s Wide Field Camera 3.',
      colour: 'true',
      credit: 'NASA, ESA, and D. Ragozzine (Brigham Young University); image processing: Gladys Kober (NASA/Catholic University of America)',
      licence: 'NASA media; credit requested',
      date: '2015-06-30',
      sourceUrl: 'https://science.nasa.gov/image-detail/haumea-30jun2015-22-28ok2-final-16x9/',
    },
  ],
  drawnHere: [
    {
      title: 'Why it is only a marker',
      text: 'Its three axes are measured, but no one has published where its long axis points at a given moment — a rotational phase — so an ellipsoid could not be turned to where Haumea really is. A wrongly turned ellipsoid would claim more than is known; it is drawn as a marker, and the panel gives its size.',
      cite: ['ortiz2017'],
    },
    {
      title: 'Drawn at the system’s centre of mass',
      text: 'JPL’s orbit solution for Haumea is for the Haumea system, its barycentre, and that is where Haumea is drawn; its own centre is off that point by its moons’ small share of the mass, Hiʻiaka’s mostly.',
      cite: ['ragozzine2009'],
    },
    {
      title: 'Its moons',
      text: 'Hiʻiaka and Namaka are in the Small Moons layer, off by default, on JPL’s fitted orbits about Haumea’s centre. Namaka’s orbit is disturbed by Hiʻiaka’s pull and cannot be described by a simple ellipse, and both are known only from telescope images, so their positions are far less certain than a planet’s moons’.',
      cite: ['ragozzine2009'],
    },
    {
      title: 'No ring, no map',
      text: 'The ring is not drawn: rings are drawn only for Saturn so far. There is no map, because nothing has ever shown Haumea’s surface.',
      cite: ['ortiz2017'],
    },
  ],
  measured: [
    {
      title: 'Shape and size',
      text: 'Semi-axes of about 1,161, 852 and 513 km, from a stellar occultation on 21 January 2017 combined with its light curve: its longest axis at least 2,322 ± 60 km. Too elongated for a uniform body in hydrostatic equilibrium at its spin.',
      cite: ['ortiz2017'],
    },
    {
      title: 'Spin',
      text: 'Once every 3.9154 hours, from a double-peaked light curve: its brightness swings by 0.28 magnitudes as its long side turns towards us and away.',
      cite: ['rabinowitz2006'],
    },
    {
      title: 'Mass and density',
      text: 'Mass 4.006 × 10²¹ kg, from the orbits of its moons; density at most 1,885 kg/m³, from that mass and the occultation’s size.',
      cite: ['ragozzine2009', 'ortiz2017'],
    },
    {
      title: 'Surface',
      text: 'Geometric albedo 0.51. Its spectrum is dominated by crystalline water ice. No nitrogen or methane atmosphere was found, down to pressures of 15 and 50 billionths of a bar.',
      cite: ['ortiz2017', 'trujillo2007'],
    },
    {
      title: 'The ring',
      text: 'About 70 km wide, half opaque, 2,287 km from Haumea’s centre, in the plane of its equator and of Hiʻiaka’s orbit; near a 3:1 resonance with its spin, where ring particles go round once for every three of Haumea’s turns.',
      cite: ['ortiz2017'],
    },
    {
      title: 'Moons',
      text: 'Hiʻiaka, the outer and brighter, found on 26 January 2005, and Namaka, found on 7 November 2005, both with the Keck telescope’s adaptive optics; both move in nearly the same plane.',
      cite: ['sbdbhaumea', 'ragozzine2009'],
    },
    {
      title: 'Orbit',
      text: 'Semi-major axis 43.1 times Earth’s distance, from 34.7 to 51.4; eccentricity 0.19; tilted 28.2° to the ecliptic; about 283 years a revolution.',
      cite: ['sbdbhaumea'],
    },
    {
      title: 'Discovery and name',
      text: 'Credited to observations at the Sierra Nevada Observatory in Spain on 7 March 2003, by F. J. Aceituno, P. Santos-Sanz and J. L. Ortiz in JPL’s database; a team in the US had found it too, NASA notes that two teams claim it, and the IAU lists no official discoverer. Provisionally 2003 EL61; named for the Hawaiian goddess of childbirth, its moons for two of her daughters.',
      cite: ['sbdbhaumea', 'nasahaumea'],
    },
    {
      title: 'Its family',
      text: 'A group of Kuiper belt objects with orbits and water-ice surfaces nearly identical to Haumea’s: the first collisional family found beyond Neptune.',
      cite: ['brown2007'],
    },
  ],
  estimated: [
    {
      title: 'One collision behind it all',
      text: 'A giant impact is thought to have set Haumea spinning, stripped much of its icy mantle into the family, and made its moons. Their nearly shared plane and a density like water ice fit that story; it is an inference from them.',
      cite: ['brown2007', 'ragozzine2009'],
    },
  ],
  missing: [
    {
      title: 'Its shape, on screen',
      text: 'Measured but not drawn, for want of a published rotational phase.',
      cite: ['ortiz2017'],
    },
    {
      title: 'Its ring',
      text: 'Measured but not drawn.',
      cite: ['ortiz2017'],
    },
    {
      title: 'Its surface',
      text: 'Never seen: no spacecraft has gone, and from Earth it is a dot.',
      cite: ['nasahaumea'],
    },
  ],
  misconceptions: [
    {
      title: 'Dwarf planets are not all round',
      text: 'The IAU’s definition asks for a hydrostatic equilibrium, “nearly round” shape. Haumea, spinning every 3.9 hours, is stretched to more than twice as long as it is thick — and its measured shape does not even match a uniform fluid body’s, so how its interior is arranged is still open.',
      cite: ['iau2006', 'rabinowitz2006', 'ortiz2017'],
    },
    {
      title: 'Rings are not only for giant planets',
      text: 'Haumea’s ring was the first found beyond Neptune; before it, rings had been found around the small Centaurs Chariklo and Chiron.',
      cite: ['ortiz2017'],
    },
  ],
  sources: [
    {
      key: 'sbdbhaumea',
      text: 'JPL Small-Body Database, 136108 Haumea (2003 EL61), orbit solution 132, discovery circumstances and naming citation',
      url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=136108',
    },
    {
      key: 'nasahaumea',
      text: 'NASA Science, Haumea',
      url: 'https://science.nasa.gov/dwarf-planets/haumea/',
    },
    {
      key: 'de440',
      text: 'Park, R. S., et al. 2021, The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161, 105',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
    },
    {
      key: 'iau2006',
      text: 'International Astronomical Union 2006, Resolutions B5, Definition of a Planet in the Solar System, and B6, Pluto (XXVIth General Assembly)',
      url: 'https://www.iau.org/Iau/Publications/List-of-Resolutions/',
    },
    {
      key: 'ortiz2017',
      text: 'Ortiz, J. L., et al. 2017, The size, shape, density and ring of the dwarf planet Haumea from a stellar occultation, Nature 550, 219',
      url: 'https://doi.org/10.1038/nature24051',
    },
    {
      key: 'rabinowitz2006',
      text: 'Rabinowitz, D. L., et al. 2006, Photometric Observations Constraining the Size, Shape, and Albedo of 2003 EL61, a Rapidly Rotating, Pluto-sized Object in the Kuiper Belt, ApJ 639, 1238',
      url: 'https://doi.org/10.1086/499575',
    },
    {
      key: 'ragozzine2009',
      text: 'Ragozzine, D., & Brown, M. E. 2009, Orbits and Masses of the Satellites of the Dwarf Planet Haumea (2003 EL61), AJ 137, 4766',
      url: 'https://doi.org/10.1088/0004-6256/137/6/4766',
    },
    {
      key: 'brown2007',
      text: 'Brown, M. E., et al. 2007, A collisional family of icy objects in the Kuiper belt, Nature 446, 294',
      url: 'https://doi.org/10.1038/nature05619',
    },
    {
      key: 'trujillo2007',
      text: 'Trujillo, C. A., et al. 2007, The Surface of 2003 EL61 in the Near-Infrared, ApJ 655, 1172',
      url: 'https://doi.org/10.1086/509861',
    },
  ],
};
