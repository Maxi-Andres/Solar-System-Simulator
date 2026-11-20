import type { BodyDefinition } from '@sss/tools/types';

import { CRITICAL_IMPACT } from '../core/schwarzschildLens.ts';
import { parseStarBodyId } from '../core/starBodies.ts';
import type { DescriptionPoint } from './types.ts';

/**
 * "How it is drawn here" for a catalogue star made a body (core/starBodies.ts) and for a black
 * hole (core/blackHoles.ts), read off the body and the code that draws it, as generated.ts reads
 * a planet's or a craft's. What only one star has -- an orbit, a parallax of its own, a size
 * not drawn -- its description says by hand.
 */

const SOLAR_RADIUS_KM = 695_700;
const AU_KM = 149_597_870.7;

/** A 3D star's record made a body (`star-<tier>-<index>`): not the Sun, not a star about a black hole. */
export function isCatalogueStarBody(body: BodyDefinition): boolean {
  return body.kind === 'star' && parseStarBodyId(body.id) !== null;
}

export function starFromData(body: BodyDefinition): DescriptionPoint[] {
  const measured = body.radiusPublished !== false;
  const km = Math.round(body.radiusEquatorialKm).toLocaleString('en-US');
  const solar = Number((body.radiusEquatorialKm / SOLAR_RADIUS_KM).toPrecision(3));
  return [
    {
      title: 'Its light',
      text:
        'A point of light drawn by the star renderer, as bright as it would look from wherever the camera is: its ' +
        'catalogue’s absolute magnitude carried to the camera’s distance, m = M_V + 5 log₁₀(d / 10 pc), with no dust ' +
        'in between. From the Sun that gives back the magnitude it is seen at from Earth.',
    },
    {
      title: 'Its colour',
      text:
        'From its catalogue colour index, B−V, read as a temperature by Ballesteros’s relation, and the light of a ' +
        'blackbody at that temperature passed through the CIE 1931 observer, the measured response of human colour ' +
        `vision: the colour an eye would see, at full brightness — ${body.color} on a screen.`,
      cite: ['ballesteros2012'],
    },
    measured
      ? {
          title: 'Its size',
          text:
            `Up close, a sphere of radius ${km} km, ${solar} times the Sun’s: its measured size, never enlarged. ` +
            'It is drawn as a disc in the colour above, darker toward its edge by the Sun’s own limb darkening, taken as its own.',
        }
      : {
          title: 'Its size',
          text:
            'None is drawn: the catalogues it comes from give no size, so it stays a point however close the camera comes, ' +
            'and the camera stands off it as though it were the Sun’s size — a number to frame it by, not its size.',
        },
  ];
}

export function blackHoleFromData(body: BodyDefinition): DescriptionPoint[] {
  const rs = body.radiusEquatorialKm;
  const size =
    rs > 1e6
      ? `${Number((rs / 1e6).toPrecision(3))} million km, ${Number((rs / AU_KM).toPrecision(2))} AU`
      : `${Number(rs.toPrecision(3))} km`;
  return [
    {
      title: 'Its size',
      text:
        `A black sphere of its Schwarzschild radius, 2GM/c², ${size}: the event horizon of a black hole of its mass ` +
        'that does not spin, which the camera is kept out of. What is seen black is larger — its shadow, the light that ' +
        `passes within ${CRITICAL_IMPACT.toFixed(2)} horizons falling in — and the sphere is scaled each frame to hide exactly ` +
        'the shadow from where the camera is.',
    },
    {
      title: 'The sky round it',
      text:
        'Bent, by the exact Schwarzschild deflection for a camera at its real distance: the stars behind it moved to ' +
        'their two images, the galaxy’s glow drawn into its Einstein ring and the thinner rings inside it, and the star on ' +
        'its orbit seen through the bend. The lens is on only while its Einstein ring is half a pixel or more across; the ' +
        'lines and labels drawn over it are not bent.',
    },
    {
      title: 'Nothing of its own',
      text: 'No disc of gas, no jet, no glow: what is drawn round it is the sky behind it, bent.',
    },
  ];
}
