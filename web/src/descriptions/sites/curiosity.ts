import type { Description } from '../types.ts';

/**
 * Curiosity, in Gale crater, drawn on NASA's traverse (catalog SURFACE_CRAFT, core/surface.ts).
 * Every fact from the source it cites: NASA's and JPL's pages, the photo captions, the papers.
 * How it is drawn is mostly read off its data (generated.ts); drawnHere adds what is its own.
 */
export const CURIOSITY: Description = {
  id: 'curiosity',
  lead: [
    'Curiosity went to Mars to answer a question one step short of “is there life?”: could there ever have been? In its first year it drilled into a flat rock in Gale crater and found the answer was yes. Three and a half billion years ago this was the bed of a lake of fresh water, neither acid nor salty, with the elements life uses and the chemical energy some microbes on Earth live on. No one knows whether anything lived in it. But the place was fit for life, and the rover is still there, reading the rest of the story in the layers of a mountain.',
    'It is NASA’s, designed and built by JPL: a rover the size of a small SUV, 899 kg, with ten science instruments, seventeen cameras, a laser that vaporises rock and a drill. It runs not on sunlight but on the heat of plutonium-238, turned into electricity. It was too heavy to land on airbags as Spirit and Opportunity had, so on 6 August 2012 a rocket-powered descent stage hovered over Gale crater, lowered it on ropes to the ground, cut them and flew off to crash at a safe distance: the sky crane.',
    'Gale is a crater with a mountain in the middle, Mount Sharp: layer upon layer of rock laid down in and around its old lakes, then carved out by the wind. Near the landing site Curiosity found rounded pebbles cemented into rock, from a stream that once ran ankle- to hip-deep. In mudstones at the mountain’s foot it found organic molecules — the carbon compounds that are life’s raw material, though not proof of it — and over years it measured methane in the air rising and falling with the seasons.',
    'It has been climbing Mount Sharp ever since, from layers of clay to layers of sulphate salts, each a record of a changing early Mars. In 2024 it cracked open a rock and found crystals of pure sulphur, a first on Mars. In August 2026 it reached a kilometre above where it began. It is still driving.',
  ],
  photos: [
    {
      file: 'photos/sites/curiosity/hottah-streambed-2012.webp',
      largeFile: 'photos/sites/curiosity/hottah-streambed-2012-large.webp',
      width: 640,
      height: 498,
      title: 'An ancient streambed: Hottah, September 2012',
      caption:
        'A tilted slab of conglomerate on sol 39: gravel up to a few centimetres across cemented in sand, some of it rounded — too big for wind to move, so carried by a vigorous flow of water. The scale bar is 10 cm. From the telephoto Mastcam; NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2012-09-14',
      sourceUrl: 'https://images.nasa.gov/details/PIA16156',
    },
    {
      file: 'photos/sites/curiosity/john-klein-selfie-2013.webp',
      largeFile: 'photos/sites/curiosity/john-klein-selfie-2013-large.webp',
      width: 640,
      height: 918,
      title: 'At John Klein, 3 February 2013',
      caption:
        'A self-portrait from dozens of frames by the camera on its arm, kept out of the shot, at the flat, cracked outcrop chosen for the first drilling — the rock that showed Gale had held a habitable lake. NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2013-02-03',
      sourceUrl: 'https://images.nasa.gov/details/PIA16764',
    },
    {
      file: 'photos/sites/curiosity/earth-evening-star-2014.webp',
      largeFile: 'photos/sites/curiosity/earth-evening-star-2014-large.webp',
      width: 640,
      height: 638,
      title: 'Earth, the evening star, 31 January 2014',
      caption:
        'About 80 minutes after sunset, the bright point above the hills is Earth, 160 million km away, with the Moon just below it. Someone standing there could see both as two bright evening stars. A part of the Mastcam frame.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS/TAMU',
      licence: 'NASA media, not copyrighted',
      date: '2014-01-31',
      sourceUrl: 'https://images.nasa.gov/details/PIA17936',
    },
    {
      file: 'photos/sites/curiosity/mount-sharp-2015.webp',
      largeFile: 'photos/sites/curiosity/mount-sharp-2015-large.webp',
      width: 640,
      height: 316,
      title: 'The layers of Mount Sharp, 9 September 2015',
      caption:
        'Looking up the mountain: a ridge rich in hematite 3 km away, a clay-rich plain, rounded buttes of sulphates, and pale cliffs beyond — a changing Mars, written in layers. White-balanced, so the rocks look as they would on Earth; that makes the sky light blue, which it is not.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2015-09-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA19912',
    },
    {
      file: 'photos/sites/curiosity/murray-buttes-selfie-2016.webp',
      largeFile: 'photos/sites/curiosity/murray-buttes-selfie-2016-large.webp',
      width: 640,
      height: 381,
      title: 'At Murray Buttes, September 2016',
      caption:
        'About 60 frames from the camera on its arm, at the drill site Quela on lower Mount Sharp; the dark mesa behind it stands about 7 m high. The arm is left out of the mosaic. NASA’s caption gives no colour adjustment.',
      colour: 'true',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2016-09-17',
      sourceUrl: 'https://images.nasa.gov/details/PIA20844',
    },
    {
      file: 'photos/sites/curiosity/hirise-mount-sharp-2017.webp',
      largeFile: 'photos/sites/curiosity/hirise-mount-sharp-2017-large.webp',
      width: 640,
      height: 360,
      title: 'Curiosity from orbit, 5 June 2017',
      caption:
        'The bright blue speck in the middle is the rover, 3.0 by 2.8 m, on the northwestern flank of Mount Sharp, seen by HiRISE. It looks bluer than it is: HiRISE records red, blue-green and infrared light, not the colours an eye sees.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/Univ. of Arizona',
      licence: 'NASA media, not copyrighted',
      date: '2017-06-05',
      sourceUrl: 'https://images.nasa.gov/details/PIA21710',
    },
    {
      file: 'photos/sites/curiosity/sulfur-stones-2024.webp',
      largeFile: 'photos/sites/curiosity/sulfur-stones-2024-large.webp',
      width: 640,
      height: 281,
      title: 'The sulphur stones of Gediz Vallis, 11 October 2024',
      caption:
        'A last look at the field of bright stones where Curiosity, driving over one and cracking it, found yellow crystals of pure sulphur — the first on Mars; why they formed here is not known. Colour adjusted to look as it would under Earth’s light.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/MSSS',
      licence: 'NASA media, not copyrighted',
      date: '2024-10-11',
      sourceUrl: 'https://images.nasa.gov/details/PIA26210',
    },
  ],
  drawnHere: [
    {
      title: 'Not where Horizons puts it',
      text: 'JPL Horizons holds Curiosity at its 2012 landing site, kilometres from where it has driven since; the app follows the rover’s own published traverse instead.',
    },
    {
      title: 'Above its real ground',
      text: 'Gale crater’s floor and Mount Sharp’s slopes are not modelled: the rover stands on the smooth ellipsoid, kilometres from the true height of the ground it is on, and the hills round it are flat here.',
    },
  ],
  measured: [
    {
      title: 'Who made it',
      text: 'Designed and built by JPL, which leads the mission for NASA.',
      cite: ['skycrane', 'pia26210'],
    },
    {
      title: 'The rover',
      text: '899 kg; about 3 m long, 2.7 m wide and 2.2 m tall, not counting its 2.2 m arm; ten science instruments, seventeen cameras, a rock-vaporising laser and a drill. Power from a Multi-Mission Radioisotope Thermoelectric Generator, heated by plutonium-238 dioxide.',
      cite: ['msl', 'doe2008'],
    },
    {
      title: 'Launch and landing',
      text: 'Launched on 26 November 2011; landed in Gale crater on 6 August 2012. Too heavy for airbags, it was lowered on ropes by a rocket-powered descent stage, which then cut them and flew off to crash out of the rover’s way; Perseverance landed the same way in 2021.',
      cite: ['msl', 'skycrane'],
    },
    {
      title: 'A stream',
      text: 'Outcrops of conglomerate — rounded pebbles of 2 to 40 mm cemented with sand — laid down by water that likely ran 0.03 to 0.9 m deep at 0.2 to 0.75 m/s, in a climate quite unlike today’s.',
      cite: ['williams2013', 'pia16156'],
    },
    {
      title: 'A habitable lake',
      text: 'At Yellowknife Bay, fine-grained mudstone from an ancient lake: neutral, not very salty, with carbon, hydrogen, oxygen, sulphur, nitrogen and phosphorus, and chemical energy that microbes living on rock chemistry could have used. It lasted at least hundreds to tens of thousands of years; the lakes of Gale came and went over perhaps thousands to millions.',
      cite: ['grotzinger2014', 'grotzinger2015'],
    },
    {
      title: 'Organic matter',
      text: 'Thiophenes, aromatic and aliphatic compounds released by heating 3.5-billion-year-old lake mudstone; later, decane, undecane and dodecane in the rock “Cumberland”, the largest organic molecules found on Mars so far.',
      cite: ['eigenbrode2018', 'msl'],
    },
    {
      title: 'Methane',
      text: 'Measured over five years: a background of 0.41 parts per billion that rises and falls with the seasons between 0.24 and 0.65, and occasional spikes of about 7 — consistent with small local sources at or below the surface.',
      cite: ['webster2018'],
    },
    {
      title: 'Sulphur',
      text: 'In 2024, in Gediz Vallis, the first pure sulphur found on Mars, in a stone the rover cracked by driving over it.',
      cite: ['pia26210'],
    },
    {
      title: 'Still climbing',
      text: 'On 26 August 2026 it had gained a kilometre of height since landing, and is still working.',
      cite: ['msl'],
    },
  ],
  estimated: [],
  missing: [
    {
      title: 'Whether anything lived there',
      text: 'Not known. The lake could have supported microbes; nothing Curiosity carries can tell whether it did.',
      cite: ['grotzinger2014'],
    },
    {
      title: 'Where the methane comes from',
      text: 'Not known: the seasonal swing is larger than either sunlight breaking down organics or the yearly cycle of air pressure explains.',
      cite: ['webster2018'],
    },
  ],
  misconceptions: [
    {
      title: 'Mars’s sky is not blue',
      text: 'Many rover pictures are white-balanced, adjusted to look as under Earth’s light so geologists can read the rocks; that over-corrects for the lack of blue on Mars and paints the sky light blue, which it is not.',
      cite: ['pia19912'],
    },
    {
      title: 'Organic does not mean alive',
      text: 'Organic molecules are carbon compounds: the raw material of life as we know it, not life. Finding them shows that such material lasted in Gale’s rocks; whether any of it came from living things is not known — a later study argued only that processes without life do not fully explain the largest of them.',
      cite: ['eigenbrode2018', 'msl'],
    },
  ],
  sources: [
    {
      key: 'msl',
      text: 'NASA Science, Mars Science Laboratory: Curiosity Rover (mission page: launch, landing, the rover, organics, the kilometre climbed)',
      url: 'https://science.nasa.gov/mission/msl-curiosity/',
    },
    {
      key: 'skycrane',
      text: 'JPL 2024, Here’s How Curiosity’s Sky Crane Changed the Way NASA Explores Mars (news, 7 August 2024)',
      url: 'https://www.jpl.nasa.gov/news/heres-how-curiositys-sky-crane-changed-the-way-nasa-explores-mars/',
    },
    {
      key: 'doe2008',
      text: 'US Department of Energy, Office of Nuclear Energy 2008, Powering Curiosity: Multi-Mission Radioisotope Thermoelectric Generators',
      url: 'https://www.energy.gov/ne/articles/powering-curiosity-multi-mission-radioisotope-thermoelectric-generators',
    },
    {
      key: 'williams2013',
      text: 'Williams, R. M. E., et al. 2013, Martian Fluvial Conglomerates at Gale Crater, Science 340, 1068',
      url: 'https://doi.org/10.1126/science.1237317',
    },
    {
      key: 'grotzinger2014',
      text: 'Grotzinger, J. P., et al. 2014, A Habitable Fluvio-Lacustrine Environment at Yellowknife Bay, Gale Crater, Mars, Science 343, 1242777',
      url: 'https://doi.org/10.1126/science.1242777',
    },
    {
      key: 'grotzinger2015',
      text: 'Grotzinger, J. P., et al. 2015, Deposition, exhumation, and paleoclimate of an ancient lake deposit, Gale crater, Mars, Science 350, aac7575',
      url: 'https://doi.org/10.1126/science.aac7575',
    },
    {
      key: 'eigenbrode2018',
      text: 'Eigenbrode, J. L., et al. 2018, Organic matter preserved in 3-billion-year-old mudstones at Gale crater, Mars, Science 360, 1096',
      url: 'https://doi.org/10.1126/science.aas9185',
    },
    {
      key: 'webster2018',
      text: 'Webster, C. R., et al. 2018, Background levels of methane in Mars’ atmosphere show strong seasonal variations, Science 360, 1093',
      url: 'https://doi.org/10.1126/science.aaq0131',
    },
    {
      key: 'pia16156',
      text: 'NASA/JPL-Caltech/MSSS 2012, PIA16156: Remnants of Ancient Streambed on Mars (caption)',
      url: 'https://science.nasa.gov/photojournal/remnants-of-ancient-streambed-on-mars/',
    },
    {
      key: 'pia19912',
      text: 'NASA/JPL-Caltech/MSSS 2015, PIA19912: Mount Sharp Comes In Sharply (caption, on white balance)',
      url: 'https://science.nasa.gov/photojournal/mount-sharp-comes-in-sharply/',
    },
    {
      key: 'pia26210',
      text: 'NASA/JPL-Caltech/MSSS 2024, PIA26210: Curiosity Takes a Last Look at Sulfur Stones (caption)',
      url: 'https://science.nasa.gov/photojournal/curiosity-takes-a-last-look-at-sulfur-stones/',
    },
  ],
};
