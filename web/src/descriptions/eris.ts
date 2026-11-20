import type { Description } from './types.ts';

/**
 * Eris. Every number here is from the source it cites; where a figure is a model's rather than
 * a measurement, it sits under "estimated" and says which model. What the app draws of it is
 * read off its catalog entry (tools/src/smallBodies.ts) and Dysnomia's
 * (tools/src/moons/minorPlanetMoons.ts).
 */
export const ERIS: Description = {
  id: 'eris',
  lead: [
    'Eris is the world that made us decide what a planet is. Found in 2005 and at first apparently larger than Pluto, it left astronomers a choice — welcome a tenth planet, and perhaps dozens more to come, or draw a line — and in 2006 they drew one. It is fittingly named for the Greek goddess of discord. No spacecraft has been anywhere near it: everything we know about it has been read from a point of light, which says as much about patience and ingenuity as about Eris.',
    'Eris is a dwarf planet almost exactly the size of Pluto, 2,326 kilometres across, and about a quarter more massive. It is one of the most reflective bodies in the Solar System, white with frozen methane: it returns almost all the light that falls on it, probably because its atmosphere has frozen and fallen as fresh frost on its surface.',
    'It is nearly three times as far from the Sun as Pluto is now, at about 95 times Earth’s distance, near the far end of an orbit so stretched that it comes in to 38 times Earth’s distance and goes out to 98, and so tilted — 44° to the planets — that it is a member of the scattered disc rather than the main Kuiper belt. One trip around the Sun takes about 560 years, and sunlight now takes about thirteen hours to reach it.',
    'It has one known moon, Dysnomia, named for Eris’s daughter, the spirit of lawlessness: dark where Eris is bright, about 700 kilometres across, going round every 15.8 days. Dysnomia’s orbit is how Eris was weighed. Eris has slowed until it keeps one face turned to its moon, as the Moon does to Earth, so its day is 15.8 days long.',
    'There are no pictures of its surface. From Earth it is three hundredths of an arcsecond wide, too small for any telescope to show more than a dot, and its size was measured when it passed in front of a star in 2010 and astronomers timed how long the star disappeared. Recent spectra from the James Webb Space Telescope hint that its methane may have come from heat deep inside, so even this distant, frozen world may not be entirely inert.',
  ],
  photos: [
    {
      file: 'photos/eris/hubble-2006.webp',
      largeFile: 'photos/eris/hubble-2006-large.webp',
      width: 600,
      height: 600,
      title: 'Eris and Dysnomia from Hubble, 30 August 2006',
      caption:
        'The bright dot in the centre is Eris; the faint one to its left, Dysnomia. Neither is resolved: the size of each blob is the telescope’s, not the body’s. Images like this, with Keck’s, timed Dysnomia’s orbit and so weighed Eris. Hubble’s blue and visual filters, shown in a red-to-white scale.',
      colour: 'tinted',
      credit: 'NASA, ESA, and M. Brown (California Institute of Technology)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2006-08-30',
      sourceUrl: 'https://esahubble.org/images/opo0724b/',
    },
    {
      file: 'photos/eris/discovery-palomar.webp',
      largeFile: 'photos/eris/discovery-palomar-large.webp',
      width: 603,
      height: 200,
      title: 'How Eris was found',
      caption:
        'Time-lapse images from the Samuel Oschin Telescope at Palomar: the circled dot shifts against the fixed stars from frame to frame. A survey for slow-moving dots like this one found Eris. Shown in a false orange scale.',
      colour: 'tinted',
      credit: 'NASA/JPL/Caltech',
      licence: 'NASA media; credit requested',
      date: 'released 2005',
      sourceUrl: 'https://images.nasa.gov/details/PIA03034',
    },
  ],
  drawnHere: [
    {
      title: 'No map, because there is none',
      text: 'Eris is drawn as a plain, pale sphere of its measured size. Nothing has ever shown its surface: at its distance it is 0.03 arcseconds across, a dot in every telescope, and no spacecraft has been sent. The panel says so.',
      cite: ['sicardy2011'],
    },
    {
      title: 'Not turned',
      text: 'It has a measured period, 15.771 days, locked to Dysnomia, but no pole the IAU has adopted, so it is drawn without a spin. With no map, a spin would show nothing anyway.',
      cite: ['bernstein2023'],
    },
    {
      title: 'Drawn at the pair’s centre of mass',
      text: 'JPL’s orbit solution for Eris is for the Eris–Dysnomia system, its barycentre, and that is where Eris is drawn. Its own centre is off that point by Dysnomia’s share of their 37,273 km separation — a share no one knows, because Dysnomia’s mass has not been measured.',
      cite: ['brownschaller2007', 'holler2021'],
    },
    {
      title: 'Dysnomia',
      text: 'In the Small Moons layer, off by default: a sphere of 350 km radius in the small moons’ grey — far paler than Dysnomia really is — on JPL’s orbit for it, fitted to its positions in Hubble and Keck images, about Eris’s own centre.',
      cite: ['holler2021', 'brownbutler2018'],
    },
  ],
  measured: [
    {
      title: 'Size',
      text: 'Radius 1,163 ± 6 km and spherical, from a stellar occultation on 6 November 2010 seen from several sites — slightly smaller than Pluto’s 1,188 km.',
      cite: ['sicardy2011', 'nimmo2017'],
    },
    {
      title: 'Mass and density',
      text: 'From Dysnomia’s orbit, 1.647 × 10²² kg for Eris and Dysnomia together, 1.26 times Pluto’s mass (the first measurement, in 2007, gave 1.67 × 10²² kg). Counting both bodies’ volumes, the system’s density is 2.43 g/cm³.',
      cite: ['brownschaller2007', 'holler2021'],
    },
    {
      title: 'Brightness',
      text: 'Geometric albedo 0.96, one of the highest in the Solar System. No nitrogen, argon or methane atmosphere was detected, down to a surface pressure of about a billionth of a bar.',
      cite: ['sicardy2011'],
    },
    {
      title: 'Surface',
      text: 'Its infrared spectrum is dominated by frozen methane, like Pluto’s, while its visible colour is almost neutral where Pluto is red. Webb’s spectra show possible nitrogen ice too, and no carbon monoxide ice.',
      cite: ['brown2005', 'grundy2024'],
    },
    {
      title: 'Orbit',
      text: 'Semi-major axis 67.9 times Earth’s distance; from 38.2 at perihelion to 97.7 at aphelion; eccentricity 0.44; tilted 43.9° to the ecliptic; one orbit takes about 560 years. In 2010 it was 95.7 times Earth’s distance away, near aphelion.',
      cite: ['sbdberis', 'sicardy2011'],
    },
    {
      title: 'Its day',
      text: 'Its brightness varies by 3% over 15.771 days, matching Dysnomia’s 15.786-day orbit: Eris keeps one face toward its moon.',
      cite: ['bernstein2023'],
    },
    {
      title: 'Dysnomia',
      text: 'On an orbit 37,273 km from Eris, nearly circular (eccentricity 0.006) and prograde, every 15.786 days. ALMA measured it at about 700 km across, with an albedo of only 0.04 — very dark beside Eris.',
      cite: ['brownschaller2007', 'holler2021', 'brownbutler2018'],
    },
    {
      title: 'Discovery and name',
      text: 'By Mike Brown, Chad Trujillo and David Rabinowitz in images taken at Palomar on 21 October 2003, picked out in January 2005. Provisionally 2003 UB313; named Eris, the Greek goddess of discord, in September 2006.',
      cite: ['sbdberis', 'nasaeris'],
    },
  ],
  estimated: [
    {
      title: 'An atmosphere that comes and goes',
      text: 'Its brightness is explained as a fresh layer of frost from an atmosphere that froze out as it moved away from the Sun; the occultation team expect it may return as gas as Eris nears perihelion, about 38 times Earth’s distance from the Sun.',
      cite: ['sicardy2011'],
    },
    {
      title: 'Heat inside',
      text: 'The ratio of deuterium to hydrogen in its methane, measured by Webb, is close to that of water in comets, not of primordial methane — which suggests the methane was made by geochemistry in a warm interior, in the past or even now.',
      cite: ['grundy2024'],
    },
    {
      title: 'A giant impact',
      text: 'Eris’s spin being locked to Dysnomia fits tidal models that start from a giant impact, and is hard to reconcile with Dysnomia having been captured.',
      cite: ['bernstein2023'],
    },
  ],
  missing: [
    {
      title: 'Its surface',
      text: 'Not known: there is no image of it, and no map.',
      cite: ['sicardy2011'],
    },
    {
      title: 'Its axis',
      text: 'Not drawn: no orientation is published as rotation elements, so the app cannot turn it.',
      cite: ['bernstein2023'],
    },
    {
      title: 'Dysnomia’s mass',
      text: 'Not measured: the orbit gives the mass of the pair, not how it is shared, so the mass quoted for Eris includes Dysnomia’s.',
      cite: ['holler2021'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not bigger than Pluto',
      text: 'It was announced as bigger, and that set off the 2006 debate. The 2010 occultation and New Horizons settled it: Pluto is slightly the wider, 1,188 against 1,163 km in radius. Eris is the more massive, by about a quarter.',
      cite: ['brown2005', 'sicardy2011', 'nimmo2017', 'brownschaller2007'],
    },
    {
      title: 'Its day is not about a day long',
      text: 'An early estimate of about 26 hours is still widely quoted. Eris turns once in 15.77 days, locked to Dysnomia.',
      cite: ['nasaeris', 'bernstein2023'],
    },
    {
      title: 'Far away is not dark',
      text: 'At about 95 times Earth’s distance Eris gets roughly a nine-thousandth of the sunlight Earth does, yet its surface is among the most reflective in the Solar System, geometric albedo 0.96.',
      cite: ['sicardy2011'],
    },
  ],
  sources: [
    {
      key: 'sbdberis',
      text: 'JPL Small-Body Database, 136199 Eris (2003 UB313), orbit solution 103 and discovery circumstances',
      url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=136199',
    },
    {
      key: 'nasaeris',
      text: 'NASA Science, Eris',
      url: 'https://science.nasa.gov/dwarf-planets/eris/',
    },
    {
      key: 'de440',
      text: 'Park, R. S., et al. 2021, The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161, 105',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
    },
    {
      key: 'brown2005',
      text: 'Brown, M. E., Trujillo, C. A., & Rabinowitz, D. L. 2005, Discovery of a Planetary-sized Object in the Scattered Kuiper Belt, ApJ 635, L97',
      url: 'https://doi.org/10.1086/499336',
    },
    {
      key: 'sicardy2011',
      text: 'Sicardy, B., et al. 2011, A Pluto-like radius and a high albedo for the dwarf planet Eris from an occultation, Nature 478, 493',
      url: 'https://doi.org/10.1038/nature10550',
    },
    {
      key: 'brownschaller2007',
      text: 'Brown, M. E., & Schaller, E. L. 2007, The Mass of Dwarf Planet Eris, Science 316, 1585',
      url: 'https://doi.org/10.1126/science.1139415',
    },
    {
      key: 'holler2021',
      text: 'Holler, B. J., et al. 2021, The Eris/Dysnomia system I: The orbit of Dysnomia, Icarus 355, 114130',
      url: 'https://doi.org/10.1016/j.icarus.2020.114130',
    },
    {
      key: 'bernstein2023',
      text: 'Bernstein, G. M., et al. 2023, Synchronous Rotation in the (136199) Eris–Dysnomia System, PSJ 4, 115',
      url: 'https://doi.org/10.3847/PSJ/acdd5f',
    },
    {
      key: 'brownbutler2018',
      text: 'Brown, M. E., & Butler, B. J. 2018, Medium-sized Satellites of Large Kuiper Belt Objects, AJ 156, 164',
      url: 'https://doi.org/10.3847/1538-3881/aad9f2',
    },
    {
      key: 'grundy2024',
      text: 'Grundy, W. M., et al. 2024, Measurement of D/H and ¹³C/¹²C ratios in methane ice on Eris and Makemake: Evidence for internal activity, Icarus 411, 115923',
      url: 'https://doi.org/10.1016/j.icarus.2023.115923',
    },
    {
      key: 'nimmo2017',
      text: 'Nimmo, F., et al. 2017, Mean radius and shape of Pluto and Charon from New Horizons images, Icarus 287, 12',
      url: 'https://doi.org/10.1016/j.icarus.2016.06.027',
    },
  ],
};
