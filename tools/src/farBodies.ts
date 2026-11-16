import type { BodyDefinition } from './types.ts';
import { smallBody } from './smallBodies.ts';

/**
 * The far ones as bodies of their own: the largest trans-Neptunians after the dwarf planets,
 * the sednoids, the farthest objects seen, and 1I/ʻOumuamua. Every one of them is also a
 * point in the belt (SBDB's elements, two-body); here they are drawn the way the named
 * asteroids are (smallBodies.ts) -- JPL's own integrated vectors, to a kilometre, over the
 * whole window -- and the belt leaves them out (catalogDesignations), so none is drawn twice.
 *
 * **Why these.**
 *   - Orcus, Salacia and Quaoar: each has a moon JPL publishes an orbit for (Vanth, Actaea,
 *     Weywot: moons/minorPlanetMoons.ts), and a moon needs its primary to be a body.
 *   - Gonggong, Sedna, Varuna and Ixion: the largest after them that are measured.
 *   - 2012 VP113, Leleākūhonua (2015 TG387) and 2023 KQ14: the sednoids -- perihelia past
 *     65 AU, beyond anything Neptune moves -- with Sedna; and 2017 OF201, aphelion ~1,780 AU.
 *   - 2018 VG18 "Farout" and 2018 AG37 "FarFarOut": the farthest Solar System objects seen
 *     when they were found, 124 and 132 AU (their discoverers' figures; JPL's current fits
 *     put them near there today).
 *   - 1I/ʻOumuamua: the first interstellar object, on a hyperbola (e = 1.20). SBDB lists it
 *     as an asteroid, so the belt, which keeps only closed orbits, dropped it; the comets
 *     (famousComets.ts) took 2I and 3I but not it. JPL's solution includes the
 *     non-gravitational acceleration Micheli et al. found (Nature 559, 223, 2018,
 *     doi:10.1038/s41586-018-0254-4, as Horizons' record cites it); outside
 *     its data arc, 2017-10-14 to 2018-01-02, that acceleration "can only be assumed", in
 *     Horizons' own words, so its path before and after is less certain than shown.
 *
 * **Kind.** 'asteroid', the IAU's: only five dwarf planets are recognised, and none of these
 * is one, however round Orcus or Quaoar may be.
 *
 * **Size.** Measured where it has been, cited per body: thermal (Herschel, ALMA) or an
 * occultation. Where only the brightness is known -- every sednoid, the farthest two and
 * ʻOumuamua -- a size would be a guess at the albedo, so none is given: a marker, as for a
 * comet with no measured nucleus (radiusPublished: false). GM: unmeasured for all (zero),
 * as for the named asteroids; the moons' orbits are JPL's and need none of it. Shape drawn
 * round where the measurement is one radius and nothing says otherwise; Varuna's light
 * curve says it is elongated, and no axes are published with an orientation, so it is a
 * marker with its measured size in the panel, as Haumea is.
 *
 * **Colour** is a choice, from their measured spectral slopes: neutral grey for Orcus and
 * Salacia, red for the rest -- Sedna and Gonggong among the reddest bodies known. No maps.
 *
 * **Periods** are those JPL carries (Horizons, from the Light Curve Database, Warner et al.
 * 2009, rev. 2023), several flagged there as perhaps wrong by 30%; no pole is published for
 * any, so none is signed.
 */
export const FAR_BODIES: readonly BodyDefinition[] = [
  // Orcus. Radius 455 (+25/-20) km: JPL's TNO satellite solution (Horizons 920090482,
  // tnosat_v001).
  smallBody({
    id: 'orcus',
    name: 'Orcus',
    horizonsId: '90482;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 455,
    gmKm3S2: 0,
    rotationPeriodHours: 13.188,
    rotation: null,
    shapeDrawn: true,
    color: '#a8a49c',
    map: null,
  }),
  // Salacia. Radius 452.5 +- 51.5 km: JPL's TNO satellite solution (Horizons 920120347).
  smallBody({
    id: 'salacia',
    name: 'Salacia',
    horizonsId: '120347;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 452.5,
    gmKm3S2: 0,
    rotationPeriodHours: 6.09,
    rotation: null,
    shapeDrawn: true,
    color: '#7a746c',
    map: null,
  }),
  // Quaoar. Equivalent radius 555 +- 2.5 km from the 2011 occultation: Braga-Ribas et al.,
  // ApJ 773, 26 (2013). JPL's solution carries 569 x 518 km, oblate, but with no pole to
  // turn it by: drawn round at the equivalent radius. Its two rings, at 4,100 and 2,500 km
  // (Morgado et al., Nature 614, 239, 2023; Pereira et al., A&A 673, L4, 2023), are not
  // drawn: their plane has no published pole in the form the app turns rings by.
  smallBody({
    id: 'quaoar',
    name: 'Quaoar',
    horizonsId: '50000;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 555,
    gmKm3S2: 0,
    rotationPeriodHours: 8.8394,
    rotation: null,
    shapeDrawn: true,
    color: '#a8866c',
    map: null,
  }),
  // Varuna. Diameter 900 +- 140 km: SBDB, from Earth Moon Planets 89, 117 (2002).
  // Elongated by its light curve: a marker.
  smallBody({
    id: 'varuna',
    name: 'Varuna',
    horizonsId: '20000;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 450,
    gmKm3S2: 0,
    rotationPeriodHours: 6.3436,
    rotation: null,
    shapeDrawn: false,
    color: '#9a8274',
    map: null,
  }),
  // Ixion. Diameter 617 (+19/-20) km from Herschel: Lellouch et al., A&A 557, A60 (2013).
  // Period unpublished in JPL's record.
  smallBody({
    id: 'ixion',
    name: 'Ixion',
    horizonsId: '28978;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 308.5,
    gmKm3S2: 0,
    rotationPeriodHours: null,
    rotation: null,
    shapeDrawn: true,
    color: '#a07a64',
    map: null,
  }),
  // Gonggong. Diameter 1,230 +- 50 km: Kiss et al., Icarus 334, 3 (2019). Its moon Xiangliu
  // has no orbit in Horizons, so it is not drawn.
  smallBody({
    id: 'gonggong',
    name: 'Gonggong',
    horizonsId: '225088;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 615,
    gmKm3S2: 0,
    rotationPeriodHours: 22.4,
    rotation: null,
    shapeDrawn: true,
    color: '#a0705a',
    map: null,
  }),
  // Sedna. Diameter 995 +- 80 km from Herschel: Pál et al., A&A 541, L6 (2012). Perihelion
  // 76 AU in 2076, aphelion ~880 AU.
  smallBody({
    id: 'sedna',
    name: 'Sedna',
    horizonsId: '90377;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: 497.5,
    gmKm3S2: 0,
    rotationPeriodHours: 10.273,
    rotation: null,
    shapeDrawn: true,
    color: '#b06a50',
    map: null,
  }),
  // The sednoids, 2017 OF201 and the farthest two: brightness only (H 3.5 to 7.0), so no size.
  ...(
    [
      ['2012-vp113', '2012 VP113', 'DES=2012 VP113;'],
      ['leleakuhonua', 'Leleākūhonua', '541132;'],
      ['2023-kq14', '2023 KQ14', 'DES=2023 KQ14;'],
      ['2017-of201', '2017 OF201', 'DES=2017 OF201;'],
      ['2018-vg18', '2018 VG18 (Farout)', 'DES=2018 VG18;'],
      ['2018-ag37', '2018 AG37 (FarFarOut)', 'DES=2018 AG37;'],
    ] as const
  ).map(([id, name, horizonsId]) =>
    smallBody({
      id,
      name,
      horizonsId,
      kind: 'asteroid',
      stepDays: 32,
      radiiKm: null,
      gmKm3S2: 0,
      rotationPeriodHours: null,
      rotation: null,
      shapeDrawn: false,
      color: '#9a8070',
      map: null,
    }),
  ),
  // 1I/ʻOumuamua. No size: its brightness and light curve allow anything from a 100 m
  // cigar to a disc, depending on an albedo nobody measured. Period 7.937 h (LCDB, via SBDB).
  smallBody({
    id: '1i-oumuamua',
    name: '1I/ʻOumuamua (A/2017 U1)',
    horizonsId: 'DES=A/2017 U1;',
    kind: 'asteroid',
    stepDays: 1,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: 7.937,
    rotation: null,
    shapeDrawn: false,
    color: '#a08070',
    map: null,
  }),
];

/**
 * True for an interstellar object by its IAU designation, 'nI/': one bound to no star, on a
 * hyperbola about the Sun -- which is what such a body's elements must say, and why the
 * fetch does not take its open orbit for a wrong answer from Horizons (fetchAdaptiveBody).
 */
export function isInterstellar(body: Pick<BodyDefinition, 'name'>): boolean {
  return /^\d+I\//.test(body.name);
}
