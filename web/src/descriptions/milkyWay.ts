import { MILKY_WAY_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Milky Way: no body, so opened from the breadcrumb's Milky Way list (BodyPicker.tsx), and
 * nothing in it is worked out from a body's data. Every number here is from the source it
 * cites; where a figure is a model's rather than a measurement, it sits under "estimated" and
 * says which model. What the app draws of it is read off core/milkyWay.ts and
 * scene/MilkyWay.tsx.
 */
export const MILKY_WAY: Description = {
  id: MILKY_WAY_DESCRIPTION_ID,
  subject: { name: 'Milky Way', kind: 'our galaxy' },
  lead: [
    'On a dark night, far from any town, a pale river of light crosses the whole sky. It is our galaxy, seen from inside. Every star the eye can pick out belongs to it, and so do we: the Sun is one of some hundred billion stars in a flat, turning disc, and because we are in the disc we see it edge-on, as a band running all the way round us. No one has ever seen it from outside, and no one ever will — every picture of its spiral shape is a drawing or a model.',
    'The Milky Way is a barred spiral galaxy, a disc of stars, gas and dust about 100,000 light years across, with a bar of old stars across its middle and spiral arms winding out from it. The Sun lies in the disc about 27,000 light years from the centre, and is carried round it at more than 200 kilometres a second, once in some 250 million years. At the very centre sits a black hole four million times as massive as the Sun.',
    'Its shape had to be worked out from inside. Dust in the disc hides most of it from visible light — the dark lanes splitting the band are clouds of dust in front of the stars, not gaps between them. So its arms were traced by measuring the distances, by parallax, to some two hundred clouds of gas where massive stars are forming, which shine through the dust as natural radio masers; and the Gaia spacecraft has mapped the sky from 1.7 billion of its stars. The far side, beyond the centre, is still barely mapped.',
    'Round it orbit small galaxies, the two Magellanic Clouds brightest among them; with Andromeda and its own companions it makes the Local Group, and the Local Group lies on the outskirts of Laniakea.',
  ],
  photos: [
    {
      file: 'photos/milky-way/arc-over-paranal.webp',
      largeFile: 'photos/milky-way/arc-over-paranal-large.webp',
      width: 640,
      height: 299,
      title: 'The Milky Way as we see it, over Paranal',
      caption:
        'The band of our galaxy arching across the Atacama sky above the VISTA telescope at ESO’s Paranal Observatory. This is all anyone can see of it: the disc edge-on, from inside. A long-exposure photograph.',
      colour: 'true',
      credit: 'ESO/Y. Beletsky',
      licence: 'CC BY 4.0',
      date: 'released 2014-10-15',
      sourceUrl: 'https://www.eso.org/public/images/uhd_beletsky_par_27/',
    },
    {
      file: 'photos/milky-way/gaia-sky-map.webp',
      largeFile: 'photos/milky-way/gaia-sky-map-large.webp',
      width: 640,
      height: 320,
      title: 'The whole sky as Gaia measured it, a map',
      caption:
        'Not a photograph: a map of the whole sky from Gaia’s measurements of nearly 1.7 billion stars, the plane of the galaxy across the middle, its centre in the middle. Colour from the share of blue and red light Gaia recorded in each patch. The dark lanes are dust; the two bright patches at lower right are the Magellanic Clouds.',
      colour: 'false',
      credit: 'ESA/Gaia/DPAC',
      licence: 'CC BY-SA 3.0 IGO',
      date: '2018-04-25',
      sourceUrl: 'https://www.esa.int/ESA_Multimedia/Images/2018/04/Gaia_s_sky_in_colour2',
    },
    {
      file: 'photos/milky-way/cobe-near-infrared.webp',
      largeFile: 'photos/milky-way/cobe-near-infrared-large.webp',
      width: 640,
      height: 426,
      title: 'The galaxy edge-on, in near-infrared, from COBE',
      caption:
        'The whole sky at 1.25, 2.2 and 3.5 µm, shown as blue, green and red: at these wavelengths the light of stars concentrated in the plane dominates, and the galaxy shows as what it is from here, a thin disc with a bulge at its centre. A map of the sky, not a photograph.',
      colour: 'false',
      credit: 'NASA/COBE Science Team',
      licence: 'NASA media, not copyrighted',
      date: '1990s',
      sourceUrl: 'https://lambda.gsfc.nasa.gov/product/cobe/cobe_image_table.html',
    },
    {
      file: 'photos/milky-way/cobe-bulge.webp',
      largeFile: 'photos/milky-way/cobe-bulge-large.webp',
      width: 640,
      height: 426,
      title: 'Its lopsided bulge, from COBE',
      caption:
        'The central 60° by 20° of the galaxy in the same three near-infrared bands: the bulge is not symmetric, brighter and thicker on one side of the centre than the other.',
      colour: 'false',
      credit: 'NASA/COBE Science Team',
      licence: 'NASA media, not copyrighted',
      date: '1990s',
      sourceUrl: 'https://lambda.gsfc.nasa.gov/product/cobe/cobe_image_table.html',
    },
    {
      file: 'photos/milky-way/vista-centre.webp',
      largeFile: 'photos/milky-way/vista-centre-large.webp',
      width: 640,
      height: 482,
      title: 'The central parts, from ESO’s VISTA',
      caption:
        'Nearly nine billion pixels of the central parts of the galaxy in three near-infrared bands, shown as visible colours.',
      colour: 'false',
      credit: 'ESO/VVV Survey/D. Minniti; acknowledgement Ignacio Toledo, Martin Kornmesser',
      licence: 'CC BY 4.0',
      date: '2012-10-24',
      sourceUrl: 'https://www.eso.org/public/images/eso1242a/',
    },
    {
      file: 'photos/milky-way/centre-three-observatories.webp',
      largeFile: 'photos/milky-way/centre-three-observatories-large.webp',
      width: 640,
      height: 319,
      title: 'The galactic centre, from Spitzer, Hubble and Chandra',
      caption:
        'Half a degree of the centre, as wide as the full Moon, in infrared and X-rays together, which pass through the dust that hides it in visible light; the centre itself is in the bright region right of and below the middle, where a black hole of some four million Suns lies. Not an eye’s colours.',
      colour: 'false',
      credit: 'NASA/JPL-Caltech/ESA/CXC/STScI',
      licence: 'NASA media, not copyrighted; credit requested',
      date: '2009-11-10',
      sourceUrl: 'https://images.nasa.gov/details/PIA12348',
    },
  ],
  drawnHere: [
    {
      title: 'Stars near us, a model beyond',
      text: 'Near the Sun the galaxy is its catalogued stars, each where it is measured. Beyond them nothing maps the galaxy star by star, so it is drawn as a model of its published structure: 200,000 points sampled from it, each a stand-in for a cloud of millions of stars, never a star, and none inside the hundred parsecs round the Sun where the real stars are. The model fades in as the camera leaves 1,000 light years from the Sun behind, and is whole by 5,000.',
    },
    {
      title: 'Its arms',
      text: 'Seven arms, as log-periodic spirals with a kink each, fitted by Reid et al. to the parallaxes of masers in star-forming regions. Past where parallaxes reach, each arm is carried on, fading, as the paper’s own figure carries them: the far side has no parallaxes yet, and the picture does not pretend it does.',
      cite: ['reid2019'],
    },
    {
      title: 'Its discs, bulge and bar',
      text: 'Bland-Hawthorn and Gerhard’s best values: a thin disc of scale length 2.6 kpc and height 300 pc, a thick one of 2.0 kpc and 900 pc, a box-shaped bulge turned 27° from the line to the Sun, a long bar 5.0 kpc in half-length. The bar’s width is not among them: a tenth of its length, as the bars of other galaxies seen face-on are, is this model’s assumption.',
      cite: ['blandhawthorn2016'],
    },
    {
      title: 'Its dust',
      text: 'Drimmel and Spergel’s dust disc, fitted to COBE’s far-infrared sky, with the arms’ dust laid along Reid’s arms on their inner edges, where dust lanes lie in other spiral galaxies. Dust only dims what lies behind it, so the galaxy is drawn in slabs of distance from the camera, far to near, each slab’s dust dimming the slabs behind before its own light is added.',
      cite: ['drimmel2001', 'reid2019'],
    },
    {
      title: 'Its centre',
      text: 'The model is centred 8.15 kpc from the Sun, the distance Reid’s arms were fitted with — moving it would move the arms off the masers that define them. Sagittarius A* is placed where GRAVITY measures it, 126 pc farther: the model’s centre falls 1.5% short of the black hole.',
      cite: ['reid2019', 'gravity2024'],
    },
    {
      title: 'What is chosen, not measured',
      text: 'How much light each population gives, the colours of the old stars, the clumping of the arms into knots of star formation, and how dark the dust is drawn: set by eye against photographs of barred spirals seen face-on. The knots are real in kind — the arms are strings of young star clusters and glowing gas — but none of them is a particular one.',
    },
  ],
  measured: [
    {
      title: 'Where the Sun is',
      text: 'About 27,000 light years from the centre, from GRAVITY’s geometric distance to the black hole there, measured from the orbit of a star round it to 0.3%.',
      cite: ['gravity2019'],
    },
    {
      title: 'Its arms, from inside',
      text: 'About 200 parallaxes and proper motions of masers in high-mass star-forming regions give the Sun’s distance from the centre as 8.15 ± 0.15 kpc and the circular speed there as 236 ± 7 km/s, and strongly suggest the Milky Way is a four-armed spiral.',
      cite: ['reid2019'],
    },
    {
      title: 'Its stars, one by one',
      text: 'Gaia’s second data release mapped the whole sky from nearly 1.7 billion stars; the third added mean radial velocities for more than 33 million.',
      cite: ['esagaiasky', 'gaiadr3'],
    },
    {
      title: 'Its shape and size',
      text: 'A large barred spiral, its stars in a disc about 100,000 light years across.',
      cite: ['nasaimagine'],
    },
    {
      title: 'Its dust',
      text: 'The dark regions along the plane are clouds of gas and dust blocking the light of the stars behind them.',
      cite: ['esagaiasky'],
    },
    {
      title: 'Its central black hole',
      text: 'Some four million times the Sun’s mass, at the centre of the galaxy.',
      cite: ['nasacentre'],
    },
  ],
  estimated: [
    {
      title: 'How many stars',
      text: 'About 100 billion: an estimate, not a count — Gaia’s 1.7 billion are about one or two in a hundred, and the rest are hidden by dust or too faint to see.',
      cite: ['nasaimagine', 'esagaiasky'],
    },
    {
      title: 'The Sun’s orbit',
      text: 'Once round the centre in about 250 million years.',
      cite: ['nasaimagine'],
    },
    {
      title: 'Its structure as a whole',
      text: 'Its discs’ scale lengths and heights, its bulge and its bar are best values from many surveys, each with its uncertainty; the arms on the far side are the near side’s fits carried on.',
      cite: ['blandhawthorn2016', 'reid2019'],
    },
  ],
  missing: [
    {
      title: 'A picture from outside',
      text: 'None exists, and none can: we are inside it, and every image of its spiral seen face-on is an artist’s drawing or a model, as the one drawn here is.',
    },
    {
      title: 'What gives no visible light',
      text: 'Not drawn: its cold gas and its halo of dark matter. The model is its starlight and its dust.',
    },
  ],
  misconceptions: [
    {
      title: 'Its famous face-on pictures are not photographs',
      text: 'They are drawings or models built from measurements made from inside, like the model this app draws. Gaia and the surveys map it from here; the far side is still barely known.',
      cite: ['reid2019'],
    },
    {
      title: 'The dark rift is not a gap',
      text: 'The dark lanes along the band are clouds of dust between us and the stars behind them, not empty space.',
      cite: ['esagaiasky'],
    },
    {
      title: 'The Sun is not at the centre',
      text: 'It is about 27,000 light years out, in the disc; the centre is hidden from visible light by dust, and seen only in infrared, radio and X-rays.',
      cite: ['gravity2019', 'nasacentre'],
    },
  ],
  sources: [
    {
      key: 'nasaimagine',
      text: 'NASA Imagine the Universe, The Milky Way Galaxy',
      url: 'https://imagine.gsfc.nasa.gov/science/objects/milkyway1.html',
    },
    {
      key: 'reid2019',
      text: 'Reid, M. J., et al. 2019, Trigonometric Parallaxes of High-mass Star-forming Regions: Our View of the Milky Way, ApJ 885, 131',
      url: 'https://doi.org/10.3847/1538-4357/ab4a11',
    },
    {
      key: 'blandhawthorn2016',
      text: 'Bland-Hawthorn, J., & Gerhard, O. 2016, The Galaxy in Context: Structural, Kinematic, and Integrated Properties, ARA&A 54, 529',
      url: 'https://doi.org/10.1146/annurev-astro-081915-023441',
    },
    {
      key: 'drimmel2001',
      text: 'Drimmel, R., & Spergel, D. N. 2001, Three-dimensional Structure of the Milky Way Disk: The Distribution of Stars and Dust beyond 0.35 R☉, ApJ 556, 181',
      url: 'https://doi.org/10.1086/321556',
    },
    {
      key: 'gravity2019',
      text: 'GRAVITY Collaboration 2019, A geometric distance measurement to the Galactic center black hole with 0.3% uncertainty, A&A 625, L10',
      url: 'https://doi.org/10.1051/0004-6361/201935656',
    },
    {
      key: 'gravity2024',
      text: 'GRAVITY Collaboration 2024, Improving constraints on the extended mass distribution in the Galactic Center with stellar orbits, A&A 692, A242',
      url: 'https://doi.org/10.1051/0004-6361/202452274',
    },
    {
      key: 'esagaiasky',
      text: 'ESA, Gaia’s sky in colour (2018), image caption',
      url: 'https://www.esa.int/ESA_Multimedia/Images/2018/04/Gaia_s_sky_in_colour2',
    },
    {
      key: 'gaiadr3',
      text: 'Gaia Collaboration, Vallenari, A., et al. 2023, Gaia Data Release 3: Summary of the content and survey properties, A&A 674, A1',
      url: 'https://doi.org/10.1051/0004-6361/202243940',
    },
    {
      key: 'nasacentre',
      text: 'NASA/JPL, Great Observatories Unique Views of the Milky Way (PIA12348)',
      url: 'https://images.nasa.gov/details/PIA12348',
    },
  ],
};
