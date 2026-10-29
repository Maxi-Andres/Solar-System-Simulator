import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { buildExoplanets } from '@sss/tools/exoplanets';
import { parseArchiveCsv } from '@sss/tools/exoplanets/archive';
import type { ExoplanetCatalog } from '@sss/tools/types';
import { describe, expect, it } from 'vitest';

import { hostMarkers, nearestMarker } from '../scene/ExoplanetHosts.tsx';
import { searchNames } from './beltNames.ts';
import { describeWithData as withData } from './describeWithData.ts';
import {
  archivePlanet,
  archiveSystem,
  CURATED_HOSTS,
  indexExoplanets,
  keplerMassSun,
  parseExoplanetCatalog,
  searchEntry,
} from './exoplanetArchive.ts';
import { skyOffsetKm, type ExoPlanet } from './exoplanets.ts';

/**
 * The Archive's planets as the app reads them, from the generator's own output for the
 * real rows in tools/src/exoplanets/__fixtures__/pscomppars.csv (a verbatim excerpt of the
 * Archive's answer of 2026-10-29), round-tripped through JSON as the app receives it.
 */

const AU_KM = 149_597_870.7;
const csv = await readFile(join(import.meta.dirname, '../../../tools/src/exoplanets/__fixtures__/pscomppars.csv'), 'utf8');
const catalog = parseExoplanetCatalog(
  JSON.parse(JSON.stringify(buildExoplanets({ rows: parseArchiveCsv(csv), queriedAt: 'test', stars: null }))),
);
const host = (name: string): number => catalog.hosts.name.indexOf(name);
const planetIndex = (name: string): number => catalog.planets.name.indexOf(name);
const planetOf = (name: string): ExoPlanet => {
  const p = planetIndex(name);
  const h = catalog.planets.host[p]!;
  return archivePlanet(catalog, p, catalog.hosts.massSun[h]!)!;
};

describe('TRAPPIST-1 from the Archive', () => {
  const system = archiveSystem(catalog, host('TRAPPIST-1'), true);

  it('has its seven planets, in order, each with its transit radius and tilt', () => {
    expect(system.planets.map((p) => p.name)).toEqual(
      ['b', 'c', 'd', 'e', 'f', 'g', 'h'].map((letter) => `TRAPPIST-1 ${letter}`),
    );
    for (const planet of system.planets) {
      expect(planet.status).toBe('confirmed');
      expect(planet.radiusEarth).toBeGreaterThan(0.7);
      expect(planet.radiusEarth).toBeLessThan(1.2);
      expect(planet.inclinationDeg).toBeGreaterThan(89.5);
      expect(planet.phase.kind).toBe('conjunction');
      expect(planet.massIsMinimum).toBe(false);
    }
    // Agol et al. 2021: e 0.920 Earth radii, 0.692 Earth masses.
    expect(system.planets[3]!.radiusEarth).toBe(0.92);
    expect(system.planets[3]!.massEarth).toBe(0.692);
  });

  it('has its star at the Archive’s radius and mass', () => {
    expect(system.hostRadiusSun).toBe(0.1192);
    expect(system.hostMassSun).toBe(0.0898);
    expect(system.hostRadiusReference).toBe('Agol et al. 2021');
    expect(system.archive?.listed).toBe(7);
  });

  it('puts each planet in front of its star at its transit midpoint', () => {
    for (const planet of system.planets) {
      const jd = planet.phase.kind === 'conjunction' ? planet.phase.jd : Number.NaN;
      const at = skyOffsetKm(planet, jd);
      const r = Math.hypot(at.east, at.north, at.away);
      expect(at.away / r, planet.name).toBeLessThan(-0.999);
    }
  });

  it('agrees with Kepler’s third law about the Archive’s mass, to its rounding', () => {
    for (const planet of system.planets) {
      expect(keplerMassSun(planet.semiMajorAxisAu, planet.periodDays) / 0.0898, planet.name).toBeCloseTo(1, 1);
    }
  });
});

describe('the argument of periastron', () => {
  it('is the Archive’s plus half a turn: HD 80606 b passes periastron when Pearson et al. say', () => {
    // e = 0.932, omega -58.887, periastron 2458882.344 and transit 2458888.07466 BJD, all
    // Pearson et al. 2022. Placed by its transit, it must be at periastron 5.73 days before.
    const planet = planetOf('HD 80606 b');
    expect(planet.argPeriastronDeg).toBeCloseTo(-58.887 + 180, 6);
    const at = skyOffsetKm(planet, 2458882.344);
    const r = Math.hypot(at.east, at.north, at.away);
    const periastron = planet.semiMajorAxisAu * (1 - planet.eccentricity) * AU_KM;
    expect(r / periastron).toBeCloseTo(1, 2);
    // And the other reading would not have it there: half a turn on, it is far out.
    const other = skyOffsetKm({ ...planet, argPeriastronDeg: -58.887 }, 2458882.344);
    expect(Math.hypot(other.east, other.north, other.away) / periastron).toBeGreaterThan(5);
  });
});

describe('what the Archive leaves out', () => {
  it('draws an eccentricity published as a limit circular: 51 Pegasi b', () => {
    expect(planetOf('51 Peg b').eccentricity).toBe(0);
  });

  it('places a planet with no transit time by its periastron time, flagged as disputed', () => {
    const g = planetOf('HD 219134 g');
    expect(g.phase.kind).toBe('periastron');
    expect(g.status).toBe('disputed');
    expect(g.name).toBe('HD 219134 g (disputed)');
    expect(g.massIsMinimum).toBe(true);
  });

  it('gives a microlensing planet with no period one from Kepler’s third law', () => {
    // Gaia22dkvL b (Wu et al. 2024): 1.4 AU about a 1.145-solar-mass star, no period.
    const p = planetIndex('Gaia22dkvL b');
    const planet = archivePlanet(catalog, p, 1.145)!;
    expect(planet.semiMajorAxisAu).toBe(1.4);
    expect(planet.periodDays).toBeCloseTo(Math.sqrt(1.4 ** 3 / 1.145) * 365.25, 6);
    expect(planet.phase.kind).toBe('unknown');
    // No radius from a transit: drawn at the estimate from its mass.
    expect(planet.radiusEarth).toBeNull();
  });

  it('calls a mass from the radius an estimate, and a transit radius measured', () => {
    const kepler = planetOf('Kepler-452 b');
    expect(kepler.massNote).toBe('estimate');
    expect(kepler.radiusEarth).toBe(1.63);
    expect(kepler.status).toBe('disputed');
  });

  it('cannot draw a planet with no period and no star’s mass to find one by', () => {
    const p = planetIndex('Gaia22dkvL b');
    expect(archivePlanet(catalog, p, null)).toBeNull();
  });
});

describe('finding them', () => {
  const index = indexExoplanets(catalog);

  it('finds a host by name or designation, and a planet by its name', () => {
    const [best] = searchNames(index.search, 'trappist', 5);
    expect(searchEntry(catalog, best!.k)).toEqual({ host: host('TRAPPIST-1'), planet: null });
    const [planet] = searchNames(index.search, 'TRAPPIST-1 e', 5);
    expect(searchEntry(catalog, planet!.k)).toEqual({ host: host('TRAPPIST-1'), planet: planetIndex('TRAPPIST-1 e') });
    const [byHd] = searchNames(index.search, 'HD 10700', 5);
    expect(searchEntry(catalog, byHd!.k).host).toBe(host('tau Cet'));
  });

  it('marks every placed host once, with its planet count', () => {
    const markers = hostMarkers(catalog);
    expect(markers.count).toBe(catalog.hosts.count);
    const trappist = [...markers.host].indexOf(host('TRAPPIST-1'));
    expect(markers.planets[trappist]).toBe(7);
  });

  it('picks the marker nearest a click, within reach', () => {
    const screen = new Float64Array([100, 100, 104, 100, Number.NaN, Number.NaN]);
    expect(nearestMarker(screen, 103, 101, 9)).toBe(1);
    expect(nearestMarker(screen, 200, 200, 9)).toBeNull();
  });

  it('knows the curated systems’ hosts by their Archive names', () => {
    for (const name of ['Proxima Cen', 'tau Cet', '51 Peg']) {
      expect(CURATED_HOSTS[name]).toBeDefined();
      expect(host(name)).toBeGreaterThanOrEqual(0);
    }
  });
});

/** The real file, where a run has written one. */
async function tryLoad(): Promise<ExoplanetCatalog | null> {
  try {
    return parseExoplanetCatalog(
      JSON.parse(await readFile(join(import.meta.dirname, '../../public/data/exoplanets.json'), 'utf8')),
    );
  } catch {
    return null;
  }
}
const published = await tryLoad();
const describeWithData = withData(published !== null);

describeWithData('the published Archive', () => {
  const data = published!;
  const at = (name: string): number => data.hosts.name.indexOf(name);

  it('names every curated host as the Archive does', () => {
    for (const name of Object.keys(CURATED_HOSTS)) {
      expect(at(name), name).toBeGreaterThanOrEqual(0);
    }
  });

  it('has TRAPPIST-1 among the 3D stars, with seven drawable planets', () => {
    const h = at('TRAPPIST-1');
    expect(data.hosts.tier[h]).toBeGreaterThanOrEqual(0);
    expect(archiveSystem(data, h, false).planets).toHaveLength(7);
  });
});
