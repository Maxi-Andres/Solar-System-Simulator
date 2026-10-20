import { SMALL_BODY_TOLERANCE_KM } from './config.ts';
import type {
  BodyDefinition,
  BodyKind,
  RotationalElements,
  ShapeModel,
  TextureVariant,
} from './types.ts';

/**
 * The named small bodies about the Sun, step B1a: the dwarf planets beside Pluto, the
 * largest asteroids, and the ones spacecraft in this catalog have visited or are flying
 * to. Phase B's belt of hundreds of thousands, drawn from orbital elements, comes later;
 * these few are drawn the way the planets are, from JPL's own state vectors.
 *
 * **Why these.** Each is here for a reason the app can show: Ceres and Vesta for Dawn,
 * Bennu for OSIRIS-REx, Ryugu for Hayabusa2, Didymos for DART and Hera (arriving December
 * 2026), Arrokoth for New Horizons, Dinkinesh, Donaldjohanson and Eurybates for Lucy,
 * Psyche for Psyche (2029), Apophis for its 2029 pass inside the geostationary ring and
 * for OSIRIS-APEX; Pallas as the third largest; Eris, Makemake and Haumea as the other
 * dwarf planets the IAU names.
 *
 * **Sampling.** Adaptive, to a kilometre everywhere (SMALL_BODY_TOLERANCE_KM), over the
 * planets' full window, and shipped in chunks fetched when wanted, as a spacecraft's
 * table is. The step below is only where the refinement starts.
 *
 * **Shape.** Drawn only where it can be drawn honestly. Ceres and Vesta have their IAU
 * rotation and radii in NAIF's pck00011.tpc, the same source as the moons'; Eris and
 * Makemake are round to within their measurements. The irregular ones a spacecraft has
 * visited are drawn from their mission team's own shape model (`shape`, step B1b),
 * turned by the PCK of the very frame that model is published in -- never by a rotation
 * from elsewhere, which would put every hill somewhere else. Each says where it comes
 * from below, and web/public/shapes/CREDITS.md what may be done with it. The rest are a
 * marker (`shapeDrawn: false`) whose measured dimensions the info panel gives: no shape
 * model has been released for Dinkinesh, and Haumea, Pallas, 16 Psyche, Eurybates and
 * Apophis have none from close up.
 *
 * **Rotation sense.** A negative period is retrograde, as for the planets: the spin pole
 * more than 90 degrees from the orbit's. Computed here from each published pole and the
 * body's SBDB orbit, and checked against the obliquities the papers give -- Bennu 177.5
 * (published 178), Ryugu 171.6 (171.6), Vesta 27.5, Arrokoth 99.3 (98). Where no pole is
 * published -- Eris, Makemake -- the period is given unsigned, which claims nothing.
 *
 * **Sources**, per value below. JPL's Small-Body Database (SBDB, ssd-api.jpl.nasa.gov,
 * read 2026-10-16) carries most of them and names the paper each comes from; the rest
 * are cited where they are used. A GM of zero means unmeasured, as for the small moons.
 */

/** What differs from one small body to the next. */
interface SmallBodySpec {
  readonly id: string;
  readonly name: string;
  /** Horizons COMMAND: the number and a semicolon, which selects the small body. */
  readonly horizonsId: string;
  readonly kind: Extract<BodyKind, 'dwarf-planet' | 'asteroid'>;
  /** Where the adaptive sampling starts; it refines from there. */
  readonly stepDays: number;
  /**
   * Radii, km: `[a, b, c]` long axis first, or one mean radius for a body whose shape
   * was never measured -- only its brightness, or a single occultation chord.
   */
  readonly radiiKm: readonly [number, number, number] | number;
  readonly gmKm3S2: number;
  readonly rotationPeriodHours: number | null;
  readonly rotation: RotationalElements | null;
  /** False where the shape cannot be drawn yet; see the header. */
  readonly shapeDrawn: boolean;
  readonly color: string;
  /**
   * The surface map, or null for a body drawn without one. One map serves both sets, as
   * for the moons: nothing here has an illustrative map and a calibrated one to choose
   * between. Only Ceres and Vesta have one -- Dawn's global mosaics -- and they are the
   * only bodies here with the IAU rotation a map needs to be turned the right way. See
   * the note above each.
   */
  readonly map: TextureVariant | null;
  /** The mission team's shape model, drawn instead of the radii; see the header. */
  readonly shape?: ShapeModel;
}

/**
 * IAU-form rotation: constant pole, prime meridian and rate, from pck00011.tpc or the
 * mission's own PCK -- plus, for Bennu, the quadratic term YORP's spin-up puts in W.
 */
function iauRotation(
  poleRaDeg: number,
  poleDecDeg: number,
  primeMeridianDeg: number,
  rotationRateDegPerDay: number,
  primeMeridianAccelDegPerDay2 = 0,
): RotationalElements {
  return {
    poleRaDeg,
    poleDecDeg,
    poleRaRateDegPerCentury: 0,
    poleDecRateDegPerCentury: 0,
    primeMeridianDeg,
    rotationRateDegPerDay,
    primeMeridianAccelDegPerDay2,
    periodicTerms: [],
  };
}

function smallBody(spec: SmallBodySpec): BodyDefinition {
  const [a, b, c] =
    typeof spec.radiiKm === 'number' ? [spec.radiiKm, spec.radiiKm, spec.radiiKm] : spec.radiiKm;
  return {
    id: spec.id,
    name: spec.name,
    horizonsId: spec.horizonsId,
    stepDays: spec.stepDays,
    vectorWindow: 'full',
    center: '500@0',
    // An ellipse wants the Sun at its focus, as the planets' do.
    elementsCenter: '500@10',
    parent: null,
    kind: spec.kind,
    radiusEquatorialKm: a,
    radiusPolarKm: c,
    // Three radii only when the equator itself is not round, as for the moons.
    triaxialRadiiKm: a === b ? null : [a, b, c],
    gmKm3S2: spec.gmKm3S2,
    gmBodyOnlyKm3S2: spec.gmKm3S2,
    rotationPeriodHours: spec.rotationPeriodHours,
    axialTiltDeg: null,
    rotation: spec.rotation,
    color: spec.color,
    drawOrbit: true,
    textures: spec.map === null ? null : { illustrative: spec.map, photometric: spec.map },
    rings: null,
    mission: null,
    sampling: { toleranceKm: SMALL_BODY_TOLERANCE_KM, windowMonths: null },
    ...(spec.shapeDrawn ? {} : { shapeDrawn: false }),
    ...(spec.shape === undefined ? {} : { shapeModel: spec.shape }),
  };
}

/** Dwarf planets first, then asteroids, each outward from the Sun. */
export const SMALL_BODIES: readonly BodyDefinition[] = [
  // Ceres. Radii and rotation: pck00011 (IAU 2015). GM: Park et al., Nature 537, 515
  // (2016), via SBDB.
  smallBody({
    id: 'ceres',
    name: 'Ceres',
    horizonsId: '1;',
    kind: 'dwarf-planet',
    stepDays: 4,
    radiiKm: [487.3, 487.3, 446],
    gmKm3S2: 62.6284,
    rotationPeriodHours: (360 / 952.1532) * 24,
    rotation: iauRotation(291.418, 66.764, 170.65, 952.1532),
    shapeDrawn: true,
    color: '#8f8a83',
    // Dawn's HAMO clear-filter global mosaic (DLR, PDS CE_HAMO_G_00N_180E_EQU_CLR), "in
    // the IAU-approved Kait longitude system": the tiny crater Kait at 0 E, which is what
    // the W0 of 170.65 above was fitted to hold (Dawn's Ceres coordinate document,
    // CERES_COORD_SYS_180628). Centred on 180 E, so its left edge is longitude 0.
    // Dawn's final solution moved W0 to 170.309 with a rate 0.0000635 deg/day faster; the
    // two agree on where Kait is to 0.3 degrees in 2026, under two texels of this map.
    // Occator's faculae land on the Gazetteer's 19.7 N, 239.6 E: textureAlignment.test.ts.
    map: { file: 'ceres.jpg', longitudeOriginDeg: 0 },
  }),
  // Haumea. Semi-axes 1161 x 852 x 513 km: Ortiz et al., Nature 550, 219 (2017),
  // doi:10.1038/nature24051, which also gives its pole (the ring's) and uses the period
  // 3.915341 h. GM from the mass, 4.006e21 kg, of Ragozzine & Brown, AJ 137, 4766 (2009),
  // times G (derived). No rotational phase is published, so its long axis cannot be
  // turned to where it is: a marker.
  smallBody({
    id: 'haumea',
    name: 'Haumea',
    horizonsId: '136108;',
    kind: 'dwarf-planet',
    stepDays: 32,
    radiiKm: [1161, 852, 513],
    gmKm3S2: 267.4,
    rotationPeriodHours: 3.915341,
    rotation: null,
    shapeDrawn: false,
    color: '#d6d6d6',
    map: null,
  }),
  // Makemake. 1434 x 1422 km across the projected disc, +-14 km each: Brown, ApJL 767, L7
  // (2013), reanalysing the 2011 occultation (Ortiz et al., Nature 491, 566, 2012). The
  // two agree within their errors, so it is drawn round, at their mean (derived). Period:
  // 22.8266 h, Hromakina et al., A&A 625, A46 (2019). GM: unpublished -- its moon's orbit
  // is only preliminary (Bamberger 2025, arXiv:2509.05880).
  smallBody({
    id: 'makemake',
    name: 'Makemake',
    horizonsId: '136472;',
    kind: 'dwarf-planet',
    stepDays: 32,
    radiiKm: 714,
    gmKm3S2: 0,
    rotationPeriodHours: 22.8266,
    rotation: null,
    shapeDrawn: true,
    color: '#c9a98a',
    map: null,
  }),
  // Eris. Radius 1163 +- 6 km, and the occultation fits a sphere: Sicardy et al., Nature
  // 478, 493 (2011), doi:10.1038/nature10550. GM 1099 km^3/s^2 for Eris and Dysnomia
  // together, from Dysnomia's orbit: Holler et al., Icarus 355, 114130 (2021) -- the
  // system's, Dysnomia's own share being unmeasured. Period 15.771 d, locked to Dysnomia:
  // Bernstein et al., PSJ 4, 115 (2023).
  smallBody({
    id: 'eris',
    name: 'Eris',
    horizonsId: '136199;',
    kind: 'dwarf-planet',
    stepDays: 32,
    radiiKm: 1163,
    gmKm3S2: 1099,
    rotationPeriodHours: 15.771 * 24,
    rotation: null,
    shapeDrawn: true,
    color: '#d8d4cc',
    map: null,
  }),
  // Apophis. 0.34 km volume-equivalent diameter from the radar shape model: Brozovic et
  // al., Icarus 300, 115 (2018), via SBDB. It tumbles -- 27.38 h and 263 h, Pravec et al.,
  // Icarus 233, 48 (2014) -- so no single period describes it. GM unmeasured.
  smallBody({
    id: 'apophis',
    name: 'Apophis',
    horizonsId: '99942;',
    kind: 'asteroid',
    stepDays: 1,
    radiiKm: 0.17,
    gmKm3S2: 0,
    rotationPeriodHours: null,
    rotation: null,
    shapeDrawn: false,
    color: '#a8a196',
    map: null,
  }),
  // Bennu. 0.5047 x 0.4918 x 0.4567 km: Daly et al., Sci. Adv. 6, eabd3649 (2020). GM:
  // Chesley et al., JGR Planets 125, e06363 (2020). Period: Hergenrother et al., Nat.
  // Commun. 10, 1291 (2019). Via SBDB.
  //
  // Rotation: bennu_v17.tpc, the last of OSIRIS-REx's PCKs (M. Nolan, LPL; KinetX), in
  // NAIF's OSIRIS-REx kernels: the navigation team's pole and phase fitted through the
  // mission, and W2 = 2.0e-6 deg/day^2, the spin-up YORP gives it: 192 degrees of phase
  // by 2026 that a constant rate would miss, against a phase the kernel puts at 0.1
  // degree (~50 cm) at the mission's epoch. Every version since 1.2
  // keeps a chosen boulder on the prime meridian, so it turns every OSIRIS-REx shape
  // model; the shape's own draft PCK (spov54_bennu_v15_draft2.tpc) agrees with it to
  // 0.02 degrees in 2019 and 0.5 in 2026.
  //
  // Shape: the team's SPO v54 -- SPC and OLA lidar combined, the one its archive says to
  // use for science -- at 3.17 m, the 196,608-facet level of the 3.1 million. The
  // Gazetteer's Benben Saxum, its 22 m boulder, is its highest point there:
  // shapeModels.test.ts. Albedo 0.044: Hergenrother et al. 2019, via SBDB.
  //
  // Map: Bennett et al.'s global PAN mosaic (Icarus 357, 113690, 2021), 5 cm/px, the
  // USGS 8-bit copy, left edge 0 E, area-averaged to 2048 x 1024 -- 0.77 m/px, four to
  // a facet. Its 8-bit stretch is taken as linear in reflectance; only its mean is used
  // for the level, which is the albedo's.
  smallBody({
    id: 'bennu',
    name: 'Bennu',
    horizonsId: '101955;',
    kind: 'asteroid',
    stepDays: 1,
    radiiKm: [0.25235, 0.2459, 0.22835],
    gmKm3S2: 4.8904e-9,
    rotationPeriodHours: -4.296061,
    rotation: iauRotation(85.45864, -60.36468, 150.48977, 2011.143058731885, 2.0e-6),
    shapeDrawn: true,
    color: '#6f6a64',
    map: null,
    shape: {
      file: 'bennu.glb',
      facets: 196_608,
      product: 'OSIRIS-REx SPO v54 (SPC + lidar), 3.2 m',
      orientationNote: null,
      albedo: 0.044,
      map: { file: 'bennu.jpg', longitudeOriginDeg: 0, meanLinear: 0.2973 },
    },
  }),
  // Ryugu. 1.004 km across the equator, 0.876 pole to pole; GM and period: Watanabe et
  // al., Science 364, 267 (2019). Via SBDB.
  //
  // Rotation: ryugu_v10.tpc, the last of Hayabusa2's PCKs (JAXA DARTS, Hayabusa2 SPICE
  // bundle, doi:10.17597/isas.darts/hyb2-00600), W0 at J2000 TDB as the Ryugu Coordinate
  // System Description states it: the prime meridian on the mound of Catafo Saxum, as
  // fixed at 2018-07-01 and kept since. Pole to 0.03 degree, rate to 1e-4 deg/day -- a
  // quarter of a degree by 2026. v08, the only other, has drifted 3.3 degrees from it.
  //
  // Shape: the team's SPC model v20200323, the one that PCK was fitted with, at the
  // 196,608-plate level of four; published as a DSK, read out to vertices and plates
  // unchanged. Otohime Saxum, the 160 m boulder by the south pole, and Catafo itself are
  // its highest points where the Gazetteer puts them: shapeModels.test.ts.
  //
  // Map: Hayabusa2 ONC's v-band normal albedo map (Yokota et al., PSJ 2, 177, 2021), at
  // its own 0.1 degree, left edge 0 E; the 2% never seen, near the poles, filled from
  // the edges. Albedo 0.045: Sugita et al., Science 364, eaaw0422 (2019), via the PCK.
  smallBody({
    id: 'ryugu',
    name: 'Ryugu',
    horizonsId: '162173;',
    kind: 'asteroid',
    stepDays: 1,
    radiiKm: [0.502, 0.502, 0.438],
    gmKm3S2: 3.0e-8,
    rotationPeriodHours: -7.63262,
    rotation: iauRotation(96.43112, -66.38741, 274.16225, 1131.98280286),
    shapeDrawn: true,
    color: '#6a6560',
    map: null,
    shape: {
      file: 'ryugu.glb',
      facets: 196_608,
      // ISAS's data policy asks for the origin, and to say it was modified.
      product: 'Hayabusa2 SPC v20200323 (ISAS/JAXA; converted)',
      orientationNote: null,
      albedo: 0.045,
      map: { file: 'ryugu.jpg', longitudeOriginDeg: 0, meanLinear: 0.4973 },
    },
  }),
  // Didymos. Radii 0.39167 x 0.39167 x 0.29195 km, pole, period 2.2600 h and the system's
  // GM, 3.48961e-8 km^3/s^2 (Didymos with Dimorphos): NAIF didymos_system_15.tpc
  // (2023-09-21), citing Naidu et al., PSJ 5 (2024). Dimorphos is not drawn yet.
  //
  // Rotation: that same PCK, BODY920065803 -- Didymos the body, the system's barycentre
  // being 20065803 -- the latest in DART's SPICE archive. Its W0 is 0 "arbitrarily", and
  // the prime meridian was then pinned to a boulder, Gong Saxum at 1.9 E, in DART's
  // images (didymos_coordinate_system_description_v1, doi:10.26007/30x0-fv64), so the
  // phase is right in September 2022. The period is 2.2600 +- 0.0001 h: +-0.7 of a turn
  // by October 2026, which the panel says. The shape's own document gives the pole of
  // the previous PCK, v14, 0.8 degrees from this one; v14 is no longer archived.
  //
  // Shape: DART's SPC model v003 (Daly et al., Nature 616, 443, 2023) at 4.66 m, the
  // 196,608-facet level of the 3.1 million, its origin the centre of mass. Albedo 0.15:
  // Hasselmann et al., PSJ 5, 91 (2024).
  smallBody({
    id: 'didymos',
    name: 'Didymos',
    horizonsId: '65803;',
    kind: 'asteroid',
    stepDays: 1,
    radiiKm: [0.39167, 0.39167, 0.29195],
    gmKm3S2: 3.48961e-8,
    rotationPeriodHours: -2.26,
    rotation: iauRotation(69.326861266078069, -72.724550395829496, 0, 3823.008849557522),
    shapeDrawn: true,
    color: '#a59d90',
    map: null,
    shape: {
      file: 'didymos.glb',
      facets: 196_608,
      product: 'DART SPC v003, 4.7 m',
      orientationNote: 'Spin phase measured at DART’s 2022 impact; ±0.7 turn by late 2026',
      albedo: 0.15,
      map: null,
    },
  }),
  // Dinkinesh. 0.719 km mean diameter and GM: Levison et al., Nature (2024),
  // doi:10.1038/s41586-024-07378-0. Period: Mottola et al., MNRAS Letters (2023),
  // doi:10.1093/mnrasl/slad066. Via SBDB. Its moon Selam is not drawn yet.
  smallBody({
    id: 'dinkinesh',
    name: 'Dinkinesh',
    horizonsId: '152830;',
    kind: 'asteroid',
    stepDays: 2,
    radiiKm: 0.3595,
    gmKm3S2: 3.3e-8,
    rotationPeriodHours: 52.67,
    rotation: null,
    shapeDrawn: false,
    color: '#a09a8e',
    map: null,
  }),
  // Vesta. Radii and rotation: pck00011, whose long axis lies on the prime meridian
  // (BODY2000004_LONG_AXIS = 0), the same convention the triaxial moons are drawn in. GM:
  // Park et al., Nature Astronomy (2025), doi:10.1038/s41550-025-02533-7, via SBDB.
  smallBody({
    id: 'vesta',
    name: 'Vesta',
    horizonsId: '4;',
    kind: 'asteroid',
    stepDays: 4,
    radiiKm: [289, 280, 229],
    gmKm3S2: 17.2882844,
    rotationPeriodHours: (360 / 1617.3329428) * 24,
    rotation: iauRotation(309.031, 42.235, 285.39, 1617.3329428),
    shapeDrawn: true,
    color: '#b5ab9c',
    // Dawn's HAMO global mosaic (DLR, USGS Vesta_Dawn_FC_HAMO_Mosaic_Global_74ppd).
    // Vesta has had four prime meridians, and this map and this rotation had to be in the
    // same one. Dawn flew in its own "Claudia" system, W0 = 75.39, Claudia crater at 356
    // E; "Claudia Prime" moved it to 295.39; the IAU adopted "Claudia Double Prime", W0 =
    // 285.39 -- the value above -- which puts Claudia at 146 E and keeps the prime
    // meridian within a degree of the IAU-2000 system's (Dawn's VESTA_COORDINATES_131018,
    // Table 1). USGS shifted this mosaic 150 degrees east from Dawn's system into Claudia
    // Double Prime, and its ISIS label centres it on 0 with its left edge at minus pi R:
    // longitude 180 W. Marcia and Aricia Tholus land on the Gazetteer's coordinates, which
    // are Claudia Double Prime too (Claudia: 146.0 E): textureAlignment.test.ts.
    map: { file: 'vesta.jpg', longitudeOriginDeg: 180 },
  }),
  // Donaldjohanson. 8.8 x 4.4 x 3.1 km from Lucy's April 2025 flyby: Marchi et al.,
  // Science 392, 1291 (2026), doi:10.1126/science.aec0503. It tumbles, at 252.6 h and
  // 455.2 h, so no single period describes it. Its mass in that paper is assumed, not
  // measured.
  //
  // Rotation: donaldjohanson_v12.tpc (S. Mottola, DLR, 2025-07-15), the Lucy project's
  // official kernel and the frame of the shape: a plain spin, 251.09 h about a pole at
  // RA 324.66, Dec +50.96, with "the intersection of the principal axis of least inertia
  // with the shape" on the prime meridian. It is the tumble drawn as a spin -- no model of
  // the tumble itself has been released -- so it holds at the April 2025 flyby and
  // drifts from it, which the panel says.
  //
  // Shape: lcy_donj_k548_iso20m_v10.bds (DLR, Mottola and Preusker; Lucy SPICE archive),
  // the one Marchi et al. point to: stereophotogrammetry of the imaged side, the rest
  // two ellipsoids fitted to its outline, 547,996 facets at 20 m; the only resolution
  // published. Albedo 0.103: NEOWISE (Masiero et al., ApJ 741, 68, 2011), via SBDB.
  smallBody({
    id: 'donaldjohanson',
    name: 'Donaldjohanson',
    horizonsId: '52246;',
    kind: 'asteroid',
    stepDays: 4,
    radiiKm: [4.4, 2.2, 1.55],
    gmKm3S2: 0,
    rotationPeriodHours: null,
    rotation: iauRotation(324.66115, 50.95721, 293.17865, 34.409504086),
    shapeDrawn: true,
    color: '#8a857c',
    map: null,
    shape: {
      file: 'donaldjohanson.glb',
      facets: 547_996,
      product: 'Lucy (DLR) stereo + fitted far side, 20 m',
      orientationNote: 'It tumbles; drawn spinning as at Lucy’s April 2025 flyby',
      albedo: 0.103,
      map: null,
    },
  }),
  // Pallas. 568 x 532 x 448 km: Marsset et al., Nature Astronomy 4, 569 (2020). GM:
  // Vernazza et al., A&A 654, A56 (2021). Period: Carry et al., Icarus 205, 460 (2010).
  // All via SBDB. pck00011 has its IAU rotation but not which longitude its long axis
  // lies at, so the ellipsoid cannot be turned the right way: a marker.
  smallBody({
    id: 'pallas',
    name: 'Pallas',
    horizonsId: '2;',
    kind: 'asteroid',
    stepDays: 4,
    radiiKm: [284, 266, 224],
    gmKm3S2: 13.63,
    rotationPeriodHours: 7.8132214,
    rotation: null,
    shapeDrawn: false,
    color: '#9a978f',
    map: null,
  }),
  // Psyche. 278 x 238 x 171 km: Shepard et al., PSJ 2, 125 (2021). GM: Farnocchia et
  // al., AJ 168, 21 (2024). Period: the Light Curve Database (Warner et al. 2009, rev.
  // 2023). Via SBDB.
  // Named with its number, as minor planets formally are: the spacecraft flying to it is
  // Psyche too.
  smallBody({
    id: '16-psyche',
    name: '16 Psyche',
    horizonsId: '16;',
    kind: 'asteroid',
    stepDays: 4,
    radiiKm: [139, 119, 85.5],
    gmKm3S2: 1.601,
    rotationPeriodHours: -4.196,
    rotation: null,
    shapeDrawn: false,
    color: '#a39d93',
    map: null,
  }),
  // Eurybates, Lucy's 2027 target. Convex model 77.5 x 71.3 x 61.8 km, pole and period
  // 8.7027283 h: Mottola et al., PSJ 4, 18 (2023), doi:10.3847/PSJ/acaf79. A mass from its
  // moon Queta's orbit is reported (Brown et al. 2021) but not yet checked against the
  // paper, so it is left unmeasured here.
  smallBody({
    id: 'eurybates',
    name: 'Eurybates',
    horizonsId: '3548;',
    kind: 'asteroid',
    stepDays: 8,
    radiiKm: [38.75, 35.65, 30.9],
    gmKm3S2: 0,
    rotationPeriodHours: -8.7027283,
    rotation: null,
    shapeDrawn: false,
    color: '#7d7871',
    map: null,
  }),
  // Arrokoth. A contact binary no ellipsoid describes. Period 15.92 h: Spencer et al.,
  // Science 367, eaay3999 (2020). Mass unmeasured.
  //
  // Shape: Porter et al.'s 2024 model (PDS, nh_derived:arrokoth_shapemodel_porter2024),
  // which superseded every earlier one -- whose pole was wrong, "resulting a much
  // flatter shape". 40,960 facets, the one resolution published. Overall 34.546 x 19.838
  // x 13.822 km, the radii below; its lobes Wenu, 20.1 x 19.8 x 13.7 km, on +x where the
  // prime meridian is ("along the long axis on the largest lobe", Beyer and Porter's
  // coordinate system document), and Weeyo, 15.0 x 14.4 x 13.6.
  //
  // Rotation: nh_arrokoth_002.tpc (B. Enke, SwRI, 2024), whose comment says its values
  // "were used in the arrokoth_porter_2024_v01 shape model": the frame it was fitted
  // in. Its rate, 559.39 deg/day, is a period of 15.445 h -- 3% off every published one,
  // Spencer's 15.92 and Buie et al.'s 15.9380 +- 0.0005 h (AJ 159, 130, 2020) -- and
  // nothing published explains it. Kept, because it is what turns the model onto the
  // images at the January 2019 flyby; but at either rate the phase today is unknown,
  // and the panel says so. The period quoted stays the published one.
  //
  // Albedo 0.21, geometric, at 550 nm: Hofgartner et al., Icarus 356, 113723 (2021). Its
  // red is the catalog colour's. Porter's albedo map covers the imaged half, in a
  // projection of its own; not drawn.
  smallBody({
    id: 'arrokoth',
    name: 'Arrokoth',
    horizonsId: '486958;',
    kind: 'asteroid',
    stepDays: 32,
    radiiKm: [17.273, 9.919, 6.911],
    gmKm3S2: 0,
    rotationPeriodHours: -15.92,
    rotation: iauRotation(319.368582, -25.5875063, 71.9541475, 559.393617318826386509),
    shapeDrawn: true,
    color: '#a0705a',
    map: null,
    shape: {
      file: 'arrokoth.glb',
      facets: 40_960,
      product: 'New Horizons, Porter et al. 2024',
      orientationNote: 'Turned as at New Horizons’ January 2019 flyby; phase today unknown',
      albedo: 0.21,
      map: null,
    },
  }),
];
