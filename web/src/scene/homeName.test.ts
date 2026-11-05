import { describe, expect, it } from 'vitest';

import { homeNames } from './homeName.ts';
import {
  FOV_DEG,
  GALAXY_FRAMING_KM,
  LIGHT_YEAR_KM,
  LOCAL_GROUP_FRAMING_KM,
  NEIGHBOURHOOD_FRAMING_KM,
} from './scale.ts';

/**
 * The Sun's point named for the breadcrumb's level that is a point from where the camera is
 * (homeName.ts), checked at each level's own framing, as Maxi went out through them.
 */
const at = (km: number) => homeNames(km, 864, FOV_DEG);

describe('the name of home from afar', () => {
  it('leaves the Sun and the Solar System to their own fold out to the nearest stars', () => {
    expect(at(NEIGHBOURHOOD_FRAMING_KM)).toEqual({ sun: 'own', centre: 'Galactic Centre' });
  });

  it('names nothing at the Sun among the neighbourhood’s stars', () => {
    expect(at(1000 * LIGHT_YEAR_KM).sun).toBe('none');
  });

  it('calls it the Solar Neighbourhood from across the galaxy', () => {
    expect(at(GALAXY_FRAMING_KM)).toEqual({ sun: 'Solar Neighbourhood', centre: 'Galactic Centre' });
  });

  it('calls the galaxy the Milky Way from the Local Group, and names nothing at the Sun', () => {
    expect(at(LOCAL_GROUP_FRAMING_KM)).toEqual({ sun: 'none', centre: 'Milky Way' });
  });

  it('goes up a level and never back down as the camera goes out', () => {
    const order = ['own', 'none', 'Solar Neighbourhood', 'none'];
    let step = 0;
    for (let ly = 1; ly < 4e7; ly *= 1.1) {
      const sun = at(ly * LIGHT_YEAR_KM).sun;
      while (order[step] !== sun) {
        step += 1;
        expect(step).toBeLessThan(order.length);
      }
    }
    expect(step).toBe(3);
  });
});
