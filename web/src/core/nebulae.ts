import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import { registerDeepSky } from './deepSky.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { GAIA_ZERO_POINT_MAS } from './messier.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector, Vec3 } from './vec3.ts';
import type { FramingRequest } from '../state/store.ts';

/**
 * Nebulae: the famous star-forming regions and planetary nebulae, each at the distance a
 * Gaia-era measurement gives it, of the size a survey or a paper measures, drawn as a volume of
 * glowing gas (scene/nebulaVolume.ts) -- never a photograph.
 *
 * ## Measured
 *
 * - **Where and how far.** The star-forming regions at their clusters' Gaia distances: Kuhn et
 *   al. 2019 (ApJ 870, 32, Gaia DR2) for Orion, the Lagoon, the Trifid, the Eagle, the Omega and
 *   the Rosette; Göppl & Preibisch 2022 (A&A 660, A11, Gaia EDR3) for Carina; the Horsehead at
 *   σ Orionis's, whose lighting it is (Schaefer et al. 2016, AJ 152, 213, from its orbit); the
 *   Tarantula at the Large Magellanic Cloud's (Pietrzyński et al. 2019, as localGroup.ts). The
 *   planetary nebulae at their central stars' Gaia DR3 parallaxes, inverted once Gaia's zero-point,
 *   -0.017 mas (Lindegren et al. 2021), is taken off (the star the Gaia source is, given each).
 * - **How big.** The star-forming regions' radii are the WISE catalogue's of Galactic H II
 *   regions (Anderson et al. 2014, ApJS 212, 1; version 3.0): the circle enclosing each one's
 *   mid-infrared ring, which bounds its ionised gas. The planetary nebulae's from the papers
 *   that model them, below.
 * - **Their 3D shapes, where published.** The Ring: a triaxial ellipsoid, a dense equatorial
 *   ring with faint caps along a polar axis 13.5° from the line of sight (O'Dell et al. 2013,
 *   AJ 145, 92). The Helix: an inner disk tilted 28° to the sky with its north-west side nearer,
 *   and an outer torus tilted 53° the other way, nearly perpendicular to it (O'Dell, McCullough
 *   & Meixner 2004, AJ 128, 2339). The Southern Ring: a bipolar "diabolo" whose axis is 40° from
 *   the line of sight (Monteiro et al. 2000, MNRAS 311, 764). The Cat's Eye: a prolate inner
 *   bubble along PA 25° (Reed et al. 1999, AJ 118, 2430). The Dumbbell: a barrel-shaped shell
 *   along PA 125°, 8′ × 5′, seen from its equator's plane (Meaburn et al. 2005, MNRAS 360, 963).
 *   Orion: a blister, the ionised face of the cloud behind the Trapezium, open toward us
 *   (O'Dell 2001, ARA&A 39, 99).
 *
 * ## Modelled
 *
 * Everything inside those outlines: where the gas is clumped, its filaments and pillars (drawn
 * from noise), how deep a star-forming region is (as deep as it is wide), the share of [O III]
 * light (from narrowband photographs, not measured fluxes) and the brightness, a long exposure's.
 * Where no shape is published -- the star-forming regions but Orion and the Rosette's cavity --
 * the gas fills an ellipsoid of the measured size. The About says which is which.
 */

/** What a nebula is: a star-forming (H II) region, or a planetary nebula. */
export type NebulaKind = 'star-forming' | 'planetary';

/**
 * One part of a nebula's model, in its sky frame: east, north, toward Earth.
 *
 * The part's own axes: e1 along position angle `paDeg` on the sky (east of north); e2 and e3
 * the sky's other direction and the line of sight toward Earth, both turned about e1 by
 * `tiltDeg` -- so e3, the pole, leans from the line of sight toward PA + 90° by the tilt, and
 * a ring in the e1-e2 plane has its PA + 90° side tipped away from us. `semiAxesArcmin` are
 * along e1, e2 and e3.
 */
export interface NebulaPart {
  /**
   * - **cloud**: gas filling it, densest at its middle, clumped (a star-forming region);
   * - **shell**: a shell at its surface, `width` thick, brighter by `equator` round its equator
   *   (the e1-e2 plane): a planetary nebula's, or a cavity's rim;
   * - **bowl**: a shell's far half only, open toward Earth: Orion's blister;
   * - **ring**: a torus round e3 in the e1-e2 plane, its tube `width` of its radius;
   * - **dust**: a dark cloud: no light of its own, it dims what lies behind it.
   */
  readonly form: 'cloud' | 'shell' | 'bowl' | 'ring' | 'dust';
  readonly semiAxesArcmin: readonly [number, number, number];
  readonly paDeg: number;
  readonly tiltDeg: number;
  /** Its centre's offset from the nebula's, arcminutes east and north on the sky. */
  readonly offsetArcmin: readonly [number, number];
  /** A shell's or ring's width, as a share of its radius (FWHM). */
  readonly width: number;
  /** A shell's extra light round its equator: 0 none, 3 four times as bright there. */
  readonly equator: number;
  /** How much of the nebula's light it gives, against its other parts. */
  readonly light: number;
  /** The share of its light in [O III], toward its inside (0 to 1); the rest hydrogen's and nitrogen's red. */
  readonly oxygen: number;
}

export interface Nebula {
  readonly key: string;
  readonly name: string;
  readonly otherNames: readonly string[];
  readonly kind: NebulaKind;
  /** Its centre, J2000, degrees: the WISE region's centre, or the central star's Gaia position. */
  readonly raDeg: number;
  readonly decDeg: number;
  readonly distancePc: number;
  readonly distanceUpPc: number | null;
  readonly distanceDownPc: number | null;
  readonly distanceMethod: string;
  readonly reference: string;
  readonly note: string | null;
  /** Its size on the sky, arcminutes, major and minor, and whose. */
  readonly sizeArcmin: readonly [number, number];
  readonly sizeReference: string;
  /** Its shape's paper, where its 3D shape is published; null where it is an estimate. */
  readonly shapeReference: string | null;
  /** What the model holds that is not measured, said in its panel. */
  readonly modelled: string;
  readonly parts: readonly NebulaPart[];
}

const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dms = (sign: 1 | -1, d: number, m: number, s: number): number => sign * (d + m / 60 + s / 3600);
/** A Gaia parallax's distance, pc, once Gaia's zero-point is taken off (messier.ts), and its 1-sigma range. */
function fromParallax(measuredMas: number, error: number): { distancePc: number; distanceUpPc: number; distanceDownPc: number } {
  const mas = measuredMas - GAIA_ZERO_POINT_MAS;
  const d = 1000 / mas;
  return {
    distancePc: Math.round(d * 10) / 10,
    distanceUpPc: Math.round((1000 / (mas - error) - d) * 10) / 10,
    distanceDownPc: Math.round((d - 1000 / (mas + error)) * 10) / 10,
  };
}

const part = (p: Partial<NebulaPart> & Pick<NebulaPart, 'form' | 'semiAxesArcmin'>): NebulaPart => ({
  paDeg: 0,
  tiltDeg: 0,
  offsetArcmin: [0, 0],
  width: 0.15,
  equator: 0,
  light: 1,
  oxygen: 0,
  ...p,
});

/** A star-forming region as the WISE catalogue bounds it: a clumped cloud as deep as it is wide. */
const region = (radiusArcsec: number, oxygen: number, extra: readonly NebulaPart[] = []): readonly NebulaPart[] => {
  const r = radiusArcsec / 60;
  return [part({ form: 'cloud', semiAxesArcmin: [r, r, r], oxygen }), ...extra];
};

const KUHN = 'Kuhn et al. 2019, ApJ 870, 32 (Gaia DR2)';
const WISE = 'Anderson et al. 2014, ApJS 212, 1 (WISE H II catalogue v3.0)';
const CLOUD_MODEL = 'its depth (as deep as it is wide), its clumps and filaments, the [O III] share';

export const NEBULAE: readonly Nebula[] = [
  {
    key: 'orion',
    name: 'Orion Nebula',
    otherNames: ['M42', 'NGC 1976', 'Great Orion Nebula'],
    kind: 'star-forming',
    // WISE G209.037-19.377.
    raDeg: 83.83689,
    decDeg: -5.40823,
    distancePc: 403,
    distanceUpPc: 7,
    distanceDownPc: 6,
    distanceMethod: 'Gaia parallaxes of the Orion Nebula Cluster',
    reference: KUHN,
    note: 'VLBA parallaxes of its stars give 388 ± 5 pc (Kounkel et al. 2017).',
    sizeArcmin: [18.2, 18.2],
    sizeReference: `${WISE}; the Extended Orion Nebula, G209.107-19.510`,
    shapeReference: "O'Dell 2001, ARA&A 39, 99",
    modelled: 'the bowl’s depth, its clumps, the [O III] share',
    parts: [
      // The blister: the ionised face of the molecular cloud behind the Trapezium, open toward us.
      part({ form: 'bowl', semiAxesArcmin: [9.1, 9.1, 6], width: 0.35, oxygen: 0.5, light: 1.2 }),
      // The Huygens region, the bright core round the Trapezium, 1.5' toward us of the bowl's middle.
      part({ form: 'cloud', semiAxesArcmin: [2.6, 2.6, 2], offsetArcmin: [-0.4, 0.3], oxygen: 0.6, light: 0.9 }),
      // The Extended Orion Nebula: a faint bubble to the south-west (WISE G209.107-19.510, r 29').
      part({ form: 'shell', semiAxesArcmin: [29, 29, 29], offsetArcmin: [-5.33, -7.13], width: 0.35, light: 0.12, oxygen: 0.15 }),
    ],
  },
  {
    key: 'lagoon',
    name: 'Lagoon Nebula',
    otherNames: ['M8', 'NGC 6523', 'Sh2-25'],
    kind: 'star-forming',
    // WISE G006.100-01.263, round NGC 6530.
    raDeg: 271.0725,
    decDeg: -24.3093,
    distancePc: 1336,
    distanceUpPc: 76,
    distanceDownPc: 68,
    distanceMethod: 'Gaia parallaxes of NGC 6530, its cluster',
    reference: KUHN,
    note: null,
    sizeArcmin: [48.7, 48.7],
    sizeReference: `${WISE}: G006.100-01.263, and its bright core G005.987-01.191`,
    shapeReference: null,
    modelled: CLOUD_MODEL,
    parts: region(1459.64, 0.3, [
      // The bright core round Herschel 36 and 9 Sgr: WISE G005.987-01.191, r 7.2', 8.5' to the west.
      part({ form: 'cloud', semiAxesArcmin: [7.16, 7.16, 7.16], offsetArcmin: [-7.03, -3.78], oxygen: 0.45, light: 1.4 }),
    ]),
  },
  {
    key: 'trifid',
    name: 'Trifid Nebula',
    otherNames: ['M20', 'NGC 6514', 'Sh2-30'],
    kind: 'star-forming',
    // WISE G007.015-00.271.
    raDeg: 270.6218,
    decDeg: -23.0248,
    distancePc: 1264,
    distanceUpPc: 76,
    distanceDownPc: 68,
    distanceMethod: 'Gaia parallaxes of its cluster',
    reference: KUHN,
    note: 'Its blue reflection nebula to the north, starlight on dust, is not drawn.',
    sizeArcmin: [18.3, 18.3],
    sizeReference: `${WISE}: G007.015-00.271`,
    shapeReference: null,
    modelled: CLOUD_MODEL,
    parts: region(550.44, 0.25),
  },
  {
    key: 'eagle',
    name: 'Eagle Nebula',
    otherNames: ['M16', 'NGC 6611', 'IC 4703', 'Sh2-49', 'Pillars of Creation'],
    kind: 'star-forming',
    // WISE G016.993+00.873.
    raDeg: 274.6461,
    decDeg: -13.7342,
    distancePc: 1740,
    distanceUpPc: 130,
    distanceDownPc: 120,
    distanceMethod: 'Gaia parallaxes of NGC 6611, its cluster',
    reference: KUHN,
    note: 'Its pillars are not drawn as such: the clumps are a model.',
    sizeArcmin: [37.5, 37.5],
    sizeReference: `${WISE}: G016.993+00.873`,
    shapeReference: null,
    modelled: CLOUD_MODEL,
    parts: region(1124.43, 0.3),
  },
  {
    key: 'omega',
    name: 'Omega Nebula',
    otherNames: ['M17', 'NGC 6618', 'Swan Nebula', 'Sh2-45'],
    kind: 'star-forming',
    // WISE G015.097-00.729.
    raDeg: 275.1818,
    decDeg: -16.1616,
    distancePc: 1680,
    distanceUpPc: 130,
    distanceDownPc: 110,
    distanceMethod: 'Gaia parallaxes of its cluster',
    reference: KUHN,
    note: 'Maser parallaxes give 1.98 kpc (Xu et al. 2011).',
    sizeArcmin: [39.1, 39.1],
    sizeReference: `${WISE}: G015.097-00.729`,
    shapeReference: null,
    modelled: CLOUD_MODEL,
    parts: region(1172.26, 0.35),
  },
  {
    key: 'carina',
    name: 'Carina Nebula',
    otherNames: ['NGC 3372', 'Eta Carinae Nebula', 'Caldwell 92'],
    kind: 'star-forming',
    // WISE G287.524-00.735.
    raDeg: 161.0395,
    decDeg: -59.7433,
    distancePc: 2350,
    distanceUpPc: 50,
    distanceDownPc: 50,
    distanceMethod: 'Gaia EDR3 parallaxes of its OB and X-ray young stars',
    reference: 'Göppl & Preibisch 2022, A&A 660, A11',
    note: 'Gaia DR2 gave 2.6 kpc (Kuhn et al. 2019); EDR3 agrees with 2.35 kpc (Shull et al. 2021).',
    sizeArcmin: [76.1, 76.1],
    sizeReference: `${WISE}: G287.524-00.735`,
    shapeReference: null,
    modelled: CLOUD_MODEL,
    parts: region(2283.37, 0.45),
  },
  {
    key: 'rosette',
    name: 'Rosette Nebula',
    otherNames: ['NGC 2237', 'NGC 2238', 'NGC 2239', 'NGC 2246', 'Sh2-275', 'Caldwell 49'],
    kind: 'star-forming',
    // WISE G206.316-02.103.
    raDeg: 97.9567,
    decDeg: 4.9186,
    distancePc: 1560,
    distanceUpPc: 110,
    distanceDownPc: 90,
    distanceMethod: 'Gaia parallaxes of its stars (NGC 2244 at 1550 pc)',
    reference: KUHN,
    note: null,
    sizeArcmin: [104.5, 104.5],
    sizeReference: `${WISE}: G206.316-02.103`,
    shapeReference: null,
    modelled: 'its cavity’s size (from photographs), its depth, its clumps, the [O III] share',
    parts: [
      // A thick shell round a cavity the winds of NGC 2244 cleared.
      part({ form: 'shell', semiAxesArcmin: [37, 37, 37], width: 0.55, oxygen: 0.3 }),
      part({ form: 'cloud', semiAxesArcmin: [52.2, 52.2, 52.2], light: 0.15, oxygen: 0.1 }),
    ],
  },
  {
    key: 'horsehead',
    name: 'Horsehead Nebula',
    otherNames: ['Barnard 33', 'B33', 'IC 434'],
    kind: 'star-forming',
    raDeg: hms(5, 40, 59.0),
    decDeg: dms(-1, 2, 27, 30),
    distancePc: 387.5,
    distanceUpPc: 1.3,
    distanceDownPc: 1.3,
    distanceMethod: 'σ Orionis’s, the star whose light IC 434 is: its interferometric orbit',
    reference: 'Schaefer et al. 2016, AJ 152, 213',
    note: 'A young star in its head has a Gaia DR2 parallax of 422 ± 17 pc.',
    sizeArcmin: [60, 10],
    sizeReference: 'estimated from photographs',
    shapeReference: null,
    modelled: 'all of it: IC 434’s glow and the dark pillar, sizes and shapes from photographs',
    parts: [
      // IC 434: the ionised edge of the Orion B cloud, a band running north-south, lit from the west by σ Ori.
      part({ form: 'cloud', semiAxesArcmin: [30, 6, 6], paDeg: 0, offsetArcmin: [-3, 0], light: 1 }),
      // The cloud itself, east of the edge, dark.
      part({ form: 'dust', semiAxesArcmin: [40, 18, 12], offsetArcmin: [17, 0], light: 3 }),
      // The pillar, the horse's head, standing out of it to the west, in front of the glow.
      part({ form: 'dust', semiAxesArcmin: [3, 2, 2], paDeg: 90, offsetArcmin: [-0.5, 0], light: 6 }),
    ],
  },
  {
    key: 'tarantula',
    name: 'Tarantula Nebula',
    otherNames: ['30 Doradus', '30 Dor', 'NGC 2070', 'Caldwell 103'],
    kind: 'star-forming',
    // R136, its central cluster.
    raDeg: hms(5, 38, 42.4),
    decDeg: dms(-1, 69, 6, 3),
    distancePc: 49590,
    distanceUpPc: 540,
    distanceDownPc: 540,
    distanceMethod: 'the Large Magellanic Cloud’s, from eclipsing binaries',
    reference: 'Pietrzyński et al. 2019, Nature 567, 200',
    note: null,
    sizeArcmin: [40, 25],
    sizeReference: 'estimated from photographs',
    shapeReference: null,
    modelled: 'its size and shape, from photographs; its depth, clumps and [O III] share',
    parts: [
      part({ form: 'cloud', semiAxesArcmin: [20, 12.5, 15], oxygen: 0.45, light: 0.4 }),
      part({ form: 'cloud', semiAxesArcmin: [7, 7, 7], oxygen: 0.55, light: 1.3 }),
    ],
  },
  // --- Planetary nebulae --------------------------------------------------------------------
  {
    key: 'ring',
    name: 'Ring Nebula',
    otherNames: ['M57', 'NGC 6720'],
    kind: 'planetary',
    // Its central star, Gaia DR3 2090486618786534784.
    raDeg: 283.39625,
    decDeg: 33.02915,
    ...fromParallax(1.2696, 0.0438),
    distanceMethod: 'its central star’s Gaia DR3 parallax, zero-point corrected',
    reference: 'Gaia DR3 2090486618786534784',
    note: null,
    sizeArcmin: [1.47, 1.0],
    sizeReference: "O'Dell et al. 2013, AJ 145, 92",
    shapeReference: "O'Dell et al. 2013, AJ 145, 92",
    modelled: 'which end of its axis is nearer, its knots, the [O III] share',
    parts: [
      // The main ring: a triaxial ellipsoid 44" x 30" x 59", its long axis at PA 60, its pole 13.5 deg from us.
      part({ form: 'shell', semiAxesArcmin: [44 / 60, 30 / 60, 59 / 60], paDeg: 60, tiltDeg: 13.5, width: 0.3, equator: 4, oxygen: 0.55 }),
      // The outer halo, 115" in radius, seen in [N II].
      part({ form: 'shell', semiAxesArcmin: [115 / 60, 115 / 60, 115 / 60], width: 0.3, light: 0.06 }),
    ],
  },
  {
    key: 'helix',
    name: 'Helix Nebula',
    otherNames: ['NGC 7293', 'Caldwell 63'],
    kind: 'planetary',
    // Its central star, Gaia DR3 6628874205642084224.
    raDeg: 337.41079,
    decDeg: -20.83717,
    ...fromParallax(5.0124, 0.0437),
    distanceMethod: 'its central star’s Gaia DR3 parallax, zero-point corrected',
    reference: 'Gaia DR3 6628874205642084224',
    note: 'HST’s parallax gave 219 pc (Benedict et al. 2009).',
    sizeArcmin: [12.4, 12.4],
    sizeReference: "O'Dell, McCullough & Meixner 2004, AJ 128, 2339",
    shapeReference: "O'Dell, McCullough & Meixner 2004, AJ 128, 2339; O'Dell 2005",
    modelled: 'its line of nodes (taken across the near side), its cometary knots, the [O III] share',
    parts: [
      // The inner disk, 499" x 459", tilted 28 deg, its north-west side nearer.
      part({ form: 'ring', semiAxesArcmin: [249.5 / 60, 249.5 / 60, 249.5 / 60], paDeg: 45, tiltDeg: 28, width: 0.45, oxygen: 0.45 }),
      // The innermost ring, about 200" across, in [O III] only.
      part({ form: 'cloud', semiAxesArcmin: [100 / 60, 100 / 60, 100 / 60], paDeg: 45, tiltDeg: 28, light: 0.25, oxygen: 1 }),
      // The outer torus, 742" across, tilted 53 deg, its south-east side nearer: nearly perpendicular to the disk.
      part({ form: 'ring', semiAxesArcmin: [371 / 60, 371 / 60, 371 / 60], paDeg: 45, tiltDeg: -53, width: 0.25, light: 0.45, oxygen: 0.1 }),
    ],
  },
  {
    key: 'dumbbell',
    name: 'Dumbbell Nebula',
    otherNames: ['M27', 'NGC 6853', 'Apple Core Nebula'],
    kind: 'planetary',
    // Its central star, Gaia DR3 1827256624493300096.
    raDeg: 299.90156,
    decDeg: 22.72121,
    ...fromParallax(2.57, 0.0373),
    distanceMethod: 'its central star’s Gaia DR3 parallax, zero-point corrected',
    reference: 'Gaia DR3 1827256624493300096',
    note: null,
    sizeArcmin: [8, 5],
    sizeReference: 'Meaburn et al. 2005, MNRAS 360, 963',
    shapeReference: 'Meaburn et al. 2005, MNRAS 360, 963',
    modelled: 'its depth (as its minor axis), its bright waist as a ring, the [O III] share',
    parts: [
      // A barrel 8' x 5', its long axis at PA 125 in the sky's plane; its bright waist the equator, seen edge on.
      part({ form: 'shell', semiAxesArcmin: [2.5, 2.5, 4], paDeg: 35, tiltDeg: 90, width: 0.35, equator: 3, oxygen: 0.45 }),
      // Its faint halo, 15' across.
      part({ form: 'cloud', semiAxesArcmin: [7.5, 7.5, 7.5], light: 0.05 }),
    ],
  },
  {
    key: 'cats-eye',
    name: 'Cat’s Eye Nebula',
    otherNames: ['NGC 6543', 'Caldwell 6'],
    kind: 'planetary',
    // Its central star, Gaia DR3 1633325248915154176.
    raDeg: 269.63918,
    decDeg: 66.63296,
    ...fromParallax(0.7321, 0.0287),
    distanceMethod: 'its central star’s Gaia DR3 parallax, zero-point corrected',
    reference: 'Gaia DR3 1633325248915154176',
    note: 'Its expansion parallax gave 1.0 ± 0.27 kpc (Reed et al. 1999).',
    sizeArcmin: [0.41, 0.35],
    sizeReference: 'Reed et al. 1999, AJ 118, 2430',
    shapeReference: 'Reed et al. 1999, AJ 118, 2430',
    modelled: 'its tilt (about 30°, the paper’s drawing), the outer bubbles’ shape, the halo, the [O III] share',
    parts: [
      // The inner bubble, 16.1" x 7.2" on the sky along PA 25: 18.1" long, foreshortened by its tilt.
      part({ form: 'shell', semiAxesArcmin: [3.6 / 60, 3.6 / 60, 9.06 / 60], paDeg: 115, tiltDeg: 60, width: 0.3, oxygen: 0.6 }),
      // The conjoined outer bubbles, their caps 21.2" apart on the sky.
      part({ form: 'shell', semiAxesArcmin: [9 / 60, 9 / 60, 11.08 / 60], paDeg: 115, tiltDeg: 60, width: 0.3, light: 0.5, oxygen: 0.3 }),
      // The halo, about ten times the outer shell's radius (Clairmont et al. 2022).
      part({ form: 'cloud', semiAxesArcmin: [2, 2, 2], light: 0.03 }),
    ],
  },
  {
    key: 'southern-ring',
    name: 'Southern Ring Nebula',
    otherNames: ['NGC 3132', 'Eight-Burst Nebula', 'Caldwell 74'],
    kind: 'planetary',
    // Its central star's bright companion, Gaia DR3 5420219732228461184.
    raDeg: 151.75731,
    decDeg: -40.43643,
    ...fromParallax(1.3198, 0.0344),
    distanceMethod: 'the Gaia DR3 parallax of its central star’s bright companion, zero-point corrected',
    reference: 'Gaia DR3 5420219732228461184',
    note: 'Gaia flags the star as a likely binary (RUWE 1.8).',
    sizeArcmin: [1.4, 0.9],
    sizeReference: 'estimated from photographs',
    shapeReference: 'Monteiro et al. 2000, MNRAS 311, 764',
    modelled: 'its size, the position angle of its axis, the [O III] share',
    parts: [
      // A diabolo: its axis 40 deg from the line of sight, long enough to span 1.4' foreshortened; its
      // PA on the sky is not given, drawn north-south.
      part({ form: 'shell', semiAxesArcmin: [0.45, 0.45, 0.95], paDeg: 90, tiltDeg: 40, width: 0.3, equator: 2.5, oxygen: 0.5 }),
    ],
  },
];

const ARCMIN = Math.PI / 180 / 60;

/** A nebula's radius, km: half its major axis on the sky, at its distance -- the unit its model is drawn in. */
export function nebulaRadiusKm(nebula: Nebula): number {
  return Math.tan((nebula.sizeArcmin[0] / 2) * ARCMIN) * nebula.distancePc * PARSEC_KM;
}

/** Where a nebula is about the Sun, km: its centre at its distance, standing still. */
export function nebulaState(nebula: Nebula): StateVector {
  const state = astrometricState({
    raDeg: nebula.raDeg,
    decDeg: nebula.decDeg,
    parallaxMas: 1000 / nebula.distancePc,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  });
  return { position: state.position, velocity: { x: 0, y: 0, z: 0 } };
}

/** Its sky frame in the scene: east, north, and away from Earth. */
export function nebulaFrame(nebula: Nebula): { east: Vec3; north: Vec3; away: Vec3 } {
  const at = nebulaState(nebula).position;
  const n = Math.hypot(at.x, at.y, at.z);
  return skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
}

/**
 * A part's axes e1, e2, e3 in the scene frame (see NebulaPart), and its centre's offset from the
 * nebula's in nebula radii.
 */
export function partAxes(nebula: Nebula, p: NebulaPart): { e1: Vec3; e2: Vec3; e3: Vec3; offset: Vec3 } {
  const { east, north, away } = nebulaFrame(nebula);
  const rad = Math.PI / 180;
  const pa = p.paDeg * rad;
  const tilt = p.tiltDeg * rad;
  const toward = { x: -away.x, y: -away.y, z: -away.z };
  const comb = (a: Vec3, ka: number, b: Vec3, kb: number): Vec3 => ({ x: a.x * ka + b.x * kb, y: a.y * ka + b.y * kb, z: a.z * ka + b.z * kb });
  // On the sky: e1 at PA (from north toward east); v at PA + 90.
  const e1 = comb(north, Math.cos(pa), east, Math.sin(pa));
  const v = comb(north, -Math.sin(pa), east, Math.cos(pa));
  const e2 = comb(v, Math.cos(tilt), toward, -Math.sin(tilt));
  const e3 = comb(v, Math.sin(tilt), toward, Math.cos(tilt));
  const unit = nebula.sizeArcmin[0] / 2;
  const offset = comb(east, p.offsetArcmin[0] / unit, north, p.offsetArcmin[1] / unit);
  return { e1, e2, e3, offset };
}

/** How far the drawn volume reaches from the centre, in nebula radii: its farthest part's edge, and room for a shell's width. */
export function nebulaReach(nebula: Nebula): number {
  const unit = nebula.sizeArcmin[0] / 2;
  let reach = 1;
  for (const p of nebula.parts) {
    if (p.form === 'dust') continue;
    const longest = Math.max(...p.semiAxesArcmin) / unit;
    const off = Math.hypot(p.offsetArcmin[0], p.offsetArcmin[1]) / unit;
    reach = Math.max(reach, off + longest * (1 + (p.form === 'cloud' ? 0 : p.width)));
  }
  return reach * 1.02;
}

export function nebulaBodyId(nebula: Nebula): BodyId {
  return `nebula-${nebula.key}`;
}

export function nebulaOf(id: BodyId | null): Nebula | null {
  return NEBULAE.find((nebula) => nebulaBodyId(nebula) === id) ?? null;
}

/** The colours of their marks: hydrogen's red for a star-forming region, [O III]'s teal for a planetary nebula. */
export const NEBULA_COLOR: Record<NebulaKind, string> = { 'star-forming': '#e8786a', planetary: '#6fd3c8' };

export function nebulaKindLabel(kind: NebulaKind): string {
  return kind === 'planetary' ? 'Planetary nebula' : 'Star-forming region';
}

/** Earth's view of a nebula: from the Sun's side, looking out, north up -- its photographs' view. */
export function nebulaEarthView(nebula: Nebula): { direction: [number, number, number]; up: [number, number, number] } {
  const { north, away } = nebulaFrame(nebula);
  return { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] };
}

/** The framing a nebula asks for when focused: Earth's view, from four of its radii. */
export function nebulaFraming(id: BodyId): FramingRequest | null {
  const nebula = nebulaOf(id);
  return nebula === null ? null : { km: 4 * nebulaRadiusKm(nebula), view: nebulaEarthView(nebula) };
}

function nebulaDefinition(nebula: Nebula): BodyDefinition {
  // A place, not a surface: three-eighths of its radius, as a remnant's (supernovaRemnants.ts).
  const radius = (3 / 8) * nebulaRadiusKm(nebula);
  return {
    id: nebulaBodyId(nebula),
    name: nebula.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'nebula',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: NEBULA_COLOR[nebula.kind],
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** Makes the nebulae bodies, at start (App.tsx): named on the sky, found by search and by their other names, gone to. */
export function ensureNebulae(store: EphemerisStore): void {
  for (const nebula of NEBULAE) {
    registerDeepSky(nebulaBodyId(nebula), { label: nebulaKindLabel(nebula.kind), aliases: nebula.otherNames });
  }
  const missing = NEBULAE.filter((nebula) => !store.isPropagatedBody(nebulaBodyId(nebula)));
  if (missing.length === 0) {
    return;
  }
  store.addPropagatedBodies(
    missing.map((nebula) => {
      const state = nebulaState(nebula);
      return { body: nebulaDefinition(nebula), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}
