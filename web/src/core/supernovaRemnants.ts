import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { skyAxes } from './exoplanets.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector, Vec3 } from './vec3.ts';

/**
 * Supernova remnants (D6e): the famous ones, each at the distance its paper measures and
 * of the size Green's catalogue gives it -- a ring of its real radius at its real place, and
 * a place to go.
 *
 * **Only these nine, for now.** Green's catalogue (2024 October version,
 * https://www.mrao.cam.ac.uk/surveys/snrs/) lists 310 Galactic remnants with their positions
 * and sizes, and no distances: a remnant's distance is measured case by case, and most are
 * rough. The one compilation of them, Ranasinghe & Leahy 2023 (ApJS 265, 53), is served only
 * by CDS VizieR, down on 2026-11-03; it can be added when it is back (Maxi chose the famous
 * ones first). Each of these nine has a distance from a measurement of its own, given below
 * with its paper.
 *
 * ## From Green
 *
 * Each one's centre (J2000, to the arcminute), its angular size (the major and minor axes
 * where it is not round), its type -- S a shell, F filled-centre (a pulsar wind nebula), C a
 * composite of the two -- and its names.
 *
 * ## Drawn
 *
 * As a ring of its mean radius -- half the mean of Green's two axes, at its distance --
 * always turned to the camera: a mark of its size, not its look. A remnant is filaments of
 * glowing gas, an ellipse at most, and the position angle of an elongated one is not in the
 * catalogue. The ring is red, the red of hydrogen's H-alpha light, which most of their
 * optical filaments shine in. It does not move: the shell's expansion and the motion of its
 * centre through the Galaxy are not drawn.
 */

export interface SupernovaRemnant {
  readonly key: string;
  /** What it is called. */
  readonly name: string;
  /** Green's designation, Galactic l and b: "G184.6-5.8". */
  readonly green: string;
  readonly otherNames: readonly string[];
  /** Green's centre, J2000, degrees. */
  readonly raDeg: number;
  readonly decDeg: number;
  /** Green's size, arcminutes: major and minor axes (equal for a round one). */
  readonly sizeArcmin: readonly [number, number];
  readonly type: 'S' | 'F' | 'C';
  /** The supernova's year where it was seen, AD; null where it was not. */
  readonly seenYear: number | null;
  /** Its distance, pc, the uncertainty either way (null where the paper gives none), and whose. */
  readonly distancePc: number;
  readonly distanceUpPc: number | null;
  readonly distanceDownPc: number | null;
  readonly distanceMethod: string;
  readonly reference: string;
  /** Anything said about the distance beyond the number: a disputed one says so. */
  readonly note: string | null;
  /** What its visible light is (RemnantEmission), with the paper that says so. */
  readonly emission: RemnantEmission;
  readonly emissionReference: string;
  /**
   * Where its elongation is measured in 3D: the axis it is stretched along, as a position angle
   * on the sky (east of north) and its angle from the line of sight towards us. Null where it is
   * not -- Green gives two axes but not which way the long one points, so those are spheres.
   */
  readonly axis: RemnantAxis | null;
  /** Its photograph, prepared as a map of its light on the sky (scene/remnantMap.ts); null where none is. */
  readonly map: RemnantMap | null;
}

/**
 * A photograph of a remnant made a map of its light: reprojected north up, east left, centred
 * on Green's centre, its stars and sky background taken out (web/public/remnants/CREDITS.md).
 */
export interface RemnantMap {
  /** The file in web/public/remnants/. */
  readonly file: string;
  /** Half its width (and height), arcminutes. */
  readonly halfArcmin: number;
  /** How far from the centre its light reaches before it is faded out, arcminutes. */
  readonly reachArcmin: number;
  /**
   * A pulsar wind nebula's synchrotron share: a grey map of how much of each pixel its colour
   * (linear RGB, strongest channel 1, the photograph's own) accounts for. Null for a shell.
   */
  readonly continuum: { readonly file: string; readonly colour: readonly [number, number, number] } | null;
  /**
   * Whose colour it is drawn in: the photograph's own, or -- a grey map, of a picture in light
   * the eye does not see (X-rays, near-infrared) -- the colour of the remnant's visible lines
   * (RemnantEmission), the picture giving only where the light is and how much.
   */
  readonly colour: 'photograph' | 'lines';
  /** Where its light is in depth, where that is measured (RemnantPoints); null where it is modelled. */
  readonly points: RemnantPoints | null;
  /** What light it shows, the credit its source asks for, the licence and the page. */
  readonly light: string;
  readonly credit: string;
  readonly licence: string;
  readonly source: string;
}

/**
 * A remnant's gas mapped in 3D: points on its surfaces, in its sky frame -- east, north, away
 * from Earth -- arcminutes from Green's centre, as little-endian 16-bit integers of 1/4096
 * arcminute, three to a point (web/public/remnants/CREDITS.md).
 */
export interface RemnantPoints {
  readonly file: string;
  /** How its depth was measured. */
  readonly method: string;
  readonly reference: string;
  readonly credit: string;
  readonly licence: string;
  readonly source: string;
}

export interface RemnantAxis {
  readonly paDeg: number;
  readonly fromSightDeg: number;
  readonly reference: string;
}

/**
 * What a remnant's visible light comes from, which sets the colour its gas is drawn in
 * (scene/remnantVolume.ts):
 *
 * - **balmer**: a fast shock into neutral gas, too fast to cool behind it -- thin filaments in
 *   hydrogen's Balmer lines alone, H-alpha and H-beta;
 * - **radiative**: an older, slower shock that cools behind it -- hydrogen's lines with
 *   sulphur's, nitrogen's and doubly ionised oxygen's beside them;
 * - **oxygen-rich**: the star's own ejecta, oxygen and sulphur with almost no hydrogen;
 * - **pulsar-wind**: a pulsar's wind nebula, synchrotron light from its whole volume, inside a
 *   cage of filaments.
 */
export type RemnantEmission = 'balmer' | 'radiative' | 'oxygen-rich' | 'pulsar-wind';

const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dm = (sign: 1 | -1, d: number, m: number): number => sign * (d + m / 60);

export const SUPERNOVA_REMNANTS: readonly SupernovaRemnant[] = [
  {
    key: 'crab',
    name: 'Crab Nebula',
    green: 'G184.6-5.8',
    otherNames: ['M1', '3C 144', 'SN 1054'],
    raDeg: hms(5, 34, 31),
    decDeg: dm(1, 22, 1),
    sizeArcmin: [7, 5],
    type: 'F',
    seenYear: 1054,
    // As its pulsar is placed (pulsars.json: the ATNF catalogue's DIST_A, the same paper).
    distancePc: 2000,
    distanceUpPc: null,
    distanceDownPc: null,
    distanceMethod: 'expansion of its filaments',
    reference: 'Trimble 1968, AJ 73, 535',
    note: null,
    emission: 'pulsar-wind',
    emissionReference: 'Hester 2008, ARA&A 46, 127',
    // Its pulsar's spin axis, from the X-ray ring round it: the nebula is stretched along it, as a
    // wind nebula's magnetic field pinches it (Begelman & Li 1992). The north-west end leans away
    // from us: the south-east jet is the bright, approaching one.
    axis: { paDeg: 298.4, fromSightDeg: 119.1, reference: 'Weisskopf 2013, PoS(INTEGRAL 2012)004' },
    map: {
      file: 'crab.png',
      halfArcmin: 4,
      reachArcmin: 4.83,
      continuum: { file: 'crab-continuum.png', colour: [0.0749, 0.8143, 1] },
      colour: 'photograph',
      points: null,
      light: 'visible, three filters (VLT FORS2)',
      credit: 'ESO',
      licence: 'CC BY 4.0',
      source: 'https://www.eso.org/public/images/eso9948f/',
    },
  },
  {
    key: 'cas-a',
    name: 'Cassiopeia A',
    green: 'G111.7-2.1',
    otherNames: ['Cas A', '3C 461'],
    raDeg: hms(23, 23, 26),
    decDeg: dm(1, 58, 48),
    sizeArcmin: [5, 5],
    type: 'S',
    seenYear: null,
    distancePc: 3400,
    distanceUpPc: 300,
    distanceDownPc: 100,
    distanceMethod: 'proper motions and radial velocities of its knots',
    reference: 'Reed et al. 1995, ApJ 440, 706',
    note: 'Light echoes give 3.6 ± 0.1 kpc (Neumann et al. 2024).',
    emission: 'oxygen-rich',
    emissionReference: 'Chevalier & Kirshner 1979, ApJ 233, 154',
    axis: null,
    map: {
      file: 'cas-a.png',
      halfArcmin: 3.6,
      reachArcmin: 4.03,
      continuum: null,
      colour: 'lines',
      points: {
        file: 'cas-a-points.bin',
        method: 'Doppler shifts of its ejecta, depth as velocity in free expansion',
        reference: 'DeLaney et al. 2010, ApJ 725, 2038',
        credit: 'Model: NASA/CXC/MIT/T. Delaney et al.',
        licence: 'no copyright asserted (Chandra image use policy)',
        source: 'https://chandra.harvard.edu/graphics/resources/illustrations/3d_files/CasA_supernova_remnant-ascii_vtks.zip',
      },
      light: 'red and near-infrared (Hubble ACS), where it shines and how much',
      credit:
        'NASA, ESA, and the Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration. Acknowledgement: Robert A. Fesen (Dartmouth College, USA) and James Long (ESA/Hubble)',
      licence: 'CC BY 4.0',
      source: 'https://esahubble.org/images/heic0609a/',
    },
  },
  {
    key: 'tycho',
    name: 'Tycho’s Supernova Remnant',
    green: 'G120.1+1.4',
    otherNames: ['Tycho', '3C 10', 'SN 1572'],
    raDeg: hms(0, 25, 18),
    decDeg: dm(1, 64, 9),
    sizeArcmin: [8, 8],
    type: 'S',
    seenYear: 1572,
    distancePc: 3200,
    distanceUpPc: 100,
    distanceDownPc: 200,
    distanceMethod: 'light echoes and 3D dust maps',
    reference: 'Neumann et al. 2024, arXiv 2407.14584',
    note: 'Disputed: measurements range from 1.7 to 4.5 kpc.',
    emission: 'balmer',
    emissionReference: 'Kirshner & Chevalier 1978, A&A 67, 267',
    axis: null,
    map: {
      file: 'tycho.png',
      halfArcmin: 5,
      reachArcmin: 5.29,
      continuum: null,
      colour: 'lines',
      points: null,
      light: 'X-rays, 4.1–6.1 keV (Chandra ACIS): its outer shock, where its Balmer filaments are',
      credit: 'NASA/CXC/Rutgers/J.Warren & J.Hughes et al.',
      licence: 'no copyright asserted (Chandra image use policy)',
      source: 'https://chandra.harvard.edu/photo/openFITS/xray_data.html',
    },
  },
  {
    key: 'kepler',
    name: 'Kepler’s Supernova Remnant',
    green: 'G4.5+6.8',
    otherNames: ['Kepler', '3C 358', 'SN 1604'],
    raDeg: hms(17, 30, 42),
    decDeg: dm(-1, 21, 29),
    sizeArcmin: [3, 3],
    type: 'S',
    seenYear: 1604,
    distancePc: 5100,
    distanceUpPc: 800,
    distanceDownPc: 700,
    distanceMethod: 'proper motions of its Balmer filaments and their shock speed',
    reference: 'Sankrit et al. 2016, ApJ 817, 36',
    note: null,
    emission: 'balmer',
    emissionReference: 'Blair, Long & Vancura 1991, ApJ 366, 484',
    axis: null,
    map: {
      file: 'kepler.png',
      halfArcmin: 2.4,
      reachArcmin: 2.42,
      continuum: null,
      colour: 'photograph',
      points: null,
      light: 'visible (Hubble WFPC2 and ACS)',
      credit: 'NASA, ESA, R. Sankrit and W. Blair (Johns Hopkins University)',
      licence: 'CC BY 4.0',
      source: 'https://esahubble.org/images/opo0429i/',
    },
  },
  {
    key: 'sn-1006',
    name: 'SN 1006',
    green: 'G327.6+14.6',
    otherNames: ['PKS 1459-41'],
    raDeg: hms(15, 2, 50),
    decDeg: dm(-1, 41, 56),
    sizeArcmin: [30, 30],
    type: 'S',
    seenYear: 1006,
    distancePc: 2170,
    distanceUpPc: 80,
    distanceDownPc: 80,
    distanceMethod: 'proper motions of its Balmer filaments and their shock speed',
    reference: 'Winkler, Gupta & Long 2003, ApJ 585, 324',
    note: null,
    emission: 'balmer',
    emissionReference: 'Ghavamian et al. 2002, ApJ 572, 888',
    axis: null,
    map: {
      file: 'sn-1006.png',
      halfArcmin: 16.8,
      reachArcmin: 18.75,
      continuum: null,
      colour: 'lines',
      points: null,
      light: 'X-rays (Chandra ACIS): its shock, where its Balmer filaments are',
      credit: 'NASA/CXC/Middlebury College/F.Winkler',
      licence: 'no copyright asserted (Chandra image use policy)',
      source: 'https://chandra.harvard.edu/photo/2013/sn1006/',
    },
  },
  {
    key: 'vela',
    name: 'Vela Supernova Remnant',
    green: 'G263.9-3.3',
    otherNames: ['Vela XYZ'],
    raDeg: hms(8, 34, 0),
    decDeg: dm(-1, 45, 50),
    sizeArcmin: [255, 255],
    type: 'C',
    seenYear: null,
    distancePc: 287,
    distanceUpPc: 19,
    distanceDownPc: 17,
    distanceMethod: 'the parallax of its pulsar',
    reference: 'Dodson et al. 2003, ApJ 596, 1137',
    note: null,
    emission: 'radiative',
    emissionReference: 'Fesen, Blair & Kirshner 1985, ApJ 292, 29',
    axis: null,
    map: {
      file: 'vela.png',
      halfArcmin: 150,
      reachArcmin: 161,
      continuum: null,
      colour: 'lines',
      points: null,
      light: 'H-alpha, its stars subtracted (SHASSA)',
      credit: 'the Southern H-Alpha Sky Survey Atlas (SHASSA), which is supported by the National Science Foundation',
      licence: '© Las Cumbres Observatory: free for scientific and educational use, not commercial',
      source: 'https://amundsen.swarthmore.edu/SHASSA/ack.html',
    },
  },
  {
    key: 'cygnus-loop',
    name: 'Cygnus Loop',
    green: 'G74.0-8.5',
    otherNames: ['Veil Nebula'],
    raDeg: hms(20, 51, 0),
    decDeg: dm(1, 30, 40),
    sizeArcmin: [230, 160],
    type: 'S',
    seenYear: null,
    distancePc: 725,
    distanceUpPc: 15,
    distanceDownPc: 15,
    distanceMethod: 'Gaia parallaxes of stars inside and behind it',
    reference: 'Fesen et al. 2021, arXiv 2109.05368',
    note: 'Questioned since: one of its two stars is a binary, and other work favours about 890 pc.',
    emission: 'radiative',
    emissionReference: 'Fesen, Blair & Kirshner 1985, ApJ 292, 29',
    axis: null,
    map: {
      file: 'cygnus-loop.png',
      halfArcmin: 135,
      reachArcmin: 147.2,
      continuum: null,
      colour: 'photograph',
      points: null,
      light: 'red and blue photographic plates (POSS-II)',
      credit: 'Digitized Sky Survey 2 (STScI); Second Palomar Observatory Sky Survey (Caltech)',
      licence: 'acknowledgement asked (STScI); plates © Caltech/Palomar, AAO, ROE (copyright summary)',
      source: 'https://archive.stsci.edu/dss/acknowledging.html',
    },
  },
  {
    key: 'puppis-a',
    name: 'Puppis A',
    green: 'G260.4-3.4',
    otherNames: ['MSH 08-44'],
    raDeg: hms(8, 22, 10),
    decDeg: dm(-1, 43, 0),
    sizeArcmin: [60, 50],
    type: 'S',
    seenYear: null,
    distancePc: 1300,
    distanceUpPc: 300,
    distanceDownPc: 300,
    distanceMethod: 'its systemic velocity in HI (kinematic)',
    reference: 'Reynoso, Cichowolski & Walsh 2017, MNRAS 464, 3029',
    note: null,
    emission: 'radiative',
    emissionReference: 'Fesen, Blair & Kirshner 1985, ApJ 292, 29',
    axis: null,
    map: {
      file: 'puppis-a.png',
      halfArcmin: 40,
      reachArcmin: 42.55,
      continuum: null,
      colour: 'lines',
      points: null,
      light: 'X-rays (Chandra ACIS and XMM-Newton EPIC): its shock, where its optical filaments are',
      credit: 'X-ray: NASA/CXC/IAFE/G.Dubner et al & ESA/XMM-Newton',
      licence: 'Chandra: no copyright asserted; the XMM-Newton part ESA’s',
      source: 'https://chandra.harvard.edu/photo/2014/puppisa/',
    },
  },
  {
    key: 'ic-443',
    name: 'IC 443',
    green: 'G189.1+3.0',
    otherNames: ['Jellyfish Nebula', '3C 157'],
    raDeg: hms(6, 17, 0),
    decDeg: dm(1, 22, 34),
    sizeArcmin: [45, 45],
    type: 'C',
    seenYear: null,
    distancePc: 1729,
    distanceUpPc: 116,
    distanceDownPc: 94,
    distanceMethod: 'the jump in dust extinction it makes (3D dust map)',
    reference: 'Yu et al. 2019, arXiv 1907.04326',
    note: 'Often quoted at 1.5 kpc, the distance of the Gem OB1 association.',
    emission: 'radiative',
    emissionReference: 'Fesen, Blair & Kirshner 1985, ApJ 292, 29',
    axis: null,
    map: {
      file: 'ic-443.png',
      halfArcmin: 37.5,
      reachArcmin: 34.5,
      continuum: null,
      colour: 'photograph',
      points: null,
      light: 'red (POSS-II) and blue (POSS-I) photographic plates',
      credit: 'Digitized Sky Survey (STScI); Palomar Observatory Sky Surveys I and II (Caltech)',
      licence: 'acknowledgement asked (STScI); plates © Caltech/Palomar, AAO, ROE (copyright summary)',
      source: 'https://archive.stsci.edu/dss/acknowledging.html',
    },
  },
];

const ARCMIN = Math.PI / 180 / 60;

/** A remnant's mean radius, km: half the mean of Green's axes, at its distance. */
export function remnantRadiusKm(remnant: SupernovaRemnant): number {
  const meanArcmin = (remnant.sizeArcmin[0] + remnant.sizeArcmin[1]) / 2;
  return Math.tan((meanArcmin / 2) * ARCMIN) * remnant.distancePc * PARSEC_KM;
}

/**
 * A remnant's shape where its axis is measured: a spheroid stretched along that axis, its two
 * semi-axes in its mean radii, chosen so that seen from Earth -- the axis foreshortened by its
 * angle to the line of sight -- it is Green's major by minor axis. Null for a sphere.
 */
export function remnantShape(
  remnant: SupernovaRemnant,
): { readonly axis: Vec3; readonly along: number; readonly across: number } | null {
  if (remnant.axis === null) {
    return null;
  }
  const rad = Math.PI / 180;
  const at = remnantState(remnant).position;
  const n = Math.hypot(at.x, at.y, at.z);
  const { east, north, away } = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
  const pa = remnant.axis.paDeg * rad;
  const tilt = remnant.axis.fromSightDeg * rad;
  // On the sky, PA east of north; then tilted from the line of sight towards us (-away).
  const sky = (k: 'x' | 'y' | 'z') => Math.cos(pa) * north[k] + Math.sin(pa) * east[k];
  const axis = {
    x: Math.cos(tilt) * -away.x + Math.sin(tilt) * sky('x'),
    y: Math.cos(tilt) * -away.y + Math.sin(tilt) * sky('y'),
    z: Math.cos(tilt) * -away.z + Math.sin(tilt) * sky('z'),
  };
  // Seen at angle i to its axis, a spheroid's outline has semi-axes b and sqrt(a^2 sin^2 i + b^2 cos^2 i).
  const [major, minor] = remnant.sizeArcmin;
  const mean = (major + minor) / 2;
  const sinI = Math.sin(tilt);
  const cosI = Math.cos(tilt);
  const across = minor / mean;
  const along = Math.sqrt(((major / mean) ** 2 - across ** 2 * cosI * cosI) / (sinI * sinI));
  return { axis, along, across };
}

/**
 * Earth's view of a remnant: the camera on the Sun's side of it, looking out along the line of
 * sight, north up -- the view its photographs show, from which the camera can go round it.
 */
export function remnantEarthView(remnant: SupernovaRemnant): {
  direction: [number, number, number];
  up: [number, number, number];
} {
  const at = remnantState(remnant).position;
  const n = Math.hypot(at.x, at.y, at.z);
  const { north, away } = skyAxes({ x: at.x / n, y: at.y / n, z: at.z / n });
  return { direction: [-away.x, -away.y, -away.z], up: [north.x, north.y, north.z] };
}

export function remnantBodyId(remnant: SupernovaRemnant): BodyId {
  return `snr-${remnant.key}`;
}

export function remnantOf(id: BodyId | null): SupernovaRemnant | null {
  return SUPERNOVA_REMNANTS.find((remnant) => remnantBodyId(remnant) === id) ?? null;
}

/** Where a remnant is about the Sun, km: its centre at its distance, standing still. */
export function remnantState(remnant: SupernovaRemnant): StateVector {
  const state = astrometricState({
    raDeg: remnant.raDeg,
    decDeg: remnant.decDeg,
    parallaxMas: 1000 / remnant.distancePc,
    pmRaMasPerYear: 0,
    pmDecMasPerYear: 0,
    radialVelocityKmS: 0,
  });
  return { position: state.position, velocity: { x: 0, y: 0, z: 0 } };
}

/** The colour of its ring: H-alpha's red. */
export const REMNANT_COLOR = '#e8786a';

function remnantDefinition(remnant: SupernovaRemnant): BodyDefinition {
  // A place, not a surface, and this is no size of its: three-eighths of its radius, so the
  // camera, framing a body at eight of these, comes to stand three of its radii out with the
  // ring whole; and the nearest it may come to the centre.
  const radius = (3 / 8) * remnantRadiusKm(remnant);
  return {
    id: remnantBodyId(remnant),
    name: remnant.name,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent: null,
    kind: 'supernova-remnant',
    radiusEquatorialKm: radius,
    radiusPolarKm: radius,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: REMNANT_COLOR,
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

/** Makes the remnants bodies, at start (App.tsx): named on the sky, found by search, gone to. */
export function ensureSupernovaRemnants(store: EphemerisStore): void {
  const missing = SUPERNOVA_REMNANTS.filter((remnant) => !store.isPropagatedBody(remnantBodyId(remnant)));
  if (missing.length === 0) {
    return;
  }
  store.addPropagatedBodies(
    missing.map((remnant) => {
      const state = remnantState(remnant);
      return { body: remnantDefinition(remnant), elements: null, state: () => state, options: { exact: true } };
    }),
  );
}

