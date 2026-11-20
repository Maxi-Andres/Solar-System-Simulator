import type { Description } from './types.ts';

/**
 * Betelgeuse. A catalogue star made a body at run time (core/starBodies.ts), found by its
 * Hipparcos number; placed at Hipparcos's distance (tools/src/stars/build3d.ts), and drawn as a
 * point. Every number here is from the source it cites; where its distance is disputed, all three
 * are given.
 */
export const BETELGEUSE: Description = {
  id: 'betelgeuse',
  catalogueStar: { designations: ['HIP 27989'] },
  lead: [
    'A star we may yet see explode. Betelgeuse, the red shoulder of Orion, is a supergiant in the last stretch of its life, and one day its core will collapse and it will blow apart as a supernova, far nearer than any supernova recorded in history. Not soon, by any human measure: the best models put that more than a hundred thousand years away. When, in the winter of 2019 to 2020, it faded plainly to the naked eye, people wondered whether the end had come. It was dust.',
    'It is enormous. By one careful estimate it is about 760 times as wide as the Sun: put where the Sun is, it would reach past the orbit of Mars and the asteroid belt. It holds 16 to 19 times the Sun’s mass and is only about ten million years old, yet already burning helium in its core — big stars live fast.',
    'How far away it is, no one knows well: 500 to 720 light years, depending on whose measurement is taken. A star so bright and so large is hard to pin down — its light is too much for Gaia, and its lumpy, shifting surface makes its position on the sky wander.',
    'It breathes. Its brightness rises and falls over about 400 days, and over a slower cycle of about six years that turned out to have a cause: a companion. In 2024 the Gemini North telescope probably caught it — a faint star right beside the giant, inside Betelgeuse’s own outer atmosphere, six magnitudes fainter and about one and a half times the Sun’s mass. In 2025 the IAU named it Siwarha, “her bracelet”. It is doomed: within some ten thousand years it should spiral into the giant.',
    'Betelgeuse was the first star other than the Sun whose surface the Hubble Space Telescope imaged, in 1996, and since then interferometers and radio telescopes have mapped its great hot spots and the plumes of gas it sheds into space.',
  ],
  photos: [
    {
      file: 'photos/betelgeuse/orion-wide.webp',
      largeFile: 'photos/betelgeuse/orion-wide-large.webp',
      width: 640,
      height: 320,
      title: 'Betelgeuse in Orion',
      caption:
        'A wide photograph of Orion and the Milky Way around it, with the constellation’s figure drawn over it and Betelgeuse circled: the hunter’s shoulder.',
      colour: 'true',
      credit: 'ESO/N. Risinger (skysurvey.org)',
      licence: 'CC BY 4.0',
      date: '2021-06-16',
      sourceUrl: 'https://www.eso.org/public/images/eso2109g/',
    },
    {
      file: 'photos/betelgeuse/great-dimming-sphere.webp',
      largeFile: 'photos/betelgeuse/great-dimming-sphere-large.webp',
      width: 640,
      height: 301,
      title: 'The Great Dimming, on its surface, 2019–2020',
      caption:
        'Betelgeuse resolved by SPHERE on ESO’s Very Large Telescope in January 2019, December 2019, January 2020 and March 2020. In the three later images its southern half is darkened — ten times darker than usual in visible light — by a veil of dust. Visible light, given an orange tint.',
      colour: 'tinted',
      credit: 'ESO/M. Montargès et al.',
      licence: 'CC BY 4.0',
      date: '2019-01 to 2020-03',
      sourceUrl: 'https://www.eso.org/public/images/eso2109a/',
    },
    {
      file: 'photos/betelgeuse/hubble-uv-1996.webp',
      largeFile: 'photos/betelgeuse/hubble-uv-1996-large.webp',
      width: 640,
      height: 469,
      title: 'The first picture of its surface, Hubble, 1996',
      caption:
        'Hubble’s Faint Object Camera resolved Betelgeuse’s atmosphere as a disc, with a bright hot spot, beside scale bars for the orbits of Earth and Jupiter and a chart of Orion. Ultraviolet light, shown in colour.',
      colour: 'false',
      credit: 'Andrea Dupree (Harvard-Smithsonian CfA), Ronald Gilliland (STScI), NASA and ESA',
      licence: 'CC BY 4.0',
      date: '1996-01-15',
      sourceUrl: 'https://esahubble.org/images/opo9604a/',
    },
    {
      file: 'photos/betelgeuse/alma-2015.webp',
      largeFile: 'photos/betelgeuse/alma-2015-large.webp',
      width: 640,
      height: 640,
      title: 'Betelgeuse at 0.89 millimetres, ALMA',
      caption:
        'ALMA’s image of 9 November 2015, the first of a star’s surface it made: the hot gas of the lower chromosphere, lopsided where it is locally hotter. Submillimetre light no eye can see, shown in orange.',
      colour: 'false',
      credit: 'ALMA (ESO/NAOJ/NRAO)/E. O’Gorman/P. Kervella',
      licence: 'CC BY 4.0',
      date: '2015-11-09',
      sourceUrl: 'https://www.eso.org/public/images/potw1726a/',
    },
    {
      file: 'photos/betelgeuse/visir-nebula.webp',
      largeFile: 'photos/betelgeuse/visir-nebula-large.webp',
      width: 640,
      height: 640,
      title: 'The plumes it sheds',
      caption:
        'Infrared images from VISIR on ESO’s Very Large Telescope show flame-like plumes of gas and dust thrown off by the star. A black disc masks the brightest part; the small red circle in the middle marks the star’s visible surface, about 4.5 times the width of Earth’s orbit, and earlier NACO images of the inner plumes fill the central disc. Infrared, in false colour.',
      colour: 'false',
      credit: 'ESO/P. Kervella',
      licence: 'CC BY 4.0',
      date: '2011-06-23',
      sourceUrl: 'https://www.eso.org/public/images/eso1121a/',
    },
    {
      file: 'photos/betelgeuse/siwarha-gemini.webp',
      largeFile: 'photos/betelgeuse/siwarha-gemini-large.webp',
      width: 640,
      height: 640,
      title: 'Betelgeuse and its companion, Siwarha',
      caption:
        'Gemini North’s ‘Alopeke speckle imager, taking thousands of millisecond exposures to freeze the air’s blurring, resolved a faint companion beside the supergiant in 2024. It is drawn blue because the team’s analysis makes it a hot A- or B-type star: the colours are given, not measured in this image.',
      colour: 'false',
      credit: 'International Gemini Observatory/NOIRLab/NSF/AURA; image processing: M. Zamani (NSF NOIRLab)',
      licence: 'CC BY 4.0',
      date: '2025-07-21',
      sourceUrl: 'https://noirlab.edu/public/images/noirlab2523c/',
    },
  ],
  drawnHere: [
    {
      title: 'Where it is',
      text:
        'At Hipparcos’s distance, 153 parsecs — 499 light years — from its parallax of 6.55 ± 0.83 milliarcseconds; Gaia gives no usable parallax for a star this bright. Other measurements put it farther, 168 parsecs by Joyce et al.’s models of its pulsation and 222 by Harper et al.’s radio positions; the app keeps the catalogue’s.',
      cite: ['vanleeuwen2007', 'joyce2020', 'harper2017'],
    },
    {
      title: 'Why it stays a point',
      text:
        'Its size on the sky is measured, but a size in kilometres needs a distance, and Betelgeuse’s differs by nearly half between measurements; nor is its surface round or steady, lumpy with giant hot spots and changing over months. So no disc is drawn.',
      cite: ['harper2017', 'montarges2021', 'ogorman2017'],
    },
    {
      title: 'Its brightness',
      text: 'Steady, at its catalogue magnitude: its 400-day pulsation, its six-year cycle and the Great Dimming are not drawn.',
      cite: ['noirlab2025', 'montarges2021'],
    },
    {
      title: 'Its companion',
      text: 'Siwarha is not drawn: one probable sighting does not give an orbit to put it on.',
      cite: ['howell2025'],
    },
  ],
  measured: [
    {
      title: 'The Great Dimming',
      text:
        'Usually between magnitude 0.1 and 1.0, it fell to 1.614 ± 0.008 in 7–13 February 2020. SPHERE’s images showed its southern half ten times darker than usual in visible light: a patch of its surface had cooled, and gas it had thrown off just before condensed into dust that veiled it. It was back to normal by April 2020.',
      cite: ['montarges2021'],
    },
    {
      title: 'An outburst before it',
      text: 'Spectra, Hubble’s among them, caught the ejection that fed the dust: a huge mass of hot gas thrown from its surface in 2019, which then cooled and dimmed the star.',
      cite: ['dupree2022'],
    },
    {
      title: 'Its parallax',
      text:
        'Hipparcos: 6.55 ± 0.83 milliarcseconds, 153 parsecs. Hipparcos together with radio positions from the VLA, e-MERLIN and ALMA: 4.51 ± 0.80, 222 parsecs. The two overlap within their errors; the distance is not known to better than about a fifth.',
      cite: ['vanleeuwen2007', 'harper2017'],
    },
    {
      title: 'Its surface',
      text:
        'Hubble imaged its ultraviolet atmosphere as a disc in 1996, the first image of a star’s surface it made; ALMA in 2015 mapped its lower chromosphere at 0.89 mm, lopsided with hot spots.',
      cite: ['gilliland1996', 'ogorman2017'],
    },
    {
      title: 'What it sheds',
      text: 'Plumes of gas reaching out several times its own size, and beyond them a nebula of dust, imaged in the infrared with the VLT’s NACO and VISIR.',
      cite: ['kervella2011'],
    },
    {
      title: 'Its companion',
      text:
        'Predicted in 2024 from its six-year cycle and from its wobble in radial velocity and position, then probably seen by Gemini North’s speckle imager: 52 milliarcseconds from Betelgeuse, six magnitudes fainter — a tentative detection, at 1.5 sigma, which its finders call probable. Named Siwarha by the IAU’s Working Group on Star Names on 22 September 2025.',
      cite: ['goldberg2024', 'macleod2025', 'howell2025', 'aasnova2025', 'iau2026'],
    },
  ],
  estimated: [
    {
      title: 'Its size, mass and age',
      text:
        'From models of how it pulsates and evolves: 764 (+116 −62) times the Sun’s radius, 16.5 to 19 times its mass, at 168 (+27 −15) parsecs, about 530 light years; and in its core-helium-burning phase, early in it.',
      cite: ['joyce2020'],
    },
    {
      title: 'When it explodes',
      text: 'By those models, more than 100,000 years from now. The figure is a model’s: nothing seen from outside can date the collapse of a core.',
      cite: ['ipmu2021', 'joyce2020'],
    },
    {
      title: 'Siwarha',
      text:
        'From its light: about 1.5 times the Sun’s mass (1.4 to 2.0), a hot young A- or B-type star not yet burning hydrogen in its core, about four times the Earth–Sun distance from Betelgeuse’s surface. Tides should drag it into the giant within some 10,000 years.',
      cite: ['noirlab2025', 'aasnova2025'],
    },
  ],
  missing: [
    {
      title: 'Siwarha’s orbit',
      text: 'Not yet measured from images: the next chance to see the companion at its widest from Betelgeuse is November 2027.',
      cite: ['noirlab2025'],
    },
    {
      title: 'Its nebula and its dust',
      text: 'Not drawn: there is no 3D model of them, and the app draws no photograph in the scene.',
    },
  ],
  misconceptions: [
    {
      title: 'The dimming was not the end',
      text:
        'The Great Dimming was taken by many as a sign the supernova was near. It was dust from an outburst of its surface, and the star is still early in its helium-burning stage.',
      cite: ['montarges2021', 'ipmu2021'],
    },
    {
      title: '“It may already have exploded”',
      text:
        'Often said, since its light is 500 to 700 years old. With more than 100,000 years to go by the models, the chance it has gone in the time its light has been travelling is well under one percent.',
      cite: ['ipmu2021', 'vanleeuwen2007', 'harper2017'],
    },
  ],
  sources: [
    {
      key: 'vanleeuwen2007',
      text: 'van Leeuwen, F. 2007, Validation of the new Hipparcos reduction, A&A 474, 653',
      url: 'https://doi.org/10.1051/0004-6361:20078357',
    },
    {
      key: 'harper2017',
      text: 'Harper, G. M., Brown, A., Guinan, E. F., et al. 2017, An Updated 2017 Astrometric Solution for Betelgeuse, AJ 154, 11',
      url: 'https://doi.org/10.3847/1538-3881/aa6ff9',
    },
    {
      key: 'joyce2020',
      text: 'Joyce, M., Leung, S.-C., et al. 2020, Standing on the Shoulders of Giants: New Mass and Distance Estimates for Betelgeuse through Combined Evolutionary, Asteroseismic, and Hydrodynamic Simulations with MESA, ApJ 902, 63',
      url: 'https://doi.org/10.3847/1538-4357/abb8db',
    },
    {
      key: 'ipmu2021',
      text: 'Kavli IPMU 2021, Study of supergiant star Betelgeuse unveils the cause of its pulsations; recalibrated its mass, radius, and distance',
      url: 'https://www.ipmu.jp/en/node/8466',
    },
    {
      key: 'montarges2021',
      text: 'Montargès, M., Cannon, E., et al. 2021, A dusty veil shading Betelgeuse during its Great Dimming, Nature 594, 365',
      url: 'https://doi.org/10.1038/s41586-021-03546-8',
    },
    {
      key: 'dupree2022',
      text: 'Dupree, A. K., Strassmeier, K. G., et al. 2022, The Great Dimming of Betelgeuse: A Surface Mass Ejection and Its Consequences, ApJ 936, 18',
      url: 'https://doi.org/10.3847/1538-4357/ac7853',
    },
    {
      key: 'gilliland1996',
      text: 'Gilliland, R. L., & Dupree, A. K. 1996, First Image of the Surface of a Star with the Hubble Space Telescope, ApJ 463, L29',
      url: 'https://doi.org/10.1086/310043',
    },
    {
      key: 'ogorman2017',
      text: 'O’Gorman, E., Kervella, P., et al. 2017, The inhomogeneous submillimeter atmosphere of Betelgeuse, A&A 602, L10',
      url: 'https://doi.org/10.1051/0004-6361/201731171',
    },
    {
      key: 'kervella2011',
      text: 'Kervella, P., Perrin, G., et al. 2011, The close circumstellar environment of Betelgeuse. II. Diffraction-limited spectro-imaging from 7.76 to 19.50 μm with VLT/VISIR, A&A 531, A117',
      url: 'https://doi.org/10.1051/0004-6361/201116962',
    },
    {
      key: 'goldberg2024',
      text: 'Goldberg, J. A., Joyce, M., et al. 2024, A Buddy for Betelgeuse: Binarity as the Origin of the Long Secondary Period in α Orionis, ApJ 977, 35',
      url: 'https://doi.org/10.3847/1538-4357/ad87f4',
    },
    {
      key: 'macleod2025',
      text: 'MacLeod, M., Blunt, S., et al. 2025, Radial Velocity and Astrometric Evidence for a Close Companion to Betelgeuse, ApJ 978, 50',
      url: 'https://doi.org/10.3847/1538-4357/ad93c8',
    },
    {
      key: 'howell2025',
      text: 'Howell, S. B., Ciardi, D. R., et al. 2025, The Probable Direct-imaging Detection of the Stellar Companion to Betelgeuse, ApJL 988, L47',
      url: 'https://doi.org/10.3847/2041-8213/adeaaf',
    },
    {
      key: 'noirlab2025',
      text: 'NSF NOIRLab 2025, Gemini North Discovers Long-Predicted Stellar Companion of Betelgeuse (release noirlab2523)',
      url: 'https://noirlab.edu/public/news/noirlab2523/',
    },
    {
      key: 'aasnova2025',
      text: 'AAS Nova 2025, Betelgeuse’s Companion Star May Have Been Seen at Last',
      url: 'https://aasnova.org/2025/07/23/betelgeuses-companion-star-may-have-been-seen-at-last/',
    },
    {
      key: 'iau2026',
      text: 'IAU 2026, IAU Selects New Star Names to Reflect Global Astronomical Culture (names adopted in 2025)',
      url: 'https://iau.org/IAU/News/Ann2026/New-Star-Names-2026.aspx',
    },
    {
      key: 'ballesteros2012',
      text: 'Ballesteros, F. J. 2012, New insights into black bodies, EPL 97, 34008',
      url: 'https://doi.org/10.1209/0295-5075/97/34008',
    },
  ],
};
