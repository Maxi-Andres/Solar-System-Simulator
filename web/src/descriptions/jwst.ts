import type { Description } from './types.ts';

/**
 * The James Webb Space Telescope. Every number here is from the source it cites. What the
 * app draws of it is read off its catalog entry (generated.ts), which hangs it from Earth.
 */
export const JWST: Description = {
  id: 'jwst',
  lead: [
    'Light from the first galaxies has been travelling for more than thirteen billion years, stretched on the way by the expanding universe from visible into infrared, too faint and too red for any telescope before. The James Webb Space Telescope was built to catch it — and in its first two years it found galaxies whose light left them less than 300 million years after the Big Bang, when the universe was about two percent of its present age. Every picture it takes is a picture of the past.',
    'It is an infrared observatory built by NASA with the European and Canadian space agencies, launched on an Ariane 5 from French Guiana on 25 December 2021. Its mirror is 6.5 metres across, made of 18 hexagonal segments of beryllium coated with gold, which unfolded in space; beneath it a five-layer sunshield the size of a tennis court keeps the Sun, Earth and Moon off the telescope. In that shade it cools below 50 kelvin, cold enough not to glow in the infrared it is looking for.',
    'It sees light from the red end of the visible to the mid-infrared, which passes through dust that hides the birth of stars and planets from visible-light telescopes, and reaches galaxies so distant their light has been stretched out of the visible altogether. Besides the earliest galaxies it has read the air of planets around other stars — carbon dioxide on a hot gas giant was its first such find — and watched stars form inside their dust.',
    'It does not orbit Earth. It orbits the Sun, a million and a half kilometres beyond Earth, on a loop around the Sun–Earth L2 point that takes about six months and is about as wide as the Moon’s orbit round Earth; from there the Sun, Earth and Moon all stay on one side, behind the shield. Its launch was so accurate that it has fuel to hold that orbit for well beyond the ten years it was planned to work. The panel gives where it is now.',
  ],
  photos: [
    {
      file: 'photos/jwst/mirror-2016.webp',
      largeFile: 'photos/jwst/mirror-2016-large.webp',
      width: 640,
      height: 480,
      title: 'The primary mirror complete, 2016',
      caption:
        'At NASA Goddard, the 18th and last mirror segment has just been installed; each is about 1.3 m across and weighs about 40 kg. They are face up under dark protective covers, which hide their gold coating, there because gold reflects infrared well.',
      colour: 'true',
      credit: 'NASA/Chris Gunn',
      licence: 'NASA media, not copyrighted',
      date: '2016',
      sourceUrl: 'https://images.nasa.gov/details/GSFC_20171208_Archive_e000422',
    },
    {
      file: 'photos/jwst/launch-2021.webp',
      largeFile: 'photos/jwst/launch-2021-large.webp',
      width: 640,
      height: 619,
      title: 'Launch, 25 December 2021',
      caption: 'Its Ariane 5 lifting off from Europe’s Spaceport at Kourou, French Guiana.',
      colour: 'true',
      credit: 'NASA/Bill Ingalls',
      licence: 'NASA media, not copyrighted',
      date: '2021-12-25',
      sourceUrl: 'https://images.nasa.gov/details/NHQ202112250015',
    },
    {
      file: 'photos/jwst/first-deep-field-2022.webp',
      largeFile: 'photos/jwst/first-deep-field-2022-large.webp',
      width: 640,
      height: 653,
      title: 'Webb’s First Deep Field, July 2022',
      caption:
        'The galaxy cluster SMACS 0723, whose mass bends and magnifies the light of galaxies far behind it into arcs. Thousands of galaxies in a patch of sky about the size of a grain of sand held at arm’s length. Near-infrared light shown in visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI',
      licence: 'NASA media; credit requested',
      date: '2022-07-12',
      sourceUrl: 'https://images.nasa.gov/details/webb_first_deep_field',
    },
    {
      file: 'photos/jwst/cosmic-cliffs-2022.webp',
      largeFile: 'photos/jwst/cosmic-cliffs-2022-large.webp',
      width: 640,
      height: 370,
      title: 'The “Cosmic Cliffs” of the Carina Nebula, July 2022',
      caption:
        'The edge of a cavity carved in the star-forming region NGC 3324, about 7,600 light years away, by the light and winds of young, massive stars above the frame. Infrared reveals hundreds of stars hidden in the dust. Near-infrared light shown in visible colours.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI',
      licence: 'NASA media; credit requested',
      date: '2022-07-12',
      sourceUrl: 'https://images.nasa.gov/details/carina_nebula',
    },
    {
      file: 'photos/jwst/southern-ring-2022.webp',
      largeFile: 'photos/jwst/southern-ring-2022-large.webp',
      width: 640,
      height: 297,
      title: 'The Southern Ring Nebula in two infrareds, July 2022',
      caption:
        'Shells of gas shed by a dying star, seen in near infrared (left) and mid infrared (right). In the right-hand image the dying star, a white dwarf wrapped in dust, shows as the red point at the centre. Each wavelength is given a colour: none of it is visible light.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI',
      licence: 'NASA media; credit requested',
      date: '2022-07-12',
      sourceUrl: 'https://images.nasa.gov/details/southern_ring_nebula',
    },
    {
      file: 'photos/jwst/pillars-2022.webp',
      largeFile: 'photos/jwst/pillars-2022-large.webp',
      width: 404,
      height: 700,
      title: 'The Pillars of Creation, October 2022',
      caption:
        'Columns of gas and dust in the Eagle Nebula, about 6,500 light years away, where stars are forming: the bright red points are newly formed stars, and the wavy red lines at the pillars’ edges are ejections from stars still forming. Six near-infrared filters shown as purple through red.',
      colour: 'false',
      credit: 'NASA, ESA, CSA, STScI; Image Processing: Joseph DePasquale (STScI), Anton Koekemoer (STScI), Alyssa Pagan (STScI)',
      licence: 'NASA media; credit requested',
      date: '2022-10-19',
      sourceUrl: 'https://science.nasa.gov/asset/webb/pillars-of-creation-nircam-image/',
    },
  ],
  drawnHere: [
    {
      title: 'Around L2, never on it',
      text: 'The Lagrange Points layer marks Sun–Earth L2, computed for each instant. Webb is drawn where JPL puts it, on its halo orbit around that point, and its trail draws the loop about Earth it makes as both go round the Sun.',
      cite: ['jwstorbit'],
    },
  ],
  measured: [
    {
      title: 'Launch',
      text: 'On 25 December 2021, on an Ariane 5 from Kourou. It took about 30 days to reach the start of its orbit around L2, unfolding its sunshield and mirror on the way; science began in July 2022.',
      cite: ['gardner2023', 'jwstorbit'],
    },
    {
      title: 'The telescope',
      text: 'A primary mirror 6.5 m across of 18 gold-coated beryllium segments, and a five-layer sunshield about 21 by 14 m. It observes from 0.6 to 28.5 micrometres, from the red end of the visible to the mid-infrared.',
      cite: ['gardner2023', 'menzel2023'],
    },
    {
      title: 'Its orbit',
      text: 'About 1.5 million km from Earth, around the Sun–Earth L2 point, once in about six months, on a loop about as wide as the Moon’s orbit. It never passes into the shadow of Earth or the Moon.',
      cite: ['jwstorbit'],
    },
    {
      title: 'As built, and better',
      text: 'In commissioning its sensitivity, stability and image quality proved what its science needs, and in most modes it reaches faint targets faster than expected.',
      cite: ['rigby2023'],
    },
    {
      title: 'The earliest galaxies',
      text: 'Galaxies confirmed by their spectra at redshifts 10.3 to 13.2 in 2023, and in 2024 JADES-GS-z14-0 at redshift 14.32, seen as it was less than 300 million years after the Big Bang.',
      cite: ['curtislake2023', 'carniani2024'],
    },
    {
      title: 'Other worlds’ air',
      text: 'Carbon dioxide in the atmosphere of the hot gas giant WASP-39b, the first clear detection of it in a planet around another star.',
      cite: ['ers2023'],
    },
  ],
  estimated: [
    {
      title: 'How long it can work',
      text: 'After its precise launch and course corrections, NASA estimated it has propellant to hold its orbit for significantly more than its planned ten-year science life. Fuel is not the only limit: wear and micrometeoroid hits count too.',
      cite: ['jwstfuel', 'rigby2023'],
    },
    {
      title: 'How far back it sees',
      text: 'A galaxy’s age at the light’s departure comes from its redshift through a model of the universe’s expansion; the “less than 300 million years” assumes the standard model.',
      cite: ['carniani2024'],
    },
  ],
  missing: [
    {
      title: 'What it is looking at',
      text: 'Not drawn: it turns from target to target on an observing plan no data here carry. It is drawn with its sunshield to the Sun, which is always true of it, but not its pointing beyond that.',
    },
    {
      title: 'The light it collects',
      text: 'Not shown in the scene: its images are infrared, and every one is a choice of colours for wavelengths no eye sees. The photos above say which.',
    },
  ],
  misconceptions: [
    {
      title: 'It is not at L2',
      text: 'There is nothing at the L2 point, and Webb is not parked on it: it circles it, on a halo orbit hundreds of thousands of kilometres wide, which keeps it out of Earth’s shadow.',
      cite: ['jwstorbit'],
    },
    {
      title: 'It does not orbit Earth',
      text: 'It orbits the Sun, kept in step with Earth by the combined pull of both; seen from Earth it loops around a point 1.5 million km away, four times farther than the Moon.',
      cite: ['jwstorbit'],
    },
    {
      title: 'Its colours are not what you would see',
      text: 'Nearly all it sees is infrared, invisible to the eye. Its pictures map each infrared band to a visible colour, shortest to blue and longest to red, so they are false colour by necessity.',
      cite: ['gardner2023'],
    },
    {
      title: 'It is not Hubble’s replacement',
      text: 'It sees mostly in infrared; Hubble sees ultraviolet and visible light Webb cannot. The two work side by side.',
      cite: ['gardner2023', 'hubble'],
    },
  ],
  sources: [
    {
      key: 'gardner2023',
      text: 'Gardner, J. P., et al. 2023, The James Webb Space Telescope Mission, PASP 135, 068001',
      url: 'https://doi.org/10.1088/1538-3873/acd1b5',
    },
    {
      key: 'menzel2023',
      text: 'Menzel, M., et al. 2023, The Design, Verification, and Performance of the James Webb Space Telescope, PASP 135, 058002',
      url: 'https://doi.org/10.1088/1538-3873/acbb9f',
    },
    {
      key: 'rigby2023',
      text: 'Rigby, J., et al. 2023, The Science Performance of JWST as Characterized in Commissioning, PASP 135, 048001',
      url: 'https://doi.org/10.1088/1538-3873/acb293',
    },
    {
      key: 'jwstorbit',
      text: 'NASA Science, Webb’s Orbit (mission page)',
      url: 'https://science.nasa.gov/mission/webb/orbit/',
    },
    {
      key: 'jwstfuel',
      text: 'NASA 2021, NASA Says Webb’s Excess Fuel Likely to Extend its Lifetime Expectations (Webb blog, 29 December 2021)',
      url: 'https://science.nasa.gov/blogs/webb/2021/12/29/nasa-says-webbs-excess-fuel-likely-to-extend-its-lifetime-expectations/',
    },
    {
      key: 'curtislake2023',
      text: 'Curtis-Lake, E., et al. 2023, Spectroscopic confirmation of four metal-poor galaxies at z = 10.3–13.2, Nat. Astron. 7, 622',
      url: 'https://doi.org/10.1038/s41550-023-01918-w',
    },
    {
      key: 'carniani2024',
      text: 'Carniani, S., et al. 2024, Spectroscopic confirmation of two luminous galaxies at a redshift of 14, Nature 633, 318',
      url: 'https://doi.org/10.1038/s41586-024-07860-9',
    },
    {
      key: 'ers2023',
      text: 'JWST Transiting Exoplanet Community Early Release Science Team 2023, Identification of carbon dioxide in an exoplanet atmosphere, Nature 614, 649',
      url: 'https://doi.org/10.1038/s41586-022-05269-w',
    },
    {
      key: 'hubble',
      text: 'NASA Science, Hubble Space Telescope (mission overview)',
      url: 'https://science.nasa.gov/mission/hubble/overview/',
    },
  ],
};
