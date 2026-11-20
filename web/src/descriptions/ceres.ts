import type { Description } from './types.ts';

const DAWN_CREDIT = 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA';

/**
 * Ceres. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of it
 * is read off its catalog entry (tools/src/smallBodies.ts, Dawn's in catalog.ts) and
 * public/textures/CREDITS.md.
 */
export const CERES: Description = {
  id: 'ceres',
  lead: [
    'Ceres was found on the first night of the nineteenth century, and has been renamed by our categories ever since: hailed as a planet, filed among the asteroids, and since 2006 called a dwarf planet — the same small world all along, a reminder that the names are ours and the thing is its own. When the Dawn spacecraft went into orbit around it in 2015, the dark little body turned out to be wetter than anyone had pictured: salty water once welled up through its crust, and some may still lie deep inside.',
    'Ceres is the largest object in the asteroid belt between Mars and Jupiter, 939 kilometres across, and holds about a quarter of the belt’s entire mass. It is the only dwarf planet in the inner Solar System, and the only one in the belt massive enough to have pulled itself round. Its surface is dark — it reflects only 9% of the light that falls on it — and nearly grey, a mixture of clays, carbonates and salts.',
    'Its most famous features are the bright spots in Occator crater, which puzzled astronomers as Dawn approached. They are deposits of salt, mostly sodium carbonate, left where brine reached the surface and its water froze and escaped as vapour. Nearby stands Ahuna Mons, a lone mountain 4 kilometres high that seems to have been built by a volcano of icy mud rather than lava. Water ice lies just beneath the surface at higher latitudes, and Ceres has been seen giving off water vapour.',
    'Its rocks contain ammonia-bearing clays, which suggests that some of its material formed far out in the cold of the outer Solar System. Its interior is partly separated into layers, rock below and a lighter, ice- and salt-rich shell above, and the largest craters its long history should have left are missing.',
    'Ceres goes round the Sun once every 4.6 years at an average 2.8 times Earth’s distance; sunlight takes about 23 minutes to reach it. It spins once every 9 hours, almost upright, its axis tilted only 4°. Dawn studied it from orbit from March 2015 until its fuel ran out on 31 October 2018, at the end flying as low as 35 kilometres above the surface; the silent spacecraft is still in orbit around it.',
  ],
  photos: [
    {
      file: 'photos/ceres/true-colour.webp',
      largeFile: 'photos/ceres/true-colour-large.webp',
      width: 640,
      height: 640,
      title: 'Ceres as an eye would see it, 2015',
      caption:
        'Made by DLR from Dawn’s red, green and blue filter images from its first science orbit, with the colour worked out from how Ceres reflects each wavelength of sunlight. A dark, almost neutral grey-brown.',
      colour: 'true',
      credit: DAWN_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2015',
      sourceUrl: 'https://images.nasa.gov/details/PIA21079',
    },
    {
      file: 'photos/ceres/occator-globe.webp',
      largeFile: 'photos/ceres/occator-globe-large.webp',
      width: 640,
      height: 640,
      title: 'Ceres centred on Occator',
      caption:
        'A globe assembled from images Dawn took 385 km above the surface, at 140 m a pixel, centred on Occator crater, 20°N, 239°E, with its bright spots. Black and white, from the clear filter; Ceres is nearly this grey.',
      colour: 'true',
      credit: DAWN_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2016 (released 2017)',
      sourceUrl: 'https://images.nasa.gov/details/PIA21906',
    },
    {
      file: 'photos/ceres/last-look.webp',
      largeFile: 'photos/ceres/last-look-large.webp',
      width: 640,
      height: 640,
      title: 'One of Dawn’s last views, 1 September 2018',
      caption:
        'Looking south over Ceres from 3,370 km, climbing away from the low point of its final orbit, two months before its fuel ran out. Occator, 92 km across and 4 km deep, is at upper right with its bright deposits. Black and white.',
      colour: 'true',
      credit: DAWN_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2018-09-01',
      sourceUrl: 'https://images.nasa.gov/details/PIA22485',
    },
    {
      file: 'photos/ceres/occator.webp',
      largeFile: 'photos/ceres/occator-large.webp',
      width: 640,
      height: 640,
      title: 'Occator crater and its bright spots',
      caption:
        'A mosaic from Dawn’s low orbit: the brightest area on Ceres, Cerealia Facula, in the centre of the crater, with a dome in a smooth-walled pit, and the smaller Vinalia Faculae to its right. The bright material is salt. Black and white.',
      colour: 'true',
      credit: `${DAWN_CREDIT}/PSI`,
      licence: 'NASA media, not copyrighted',
      date: '2015–2016',
      sourceUrl: 'https://images.nasa.gov/details/PIA20350',
    },
    {
      file: 'photos/ceres/ahuna-mons.webp',
      largeFile: 'photos/ceres/ahuna-mons-large.webp',
      width: 640,
      height: 708,
      title: 'Ahuna Mons, December 2015',
      caption:
        'Ceres’s lone mountain, 4 km high and about 17 km wide, with bright streaks down its steep flanks, seen from above in a mosaic of Dawn’s low-orbit images. Black and white.',
      colour: 'true',
      credit: `${DAWN_CREDIT}/PSI`,
      licence: 'NASA media, not copyrighted',
      date: '2015-12',
      sourceUrl: 'https://images.nasa.gov/details/PIA20348',
    },
    {
      file: 'photos/ceres/enhanced-colour.webp',
      largeFile: 'photos/ceres/enhanced-colour-large.webp',
      width: 640,
      height: 480,
      title: 'Ceres in enhanced colour, 29 April 2017',
      caption:
        'Taken with Dawn exactly between the Sun and Ceres, through the clear filter and five colour filters, the differences stretched: Cerealia Facula is the bright spot in Occator at the centre; the blue and dark patches are ejecta of different make-up. Not what an eye would see.',
      colour: 'false',
      credit: DAWN_CREDIT,
      licence: 'NASA media, not copyrighted',
      date: '2017-04-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA21406',
    },
    {
      file: 'photos/ceres/hubble-2004.webp',
      largeFile: 'photos/ceres/hubble-2004-large.webp',
      width: 250,
      height: 250,
      title: 'Ceres from Hubble, before Dawn',
      caption:
        'The best view of Ceres until Dawn arrived, its contrast raised to show any detail at all: a blurred disc with a few brighter and darker patches. Colour from Hubble’s filters, not calibrated to an eye.',
      colour: 'false',
      credit: 'NASA, ESA, J. Parker (SwRI), P. Thomas (Cornell), L. McFadden (Maryland), M. Mutchler and Z. Levay (STScI)',
      licence: 'NASA media, not copyrighted',
      date: 'released 2005-09-07',
      sourceUrl: 'https://images.nasa.gov/details/PIA10235',
    },
  ],
  drawnHere: [
    {
      title: 'Its map',
      text: 'Dawn’s global mosaic from its high mapping orbit of August to October 2015, at 140 m a pixel, assembled by DLR, downscaled to 2,048 pixels round — about 1.5 km a pixel at the equator. Clear filter, so grey, which is close to Ceres’s own nearly neutral colour; the salt of Occator shows as a bright speck.',
      cite: ['roatsch2016', 'pia21079'],
    },
    {
      title: 'What Dawn did not see',
      text: 'The south polar cap, south of about 85°S, and the deepest shadows near both poles were never imaged under light: 8.9% of the map. They are filled with the average of the mapped surface and blended at the edges. Nothing there is an observation.',
      cite: ['roatsch2016'],
    },
    {
      title: 'Placed by a crater under a kilometre wide',
      text: 'The map is laid out in the IAU’s longitude system for Ceres, where 0° runs through the tiny crater Kait, and turned by the IAU’s rotation: measured through the renderer, Cerealia Facula lands 0.37° from where the nomenclature puts it, two pixels of the map.',
      cite: ['archinal2018'],
    },
    {
      title: 'A little too wide',
      text: 'It is drawn with the IAU 2015 radii, 487.3 km at the equator and 446 km at the poles. Dawn’s shape model gives 482.2 by 482.1 by 445.9 km, so the equator is drawn 5 km, about 1%, too wide.',
      cite: ['archinal2018', 'park2016'],
    },
    {
      title: 'Dawn is still there',
      text: 'The spacecraft is drawn in orbit around Ceres, where JPL’s final trajectory leaves it: its mission ended when its hydrazine ran out on 31 October 2018, and since then the positions are JPL’s prediction of the orbit it was left in. Its working years fall outside the stretch of time the app holds for it.',
      cite: ['pia22980'],
    },
  ],
  measured: [
    {
      title: 'Size, shape and mass',
      text: 'Mean diameter 939.4 km; its axes 964.4, 964.2 and 891.8 km. GM 62.6284 km³/s², a mass of 9.4 × 10²⁰ kg; density 2,162 kg/m³. Its gravity field shows it in hydrostatic equilibrium and only partly separated into layers.',
      cite: ['park2016', 'sbdbceres'],
    },
    {
      title: 'Orbit',
      text: 'Semi-major axis 2.766 times Earth’s distance; eccentricity 0.080; tilted 10.6° to the ecliptic; one orbit every 1,680 days, 4.60 years.',
      cite: ['sbdbceres'],
    },
    {
      title: 'Its day',
      text: 'It turns once in 9.074170 hours, about a pole at right ascension 291.42°, declination 66.76°; its axis is tilted about 4° to its orbit.',
      cite: ['park2016', 'nasaceres'],
    },
    {
      title: 'Discovery',
      text: 'By Giuseppe Piazzi at Palermo on 1 January 1801 — the first object of the asteroid belt ever found.',
      cite: ['sbdbceres', 'nasaceres'],
    },
    {
      title: 'A dark, altered surface',
      text: 'Geometric albedo 0.09. Infrared spectra show clays bearing ammonia spread across the whole surface; hydrogen measured by Dawn’s neutron and gamma-ray detectors shows water ice just beneath the soil at mid to high latitudes. Small patches carry organic compounds.',
      cite: ['sbdbceres', 'desanctis2015', 'prettyman2017', 'desanctis2017'],
    },
    {
      title: 'Occator’s salt',
      text: 'Occator is 92 km across and 4 km deep. The bright deposits in it are mostly sodium carbonate — the most concentrated carbonate known beyond Earth on scales of kilometres — mixed with ammonium salts like some found in Enceladus’s plume.',
      cite: ['pia22485', 'desanctis2016'],
    },
    {
      title: 'Ahuna Mons',
      text: 'A single mountain about 17 km wide and 4 km high, its flanks at the angle of repose, its summit cracked: unlike anything else on Ceres.',
      cite: ['ruesch2016'],
    },
    {
      title: 'Water vapour',
      text: 'The Herschel space telescope detected water vapour around Ceres, at least 10²⁶ molecules a second, from localized sources.',
      cite: ['kuppers2014'],
    },
    {
      title: 'Missing big craters',
      text: 'Parts of it are heavily cratered, but the largest craters expected from its history are absent; none is wider than about 280 km.',
      cite: ['russell2016', 'nasaceres'],
    },
    {
      title: 'Dawn',
      text: 'Arrived on 6 March 2015, the first spacecraft to orbit a dwarf planet, after orbiting Vesta; it ended its mission on 31 October 2018, having flown its last orbit as low as about 35 km.',
      cite: ['russell2016', 'nasaceres', 'pia22980', 'pia22485'],
    },
  ],
  estimated: [
    {
      title: 'Where the salt came from',
      text: 'Dawn’s detailed gravity map around Occator points to a reservoir of brine deep in the crust, which the impact that made the crater heated and cracked open, letting it seep up over a long time. An interpretation of gravity data.',
      cite: ['raymond2020'],
    },
    {
      title: 'An ice volcano',
      text: 'Ahuna Mons’s shape is explained as a dome of thick, muddy brine pushed up from inside — a cryovolcano — not lava. A model fitted to its shape and age.',
      cite: ['ruesch2016'],
    },
    {
      title: 'Born farther out?',
      text: 'Ammonia would not condense where Ceres orbits now. Its ammonia-bearing clays suggest it either formed farther from the Sun or took in material from the outer Solar System.',
      cite: ['desanctis2015'],
    },
  ],
  missing: [
    {
      title: 'Its relief',
      text: 'Not drawn: Ahuna Mons, 4 km high, and Occator’s 4 km depth are shades on a smooth ellipsoid.',
      cite: ['ruesch2016', 'pia22485'],
    },
    {
      title: 'Its colours',
      text: 'The map is from the clear filter only. Dawn’s colour images, which bring out differences in make-up between terrains, exist only as separate products per filter, too large to be used here.',
      cite: ['roatsch2016'],
    },
    {
      title: 'Its water vapour',
      text: 'Not drawn: no thin cloud of vapour around it.',
      cite: ['kuppers2014'],
    },
  ],
  misconceptions: [
    {
      title: 'It is not just a large asteroid',
      text: 'It is massive enough to be round and in hydrostatic equilibrium, which is what made it a dwarf planet under the IAU’s 2006 definition — and it holds water ice beneath its surface.',
      cite: ['iau2006', 'park2016', 'prettyman2017'],
    },
    {
      title: 'The bright spots are not ice, or lights',
      text: 'They are salt — mostly sodium carbonate — left where brine reached the surface.',
      cite: ['desanctis2016'],
    },
    {
      title: 'Asteroids did not stop being planets because they share an orbit',
      text: 'For about 150 years after Ceres was found, the scientific literature treated asteroids as small planets; they were set apart in the 1950s, as they came to be seen as geophysically unlike the large planets — Ceres being the main exception.',
      cite: ['metzger2019'],
    },
  ],
  sources: [
    {
      key: 'sbdbceres',
      text: 'JPL Small-Body Database, 1 Ceres (orbit solution 48; physical data after Park et al. 2016 and Li et al. 2006)',
      url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=1',
    },
    {
      key: 'nasaceres',
      text: 'NASA Science, Ceres: Facts',
      url: 'https://science.nasa.gov/dwarf-planets/ceres/facts/',
    },
    {
      key: 'archinal2018',
      text: 'Archinal, B. A., et al. 2018, Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015, Celest. Mech. Dyn. Astron. 130, 22',
      url: 'https://doi.org/10.1007/s10569-017-9805-5',
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
      key: 'metzger2019',
      text: 'Metzger, P. T., Sykes, M. V., Stern, A., & Runyon, K. 2019, The reclassification of asteroids from planets to non-planets, Icarus 319, 21',
      url: 'https://doi.org/10.1016/j.icarus.2018.08.026',
    },
    {
      key: 'russell2016',
      text: 'Russell, C. T., et al. 2016, Dawn arrives at Ceres: Exploration of a small, volatile-rich world, Science 353, 1008',
      url: 'https://doi.org/10.1126/science.aaf4219',
    },
    {
      key: 'park2016',
      text: 'Park, R. S., et al. 2016, A partially differentiated interior for (1) Ceres deduced from its gravity field and shape, Nature 537, 515',
      url: 'https://doi.org/10.1038/nature18955',
    },
    {
      key: 'roatsch2016',
      text: 'Roatsch, T., et al. 2016, High-resolution Ceres High Altitude Mapping Orbit atlas derived from Dawn Framing Camera images, Planet. Space Sci. 129, 103',
      url: 'https://doi.org/10.1016/j.pss.2016.05.011',
    },
    {
      key: 'desanctis2015',
      text: 'De Sanctis, M. C., et al. 2015, Ammoniated phyllosilicates with a likely outer Solar System origin on (1) Ceres, Nature 528, 241',
      url: 'https://doi.org/10.1038/nature16172',
    },
    {
      key: 'desanctis2016',
      text: 'De Sanctis, M. C., et al. 2016, Bright carbonate deposits as evidence of aqueous alteration on (1) Ceres, Nature 536, 54',
      url: 'https://doi.org/10.1038/nature18290',
    },
    {
      key: 'desanctis2017',
      text: 'De Sanctis, M. C., et al. 2017, Localized aliphatic organic material on the surface of Ceres, Science 355, 719',
      url: 'https://doi.org/10.1126/science.aaj2305',
    },
    {
      key: 'prettyman2017',
      text: 'Prettyman, T. H., et al. 2017, Extensive water ice within Ceres’ aqueously altered regolith: Evidence from nuclear spectroscopy, Science 355, 55',
      url: 'https://doi.org/10.1126/science.aah6765',
    },
    {
      key: 'ruesch2016',
      text: 'Ruesch, O., et al. 2016, Cryovolcanism on Ceres, Science 353, aaf4286',
      url: 'https://doi.org/10.1126/science.aaf4286',
    },
    {
      key: 'kuppers2014',
      text: 'Küppers, M., et al. 2014, Localized sources of water vapour on the dwarf planet (1) Ceres, Nature 505, 525',
      url: 'https://doi.org/10.1038/nature12918',
    },
    {
      key: 'raymond2020',
      text: 'Raymond, C. A., et al. 2020, Impact-driven mobilization of deep crustal brines on dwarf planet Ceres, Nature Astronomy 4, 741',
      url: 'https://doi.org/10.1038/s41550-020-1168-2',
    },
    {
      key: 'pia21079',
      text: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA 2016, Ceres in Color (PIA21079)',
      url: 'https://images.nasa.gov/details/PIA21079',
    },
    {
      key: 'pia22485',
      text: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA 2018, Last Look: Ceres (PIA22485)',
      url: 'https://images.nasa.gov/details/PIA22485',
    },
    {
      key: 'pia22980',
      text: 'NASA/JPL-Caltech/UCLA/MPS/DLR/IDA/PSI 2018, Stars on Occator’s Floor (PIA22980): the end of Dawn’s mission operations, 31 October 2018',
      url: 'https://images.nasa.gov/details/PIA22980',
    },
  ],
};
