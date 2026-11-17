import { CMB_DIPOLE, CMB_DIPOLE_AMPLITUDE_UK, CMB_DIPOLE_APEX, COLD_SPOT, galacticToEquatorial } from './cmbFrame.ts';
import { comovingDistanceMpc, PLANCK18, Z_LAST_SCATTERING } from './cosmology.ts';
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
 *
 * ## The protoclusters, the large structures, a supervoid, and the CMB's features
 *
 * Added 2026-11-17, each checked against its paper's text, tables or figures (and NED):
 *
 * - **Protoclusters**, clusters still forming, each at its paper's place and redshift: the
 *   Spiderweb about its radio galaxy, SPT2349-56 at its millimetre source, Hyperion at its most
 *   massive peak. A mark each; Hyperion, 60 x 60 x 150 comoving Mpc, a ring too.
 * - **Large structures**: the BOSS Great Wall, measured in galaxies' spectra; and four patterns
 *   whose reality is argued -- the Hercules-Corona Borealis Great Wall and the Giant GRB Ring in
 *   gamma-ray bursts, the Giant Arc and the Big Ring in Mg II absorbers. Each one's `record`
 *   says "[claim]" or "[disputed]", and its note who argues. A ring of the size its paper gives,
 *   rescaled to Planck's H0, where the paper gives a diameter; the Giant Arc and the HCB Great
 *   Wall, an arc and a patch of sky, a mark only.
 * - **The Eridanus Supervoid**, in front of the Cold Spot: a ring of its diameter. That it makes
 *   the Cold Spot is disputed, and its record says so.
 * - **The CMB's features**, on its wall, at the last-scattering distance: the Cold Spot a circle
 *   of its core about where the map is coldest (cmbFrame.ts COLD_SPOT, farLandmarks.test.ts);
 *   the dipole's hot pole, the way the Sun moves against the CMB, a beam from the Sun to it.
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
    }
  | {
      readonly kind: 'span';
      /** The diameter drawn, Mpc comoving at Planck 2018's H0: its paper's, rescaled (each entry says from what). */
      readonly diameterMpc: number;
    }
  | {
      /** A region on the CMB's wall: a circle of this radius on the sky. */
      readonly kind: 'sky-disc';
      readonly radiusDeg: number;
    }
  | {
      /** A way to go: a beam from the Sun out to it. */
      readonly kind: 'direction';
    }
  | {
      /** Nothing past its mark: too small to see from here, or its shape not given. */
      readonly kind: 'mark';
    };

export interface FarLandmark extends RecordHolder {
  readonly extent: FarExtent;
}

const CLOWES_2012 = 'Clowes et al. 2012, MNRAS 419, 556';
const CLOWES_2013 = 'Clowes et al. 2013, MNRAS 429, 2910';
const NADATHUR =
  'Nadathur 2013 (MNRAS 434, 398) finds groupings as large in random catalogues of the same density, and the quasars homogeneous above 130 h⁻¹ Mpc: a claim, not a structure.';

/** Lengths in h^-1 Mpc, and in Mpc at H0 70, at Planck 2018's H0. */
const PER_LITTLE_H = 100 / PLANCK18.h0;
const H70 = 70 / PLANCK18.h0;

/**
 * The Giant GRB Ring's nine bursts, galactic l and b (Balazs et al. 2015, Table 3): marked at
 * their mean direction, as a large quasar group is at its members' mean.
 */
export const GRB_RING_BURSTS: readonly (readonly [number, number])[] = [
  [149.05, -42.52],
  [114.45, -17.2],
  [118.43, -42.96],
  [123.46, -39.99],
  [150.37, -28.43],
  [106.53, -41.28],
  [101.39, -32.53],
  [123.85, -12.65],
  [142.92, -20.54],
];

function meanGalactic(points: readonly (readonly [number, number])[]): { raDeg: number; decDeg: number } {
  let x = 0;
  let y = 0;
  let z = 0;
  for (const [l, b] of points) {
    const { raDeg, decDeg } = galacticToEquatorial(l, b);
    const ra = (raDeg * Math.PI) / 180;
    const dec = (decDeg * Math.PI) / 180;
    x += Math.cos(dec) * Math.cos(ra);
    y += Math.cos(dec) * Math.sin(ra);
    z += Math.sin(dec);
  }
  const ra = (Math.atan2(y, x) * 180) / Math.PI;
  return { raDeg: (ra + 360) % 360, decDeg: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI };
}

const GRB_RING_CENTRE = meanGalactic(GRB_RING_BURSTS);

/** The ring's 1,720 Mpc is comoving at the paper's distance to it, 2,770 Mpc: rescaled to Planck's distance at its z. */
const GRB_RING_TO_PLANCK = comovingDistanceMpc(0.822) / 2770;

/** Hyperion's 60 x 60 x 150 comoving Mpc at H0 70: the cube root of its volume. */
const HYPERION_SIZE_MPC = Math.cbrt(60 * 60 * 150);

const BY_CHANCE = 'Such patterns arise by chance in random catalogues of the same density';

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
  {
    key: 'spiderweb',
    name: 'Spiderweb Protocluster',
    otherNames: ['Spiderweb', 'Spiderweb Galaxy', 'MRC 1138-262', 'PKS 1138-262'],
    kind: 'protocluster',
    record: 'A cluster forming about a radio galaxy',
    z: 2.1585,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Its radio galaxy’s emission lines (NED)',
    raDeg: 175.20145,
    decDeg: -26.48573,
    position: 'NED, the radio galaxy’s',
    reference: 'Miley et al. 2006, ApJL 650, L29; NED',
    note: 'The Spiderweb Galaxy at its heart is a dozen galaxies merging in a halo of glowing gas: a cluster’s central galaxy being built. A mark: its few Mpc are under a pixel from here.',
    extent: { kind: 'mark' },
  },
  {
    key: 'spt2349-56',
    name: 'SPT2349-56',
    otherNames: ['SPT2349−56', 'SPT 2349-56'],
    kind: 'protocluster',
    record: 'Fourteen starburst galaxies within 130 kpc, merging',
    z: 4.304,
    zPlus: 0.002,
    zMinus: 0.0019,
    spectroscopic: true,
    how: 'ALMA, its galaxies’ [C II] 158 µm and CO lines: their mean',
    raDeg: 357.427917,
    decDeg: -56.639833,
    position: 'Miller et al. 2018, its brighter millimetre source',
    reference: 'Miller et al. 2018, Nature 556, 469',
    note: 'Found by the South Pole Telescope as one bright millimetre source; ALMA split it into at least 14 gas-rich galaxies about to merge. A mark.',
    extent: { kind: 'mark' },
  },
  {
    key: 'hyperion',
    name: 'Hyperion',
    otherNames: ['Hyperion proto-supercluster', 'Hyperion protocluster'],
    kind: 'protocluster',
    record: 'A proto-supercluster: seven clusters forming',
    z: 2.45,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'VUDS and zCOSMOS spectra: its seven peaks at z 2.423–2.507',
    raDeg: 150.0937,
    decDeg: 2.4049,
    position: 'its most massive peak’s barycentre (Cucciati et al. 2018, Table 1)',
    reference: 'Cucciati et al. 2018, A&A 619, A49',
    note: 'About 60 × 60 × 150 comoving Mpc at H0 70, 4.8 × 10¹⁵ M☉ in all, its peaks joined by filaments, in the COSMOS field. A ring of the cube root of its volume.',
    extent: { kind: 'span', diameterMpc: HYPERION_SIZE_MPC * H70 },
  },
  {
    key: 'boss-great-wall',
    name: 'BOSS Great Wall',
    otherNames: ['BGW'],
    kind: 'large-structure',
    record: 'Among the largest supercluster systems known',
    z: 0.47,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'BOSS DR12 spectra: its 830 galaxies’ mean',
    raDeg: 162,
    decDeg: 50,
    position: 'the middle of its galaxies on the sky, read off Lietzen et al. 2016, Fig. 3: about',
    reference: 'Lietzen et al. 2016, A&A 588, L4',
    note: '271 h⁻¹ Mpc across (400 Mpc at Planck’s H0): two walls, 186 and 173 h⁻¹ Mpc, and two superclusters; about 2.4 × 10¹⁷ h⁻¹ M☉. A ring of its diameter.',
    extent: { kind: 'span', diameterMpc: 271 * PER_LITTLE_H },
  },
  {
    key: 'hercules-corona-borealis-great-wall',
    name: 'Hercules–Corona Borealis Great Wall',
    otherNames: ['Hercules-Corona Borealis Great Wall', 'HCB Great Wall', 'Her–CrB GW', 'HCB'],
    kind: 'large-structure',
    record: 'Largest structure claimed: a clump of gamma-ray bursts [claim]',
    z: 1.85,
    zPlus: 0.25,
    zMinus: 0.25,
    spectroscopic: true,
    how: 'Its bursts’ redshifts: 14 of the 31 with z 1.6–2.1 in an eighth of the sky',
    raDeg: 255,
    decDeg: 28,
    position: 'not given by its papers, which name Hercules and Corona Borealis: marked there, roughly',
    reference: 'Horváth et al. 2014, A&A 561, L12; 2015, A&A 584, A48; Christian 2020, MNRAS 495, 4291',
    note: '2,000–3,000 Mpc across, if real. Christian 2020 finds isotropic skies make such clumps easily, and an updated sample less significant: doubtful at best. A mark: a patch of sky, its shape not given.',
    extent: { kind: 'mark' },
  },
  {
    key: 'giant-grb-ring',
    name: 'Giant GRB Ring',
    otherNames: ['GRB Ring', 'Giant Gamma-Ray Burst Ring'],
    kind: 'large-structure',
    record: 'A ring of nine gamma-ray bursts, 1,720 Mpc across [claim]',
    z: 0.822,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'The mean of its nine bursts’ redshifts (0.785–0.859)',
    raDeg: GRB_RING_CENTRE.raDeg,
    decDeg: GRB_RING_CENTRE.decDeg,
    position: 'the mean of its nine bursts’ (Balázs et al. 2015, Table 3)',
    reference: 'Balázs et al. 2015, MNRAS 452, 2236',
    note: `A chance of 2 × 10⁻⁶ of being a fluctuation, by its authors’ test; nine points are few, and nothing else is known to trace it. ${BY_CHANCE} is the question for every such pattern. A ring of its diameter.`,
    extent: { kind: 'span', diameterMpc: 1720 * GRB_RING_TO_PLANCK },
  },
  {
    key: 'giant-arc',
    name: 'Giant Arc',
    otherNames: ['Giant Arc on the Sky'],
    kind: 'large-structure',
    record: 'An arc of Mg II absorbers 1 Gpc long [disputed]',
    z: 0.802,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Mg II absorption lines in background quasars’ spectra: the slice 0.802 ± 0.060',
    raDeg: 215.40778,
    decDeg: 38.36376,
    position: 'the SZ cluster at its middle, PSZ2 G069.39+68.05 (NED: WHL J142137.9+382150)',
    reference: 'Lopez, Clowes & Williger 2022, MNRAS 516, 1557; Sawala & Teeriaho 2025, Open J. Astrophys. (arXiv 2505.11072)',
    note: `About 1 Gpc long (comoving at H0 70) and 340 Mpc deep. ${BY_CHANCE}, found with the same algorithm (Sawala & Teeriaho 2025): disputed. A mark: an arc, not a ring.`,
    extent: { kind: 'mark' },
  },
  {
    key: 'big-ring',
    name: 'Big Ring',
    otherNames: ['Big Ring on the Sky'],
    kind: 'large-structure',
    record: 'A ring of Mg II absorbers 400 Mpc across [disputed]',
    z: 0.802,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Mg II absorption lines in background quasars’ spectra: the slice 0.802 ± 0.060',
    raDeg: 215,
    decDeg: 50,
    position: 'the middle of its absorbers on the sky, read off Lopez et al. 2024, Fig. 2: about',
    reference: 'Lopez, Clowes & Williger 2024, JCAP 07, 055',
    note: '300–400 Mpc across (comoving at H0 70), 12° north of the Giant Arc at the same redshift, found by the same method -- which is disputed (Sawala & Teeriaho 2025). A ring of 400 Mpc.',
    extent: { kind: 'span', diameterMpc: 400 * H70 },
  },
  {
    key: 'eridanus-supervoid',
    name: 'Eridanus Supervoid',
    otherNames: ['Cold Spot Supervoid', 'Eridanus Void'],
    kind: 'void',
    record: 'A supervoid toward the CMB Cold Spot; that it makes it is [disputed]',
    z: 0.22,
    zPlus: 0.03,
    zMinus: 0.03,
    spectroscopic: false,
    how: 'Photometric: Pan-STARRS1 colours of WISE–2MASS galaxies',
    raDeg: COLD_SPOT.raDeg,
    decDeg: COLD_SPOT.decDeg,
    position: 'the Cold Spot’s centre, as fitted (Szapudi et al. 2015)',
    reference: 'Szapudi et al. 2015, MNRAS 450, 288; Mackenzie et al. 2017, MNRAS 470, 2328',
    note: 'A radius of 220 ± 50 h⁻¹ Mpc (325 Mpc at Planck’s H0), 14 % emptier than average. Spectra (Mackenzie et al. 2017) find smaller voids at z 0.14, 0.26 and 0.30 instead, too shallow to make the Cold Spot. A ring of its diameter.',
    extent: { kind: 'span', diameterMpc: 2 * 220 * PER_LITTLE_H },
  },
  {
    key: 'cmb-cold-spot',
    name: 'CMB Cold Spot',
    otherNames: ['Cold Spot', 'WMAP Cold Spot'],
    kind: 'cmb-feature',
    record: 'The CMB’s most unusual cold patch',
    z: Z_LAST_SCATTERING,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: 'Planck’s 2018 map; found in WMAP’s with wavelets (Vielva et al. 2004)',
    raDeg: COLD_SPOT.raDeg,
    decDeg: COLD_SPOT.decDeg,
    position: 'Cruz et al. 2007: galactic l 209°, b −57°',
    reference: 'Vielva et al. 2004, ApJ 609, 22; Cruz et al. 2007, ApJ 655, 11; Mackenzie et al. 2017, MNRAS 470, 2328',
    note: 'Colder over its size than a Gaussian sky makes likely. Why is open: chance, the Eridanus Supervoid in front (disputed), or something primordial. Drawn as a circle 5° in radius about it, on the wall.',
    extent: { kind: 'sky-disc', radiusDeg: COLD_SPOT.radiusDeg },
  },
  {
    key: 'cmb-dipole',
    name: 'CMB Dipole',
    otherNames: ['CMB dipole apex', 'Sun’s motion against the CMB', 'Dipole apex'],
    kind: 'cmb-feature',
    record: `The Sun moves ${CMB_DIPOLE.speedKmS} km/s this way, against the CMB`,
    z: Z_LAST_SCATTERING,
    zPlus: null,
    zMinus: null,
    spectroscopic: true,
    how: `Planck 2018: the CMB ${(CMB_DIPOLE_AMPLITUDE_UK / 1000).toFixed(2)} mK hotter this way than the other`,
    raDeg: CMB_DIPOLE_APEX.raDeg,
    decDeg: CMB_DIPOLE_APEX.decDeg,
    position: `galactic l ${CMB_DIPOLE.lDeg}°, b ${CMB_DIPOLE.bDeg}° (Planck Collaboration 2020)`,
    reference: 'Planck Collaboration 2020, A&A 641, A1; Secrest et al. 2021, ApJL 908, L51',
    note: 'Its hot pole, in Crater; the beam from the Sun is the way the Sun goes. The quasars’ own dipole is about twice what this motion predicts (Secrest et al. 2021): open.',
    extent: { kind: 'direction' },
  },
];

/**
 * A landmark's ring radius, pc, `distancePc` from the Sun; null where none is drawn: a quasar
 * group's characteristic size and a span's diameter at Planck's H0, a region of the CMB its
 * angle at the wall's distance.
 */
export function farRingRadiusPc(landmark: FarLandmark, distancePc: number): number | null {
  const extent = landmark.extent;
  switch (extent.kind) {
    case 'group':
      return 0.5e6 * extent.characteristicMpc * GROUP_SIZE_TO_PLANCK;
    case 'span':
      return 0.5e6 * extent.diameterMpc;
    case 'sky-disc':
      return distancePc * Math.tan((extent.radiusDeg * Math.PI) / 180);
    default:
      return null;
  }
}

/** Whether it is drawn as a beam from the Sun: a deep field, or a direction. */
export function isBeam(landmark: FarLandmark): boolean {
  return landmark.extent.kind === 'field' || landmark.extent.kind === 'direction';
}

/** A field's half-width on the sky, radians, as a disc of its area. */
export function fieldHalfAngle(areaArcmin2: number): number {
  return Math.sqrt(areaArcmin2 / Math.PI) * (Math.PI / 180 / 60);
}

/** Planck 2018's H0 over the groups' papers' 70: the extent of a group is a little larger at Planck's. */
export const GROUP_SIZE_TO_PLANCK = 70 / 67.66;
