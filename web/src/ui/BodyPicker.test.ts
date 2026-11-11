import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { GAIA_BH1, S2_ID, SGR_A_ID } from '../core/blackHoles.ts';
import type { EphemerisStore } from '../core/ephemerisStore.ts';
import { PLANETARY_SYSTEMS } from '../core/planetarySystems.ts';
import { addStarRecordBody, type StarEntry } from '../core/starBodies.ts';
import { STAR3D_FLOATS, type Stars3dSource } from '../core/stars3d.ts';
import { crumbMenuFor } from './BodyPicker.tsx';

/**
 * What the focused body's crumb drops down, for every kind of focus there is: the system it
 * is in, or nothing for a place on its own -- never the Solar System's bodies from outside it.
 * The catalogue stars are made bodies through the real path, so the facts Alpha Centauri and
 * the planetary systems are recognised by are the ones the app records.
 */

function body(id: BodyId, kind: BodyDefinition['kind'], parent: BodyId | null = null): BodyDefinition {
  return {
    id,
    name: id,
    horizonsId: '',
    center: '',
    elementsCenter: '',
    stepDays: 0,
    vectorWindow: 'full',
    parent,
    kind,
    radiusEquatorialKm: 1,
    radiusPolarKm: 1,
    gmKm3S2: 0,
    gmBodyOnlyKm3S2: 0,
    rotationPeriodHours: null,
    axialTiltDeg: null,
    rotation: null,
    triaxialRadiiKm: null,
    color: '#ffffff',
    drawOrbit: false,
    textures: null,
    rings: null,
    mission: null,
  };
}

// A store that takes the star bodies and keeps nothing, and a record a parsec off the Sun:
// the facts addStarRecordBody records are all that is read here.
const store = {
  isPropagatedBody: () => false,
  addPropagatedBody: () => undefined,
  removePropagatedBody: () => undefined,
} as unknown as EphemerisStore;
const source = {
  record: async () => new Float32Array(STAR3D_FLOATS).fill(1),
} as unknown as Stars3dSource;

async function star(index: number, designations: readonly string[], system: string | null): Promise<BodyDefinition> {
  const entry: StarEntry = { display: designations[0]!, iau: false, designations, system, nearest: null, spectralType: null };
  const id = await addStarRecordBody(store, source, 0, index, entry, '', true);
  return body(id, 'star');
}

const proxima = await star(1, ['Proxima Cen'], 'Alpha Centauri');
const tauCeti = await star(2, [PLANETARY_SYSTEMS.find((system) => system.key === 'tau-ceti')!.hostDesignation], null);
const vega = await star(3, ['alf Lyr'], null);

describe('crumbMenuFor', () => {
  it('drops down the Solar System for anything of the Sun’s', () => {
    for (const focus of [
      body('sun', 'star'),
      body('earth', 'planet'),
      body('moon', 'moon', 'earth'),
      body('pluto', 'dwarf-planet'),
      body('ceres', 'asteroid'),
      body('halley', 'comet'),
      body('voyager-1', 'spacecraft'),
      body('jwst', 'spacecraft', 'earth'),
      body('iss', 'satellite', 'earth'),
    ]) {
      expect(crumbMenuFor(focus), focus.id).toBe('solar-system');
    }
  });

  it('has no list for a galaxy: the Local Group’s, just before it, lists it', () => {
    expect(crumbMenuFor(body('galaxy-smc', 'galaxy'))).toBe('none');
    expect(crumbMenuFor(body('galaxy-draco', 'galaxy'))).toBe('none');
  });

  it('has none for a pulsar, a cluster or a remnant: the Milky Way’s lists them', () => {
    expect(crumbMenuFor(body('pulsar-1', 'neutron-star'))).toBe('none');
    expect(crumbMenuFor(body('globular-cluster-1', 'globular-cluster'))).toBe('none');
    expect(crumbMenuFor(body('remnant-crab', 'supernova-remnant'))).toBe('none');
  });

  it('has none for a star of the neighbourhood on its own: the Solar Neighbourhood’s lists it', () => {
    expect(crumbMenuFor(vega)).toBe('none');
  });

  it('drops down a black hole’s system for it and for the star about it', () => {
    expect(crumbMenuFor(body(SGR_A_ID, 'black-hole'))).toBe('black-hole');
    expect(crumbMenuFor(body(S2_ID, 'star', SGR_A_ID))).toBe('black-hole');
    expect(crumbMenuFor(body(GAIA_BH1.id, 'black-hole'))).toBe('black-hole');
    expect(crumbMenuFor(body(GAIA_BH1.starId, 'star', GAIA_BH1.id))).toBe('black-hole');
  });

  it('drops down Alpha Centauri for its stars and their planets', () => {
    expect(crumbMenuFor(proxima)).toBe('alpha-centauri');
    expect(crumbMenuFor(body('proxima-b', 'planet', proxima.id))).toBe('alpha-centauri');
  });

  it('drops down a planetary system for its star and its planets', () => {
    expect(crumbMenuFor(tauCeti)).toBe('planetary-system');
    expect(crumbMenuFor(body('tau-ceti-g', 'planet', tauCeti.id))).toBe('planetary-system');
  });
});
