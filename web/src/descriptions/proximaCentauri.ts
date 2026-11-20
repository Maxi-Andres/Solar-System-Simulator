import { SKY_SURVEY } from './alphaCentauri.ts';
import type { Description } from './types.ts';

/**
 * Proxima Centauri, the nearest star. A catalogue star made a body at run time
 * (core/alphaCenBodies.ts), found by its designations; its planets are core/proximaPlanets.ts,
 * its orbit about Alpha Centauri A and B core/alphaCentauri.ts (proximaOrbit).
 */
export const PROXIMA_CENTAURI: Description = {
  id: 'proxima-centauri',
  catalogueStar: { designations: ['HIP 70890', 'Proxima Cen', 'alf Cen C'] },
  lead: [
    'The nearest star to the Sun, and so the first one anything we make might ever reach. Its light takes four and a quarter years to get here; at Voyager 1’s speed the journey would take some 75,000 years. Breakthrough Starshot has proposed doing it in twenty, with tiny probes on sails pushed by light to some 15% of light’s own speed — a plan on paper, nothing built yet. And around it goes a planet the size of Earth, at a distance where it is neither frozen nor boiled.',
    'Yet no one has ever seen Proxima with the naked eye. It is a red dwarf, the commonest kind of star in the galaxy: an eighth of the Sun’s mass, half as wide again as Jupiter, and so faint — magnitude 11 — that it takes a telescope to see it, 4.25 light years away in the southern constellation of Centaurus.',
    'It belongs to Alpha Centauri. About 13,000 times the Earth–Sun distance from the bright pair A and B, it goes round them in some 550,000 years, and is now near the farthest point of that orbit — which is why it is a little nearer to us than they are.',
    'It is a violent little star. Red dwarfs like it flare, and Proxima’s flares can be enormous: in March 2016 it brightened about 68 times in visible light, for a moment bright enough to see unaided. On average its habitable-zone planets take some 500 times the X-rays Earth gets from the Sun, and in a big flare tens of thousands of times as much — whether a planet there can keep an atmosphere at all is one of the open questions about it.',
    'Two planets are known. Proxima b, found in 2016 by the star’s wobble, is at least 1.07 Earth masses and circles the star in 11.2 days, in the zone where water could be liquid; Proxima d, at least a quarter of an Earth mass, circles in 5.1 days, announced as a candidate in 2022 and confirmed in 2025. A third signal, Proxima c, a world of several Earth masses five years round, is still a candidate. None of them has ever been seen: every picture of them is an artist’s.',
  ],
  photos: [
    SKY_SURVEY,
    {
      file: 'photos/proxima-centauri/hubble-2013.webp',
      largeFile: 'photos/proxima-centauri/hubble-2013-large.webp',
      width: 604,
      height: 592,
      title: 'Proxima Centauri from Hubble',
      caption:
        'The nearest star through Hubble’s Wide Field and Planetary Camera 2, in red (675 nm) and near-infrared (814 nm) light shown in colour — so not an eye’s colours. The spikes are the telescope’s optics; Alpha Centauri A and B are outside the frame.',
      colour: 'false',
      credit: 'ESA/Hubble & NASA',
      licence: 'CC BY 4.0',
      date: '2013-10-28',
      sourceUrl: 'https://esahubble.org/images/potw1343a/',
    },
    {
      file: 'photos/proxima-centauri/la-silla-collage.webp',
      largeFile: 'photos/proxima-centauri/la-silla-collage-large.webp',
      width: 640,
      height: 679,
      title: 'Where Proxima is in the southern sky',
      caption:
        'A collage: the southern Milky Way over the dome of ESO’s 3.6-metre telescope at La Silla, whose HARPS spectrograph found Proxima b, with Hubble’s images of Alpha Centauri A and B (lower left) and of Proxima (lower right) set in. The sky is as a camera sees it; the insets are partly infrared.',
      colour: 'false',
      credit: 'Y. Beletsky (LCO)/ESO/ESA/NASA/M. Zamani',
      licence: 'CC BY 4.0',
      date: '2016-08-24',
      sourceUrl: 'https://www.eso.org/public/images/eso1629b/',
    },
  ],
  drawnHere: [
    {
      title: 'Where it is',
      text:
        'As every catalogue star is placed: on the straight line its Gaia DR3 position, parallax and motion give, its parallax its own rather than the pair’s, for it is 13,000 AU from them and its measurement stands alone.',
      cite: ['gaia2023'],
    },
    {
      title: 'Its orbit about A and B',
      text:
        'Worked out from where it is drawn and from its velocity relative to the pair as Kervella et al. measured it, so the ellipse runs through the star: some 550,000 years round, eccentricity about 0.5. On it, the whole span of the app’s clock is a dot.',
      cite: ['kervella2017'],
    },
    {
      title: 'Its planets',
      text:
        'b and d where their radial velocities put them along their orbits, c grey and named a candidate. None passes in front of the star, so the tilt of their orbits is unknown: they are drawn edge-on as seen from the Sun, a convention. Where b is along its orbit is known to about a day; where d is, hardly at all.',
      cite: ['damasso2020', 'faria2022'],
    },
  ],
  measured: [
    {
      title: 'Distance',
      text: '4.25 light years, 1.30 parsecs, from Gaia’s parallax: the nearest star to the Sun.',
      cite: ['gaia2023'],
    },
    {
      title: 'Proxima b',
      text:
        'Found in 2016 by the Pale Red Dot campaign from the star’s wobble in radial velocity: 11.19 days round, 0.049 AU from the star. Its minimum mass, refined since, is 1.07 Earth masses (ESPRESSO, 2022) and 1.055 ± 0.055 (NIRPS, 2025).',
      cite: ['anglada2016', 'faria2022', 'suarez2025'],
    },
    {
      title: 'Proxima d',
      text: 'A 5.12-day wobble of 0.26 Earth masses at least, 0.029 AU out: reported as a candidate by Faria et al. in 2022, confirmed with NIRPS and HARPS in 2025.',
      cite: ['faria2022', 'suarez2025'],
    },
    {
      title: 'Its flares',
      text:
        'In March 2016 the Evryscope saw it brighten about 68 times in visible light, a superflare of about 3 × 10²⁶ joules, ten times any flare of it seen before.',
      cite: ['howard2018'],
    },
    {
      title: 'Its X-rays',
      text:
        'A planet in its habitable zone takes on average about 500 times the X-rays Earth takes from the Sun, and in a large flare about 50,000 times — where around A and B a planet would get about what Earth gets.',
      cite: ['chandra2018'],
    },
    {
      title: 'Its orbit about A and B',
      text:
        'Bound to the pair with high confidence, its distance and motion almost the same as theirs: some 550,000 years round, eccentricity 0.50, near its farthest now, 13,000 AU, and coming within 4,300 AU at its nearest.',
      cite: ['kervella2017'],
    },
  ],
  estimated: [
    {
      title: 'Its size and mass',
      text:
        'Radius 0.154 times the Sun’s, 107,000 km, and mass 0.122 times: not measured on Proxima itself but read from Mann et al.’s relations for red dwarfs, calibrated on stars whose sizes are measured — the values Kervella et al. adopt.',
      cite: ['mann2015', 'kervella2017'],
    },
    {
      title: 'Proxima c',
      text:
        'A 1,900-day signal that would be a world of at least 5.8 Earth masses, 1.5 AU out. Its discoverers leave open that it is the star’s own activity; it is not counted among confirmed planets.',
      cite: ['damasso2020'],
    },
  ],
  missing: [
    {
      title: 'The planets’ true masses',
      text:
        'A wobble gives only a minimum mass: the true one depends on how the orbit is tilted to us, and since none of the planets passes in front of the star, the tilt is unknown.',
      cite: ['anglada2016'],
    },
    {
      title: 'Whether b has air or water',
      text:
        'Not known. It is in the zone where water could be liquid, but the flares and X-rays may have stripped any atmosphere; repeated flaring, by Howard et al.’s model, could destroy 90% of an Earth-like ozone layer within five years.',
      cite: ['howard2018', 'anglada2016'],
    },
    {
      title: 'Any photograph of its planets',
      text: 'None exists: they are found only in the star’s motion. The pictures of Proxima b that circulate are artists’ impressions.',
    },
    {
      title: 'Its flares',
      text: 'Not drawn: the star shines here at its catalogue brightness, steady.',
    },
  ],
  misconceptions: [
    {
      title: 'Not visible to the eye',
      text: 'The nearest star is not among the bright ones: Alpha Centauri, beside it on the sky, is what the eye sees. Proxima needs a telescope.',
      cite: ['esahubble2013'],
    },
    {
      title: 'Proxima b is not “another Earth”',
      text:
        'Only its minimum mass and its orbit are known. It goes round a flaring red dwarf in 11 days, perhaps always turning the same face to it, and nothing is known of its air, its water or its surface.',
      cite: ['anglada2016', 'howard2018'],
    },
    {
      title: 'Not a passing star',
      text:
        'Proxima’s motion was long too uncertain to say whether it is bound to Alpha Centauri or only passing; it is now known to orbit the pair.',
      cite: ['kervella2017'],
    },
  ],
  sources: [
    {
      key: 'gaia2023',
      text: 'Gaia Collaboration, Vallenari, A., et al. 2023, Gaia Data Release 3: Summary of the content and survey properties, A&A 674, A1',
      url: 'https://doi.org/10.1051/0004-6361/202243940',
    },
    {
      key: 'kervella2017',
      text: 'Kervella, P., Thévenin, F., & Lovis, C. 2017, Proxima’s orbit around α Centauri, A&A 598, L7',
      url: 'https://doi.org/10.1051/0004-6361/201629930',
    },
    {
      key: 'mann2015',
      text: 'Mann, A. W., Feiden, G. A., Gaidos, E., Boyajian, T., & von Braun, K. 2015, How to Constrain Your M Dwarf, ApJ 804, 64',
      url: 'https://doi.org/10.1088/0004-637X/804/1/64',
    },
    {
      key: 'anglada2016',
      text: 'Anglada-Escudé, G., et al. 2016, A terrestrial planet candidate in a temperate orbit around Proxima Centauri, Nature 536, 437',
      url: 'https://doi.org/10.1038/nature19106',
    },
    {
      key: 'damasso2020',
      text: 'Damasso, M., Del Sordo, F., et al. 2020, A low-mass planet candidate orbiting Proxima Centauri at a distance of 1.5 AU, Sci. Adv. 6, eaax7467',
      url: 'https://doi.org/10.1126/sciadv.aax7467',
    },
    {
      key: 'faria2022',
      text: 'Faria, J. P., Suárez Mascareño, A., et al. 2022, A candidate short-period sub-Earth orbiting Proxima Centauri, A&A 658, A115',
      url: 'https://doi.org/10.1051/0004-6361/202142337',
    },
    {
      key: 'suarez2025',
      text: 'Suárez Mascareño, A., Artigau, É., et al. 2025, Diving into the planetary system of Proxima with NIRPS, A&A 700, A11',
      url: 'https://doi.org/10.1051/0004-6361/202553728',
    },
    {
      key: 'howard2018',
      text: 'Howard, W. S., Tilley, M. A., et al. 2018, The First Naked-eye Superflare Detected from Proxima Centauri, ApJL 860, L30',
      url: 'https://doi.org/10.3847/2041-8213/aacaf3',
    },
    {
      key: 'chandra2018',
      text: 'Chandra X-ray Center 2018, Alpha Centauri: A Triple Star System about 4 Light Years from Earth',
      url: 'https://chandra.harvard.edu/photo/2018/alphacen/',
    },
    {
      key: 'esahubble2013',
      text: 'ESA/Hubble 2013, New shot of Proxima Centauri, our nearest neighbour (Picture of the Week potw1343a)',
      url: 'https://esahubble.org/images/potw1343a/',
    },
    {
      key: 'ballesteros2012',
      text: 'Ballesteros, F. J. 2012, New insights into black bodies, EPL 97, 34008',
      url: 'https://doi.org/10.1209/0295-5075/97/34008',
    },
  ],
};
