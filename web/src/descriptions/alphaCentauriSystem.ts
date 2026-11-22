import { HUBBLE_PAIR, SKY_SURVEY, SOUTHERN_CROSS } from './alphaCentauri.ts';
import { ALPHA_CEN_SYSTEM_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * Alpha Centauri as a whole: its three stars and what goes round them. No body -- its stars are
 * three, each with a page of its own (alphaCentauri.ts, proximaCentauri.ts) -- so opened by the
 * store's readAbout, from the breadcrumb's Alpha Centauri list, its stars' panels and its search
 * result. What is drawn is read off core/alphaCenBodies.ts (the system's framing),
 * core/alphaCentauri.ts (the orbits), core/proximaPlanets.ts, core/alphaCenAPlanets.ts and
 * scene/LabelProjector.tsx (its names on screen). The stability limits under "estimated" are
 * Holman & Wiegert's fit for a planet about one star of a pair, evaluated with Kervella et al.'s orbit and masses:
 * a 23.55 AU, e 0.5208, mu 0.4588 about A and 0.5412 about B, giving 2.76 and 2.51 AU.
 */
export const ALPHA_CENTAURI_SYSTEM: Description = {
  id: ALPHA_CEN_SYSTEM_DESCRIPTION_ID,
  subject: { name: 'Alpha Centauri', kind: 'triple star system' },
  lead: [
    'The nearest stars to the Sun are three, and they belong together. Two of them, A and B, are suns not unlike ours, and go round each other once every 80 years; the third, the small red Proxima, goes round the pair from a fifth of a light year away, once in some 550,000 years. Their light takes four and a quarter to four and a third years to reach us. Nothing we have built has set out for them.',
    'A, named Rigil Kentaurus, is a yellow star of the Sun’s own kind, G2, a little heavier and wider than the Sun. B, named Toliman, is an orange K1 star, a little smaller and cooler. On their stretched orbit they come within 11 times the Earth–Sun distance of each other and draw apart to 36 — from Saturn’s distance to beyond Neptune’s, if one stood where the Sun is. They were last closest in 1955, and will be again in 2035.',
    'Proxima Centauri is a red dwarf of spectral type M5.5, an eighth of the Sun’s mass and far too faint to see without a telescope. About 13,000 times the Earth–Sun distance from the pair, it is now near the farthest point of its orbit, and that puts it a little nearer to us than they are: 4.25 light years, against their 4.37. So the nearest star is Proxima, and the nearest system is all three.',
    'Planets are known around one of them. Proxima has two: b, at least about Earth’s mass, in the zone where water could be liquid, and d, at least a quarter of it, closer in; a third signal, c, is not confirmed. Around A, the James Webb Space Telescope saw in 2024 a single point of light that may be a giant planet, called S1; it was not there when Webb looked again. Around B, none is known. Every one of them was found by its star’s motion, or as that one point; none has been seen as a world.',
  ],
  photos: [SOUTHERN_CROSS, SKY_SURVEY, HUBBLE_PAIR],
  sections: [
    {
      title: 'In the sky',
      text: [
        'To the eye, A and B are one star, the third brightest of the night after Sirius and Canopus, in the southern constellation of Centaurus. With Beta Centauri it is one of the two Pointers that lead to the Southern Cross. Proxima, two degrees away, needs a telescope.',
      ],
      points: [
        {
          title: 'Where it can be seen',
          text: 'At declination −60.8°, it never rises north of about latitude 29° N: not from Europe, nor from most of the United States, China or Japan. South of about 29° S it never sets: from Buenos Aires, Sydney or Cape Town it is up all night, every night of the year, though at its lowest it skims the horizon.',
          cite: ['simbad'],
        },
        {
          title: 'Through a telescope',
          text: 'A small telescope splits it into A and B. By the pair’s orbit they are 9 arcseconds apart in 2026 and 10 by 2030, then close fast, to 1.7 at the end of 2037, as B swings past A on an orbit we see nearly edge-on.',
          cite: ['kervella2016'],
        },
      ],
    },
    {
      title: 'Getting there',
      text: [
        'At Voyager 1’s speed the trip would take some 75,000 years, and Voyager 1 is not headed there.',
      ],
      points: [
        {
          title: 'Breakthrough Starshot',
          text: 'The one worked-out plan to send something: announced in 2016, it would push probes weighing grams on sails metres across with a bank of lasers on the ground, to 15–20% of the speed of light, and reach Alpha Centauri some twenty years after launch; their pictures would take another four years to come back. It is a study: no probe or laser for it has been built.',
          cite: ['starshot'],
        },
      ],
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Alpha Centauri, and its search result, put the camera 120 AU from A, 20° off the pole of the pair’s orbit, so that A’s and B’s orbits about their barycentre — 36 AU across at the widest — fill the middle of the frame as the ellipses they are. From the Sun that orbit is seen 79° from face-on, nearly edge-on: two lines.',
      cite: ['kervella2016'],
    },
    {
      title: 'Where each star is',
      text: 'A and B on Kervella et al.’s orbit of the pair, their barycentre on its measured path through the Galaxy; Proxima where Gaia DR3 puts it, carried on its own position and motion, 13,000 AU from them — more than a hundred times the frame — and its own vast orbit drawn about the pair, worked out from its velocity relative to them.',
      cite: ['kervella2016', 'kervella2017', 'gaia2023'],
    },
    {
      title: 'Their sizes',
      text: 'All three at their real sizes, so from the system’s view each is far smaller than a pixel and shows by its light and its mark. A and B are spheres of their measured radii; Proxima’s radius is a red-dwarf relation’s.',
      cite: ['kervella2017radii', 'mann2015'],
    },
    {
      title: 'Its planets',
      text: 'Proxima b and d at the periods and minimum masses their discoverers fitted, their orbits edge-on as seen from the Sun — a convention, for their tilt is unknown. Proxima c and A’s S1 are drawn grey and named candidates; S1 on one of the orbits its discoverers fitted.',
      cite: ['faria2022', 'suarez2025', 'damasso2020', 'beichman2025'],
    },
    {
      title: 'Its names',
      text: 'From far away the three are one name, “Alpha Centauri”; nearer, Proxima separates from the pair, and the pair is “α Cen A + B” until their two marks part. Each star is then shown by its Bayer letter and its proper name: α Cen A (Rigil Kentaurus), α Cen B (Toliman), Proxima Centauri.',
      cite: ['wgsn'],
    },
  ],
  measured: [
    {
      title: 'The orbit of A and B',
      text: 'Fitted to the pair’s measured positions, old and new: 79.93 years, eccentricity 0.52, 23.6 AU in semi-major axis, from 11.3 to 35.8 AU apart. Its period and size weigh the stars: A 1.1055 times the Sun’s mass, B 0.9373.',
      cite: ['kervella2016'],
    },
    {
      title: 'Their distances',
      text: 'A and B, 4.37 light years, from the pair’s parallax of 747.17 milliarcseconds; Gaia gives none for either, too bright for it. Proxima, 4.25 light years, from Gaia DR3’s parallax of 768.07.',
      cite: ['kervella2016', 'gaia2023'],
    },
    {
      title: 'Their kinds',
      text: 'A G2V, B K1V, Proxima M5.5Ve: two dwarfs still burning hydrogen like the Sun, and a red dwarf that flares.',
      cite: ['simbad'],
    },
    {
      title: 'That Proxima is bound',
      text: 'Its distance and its motion through space are so close to the pair’s that it is bound to them with high confidence, not passing by.',
      cite: ['kervella2017'],
    },
    {
      title: 'Proxima’s planets',
      text: 'b, 11.19 days round, at least 1.07 Earth masses, found in 2016; d, 5.12 days round, at least 0.26, reported in 2022 and confirmed in 2025. Both from the star’s wobble in radial velocity.',
      cite: ['anglada2016', 'faria2022', 'suarez2025'],
    },
    {
      title: 'The candidate S1',
      text: 'One point of light seen by Webb’s MIRI coronagraph on 10 August 2024, 1.5 arcseconds from A, about 2 AU in projection; not seen again in February or April 2025.',
      cite: ['beichman2025'],
    },
  ],
  estimated: [
    {
      title: 'Proxima’s orbit',
      text: 'About 8,700 AU in semi-major axis, eccentricity 0.50, some 547,000 years round, coming within 4,300 AU of the pair and going out to 13,000, where it is now. The period could be 40,000 years shorter or 66,000 longer.',
      cite: ['kervella2017'],
    },
    {
      title: 'Where a planet can stay',
      text: 'B’s pull clears out wide orbits. By Holman & Wiegert’s fit to simulated planets in double stars, with the pair’s measured orbit, a planet stays for good within about 2.8 AU of A and 2.5 AU of B. A’s habitable zone, where S1 was seen, lies inside that.',
      cite: ['holman1999', 'kervella2016', 'beichman2025'],
    },
    {
      title: 'Proxima’s size and mass',
      text: '0.154 times the Sun’s radius and 0.122 times its mass: from relations for red dwarfs calibrated on stars whose sizes are measured, not measured on Proxima.',
      cite: ['mann2015', 'kervella2017'],
    },
    {
      title: 'Proxima c',
      text: 'A 1,900-day signal that would be a world of at least 5.8 Earth masses 1.5 AU out, or the star’s own activity.',
      cite: ['damasso2020'],
    },
  ],
  missing: [
    {
      title: 'Planets around A and B',
      text: 'Whether S1 is a planet, and whether either star has smaller ones, is not known. The planet announced around B in 2012 did not survive a second look at the data; none is drawn there.',
      cite: ['beichman2025', 'dumusque2012', 'rajpaul2016'],
    },
    {
      title: 'The planets’ true masses and their air',
      text: 'A star’s wobble gives only a minimum mass, and none of Proxima’s planets passes in front of it, so the tilt of their orbits, their true masses and whether they have any atmosphere are unknown.',
      cite: ['anglada2016'],
    },
    {
      title: 'Whatever else orbits there',
      text: 'Comets, dust, an outer cloud like the Sun’s: none has been seen, and none is drawn.',
    },
  ],
  misconceptions: [
    {
      title: 'Alpha Centauri is not the nearest star',
      text: 'The nearest star is Proxima, at 4.25 light years; A and B, the bright point people call Alpha Centauri, are 4.37. But Proxima is one of its three, so the nearest system of stars is Alpha Centauri.',
      cite: ['gaia2023', 'kervella2016'],
    },
    {
      title: 'Not a double star',
      text: 'It is three stars, not two. Proxima, so far out that it was long uncertain whether it belonged, is bound to the pair.',
      cite: ['kervella2017'],
    },
    {
      title: 'Rigil Kentaurus and Toliman are not other stars',
      text: 'They are the proper names the IAU gave A and B in 2016 and 2018. Proxima Centauri’s, approved in 2016, is the one in common use.',
      cite: ['wgsn'],
    },
    {
      title: 'Proxima is not beside the pair',
      text: 'Two degrees apart on our sky, it is 13,000 AU from them in space — over 400 times Neptune’s distance from the Sun. From Proxima, A and B would be a brilliant double star, not suns.',
      cite: ['kervella2017'],
    },
    {
      title: 'Planets can orbit there',
      text: 'Two suns do not rule out planets: within a few AU of either star an orbit is stable, and Proxima, so far from the others, keeps its own planets as a single star does.',
      cite: ['holman1999'],
    },
  ],
  sources: [
    {
      key: 'kervella2016',
      text: 'Kervella, P., Mignard, F., Mérand, A., & Thévenin, F. 2016, Close stellar conjunctions of α Centauri A and B until 2050, A&A 594, A107',
      url: 'https://doi.org/10.1051/0004-6361/201629201',
    },
    {
      key: 'kervella2017',
      text: 'Kervella, P., Thévenin, F., & Lovis, C. 2017, Proxima’s orbit around α Centauri, A&A 598, L7',
      url: 'https://doi.org/10.1051/0004-6361/201629930',
    },
    {
      key: 'kervella2017radii',
      text: 'Kervella, P., Bigot, L., Gallenne, A., & Thévenin, F. 2017, The radii and limb darkenings of α Centauri A and B, A&A 597, A137',
      url: 'https://doi.org/10.1051/0004-6361/201629505',
    },
    {
      key: 'gaia2023',
      text: 'Gaia Collaboration, Vallenari, A., et al. 2023, Gaia Data Release 3: Summary of the content and survey properties, A&A 674, A1',
      url: 'https://doi.org/10.1051/0004-6361/202243940',
    },
    {
      key: 'mann2015',
      text: 'Mann, A. W., Feiden, G. A., Gaidos, E., Boyajian, T., & von Braun, K. 2015, How to Constrain Your M Dwarf, ApJ 804, 64',
      url: 'https://doi.org/10.1088/0004-637X/804/1/64',
    },
    {
      key: 'simbad',
      text: 'Wenger, M., et al. 2000, The SIMBAD astronomical database, A&AS 143, 9 (alf Cen A, alf Cen B and Proxima Cen: positions and spectral types)',
      url: 'https://doi.org/10.1051/aas:2000332',
    },
    {
      key: 'anglada2016',
      text: 'Anglada-Escudé, G., et al. 2016, A terrestrial planet candidate in a temperate orbit around Proxima Centauri, Nature 536, 437',
      url: 'https://doi.org/10.1038/nature19106',
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
      key: 'damasso2020',
      text: 'Damasso, M., Del Sordo, F., et al. 2020, A low-mass planet candidate orbiting Proxima Centauri at a distance of 1.5 AU, Sci. Adv. 6, eaax7467',
      url: 'https://doi.org/10.1126/sciadv.aax7467',
    },
    {
      key: 'beichman2025',
      text: 'Beichman, C., Sanghi, A., et al. 2025, Worlds Next Door: A Candidate Giant Planet Imaged in the Habitable Zone of α Centauri A. I. Observations, Orbital and Physical Properties, and Exozodi Upper Limits, ApJL 989, L22',
      url: 'https://doi.org/10.3847/2041-8213/adf53f',
    },
    {
      key: 'dumusque2012',
      text: 'Dumusque, X., Pepe, F., et al. 2012, An Earth-mass planet orbiting α Centauri B, Nature 491, 207',
      url: 'https://doi.org/10.1038/nature11572',
    },
    {
      key: 'rajpaul2016',
      text: 'Rajpaul, V., Aigrain, S., & Roberts, S. 2016, Ghost in the time series: no planet for Alpha Cen B, MNRAS 456, L6',
      url: 'https://doi.org/10.1093/mnrasl/slv164',
    },
    {
      key: 'holman1999',
      text: 'Holman, M. J., & Wiegert, P. A. 1999, Long-Term Stability of Planets in Binary Systems, AJ 117, 621',
      url: 'https://doi.org/10.1086/300695',
    },
    {
      key: 'wgsn',
      text: 'IAU Working Group on Star Names, IAU Catalog of Star Names (IAU-CSN)',
      url: 'https://www.pas.rochester.edu/~emamajek/WGSN/IAU-CSN.txt',
    },
    {
      key: 'starshot',
      text: 'Breakthrough Initiatives, Breakthrough Starshot',
      url: 'https://breakthroughinitiatives.org/initiative/3',
    },
  ],
};
