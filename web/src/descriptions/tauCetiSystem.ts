import { TAU_CETI_SYSTEM_DESCRIPTION_ID } from './subjects.ts';
import type { Description } from './types.ts';

/**
 * Tau Ceti as a system: its star, its four planet candidates and its dust. No body -- the star
 * is a catalogue star and the planets are each a body of their own -- so opened by the store's
 * readAbout, from the planetary-system level's panel (state/levels.ts), the breadcrumb's list
 * and the system's search result. What is drawn is read off core/planetarySystems.ts (the star's
 * radius and mass, the planets as Feng et al. fitted them and as the Exoplanet Archive counts
 * them), core/exoplanets.ts (the conventions for what is not measured) and the star's record in
 * the 3D stars (its distance, Hipparcos's parallax). No photograph: none of the system's own is
 * in the app yet, and the star alone is a point.
 */
export const TAU_CETI_SYSTEM: Description = {
  id: TAU_CETI_SYSTEM_DESCRIPTION_ID,
  subject: { name: 'Tau Ceti', kind: 'planetary system' },
  lead: [
    'One of the nearest stars like the Sun, and one of the first anyone listened to. In 1960 Frank Drake pointed a radio telescope at Tau Ceti and at Epsilon Eridani to hear whether anyone there was calling, the first such search ever made. Nothing was heard. Since then the star has been watched for planets and found to be ringed with dust, and it is still not known whether anything goes round it.',
    'Tau Ceti is a yellow star of spectral type G8, a little cooler and smaller than the Sun: 0.78 times its mass and 0.79 times its width, 11.9 light years away in the constellation Cetus, the Whale. It is visible without a telescope, a modest star of magnitude 3.5. It is poorer in metals than the Sun, with about a third as much iron for its hydrogen.',
    'Four planets have been proposed around it, all from a wobble of its light far smaller than any planet search was built for: the star moving toward and away from us at a third to half a metre a second, slower than a walk. If they are real they are each at least about twice to four times Earth’s mass, and the outer two, e and f, lie near the inner and outer edges of the zone where water could be liquid. None has been confirmed.',
    'What is certain is its dust. Tau Ceti is circled by a broad belt of it reaching out some 55 times the Earth–Sun distance, about as far as the Kuiper belt beyond Neptune — but with at least ten times as much dust, worn off a swarm of colliding rocks and ice, as there is in ours.',
  ],
  photos: [],
  sections: [
    {
      title: 'The first search',
      text: [
        'Project Ozma, named for the princess of L. Frank Baum’s Oz, was the first search for a signal from another civilisation. Its two targets were chosen because they were near and like the Sun.',
      ],
      points: [
        {
          title: 'What was done',
          text: 'From April to July 1960, Frank Drake at the National Radio Astronomy Observatory in Green Bank, West Virginia, turned the 26-metre (85-foot) dish to Tau Ceti and Epsilon Eridani for some 150 hours in all, listening near 1,420 MHz, the radio line of hydrogen, a frequency any radio astronomer anywhere would know. No signal was found.',
          cite: ['britannica'],
        },
      ],
    },
  ],
  drawnHere: [
    {
      title: 'Its view',
      text: 'The system’s breadcrumb entry and its search result put the camera five times the outermost planet’s farthest distance from the star, 7.7 AU, 30° off that planet’s orbital pole, so the four orbits read as ellipses. Zoomed out from the star or a planet past about 0.6 AU, the panel becomes the system’s.',
    },
    {
      title: 'The star',
      text: 'A sphere of its measured radius, 0.793 times the Sun’s, 552,000 km, from the interferometer’s measure of its angular size and its distance; placed by its catalogue position and motion, 3.65 parsecs away by Hipparcos’s parallax.',
      cite: ['teixeira2009', 'vanleeuwen2007'],
    },
    {
      title: 'The planets',
      text: 'All four grey: g, h and f named disputed, as the NASA Exoplanet Archive flags them, and e a candidate, as it is not in the Archive at all. Their periods, distances, eccentricities and minimum masses are Feng et al.’s. Their orbits are drawn edge-on as seen from the Sun, a convention, since their tilt is not known; and where each is along its orbit is not known either, so each stands at its periastron as of 1 January 2000, a stand-in.',
      cite: ['feng2017', 'archive'],
    },
    {
      title: 'Their sizes',
      text: 'None passes in front of the star, so none has a measured size: each is drawn at the width its minimum mass suggests, and said to be an estimate.',
      cite: ['feng2017'],
    },
  ],
  measured: [
    {
      title: 'The star',
      text: 'Spectral type G8V. Its radius, 0.793 ± 0.004 times the Sun’s, from the VLTI’s measure of its diameter; its mass, 0.783 times the Sun’s, from the oscillations of its surface, which ring like a bell at frequencies its size and density set.',
      cite: ['simbad', 'teixeira2009'],
    },
    {
      title: 'Its distance',
      text: '273.96 milliarcseconds of parallax: 3.650 parsecs, 11.9 light years.',
      cite: ['vanleeuwen2007'],
    },
    {
      title: 'Its metals',
      text: '[Fe/H] = −0.49: about a third of the Sun’s iron for its hydrogen. Its magnesium is high against its silicon, Mg/Si 1.78 where Earth’s is about 1.2 — rock formed there would be made of other minerals in other shares than Earth’s.',
      cite: ['pagano2015'],
    },
    {
      title: 'Its dust',
      text: 'First imaged at 850 µm in 2004, reaching to about 55 AU, with at least ten times the dust of the Kuiper belt; Herschel found it a wide ring tilted 35° ± 10° from face-on, its inner edge somewhere between 1 and 10 AU, and ALMA put that edge at 6.2 AU, between 1.6 and 16.',
      cite: ['greaves2004', 'lawler2014', 'macgregor2016'],
    },
    {
      title: 'Four signals',
      text: 'In HARPS radial velocities, wobbles of 0.35 to 0.55 m/s at 20.0, 49.4, 162.9 and 636 days: g, h, e and f, at 0.13, 0.24, 0.54 and 1.33 AU, minimum masses 1.75, 1.83, 3.93 and 3.93 Earths.',
      cite: ['feng2017'],
    },
  ],
  estimated: [
    {
      title: 'The disc’s mass',
      text: 'Modelling the dust as ground off colliding bodies up to 10 km across, Greaves et al. put about 1.2 Earth masses in them, against about 0.1 in the Kuiper belt.',
      cite: ['greaves2004'],
    },
    {
      title: 'What the planets would weigh',
      text: 'A wobble gives only a minimum mass. If the planets orbit in the plane of the dust, tilted 35° from face-on — which is not known — each would be about 1.7 times its minimum: f nearly seven Earths.',
      cite: ['feng2017', 'lawler2014'],
    },
    {
      title: 'Room for them',
      text: 'Simulated in 2014, the five planets then proposed left the dust’s orbits stable from about where its inner edge is seen, and stayed stable with one more planet, no heavier than Neptune, beyond 5 AU.',
      cite: ['lawler2014'],
    },
  ],
  missing: [
    {
      title: 'Whether any planet is there',
      text: 'The signals are at the edge of what HARPS can measure, among wobbles of the star’s own surface of about the same size. A first analysis in 2013 proposed five; the 2017 one kept two of them, e and f, and found g and h instead. The Archive counts none of the four as confirmed.',
      cite: ['tuomi2013', 'feng2017', 'archive'],
    },
    {
      title: 'Where the planets are, and how they are tilted',
      text: 'Not known: no epoch for their positions was published, and none passes in front of the star.',
      cite: ['feng2017'],
    },
    {
      title: 'The dust',
      text: 'Not drawn. Its ring is measured, but only as a glow at long wavelengths with a radius, a width and a tilt; nothing here draws a disc yet.',
      cite: ['lawler2014', 'macgregor2016'],
    },
  ],
  misconceptions: [
    {
      title: 'Not a system of habitable Earths',
      text: 'Tau Ceti e and f are often listed as habitable worlds. They are unconfirmed signals of planets at least four times Earth’s mass, near the edges of the zone where water could be liquid; whether either exists is not known.',
      cite: ['feng2017', 'archive'],
    },
    {
      title: 'Not quite a twin of the Sun',
      text: 'It is a G star like the Sun, but cooler, lighter, and with a third of the Sun’s iron: a different recipe, which may make different planets.',
      cite: ['teixeira2009', 'pagano2015'],
    },
    {
      title: 'Its dust is not a Kuiper belt like ours',
      text: 'It spans about the same distances, but holds at least ten times the dust, and so, by the dust’s own estimate, far more colliding bodies.',
      cite: ['greaves2004'],
    },
    {
      title: 'Ozma heard nothing',
      text: 'The first search for a signal from another civilisation listened to Tau Ceti for weeks in 1960 and found nothing from it.',
      cite: ['britannica'],
    },
  ],
  sources: [
    {
      key: 'feng2017',
      text: 'Feng, F., Tuomi, M., Jones, H. R. A., Barnes, J., Anglada-Escudé, G., Vogt, S. S., & Butler, R. P. 2017, Color Difference Makes a Difference: Four Planet Candidates around τ Ceti, AJ 154, 135',
      url: 'https://doi.org/10.3847/1538-3881/aa83b4',
    },
    {
      key: 'tuomi2013',
      text: 'Tuomi, M., Jones, H. R. A., Jenkins, J. S., et al. 2013, Signals embedded in the radial velocity noise. Periodic variations in the τ Ceti velocities, A&A 551, A79',
      url: 'https://doi.org/10.1051/0004-6361/201220509',
    },
    {
      key: 'archive',
      text: 'NASA Exoplanet Archive, Planetary Systems table (queried 29 October 2026)',
      url: 'https://exoplanetarchive.ipac.caltech.edu/',
    },
    {
      key: 'teixeira2009',
      text: 'Teixeira, T. C., Kjeldsen, H., Bedding, T. R., et al. 2009, Solar-like oscillations in the G8 V star τ Ceti, A&A 494, 237',
      url: 'https://doi.org/10.1051/0004-6361:200810746',
    },
    {
      key: 'vanleeuwen2007',
      text: 'van Leeuwen, F. 2007, Validation of the new Hipparcos reduction, A&A 474, 653',
      url: 'https://doi.org/10.1051/0004-6361:20078357',
    },
    {
      key: 'simbad',
      text: 'Wenger, M., et al. 2000, The SIMBAD astronomical database, A&AS 143, 9 (tau Cet: spectral type)',
      url: 'https://doi.org/10.1051/aas:2000332',
    },
    {
      key: 'pagano2015',
      text: 'Pagano, M., Truitt, A., Young, P. A., & Shim, S.-H. 2015, The Chemical Composition of τ Ceti and Possible Effects on Terrestrial Planets, ApJ 803, 90',
      url: 'https://doi.org/10.1088/0004-637X/803/2/90',
    },
    {
      key: 'greaves2004',
      text: 'Greaves, J. S., Wyatt, M. C., Holland, W. S., & Dent, W. R. F. 2004, The debris disc around τ Ceti: a massive analogue to the Kuiper Belt, MNRAS 351, L54',
      url: 'https://ui.adsabs.harvard.edu/abs/2004MNRAS.351L..54G',
    },
    {
      key: 'lawler2014',
      text: 'Lawler, S. M., Di Francesco, J., Kennedy, G. M., et al. 2014, The debris disc of solar analogue τ Ceti: Herschel observations and dynamical simulations of the proposed multiplanet system, MNRAS 444, 2665',
      url: 'https://ui.adsabs.harvard.edu/abs/2014MNRAS.444.2665L',
    },
    {
      key: 'macgregor2016',
      text: 'MacGregor, M. A., Lawler, S. M., Wilner, D. J., et al. 2016, ALMA Observations of the Debris Disk of Solar Analogue τ Ceti, ApJ 828, 113',
      url: 'https://ui.adsabs.harvard.edu/abs/2016ApJ...828..113M',
    },
    {
      key: 'britannica',
      text: 'Encyclopaedia Britannica, Project Ozma',
      url: 'https://www.britannica.com/event/Project-Ozma',
    },
  ],
};
