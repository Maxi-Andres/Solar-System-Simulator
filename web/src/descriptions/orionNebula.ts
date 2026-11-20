import type { Description } from './types.ts';

/**
 * The Orion Nebula, M42. Every number here is from the source it cites; where a figure is a
 * model's rather than a measurement, it sits under "estimated" and says which model. What the
 * app draws of it is read off core/nebulae.ts (NEBULAE, 'orion') and scene/nebulaVolume.ts.
 */
export const ORION_NEBULA: Description = {
  id: 'nebula-orion',
  lead: [
    'Below the three stars of Orion’s belt hangs a short line of fainter ones, the hunter’s sword, and in the middle of it a little hazy patch. On a dark night anyone can see it without a telescope. It is a place where stars are being born right now — thousands of them, some with discs of gas and dust round them from which planets may form, as ours did round the young Sun 4.6 billion years ago.',
    'The Orion Nebula is the nearest large star-forming region to Earth, about 1,300 light years away. Its glow is gas lit up by a handful of massive young stars at its heart, the Trapezium, named for the shape the four brightest make: their ultraviolet light strips the electrons from the hydrogen around them, and as the electrons are caught again the gas shines, most of all in hydrogen’s red.',
    'It is not a ball of gas but a thin blister on the near face of a giant dark cloud: the young stars have eaten a hollow into the cloud on the side facing us, and what we see is the lit inner wall of that hollow. The same light that makes it shine is boiling away the discs round many of its smaller young stars, and why so many survive is still a puzzle.',
    'It has a place in the history of photography: in 1880 Henry Draper exposed a plate on it for 51 minutes, essentially the first photograph ever taken of the deep sky. In the 1990s Hubble showed the discs round its young stars, seen in silhouette against the glow — planetary systems in the making — and in 2023 the James Webb Space Telescope found in one of them a carbon molecule, the methyl cation, never seen in such a disc before.',
  ],
  photos: [
    {
      file: 'photos/orion-nebula/orion-over-paranal.webp',
      largeFile: 'photos/orion-nebula/orion-over-paranal-large.webp',
      width: 640,
      height: 817,
      title: 'Orion over the VLT Survey Telescope',
      caption:
        'At left, the constellation of Orion, upside down as the southern hemisphere sees it: the three stars of its belt in a line, and the faint pink smudge beside them is the nebula, in the sword. The Milky Way rises behind the telescope at ESO’s Paranal Observatory. A long exposure.',
      colour: 'true',
      credit: 'ESO/Y. Beletsky',
      licence: 'CC BY 4.0',
      date: 'released 2020-03-02',
      sourceUrl: 'https://www.eso.org/public/images/potw2009a/',
    },
    {
      file: 'photos/orion-nebula/vst.webp',
      largeFile: 'photos/orion-nebula/vst-large.webp',
      width: 640,
      height: 497,
      title: 'The nebula and its cluster from the VLT Survey Telescope',
      caption:
        'The whole nebula in visible light — blue-green, red and deep red filters and one of hydrogen’s red glow — and the young stars of its cluster.',
      colour: 'true',
      credit: 'ESO/G. Beccari',
      licence: 'CC BY 4.0',
      date: '2017-07-27',
      sourceUrl: 'https://www.eso.org/public/images/eso1723a/',
    },
    {
      file: 'photos/orion-nebula/hubble-mosaic.webp',
      largeFile: 'photos/orion-nebula/hubble-mosaic-large.webp',
      width: 640,
      height: 640,
      title: 'Hubble’s sharpest view, 2006',
      caption:
        'From 520 Hubble exposures in five colours, filled out with ESO ground-based data; an area about the size of the full Moon, and more than 3,000 stars. Two of the filters are in near-infrared, so the colours are not an eye’s.',
      colour: 'false',
      credit: 'NASA, ESA, M. Robberto (Space Telescope Science Institute/ESA) and the Hubble Space Telescope Orion Treasury Project Team',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '2006-01-11',
      sourceUrl: 'https://esahubble.org/images/heic0601a/',
    },
    {
      file: 'photos/orion-nebula/proplyds.webp',
      largeFile: 'photos/orion-nebula/proplyds-large.webp',
      width: 640,
      height: 763,
      title: 'Discs round young stars, 1995',
      caption:
        'Four discs of gas and dust round newborn stars, seen in silhouette against the glowing gas — the first direct look at what was long thought to be planetary systems forming. Through filters for doubly ionised oxygen, hydrogen and nitrogen, each given a colour.',
      colour: 'false',
      credit: 'Mark McCaughrean (Max-Planck-Institute for Astronomy), C. Robert O’Dell (Rice University), and NASA/ESA',
      licence: 'CC BY 4.0 (ESA/Hubble)',
      date: '1995-11-20',
      sourceUrl: 'https://esahubble.org/images/opo9545b/',
    },
    {
      file: 'photos/orion-nebula/vista.webp',
      largeFile: 'photos/orion-nebula/vista-large.webp',
      width: 640,
      height: 787,
      title: 'In infrared, from ESO’s VISTA',
      caption:
        'Infrared passes through much of the dust that hides the young stars in visible light: the cluster and the stars still forming in the cloud behind show. Three near-infrared bands shown as visible colours.',
      colour: 'false',
      credit: 'ESO/J. Emerson/VISTA. Acknowledgment: Cambridge Astronomical Survey Unit',
      licence: 'CC BY 4.0',
      date: '2010-02-10',
      sourceUrl: 'https://www.eso.org/public/images/eso1006a/',
    },
    {
      file: 'photos/orion-nebula/webb-orion-bar.webp',
      largeFile: 'photos/orion-nebula/webb-orion-bar-large.webp',
      width: 640,
      height: 456,
      title: 'The Orion Bar and a disc, from Webb',
      caption:
        'The Orion Bar, a wall where the Trapezium’s ultraviolet eats into the dense cloud, in Webb’s near-infrared; at right, closer in mid-infrared, the young star d203-506 and its disc, where the methyl cation was found. Infrared shown in visible colours.',
      colour: 'false',
      credit: 'ESA/Webb, NASA, CSA, M. Zamani (ESA/Webb), the PDRs4All ERS Team',
      licence: 'CC BY 4.0 (ESA/Webb)',
      date: '2023-06-26',
      sourceUrl: 'https://esawebb.org/images/weic2315a/',
    },
  ],
  drawnHere: [
    {
      title: 'A blister, as it is',
      text: 'Its main part is a bowl: the far half of a shell, open toward Earth, 9.1′ across the sky and 6′ deep, so that from Earth one looks into the lit hollow and from behind it is a cup. In front of its middle, a cloud for the bright core round the Trapezium, the Huygens region; and round it, faint, the Extended Orion Nebula, a bubble 29′ in radius to the south-west.',
      cite: ['odell2001', 'anderson2014'],
    },
    {
      title: 'What the noise makes',
      text: 'Its clumps and filaments are drawn from noise, sharply: they look like gas, but no one of them is where a real one is.',
    },
  ],
  measured: [
    {
      title: 'Distance',
      text: 'From Gaia’s parallaxes of the stars of its cluster, 403 (+7 −6) pc, about 1,310 light years; radio parallaxes of its stars measured with the VLBA give 388 ± 5 pc.',
      cite: ['kuhn2019', 'kounkel2017'],
    },
    {
      title: 'Its size',
      text: 'The ring of warm dust round its ionised gas, measured by WISE in mid-infrared, is 18.2′ across, about 2 pc at its distance; the fainter Extended Orion Nebula reaches 29′ in radius.',
      cite: ['anderson2014'],
    },
    {
      title: 'Its shape',
      text: 'A thin blister of ionised gas on the front of a giant molecular cloud, with an extremely dense cluster of young stars: one of the few nebulae whose three-dimensional shape is well known.',
      cite: ['odell2001'],
    },
    {
      title: 'How bright, and where',
      text: 'Apparent magnitude 4, visible without a telescope from a dark site, just below Orion’s belt; best placed in January. Four massive young stars, the Trapezium, shape it.',
      cite: ['nasam42'],
    },
    {
      title: 'Its stars and discs',
      text: 'Hubble’s 2006 mosaic shows more than 3,000 stars; in 1995 Hubble saw discs of gas and dust round its young stars directly, in visible light, silhouetted against the glow. The same ultraviolet light that lights the nebula is evaporating them.',
      cite: ['esahubbleorion', 'esahubbleproplyds', 'odell2001'],
    },
    {
      title: 'A new molecule',
      text: 'In 2023 Webb found the methyl cation, CH₃⁺, a molecule whose part in the chemistry of carbon between the stars was predicted in the 1970s, for the first time in a disc round a young star: d203-506, at the edge of the Orion Bar.',
      cite: ['esawebborion'],
    },
    {
      title: 'Its first photograph',
      text: 'Made in 1880 by Henry Draper, an exposure of 51 minutes: essentially the first photograph of the deep sky.',
      cite: ['lco'],
    },
  ],
  estimated: [
    {
      title: 'How deep the bowl is',
      text: 'Its outline on the sky is measured; how far back its wall curves is a choice here, 6′ against its 9.1′ radius, within the blister O’Dell describes but not measured from it.',
      cite: ['odell2001'],
    },
    {
      title: 'How much oxygen’s light',
      text: 'The share of its light given the teal of doubly ionised oxygen, half of the bowl’s and more toward its core, is read off narrowband photographs, not measured fluxes.',
    },
  ],
  missing: [
    {
      title: 'The dark cloud behind it',
      text: 'Not drawn: the giant molecular cloud whose face it is gives no visible light of its own, and only the blister on it is drawn.',
      cite: ['odell2001'],
    },
    {
      title: 'Its discs',
      text: 'Not drawn: they are far too small to show at the scale the nebula is framed at, and the nebula is drawn as gas alone.',
    },
    {
      title: 'How it changes',
      text: 'It stands still. Its gas does flow away from the cloud and its stars do move, but over thousands of years, not the span the clock covers.',
    },
  ],
  misconceptions: [
    {
      title: 'It is not a round cloud',
      text: 'Photographs make it look like a glowing ball of gas. It is a thin lit layer on the near side of a dark cloud, a hollow opening toward us.',
      cite: ['odell2001'],
    },
    {
      title: '1,500 light years is an old figure',
      text: 'It is still often quoted. The parallaxes of its own stars, from Gaia and from radio telescopes, put it nearer: about 1,270 to 1,310 light years.',
      cite: ['nasam42', 'kuhn2019', 'kounkel2017'],
    },
    {
      title: 'Its colours are not what the eye sees through a telescope',
      text: 'Its photographs are long exposures, many through filters that pick out single spectral lines or near-infrared light. To the naked eye it is a small hazy patch in the sword.',
      cite: ['nasam42', 'esahubbleorion'],
    },
  ],
  sources: [
    {
      key: 'nasam42',
      text: 'NASA Science, Messier 42 (the Orion Nebula), Hubble’s Messier catalogue',
      url: 'https://science.nasa.gov/mission/hubble/science/explore-the-night-sky/hubble-messier-catalog/messier-42/',
    },
    {
      key: 'odell2001',
      text: 'O’Dell, C. R. 2001, The Orion Nebula and Its Associated Population, ARA&A 39, 99',
      url: 'https://doi.org/10.1146/annurev.astro.39.1.99',
    },
    {
      key: 'kuhn2019',
      text: 'Kuhn, M. A., et al. 2019, Kinematics in Young Star Clusters and Associations with Gaia DR2, ApJ 870, 32',
      url: 'https://doi.org/10.3847/1538-4357/aaef8c',
    },
    {
      key: 'kounkel2017',
      text: 'Kounkel, M., et al. 2017, The Gould’s Belt Distances Survey (GOBELINS). II. Distances and Structure toward the Orion Molecular Clouds, ApJ 834, 142',
      url: 'https://doi.org/10.3847/1538-4357/834/2/142',
    },
    {
      key: 'anderson2014',
      text: 'Anderson, L. D., et al. 2014, The WISE Catalog of Galactic H II Regions, ApJS 212, 1',
      url: 'https://doi.org/10.1088/0067-0049/212/1/1',
    },
    {
      key: 'esahubbleorion',
      text: 'ESA/Hubble, Hubble’s sharpest view of the Orion Nebula (heic0601a), image caption',
      url: 'https://esahubble.org/images/heic0601a/',
    },
    {
      key: 'esahubbleproplyds',
      text: 'ESA/Hubble, Protoplanetary Discs in the Orion Nebula (opo9545b), image caption',
      url: 'https://esahubble.org/images/opo9545b/',
    },
    {
      key: 'esawebborion',
      text: 'ESA/Webb, Webb studies the Orion Nebula (weic2315a), image caption',
      url: 'https://esawebb.org/images/weic2315a/',
    },
    {
      key: 'lco',
      text: 'Las Cumbres Observatory, Photography Revolutionizes Observations (Spacebook)',
      url: 'https://lco.global/spacebook/telescopes/photography-revolutionizes-observations/',
    },
  ],
};
