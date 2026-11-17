import type { BodyDefinition } from '@sss/tools/types';

import type { DescriptionPoint } from './types.ts';

/**
 * The part of "how it is drawn here" that is read off the body's own data, so it can never
 * drift from what the app actually does: where its positions come from, the size and shape it
 * is drawn at, how it turns, and whose map covers it. A description's hand-written points add
 * what the data cannot say (an exposure, a colour convention).
 */

/** Who made each surface map, as public/textures/CREDITS.md lists it. */
export const TEXTURE_CREDITS: Readonly<Record<string, string>> = {
  'sun.jpg': 'Solar System Scope (CC BY 4.0)',
  'mercury.jpg': 'Solar System Scope (CC BY 4.0)',
  'venus.jpg': 'Solar System Scope (CC BY 4.0)',
  'earth.jpg': 'Solar System Scope (CC BY 4.0)',
  'mars.jpg': 'Solar System Scope (CC BY 4.0)',
  'jupiter.jpg': 'Solar System Scope (CC BY 4.0)',
  'saturn.jpg': 'Solar System Scope (CC BY 4.0)',
  'uranus.jpg': 'Solar System Scope (CC BY 4.0)',
  'neptune.jpg': 'Solar System Scope (CC BY 4.0)',
  'moon.jpg': 'NASA’s Scientific Visualization Studio, from LRO’s wide-angle camera (public domain)',
};

const formatKm = (km: number): string => `${Math.round(km).toLocaleString('en-US')} km`;

export function drawnFromData(body: BodyDefinition): DescriptionPoint[] {
  const points: DescriptionPoint[] = [];

  if (body.horizonsId !== '') {
    const about = body.center === '500@0' ? 'the Solar System’s barycentre' : 'the centre of the body it orbits';
    const every = body.stepDays === 1 ? 'day' : `${body.stepDays} days`;
    // DE441 integrates the Moon with the Sun and planets; other moons come from their own
    // system's satellite ephemeris (JUP365, SAT441 and the rest), not from DE441.
    const ephemeris =
      body.id === 'moon'
        ? 'DE441, which carries the Moon along with the Sun and planets'
        : body.kind === 'moon'
          ? 'its planet’s satellite ephemeris'
          : 'DE441 for the Sun and planets';
    points.push({
      title: 'Where it is',
      text:
        `From JPL’s ephemeris through Horizons (${ephemeris}), sampled every ` +
        `${every} about ${about} and interpolated between samples, so at any moment it is ` +
        `where JPL puts it, to within the sampling’s tolerance.`,
      cite: ['de440'],
    });
  }

  const round = body.radiusEquatorialKm === body.radiusPolarKm && body.triaxialRadiiKm === null;
  points.push({
    title: 'Its size and shape',
    text: round
      ? `A sphere of radius ${formatKm(body.radiusEquatorialKm)}, its real size, never enlarged.`
      : `An ellipsoid, ${formatKm(body.radiusEquatorialKm)} at the equator and ${formatKm(body.radiusPolarKm)} at the poles.`,
  });

  if (body.rotation !== null && body.rotationPeriodHours !== null) {
    // A negative rate is a body turning backwards about the IAU's north pole (Venus, Uranus):
    // said in words, never as a negative period; under two days, in hours.
    const days = 360 / Math.abs(body.rotation.rotationRateDegPerDay);
    const period = days < 2 ? `${(days * 24).toFixed(2)} hours` : `${days.toFixed(2)} days`;
    const backwards = body.rotation.rotationRateDegPerDay < 0 ? ', backwards against that pole' : '';
    points.push({
      title: 'How it turns',
      text:
        `Its pole points to right ascension ${body.rotation.poleRaDeg}°, declination ${body.rotation.poleDecDeg}°, ` +
        `and it turns once in ${period}${backwards}, as the IAU’s rotation model gives it.`,
      cite: ['archinal2018'],
    });
  }

  // The illustrative set is the one drawn (ACTIVE_TEXTURE_SET in scene/SolarSystem.tsx); the
  // photometric files of Earth, Mars and Neptune are in the repository but not shown.
  const map = body.textures?.illustrative?.file ?? body.textures?.photometric?.file ?? null;
  if (map !== null) {
    points.push({
      title: 'Its surface map',
      text: `${map}, by ${TEXTURE_CREDITS[map] ?? 'see public/textures/CREDITS.md'}.`,
    });
  }

  return points;
}
