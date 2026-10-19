import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import type { BodyDefinition, Manifest, SmallMoonBundle } from './types.ts';

/**
 * Rewrites the body definitions an existing data directory publishes from the catalog as
 * it stands now, and nothing else: `pnpm write:catalog`.
 *
 * **Why it exists.** bodies.json is written by `pnpm fetch:data`, which spends an hour and
 * a half on Horizons. A change that is only to the catalog -- a surface map added, a
 * radius corrected, a colour -- would otherwise wait for the next full run to reach the
 * app, because the app reads its definitions from bodies.json and not from the source.
 * This takes a second.
 *
 * **What it touches.** bodies.json, and the `bodies` array of each small-moon bundle,
 * which carries the same definitions for the moons that ship outside the startup files.
 * Each body is replaced by the catalog's entry of the same id, in the order the file
 * already has. The vectors, the elements, the manifest, the paths, the belt and the
 * stars are left as they are, and so is every other key of a bundle. A file whose
 * content would not change is not written at all.
 *
 * **What it refuses.** Anything a fetch would have to redo. A body is published because
 * its tables are there, so a definition whose sampling, centre, window or Horizons id has
 * changed would describe tables this directory does not have -- and an id the manifest
 * lists that the catalog no longer has, or a published body missing from bodies.json,
 * means the directory and the catalog have drifted apart. All of these stop it before it
 * writes anything, and say to run `pnpm fetch:data`. Bodies added to the catalog since
 * the run are not added: they have no tables yet.
 */

/**
 * The fields a fetch is made from. Each one decides what was requested from Horizons, or
 * which frame the tables are in, so a definition that differs in any of them no longer
 * describes the tables beside it. `mission` is here for its window and its end, which
 * decide how far a craft's table runs.
 */
export const FETCH_FIELDS = [
  'horizonsId',
  'center',
  'elementsCenter',
  'parent',
  'kind',
  'stepDays',
  'vectorWindow',
  'sampling',
  'mission',
] as const satisfies readonly (keyof BodyDefinition)[];

/** One body whose definition changed, and which of its top-level fields did. */
export interface ChangedBody {
  readonly id: string;
  readonly fields: readonly string[];
}

export interface RepublishReport {
  /** Files rewritten, relative to the data directory. */
  readonly written: readonly string[];
  /** Every body whose definition changed, in any file. */
  readonly changed: readonly ChangedBody[];
  /** Bodies looked at, across bodies.json and the bundles. */
  readonly checked: number;
}

/** The serialisations fetch:data writes these files with: see writeOutput.ts. */
const pretty = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const compact = (value: unknown) => `${JSON.stringify(value)}\n`;

/** JSON-equal: what the file would say, which is the only equality that matters here. */
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

class Drift extends Error {
  constructor(problems: readonly string[]) {
    super(
      `The catalog and this data directory have drifted apart; run pnpm fetch:data.\n` +
        problems.map((problem) => `  - ${problem}`).join('\n'),
    );
  }
}

/**
 * The catalog's entries for a published list of bodies, with what changed in each.
 * Problems are collected rather than thrown, so one run reports all of them.
 */
function replace(
  published: readonly BodyDefinition[],
  catalog: ReadonlyMap<string, BodyDefinition>,
  where: string,
  problems: string[],
): { bodies: BodyDefinition[]; changed: ChangedBody[] } {
  const bodies: BodyDefinition[] = [];
  const changed: ChangedBody[] = [];
  for (const old of published) {
    const current = catalog.get(old.id);
    if (current === undefined) {
      problems.push(`${where}: ${old.id} is published but no longer in the catalog`);
      continue;
    }
    for (const field of FETCH_FIELDS) {
      if (!same(old[field], current[field])) {
        problems.push(`${where}: ${old.id}.${field} changed, and its tables were fetched with the old one`);
      }
    }
    const keys = [...new Set([...Object.keys(old), ...Object.keys(current)])];
    const fields = keys.filter(
      (key) =>
        !same(
          (old as unknown as Record<string, unknown>)[key],
          (current as unknown as Record<string, unknown>)[key],
        ),
    );
    if (fields.length > 0) {
      changed.push({ id: old.id, fields });
    }
    bodies.push(current);
  }
  return { bodies, changed };
}

export async function republishCatalog(
  dataDir: string,
  catalog: readonly BodyDefinition[],
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<RepublishReport> {
  const byId = new Map(catalog.map((body) => [body.id, body]));
  const manifest = JSON.parse(await readFile(join(dataDir, 'manifest.json'), 'utf8')) as Manifest;
  const startup = JSON.parse(
    await readFile(join(dataDir, 'bodies.json'), 'utf8'),
  ) as BodyDefinition[];

  const problems: string[] = [];
  // The manifest is the authority on what this directory publishes: bodies.json must
  // carry exactly its list, or one of the two is from a different run.
  if (!same(startup.map((body) => body.id), manifest.bodies)) {
    problems.push('bodies.json does not list the bodies manifest.json does');
  }
  const files: { path: string; before: string; after: string }[] = [];
  const changed: ChangedBody[] = [];
  let checked = 0;

  const top = replace(startup, byId, 'bodies.json', problems);
  files.push({ path: 'bodies.json', before: pretty(startup), after: pretty(top.bodies) });
  changed.push(...top.changed);
  checked += startup.length;

  // Every bundle on disk, not only the ones the manifest counts: one it does not count
  // would be a stale file, and is reported rather than skipped.
  const bundleDir = join(dataDir, 'small-moons');
  const bundleFiles = (await readdir(bundleDir).catch(() => [] as string[]))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const counted = Object.keys(manifest.smallMoons ?? {}).sort();
  if (!same(bundleFiles.map((name) => name.slice(0, -'.json'.length)), counted)) {
    problems.push(`small-moons/ holds ${bundleFiles.join(', ') || 'nothing'}, the manifest counts ${counted.join(', ') || 'none'}`);
  }
  for (const name of bundleFiles) {
    const path = join('small-moons', name);
    const bundle = JSON.parse(await readFile(join(dataDir, path), 'utf8')) as SmallMoonBundle;
    const result = replace(bundle.bodies, byId, path, problems);
    files.push({
      path,
      before: compact(bundle),
      after: compact({ ...bundle, bodies: result.bodies }),
    });
    changed.push(...result.changed);
    checked += bundle.bodies.length;
  }

  if (problems.length > 0) {
    throw new Drift(problems);
  }

  const written: string[] = [];
  for (const file of files) {
    if (file.before === file.after) {
      continue;
    }
    if (!dryRun) {
      await writeFile(join(dataDir, file.path), file.after, 'utf8');
    }
    written.push(file.path.replaceAll('\\', '/'));
  }
  return { written, changed, checked };
}
