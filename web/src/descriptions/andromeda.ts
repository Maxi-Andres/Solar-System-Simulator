import type { Description } from './types.ts';

/**
 * The Andromeda Galaxy, M31. Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/localGroup.ts (GIANTS, FaceOnMap), scene/LocalGroup.tsx and
 * public/galaxies/CREDITS.md.
 */
export const ANDROMEDA: Description = {
  id: 'galaxy-m31',
  lead: [
    'On a dark night, far from city lights, there is a faint oval smudge in the constellation Andromeda. It is another galaxy, the farthest thing most people will ever see with their own eyes. The light reaching you left it about 2.5 million years ago, long before our own species existed — the oldest fossils of Homo sapiens are some 300,000 years old. It is falling toward us, and in a few billion years the two galaxies may become one.',
    'The Andromeda Galaxy, M31, is a spiral galaxy like the Milky Way and our nearest large neighbour, 2.5 million light years away. Seen nearly edge-on, tilted 77° from face-on, it stretches across about six times the width of the full Moon on the sky — but the eye picks out only its bright centre; the long arms of the photographs are too faint to see without a long exposure.',
    'Its distance is measured to 1.5%: from 55 Cepheids, stars whose pulsation period gives away how bright they really are. That method began with it. On the night of 5 October 1923 Edwin Hubble photographed Andromeda with the 100-inch Hooker telescope on Mount Wilson, marked a star he took for a nova “N”, and, finding on older plates that it brightened and faded every 31.4 days, crossed it out and wrote “VAR!”. A Cepheid that faint had to be far beyond the Milky Way: the spiral “nebulae” were galaxies of their own, and the universe was suddenly vastly bigger. Harlow Shapley, who had argued the opposite, is said to have called Hubble’s letter “the letter that destroyed my universe”.',
    'It is not alone. Small galaxies orbit it, the brightest M32 and NGC 205, and a long stream of stars in its halo is what is left of a smaller galaxy it pulled apart. Around it lies a vast, thin halo of gas, reaching 1.3 million light years out and in places 2 million — far enough that it already touches the Milky Way’s own.',
    'It is coming toward us at about 110 kilometres per second. Measured with Hubble, its sideways motion was so small that in 2012 a collision about 4 billion years from now, and a merger some 2 billion years after, seemed certain. Newer measurements, and the pull of the other galaxies nearby, have made it far less sure: a 2025 study gives about even odds that the two do not merge within the next 10 billion years. If they do, their stars will almost never touch — they are too far apart — but the Sun would likely be flung into a new orbit in the merged galaxy.',
  ],
  photos: [
    {
      file: 'photos/andromeda/kitt-peak.webp',
      largeFile: 'photos/andromeda/kitt-peak-large.webp',
      width: 640,
      height: 640,
      title: 'Andromeda and two of its companions, from Kitt Peak',
      caption:
        'Over two and a quarter degrees of sky, more than four widths of the full Moon, and still not all of it. M32 is the round glow just below the disc, NGC 205 the oval above right. Made from photographic plates in three filters, as an estimate of true colour; its centre is overexposed, and the dark dust lanes crossing the bright middle on the right show that side is nearer us.',
      colour: 'true',
      credit: 'Bill Schoening, Vanessa Harvey/REU program/NOIRLab/NSF/AURA',
      licence: 'CC BY 4.0',
      date: 'released 2000-01-13',
      sourceUrl: 'https://noirlab.edu/public/images/noao0001a/',
    },
    {
      file: 'photos/andromeda/hubble-mosaic-2025.webp',
      largeFile: 'photos/andromeda/hubble-mosaic-2025-large.webp',
      width: 640,
      height: 149,
      title: 'Hubble’s mosaic of half the disc, 2025',
      caption:
        'More than 600 Hubble pictures taken over ten years, joined into the largest photomosaic Hubble has made: some 200 million stars, still only a fraction of its stars. The black notches along the bottom are where no pictures were taken. Blue is one filter in blue-green light and yellow one in near-infrared, so the colours are not an eye’s.',
      colour: 'false',
      credit: 'NASA, ESA, Benjamin Williams (UWashington), Zhuo Chen (UWashington), L. Clifton Johnson (Northwestern); image processing Joseph DePasquale (STScI)',
      licence: 'NASA media, not copyrighted; credit requested',
      date: '2025-01-16',
      sourceUrl: 'https://science.nasa.gov/asset/hubble/hubble-m31-phatphast-mosaic/',
    },
    {
      file: 'photos/andromeda/hubble-v1.webp',
      largeFile: 'photos/andromeda/hubble-v1-large.webp',
      width: 640,
      height: 512,
      title: 'V1, the star that changed the universe',
      caption:
        'Four Hubble pictures of the Cepheid Edwin Hubble found in 1923, between 17 December 2010 and 26 January 2011, as it brightened and faded; the arrow shows where it is in the galaxy behind, a picture of its own with its colours enhanced.',
      colour: 'false',
      credit: 'NASA, ESA and the Hubble Heritage Team (STScI/AURA)',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2011-05-23',
      sourceUrl: 'https://esahubble.org/images/opo1115a/',
    },
    {
      file: 'photos/andromeda/spitzer.webp',
      largeFile: 'photos/andromeda/spitzer-large.webp',
      width: 640,
      height: 276,
      title: 'Andromeda in infrared, from Spitzer',
      caption:
        'Light no eye can see. Starlight at 3.6 and 4.5 µm is blue and cyan; dust at 8 µm is red, and warm dust at 24 µm green, so where stars are forming it shows orange and yellow — a ring of dust and young stars round the centre. The sky about it is from WISE.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted; credit requested',
      date: '2024-05-09',
      sourceUrl: 'https://images.nasa.gov/details/PIA26276',
    },
    {
      file: 'photos/andromeda/galex-spitzer.webp',
      largeFile: 'photos/andromeda/galex-spitzer-large.webp',
      width: 640,
      height: 207,
      title: 'Ultraviolet and infrared together',
      caption:
        'GALEX’s far-ultraviolet, from young, hot, massive stars, in blue; its near-ultraviolet, from older stars, in green; and Spitzer’s 24 µm, from the cool dust where stars are still forming, in red — pinkish purple where the two kinds of young star lie together. The yellow centre is old stars packed tight.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech',
      licence: 'NASA media, not copyrighted; credit requested',
      date: '2006-09-28',
      sourceUrl: 'https://images.nasa.gov/details/PIA08787',
    },
    {
      file: 'photos/andromeda/dust-gas.webp',
      largeFile: 'photos/andromeda/dust-gas-large.webp',
      width: 640,
      height: 359,
      title: 'Its dust and gas, from Herschel and radio telescopes',
      caption:
        'Cold dust in green and warmer dust in blue, from ESA’s Herschel with Planck, IRAS and COBE filling in the faint dust they missed; hydrogen gas, from radio telescopes, in red, reaching well beyond the dust.',
      colour: 'false',
      credit: 'ESA/NASA/JPL-Caltech/GBT/WSRT/IRAM/C. Clark (STScI)',
      licence: 'NASA media; credit requested',
      date: '2022-06-16',
      sourceUrl: 'https://images.nasa.gov/details/PIA25163',
    },
  ],
  drawnHere: [
    {
      title: 'Which side is nearer',
      text: 'Its north-west side, as the dust lanes say: they show dark against the bright centre on that side only, which they could not if they lay behind it.',
      cite: ['noirlab'],
    },
    {
      title: 'Its face-on map',
      text: 'Where its light and dust are across the disc comes from surveys of the real galaxy, its tilt undone: old stars from WISE at 3.4 µm, which dust hardly dims; star formation from GALEX’s far-ultraviolet with WISE’s 22 µm for what the dust hides; dust from Herschel, as Marsh et al. mapped it. Its bulge, and M32 and NGC 205, which lie across the disc as we see it, were taken out of the map, so none of them is drawn twice.',
      cite: ['leroy2019', 'marsh2018'],
    },
    {
      title: 'Its light, and what is left out',
      text: 'Courteau et al. find 23% of its light in the bulge, 73% in the disc and 4% in a faint halo of stars. The halo is not drawn; the bulge carries 24% of the rest.',
      cite: ['courteau2011'],
    },
    {
      title: 'Its colours',
      text: 'Its old stars are drawn in the colour of an old population, B−V 0.85, its young stars bluer, through the colour of a star of that temperature: colours chosen to fit what each kind of star is, not read off its photographs.',
    },
  ],
  measured: [
    {
      title: 'Distance',
      text: '761 ± 11 kpc, about 2.48 million light years, from 55 Cepheids observed in near-infrared light by Hubble, with periods of 4 to 78 days: a distance modulus of 24.407 ± 0.032, a 1.5% measurement.',
      cite: ['li2021'],
    },
    {
      title: 'How bright, and how big on the sky',
      text: 'Apparent magnitude 3.1; easily seen with the naked eye from a dark site, and even with some light pollution. Its disc spans about six times the full Moon’s width.',
      cite: ['nasam31'],
    },
    {
      title: 'How old its light is',
      text: 'At 2.48 million light years, the light seen tonight left it 2.48 million years ago. The oldest fossils of our species, from Jebel Irhoud in Morocco, are 315 ± 34 thousand years old.',
      cite: ['li2021', 'hublin2017'],
    },
    {
      title: 'Its shape',
      text: 'Tilted 77° from face-on, the north-west side nearer. Its light falls off exponentially in the disc, by a factor of e every 5.3 ± 0.5 kpc; its bulge follows a Sérsic profile of index 2.2 ± 0.3 and half-light radius 1.0 ± 0.2 kpc. Of its light, 23% is the bulge’s, 73% the disc’s and 4% a faint halo’s.',
      cite: ['nasam31', 'noirlab', 'courteau2011'],
    },
    {
      title: 'Its motion toward us',
      text: 'Toward the Milky Way at 109.3 ± 4.4 km/s, and sideways at only 17 km/s (under 34 km/s at one sigma): from Hubble’s measurements of how its stars move across the sky, the first for M31.',
      cite: ['vandermarel2012a'],
    },
    {
      title: 'V1',
      text: 'The Cepheid Edwin Hubble found on his plate of the night of 5 to 6 October 1923, with the 100-inch Hooker telescope on Mount Wilson; its period is 31.4 days. From it he put Andromeda at about a million light years, and by the end of 1924 at 900,000: too near, as later measurements showed, but far beyond the Milky Way.',
      cite: ['nasav1'],
    },
    {
      title: 'Its giant stream',
      text: 'A giant stream of metal-rich stars in its halo, found in 2001: the remains of a smaller galaxy it tore apart.',
      cite: ['ibata2001'],
    },
    {
      title: 'Its halo of gas',
      text: 'Found from the light of 43 quasars behind it: it reaches 1.3 million light years from the galaxy, as far as 2 million in some directions, and already meets the halo of the Milky Way.',
      cite: ['amiga'],
    },
  ],
  estimated: [
    {
      title: 'The Local Group’s mass',
      text: 'From how fast the two galaxies approach and the timing of their orbit since the Big Bang: the Milky Way’s and Andromeda’s masses together, (3.17 ± 0.57) × 10¹² times the Sun’s. Most of it is dark matter.',
      cite: ['vandermarel2012a'],
    },
    {
      title: 'A collision, in 2012',
      text: 'With its sideways motion small, van der Marel et al. found a first close pass about 3.9 billion years from now and a merger at 5.9 billion, a 41% chance of a direct hit, the merged galaxy an elliptical.',
      cite: ['vandermarel2012b', 'nasacollision'],
    },
    {
      title: 'Perhaps no collision, in 2025',
      text: 'With Gaia’s and Hubble’s newer motions, and the pull of Triangulum (M33), which makes a merger likelier, and of the Large Magellanic Cloud, which makes it less likely, Sawala et al. find close to even odds that the two do not merge in the next 10 billion years.',
      cite: ['sawala2025'],
    },
  ],
  missing: [
    {
      title: 'Its stars, one by one',
      text: 'Not drawn: it is its light, a volume of glow. Hubble has resolved some 200 million of its stars, still only a fraction of them.',
      cite: ['nasam31'],
    },
    {
      title: 'Its giant stream and its halo of stars',
      text: 'Not drawn. The stream is mapped, but in stars far too faint to show in its glow; the halo of stars holds 4% of its light, and is left out.',
      cite: ['ibata2001', 'courteau2011'],
    },
    {
      title: 'Its gas',
      text: 'Not drawn: neither the hydrogen of its disc nor the thin hot halo round it. Neither shines in visible light.',
      cite: ['amiga'],
    },
    {
      title: 'Its motion',
      text: 'It stands still here. It does move, 109 km/s toward us, but at that speed it would take some 4 billion years to cross the gap, and the clock does not run that far.',
      cite: ['vandermarel2012a'],
    },
  ],
  misconceptions: [
    {
      title: 'The eye does not see what photographs show',
      text: 'To the eye it is a small fuzzy oval: only its bright centre shows. The spiral arms and dust lanes of the pictures take long exposures. Yet the whole galaxy, if one could see it, would be six times as wide as the full Moon.',
      cite: ['noirlab', 'nasam31'],
    },
    {
      title: 'The collision is not certain',
      text: 'Since 2012 it has often been said that Andromeda will collide with us in 4 billion years. The 2025 study that added the other galaxies’ pull and newer motions finds about even odds of no merger within 10 billion years.',
      cite: ['nasacollision', 'sawala2025'],
    },
    {
      title: 'Galaxies colliding does not mean stars colliding',
      text: 'Even if they merge, stars are so far apart that they would not hit one another. What changes is their orbits: the Sun would most likely end up farther from the centre of the merged galaxy than it is from ours.',
      cite: ['nasacollision', 'vandermarel2012b'],
    },
    {
      title: 'It is not quite the farthest thing the eye can see',
      text: 'It is the farthest most people see. Under dark, clear skies keen eyes can make out the Triangulum Galaxy, M33, a little farther.',
      cite: ['nasam33'],
    },
    {
      title: 'It was not always known to be a galaxy',
      text: 'Until 1923 most astronomers thought the spiral “nebulae” were clouds inside the Milky Way. Hubble’s Cepheid in Andromeda settled it.',
      cite: ['nasav1'],
    },
  ],
  sources: [
    {
      key: 'nasam31',
      text: 'NASA Science, Messier 31 (the Andromeda Galaxy), Hubble’s Messier catalogue',
      url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-31/',
    },
    {
      key: 'noirlab',
      text: 'NOIRLab, The Andromeda Galaxy (noao0001a), image caption',
      url: 'https://noirlab.edu/public/images/noao0001a/',
    },
    {
      key: 'li2021',
      text: 'Li, S., Riess, A. G., et al. 2021, A Sub-2% Distance to M31 from Photometrically Homogeneous Near-infrared Cepheid Period–Luminosity Relations Measured with the Hubble Space Telescope, ApJ 920, 84',
      url: 'https://doi.org/10.3847/1538-4357/ac1597',
    },
    {
      key: 'courteau2011',
      text: 'Courteau, S., et al. 2011, The Luminosity Profile and Structural Parameters of the Andromeda Galaxy, ApJ 739, 20',
      url: 'https://doi.org/10.1088/0004-637X/739/1/20',
    },
    {
      key: 'vandermarel2012a',
      text: 'van der Marel, R. P., et al. 2012, The M31 Velocity Vector. II. Radial Orbit toward the Milky Way and Implied Local Group Mass, ApJ 753, 8',
      url: 'https://doi.org/10.1088/0004-637X/753/1/8',
    },
    {
      key: 'vandermarel2012b',
      text: 'van der Marel, R. P., et al. 2012, The M31 Velocity Vector. III. Future Milky Way–M31–M33 Orbital Evolution, Merging, and Fate of the Sun, ApJ 753, 9',
      url: 'https://doi.org/10.1088/0004-637X/753/1/9',
    },
    {
      key: 'sawala2025',
      text: 'Sawala, T., et al. 2025, No certainty of a Milky Way–Andromeda collision, Nature Astronomy 9, 1206',
      url: 'https://doi.org/10.1038/s41550-025-02563-1',
    },
    {
      key: 'nasacollision',
      text: 'NASA Science, NASA’s Hubble Shows Milky Way is Destined for Head-On Collision (2012)',
      url: 'https://science.nasa.gov/missions/hubble/nasas-hubble-shows-milky-way-is-destined-for-head-on-collision/',
    },
    {
      key: 'nasav1',
      text: 'NASA Science, Hubble Views the Star That Changed the Universe (2011)',
      url: 'https://science.nasa.gov/missions/hubble/hubble-views-the-star-that-changed-the-universe/',
    },
    {
      key: 'ibata2001',
      text: 'Ibata, R., Irwin, M., Lewis, G., Ferguson, A. M. N., & Tanvir, N. 2001, A giant stream of metal-rich stars in the halo of the galaxy M31, Nature 412, 49',
      url: 'https://doi.org/10.1038/35083506',
    },
    {
      key: 'amiga',
      text: 'NASA Science, Hubble Maps Giant Halo Around Andromeda Galaxy (2020), on Lehner, N., et al. 2020, Project AMIGA, ApJ',
      url: 'https://science.nasa.gov/missions/hubble/hubble-maps-giant-halo-around-andromeda-galaxy/',
    },
    {
      key: 'nasam33',
      text: 'NASA Science, Messier 33 (the Triangulum Galaxy), Hubble’s Messier catalogue',
      url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-33/',
    },
    {
      key: 'leroy2019',
      text: 'Leroy, A. K., et al. 2019, A z = 0 Multiwavelength Galaxy Synthesis. I. A WISE and GALEX Atlas of Local Galaxies, ApJS 244, 24',
      url: 'https://doi.org/10.3847/1538-4365/ab3925',
    },
    {
      key: 'marsh2018',
      text: 'Marsh, K. A., Whitworth, A. P., Smith, M. W. L., Lomax, O., & Eales, S. A. 2018, Dust in the eye of Andromeda, MNRAS 480, 3052',
      url: 'https://doi.org/10.1093/mnras/sty2037',
    },
    {
      key: 'hublin2017',
      text: 'Hublin, J.-J., et al. 2017, New fossils from Jebel Irhoud, Morocco and the pan-African origin of Homo sapiens, Nature 546, 289 (dated 315 ± 34 thousand years)',
      url: 'https://doi.org/10.1038/nature22336',
    },
  ],
};
