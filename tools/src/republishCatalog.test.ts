import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CATALOG, getBody } from './catalog.ts';
import { republishCatalog } from './republishCatalog.ts';
import type { BodyDefinition } from './types.ts';

/**
 * `pnpm write:catalog` against a data directory made for the occasion.
 *
 * The directory is what fetch:data would have written for three startup bodies and one
 * planet's small moons, with the catalog as it was then -- and the tests then change the
 * catalog the way a texture commit does, or the way only a fetch can answer.
 */

const STARTUP = ['sun', 'earth', 'ceres'];
const SMALL = CATALOG.filter((body) => body.parent === 'jupiter' && body.sampling !== undefined)
  .slice(0, 3)
  .map((body) => body.id);

let dir: string;

const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const compact = (value: unknown) => `${JSON.stringify(value)}\n`;
const read = (path: string) => readFile(join(dir, path), 'utf8');

/** The catalog as it was when the directory was fetched: Ceres without its map. */
function catalogThen(): BodyDefinition[] {
  return CATALOG.map((body) => (body.id === 'ceres' ? { ...body, textures: null } : body));
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'sss-catalog-'));
  const then = new Map(catalogThen().map((body) => [body.id, body]));
  await mkdir(join(dir, 'small-moons'));
  await mkdir(join(dir, 'vectors'));
  await writeFile(
    join(dir, 'manifest.json'),
    pretty({ bodies: STARTUP, tables: {}, smallMoons: { jupiter: { count: 3, sized: 3 } } }),
  );
  await writeFile(join(dir, 'bodies.json'), pretty(STARTUP.map((id) => then.get(id))));
  await writeFile(
    join(dir, 'small-moons', 'jupiter.json'),
    compact({
      bodies: SMALL.map((id) => then.get(id)),
      elements: Object.fromEntries(SMALL.map((id) => [id, { id, eccentricity: 0.001 }])),
      tables: Object.fromEntries(SMALL.map((id) => [id, { startJd: 1, stopJd: 2, chunks: [] }])),
    }),
  );
  await writeFile(join(dir, 'vectors', 'earth.json'), '{"t":[1,2]}\n');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('republishCatalog', () => {
  it('writes nothing when the catalog has not changed', async () => {
    const before = await stat(join(dir, 'bodies.json'));
    const report = await republishCatalog(dir, catalogThen());

    expect(report.written).toEqual([]);
    expect(report.changed).toEqual([]);
    expect(report.checked).toBe(STARTUP.length + SMALL.length);
    expect((await stat(join(dir, 'bodies.json'))).mtimeMs).toBe(before.mtimeMs);
  });

  it('publishes a new surface map, and only that', async () => {
    const manifest = await read('manifest.json');
    const bundle = await read('small-moons/jupiter.json');
    const vectors = await read('vectors/earth.json');

    const report = await republishCatalog(dir, CATALOG);

    expect(report.written).toEqual(['bodies.json']);
    expect(report.changed).toEqual([{ id: 'ceres', fields: ['textures'] }]);
    const bodies = JSON.parse(await read('bodies.json')) as BodyDefinition[];
    expect(bodies.map((body) => body.id)).toEqual(STARTUP);
    expect(bodies[2]!.textures?.illustrative.file).toBe('ceres.jpg');
    // Byte for byte what fetch:data writes for the same catalog.
    expect(await read('bodies.json')).toBe(pretty(STARTUP.map((id) => getBody(id))));
    // Everything that is not a definition is untouched.
    expect(await read('manifest.json')).toBe(manifest);
    expect(await read('small-moons/jupiter.json')).toBe(bundle);
    expect(await read('vectors/earth.json')).toBe(vectors);
  });

  it("rewrites a small-moon bundle's definitions and keeps its elements and tables", async () => {
    const id = SMALL[1]!;
    const catalog = catalogThen().map((body) => (body.id === id ? { ...body, color: '#123456' } : body));
    const before = JSON.parse(await read('small-moons/jupiter.json'));

    const report = await republishCatalog(dir, catalog);

    expect(report.written).toEqual(['small-moons/jupiter.json']);
    expect(report.changed).toEqual([{ id, fields: ['color'] }]);
    const after = JSON.parse(await read('small-moons/jupiter.json'));
    expect(after.bodies.map((body: BodyDefinition) => body.id)).toEqual(SMALL);
    expect(after.bodies[1].color).toBe('#123456');
    expect(after.elements).toEqual(before.elements);
    expect(after.tables).toEqual(before.tables);
  });

  it('says what it would write on a dry run, and writes nothing', async () => {
    const bodies = await read('bodies.json');
    const report = await republishCatalog(dir, CATALOG, { dryRun: true });

    expect(report.written).toEqual(['bodies.json']);
    expect(await read('bodies.json')).toBe(bodies);
  });

  it('refuses a change only a fetch can answer, and writes nothing', async () => {
    // A finer step would mean tables sampled differently from the ones on disk.
    const bodies = await read('bodies.json');
    const catalog = CATALOG.map((body) => (body.id === 'earth' ? { ...body, stepDays: 0.5 } : body));

    await expect(republishCatalog(dir, catalog)).rejects.toThrow(/earth\.stepDays changed/);
    await expect(republishCatalog(dir, catalog)).rejects.toThrow(/pnpm fetch:data/);
    expect(await read('bodies.json')).toBe(bodies);
  });

  it("publishes a craft's new model, which no fetch depends on", async () => {
    // Hayabusa2 as it was fetched, still a box; the catalog now has its NASA's Eyes model.
    const craft = getBody('hayabusa2');
    const then = { ...craft, mission: { ...craft.mission!, shape: null } };
    await writeFile(join(dir, 'manifest.json'), pretty({ bodies: ['sun', 'hayabusa2'], tables: {}, smallMoons: { jupiter: { count: 3, sized: 3 } } }));
    await writeFile(join(dir, 'bodies.json'), pretty([getBody('sun'), then]));

    const report = await republishCatalog(dir, CATALOG);

    expect(report.changed).toEqual([{ id: 'hayabusa2', fields: ['mission'] }]);
    const written = JSON.parse(await read('bodies.json')) as BodyDefinition[];
    expect(written[1]!.mission!.shape).toEqual(craft.mission!.shape);
  });

  it("still refuses a change to a craft's window, which the fetch does depend on", async () => {
    const craft = getBody('hayabusa2');
    const then = { ...craft, mission: { ...craft.mission!, windowMonths: 3 } };
    await writeFile(join(dir, 'manifest.json'), pretty({ bodies: ['sun', 'hayabusa2'], tables: {}, smallMoons: { jupiter: { count: 3, sized: 3 } } }));
    await writeFile(join(dir, 'bodies.json'), pretty([getBody('sun'), then]));

    await expect(republishCatalog(dir, CATALOG)).rejects.toThrow(/hayabusa2\.mission changed/);
  });

  it('refuses a published body the catalog no longer has', async () => {
    const catalog = CATALOG.filter((body) => body.id !== SMALL[0]);

    await expect(republishCatalog(dir, catalog)).rejects.toThrow(
      new RegExp(`${SMALL[0]} is published but no longer in the catalog`),
    );
  });

  it('refuses a bodies.json that is not the manifest’s list', async () => {
    await writeFile(join(dir, 'bodies.json'), pretty([getBody('sun'), getBody('earth')]));

    await expect(republishCatalog(dir, CATALOG)).rejects.toThrow(/does not list the bodies/);
  });

  it('does not add a body the catalog gained since the run: it has no tables', async () => {
    const report = await republishCatalog(dir, CATALOG);
    const bodies = JSON.parse(await read('bodies.json')) as BodyDefinition[];

    expect(bodies).toHaveLength(STARTUP.length);
    expect(report.checked).toBe(STARTUP.length + SMALL.length);
  });
});
