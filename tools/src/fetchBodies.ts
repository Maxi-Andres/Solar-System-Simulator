/**
 * Fetches a few bodies from Horizons into an existing data directory, without the full run:
 * `pnpm fetch:bodies [id ...]`.
 *
 *   pnpm fetch:bodies                  # every catalog body the directory does not publish yet
 *   pnpm fetch:bodies sedna dysnomia   # just these (a moon after its primary)
 *   pnpm fetch:bodies --dry-run        # say which, fetch nothing
 *
 * **Why it exists.** `pnpm fetch:data` is an hour and a half of Horizons and rewrites the whole
 * directory -- the stars, the belt, Laniakea -- so a body added to the catalog would otherwise
 * wait for it to be seen locally. The deploy always runs the full fetch; this is for working
 * on the app.
 *
 * **What it does.** Each body is fetched exactly as fetchData.ts fetches it (fetchAdaptiveBody
 * for the natural ones, fetchSpacecraft for a craft), each craft measured against the reference
 * bodies' tables already in the directory, and its tables, elements and path written beside
 * the others. bodies.json, manifest.json and the small-moon bundles get the new entries added;
 * nothing already there is changed. A body already published is fetched again only when
 * named, and then replaced.
 *
 * **What it does not.** The belt and the comet cloud are left as they are, so a body the
 * catalog now draws itself is drawn twice until the next full run takes it out of them. The
 * manifest's window is not recomputed: it is the planets', which this does not touch.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { CATALOG } from './catalog.ts';
import { OUTPUT_DIR } from './config.ts';
import {
  type BodyResult,
  fetchAdaptiveBody,
  fetchSpacecraft,
  isSmallMoon,
  referenceFrames,
  todayUtcMidnight,
  writeChunks,
  writePaths,
} from './fetchData.ts';
import type { BodyDefinition, BodyId, Manifest, OsculatingElements, SmallMoonBundle, VectorTable } from './types.ts';
import { ELEMENTS_FILE, writeCatalog, writeElements, writeManifest, writeSmallMoonBundle } from './writeOutput.ts';

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

async function readJsonOrNull<T>(path: string): Promise<T | null> {
  try {
    return await readJson<T>(path);
  } catch {
    return null;
  }
}

/** A published table, whole or from its chunks, as the full run wrote it. */
async function publishedTable(id: BodyId, manifest: Manifest): Promise<VectorTable | null> {
  const info = manifest.tables[id];
  if (info === undefined) return null;
  if (info.chunks === null) {
    return readJson<VectorTable>(join(OUTPUT_DIR, 'vectors', `${id}.json`));
  }
  const parts = await Promise.all(
    info.chunks.map((_, index) => readJson<VectorTable>(join(OUTPUT_DIR, 'vectors', id, `${index}.json`))),
  );
  const first = parts[0]!;
  // Neighbours share their boundary sample: kept once, or the joined table would hold two
  // samples at one instant, and an interval of zero length between them.
  const column = (key: 't' | 'x' | 'y' | 'z' | 'vx' | 'vy' | 'vz'): number[] =>
    parts.flatMap((part, index) => (index === 0 ? part[key] : part[key].slice(1)));
  return {
    id,
    horizonsId: first.horizonsId,
    center: first.center,
    count: parts.reduce((sum, part, index) => sum + part.count - (index === 0 ? 0 : 1), 0),
    t: column('t'),
    x: column('x'),
    y: column('y'),
    z: column('z'),
    vx: column('vx'),
    vy: column('vy'),
    vz: column('vz'),
  };
}

/**
 * The published elements, keyed by body: the one file (Manifest.elementsFile), or, in a
 * directory from before it, each startup body's own elements/<id>.json -- moved into the one
 * file when this writes it.
 */
async function publishedElements(
  manifest: Manifest,
  startup: readonly BodyDefinition[],
): Promise<Record<BodyId, OsculatingElements>> {
  if (manifest.elementsFile !== undefined) {
    return readJson<Record<BodyId, OsculatingElements>>(join(OUTPUT_DIR, manifest.elementsFile));
  }
  const entries = await Promise.all(
    startup.map(async (body) => [body.id, await readJsonOrNull<OsculatingElements>(join(OUTPUT_DIR, 'elements', `${body.id}.json`))] as const),
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [BodyId, OsculatingElements] => entry[1] !== null));
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    options: { 'dry-run': { type: 'boolean' } },
    allowPositionals: true,
  });
  const manifest = await readJson<Manifest>(join(OUTPUT_DIR, 'manifest.json'));
  const startup = await readJson<BodyDefinition[]>(join(OUTPUT_DIR, 'bodies.json'));

  const bundled = new Set<BodyId>();
  for (const planet of Object.keys(manifest.smallMoons ?? {})) {
    const bundle = await readJsonOrNull<SmallMoonBundle>(join(OUTPUT_DIR, 'small-moons', `${planet}.json`));
    for (const body of bundle?.bodies ?? []) bundled.add(body.id);
  }
  const published = new Set<BodyId>([...startup.map((body) => body.id), ...bundled]);

  const wanted =
    positionals.length > 0
      ? positionals.map((id) => {
          const body = CATALOG.find((candidate) => candidate.id === id);
          if (body === undefined) throw new Error(`No body '${id}' in the catalog.`);
          return body;
        })
      : CATALOG.filter((body) => !published.has(body.id) && body.vectorWindow !== 'surface');
  // The primaries first, so a moon finds its parent published.
  const ordered = [...wanted.filter((body) => !isSmallMoon(body)), ...wanted.filter(isSmallMoon)];
  console.log(`[fetch-bodies] ${ordered.length} bodies: ${ordered.map((body) => body.id).join(', ')}`);
  if (values['dry-run'] === true || ordered.length === 0) return;

  // The reference bodies, from the tables already here: what a craft's tolerance is measured
  // against, as in the full run.
  const references: BodyResult[] = [];
  for (const body of startup.filter((candidate) => candidate.vectorWindow === 'full')) {
    const table = await publishedTable(body.id, manifest);
    if (table === null) continue;
    references.push({ body, vectors: table, parts: [], elements: null, sourceVersion: '', discontinuities: [] });
  }
  const frames = referenceFrames(references);

  const epoch = todayUtcMidnight();
  const results: BodyResult[] = [];
  const failed: string[] = [];
  for (const body of ordered) {
    if (body.parent !== null && !published.has(body.parent) && !results.some((r) => r.body.id === body.parent)) {
      console.log(`[fetch-bodies] ${body.id}: its parent ${body.parent} is not published; skipped`);
      failed.push(body.id);
      continue;
    }
    try {
      const result =
        body.vectorWindow === 'mission' ? await fetchSpacecraft(body, epoch, frames) : await fetchAdaptiveBody(body, epoch);
      if (result === null) {
        failed.push(body.id);
      } else {
        results.push(result);
      }
    } catch (error) {
      console.error(`[fetch-bodies] ${body.id}: FAILED (${String(error).slice(0, 300)})`);
      failed.push(body.id);
    }
  }

  // Tables and elements.
  const tables: Record<BodyId, Manifest['tables'][string]> = { ...manifest.tables };
  const elements = await publishedElements(manifest, startup);
  for (const result of results) {
    tables[result.body.id] = await writeChunks(result.body, result.parts);
    if (result.elements !== null && !isSmallMoon(result.body)) {
      elements[result.body.id] = result.elements;
    }
  }
  await writeElements(elements);

  // The small moons into their primary's bundle.
  const smallMoons: Record<BodyId, NonNullable<Manifest['smallMoons']>[string]> = { ...(manifest.smallMoons ?? {}) };
  const moonResults = results.filter((result) => isSmallMoon(result.body));
  for (const parent of new Set(moonResults.map((result) => result.body.parent!))) {
    const path = join(OUTPUT_DIR, 'small-moons', `${parent}.json`);
    const bundle = (await readJsonOrNull<SmallMoonBundle>(path)) ?? { bodies: [], elements: {}, tables: {} };
    const mine = moonResults.filter((result) => result.body.parent === parent);
    const ids = new Set(mine.map((result) => result.body.id));
    const next: SmallMoonBundle = {
      bodies: [...bundle.bodies.filter((body) => !ids.has(body.id)), ...mine.map((result) => result.body)],
      elements: { ...bundle.elements, ...Object.fromEntries(mine.map((r) => [r.body.id, r.elements!])) },
      tables: { ...bundle.tables, ...Object.fromEntries(mine.map((r) => [r.body.id, tables[r.body.id]!])) },
    };
    await writeSmallMoonBundle(parent, next);
    smallMoons[parent] = {
      count: next.bodies.length,
      sized: next.bodies.filter((body) => body.radiusPublished !== false).length,
    };
    for (const id of ids) delete tables[id];
  }

  // The craft's paths.
  const paths = { ...manifest.paths, ...(await writePaths(results, frames)) };

  const added = results.filter((result) => !isSmallMoon(result.body)).map((result) => result.body);
  const addedIds = new Set(added.map((body) => body.id));
  const bodies = [...startup.filter((body) => !addedIds.has(body.id)), ...added];
  await writeCatalog(bodies);
  const next: Manifest = {
    ...manifest,
    bodies: bodies.map((body) => body.id),
    tables,
    paths,
    smallMoons,
    elementsFile: ELEMENTS_FILE,
  };
  await writeManifest(next);

  console.log(
    `[fetch-bodies] wrote ${results.length} of ${ordered.length}` +
      (failed.length > 0 ? `; left out ${failed.join(', ')}` : '') +
      ` in ${OUTPUT_DIR}. The belt still holds the far bodies until the next full run.`,
  );
}

await main();
