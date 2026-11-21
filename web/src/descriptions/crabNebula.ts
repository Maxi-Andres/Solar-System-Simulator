import type { Description } from './types.ts';

/**
 * The Crab Nebula, M1. Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/supernovaRemnants.ts, scene/remnantMap.ts,
 * scene/SupernovaRemnants.tsx, core/pulsars.ts and public/remnants/CREDITS.md.
 */
export const CRAB_NEBULA: Description = {
  id: 'snr-crab',
  lead: [
    'In the summer of 1054 a new star appeared in the sky, so bright that for 23 days it could be seen in daylight. Chinese astronomers wrote it down as a “guest star”. Nearly a thousand years later we can point a telescope where they pointed and see what they saw happen: the wreck of a star that blew itself apart, still flying outward, with the collapsed core of that star spinning at its heart thirty times a second.',
    'The Crab Nebula is the remnant of that supernova, about 6,500 light years away in the constellation Taurus. The star that exploded had some ten times the Sun’s mass. Its outer layers, thrown off in the blast, now make the tangle of glowing filaments that gives the nebula its name; its core collapsed into a neutron star, matter crushed so tight that a ball the size of a city holds more mass than the Sun.',
    'That neutron star is a pulsar: it sweeps beams of radiation past Earth 30 times a second, a pulse every 33 milliseconds, found in 1968. As it slows down it pours out about a hundred thousand times the Sun’s power, as a wind of particles moving close to the speed of light; caught in the nebula’s magnetic field they glow from radio waves to X-rays. That glow, not the filaments, is most of the light: the nebula is lit from inside by a dead star’s spin.',
    'The English astronomer John Bevis found the nebula in 1731. Charles Messier, looking for the return of Halley’s comet, came across it and at first took it for the comet; it is M1, the first entry in his catalogue. It is too faint for the naked eye now, magnitude 8.4, but a small telescope shows it.',
  ],
  photos: [
    {
      file: 'photos/crab-nebula/vlt.webp',
      largeFile: 'photos/crab-nebula/vlt-large.webp',
      width: 640,
      height: 644,
      title: 'The Crab from ESO’s Very Large Telescope',
      caption:
        'The picture the app draws it from. Three filters: blue light shown blue, mostly the synchrotron glow of the pulsar’s particles; red light shown green, mostly hydrogen in the gas the star threw off; and ionised sulphur’s red line shown red. So hydrogen’s red appears green here: not an eye’s colours. The pulsar is the lower right of the two close stars near the middle.',
      colour: 'false',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '1999-11-17',
      sourceUrl: 'https://www.eso.org/public/images/eso9948f/',
    },
    {
      file: 'photos/crab-nebula/hubble-2005.webp',
      largeFile: 'photos/crab-nebula/hubble-2005-large.webp',
      width: 640,
      height: 640,
      title: 'Hubble’s mosaic, 2005',
      caption:
        'Assembled from 24 exposures, the largest image Hubble’s WFPC2 camera ever made and the sharpest of the whole nebula then: its filaments through filters for neutral oxygen, ionised sulphur and doubly ionised oxygen, each given a colour.',
      colour: 'false',
      credit: 'NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2005-12-01',
      sourceUrl: 'https://esahubble.org/images/heic0515a/',
    },
    {
      file: 'photos/crab-nebula/hubble-2024.webp',
      largeFile: 'photos/crab-nebula/hubble-2024-large.webp',
      width: 640,
      height: 640,
      title: 'Hubble again, 2024',
      caption:
        'The hottest, thinnest gas in blue, dense neutral oxygen in green, energised sulphur in red, and at the centre a white haze of synchrotron light from the pulsar’s particles, which heats the filaments round it. The black notches are where the mosaic has no data.',
      colour: 'false',
      credit: 'NASA, ESA, STScI, W. Blair (JHU); image processing J. DePasquale (STScI)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: 'released 2026-03-23',
      sourceUrl: 'https://esahubble.org/images/heic2607a/',
    },
    {
      file: 'photos/crab-nebula/webb.webp',
      largeFile: 'photos/crab-nebula/webb-large.webp',
      width: 640,
      height: 558,
      title: 'The Crab in infrared, from Webb',
      caption:
        'A cage of filaments of doubly ionised sulphur in red-orange, dust in yellow-white and green, a milky synchrotron glow filling the inside, and filaments of ionised iron in blue; at the centre, the pulsar in a ring, with wisps tracing its magnetic field. Infrared shown in visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI, T. Temim (Princeton University)',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2023-10-30',
      sourceUrl: 'https://esawebb.org/images/weic2326a/',
    },
    {
      file: 'photos/crab-nebula/chandra.webp',
      largeFile: 'photos/crab-nebula/chandra-large.webp',
      width: 640,
      height: 640,
      title: 'The Crab in X-rays, from Chandra',
      caption:
        'X-rays, which no eye sees, shown in purple. The X-ray nebula is much smaller than the visible one: the pulsar’s freshest, most energetic particles glow round it, in a ring and a jet.',
      colour: 'false',
      credit: 'NASA/CXC',
      licence: 'CC BY 4.0 (ESA/Hubble picture of the week); Chandra content not copyrighted',
      date: 'released 2017-05-15',
      sourceUrl: 'https://esahubble.org/images/potw1720f/',
    },
    {
      file: 'photos/crab-nebula/pulsar-pulses.webp',
      largeFile: 'photos/crab-nebula/pulsar-pulses-large.webp',
      width: 640,
      height: 429,
      title: 'The pulsar blinking, from the VLT',
      caption:
        'A time sequence of the Crab pulsar in visible light: each dot along the middle row is one pulse, one every 33 milliseconds. Black and white.',
      colour: 'true',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '1999-11-17',
      sourceUrl: 'https://www.eso.org/public/images/eso9948h/',
    },
  ],
  drawnHere: [
    {
      title: 'In its own colours, unmixed from the photograph’s',
      text: 'Its light is ESO’s VLT picture, its stars taken out and its sky taken off — but not in that picture’s colours, which are its three filters’: [S II] put in red, the broad R band (mostly hydrogen’s H-alpha) in green, the B band in blue. Each pixel is unmixed instead. Its synchrotron share, found by its colour (the bluest bright pixels at the middle), is drawn in the synchrotron’s own colour, a bluish white, from its measured power-law spectrum. What is left is the filaments’ lines: the red filter is [S II], and the green less the red is H-alpha with [N II] and [O I]. Green is scaled against blue by how much of the power law each filter passes; red against green so that over the whole picture [S II] is the share of those lines the filaments’ spectrum gives, which leaves it varying pixel to pixel as the picture says. Then [S II] is drawn deep red, and H-alpha’s group, with H-beta, red going pink, so the filaments are red to pink over the synchrotron’s bluish white. The lines are about 12% of its visible light — and less to the eye than to a camera, since the eye is twelve times less sensitive at H-alpha’s 656 nm than at 555 nm — so in the bright middle the filaments are faint against the glow, and stand out at the edges, where the synchrotron thins. One gain keeps the picture’s total light.',
      cite: ['esovlt', 'veroncetty1993', 'davidsonfesen1985'],
    },
    {
      title: 'Its [O III], spread',
      text: 'Partly a choice. None of the picture’s three filters passes [O III]’s 500.7 nm, so where it is, pixel by pixel, is not in the picture. Its total goes with H-alpha’s, as strong, at the filaments’ typical ratio. Where it goes is measured in kind: Hubble found only about a tenth of the Crab’s [O III] in compact structures, against four-fifths of its [O I] — it is a diffuse glow and a skin round the nebula, not the filaments’ colour. So a tenth rides on the filaments, and the rest is spread over about a quarter of an arcminute round them, a faint teal haze; how far it is spread is the choice. To the eye 500.7 nm is four times brighter than H-alpha, so laid on the filaments it had turned them a pale teal, which no colour photograph of the Crab shows. H-alpha’s group is drawn in one proportion of hydrogen, nitrogen and oxygen, though only its sum is measured.',
      cite: ['davidsonfesen1985', 'sankrit1998'],
    },
    {
      title: 'Where its two lights lie in depth',
      text: 'Nothing measures how deep along the line of sight each part lies. The synchrotron fills the volume, most at its middle, since the pulsar’s wind fills it; the filaments’ light is put at the shell, on its near or far side as noise decides. From Earth the sum is the photograph unmixed into true colour; from the side, its depth is a model’s.',
      cite: ['hester2008'],
    },
    {
      title: 'Its shape',
      text: 'A spheroid stretched along the pulsar’s spin axis, which the X-ray ring round the pulsar gives, its south-east end toward us: a pulsar wind nebula is pinched along that axis by its own magnetic field.',
      cite: ['weisskopf2013'],
    },
    {
      title: 'Its pulsar',
      text: 'Marked in the Pulsars layer, from the ATNF Pulsar Catalogue; gone to, it becomes a body, drawn at the 12 km radius every neutron star without a measured one is given — a convention, not its measured size.',
    },
  ],
  measured: [
    {
      title: 'The supernova',
      text: 'First observed on 5 July 1054 by Chinese astronomers; visible in daylight for the next 23 days.',
      cite: ['esa1054', 'nasam1'],
    },
    {
      title: 'Distance',
      text: 'About 2,000 pc, 6,500 light years, from the expansion of its filaments: how fast they move across the sky over the years, set against how fast they approach and recede, measured from their spectra.',
      cite: ['trimble1968', 'nasam1'],
    },
    {
      title: 'Its size',
      text: '7′ by 5′ in Green’s catalogue of Galactic supernova remnants, which lists it as filled-centre: lit from inside by a pulsar wind rather than a shell.',
      cite: ['green2025'],
    },
    {
      title: 'The pulsar',
      text: 'Found in 1968, among the first pulsars; it pulses 30 times a second, once every 33 milliseconds, its visible light at the same rate as its radio waves. Its spin-down powers about 10⁵ times the Sun’s luminosity.',
      cite: ['staelin1968', 'esopulses', 'esa1054', 'hester2008'],
    },
    {
      title: 'What it is made of',
      text: 'An outer nebula holding several solar masses of material thrown off by the explosion, and inside it the pulsar’s trapped wind, shining as synchrotron radiation from radio to X-rays.',
      cite: ['hester2008'],
    },
    {
      title: 'Its wisps',
      text: 'Near the pulsar, wisps of gas move outward at half the speed of light.',
      cite: ['nasam1'],
    },
    {
      title: 'Its discovery, and how bright',
      text: 'Found by John Bevis in 1731. Apparent magnitude 8.4: a small telescope shows it; best seen in January.',
      cite: ['nasam1'],
    },
  ],
  estimated: [
    {
      title: 'The star that exploded',
      text: 'About ten times the Sun’s mass at its birth, from what is left.',
      cite: ['nasaheart'],
    },
    {
      title: 'The pulsar’s age, from its spin',
      text: 'Its period and how fast it lengthens give a characteristic age of 1,257 years, from a model of its slowing at a constant rate — older than the 972 years since 1054. A pulsar’s spin age is a model’s estimate, and here the history book is the check.',
    },
  ],
  missing: [
    {
      title: 'Its expansion',
      text: 'It stands still here. Its filaments do move: its distance is measured from that motion.',
      cite: ['trimble1968'],
    },
    {
      title: 'Its X-ray and infrared nebulae',
      text: 'Not drawn: only its visible light is, from the photograph.',
    },
    {
      title: 'The pulsar’s beams',
      text: 'Not drawn: the pulsar is a mark, or a sphere when gone to; its sweeping beams and its pulses are not drawn.',
    },
  ],
  misconceptions: [
    {
      title: 'The explosion did not happen in 1054',
      text: 'It was seen in 1054. At 6,500 light years, the light left the star some 6,500 years before.',
      cite: ['nasam1'],
    },
    {
      title: 'You cannot see it with the naked eye',
      text: 'The supernova could be seen even by day; the nebula it left shines at magnitude 8.4, and needs a telescope.',
      cite: ['nasam1', 'esa1054'],
    },
    {
      title: 'Its light is not mostly glowing gas',
      text: 'The filaments are what the eye picks out in photographs, but most of its light, from radio to X-rays, is synchrotron radiation from the pulsar’s wind, powered by the neutron star’s spin.',
      cite: ['hester2008'],
    },
    {
      title: 'Its famous colours are not its own',
      text: 'Most of its famous pictures assign colours to filters for single elements or to infrared and X-rays; the one this app is drawn from shows hydrogen in green. In its own light the synchrotron glow is a bluish white and the filaments red to pink, which is how it is drawn here.',
      cite: ['esovlt', 'esahubble2005'],
    },
  ],
  sources: [
    {
      key: 'nasam1',
      text: 'NASA Science, Messier 1 (the Crab Nebula), Hubble’s Messier catalogue',
      url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-1/',
    },
    {
      key: 'nasaheart',
      text: 'NASA Science, Peering into the Heart of the Crab Nebula',
      url: 'https://science.nasa.gov/missions/hubble/peering-into-the-heart-of-the-crab-nebula/',
    },
    {
      key: 'esa1054',
      text: 'ESA, 22 April (on the Crab Nebula and the supernova of 1054)',
      url: 'https://www.esa.int/Science_Exploration/Space_Science/22_April',
    },
    {
      key: 'hester2008',
      text: 'Hester, J. J. 2008, The Crab Nebula: An Astrophysical Chimera, ARA&A 46, 127',
      url: 'https://doi.org/10.1146/annurev.astro.45.051806.110608',
    },
    {
      key: 'trimble1968',
      text: 'Trimble, V. 1968, Motions and Structure of the Filamentary Envelope of the Crab Nebula, AJ 73, 535',
      url: 'https://doi.org/10.1086/110658',
    },
    {
      key: 'staelin1968',
      text: 'Staelin, D. H., & Reifenstein, E. C. 1968, Pulsating Radio Sources near the Crab Nebula, Science 162, 1481',
      url: 'https://doi.org/10.1126/science.162.3861.1481',
    },
    {
      key: 'green2025',
      text: 'Green, D. A. 2025, An updated catalogue of 310 Galactic supernova remnants and their statistical properties, J. Astrophys. Astron. 46 (catalogue version of October 2024)',
      url: 'https://doi.org/10.1007/s12036-024-10038-4',
    },
    {
      key: 'weisskopf2013',
      text: 'Weisskopf, M. C. 2013, Observations of the Crab Nebula with the Chandra X-Ray Observatory, PoS(INTEGRAL 2012)004',
      url: 'https://pos.sissa.it/176/004/',
    },
    {
      key: 'veroncetty1993',
      text: 'Véron-Cetty, M.-P., & Woltjer, L. 1993, Spectrophotometry of the continuum in the Crab nebula, A&A 270, 370',
    },
    {
      key: 'davidsonfesen1985',
      text: 'Davidson, K., & Fesen, R. A. 1985, Recent developments concerning the Crab Nebula, ARA&A 23, 119',
      url: 'https://doi.org/10.1146/annurev.aa.23.090185.001003',
    },
    {
      key: 'sankrit1998',
      text: 'Sankrit, R., Hester, J. J., Scowen, P. A., et al. 1998, WFPC2 studies of the Crab Nebula. II. Ionization structure of the Crab filaments, ApJ 504, 344',
      url: 'https://doi.org/10.1086/306078',
    },
    {
      key: 'esovlt',
      text: 'ESO, The Crab Nebula in Taurus (eso9948f), image caption',
      url: 'https://www.eso.org/public/images/eso9948f/',
    },
    {
      key: 'esopulses',
      text: 'ESO, Time sequence of Crab pulsar (eso9948h), image caption',
      url: 'https://www.eso.org/public/images/eso9948h/',
    },
    {
      key: 'esahubble2005',
      text: 'ESA/Hubble, Most detailed image of the Crab Nebula (heic0515a), image caption',
      url: 'https://esahubble.org/images/heic0515a/',
    },
  ],
};
