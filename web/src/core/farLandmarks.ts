import type { RecordHolder } from './recordHolders.ts';

/**
 * The large quasar groups and the deep fields: far places with a name, made bodies as the
 * record-holders are (recordHolders.ts registers them, by the same machinery: a mark, a name, a
 * panel, the search, the Observable Universe layer) but not counted among them -- none holds a
 * record. scene/FarLandmarks.tsx draws what a mark cannot say: a group's extent, a field's beam.
 *
 * ## Where each is
 *
 * As a record-holder: on the sky at its position, out at the comoving distance of its redshift in
 * Planck 2018 (cosmology.ts).
 *
 * - **A large quasar group** at the mean place and the mean redshift of its member quasars, as
 *   its paper's table lists them (worked out here: the papers give no centroid; Clowes et al.
 *   2012's two centroids, so taken, are 1.97 degrees apart, as the paper says). Its extent as the
 *   paper gives it, comoving in H0 70, Omega_m 0.27 -- a few percent smaller than Planck's H0
 *   67.66 would make it, and drawn so: a ring of its characteristic size, the cube root of the
 *   volume its members' convex hull of spheres takes. A ring, not its shape: the members are not
 *   in the app as members, so the shape is not drawn.
 * - **A deep field** at its centre on the sky, at the redshift of the farthest galaxy confirmed
 *   by a spectrum inside it: how deep a field is, measured. Drawn as a beam from the Sun out to
 *   there, as wide as the field is on the sky -- so, at 30 billion light years, a few hundred
 *   thousand light years across for Hubble's, and hundreds of millions for COSMOS-Web's.
 *
 * Checked against each paper's text and tables (and the ESA/Hubble and ESA/Webb image pages)
 * on 2026-11-16.
 */

export type FarExtent =
  | {
      readonly kind: 'group';
      /** The paper's characteristic size, the cube root of its volume, and its longest dimension, Mpc, comoving in H0 70, Omega_m 0.27. */
      readonly characteristicMpc: number;
      readonly longestMpc: number;
      readonly members: number;
    }
  | {
      readonly kind: 'field';
      /** Its area on the sky, square arcminutes. */
      readonly areaArcmin2: number;
    };

export interface FarLandmark extends RecordHolder {
  readonly extent: FarExtent;
}

const CLOWES_2012 = 'Clowes et al. 2012, MNRAS 419, 556';
const CLOWES_2013 = 'Clowes et al. 2013, MNRAS 429, 2910';
const NADATHUR =
  'Nadathur 2013 (MNRAS 434, 398) finds groupings as large in random catalogues of the same density, and the quasars homogeneous above 130 h⁻¹ Mpc: a claim, not a structure.';

export const FAR_LANDMARKS: readonly FarLandmark[] = [
  {
    key: 'huge-lqg',
    name: 'Huge-LQG',
    otherNames: ['U1.27', 'Huge Large Quasar Group', 'Huge LQG'],
    kind: 'quasar-group',
    record: 'Largest structure claimed, 2013',
    z: 1.27,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'The mean of its 73 quasars’ SDSS DR7 redshifts (1.174–1.371), linked within 100 Mpc',
    raDeg: 164.138,
    decDeg: 14.121,
    position: 'the mean of its members’ (Clowes et al. 2013, Table 1)',
    reference: `${CLOWES_2013}; ${'Nadathur 2013, MNRAS 434, 398'}`,
    note: `About 500 Mpc across (the cube root of its volume), 1,240 Mpc along its longest axis. ${NADATHUR}`,
    extent: { kind: 'group', characteristicMpc: 495, longestMpc: 1240, members: 73 },
  },
  {
    key: 'clowes-campusano-lqg',
    name: 'Clowes–Campusano LQG',
    otherNames: ['Clowes-Campusano LQG', 'CCLQG', 'U1.28'],
    kind: 'quasar-group',
    record: 'Among the largest structures known, 1991',
    z: 1.28,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'The mean of its 34 quasars’ SDSS DR7 redshifts (1.187–1.423); first found as ten or more by Clowes & Campusano 1991',
    raDeg: 162.293,
    decDeg: 5.286,
    position: 'the mean of its members’ (Clowes et al. 2012, Table 1)',
    reference: `Clowes & Campusano 1991, MNRAS 249, 218; ${CLOWES_2012}`,
    note: `About 350 Mpc across, 630 Mpc along its longest axis; the Huge-LQG lies 8.8° north of it. ${NADATHUR}`,
    extent: { kind: 'group', characteristicMpc: 350, longestMpc: 630, members: 34 },
  },
  {
    key: 'u1-11',
    name: 'U1.11',
    otherNames: ['U1.11 LQG'],
    kind: 'quasar-group',
    record: 'A large quasar group beside the CCLQG',
    z: 1.11,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'The mean of its 38 quasars’ SDSS DR7 redshifts (1.004–1.201), linked within 100 Mpc',
    raDeg: 161.558,
    decDeg: 3.453,
    position: 'the mean of its members’ (Clowes et al. 2012, Table 2)',
    reference: CLOWES_2012,
    note: `About 380 Mpc across, 780 Mpc along its longest axis; 2° on the sky and about 410 Mpc from the CCLQG. ${NADATHUR}`,
    extent: { kind: 'group', characteristicMpc: 380, longestMpc: 780, members: 38 },
  },
  {
    key: 'hubble-ultra-deep-field',
    name: 'Hubble Ultra Deep Field',
    otherNames: ['HUDF', 'UDF', 'Ultra Deep Field'],
    kind: 'deep-field',
    record: 'Hubble’s deepest view, 2004',
    z: 13.2,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its farthest galaxy with a spectrum: JADES-GS-z13-0, JWST NIRSpec’s Lyman break (Curtis-Lake et al. 2023)',
    raDeg: 53.1625,
    decDeg: -27.79142,
    position: 'Beckwith et al. 2006, Table 1',
    reference: 'Beckwith et al. 2006, AJ 132, 1729; Curtis-Lake et al. 2023, Nat. Astron. 7, 622',
    note: '11 arcmin², 400 orbits of ACS, September 2003 to January 2004. Its z ≈ 10 candidate UDFj-39546284 is JADES-GS-z11-0, z 11.58. Drawn to its farthest galaxy, not past it.',
    extent: { kind: 'field', areaArcmin2: 11 },
  },
  {
    key: 'jades-goods-s',
    name: 'JADES (GOODS-S)',
    otherNames: ['JADES', 'JWST Advanced Deep Extragalactic Survey', 'GOODS-S'],
    kind: 'deep-field',
    record: 'Webb’s deepest survey, 2022–',
    z: 14.1796,
    zPlus: 0.0007,
    zMinus: 0.0007,
    spectroscopic: true,
    how: 'Its farthest galaxy with a spectrum: JADES-GS-z14-0, ALMA’s [O III] 88 µm line',
    raDeg: 53.1227811,
    decDeg: -27.8051605,
    position: 'the JADES DR5 GOODS-S mosaic’s centre (Johnson et al. 2026); the survey defines none',
    reference: 'Eisenstein et al. 2023 (arXiv 2306.02465); Johnson et al. 2026 (arXiv 2601.15954); Carniani et al. 2024, Nature 633, 318',
    note: '245 arcmin² of GOODS-S in at least one NIRCam filter (151 in all eight of JADES’s), the Hubble Ultra Deep Field inside it.',
    extent: { kind: 'field', areaArcmin2: 245 },
  },
  {
    key: 'cosmos-web',
    name: 'COSMOS-Web',
    otherNames: ['COSMOS', 'COSMOS-Web field'],
    kind: 'deep-field',
    record: 'Webb’s widest survey, 0.54 square degrees',
    z: 14.44,
    zPlus: 0.02,
    zMinus: 0.02,
    spectroscopic: true,
    how: 'Its farthest galaxy with a spectrum: MoM-z14, JWST NIRSpec’s ultraviolet lines',
    raDeg: 150.11633,
    decDeg: 2.20097,
    position: 'Casey et al. 2023, Sect. 2',
    reference: 'Casey et al. 2023, ApJ 954, 31; Naidu et al. 2026, Open J. Astrophys. 9 (arXiv 2505.11263)',
    note: '0.54 deg² of NIRCam, 41.5′ by 46.6′, 255 hours (GO 1727), 2023–2024. MoM-z14 lies 4.5′ from its centre.',
    extent: { kind: 'field', areaArcmin2: 1928 },
  },
  {
    key: 'smacs-0723',
    name: 'SMACS 0723',
    otherNames: ['Webb’s First Deep Field', 'Webb First Deep Field', 'SMACS J0723.3-7327'],
    kind: 'deep-field',
    record: 'Webb’s First Deep Field, 2022',
    z: 8.498,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its farthest galaxy with a spectrum: 4590, JWST NIRSpec (Carnall et al. 2023), magnified ten times by the cluster',
    raDeg: 110.78567,
    decDeg: -73.44977,
    position: 'ESA/Webb weic2209a, the released image’s centre',
    reference: 'Pontoppidan et al. 2022, ApJL 936, L14; Carnall et al. 2023, MNRAS 518, L45',
    note: 'Through the cluster SMACS J0723.3-7327 at z 0.39, whose mass magnifies what is behind it. The released image 2.3′ across; 12.5 hours of NIRCam, 7 June 2022.',
    extent: { kind: 'field', areaArcmin2: 5.2 },
  },
];

/** A field's half-width on the sky, radians, as a disc of its area. */
export function fieldHalfAngle(areaArcmin2: number): number {
  return Math.sqrt(areaArcmin2 / Math.PI) * (Math.PI / 180 / 60);
}

/** Planck 2018's H0 over the groups' papers' 70: the extent of a group is a little larger at Planck's. */
export const GROUP_SIZE_TO_PLANCK = 70 / 67.66;
