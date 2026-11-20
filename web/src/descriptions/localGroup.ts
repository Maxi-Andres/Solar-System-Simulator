import { LOCAL_GROUP_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * The Local Group: no body, so opened from its breadcrumb level's panel (state/levels.ts,
 * ui/LevelFacts.tsx). Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/localGroup.ts, scene/LocalGroup.tsx, core/localStructure.ts,
 * scene/scale.ts (the level's framing) and scene/homeName.ts.
 */
export const LOCAL_GROUP: Description = {
  id: LOCAL_GROUP_DESCRIPTION_ID,
  subject: { name: 'Local Group', kind: 'our group of galaxies' },
  lead: [
    'Of all the galaxies there are, these are the ones bound to ours: the only ones the expansion of the universe will never carry away. Nearly everything beyond is drifting off, and if the expansion goes on as it is, in some hundred billion years every other galaxy will have passed out of sight. Anyone here then would see one galaxy — what the Milky Way, Andromeda and the rest will have become — and nothing at all to tell them that the universe is expanding.',
    'Two large spiral galaxies rule it, the Milky Way and Andromeda, 2.5 million light years apart; Triangulum, a smaller spiral, is the third. Everything else is a dwarf — more than a hundred galaxies are known within 3 megaparsecs, ten million light years, many of them circling one of the two giants as the Magellanic Clouds circle ours. Andromeda is coming toward us at about 110 kilometres a second.',
    'Its members are held within about a megaparsec of its centre of mass, which lies a little more than halfway from us to Andromeda. Inside that sphere their own gravity has stopped the expansion; outside it, the galaxies are seen moving away, faster the farther they are, and that change is how the sphere was found. The same motions weigh it: two to three million million times the Sun’s mass, most of it dark matter, which gives no light.',
    'The census is far from finished. Most of its galaxies are too faint to see as a glow at all: since 2005 many of the faintest have been found only by counting their stars, the oldest and most dark-matter-dominated galaxies known. Beyond its edge, a ring of twelve giant galaxies — M81, Centaurus A, the Sculptor Galaxy and others, called the Council of Giants — encircles it, all in one flat sheet: the next neighbours, already receding.',
  ],
  photos: [
    {
      file: 'photos/andromeda/kitt-peak.webp',
      largeFile: 'photos/andromeda/kitt-peak-large.webp',
      width: 640,
      height: 640,
      title: 'Andromeda and two of its companions',
      caption:
        'The largest of the Local Group, from Kitt Peak: over two and a quarter degrees of sky, more than four widths of the full Moon. M32 is the round glow just below the disc, NGC 205 the oval above right — two of its dwarf satellites. Made from photographic plates in three filters, as an estimate of true colour.',
      colour: 'true',
      credit: 'Bill Schoening, Vanessa Harvey/REU program/NOIRLab/NSF/AURA',
      licence: 'CC BY 4.0',
      date: 'released 2000-01-13',
      sourceUrl: 'https://noirlab.edu/public/images/noao0001a/',
    },
    {
      file: 'photos/local-group/triangulum-vst.webp',
      largeFile: 'photos/local-group/triangulum-vst-large.webp',
      width: 640,
      height: 536,
      title: 'Triangulum, the third spiral, from the VST',
      caption:
        'Messier 33, about three million light years away, from ESO’s VLT Survey Telescope at Paranal. Through g and r filters and one passing only the red light of glowing hydrogen, which makes the gas clouds where stars are forming in its arms stand out — redder than to the eye.',
      colour: 'false',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2014-08-06',
      sourceUrl: 'https://www.eso.org/public/images/eso1424a/',
    },
    {
      file: 'photos/smc/clouds-over-paranal.webp',
      largeFile: 'photos/smc/clouds-over-paranal-large.webp',
      width: 640,
      height: 420,
      title: 'The Magellanic Clouds over Paranal',
      caption:
        'The two largest of the Milky Way’s satellites, seen with the eye from the southern hemisphere: the Large Cloud higher, the Small one lower left, 160,000 and 200,000 light years away. A long-exposure photograph, so they look brighter than to the eye.',
      colour: 'true',
      credit: 'Y. Beletsky (LCO)/ESO',
      licence: 'CC BY 4.0',
      date: 'released 2014-10-01',
      sourceUrl: 'https://www.eso.org/public/images/beletsky_paranal_10f/',
    },
    {
      file: 'photos/milky-way/arc-over-paranal.webp',
      largeFile: 'photos/milky-way/arc-over-paranal-large.webp',
      width: 640,
      height: 299,
      title: 'The Milky Way, the Local Group’s other giant, from inside',
      caption:
        'The band of our own galaxy over ESO’s Paranal Observatory: one of the group’s two large spirals, seen edge-on from within its disc. A long-exposure photograph.',
      colour: 'true',
      credit: 'ESO/Y. Beletsky',
      licence: 'CC BY 4.0',
      date: 'released 2014-10-15',
      sourceUrl: 'https://www.eso.org/public/images/uhd_beletsky_par_27/',
    },
    {
      file: 'photos/local-group/barnards-galaxy.webp',
      largeFile: 'photos/local-group/barnards-galaxy-large.webp',
      width: 640,
      height: 579,
      title: 'Barnard’s Galaxy, a dwarf irregular',
      caption:
        'NGC 6822, about 1.6 million light years away in Sagittarius, a tenth the Milky Way’s size; Barnard found it with a 125-mm refractor in 1884. Its pink bubbles are clouds of gas lit by young, hot stars. Through B, V, R and hydrogen-alpha filters, from the Wide Field Imager at La Silla: the glowing gas stronger than to the eye. The sea of stars in front are the Milky Way’s.',
      colour: 'false',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      date: '2009-10-14',
      sourceUrl: 'https://www.eso.org/public/images/eso0938a/',
    },
    {
      file: 'photos/local-group/ic1613-vst.webp',
      largeFile: 'photos/local-group/ic1613-vst-large.webp',
      width: 640,
      height: 435,
      title: 'IC 1613, a clean dwarf',
      caption:
        'A dwarf irregular galaxy in Cetus, just over 2.3 million light years away, found by Max Wolf in 1906. It has very little dust, so its stars — Cepheids and RR Lyrae among them — give one of the best-measured distances in the group. From the VLT Survey Telescope, through ultraviolet, visible and hydrogen-alpha filters.',
      colour: 'false',
      credit: 'ESO. Acknowledgement: VST/Omegacam Local Group Survey',
      licence: 'CC BY 4.0',
      date: '2016-01-27',
      sourceUrl: 'https://www.eso.org/public/images/eso1603a/',
    },
    {
      file: 'photos/local-group/wlm-vst.webp',
      largeFile: 'photos/local-group/wlm-vst-large.webp',
      width: 640,
      height: 475,
      title: 'WLM, alone at the edge',
      caption:
        'The Wolf–Lundmark–Melotte galaxy, about three million light years away in Cetus, one of the group’s most remote members and so isolated it may never have met another galaxy; some 8,000 light years across. The small smudges about it are galaxies far beyond the Local Group. From the VLT Survey Telescope, through ultraviolet, visible and hydrogen-alpha filters.',
      colour: 'false',
      credit: 'ESO. Acknowledgement: VST/Omegacam Local Group Survey',
      licence: 'CC BY 4.0',
      date: '2016-03-23',
      sourceUrl: 'https://www.eso.org/public/images/eso1610a/',
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The breadcrumb’s Local Group puts the camera 8 million light years from the Sun, looking down on the Milky Way’s disc: Andromeda, 2.48 million light years off, lies 17° from the middle of the frame, Triangulum beyond it, the Milky Way’s satellites about the middle. From the Local Volume’s view outward the group is one place among others, and its galaxies’ names fold into its own.',
    },
    {
      title: 'Its galaxies, each where it is measured',
      text: 'The dwarfs from McConnachie’s catalogue of the galaxies within 3 megaparsecs, its January 2021 version: each on its sky position, at its measured distance, of its measured size, shape and brightness. Andromeda, Triangulum and the two Magellanic Clouds from their own papers, with the most precise distances there are — Cepheids for the spirals, eclipsing binaries for the Clouds.',
      cite: ['mcconnachie2012', 'li2021', 'breuval2023', 'pietrzynski2019', 'graczyk2020'],
    },
    {
      title: 'As volumes of light',
      text: 'Each galaxy is a glow in space whose light, summed along every line of sight, is the surface brightness measured from Earth: so from here it looks as photographed, and from beside it, its side. A dwarf is an ellipsoid of its measured half-light radius and elongation; how deep it is along our line of sight is measured for none, and is drawn as the mean of its two other axes. A spiral is a disc at its measured tilt; Andromeda’s, a map of its own stars and dust. Their colours are estimated.',
    },
    {
      title: 'One exposure for all',
      text: 'As a camera would: Andromeda’s disc shows, and the faintest dwarfs — 28 to 31 magnitudes per square arcsecond — do not, as they do not in any photograph. Their marks show where they are. From the breadcrumb’s view Andromeda, Triangulum and the Clouds are small enough that their light goes over to a point, as it lands on one pixel of a photograph.',
    },
    {
      title: 'Its edge and neighbours',
      text: 'The Local Structure layer, off at first: the zero-velocity surface as a sphere of 0.96 megaparsecs about the group’s centre of mass — computed from the galaxies’ motions, a sphere by assumption; the Council of Giants as McCall’s ring; and the Local Sheet’s mid-plane. None of them is anything there to see.',
      cite: ['karachentsev2009', 'mccall2014'],
    },
  ],
  measured: [
    {
      title: 'The census',
      text: 'Over a hundred nearby galaxies with distances placing them within 3 megaparsecs of the Sun, out to but not including the next groups.',
      cite: ['mcconnachie2012'],
    },
    {
      title: 'Andromeda',
      text: '761 ± 11 kiloparsecs away, 2.48 million light years, from 55 Cepheids; approaching the Milky Way at 109.3 ± 4.4 km/s, and moving sideways at only about 17 km/s.',
      cite: ['li2021', 'vandermarel2012a'],
    },
    {
      title: 'Triangulum and the Clouds',
      text: 'Triangulum 2.74 million light years away, from Cepheids to 1.3%; the Large Magellanic Cloud 49.59 kiloparsecs, about 162,000 light years, and the Small 62.44, about 204,000, each from eclipsing binaries.',
      cite: ['breuval2023', 'pietrzynski2019', 'graczyk2020'],
    },
    {
      title: 'Where the expansion stops',
      text: 'From the motions of 30 galaxies between 0.7 and 3 megaparsecs: the zero-velocity radius is 0.96 ± 0.03 megaparsecs, about 3.1 million light years, about a centre of mass 0.55 of the way from the Milky Way to Andromeda; beyond it the local expansion runs at 78 km/s per megaparsec.',
      cite: ['karachentsev2009'],
    },
    {
      title: 'The faintest galaxies',
      text: 'Ultra-faint dwarfs, found from 2005 on in the Sloan Digital Sky Survey by their stars: the least luminous, oldest, most dark-matter-dominated and least chemically evolved galaxies known.',
      cite: ['simon2019'],
    },
  ],
  estimated: [
    {
      title: 'Its mass',
      text: 'From the Milky Way’s and Andromeda’s motions and other estimates combined: (3.17 ± 0.57) × 10¹² times the Sun’s mass. From the expansion stopped about it: (1.9 ± 0.2) × 10¹². The two methods do not quite agree; most of it, either way, is dark matter.',
      cite: ['vandermarel2012a', 'karachentsev2009'],
    },
    {
      title: 'Andromeda’s future',
      text: 'In 2012, a close pass about 3.9 billion years from now and a merger at 5.9 billion. With Gaia’s and Hubble’s newer motions, and the pulls of Triangulum and the Large Magellanic Cloud, close to even odds that the two do not merge in the next 10 billion years.',
      cite: ['vandermarel2012b', 'sawala2025'],
    },
    {
      title: 'The far future',
      text: 'The Local Group stays bound as the expansion speeds up, while every more distant structure is carried beyond view on a timescale of some 100 billion years: an observer then would see one galaxy, the merged Milky Way and Andromeda, and no evidence of the expansion.',
      cite: ['krauss2007'],
    },
    {
      title: 'The Council of Giants',
      text: 'The giant galaxies about the Local Group lie on a ring of radius 3.75 megaparsecs, in the Local Sheet, marking the limit of the group’s realm of influence.',
      cite: ['mccall2014'],
    },
  ],
  missing: [
    {
      title: 'The dwarfs not yet found',
      text: 'The census is not complete: more ultra-faint dwarfs are expected, out to the Milky Way’s halo and beyond, and the ones behind the dust of its disc are the hardest to find. Only what is catalogued is drawn.',
      cite: ['simon2019'],
    },
    {
      title: 'Its dark matter and its gas',
      text: 'Not drawn: the dark halos that hold most of its mass, and the thin, hot gas round the giants. The galaxies are drawn as their starlight.',
    },
    {
      title: 'The dwarfs’ depth',
      text: 'How far each dwarf reaches along our line of sight is not measured: it is drawn as the mean of its two measured axes.',
    },
  ],
  misconceptions: [
    {
      title: 'It is not expanding',
      text: 'Inside about a megaparsec the group’s own gravity has halted the expansion of the universe; only outside it are galaxies seen moving away.',
      cite: ['karachentsev2009'],
    },
    {
      title: 'The collision with Andromeda is not certain',
      text: 'It is coming toward us, but its sideways motion and the pulls of the other galaxies leave about even odds that there is no merger within 10 billion years.',
      cite: ['sawala2025'],
    },
    {
      title: 'Most of its galaxies are not spirals',
      text: 'There are three spirals; nearly all the rest are dwarfs, most of them too faint for any photograph to show as a glow.',
      cite: ['mcconnachie2012', 'simon2019'],
    },
  ],
  sources: [
    {
      key: 'mcconnachie2012',
      text: 'McConnachie, A. W. 2012, The Observed Properties of Dwarf Galaxies in and around the Local Group, AJ 144, 4',
      url: 'https://doi.org/10.1088/0004-6256/144/1/4',
    },
    {
      key: 'li2021',
      text: 'Li, S., Riess, A. G., et al. 2021, A Sub-2% Distance to M31 from Photometrically Homogeneous Near-infrared Cepheid Period–Luminosity Relations Measured with the Hubble Space Telescope, ApJ 920, 84',
      url: 'https://doi.org/10.3847/1538-4357/ac1597',
    },
    {
      key: 'breuval2023',
      text: 'Breuval, L., Riess, A. G., et al. 2023, A 1.3% Distance to M33 from Hubble Space Telescope Cepheid Photometry, ApJ 951, 118',
      url: 'https://doi.org/10.3847/1538-4357/acd3f4',
    },
    {
      key: 'pietrzynski2019',
      text: 'Pietrzyński, G., et al. 2019, A distance to the Large Magellanic Cloud that is precise to one per cent, Nature 567, 200',
      url: 'https://doi.org/10.1038/s41586-019-0999-4',
    },
    {
      key: 'graczyk2020',
      text: 'Graczyk, D., et al. 2020, A Distance Determination to the Small Magellanic Cloud with an Accuracy of Better than Two Percent Based on Late-type Eclipsing Binary Stars, ApJ 904, 13',
      url: 'https://doi.org/10.3847/1538-4357/abbb2b',
    },
    {
      key: 'vandermarel2012a',
      text: 'van der Marel, R. P., et al. 2012, The M31 Velocity Vector. II. Radial Orbit toward the Milky Way and Implied Local Group Mass, ApJ 753, 8',
      url: 'https://doi.org/10.1088/0004-637X/753/1/8',
    },
    {
      key: 'vandermarel2012b',
      text: 'van der Marel, R. P., et al. 2012, The M31 Velocity Vector. III. Future Milky Way M31–M33 Orbital Evolution, Merging, and Fate of the Sun, ApJ 753, 9',
      url: 'https://doi.org/10.1088/0004-637X/753/1/9',
    },
    {
      key: 'sawala2025',
      text: 'Sawala, T., et al. 2025, No certainty of a Milky Way–Andromeda collision, Nature Astronomy 9, 1206',
      url: 'https://doi.org/10.1038/s41550-025-02563-1',
    },
    {
      key: 'karachentsev2009',
      text: 'Karachentsev, I. D., et al. 2009, The Hubble flow around the Local Group, MNRAS 393, 1265',
      url: 'https://doi.org/10.1111/j.1365-2966.2008.14300.x',
    },
    {
      key: 'mccall2014',
      text: 'McCall, M. L. 2014, A Council of Giants, MNRAS 440, 405',
      url: 'https://doi.org/10.1093/mnras/stu199',
    },
    {
      key: 'simon2019',
      text: 'Simon, J. D. 2019, The Faintest Dwarf Galaxies, ARA&A 57, 375',
      url: 'https://doi.org/10.1146/annurev-astro-091918-104453',
    },
    {
      key: 'krauss2007',
      text: 'Krauss, L. M., & Scherrer, R. J. 2007, The return of a static universe and the end of cosmology, General Relativity and Gravitation 39, 1545',
      url: 'https://doi.org/10.1007/s10714-007-0472-9',
    },
  ],
};
