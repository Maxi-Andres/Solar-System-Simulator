import type { Description } from './types.ts';

/**
 * The Sun. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model.
 */
export const SUN: Description = {
  id: 'sun',
  lead: [
    'The Sun is a star: a ball of hydrogen and helium 1.39 million kilometres across, held together by its own gravity and kept from collapsing by the heat of nuclear fusion in its core, where every second about 600 million tonnes of hydrogen become helium. It holds 99.86% of the Solar System’s mass; everything else — the planets, their moons, the asteroids and comets — is the remaining seventh of a percent.',
    'What we see of it is the photosphere, the layer where the gas turns from opaque to transparent, at 5,772 K. It is not a surface: there is nothing to stand on, only gas growing thinner outward. Above it lie the chromosphere and the corona, over a million degrees hot and visible to the eye only when the Moon covers the bright disc in a total eclipse.',
    'It is 4.57 billion years old, about halfway through the time it will spend fusing hydrogen in its core. From Earth its light takes 8 minutes 19 seconds to arrive; from the centre of the Milky Way, around which it travels once in about 230 million years, it is about 27,000 light years away.',
  ],
  photos: [
    {
      file: 'photos/sun/eclipse-2017.webp',
      largeFile: 'photos/sun/eclipse-2017-large.webp',
      width: 640,
      height: 427,
      title: 'The corona at totality, 21 August 2017',
      caption:
        'The total eclipse of 2017: the Moon covers the photosphere and the corona shows, white, as it is. The pink at the edge is the chromosphere and its prominences, glowing in hydrogen’s red line.',
      colour: 'true',
      credit: 'NASA/Carla Thomas',
      licence: 'NASA media, not copyrighted',
      date: '2017-08-21',
      sourceUrl: 'https://images.nasa.gov/details/AFRC2017-0233-008',
    },
    {
      file: 'photos/sun/eclipse-artemis-ii.webp',
      largeFile: 'photos/sun/eclipse-artemis-ii-large.webp',
      width: 640,
      height: 427,
      title: 'Eclipsed by the Moon, seen from Orion, 6 April 2026',
      caption:
        'The Artemis II crew, flying past the Moon, saw it cover the Sun for nearly 54 minutes. The halo is the corona, the zodiacal light, or both — NASA says the science community is still working out which — and with the disc hidden, stars show around it.',
      colour: 'true',
      credit: 'NASA',
      licence: 'NASA media, not copyrighted',
      date: '2026-04-06',
      sourceUrl: 'https://images.nasa.gov/details/art002e009301',
    },
    {
      file: 'photos/sun/sdo-sunspot-2014.webp',
      largeFile: 'photos/sun/sdo-sunspot-2014-large.webp',
      width: 640,
      height: 640,
      title: 'The largest sunspot of its cycle, October 2014',
      caption:
        'The Solar Dynamics Observatory’s view of the visible surface, with the biggest sunspot group of solar cycle 24, wider than ten Earths. Its orange is a tint added for the picture: the photosphere is white.',
      colour: 'tinted',
      credit: 'NASA/SDO',
      licence: 'NASA media, not copyrighted',
      date: '2014-10',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000923',
    },
    {
      file: 'glossary/sun.webp',
      largeFile: 'glossary/large/sun.webp',
      width: 406,
      height: 400,
      title: 'A spotless Sun, March 2017',
      caption:
        'Near solar minimum, eleven days with no sunspots at all. The picture blends the filtered visible disc with an extreme-ultraviolet image, so its colours are a convention, not what an eye would see.',
      colour: 'false',
      credit: 'NASA/GSFC/Solar Dynamics Observatory',
      licence: 'NASA media, not copyrighted',
      date: '2017-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA21569',
    },
  ],
  drawnHere: [
    {
      title: 'Overexposed, on purpose',
      text: 'Its disc is drawn far brighter than the planets, because it is: its surface is 154,000 times as bright as sunlit Earth, more than any screen can show beside a planet. The exposure is chosen so the red channel saturates across the disc and the last of the granulation survives in the blue; the disc then averages the colour NASA’s own render of it has.',
    },
    {
      title: 'Its colour',
      text: 'The surface map is a false-colour convention, as every global map of the Sun is. Its glare, and the Sun seen as a star from far away, take its measured colour, B−V = 0.65, through the same blackbody-and-eye path every star in the app takes.',
      cite: ['ramirez2012'],
    },
    {
      title: 'Its glare',
      text: 'The halo around it is the eye’s own, measured point-spread function, at the disc’s real illuminance: nothing about it is a setting.',
    },
    {
      title: 'Not at the centre',
      text: 'It is drawn where JPL puts it, which is not the Solar System’s centre of mass. Jupiter and Saturn pull it around the barycentre by as much as about two of its own radii, so the centre the planets orbit is often outside the Sun.',
      cite: ['de440'],
    },
  ],
  measured: [
    {
      title: 'Size',
      text: 'Radius 695,700 km, the IAU’s nominal value, from the photosphere’s measured edge. Almost perfectly round: its equator is only about 6 km wider than its poles.',
      cite: ['iau2015', 'kuhn2012'],
    },
    {
      title: 'Mass',
      text: 'GM = 132,712,440,041 km³/s², from the motions of the planets and spacecraft — known far better than G itself, so the mass, 1.989 × 10³⁰ kg, is the less exact number.',
      cite: ['de440'],
    },
    {
      title: 'Light',
      text: 'It gives off 3.828 × 10²⁶ watts; at Earth’s distance that is 1,361 watts on every square metre facing it, measured from orbit above the air.',
      cite: ['iau2015', 'kopp2011'],
    },
    {
      title: 'Temperature',
      text: 'The photosphere’s effective temperature is 5,772 K, from its total light and its size.',
      cite: ['iau2015'],
    },
    {
      title: 'Rotation',
      text: 'Followed by its sunspots and by its light’s Doppler shift: about 25 days at the equator and about 35 near the poles — a gas turns at different speeds at different latitudes.',
      cite: ['snodgrass1990'],
    },
    {
      title: 'What it is made of',
      text: 'By mass, 73.8% hydrogen, 24.9% helium and 1.3% everything else, from the dark lines in its spectrum and the stony meteorites that formed from the same cloud.',
      cite: ['asplund2009'],
    },
    {
      title: 'Age',
      text: '4.567 billion years: the age of the oldest solids in meteorites, the first things to condense around the young Sun, dated by the decay of uranium into lead.',
      cite: ['connelly2012'],
    },
  ],
  estimated: [
    {
      title: 'Its core',
      text: 'About 15.7 million kelvin and 150 times the density of water: no instrument can see inside, so these are the standard solar model’s figures — a model that has to match the Sun’s size, light, age and composition, and that the Sun’s own vibrations (helioseismology) and its neutrinos test from outside.',
      cite: ['bahcall2005'],
    },
    {
      title: 'How old its light is',
      text: 'Sunlight is 8 minutes 19 seconds old when it reaches Earth, but the energy it carries left the core long before: bounced from atom to atom, it takes on the order of 170,000 years to reach the surface. The figure is a model’s, and estimates range over tens of thousands to a few hundred thousand years.',
      cite: ['mitalas1992'],
    },
    {
      title: 'Its future',
      text: 'In about 5 billion years it runs out of hydrogen in its core and swells into a red giant, probably swallowing Mercury and Venus; then it sheds its outer layers and ends as a white dwarf about the size of Earth.',
      cite: ['schroder2008'],
    },
  ],
  missing: [
    {
      title: 'No true-colour map of its surface',
      text: 'The surface map is not the Sun on any particular day: the real photosphere is covered in granules about 1,000 km across that each last around ten minutes, and its sunspots come and go over days. No global true-colour map exists, because the Sun has no fixed surface to map.',
      cite: ['nordlund2009'],
    },
    {
      title: 'Today’s sunspots',
      text: 'Not drawn. The Solar Dynamics Observatory photographs the Sun every 12 seconds; showing the day’s spots would mean fetching its images live, which the app does not do yet.',
    },
    {
      title: 'The corona and chromosphere',
      text: 'Not drawn. The corona is a million times fainter than the disc, so at any exposure that shows the planets it would be invisible anyway; the eclipse photos above show it as it is. The solar wind it blows out is drawn only where it ends, in the Heliosphere layer, as a model.',
    },
    {
      title: 'Its differential rotation',
      text: 'The map turns as one piece, at the IAU’s single rate, where the real Sun’s equator laps its poles.',
      cite: ['archinal2018'],
    },
    {
      title: 'Its inside',
      text: 'The core, the radiative zone and the convection zone are not drawn: nothing measures them directly, and they could not be seen anyway.',
    },
  ],
  misconceptions: [
    {
      title: 'The Sun is white, not yellow',
      text: 'Outside the atmosphere its light is white: its colour sits near the middle of what our eyes see. It looks yellow from the ground, and red at sunset, because air scatters away the blue — the same scattering that makes the sky blue.',
      cite: ['ramirez2012'],
    },
    {
      title: 'It is not burning',
      text: 'Nothing in it burns, as fire burns: there is no oxygen fire. It shines by nuclear fusion, hydrogen nuclei joined into helium in its core.',
    },
    {
      title: 'It is not an average star',
      text: 'Most stars are red dwarfs, smaller, cooler and far fainter than the Sun; of its neighbours within 33 light years (10 parsecs), most are. The Sun is brighter than the great majority of stars in the galaxy.',
      cite: ['reyle2021'],
    },
    {
      title: 'The planets do not orbit its centre',
      text: 'They orbit the Solar System’s centre of mass, and so does the Sun — watch it drift here over the years.',
      cite: ['de440'],
    },
    {
      title: 'It will not explode',
      text: 'It is far too light to end as a supernova. It will swell, shed its outer layers as a planetary nebula, and fade as a white dwarf.',
      cite: ['schroder2008'],
    },
  ],
  sources: [
    {
      key: 'iau2015',
      text: 'Prša, A., et al. 2016, Nominal values for selected solar and planetary quantities: IAU 2015 Resolution B3, AJ 152, 41',
      url: 'https://doi.org/10.3847/0004-6256/152/2/41',
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
      key: 'kuhn2012',
      text: 'Kuhn, J. R., et al. 2012, The Precise Solar Shape and Its Variability, Science 337, 1638',
      url: 'https://doi.org/10.1126/science.1223231',
    },
    {
      key: 'kopp2011',
      text: 'Kopp, G., & Lean, J. L. 2011, A new, lower value of total solar irradiance: Evidence and climate significance, Geophys. Res. Lett. 38, L01706',
      url: 'https://doi.org/10.1029/2010GL045777',
    },
    {
      key: 'snodgrass1990',
      text: 'Snodgrass, H. B., & Ulrich, R. K. 1990, Rotation of Doppler features in the solar photosphere, ApJ 351, 309',
      url: 'https://doi.org/10.1086/168467',
    },
    {
      key: 'asplund2009',
      text: 'Asplund, M., Grevesse, N., Sauval, A. J., & Scott, P. 2009, The Chemical Composition of the Sun, ARA&A 47, 481',
      url: 'https://doi.org/10.1146/annurev.astro.46.060407.145222',
    },
    {
      key: 'connelly2012',
      text: 'Connelly, J. N., et al. 2012, The Absolute Chronology and Thermal Processing of Solids in the Solar Protoplanetary Disk, Science 338, 651',
      url: 'https://doi.org/10.1126/science.1226919',
    },
    {
      key: 'bahcall2005',
      text: 'Bahcall, J. N., Serenelli, A. M., & Basu, S. 2005, New Solar Opacities, Abundances, Helioseismology, and Neutrino Fluxes, ApJ 621, L85',
      url: 'https://doi.org/10.1086/428929',
    },
    {
      key: 'mitalas1992',
      text: 'Mitalas, R., & Sills, K. R. 1992, On the photon diffusion time scale for the Sun, ApJ 401, 759',
      url: 'https://doi.org/10.1086/172103',
    },
    {
      key: 'schroder2008',
      text: 'Schröder, K.-P., & Connon Smith, R. 2008, Distant future of the Sun and Earth revisited, MNRAS 386, 155',
      url: 'https://doi.org/10.1111/j.1365-2966.2008.13022.x',
    },
    {
      key: 'nordlund2009',
      text: 'Nordlund, Å., Stein, R. F., & Asplund, M. 2009, Solar Surface Convection, Living Rev. Sol. Phys. 6, 2',
      url: 'https://doi.org/10.12942/lrsp-2009-2',
    },
    {
      key: 'ramirez2012',
      text: 'Ramírez, I., et al. 2012, The UBV(RI)C Colors of the Sun, ApJ 752, 5',
      url: 'https://doi.org/10.1088/0004-637X/752/1/5',
    },
    {
      key: 'reyle2021',
      text: 'Reylé, C., et al. 2021, The 10 parsec sample in the Gaia era, A&A 650, A201',
      url: 'https://doi.org/10.1051/0004-6361/202140985',
    },
  ],
};
