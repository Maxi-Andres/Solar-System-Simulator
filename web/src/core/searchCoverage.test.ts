import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CATALOG } from '@sss/tools/catalog';
import type { BodyDefinition, BodyId } from '@sss/tools/types';

import { NAMES as LOCAL_ISM_NAMES } from '../scene/LocalInterstellar.tsx';
import { NAMES as LOCAL_STRUCTURE_NAMES } from '../scene/LocalStructure.tsx';
import { GALAXY_LABELS } from '../scene/MilkyWay.tsx';
import { LEVELS, type LevelId } from '../state/levels.ts';
import { ensureAuroraBodies } from './aurora.ts';
import { ensureBlackHoles, SGR_A_ID } from './blackHoles.ts';
import { parseConstellations } from './constellations.ts';
import { deepSkyOf } from './deepSky.ts';
import { constellationFeatures, featureIndex, searchFeatures, staticFeatures, streamFeatures, type FeatureEntry } from './featureSearch.ts';
import { BUBBLES } from './galacticBubbles.ts';
import { ensureHeliosphereBodies } from './heliosphere.ts';
import { ensureInterstellarClouds } from './interstellarClouds.ts';
import { ensureLagrangePoints } from './lagrange.ts';
import { ensureLandingSites } from './landingSites.ts';
import { ensureLocalGroupGiants } from './localGroup.ts';
import { ensureMagnetosphereBodies } from './magnetosphere.ts';
import { ensureMessierObjects } from './messier.ts';
import { ensureMeteorShowers } from './meteorShowers.ts';
import { ensureNebulae } from './nebulae.ts';
import { ensureNotableStars } from './notableStars.ts';
import { recordHolderAliases, ensureRecordHolders } from './recordHolders.ts';
import { regionOf } from './regions.ts';
import { makeStore } from './satelliteTestFixtures.ts';
import { BLACK_HOLE_ALIASES, searchBodies, starQuery } from './search.ts';
import { ensureSupernovaRemnants, remnantOf } from './supernovaRemnants.ts';
import type { StreamsFile } from './streams.ts';
import { levelEntries, searchSystems, systemEntries } from './systemSearch.ts';
import { J2000_JD } from './time.ts';

/**
 * Everything the app draws with a name must be found by searching that name (Maxi, 2026-11-23:
 * "Milky Way" could not be found, nor the arms, the bubbles, the constellations, the streams).
 * This walks the sources the names on screen come from -- the bodies every layer makes, the map
 * names drawn over the scene (scene/sceneLabels.ts and the Milky Way model's), the breadcrumb's
 * levels -- and searches each name, and each other name it is known by, as the search panel does.
 * A new layer whose names are not searchable fails here.
 */

const PUBLIC = fileURLToPath(new URL('../../public/', import.meta.url));

/** Whether `id` is among the first results for `query`: the bodies' search, as the panel runs it. */
function finds(bodies: readonly BodyDefinition[], query: string, id: BodyId): boolean {
  return searchBodies(bodies, query, 50).some((result) => result.body.id === id);
}

describe('every body the layers make is found by its name and its other names', () => {
  // Every layer's bodies, as App.tsx makes them at start.
  const store = makeStore();
  ensureBlackHoles(store);
  ensureSupernovaRemnants(store);
  ensureNebulae(store);
  ensureMessierObjects(store);
  ensureNotableStars(store);
  ensureLocalGroupGiants(store);
  ensureLagrangePoints(store);
  ensureHeliosphereBodies(store);
  ensureMagnetosphereBodies(store);
  ensureAuroraBodies(store, (jd) => jd);
  ensureMeteorShowers(store);
  ensureInterstellarClouds(store);
  ensureLandingSites(store, () => J2000_JD);
  ensureRecordHolders(store);
  const bodies = [...store.bodies];

  it('makes some of each', () => {
    expect(bodies.length).toBeGreaterThan(150);
  });

  it('finds each by its name', () => {
    const missed = bodies.filter((body) => !finds(bodies, body.name, body.id)).map((body) => body.name);
    expect(missed).toEqual([]);
  });

  it('finds each by its other names: catalogue names, Messier numbers, designations, aliases', () => {
    const missed: string[] = [];
    for (const body of bodies) {
      const others = [
        ...(deepSkyOf(body.id)?.aliases ?? []),
        ...(regionOf(body.id)?.aliases ?? []),
        ...(remnantOf(body.id)?.otherNames ?? []),
        ...(remnantOf(body.id) === null ? [] : [remnantOf(body.id)!.green]),
        ...(BLACK_HOLE_ALIASES.get(body.id) ?? []),
        ...(body.kind === 'structure' ? recordHolderAliases(body.id).split(/\s*\|\s*|,\s*/).filter((name) => name !== '') : []),
      ];
      for (const name of others) if (!finds(bodies, name, body.id)) missed.push(`${body.name}: ${name}`);
    }
    expect(missed).toEqual([]);
  });

  it('finds the Galactic Centre, named on the Milky Way model, as Sgr A*', () => {
    expect(BLACK_HOLE_ALIASES.has(SGR_A_ID)).toBe(true);
    expect(searchBodies(bodies, 'Galactic Centre')[0]?.body.id).toBe(SGR_A_ID);
    expect(searchBodies(bodies, 'Sagittarius A*')[0]?.body.id).toBe(SGR_A_ID);
  });

  it('puts the body another name is typed whole of first: "M1" the Crab, not M17 or M18', () => {
    expect(searchBodies(bodies, 'M1')[0]?.body.name).toBe('Crab Nebula');
    expect(searchBodies(bodies, 'Cas A')[0]?.body.name).toBe('Cassiopeia A');
  });

  it('finds the catalog’s planets, moons, dwarf planets, asteroids, comets and spacecraft', () => {
    const missed = CATALOG.filter((body) => !finds(CATALOG, body.name, body.id)).map((body) => body.name);
    expect(missed).toEqual([]);
  });
});

describe('every name drawn over the scene that is no body is found', () => {
  const index = featureIndex(staticFeatures());
  const found = (name: string, features = index): FeatureEntry | undefined =>
    searchFeatures(features, name).find((match) => match.entry.name === name || match.entry.otherNames.includes(name))?.entry;

  it('the Milky Way model’s: its arms and its bar (its centre is Sgr A*’s, above)', () => {
    for (const name of GALAXY_LABELS.filter((label) => label !== 'Galactic Centre')) expect(found(name), name).toBeDefined();
    expect(found('Orion Arm')?.name).toBe('Local Arm');
  });

  it('the galactic bubbles, the Local Bubble and its neighbours, the Local Group’s structure', () => {
    for (const name of [...BUBBLES.map((bubble) => bubble.name), ...LOCAL_ISM_NAMES]) expect(found(name), name).toBeDefined();
    // Written with what they are after them on the scene: "Council of Giants · McCall 2014".
    for (const label of LOCAL_STRUCTURE_NAMES) {
      const name = label.split(' · ')[0]!;
      expect(found(name), name).toBeDefined();
    }
  });

  it('the shells named on the heliosphere and the magnetosphere that are no region, and the CMB', () => {
    for (const name of ['Hills cloud', 'Van Allen belts', 'Kármán line', 'Karman line', 'Cosmic microwave background', 'CMB']) {
      expect(searchFeatures(index, name).length, name).toBeGreaterThan(0);
    }
    expect(searchFeatures(index, 'cosmic microwave background')[0]?.entry.about).toBe('cosmic-microwave-background');
  });

  const constellationsFile = PUBLIC + 'data/constellations.json';
  it.skipIf(!existsSync(constellationsFile))('every constellation, by every name its labels write', () => {
    const catalog = parseConstellations(JSON.parse(readFileSync(constellationsFile, 'utf8')));
    const features = constellationFeatures(catalog);
    const local = featureIndex(features);
    expect(features.length).toBeGreaterThanOrEqual(88);
    for (const feature of features) expect(found(feature.name, local), feature.name).toBeDefined();
    expect(searchFeatures(local, 'orion')[0]?.entry.name).toBe('Orion');
  });

  const streamsFile = PUBLIC + 'streams/tracks.json';
  it.skipIf(!existsSync(streamsFile))('every stellar stream', () => {
    const file = JSON.parse(readFileSync(streamsFile, 'utf8')) as StreamsFile;
    const features = streamFeatures(file);
    const local = featureIndex(features);
    expect(features.length).toBe(file.streams.length);
    for (const feature of features) {
      expect(found(feature.name, local), feature.name).toBeDefined();
      if (feature.go.kind === 'frame') expect(feature.go.km, feature.name).toBeGreaterThan(0);
    }
  });
});

describe('every breadcrumb level is found', () => {
  it('by its name, as a level or as the star system it is', () => {
    const entries = [...systemEntries([]), ...levelEntries()];
    for (const level of Object.keys(LEVELS) as LevelId[]) {
      // The planetary system's level is whichever system the focus is in: found by that system's name.
      if (level === 'planetary-system') continue;
      expect(searchSystems(entries, LEVELS[level].name)[0]?.entry.name, level).toBe(LEVELS[level].name);
    }
  });
});

it('reads "Gliese 710" as the star names write it', () => {
  expect(starQuery('Gliese 710')).toBe('GJ 710');
  expect(starQuery('gliese710')).toBe('GJ 710');
  expect(starQuery('Gliese')).toBe('Gliese');
});
