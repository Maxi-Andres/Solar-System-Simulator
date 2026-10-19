/**
 * Publishes catalog changes into an existing data directory without a fetch:
 * `pnpm write:catalog`. See republishCatalog.ts for what it touches and what it refuses.
 *
 *   pnpm write:catalog                     # into web/public/data/
 *   pnpm write:catalog --out <directory>   # anywhere else
 *   pnpm write:catalog --dry-run           # say what would change, write nothing
 */

import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { CATALOG } from './catalog.ts';
import { OUTPUT_DIR } from './config.ts';
import { republishCatalog } from './republishCatalog.ts';

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { out: { type: 'string' }, 'dry-run': { type: 'boolean' } },
  });
  const dataDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const dryRun = values['dry-run'] === true;

  const report = await republishCatalog(dataDir, CATALOG, { dryRun });

  for (const body of report.changed) {
    console.log(`[catalog] ${body.id}: ${body.fields.join(', ')}`);
  }
  console.log(
    `[catalog] ${report.checked} bodies checked, ${report.changed.length} changed; ` +
      (report.written.length === 0
        ? 'nothing to write'
        : `${dryRun ? 'would write' : 'wrote'} ${report.written.join(', ')}`) +
      ` in ${dataDir}`,
  );
}

await main();
