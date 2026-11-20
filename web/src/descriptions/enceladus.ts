import type { Description } from './types.ts';

/**
 * Enceladus. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a surface gravity, a map's mean brightness), the point says so. Where a
 * figure is a model's rather than a measurement, it sits under "estimated" and says which.
 */
export const ENCELADUS: Description = {
  id: 'enceladus',
  lead: [
    'Enceladus is a small, bright moon that sprays its hidden ocean into space — so a spacecraft could taste that ocean without landing. Cassini flew through the spray and found salt, organic molecules, the hydrogen that hot water and rock make together on Earth’s sea floors, and phosphorus. No life was found; but nowhere else beyond Earth are so many of the ingredients known to come together.',
    'Enceladus is one of Saturn’s mid-sized moons, only about 500 kilometres across — about as wide as Arizona. Its surface is nearly pure, fresh ice, and it reflects more of the sunlight that falls on it than any other known body, so it stays at about −200 °C. Much of it is old and cratered; but its south pole is young, crossed by four long, parallel fractures, the “tiger stripes”, from which more than a hundred jets of water vapour and ice grains rise.',
    'Beneath the ice is a global ocean of salt water. Cassini showed it three ways: by Enceladus’s gravity, by a slight wobble in its rotation that only a shell floating free of its core would allow, and by the spray itself. Tiny grains of silica in it can only form where hot water, around 90 °C or more, meets rock, so hot springs probably vent on its sea floor. The heat comes from Saturn’s tides, kept up because Dione, farther out, goes round exactly once for every two of Enceladus’s orbits.',
    'The spray feeds Saturn’s broad, faint E ring, within which Enceladus orbits, 238,000 kilometres from Saturn, once every 32.9 hours, always with the same face toward the planet. William Herschel discovered it on 28 August 1789. Cassini found the plumes in 2005 and flew as close as 25 kilometres above it; the James Webb Space Telescope has since seen the water it releases spread over ten thousand kilometres.',
  ],
  photos: [
    {
      file: 'photos/enceladus/cassini-approach-2015.webp',
      largeFile: 'photos/enceladus/cassini-approach-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Approaching Enceladus, 28 October 2015',
      caption:
        'From 96,000 km, before Cassini’s closest dive over the south pole: cratered terrain in the north, then fractured, wrinkled ground, and at the bottom the wavy edge of the active south polar region, disappearing into winter darkness. The Saturn-facing side. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2015-10-28',
      sourceUrl: 'https://images.nasa.gov/details/PIA17202',
    },
    {
      file: 'photos/enceladus/cassini-false-colour-2005.webp',
      largeFile: 'photos/enceladus/cassini-false-colour-2005-large.webp',
      width: 640,
      height: 754,
      title: 'The tiger stripes in false colour, 14 July 2005',
      caption:
        'Twenty-one images from ultraviolet to infrared, combined into the side facing away from Saturn. The fractures come out blue because their walls expose coarse-grained ice, free of the fine powder on flat ground; to an eye, Enceladus is white all over.',
      colour: 'false',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2005-07-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA06254',
    },
    {
      file: 'photos/enceladus/cassini-fountains-2005.webp',
      largeFile: 'photos/enceladus/cassini-fountains-2005-large.webp',
      width: 640,
      height: 542,
      title: 'Fountains over the south pole, 27 November 2005',
      caption:
        'Enceladus backlit by the Sun, its dark night side facing Cassini: discrete jets rising from the tiger stripes, lit from behind as dust is in a sunbeam. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2005-11-27',
      sourceUrl: 'https://images.nasa.gov/details/PIA07758',
    },
    {
      file: 'photos/enceladus/cassini-geyser-basin-2009.webp',
      largeFile: 'photos/enceladus/cassini-geyser-basin-2009-large.webp',
      width: 640,
      height: 396,
      title: 'The geyser basin, 21 November 2009',
      caption:
        'Plumes large and small along the four tiger stripes — from left to right Alexandria, Cairo, Baghdad and Damascus, each about 135 km long. One of Cassini’s sharpest views of the jets. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2009-11-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA11688',
    },
    {
      file: 'photos/enceladus/cassini-saturn-crescent-2009.webp',
      largeFile: 'photos/enceladus/cassini-saturn-crescent-2009-large.webp',
      width: 640,
      height: 640,
      title: 'A crescent before Saturn, 21 November 2009',
      caption:
        'From 17,000 km, the crescent of Enceladus at top right and the limb of Saturn at left — and at the centre, faint plumes rising from the south pole. Enceladus is the nearer of the two. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2009-11-21',
      sourceUrl: 'https://images.nasa.gov/details/PIA11683',
    },
    {
      file: 'photos/enceladus/cassini-rings-2011.webp',
      largeFile: 'photos/enceladus/cassini-rings-2011-large.webp',
      width: 640,
      height: 640,
      title: 'Before the rings, 6 November 2011',
      caption:
        'From 145,000 km: Enceladus against Saturn’s sunlit rings, with its plume just visible at the south pole, at the bottom. The bright speck to its right is a distant star. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2011-11-06',
      sourceUrl: 'https://images.nasa.gov/details/PIA21900',
    },
    {
      file: 'photos/enceladus/cassini-tectonics-2008.webp',
      largeFile: 'photos/enceladus/cassini-tectonics-2008-large.webp',
      width: 623,
      height: 900,
      title: 'Leaving Enceladus, 9 October 2008',
      caption:
        'Taken just after Cassini passed 25 km above the surface: fractures, folds and ridges, few craters, and the kilometre-deep chasm Labtayt Sulci above the centre. Enhanced colour from ultraviolet, visible and infrared filters, 338 to 930 nm: blue-green marks coarser ice grains, not a colour an eye would see.',
      colour: 'false',
      credit: 'NASA/JPL/Space Science Institute',
      licence: 'NASA media, not copyrighted',
      date: '2008-10-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA11133',
    },
  ],
  drawnHere: [
    {
      title: 'Far too dark',
      text: 'The most reflective body known is drawn darker than the Moon. The map’s average, read as how much light the surface reflects, is 0.23; the Moon’s map averages 0.48. Enceladus really reflects about eight times as much as the Moon — geometric albedo 1.0 against 0.12. Worked out here from the two maps’ pixels and the fact sheets.',
      cite: ['nssdcSaturnian', 'nssdcMoon'],
    },
    {
      title: 'Its map, filtered',
      text: 'USGS’s global mosaic of Cassini images, 100 m per pixel at the source, high-pass filtered: the broad differences in brightness across the moon were taken out to show the fractures and craters, so what is left is relief and texture, not how bright each region is. It is black and white, from clear-filter images. At 2,048 pixels round, each pixel here is about 0.8 km at the equator, worked out here.',
    },
    {
      title: 'Which ephemeris',
      text: 'Its positions are JPL’s satellite ephemeris for Saturn’s moons, SAT441, the same one its mass comes from — not DE441, which carries only the Sun, the planets and our Moon.',
      cite: ['jplSats'],
    },
    {
      title: 'Only near today',
      text: 'JPL’s table is fetched for one year either side of the day the data were built, a sample every 75 minutes. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its shape, and its face to Saturn',
      text: 'A triaxial ellipsoid of 256.6 by 251.4 by 248.3 km, its long axis toward Saturn, as the IAU gives it, turned by the IAU’s model so the same face stays on Saturn. The IAU model has no wobble for it; the 0.12° libration Cassini measured is not drawn.',
      cite: ['archinal2018', 'thomas2016'],
    },
    {
      title: 'Cassini',
      text: 'Cassini’s close flybys of Enceladus — the closest dive over its south pole on 28 October 2015 — came before the app’s window, which begins ten years before the data were built; only its final months at Saturn are on its drawn path.',
      cite: ['pia17202'],
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 252.1 km, about 504 km across; mass 1.08 × 10²⁰ kg, mean density 1.61 g/cm³ — rock and ice. Gravity at the surface 0.11 m/s², worked out here from its GM and radius: about an eighty-sixth of Earth’s.',
      cite: ['jplSats', 'nssdcSaturnian'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 238,020 km from Saturn’s centre, 3.95 Saturn radii; one orbit in 1.370 days, 32.9 hours; eccentricity 0.0045. It goes round twice for each orbit of Dione, which keeps its orbit slightly eccentric and its tides working.',
      cite: ['nssdcSaturnian', 'nasaEnceladus'],
    },
    {
      title: 'The brightest surface',
      text: 'Its geometric albedo in visible light is 1.375 — it sends back more light toward the Sun than a perfectly white, flat, diffusing disc would — because fresh ice from the plumes keeps repainting it. So little sunlight is absorbed that its surface is about −201 °C.',
      cite: ['verbiscer2007', 'nasaEnceladus'],
    },
    {
      title: 'The plumes',
      text: 'Found by Cassini in 2005: jets of water vapour and ice grains from the four tiger stripes near the south pole. A survey of the south polar region counted 101 geysers, nearly all along the stripes. Cassini’s ultraviolet spectrometer measured water vapour escaping at about 150 kg a second.',
      cite: ['porco2006', 'porco2014', 'hansen2006'],
    },
    {
      title: 'Its heat',
      text: 'Cassini’s infrared spectrometer measured 15.8 gigawatts of heat coming out of the south polar region.',
      cite: ['howett2011'],
    },
    {
      title: 'The ocean',
      text: 'Cassini’s gravity data first showed a sea under the south pole. Then seven years of images showed Enceladus wobbling in its rotation by 0.120 ± 0.014° — too much for an ice shell attached to the core, so the shell floats on an ocean that covers the whole moon.',
      cite: ['iess2014', 'thomas2016'],
    },
    {
      title: 'Hot springs',
      text: 'Nanometre grains of silica in Saturn’s E ring, traced to Enceladus, can form only where water at about 90 °C or more reacts with rock. Molecular hydrogen in the plume, measured as Cassini flew through it, is what such reactions make, and on Earth microbes live on it.',
      cite: ['hsu2015', 'waite2017'],
    },
    {
      title: 'Phosphorus',
      text: 'Cassini’s dust analyser found sodium phosphates in ice grains from the plume: phosphorus, the scarcest of the elements life on Earth needs, at concentrations at least a hundred times those in Earth’s oceans.',
      cite: ['postberg2023'],
    },
    {
      title: 'The E ring',
      text: 'Cassini’s dust detector, flying past, showed the plumes are the main source of the grains of Saturn’s E ring.',
      cite: ['spahn2006'],
    },
    {
      title: 'Seen from afar',
      text: 'The James Webb Space Telescope, in results published in 2023, saw the water from Enceladus extending up to 10,000 km, forty times its radius, at a rate of about 300 kg a second — little changed since Cassini.',
      cite: ['villanueva2023'],
    },
  ],
  estimated: [
    {
      title: 'How thick the ice is',
      text: 'Models fitted to its gravity and shape give an ice shell about 20 to 25 km thick on average and perhaps only 1 to 5 km at the south pole, where the jets break through.',
      cite: ['nasaEnceladus'],
    },
    {
      title: 'How hot the springs are',
      text: 'The 90 °C is the lowest temperature at which laboratory experiments and models make silica grains like those found; the springs themselves are not seen.',
      cite: ['hsu2015'],
    },
  ],
  missing: [
    {
      title: 'The plumes',
      text: 'Not drawn: the jets, rising hundreds of kilometres and seen best backlit, as in the photographs above.',
      cite: ['porco2006'],
    },
    {
      title: 'The E ring',
      text: 'Not drawn: only Saturn’s main rings are, out to about 142,000 km. Enceladus orbits at 238,000 km inside the faint E ring it feeds.',
      cite: ['spahn2006', 'nssdcSaturnian'],
    },
    {
      title: 'Saturn’s shadow',
      text: 'Not drawn on Enceladus: Saturn casts its shadow only on its rings here, so Enceladus stays lit when it passes behind Saturn.',
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the ridges and the kilometre-deep fractures are a picture on a smooth ellipsoid.',
      cite: ['pia17202'],
    },
  ],
  misconceptions: [
    {
      title: 'No life has been found',
      text: 'Cassini found water, salts, organic molecules, hydrogen and phosphorus — ingredients and energy that life on Earth uses. That is not life, and Cassini carried no instrument that could detect it.',
      cite: ['waite2017', 'postberg2023'],
    },
    {
      title: 'Small does not mean dead',
      text: 'It is about 500 km across, and still its south pole gives off 15.8 gigawatts. The heat is tidal, from Saturn, not left over from its formation.',
      cite: ['howett2011', 'nasaEnceladus'],
    },
    {
      title: 'The ocean is not just under the south pole',
      text: 'The first gravity results suggested a regional sea there; the measured wobble shows the ocean is global.',
      cite: ['iess2014', 'thomas2016'],
    },
    {
      title: 'It is not blue',
      text: 'The blue tiger stripes of many famous pictures are false colour, ultraviolet to infrared. To an eye Enceladus is a brilliant white.',
      cite: ['verbiscer2007'],
    },
  ],
  sources: [
    {
      key: 'nssdcSaturnian',
      text: 'Williams, D. R., Saturnian Satellite Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/saturniansatfact.html',
    },
    {
      key: 'nssdcMoon',
      text: 'Williams, D. R., Moon Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    },
    {
      key: 'jplSats',
      text: 'JPL Solar System Dynamics, Planetary Satellite Physical Parameters (GM from SAT441; mean radius from the IAU 2015 report)',
      url: 'https://ssd.jpl.nasa.gov/sats/phys_par/',
    },
    {
      key: 'de440',
      text: 'Park, R. S., et al. 2021, The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161, 105',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
    },
    {
      key: 'archinal2018',
      text: 'Archinal, B. A., et al. 2018, Report of the IAU Working Group on Cartographic Coordinates and Rotational Elements: 2015, Celest. Mech. Dyn. Astron. 130, 22',
      url: 'https://doi.org/10.1007/s10569-017-9805-5',
    },
    {
      key: 'nasaEnceladus',
      text: 'NASA Science, Enceladus (Saturn’s moons)',
      url: 'https://science.nasa.gov/saturn/moons/enceladus/',
    },
    {
      key: 'verbiscer2007',
      text: 'Verbiscer, A., French, R., Showalter, M., & Helfenstein, P. 2007, Enceladus: Cosmic Graffiti Artist Caught in the Act, Science 315, 815',
      url: 'https://doi.org/10.1126/science.1134681',
    },
    {
      key: 'porco2006',
      text: 'Porco, C. C., et al. 2006, Cassini Observes the Active South Pole of Enceladus, Science 311, 1393',
      url: 'https://doi.org/10.1126/science.1123013',
    },
    {
      key: 'porco2014',
      text: 'Porco, C., DiNino, D., & Nimmo, F. 2014, How the Geysers, Tidal Stresses, and Thermal Emission across the South Polar Terrain of Enceladus are Related, AJ 148, 45',
      url: 'https://doi.org/10.1088/0004-6256/148/3/45',
    },
    {
      key: 'hansen2006',
      text: 'Hansen, C. J., et al. 2006, Enceladus’ Water Vapor Plume, Science 311, 1422',
      url: 'https://doi.org/10.1126/science.1121254',
    },
    {
      key: 'howett2011',
      text: 'Howett, C. J. A., et al. 2011, High heat flow from Enceladus’ south polar region measured using 10–600 cm⁻¹ Cassini/CIRS data, J. Geophys. Res. 116, E03003',
      url: 'https://doi.org/10.1029/2010JE003718',
    },
    {
      key: 'iess2014',
      text: 'Iess, L., et al. 2014, The Gravity Field and Interior Structure of Enceladus, Science 344, 78',
      url: 'https://doi.org/10.1126/science.1250551',
    },
    {
      key: 'thomas2016',
      text: 'Thomas, P. C., et al. 2016, Enceladus’s measured physical libration requires a global subsurface ocean, Icarus 264, 37',
      url: 'https://doi.org/10.1016/j.icarus.2015.08.037',
    },
    {
      key: 'hsu2015',
      text: 'Hsu, H.-W., et al. 2015, Ongoing hydrothermal activities within Enceladus, Nature 519, 207',
      url: 'https://doi.org/10.1038/nature14262',
    },
    {
      key: 'waite2017',
      text: 'Waite, J. H., et al. 2017, Cassini finds molecular hydrogen in the Enceladus plume: Evidence for hydrothermal processes, Science 356, 155',
      url: 'https://doi.org/10.1126/science.aai8703',
    },
    {
      key: 'postberg2023',
      text: 'Postberg, F., et al. 2023, Detection of phosphates originating from Enceladus’s ocean, Nature 618, 489',
      url: 'https://doi.org/10.1038/s41586-023-05987-9',
    },
    {
      key: 'spahn2006',
      text: 'Spahn, F., et al. 2006, Cassini Dust Measurements at Enceladus and Implications for the Origin of the E Ring, Science 311, 1416',
      url: 'https://doi.org/10.1126/science.1121375',
    },
    {
      key: 'villanueva2023',
      text: 'Villanueva, G. L., et al. 2023, JWST molecular mapping and characterization of Enceladus’ water plume feeding its torus, Nature Astronomy 7, 1056',
      url: 'https://doi.org/10.1038/s41550-023-02009-6',
    },
    {
      key: 'pia17202',
      text: 'NASA/JPL Photojournal PIA17202, Approaching Enceladus (Cassini, 28 October 2015)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA17202',
    },
  ],
};
