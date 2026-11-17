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
};

const formatKm = (km: number): string => `${Math.round(km).toLocaleString('en-US')} km`;

export function drawnFromData(body: BodyDefinition): DescriptionPoint[] {
  const points: DescriptionPoint[] = [];

  if (body.horizonsId !== '') {
    const about = body.center === '500@0' ? 'the Solar System’s barycentre' : `its parent (${body.center})`;
    points.push({
      title: 'Where it is',
      text:
        `From JPL’s ephemeris through Horizons (DE441 for the Sun and planets), sampled every ` +
        `${body.stepDays} days about ${about} and interpolated between samples, so at any moment it is ` +
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
    const days = 360 / body.rotation.rotationRateDegPerDay;
    points.push({
      title: 'How it turns',
      text:
        `Its pole points to right ascension ${body.rotation.poleRaDeg}°, declination ${body.rotation.poleDecDeg}°, ` +
        `and it turns once in ${days.toFixed(2)} days, as the IAU’s rotation model gives it.`,
      cite: ['archinal2018'],
    });
  }

  const map = body.textures?.photometric?.file ?? body.textures?.illustrative?.file ?? null;
  if (map !== null) {
    points.push({
      title: 'Its surface map',
      text: `${map}, by ${TEXTURE_CREDITS[map] ?? 'see public/textures/CREDITS.md'}.`,
    });
  }

  return points;
}
