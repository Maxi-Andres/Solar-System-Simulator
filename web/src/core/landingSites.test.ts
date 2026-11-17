import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';
import { directionToGeographic, poleDirection, primeMeridianDirection } from '../scene/orientation.ts';
import { EphemerisStore } from './ephemerisStore.ts';
import {
  ensureLandingSites,
  LANDING_SITES,
  landingJd,
  landingSiteFraming,
  landingSiteOf,
  landingSiteState,
  landingSiteVisibility,
  SHOWN_FULL_PX,
} from './landingSites.ts';
import { regionOf } from './regions.ts';
import { layersFor } from './search.ts';
import { J2000_JD } from './time.ts';
import { cross, dot, length, scale, type Vec3 } from './vec3.ts';

/** 2026-11-17, and half a sidereal month on: any instants do, the Moon has turned between them. */
const JDS = [J2000_JD + 9817.5, J2000_JD + 9817.5 + 13.66];

function storeWithHosts(): EphemerisStore {
  return new EphemerisStore({
    manifest: { bodies: [], tables: {} },
    bodies: ['sun', 'earth', 'moon', 'mars'].map((id) => getBody(id)),
    vectors: new Map(),
    elements: new Map(),
    generatedAt: new Date(0),
  } as unknown as ConstructorParameters<typeof EphemerisStore>[0]);
}

function site(id: string) {
  const found = landingSiteOf(id);
  if (found === null) throw new Error(id);
  return found;
}

/** A position in the host's own frame: x the prime meridian, z the IAU north pole. */
function bodyFixed(position: Vec3, hostId: string, jd: number): Vec3 {
  const host = getBody(hostId);
  const pole = poleDirection(jd, host);
  const meridian = primeMeridianDirection(jd, host);
  const east = cross(pole, meridian);
  return { x: dot(position, meridian), y: dot(position, east), z: dot(position, pole) };
}

describe('the landing sites', () => {
  it('are each one place, on the Moon or Mars, with a source', () => {
    expect(new Set(LANDING_SITES.map((s) => s.id)).size).toBe(LANDING_SITES.length);
    expect(new Set(LANDING_SITES.map((s) => s.name)).size).toBe(LANDING_SITES.length);
    for (const s of LANDING_SITES) {
      expect(Math.abs(s.latitudeDeg), s.id).toBeLessThanOrEqual(90);
      expect(s.longitudeDeg, s.id).toBeGreaterThanOrEqual(0);
      expect(s.longitudeDeg, s.id).toBeLessThan(360);
      expect(s.source.length, s.id).toBeGreaterThan(5);
      expect(Number.isFinite(landingJd(s)), s.id).toBe(true);
    }
  });

  it('put Apollo 11 where LROC measured it, in the Moon’s own frame', () => {
    // 0.67416 N, 23.47314 E on the 1,737.4 km sphere, worked out by hand:
    // R cos(lat) cos(lon), R cos(lat) sin(lon), R sin(lat).
    const store = storeWithHosts();
    for (const jd of JDS) {
      const local = bodyFixed(landingSiteState(store, site('site-apollo-11'), jd).position, 'moon', jd);
      expect(local.x).toBeCloseTo(1593.514, 2);
      expect(local.y).toBeCloseTo(691.992, 2);
      expect(local.z).toBeCloseTo(20.442, 2);
    }
  });

  it('put Viking 1 on Mars’s ellipsoid at its HiRISE latitude and longitude', () => {
    const store = storeWithHosts();
    const viking = site('site-viking-1');
    for (const jd of JDS) {
      const position = landingSiteState(store, viking, jd).position;
      const local = bodyFixed(position, 'mars', jd);
      // Planetocentric: the angle at the centre, east of the IAU prime meridian.
      expect(Math.atan2(local.y, local.x) * (180 / Math.PI) + 360).toBeCloseTo(312.0495, 6);
      expect(Math.asin(local.z / length(local)) * (180 / Math.PI)).toBeCloseTo(22.2692, 6);
      // Between Mars's polar and equatorial radii, as the ellipsoid is there.
      expect(length(position)).toBeGreaterThan(3376.2);
      expect(length(position)).toBeLessThan(3396.19);
    }
  });

  it('turn with their body: every one is at its published place at any instant', () => {
    const store = storeWithHosts();
    for (const s of LANDING_SITES) {
      for (const jd of JDS) {
        const geographic = directionToGeographic(landingSiteState(store, s, jd).position, jd, getBody(s.host));
        expect(geographic.latitudeDeg, s.id).toBeCloseTo(s.latitudeDeg, 6);
        expect(((geographic.longitudeDeg % 360) + 360) % 360, s.id).toBeCloseTo(s.longitudeDeg, 6);
      }
    }
  });

  it('become bodies about their host from the landing on, found by search with their layer', () => {
    const store = storeWithHosts();
    const jd = JDS[0]!;
    ensureLandingSites(store, () => jd);
    ensureLandingSites(store, () => jd);
    for (const s of LANDING_SITES) {
      expect(store.isPropagatedBody(s.id), s.id).toBe(true);
      expect(store.body(s.id).parent, s.id).toBe(s.host);
      expect(regionOf(s.id)?.layer, s.id).toBe('landing-site');
    }
    const apollo = site('site-apollo-11');
    expect(store.localState(apollo.id, landingJd(apollo) - 1)).toBeNull();
    const state = store.localState(apollo.id, jd);
    expect(state).not.toBeNull();
    expect(length(state!.position)).toBeCloseTo(1737.4, 6);
    expect(layersFor(store.body('site-apollo-11'))).toEqual(['moons', 'landingSites']);
    expect(layersFor(store.body('site-viking-1'))).toEqual(['landingSites']);
  });

  it('are framed from straight above, north up', () => {
    const store = storeWithHosts();
    const jd = JDS[0]!;
    ensureLandingSites(store, () => jd);
    const framing = landingSiteFraming('site-apollo-17');
    expect(framing).not.toBeNull();
    const up = landingSiteState(store, site('site-apollo-17'), jd).position;
    const [x, y, z] = framing!.view!.direction;
    expect(dot({ x, y, z }, scale(up, 1 / length(up)))).toBeCloseTo(1, 6);
    expect(landingSiteFraming('moon')).toBeNull();
  });
});

describe('a landing site on the screen', () => {
  const host: Vec3 = { x: 0, y: 0, z: 0 };
  const near: Vec3 = { x: 1737.4, y: 0, z: 0 };
  const far: Vec3 = { x: -1737.4, y: 0, z: 0 };

  it('shows once its body is large, and only on the side the camera sees', () => {
    // The Moon from 4,000 km: hundreds of pixels across on a 1,000 px screen.
    const close: Vec3 = { x: 4_000, y: 0, z: 0 };
    expect(landingSiteVisibility(host, near, 1737.4, close, 1000, 45)).toBe(1);
    expect(landingSiteVisibility(host, far, 1737.4, close, 1000, 45)).toBe(0);
  });

  it('is gone while its body is small', () => {
    // From Earth's distance the Moon is a few dozen pixels across.
    const fromEarth: Vec3 = { x: 384_400, y: 0, z: 0 };
    expect(landingSiteVisibility(host, near, 1737.4, fromEarth, 1000, 45)).toBe(0);
    expect(SHOWN_FULL_PX).toBeGreaterThan(100);
  });
});
