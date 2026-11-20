import type { Description } from './types.ts';

/**
 * Europa. Every number here is from the source it cites; where one is worked out here from
 * them (a ratio, a map's mean brightness), the point says so. Where a figure is a model's
 * rather than a measurement, it sits under "estimated" and says which.
 */
export const EUROPA: Description = {
  id: 'europa',
  lead: [
    'Under Europa’s ice there is very probably an ocean of salt water, tens of kilometres deep — on a moon smaller than ours, perhaps more water than all of Earth’s seas. Life as we know it needs liquid water, the right chemical elements and a source of energy; Europa is one of the few other places we know where all three may be found together, and a spacecraft built to find out whether it could hold life is on its way.',
    'Europa is the second of Jupiter’s four large moons, 3,122 kilometres across, a little smaller than our Moon. Its surface is water ice, among the brightest in the Solar System, crossed by thousands of cracks and ridges stained reddish-brown, and broken in places into jumbled blocks like sea ice that froze again around them. Craters are few: the surface is young, remade within the last hundred million years or so.',
    'The ocean has never been seen. It is inferred: Galileo found that Europa’s magnetic field flips in step with Jupiter’s, as it would if something under the ice conducted electricity like salt water; Galileo’s measurements of its gravity show a layer of water or ice about a hundred kilometres thick over a rocky interior; and Juno’s microwave radiometer has put the frozen shell on top at roughly 30 kilometres where it looked. What keeps the water liquid, so far from the Sun, is tidal flexing by Jupiter.',
    'Salt and carbon dioxide on its surface, seen by Hubble and the James Webb Space Telescope in the same young region, seem to have come up from below. Hubble has also glimpsed what may be plumes of water vapour above it — not yet confirmed.',
    'It goes round Jupiter in 3.55 days, almost exactly twice Io’s period and half Ganymede’s, always with the same face toward the planet. Galileo Galilei found it in 1610; the Galileo spacecraft flew close past it again and again between 1996 and 2000, and Juno flew 352 kilometres above it in 2022. NASA’s Europa Clipper, launched in October 2024, reaches Jupiter in April 2030 to fly past Europa 49 times.',
  ],
  photos: [
    {
      file: 'photos/europa/galileo-natural-colour.webp',
      largeFile: 'photos/europa/galileo-natural-colour-large.webp',
      width: 640,
      height: 473,
      title: 'Europa in natural colour, from Galileo images of 1995 and 1998',
      caption:
        'Reprocessed in 2014 to approximate what an eye would see: near-infrared, green and violet images, corrected for scattered light and calibrated by wavelength; gaps were filled with colour from similar terrain nearby. Blue-white areas are fairly pure ice; the reddish-brown ones hold other materials. North is to the right.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/SETI Institute',
      licence: 'NASA media, not copyrighted',
      date: '1995–1998',
      sourceUrl: 'https://images.nasa.gov/details/PIA19048',
    },
    {
      file: 'photos/europa/voyager-jupiter-io-europa-1979.webp',
      largeFile: 'photos/europa/voyager-jupiter-io-europa-1979-large.webp',
      width: 640,
      height: 421,
      title: 'Io and Europa over Jupiter, 13 February 1979',
      caption:
        'Voyager 1, from 20 million km: Io (left) in front of the Great Red Spot, Europa (right) farther out. Both are about as bright, and very differently coloured. Assembled from three black-and-white frames taken through colour filters: near natural, not calibrated to an eye.',
      colour: 'true',
      credit: 'NASA/JPL',
      licence: 'NASA media, not copyrighted',
      date: '1979-02-13',
      sourceUrl: 'https://images.nasa.gov/details/PIA00144',
    },
    {
      file: 'photos/europa/juno-flyby-2022.webp',
      largeFile: 'photos/europa/juno-flyby-2022-large.webp',
      width: 640,
      height: 307,
      title: 'Juno over the terminator, 29 September 2022',
      caption:
        'From Juno’s close pass, the nearest any craft had come since Galileo in 2000: ridges and troughs crossing the ice, and near the line between day and night, blocks tall enough to cast shadows. About 1 km per pixel. Cropped here from the published strip. Black and white.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2022-09-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA25330',
    },
    {
      file: 'photos/europa/juno-colour-2022.webp',
      largeFile: 'photos/europa/juno-colour-2022-large.webp',
      width: 640,
      height: 565,
      title: 'The Jupiter-facing side, 29 September 2022',
      caption:
        'Three JunoCam images combined by the citizen scientist Kevin M. Gill, 1 to 4 km per pixel, “to enhance the color and contrast” — the browns are deeper here than an eye would see. North is to the left.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/SwRI/MSSS/Kevin M. Gill',
      licence: 'Processed image CC BY 3.0, from NASA images not copyrighted',
      date: '2022-09-29',
      sourceUrl: 'https://images.nasa.gov/details/PIA25695',
    },
    {
      file: 'photos/europa/galileo-conamara-1997.webp',
      largeFile: 'photos/europa/galileo-conamara-1997-large.webp',
      width: 640,
      height: 283,
      title: 'Ice rafts in Conamara Chaos',
      caption:
        'About 70 by 30 km of broken crust, its blocks shifted and frozen again in place, at 54 m per pixel from February 1997, coloured from lower-resolution violet, green and infrared images of 1996. The colours are enhanced: white and blue mark a dusting of ice from the impact that made the crater Pwyll, 1,000 km to the south.',
      colour: 'false',
      credit: 'NASA/JPL/University of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '1996–1997',
      sourceUrl: 'https://images.nasa.gov/details/PIA01127',
    },
    {
      file: 'photos/europa/hubble-plume-2014-2016.webp',
      largeFile: 'photos/europa/hubble-plume-2014-2016-large.webp',
      width: 640,
      height: 320,
      title: 'A suspected plume, 2014 and 2016',
      caption:
        'Hubble, in ultraviolet, saw something silhouetted against Jupiter at the same spot on Europa’s edge twice: about 50 km high on 17 March 2014, about 100 km on 22 February 2016. The blue is the ultraviolet data in a colour scale; the disc laid over it is a Galileo map of Europa, not part of the observation.',
      colour: 'false',
      credit: 'NASA/ESA/W. Sparks (STScI)/USGS Astrogeology Science Center',
      licence: 'NASA media, not copyrighted',
      date: '2014–2016',
      sourceUrl: 'https://images.nasa.gov/details/PIA21443',
    },
  ],
  drawnHere: [
    {
      title: 'Which ephemeris',
      text: 'Its positions are JPL’s satellite ephemeris for Jupiter’s moons, JUP365, the same one its mass comes from — not DE441, which carries only the Sun, the planets and our Moon.',
      cite: ['jplSats'],
    },
    {
      title: 'Only near today',
      text: 'JPL’s table is fetched for one year either side of the day the data were built, a sample every four hours. Outside that year it is carried on from its orbital elements and marked approximate — still on its orbit, no longer exactly where it is.',
    },
    {
      title: 'Its shape, and its face to Jupiter',
      text: 'A slightly triaxial ellipsoid, 1,562.6 by 1,560.3 by 1,559.5 km, its long axis toward Jupiter, as the IAU gives it, and turned by the IAU’s model with its periodic terms, so the same face stays on Jupiter.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its map, in grey',
      text: 'USGS’s global mosaic of Voyager and Galileo images; its longitude was checked here against the crater Pwyll. It is black and white because that is how it was mapped, through a clear filter; there is no global true-colour map of Europa, so the reddish-brown of its cracks, in the photographs above, is not drawn. Galileo left gaps near the poles, 4 to 5% of the map, filled with the average of the rest. At 2,048 pixels round, each pixel is about 4.8 km at the equator, worked out here.',
      cite: ['pia19048'],
    },
    {
      title: 'Its brightness is the mosaic’s',
      text: 'The map’s average, read as how much light the surface reflects, is 0.31; the Moon’s map averages 0.48. Europa really reflects between five and six times as much light as the Moon — geometric albedo 0.68 against 0.12 — so beside the Moon it is drawn several times too dark. Worked out here from the two maps’ pixels and the fact sheets.',
      cite: ['nssdcJovian', 'nssdcMoon'],
    },
    {
      title: 'The spacecraft',
      text: 'Juno, Europa Clipper and Juice are drawn on JPL’s trajectories. Juno’s pass of 29 September 2022 and Clipper’s from 2031 fall outside Europa’s own one-year table, where Europa is carried on from its elements, so the app does not promise to show them meeting where they really do.',
      cite: ['pia25330', 'clipperFacts'],
    },
    {
      title: 'Lighting',
      text: 'In Natural lighting, the default, its night side is black. Shadow and Flood lighting fill it in so it can be read; neither is what an eye would see.',
    },
  ],
  measured: [
    {
      title: 'Size and mass',
      text: 'Mean radius 1,560.8 km, 3,122 km across: 10% narrower than the Moon. Mass 4.80 × 10²² kg, two-thirds of the Moon’s; mean density 3.01 g/cm³ — rock under a skin of water. Gravity at the surface 1.31 m/s². The comparisons with the Moon are worked out here.',
      cite: ['jplSats', 'nssdcJovian', 'nssdcGalilean', 'nssdcMoon'],
    },
    {
      title: 'Orbit',
      text: 'Average distance 671,100 km from Jupiter’s centre, 9.4 Jupiter radii; one orbit in 3.551 days, at 13.7 km/s; eccentricity 0.009, tilted 0.47° to Jupiter’s equator. Turning once per orbit, it keeps one face toward Jupiter.',
      cite: ['nssdcJovian', 'nssdcGalilean'],
    },
    {
      title: 'Surface',
      text: 'Water ice, reflecting 68% of the light that falls on it straight back (geometric albedo 0.68); its mean temperature is about −170 °C. Fractures, ridges and bands have erased everything older than about 90 million years.',
      cite: ['nssdcJovian', 'nssdcGalilean', 'pia26331'],
    },
    {
      title: 'A layer that conducts',
      text: 'Galileo’s magnetometer found that the field induced in Europa reverses as Jupiter’s tilted field sweeps past in the other direction — as it should if a layer near the surface conducts electricity. A salty ocean is the explanation that fits; the measurement is of the field, not of water.',
      cite: ['kivelson2000'],
    },
    {
      title: 'Its layers',
      text: 'Galileo’s gravity data, from four close passes, show Europa is differentiated: a metallic core and rocky mantle under an outer layer of water — liquid or frozen — 80 to 170 km thick.',
      cite: ['anderson1998'],
    },
    {
      title: 'Its ice shell',
      text: 'Juno’s microwave radiometer looked into the ice during the 2022 pass: for pure water ice, the cold rigid shell is 29 ± 10 km thick there, with cracks and pores reaching hundreds of metres down.',
      cite: ['levin2025'],
    },
    {
      title: 'Salt and carbon',
      text: 'Hubble found sodium chloride — table salt — in Tara Regio, one of the young chaos regions. The James Webb Space Telescope found carbon dioxide concentrated in the same region, which points to carbon coming up from inside rather than delivered from outside.',
      cite: ['trumbo2019', 'trumbo2023'],
    },
    {
      title: 'Close passes',
      text: 'Galileo came within 351 km on 3 January 2000; Juno within 352 km on 29 September 2022, the third close pass ever.',
      cite: ['pia25330'],
    },
    {
      title: 'Europa Clipper and Juice',
      text: 'Europa Clipper launched on 14 October 2024, reaches Jupiter in April 2030 and is to make 49 close flybys of Europa, to determine whether it has conditions suitable for life. ESA’s Juice, launched on 14 April 2023, will fly past Europa too.',
      cite: ['nasaClipper', 'clipperFacts', 'esaJuice'],
    },
  ],
  estimated: [
    {
      title: 'How big the ocean is',
      text: 'NASA’s mission team estimates an ocean 60 to 150 km deep, enough to hold more than twice the water of all Earth’s oceans. It follows from models fitted to the gravity and magnetic measurements; no one has measured the ocean’s depth.',
      cite: ['clipperFacts', 'anderson1998', 'kivelson2000'],
    },
    {
      title: 'How thick the ice is',
      text: 'Models ranged from under a kilometre to more than 30 km before Juno; its 29 ± 10 km is for pure ice where it looked, would be about 5 km less if the ice is salty, and leaves open a warmer, convecting layer beneath that would add to it.',
      cite: ['billings2005', 'levin2025'],
    },
    {
      title: 'Water inside the ice',
      text: 'One model of the chaos regions has them forming over lenses of liquid water a few kilometres down, inside the shell, which then refreeze.',
      cite: ['schmidt2011'],
    },
    {
      title: 'Plumes',
      text: 'Hubble saw ultraviolet light from hydrogen and oxygen over the south pole in December 2012, as from water vapour, and in other years something at the same spot on the edge, 50 to 100 km high. Neither is confirmed; Europa Clipper should settle it.',
      cite: ['roth2014', 'sparks2017'],
    },
  ],
  missing: [
    {
      title: 'Its colour',
      text: 'Not drawn: the map is grey. The real Europa is white and blue ice streaked reddish-brown, as in the natural-colour photograph above.',
      cite: ['pia19048'],
    },
    {
      title: 'The ocean',
      text: 'Not drawn, and nothing would show it: it lies tens of kilometres under the ice.',
      cite: ['levin2025'],
    },
    {
      title: 'Jupiter’s shadow',
      text: 'Not drawn. Europa passes through Jupiter’s shadow on every orbit; here it stays lit. Its own shadow on Jupiter is not drawn either: nothing in the app casts a shadow on another body except Saturn and its rings.',
    },
    {
      title: 'Its relief',
      text: 'Not drawn: the ridges and the blocks of chaos terrain, some tall enough to cast long shadows at dawn, are a picture on a smooth ellipsoid.',
      cite: ['pia25330'],
    },
  ],
  misconceptions: [
    {
      title: 'The ocean has not been seen',
      text: 'It is the best explanation of a magnetic signal and of Europa’s gravity, and an extremely good one — but no instrument has reached or seen liquid water there.',
      cite: ['kivelson2000', 'anderson1998'],
    },
    {
      title: 'Life has not been found',
      text: 'Europa Clipper is not built to detect life. Its goal is to find out whether there are places under the surface that could support it.',
      cite: ['nasaClipper'],
    },
    {
      title: 'Its plumes are not confirmed',
      text: 'Unlike Enceladus’s, which Cassini flew through, Europa’s possible plumes are faint signals in Hubble data, seen at some times and not at others.',
      cite: ['roth2014', 'sparks2017'],
    },
    {
      title: 'It is not white',
      text: 'The brightest parts are nearly pure ice, but its cracks and chaos regions are reddish-brown with salts and other material, as the natural-colour view shows.',
      cite: ['pia19048', 'trumbo2019'],
    },
  ],
  sources: [
    {
      key: 'nssdcJovian',
      text: 'Williams, D. R., Jovian Satellite Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/joviansatfact.html',
    },
    {
      key: 'nssdcGalilean',
      text: 'Williams, D. R., Solar System Small Worlds Fact Sheet (the Galilean satellites compared), NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/galileanfact_table.html',
    },
    {
      key: 'nssdcMoon',
      text: 'Williams, D. R., Moon Fact Sheet, NASA Space Science Data Coordinated Archive',
      url: 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html',
    },
    {
      key: 'jplSats',
      text: 'JPL Solar System Dynamics, Planetary Satellite Physical Parameters (GM from JUP365; mean radius from the IAU 2015 report)',
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
      key: 'kivelson2000',
      text: 'Kivelson, M. G., et al. 2000, Galileo Magnetometer Measurements: A Stronger Case for a Subsurface Ocean at Europa, Science 289, 1340',
      url: 'https://doi.org/10.1126/science.289.5483.1340',
    },
    {
      key: 'anderson1998',
      text: 'Anderson, J. D., et al. 1998, Europa’s Differentiated Internal Structure: Inferences from Four Galileo Encounters, Science 281, 2019',
      url: 'https://doi.org/10.1126/science.281.5385.2019',
    },
    {
      key: 'levin2025',
      text: 'Levin, S. M., et al. 2025, Europa’s ice thickness and subsurface structure characterized by the Juno microwave radiometer, Nature Astronomy 10, 84',
      url: 'https://doi.org/10.1038/s41550-025-02718-0',
    },
    {
      key: 'billings2005',
      text: 'Billings, S. E., & Kattenhorn, S. A. 2005, The great thickness debate: Ice shell thickness models for Europa and comparisons with estimates based on flexure at ridges, Icarus 177, 397',
      url: 'https://doi.org/10.1016/j.icarus.2005.03.013',
    },
    {
      key: 'schmidt2011',
      text: 'Schmidt, B. E., et al. 2011, Active formation of ‘chaos terrain’ over shallow subsurface water on Europa, Nature 479, 502',
      url: 'https://doi.org/10.1038/nature10608',
    },
    {
      key: 'roth2014',
      text: 'Roth, L., et al. 2014, Transient Water Vapor at Europa’s South Pole, Science 343, 171',
      url: 'https://doi.org/10.1126/science.1247051',
    },
    {
      key: 'sparks2017',
      text: 'Sparks, W. B., et al. 2017, Active Cryovolcanism on Europa?, ApJ Letters 839, L18',
      url: 'https://doi.org/10.3847/2041-8213/aa67f8',
    },
    {
      key: 'trumbo2019',
      text: 'Trumbo, S. K., Brown, M. E., & Hand, K. P. 2019, Sodium chloride on the surface of Europa, Science Advances 5, eaaw7123',
      url: 'https://doi.org/10.1126/sciadv.aaw7123',
    },
    {
      key: 'trumbo2023',
      text: 'Trumbo, S. K., & Brown, M. E. 2023, The distribution of CO₂ on Europa indicates an internal source of carbon, Science 381, 1308',
      url: 'https://doi.org/10.1126/science.adg4155',
    },
    {
      key: 'nasaClipper',
      text: 'NASA Science, Europa Clipper (mission page)',
      url: 'https://science.nasa.gov/mission/europa-clipper/',
    },
    {
      key: 'clipperFacts',
      text: 'NASA/JPL, Europa Clipper Launch Press Kit: Quick Facts',
      url: 'https://www.jpl.nasa.gov/press-kits/europa-clipper/quick-facts/',
    },
    {
      key: 'esaJuice',
      text: 'ESA, Juice factsheet',
      url: 'https://www.esa.int/Science_Exploration/Space_Science/Juice/Juice_factsheet',
    },
    {
      key: 'pia19048',
      text: 'NASA/JPL Photojournal PIA19048, Europa’s Stunning Surface (Galileo, reprocessed 2014)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA19048',
    },
    {
      key: 'pia25330',
      text: 'NASA/JPL Photojournal PIA25330, First Image of Europa From Juno’s Close Flyby (29 September 2022)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA25330',
    },
    {
      key: 'pia26331',
      text: 'NASA/JPL Photojournal PIA26331, A JunoCam View of Europa (29 September 2022)',
      url: 'https://photojournal.jpl.nasa.gov/catalog/PIA26331',
    },
  ],
};
