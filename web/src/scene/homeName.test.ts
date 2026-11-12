import { describe, expect, it } from 'vitest';

import { homeNames } from './homeName.ts';
import {
  FOV_DEG,
  GALAXY_FRAMING_KM,
  LIGHT_YEAR_KM,
  LOCAL_GROUP_FRAMING_KM,
  LOCAL_VOLUME_FRAMING_KM,
  MAX_VIEW_DISTANCE_KM,
  NEIGHBOURHOOD_FRAMING_KM,
  PARSEC_KM,
  VIRGO_FRAMING_KM,
} from './scale.ts';
import { LOCAL_VOLUME_VIEW, M87_DEC_DEG, M87_RA_DEG, SUPERGALACTIC_POLE } from './supergalactic.ts';
import { equatorialDirection } from './galactic.ts';
import { equatorialToEcliptic } from './orientation.ts';

/**
 * The Sun's point named for the breadcrumb's level that is a point from where the camera is
 * (homeName.ts), checked at each level's own framing, as Maxi went out through them.
 */
const at = (km: number) => homeNames(km, 864, FOV_DEG);

describe('the name of home from afar', () => {
  it('leaves the Sun and the Solar System to their own fold out to the nearest stars', () => {
    expect(at(NEIGHBOURHOOD_FRAMING_KM)).toMatchObject({ sun: 'own', centre: 'Galactic Centre', galaxyFolded: false });
  });

  it('names nothing at the Sun among the neighbourhood’s stars', () => {
    expect(at(1000 * LIGHT_YEAR_KM).sun).toBe('none');
  });

  it('calls it the Solar Neighbourhood from across the galaxy', () => {
    expect(at(GALAXY_FRAMING_KM)).toEqual({ sun: 'Solar Neighbourhood', centre: 'Galactic Centre', arms: true, galaxyFolded: false });
  });

  it('calls the galaxy the Milky Way from the Local Group, and names nothing at the Sun', () => {
    expect(at(LOCAL_GROUP_FRAMING_KM)).toEqual({ sun: 'none', centre: 'Milky Way', arms: false, galaxyFolded: true });
  });

  it('names the galaxy the Milky Way once it is a hundred and fifty pixels across, as Maxi saw it', () => {
    // 50,000 ly at 150 px of radius on an 864 px screen: about 600,000 ly out.
    expect(at(600_000 * LIGHT_YEAR_KM)).toMatchObject({ centre: 'Milky Way', galaxyFolded: true });
    // Its arms' names go a little before.
    expect(at(350_000 * LIGHT_YEAR_KM)).toMatchObject({ arms: false, galaxyFolded: false });
  });

  it('calls the Milky Way the Local Group from the Local Volume, its galaxies’ names folded into it', () => {
    expect(at(LOCAL_VOLUME_FRAMING_KM)).toEqual({
      sun: 'none',
      centre: 'Local Group',
      arms: false,
      galaxyFolded: true,
      localGroupFolded: true,
    });
    // Its megaparsec 160 pixels in radius on an 864 px screen: 11 Mpc out.
    expect(at(8e6 * PARSEC_KM).centre).toBe('Milky Way');
    expect(at(13e6 * PARSEC_KM).centre).toBe('Local Group');
    expect(at(MAX_VIEW_DISTANCE_KM).centre).toBe('Local Group');
  });

  it('goes up a level and never back down as the camera goes out', () => {
    const order = ['own', 'none', 'Solar Neighbourhood', 'none'];
    let step = 0;
    for (let ly = 1; ly < 2e8; ly *= 1.1) {
      const sun = at(ly * LIGHT_YEAR_KM).sun;
      while (order[step] !== sun) {
        step += 1;
        expect(step).toBeLessThan(order.length);
      }
    }
    expect(step).toBe(3);
  });
});

describe('the views beyond the Local Group', () => {
  const dot = (a: readonly number[], b: { x: number; y: number; z: number }) => a[0]! * b.x + a[1]! * b.y + a[2]! * b.z;

  it('look down from the supergalactic pole, the Virgo Cluster to the right', () => {
    const { direction, up } = LOCAL_VOLUME_VIEW;
    expect(dot(direction, SUPERGALACTIC_POLE)).toBeCloseTo(1, 12);
    expect(dot(up, SUPERGALACTIC_POLE)).toBeCloseTo(0, 12);
    // right = up x direction: M87 lies along it, a few degrees out of the plane.
    const right = {
      x: up[1]! * direction[2]! - up[2]! * direction[1]!,
      y: up[2]! * direction[0]! - up[0]! * direction[2]!,
      z: up[0]! * direction[1]! - up[1]! * direction[0]!,
    };
    const m87 = equatorialToEcliptic(equatorialDirection(M87_RA_DEG, M87_DEC_DEG));
    expect(m87.x * right.x + m87.y * right.y + m87.z * right.z).toBeGreaterThan(0.99);
  });

  it('frame the Local Volume from the Sun and the Virgo Cluster from M87, inside the farthest zoom', () => {
    expect(LOCAL_VOLUME_FRAMING_KM).toBeLessThan(MAX_VIEW_DISTANCE_KM);
    expect(VIRGO_FRAMING_KM).toBeLessThan(LOCAL_VOLUME_FRAMING_KM);
    expect(LOCAL_GROUP_FRAMING_KM).toBeLessThan(VIRGO_FRAMING_KM);
  });
});
