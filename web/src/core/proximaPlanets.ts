import type { BodyId } from '@sss/tools/types';

import type { ExoPlanet } from './exoplanets.ts';

/**
 * Proxima Centauri's planets (D3c): b and d, confirmed, and c, a candidate still argued
 * over -- each where its radial velocities put it, and each under the conventions those
 * velocities leave open, named as such.
 *
 * ## What is measured
 *
 * The star's wobble gives each planet's period, its minimum mass (m sin i) and, from the
 * star's mass, its distance; and it gives when along the orbit the planet passes in front
 * of the star as we see it -- its conjunction -- to within the fit's error.
 *
 * - **b:** Damasso et al. 2020, Sci. Adv. 6, eaax7467, Table 1: P = 11.185 d and
 *   inferior conjunction at BJD 2,457,897.9 (+0.3/-0.2), from which its place along the
 *   orbit now is known to about a day; a 0.04856 AU and m sin i 1.07 Earth masses from
 *   Faria et al. 2022, A&A 658, A115, Table C.1.
 * - **d:** Faria et al. 2022 Table C.1 (TM, adopted): P 5.122 d, a 0.02885 AU, m sin i
 *   0.26 Earth masses, and its phase as mean anomaly plus argument of periastron at their
 *   first night, 2019-02-10 -- uncertain by two radians either way, so where d is along
 *   its orbit is not really known. Confirmed by Suárez Mascareño et al. 2025 (A&A 700,
 *   A11) per the NASA Exoplanet Archive (queried 2026-10-28).
 * - **c (candidate):** Damasso et al. 2020 Table 1: P 1,900 d, conjunction BJD 2,455,892
 *   (+-101), a 1.48 AU, m sin i 5.8 Earth masses. Not among the Archive's confirmed
 *   planets: its authors themselves leave open that the signal is the star's own
 *   activity, and it is drawn grey and named as a candidate.
 *
 * All three are fitted as circular (b's and c's eccentricity fixed at zero by Damasso et
 * al.; Faria et al.'s for d is 0.04 +0.15/-0.04).
 *
 * ## What is not, and the convention for it
 *
 * None transits, so the tilt of the orbits is unknown, and so is which way across the sky
 * they run: they are drawn under exoplanets.ts's conventions, edge-on as seen from the Sun
 * with the node east-west. Conjunction, where the RVs put it, is then the planet straight
 * between Proxima and the Sun.
 */

export const PROXIMA_PLANETS: readonly ExoPlanet[] = [
  {
    id: 'proxima-d',
    name: 'Proxima Centauri d',
    status: 'confirmed',
    periodDays: 5.122,
    semiMajorAxisAu: 0.02885,
    eccentricity: 0,
    argPeriastronDeg: 0,
    massEarth: 0.26,
    massIsMinimum: true,
    // Faria et al. 2022: M0 + omega = 5.5 + 4.0 rad at their first night, 2019-02-10; the
    // mean longitude, pi/2 at conjunction in the RV convention.
    phase: { kind: 'pastConjunction', jd: 2458524.8, rad: 5.5 + 4.0 - Math.PI / 2 },
    inclinationDeg: null,
    nodeDeg: null,
    reference: 'Faria et al. 2022, A&A 658, A115; confirmed by Suárez Mascareño et al. 2025, A&A 700, A11',
  },
  {
    id: 'proxima-b',
    name: 'Proxima Centauri b',
    status: 'confirmed',
    periodDays: 11.185,
    semiMajorAxisAu: 0.04856,
    eccentricity: 0,
    argPeriastronDeg: 0,
    massEarth: 1.07,
    massIsMinimum: true,
    phase: { kind: 'conjunction', jd: 2457897.9 },
    inclinationDeg: null,
    nodeDeg: null,
    reference: 'Anglada-Escudé et al. 2016, Nature 536, 437; Damasso et al. 2020; Faria et al. 2022',
  },
  {
    id: 'proxima-c',
    name: 'Proxima Centauri c (candidate)',
    status: 'candidate',
    periodDays: 1900,
    semiMajorAxisAu: 1.48,
    eccentricity: 0,
    argPeriastronDeg: 0,
    massEarth: 5.8,
    massIsMinimum: true,
    phase: { kind: 'conjunction', jd: 2455892 },
    inclinationDeg: null,
    nodeDeg: null,
    reference: 'Damasso et al. 2020, Sci. Adv. 6, eaax7467 (candidate, unconfirmed)',
  },
];

/** One of Proxima's planets by its body id, or null for any other body. */
export function proximaPlanetOf(id: BodyId): ExoPlanet | null {
  return PROXIMA_PLANETS.find((planet) => planet.id === id) ?? null;
}
