import type { Description } from './types.ts';

/**
 * Makemake. Every number here is from the source it cites; where a figure is a model's rather
 * than a measurement, it sits under "estimated" and says which model. What the app draws of it
 * is read off its catalog entry (tools/src/smallBodies.ts) and the note on its moon in
 * tools/src/moons/minorPlanetMoons.ts.
 */
export const MAKEMAKE: Description = {
  id: 'makemake',
  lead: [
    'Makemake was found a few days after Easter 2005, and is named for the creator of humanity in the myths of Rapa Nui, the island Europeans called Easter Island. It is a reddish world of methane ice, so far away that it was long imagined as simply frozen and still — until in 2025 the James Webb Space Telescope caught methane gas coming off it. However far out we look, the Solar System keeps turning out to be less finished than we thought.',
    'Makemake is a dwarf planet in the Kuiper belt, about 1,430 kilometres across — three-fifths the width of Pluto — and after Pluto the brightest object in the Kuiper belt seen from Earth. Its surface reflects nearly four-fifths of the sunlight that falls on it and is covered in frozen methane, with ethane, acetylene and other hydrocarbons made from it by sunlight.',
    'Unlike Pluto, it has no thick atmosphere: when it passed in front of a star in 2011, the star blinked out and back abruptly, with none of the gradual fading a Pluto-like atmosphere would cause. But Webb’s spectra show a trace of methane gas, either a very thin atmosphere or a plume from somewhere on its surface, and its methane carries a chemical signature that suggests it was made inside a warm interior.',
    'It has one known moon, provisionally called MK2, found by Hubble in 2015: 1,300 times fainter than Makemake, so dark that it may account for most of the dark material astronomers had thought lay on Makemake’s surface. Its orbit is not yet well known, so Makemake’s mass has never been measured.',
    'Makemake goes round the Sun in about 308 years, between 38 and 53 times Earth’s distance, on an orbit tilted 29°; sunlight now takes over seven hours to reach it. It turns once in about 22.8 hours. No spacecraft has been there, and there is no image of its surface: every telescope shows it as a single point of light.',
  ],
  photos: [
    {
      file: 'photos/makemake/hubble-mk2.webp',
      largeFile: 'photos/makemake/hubble-mk2-large.webp',
      width: 600,
      height: 600,
      title: 'Makemake and its moon from Hubble, April 2015',
      caption:
        'The bright point with diffraction spikes is Makemake; the faint smudge just above it is its moon, MK2, about 1,300 times fainter and nearly lost in the glare. Neither is resolved. Black and white, through a single broad filter of Hubble’s Wide Field Camera 3.',
      colour: 'true',
      credit: 'NASA, ESA, and A. Parker and M. Buie (Southwest Research Institute)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2015-04',
      sourceUrl: 'https://esahubble.org/images/opo1618b/',
    },
  ],
  drawnHere: [
    {
      title: 'Round, at its measured size',
      text: 'A sphere of 714 km radius: the occultation of 2011, reanalysed, gives 1,434 ± 14 km across its equator and 1,422 ± 14 km across its projected pole, equal within their errors, so it is drawn round at their mean.',
      cite: ['brown2013'],
    },
    {
      title: 'No map, because there is none',
      text: 'It is drawn in a plain reddish-tan colour. Nothing has ever shown its surface; the panel says so.',
      cite: ['parker2016'],
    },
    {
      title: 'Not turned',
      text: 'Its period, 22.8266 hours, is measured from its light curve, but not where its pole points, so it is drawn without a spin. Its light varies by only 3%, which says that it is nearly round, or seen nearly pole-on.',
      cite: ['hromakina2019'],
    },
    {
      title: 'No moon drawn',
      text: 'MK2 is not drawn: JPL publishes no orbit for it in Horizons, and the discovery images alone could not fix one.',
      cite: ['parker2016'],
    },
  ],
  measured: [
    {
      title: 'Size',
      text: 'From a stellar occultation on 23 April 2011: projected axes of about 1,430 by 1,500 km in the first analysis, and 1,434 by 1,422 km, nearly round, in a statistical reanalysis.',
      cite: ['ortiz2012', 'brown2013'],
    },
    {
      title: 'Brightness',
      text: 'Geometric albedo 0.77 ± 0.03 in the first analysis of the occultation, 0.81 in the reanalysis — between Pluto’s and Eris’s.',
      cite: ['ortiz2012', 'brown2013'],
    },
    {
      title: 'No global atmosphere',
      text: 'The star disappeared and reappeared abruptly: no Pluto-like atmosphere, to a surface pressure below 4 to 12 billionths of a bar.',
      cite: ['ortiz2012'],
    },
    {
      title: 'Methane, and gas',
      text: 'Its first spectra, soon after discovery, already showed a surface rich in methane ice. Webb’s NIRSpec found methane, deuterated methane and frozen ethane and acetylene, and methane gas glowing in sunlight — making Makemake the second object beyond Neptune, after Pluto, seen releasing volatiles.',
      cite: ['licandro2006', 'protopapa2025'],
    },
    {
      title: 'Its day',
      text: 'A rotation of 22.8266 ± 0.0001 hours, from light curves gathered between 2006 and 2017 — slower than was first reported.',
      cite: ['hromakina2019'],
    },
    {
      title: 'Its moon',
      text: 'S/2015 (136472) 1, found in Hubble images on 27 April 2015, 7.8 magnitudes — about 1,300 times — fainter than Makemake and at least 21,000 km from it, if its orbit is circular.',
      cite: ['parker2016'],
    },
    {
      title: 'Orbit',
      text: 'Semi-major axis 45.6 times Earth’s distance, from 38.3 to 52.8; eccentricity 0.16; tilted 29.0° to the ecliptic; about 308 years a revolution.',
      cite: ['sbdbmakemake'],
    },
    {
      title: 'Discovery and name',
      text: 'By Mike Brown, Chad Trujillo and David Rabinowitz at Palomar on 31 March 2005, a few days after Easter — the team nicknamed it “Easterbunny”. Provisionally 2005 FY9; named for the creator of humanity and god of fertility of Rapa Nui.',
      cite: ['sbdbmakemake', 'nasamakemake'],
    },
  ],
  estimated: [
    {
      title: 'A dark moon',
      text: 'Thermal measurements had suggested dark patches on Makemake. The moon’s discoverers propose instead that much of that dark material is the moon itself, if its surface is uniformly dark — a hypothesis Webb could test.',
      cite: ['parker2016'],
    },
    {
      title: 'Atmosphere or plume',
      text: 'The methane gas fits either a thin, bound atmosphere of about ten trillionths of a bar, near 40 K, or an escaping plume from a localized source; neither model fits the data fully.',
      cite: ['protopapa2025'],
    },
    {
      title: 'Heat inside',
      text: 'The ratio of deuterium to hydrogen in its methane is close to that of water in comets, which suggests the methane was made by geochemistry in a warm interior, in the past or recently.',
      cite: ['grundy2024'],
    },
  ],
  missing: [
    {
      title: 'Its mass',
      text: 'Not measured: weighing a body needs a moon’s orbit, and MK2’s is not yet known. The app carries no mass for it.',
      cite: ['parker2016'],
    },
    {
      title: 'Its surface',
      text: 'Never seen: every image shows a point of light.',
      cite: ['parker2016'],
    },
    {
      title: 'Its pole',
      text: 'Not known from a direct measurement; its flat light curve is only consistent with a nearly pole-on view.',
      cite: ['hromakina2019', 'brown2013'],
    },
  ],
  misconceptions: [
    {
      title: 'Its density is not known',
      text: 'A density of 1.7 g/cm³ was published from the 2011 occultation. A reanalysis showed it rested on a misapplied model: the occultation gives no meaningful constraint on Makemake’s density.',
      cite: ['ortiz2012', 'brown2013'],
    },
    {
      title: 'It is not a frozen, inert ball',
      text: 'It has no global atmosphere, but it does give off methane gas, and the hydrocarbons on its surface show that sunlight is breaking up its methane now, or did so recently.',
      cite: ['ortiz2012', 'protopapa2025'],
    },
  ],
  sources: [
    {
      key: 'sbdbmakemake',
      text: 'JPL Small-Body Database, 136472 Makemake (2005 FY9), orbit solution 130, discovery circumstances and naming citation',
      url: 'https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=136472',
    },
    {
      key: 'nasamakemake',
      text: 'NASA Science, Makemake',
      url: 'https://science.nasa.gov/dwarf-planets/makemake/',
    },
    {
      key: 'de440',
      text: 'Park, R. S., et al. 2021, The JPL Planetary and Lunar Ephemerides DE440 and DE441, AJ 161, 105',
      url: 'https://doi.org/10.3847/1538-3881/abd414',
    },
    {
      key: 'ortiz2012',
      text: 'Ortiz, J. L., et al. 2012, Albedo and atmospheric constraints of dwarf planet Makemake from a stellar occultation, Nature 491, 566',
      url: 'https://doi.org/10.1038/nature11597',
    },
    {
      key: 'brown2013',
      text: 'Brown, M. E. 2013, On the Size, Shape, and Density of Dwarf Planet Makemake, ApJ 767, L7',
      url: 'https://doi.org/10.1088/2041-8205/767/1/L7',
    },
    {
      key: 'parker2016',
      text: 'Parker, A. H., Buie, M. W., Grundy, W. M., & Noll, K. S. 2016, Discovery of a Makemakean Moon, ApJL 825, L9',
      url: 'https://doi.org/10.3847/2041-8205/825/1/L9',
    },
    {
      key: 'hromakina2019',
      text: 'Hromakina, T. A., et al. 2019, Long-term photometric monitoring of the dwarf planet (136472) Makemake, A&A 625, A46',
      url: 'https://doi.org/10.1051/0004-6361/201935274',
    },
    {
      key: 'licandro2006',
      text: 'Licandro, J., et al. 2006, The methane ice rich surface of large TNO 2005 FY9: a Pluto-twin in the trans-neptunian belt?, A&A 445, L35',
      url: 'https://doi.org/10.1051/0004-6361:200500219',
    },
    {
      key: 'protopapa2025',
      text: 'Protopapa, S., et al. 2025, JWST Detection of Hydrocarbon Ices and Methane Gas on Makemake, ApJL 991, L34',
      url: 'https://doi.org/10.3847/2041-8213/adfe63',
    },
    {
      key: 'grundy2024',
      text: 'Grundy, W. M., et al. 2024, Measurement of D/H and ¹³C/¹²C ratios in methane ice on Eris and Makemake: Evidence for internal activity, Icarus 411, 115923',
      url: 'https://doi.org/10.1016/j.icarus.2023.115923',
    },
  ],
};
