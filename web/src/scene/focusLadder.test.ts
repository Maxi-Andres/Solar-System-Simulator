import type { BodyDefinition, BodyId } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { getBody } from '@sss/tools/catalog';

import { ladderLevel, sunLadder, type LevelId } from '../state/levels.ts';
import { focusLadder, onLadder } from './focusLadder.ts';
import { AU_KM, LIGHT_YEAR_KM } from './scale.ts';

/** A store of just these bodies, by id. */
function storeOf(...bodies: BodyDefinition[]) {
  const byId = new Map(bodies.map((body) => [body.id, body] as const));
  return { body: (id: BodyId) => byId.get(id)! };
}

const like = (id: string, kind: BodyDefinition['kind'], radiusKm: number, parent: BodyId | null = null): BodyDefinition => ({
  ...getBody('sun'),
  id,
  name: id,
  kind,
  parent,
  radiusEquatorialKm: radiusKm,
  radiusPolarKm: radiusKm,
});

const levels = (id: BodyId, ...bodies: BodyDefinition[]): (LevelId | null)[] =>
  focusLadder(storeOf(...bodies), id).map((rung) => rung.level);

/** The level the camera `km` from `id` is at, coming from none. */
const at = (id: BodyId, km: number, ...bodies: BodyDefinition[]): LevelId | null =>
  ladderLevel(focusLadder(storeOf(...bodies), id), null, km);

describe('every focus’s ladder', () => {
  it('is the Sun’s for the Sun and for anything of the Solar System', () => {
    expect(focusLadder(storeOf(getBody('sun')), 'sun')).toBe(sunLadder());
    expect(focusLadder(storeOf(getBody('earth'), getBody('sun')), 'earth')).toBe(sunLadder());
    expect(focusLadder(storeOf(getBody('moon'), getBody('earth')), 'moon')).toBe(sunLadder());
    // Earth close is Earth; zoomed out past the Sun's boundary, the Solar System, then on up.
    expect(at('earth', 0.1 * AU_KM, getBody('earth'))).toBeNull();
    expect(at('earth', 10 * AU_KM, getBody('earth'))).toBe('solar-system');
    expect(at('earth', 100 * LIGHT_YEAR_KM, getBody('earth'))).toBe('solar-neighbourhood');
  });

  it('runs a planetary system’s planet up through its system, the Solar Neighbourhood and the Milky Way', () => {
    const planet = like('tau-ceti-e', 'planet', 10_000);
    expect(levels('tau-ceti-e', planet)).toEqual([
      null,
      'planetary-system',
      'solar-neighbourhood',
      'milky-way',
      'local-group',
      'local-volume',
      'nearby-universe',
      'observable-universe',
    ]);
    expect(at('tau-ceti-e', 0.1 * AU_KM, planet)).toBeNull();
    expect(at('tau-ceti-e', 10 * AU_KM, planet)).toBe('planetary-system');
    expect(at('tau-ceti-e', 100 * LIGHT_YEAR_KM, planet)).toBe('solar-neighbourhood');
    expect(at('tau-ceti-e', 20_000 * LIGHT_YEAR_KM, planet)).toBe('milky-way');
    expect(at('tau-ceti-e', 5e6 * LIGHT_YEAR_KM, planet)).toBe('local-group');
  });

  it('starts a nebula at the Milky Way, and a galaxy of the Local Group at the Local Group', () => {
    const nebula = like('nebula-test', 'nebula', 10 * LIGHT_YEAR_KM);
    expect(levels('nebula-test', nebula)).toEqual([null, 'milky-way', 'local-group', 'local-volume', 'nearby-universe', 'observable-universe']);
    const galaxy = like('galaxy-test', 'galaxy', 50_000 * LIGHT_YEAR_KM);
    expect(levels('galaxy-test', galaxy)).toEqual([null, 'local-group', 'local-volume', 'nearby-universe', 'observable-universe']);
    expect(at('galaxy-test', 100_000 * LIGHT_YEAR_KM, galaxy)).toBeNull();
    expect(at('galaxy-test', 8e6 * LIGHT_YEAR_KM, galaxy)).toBe('local-group');
  });

  it('starts a lone star at the Solar Neighbourhood, with no system of its own', () => {
    const star = like('star-0-1', 'star', 695_700);
    expect(levels('star-0-1', star)[1]).toBe('solar-neighbourhood');
  });

  it('climbs outward, each rung farther than the last, and never names Laniakea or the Virgo Cluster', () => {
    const cases: [BodyId, BodyDefinition][] = [
      ['sun', getBody('sun')],
      ['tau-ceti-e', like('tau-ceti-e', 'planet', 10_000)],
      ['nebula-test', like('nebula-test', 'nebula', 10 * LIGHT_YEAR_KM)],
      ['galaxy-test', like('galaxy-test', 'galaxy', 50_000 * LIGHT_YEAR_KM)],
      // A body framed from farther than a rung: that rung is left out, not crossed backwards.
      ['galaxy-huge', like('galaxy-huge', 'galaxy', 2e6 * LIGHT_YEAR_KM)],
    ];
    for (const [id, body] of cases) {
      const rungs = focusLadder(storeOf(body), id);
      for (let k = 1; k < rungs.length; k += 1) expect(rungs[k]!.km, `${id} ${k}`).toBeGreaterThan(rungs[k - 1]!.km);
      expect(onLadder(rungs, 'laniakea'), id).toBe(false);
      expect(onLadder(rungs, 'virgo-cluster'), id).toBe(false);
    }
    expect(levels('galaxy-huge', like('galaxy-huge', 'galaxy', 2e6 * LIGHT_YEAR_KM))[1]).toBe('local-volume');
  });
});
