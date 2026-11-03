import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { astrometricState } from './alphaCentauri.ts';
import type { EphemerisStore } from './ephemerisStore.ts';
import { PARSEC_KM } from './stars3d.ts';
import type { StateVector } from './vec3.ts';

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
 *
 * And with a photograph of it, where a free one shows it (RemnantImage, web/public/remnants/
 * CREDITS.md): its look, as a telescope saw it from Earth, at its true size on the sky.
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
  /** A photograph of it, where one is free to use (see RemnantImage); null where none is. */
  readonly image: RemnantImage | null;
}

/**
 * A photograph of a remnant, drawn at its true angular size and orientation: the image's own
 * field of view and where north lies in it, as its source publishes them.
 */
export interface RemnantImage {
  /** The file in web/public/remnants/. */
  readonly file: string;
  /** Its field of view, arcminutes. */
  readonly widthArcmin: number;
  readonly heightArcmin: number;
  /**
   * Its centre, J2000, degrees: from the astrometry its source embeds in it (AVM), which is not
   * always the "Position" on its page -- that is the reference point, not the middle.
   */
  readonly centreRaDeg: number;
  readonly centreDecDeg: number;
  /** Where north is in it: degrees right of the image's vertical (0 for north up). East is left of north. */
  readonly northRightOfVerticalDeg: number;
  /** What it shows, in a few words: "visible light, HST WFPC2". */
  readonly light: string;
  /** The credit line its source asks for, and the licence. */
  readonly credit: string;
  readonly licence: string;
  /** The page it is from. */
  readonly source: string;
}

const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dm = (sign: 1 | -1, d: number, m: number): number => sign * (d + m / 60);
const dms = (sign: 1 | -1, d: number, m: number, s: number): number => sign * (d + m / 60 + s / 3600);

const CC_BY = 'CC BY 4.0';
// Chandra claims no copyright on its own images; the DSS stars in a composite are published
// by ESO and ESA/Hubble themselves under CC BY 4.0 (web/public/remnants/CREDITS.md).
const CHANDRA = 'NASA/CXC: no copyright claimed';

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
    image: {
      file: 'crab.jpg',
      widthArcmin: 6.41,
      heightArcmin: 6.41,
      centreRaDeg: hms(5, 34, 32.5),
      centreDecDeg: dms(1, 22, 0, 55),
      northRightOfVerticalDeg: 0,
      light: 'visible, [O III], [S II], [O I] lines; Hubble WFPC2',
      credit:
        'NASA, ESA and Allison Loll/Jeff Hester (Arizona State University). Acknowledgement: Davide De Martin (ESA/Hubble)',
      licence: CC_BY,
      source: 'https://esahubble.org/images/heic0515a/',
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
    image: {
      file: 'cas-a.jpg',
      widthArcmin: 8.55,
      heightArcmin: 6.15,
      centreRaDeg: hms(23, 23, 26.1),
      centreDecDeg: dms(1, 58, 48, 54),
      northRightOfVerticalDeg: -0.4,
      light: 'visible and near-infrared, broadband; Hubble ACS',
      credit:
        'NASA, ESA, and the Hubble Heritage (STScI/AURA)-ESA/Hubble Collaboration. Acknowledgement: Robert A. Fesen (Dartmouth College, USA) and James Long (ESA/Hubble)',
      licence: CC_BY,
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
    image: {
      file: 'tycho.jpg',
      widthArcmin: 19.04,
      heightArcmin: 15.04,
      centreRaDeg: hms(0, 25, 20.6),
      centreDecDeg: dms(1, 64, 8, 19),
      northRightOfVerticalDeg: -0.1,
      light: 'X-rays, false colour (Chandra), on the Digitized Sky Survey’s stars',
      credit: 'X-ray: NASA/CXC/Rutgers/K.Eriksen et al.; Optical: DSS',
      licence: CHANDRA,
      source: 'https://chandra.harvard.edu/photo/2011/tycho/',
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
    image: {
      file: 'kepler.jpg',
      widthArcmin: 12.16,
      heightArcmin: 8.13,
      centreRaDeg: hms(17, 30, 41.2),
      centreDecDeg: dms(-1, 21, 29, 34),
      northRightOfVerticalDeg: 0.2,
      light: 'X-rays, false colour (Chandra), on the Digitized Sky Survey’s stars',
      credit: 'X-ray: NASA/CXC/NCSU/M.Burkey et al; Optical: DSS',
      licence: CHANDRA,
      source: 'https://chandra.harvard.edu/photo/2013/kepler/',
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
    image: {
      file: 'sn-1006.jpg',
      widthArcmin: 55.54,
      heightArcmin: 55.54,
      centreRaDeg: hms(15, 2, 52.2),
      centreDecDeg: dms(-1, 41, 55, 30),
      northRightOfVerticalDeg: 0,
      light: 'radio (red), X-rays (blue), H-alpha (yellow), false colour; DSS stars',
      credit:
        'Radio: NRAO/AUI/NSF/GBT/VLA/Dyer, Maddalena & Cornwell, X-ray: Chandra X-ray Observatory; NASA/CXC/Rutgers/G. Cassam-Chenaï, J. Hughes et al., Visible light: 0.9-metre Curtis Schmidt optical telescope; NOAO/AURA/NSF/CTIO/Middlebury College/F. Winkler and Digitized Sky Survey.',
      licence: CC_BY,
      source: 'https://www.eso.org/public/images/eso1308b/',
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
    image: {
      file: 'vela.jpg',
      widthArcmin: 161.11,
      heightArcmin: 161.53,
      centreRaDeg: hms(8, 31, 19.0),
      centreDecDeg: dms(-1, 43, 55, 44),
      northRightOfVerticalDeg: -0.1,
      light: 'visible, [O III], H-alpha and [S II] lines; DECam. Its northern quarter only',
      credit:
        'CTIO/NOIRLab/DOE/NSF/AURA Image Processing: T.A. Rector (University of Alaska Anchorage/NSF NOIRLab), M. Zamani & D. de Martin (NSF NOIRLab)',
      licence: CC_BY,
      source: 'https://noirlab.edu/public/images/noirlab2406a/',
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
    image: {
      file: 'cygnus-loop.jpg',
      widthArcmin: 173.1,
      heightArcmin: 173.97,
      centreRaDeg: hms(20, 51, 38.4),
      centreDecDeg: dms(1, 31, 2, 15),
      northRightOfVerticalDeg: 0.6,
      light: 'visible, H-alpha, [S II] and [O III] lines; WIYN 0.9 m',
      credit: 'T.A. Rector (University of Alaska Anchorage) and WIYN/NOIRLab/NSF/AURA',
      licence: CC_BY,
      source: 'https://noirlab.edu/public/images/noao1209a/',
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
    image: {
      file: 'puppis-a.jpg',
      widthArcmin: 85.66,
      heightArcmin: 85.66,
      centreRaDeg: hms(8, 22, 13.5),
      centreDecDeg: dms(-1, 43, 0, 28),
      northRightOfVerticalDeg: 0,
      light: 'X-rays, false colour (Chandra and XMM-Newton)',
      credit: 'X-ray: NASA/CXC/IAFE/G.Dubner et al & ESA/XMM-Newton',
      licence: CHANDRA,
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
    image: {
      file: 'ic-443.jpg',
      widthArcmin: 121.16,
      heightArcmin: 78.84,
      centreRaDeg: hms(6, 17, 33.7),
      centreDecDeg: dms(1, 22, 54, 50),
      northRightOfVerticalDeg: 111.1,
      light: 'visible, broadband; Kitt Peak',
      credit: 'KPNO/NOIRLab/NSF/AURA/Tom Bash and John Fox/Adam Block',
      licence: CC_BY,
      source: 'https://noirlab.edu/public/images/noao-ic443block2/',
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
 * Where its photograph's centre lies from Green's, km at the remnant's distance, east and north
 * on the sky (the tangent plane at Green's centre): a picture centred off the remnant, as
 * Vela's northern quarter is, drawn where it shows.
 */
export function imageOffsetKm(remnant: SupernovaRemnant, image: RemnantImage): { east: number; north: number } {
  const rad = Math.PI / 180;
  const dRa = (image.centreRaDeg - remnant.raDeg) * rad;
  const dec0 = remnant.decDeg * rad;
  const dec = image.centreDecDeg * rad;
  const cosC = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(dRa);
  const km = remnant.distancePc * PARSEC_KM;
  return {
    east: ((Math.cos(dec) * Math.sin(dRa)) / cosC) * km,
    north: ((Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(dRa)) / cosC) * km,
  };
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

