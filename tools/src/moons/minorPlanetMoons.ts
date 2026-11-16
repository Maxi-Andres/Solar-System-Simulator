import {
  CLOSE_ORBIT_WINDOW_MONTHS,
  INNER_MOON_PERIOD_DAYS,
  SMALL_MOON_RADIUS_FRACTION,
  SMALL_MOON_TOLERANCE_FLOOR_KM,
  SMALL_MOON_WINDOW_MONTHS,
} from '../config.ts';
import type { BodyDefinition, BodyId } from '../types.ts';

/**
 * The moons of the dwarf planets and trans-Neptunians that JPL publishes an orbit for, and
 * Dimorphos: small moons as the planets' are (SMALL_MOONS in catalog.ts) -- adaptive vectors,
 * shipped in their primary's bundle (small-moons/<primary>.json), shown with the Small
 * Moons layer -- but not in JPL's planetary satellite tables, so listed here by hand.
 *
 * **Where the orbits come from.** JPL's TNO satellite solutions (tnosat_v001, 2022), one per
 * system, fitted to the moons' positions measured from Hubble and Keck: each publishes the
 * moon (Horizons 1xxxxxxxx, 2xxxxxxxx for a second), the primary's centre (9xxxxxxxx) and the
 * system's barycentre. Each moon here is the moon about its primary's centre -- so the pair is
 * exactly as far apart as JPL fits them -- hung from the primary the app draws, which is
 * JPL's current heliocentric solution for the system ('90482;'), its barycentre. The primary
 * itself is therefore drawn a moon's share of the separation off its own centre: under
 * half a percent of it for Eris and Haumea, ~8% for Orcus if Vanth's mass ratio is the theoretical
 * one JPL quotes -- 700 km, against a separation of 9,000.
 *
 * How well each is known, JPL's own figure, the position's uncertainty about the primary on
 * 2025-01-01: Dysnomia 110 km, Vanth 67, Actaea 110, Hiʻiaka 900, Namaka 1,570, Weywot 3,600
 * ("predictions outside the 2006-2011 interval ... may be poor"). Every solution ends on
 * 2030-01-01, so each table stops there and the moon falls back on its elements after.
 *
 * Dimorphos is the DART team's post-impact reconstruction merged with Hera's (Horizons
 * 120065803, "s547 + Hera latest", about the Didymos primary 920065803), which ends on
 * 2027-06-30.
 *
 * **Size**: the radius each Horizons record gives, as for the planets' small moons
 * (buildMoonList.ts radiusFromSummary) -- several marked there as approximate ("~"):
 *
 *   moon        radius, km      record
 *   Dysnomia    350 +- 57.5     120136199
 *   Hiʻiaka     ~160            120136108
 *   Namaka      ~85             220136108
 *   Vanth       ~221.5          120090482
 *   Actaea      151.5 +- 17.5   120120347
 *   Weywot      ~85             120050000
 *   Dimorphos   0.0959 x 0.0739 x 0.0586, the cube root of their product: 0.0746
 *
 * **GM** as JPL's TNO satellite solution gives it: Hiʻiaka 1.151 +- 0.069 and Namaka 0.036
 * +- 0.026 km^3/s^2; Vanth 3.470366973, its share of the system's mass by a theoretical ratio
 * (GM_rat 0.0826, "theory"), and Weywot 0.04783, without an error. What the moon's orbit is
 * drawn from is the pair's sum, the primary's GM (farBodies.ts) and the moon's, which is the
 * system's mass JPL fitted. Dysnomia's is only a range, and Actaea's is not split from
 * Salacia's: zero, meaning unmeasured -- Salacia carries the system's whole GM.
 *
 * Not here, for want of an orbit in Horizons: Makemake's MK2, Gonggong's Xiangliu, Varda's
 * Ilmarë, and the asteroid moons Dactyl, Selam and Menoetius.
 */

interface MinorMoonSpec {
  readonly id: BodyId;
  readonly name: string;
  readonly horizonsId: string;
  /** The primary's body id in this catalog. */
  readonly parent: BodyId;
  /** The primary's centre in JPL's satellite solution: the moon's vectors are about it. */
  readonly primaryHorizonsId: string;
  /** Near the orbital period, days: sets only the step the sampling starts from. */
  readonly periodDays: number;
  readonly radiusKm: number;
  readonly gmKm3S2: number;
  /** Tolerance, km, where a hundredth of the radius under the floor would be meaningless. */
  readonly toleranceKm?: number;
}

const SPECS: readonly MinorMoonSpec[] = [
  { id: 'dysnomia', name: 'Dysnomia', horizonsId: '120136199', parent: 'eris', primaryHorizonsId: '920136199', periodDays: 15.79, radiusKm: 350, gmKm3S2: 0 },
  { id: 'hiiaka', name: 'Hiʻiaka', horizonsId: '120136108', parent: 'haumea', primaryHorizonsId: '920136108', periodDays: 49.1, radiusKm: 160, gmKm3S2: 1.151 },
  { id: 'namaka', name: 'Namaka', horizonsId: '220136108', parent: 'haumea', primaryHorizonsId: '920136108', periodDays: 18.3, radiusKm: 85, gmKm3S2: 0.036 },
  { id: 'vanth', name: 'Vanth', horizonsId: '120090482', parent: 'orcus', primaryHorizonsId: '920090482', periodDays: 9.54, radiusKm: 221.5, gmKm3S2: 3.470366973 },
  { id: 'actaea', name: 'Actaea', horizonsId: '120120347', parent: 'salacia', primaryHorizonsId: '920120347', periodDays: 5.49, radiusKm: 151.5, gmKm3S2: 0 },
  { id: 'weywot', name: 'Weywot', horizonsId: '120050000', parent: 'quaoar', primaryHorizonsId: '920050000', periodDays: 12.4, radiusKm: 85, gmKm3S2: 0.04783 },
  // 1.2 km from Didymos's centre: the moons' kilometre floor would be its whole orbit. A
  // hundredth of its radius, 0.75 m, which the one-minute step holds with room to spare.
  {
    id: 'dimorphos',
    name: 'Dimorphos',
    horizonsId: '120065803',
    parent: 'didymos',
    primaryHorizonsId: '920065803',
    periodDays: 0.473,
    radiusKm: 0.0746,
    gmKm3S2: 0,
    toleranceKm: 0.00075,
  },
];

/** A fortieth of the period in whole minutes, at most four days: SMALL_MOONS' own rule. */
function startStepDays(periodDays: number): number {
  return Math.max(1, Math.min(4 * 1440, Math.floor((periodDays * 1440) / 40))) / 1440;
}

export const MINOR_PLANET_MOONS: readonly BodyDefinition[] = SPECS.map((spec) => {
  const center = `500@${spec.primaryHorizonsId}`;
  return {
    id: spec.id,
    name: spec.name,
    horizonsId: spec.horizonsId,
    stepDays: startStepDays(spec.periodDays),
    vectorWindow: 'short',
    center,
    elementsCenter: center,
    parent: spec.parent,
    kind: 'moon',
    radiusEquatorialKm: spec.radiusKm,
    radiusPolarKm: spec.radiusKm,
    triaxialRadiiKm: null,
    gmKm3S2: spec.gmKm3S2,
    gmBodyOnlyKm3S2: spec.gmKm3S2,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    // The planets' small moons' grey: no colour is measured for most of these, and Dysnomia's
    // albedo, 0.04, is the irregular moons'.
    color: '#8a8580',
    drawOrbit: true,
    textures: null,
    rings: null,
    mission: null,
    sampling: {
      toleranceKm:
        spec.toleranceKm ?? Math.max(SMALL_MOON_TOLERANCE_FLOOR_KM, SMALL_MOON_RADIUS_FRACTION * spec.radiusKm),
      windowMonths: spec.periodDays < INNER_MOON_PERIOD_DAYS ? CLOSE_ORBIT_WINDOW_MONTHS : SMALL_MOON_WINDOW_MONTHS,
    },
  } satisfies BodyDefinition;
});
