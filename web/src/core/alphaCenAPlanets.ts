import type { BodyId } from '@sss/tools/types';

import type { ExoPlanet } from './exoplanets.ts';

/**
 * Alpha Centauri A's candidate planet, S1: a point of light JWST's MIRI coronagraph saw
 * once, on 2024-08-10, 1.51″ from the star at position angle 83.5° -- 2 AU in projection,
 * in its habitable zone -- and did not see again in February and April 2025 (Beichman,
 * Sanghi et al. 2025, ApJL, doi 10.3847/2041-8213/adf53f, arXiv 2508.03814). Neither a
 * background nor a foreground object, the authors find, but with one sighting at one roll
 * angle it cannot be confirmed: a **candidate**, drawn grey and named so. It may be C1, a
 * source the VLT's NEAR saw in 2019 (Wagner et al. 2021); the orbits below assume so.
 *
 * ## What is known
 *
 * - Its brightness at 15.5 µm, 3.5 ± 1.0 mJy: for a giant planet of A's age, a mass of
 *   90 to 150 Earth masses -- a Saturn or so -- and a radius of 1 to 1.1 Jupiter's. The RV
 *   limits allow under 100 Earth masses (2 sigma) within 2 AU. Drawn at 100, the mass the
 *   paper's own RV comparison assumes, and said to be from its light.
 * - **Its orbit is not.** One position (two, with C1) does not fix an orbit: the paper's
 *   fits that also stay stable beside B and hide the planet in 2025 fall in four families
 *   -- a about 1.66 or 2.2 AU (1.5 or 2.5 periods between 2019 and 2024), prograde or
 *   retrograde against AB's orbit -- all with e about 0.4 and tilted 50 or 130 degrees to
 *   AB's plane.
 *
 * ## The orbit drawn
 *
 * One of theirs, as published (Zenodo 10.5281/zenodo.16280658, CC BY 4.0; read
 * 2026-11-17): of the first 28,324 accepted orbits, the most populous family is retrograde
 * with a < 2 AU (8,297; the others 6,243 to 6,901), and of it the orbit nearest the
 * family's medians and the 2024 position: a 1.672 AU, e 0.359, sky tilt 127.54°, node
 * 66.92°, argument of periastron 137.05°, periastron at MJD 59,319.92 (their tau 0.61946
 * from MJD 58,849, of a 760.21-day period about 1.079 solar masses). It puts S1 1.55″ east
 * and 0.19″ north of A on 2024-08-10, against the measured 1.50″ and 0.17″ ± 0.13″
 * (alphaCenAPlanets.test.ts). Their sky formulae are this app's (exoplanets.ts); which side
 * of the sky's plane the planet is on, imaging cannot tell, so the depth is a convention.
 * The other three families fit as well; and S1 may be no planet at all.
 */

export const ALPHA_CEN_A_PLANETS: readonly ExoPlanet[] = [
  {
    id: 'alpha-cen-a-s1',
    name: 'Alpha Centauri A S1 (candidate)',
    status: 'candidate',
    periodDays: 760.2105842861523,
    semiMajorAxisAu: 1.672,
    eccentricity: 0.359,
    argPeriastronDeg: 137.0515045952929,
    massEarth: 100,
    massIsMinimum: false,
    massNote: 'from light',
    phase: { kind: 'periastron', jd: 2459320.420452265 },
    inclinationDeg: 127.54040519612126,
    nodeDeg: 66.92147047128014,
    orbitChosen: 'one fitted orbit of many',
    reference: 'Beichman, Sanghi et al. 2025, ApJL (arXiv 2508.03814; candidate, unconfirmed); orbit from their Zenodo samples',
  },
];

/** A's planet by its body id, or null for any other body. */
export function alphaCenAPlanetOf(id: BodyId): ExoPlanet | null {
  return ALPHA_CEN_A_PLANETS.find((planet) => planet.id === id) ?? null;
}
