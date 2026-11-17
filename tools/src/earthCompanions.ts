import type { BodyDefinition } from './types.ts';
import { smallBody } from './smallBodies.ts';

/**
 * Earth's companions: small asteroids on Earth-like orbits that keep company with it for a
 * while -- the Arjunas, as the de la Fuente Marcos brothers call that belt of a hundred-odd
 * (RNAAS 9, 235, 2025). Neither is a moon: each goes round the Sun, and is drawn about it,
 * on JPL's own integrated vectors to a kilometre, as the named asteroids are (smallBodies.ts).
 * What makes them companions is how they move against Earth, which their info panel says.
 *
 *   - **2025 PN7**, a quasi-satellite: in a 1:1 resonance with Earth, so that seen from Earth
 *     it loops round it once a year, while bound only to the Sun. Found on 2025-08-02 by
 *     Pan-STARRS 1 (MPEC 2025-Q232); shown a quasi-satellite by C. and R. de la Fuente
 *     Marcos, "Meet Arjuna 2025 PN7, the Newest Quasi-satellite of Earth", RNAAS 9, 235
 *     (2025), doi:10.3847/2515-5172/ae028f, who put its time in that state at 128 years in
 *     all. JPL's solution (JPL#8, 2026-09-07) fits a Yarkovsky drift, from observations back
 *     to 2013 found in older images.
 *   - **2024 PT5**, a mini-moon: discovered by ATLAS at Sutherland on 2024-08-07, and
 *     captured -- its energy about Earth negative -- from 2024-09-29 20:02 to 11-25 10:33 UTC,
 *     a "temporarily captured flyby" on a horseshoe path that never went once round Earth
 *     (C. and R. de la Fuente Marcos, "A Two-month Mini-moon: 2024 PT5 Captured by Earth from
 *     September to November", RNAAS 8, 224, 2024, doi:10.3847/2515-5172/ad781f). Its spectrum
 *     matches lunar rock: Kareta et al., "On the Lunar Origin of Near-Earth Asteroid 2024
 *     PT5", ApJL 979, L8 (2025), doi:10.3847/2041-8213/ad9ea8 -- likely ejecta from the Moon.
 *
 * **Size.** Only their brightness is known -- H 26.4 and 27.45 (JPL) -- so, as for the
 * sednoids (farBodies.ts), no size is given: one would be a guess at an albedo. Markers.
 * GM unmeasured.
 *
 * **Sampling.** Their encounters with Earth bend their paths within days, so the refinement
 * starts from a day, as Apophis's does; it refines to the kilometre from there.
 */
export const EARTH_COMPANIONS: readonly BodyDefinition[] = (
  [
    ['2025-pn7', '2025 PN7', 'DES=2025 PN7;', '#a8a196'],
    ['2024-pt5', '2024 PT5', 'DES=2024 PT5;', '#9c9890'],
  ] as const
).map(([id, name, horizonsId, color]) =>
  smallBody({
    id,
    name,
    horizonsId,
    kind: 'asteroid',
    stepDays: 1,
    radiiKm: null,
    gmKm3S2: 0,
    rotationPeriodHours: null,
    rotation: null,
    shapeDrawn: false,
    color,
    map: null,
  }),
);
