/**
 * Regenerates the Local Volume and the Virgo Cluster alone: `pnpm fetch:local-volume`.
 *
 *   pnpm fetch:local-volume                    # into web/public/data/
 *   pnpm fetch:local-volume --out <directory>  # anywhere else
 *
 * Four VizieR tables of a few hundred KB (the UNGC's catalogue and distances, the EVCC, Mei
 * et al.'s SBF distances), McConnachie's catalogue to leave out what local-group.json draws,
 * and some forty small HyperLEDA queries for the position angles. Writes local-volume.json
 * and touches nothing else. The full run (fetchData.ts) reads them through loadLocalVolume()
 * too, handing it the Local Group it has already read.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { EVCC_TABLE, HYPERLEDA_SQL_URLS, MEI_SBF_TABLE, OUTPUT_DIR, UNGC_CATALOG_TABLE, UNGC_DISTANCE_TABLE } from '../config.ts';
import { loadLocalGroup } from '../localGroup/fetchLocalGroup.ts';
import type { LocalGroupCatalog, LocalVolumeCatalog } from '../types.ts';
import { writeLocalVolume } from '../writeOutput.ts';
import { readVizierTable } from './asu.ts';
import { fetchLedaMatches } from './hyperleda.ts';
import {
  buildLocalVolume,
  describeLocalVolume,
  holmbergHalfLightRatio,
  ledaProbe,
  selectEvcc,
  selectUngc,
  withHolmbergHalfLight,
} from './localVolume.ts';

/** The catalogues, read, matched and built into local-volume.json's contents. */
export async function loadLocalVolume(localGroup?: Promise<LocalGroupCatalog>): Promise<LocalVolumeCatalog> {
  const queriedAt = new Date().toISOString();
  const [ungc, distances, evcc, mei, lg] = await Promise.all([
    readVizierTable(UNGC_CATALOG_TABLE, 'the Updated Nearby Galaxy Catalog', ['Name', 'RAJ2000', 'DEJ2000', 'a26', 'b/a', 'AB', 'Bmag', 'TT', 'Mcl', 'HRV', 'Dist', 'f_Dist', 'i', 'MHI', 'MD', 'Ti1'], 800),
    readVizierTable(UNGC_DISTANCE_TABLE, "the UNGC's distances", ['Name', 'DM', 'e_DM', 'n_DM'], 700),
    readVizierTable(EVCC_TABLE, 'the Extended Virgo Cluster Catalog', ['EVCC', 'VCC', 'NGC', 'RAJ2000', 'DEJ2000', 'cz', 'cz2', 'MmI', 'MTyp1', 'gmag', 'rmag', 'R50'], 1500),
    readVizierTable(MEI_SBF_TABLE, "Mei et al.'s SBF distances", ['VCC', 'm-M', 'e_m-M'], 80),
    localGroup ?? loadLocalGroup(),
  ]);
  const ungcSelection = selectUngc(ungc.rows, distances.rows, lg);
  const evccSelection = selectEvcc(evcc.rows, mei.rows, ungcSelection.galaxies, lg);
  const { ratio, scatterDex } = holmbergHalfLightRatio(evccSelection.calibrators);
  const ungcGalaxies = withHolmbergHalfLight(ungcSelection.galaxies, ratio);
  console.log(
    `[local-volume] UNGC: ${ungc.rows.length} galaxies, ${ungcSelection.inLocalGroup.length} already in McConnachie's catalogue, ` +
      `${ungcSelection.drawnByTheApp.length} drawn by the app (${ungcSelection.drawnByTheApp.join(', ')}), ` +
      `${ungcSelection.notGalaxies.length} not a galaxy (${ungcSelection.notGalaxies.join(', ')}); ${ungcSelection.galaxies.length} kept.`,
  );
  console.log(
    `[local-volume] EVCC: ${evcc.rows.length} galaxies, ${evccSelection.possibleMembers} possible members left out, ` +
      `${evccSelection.inUngc.length} already in the UNGC, ${evccSelection.inLocalGroup.length} in McConnachie's; ` +
      `${evccSelection.galaxies.length} certain members kept, ${evccSelection.sbf} with an SBF distance.`,
  );
  console.log(
    `[local-volume] UNGC half-light radii: ${ratio.toFixed(3)} of the Holmberg radius, the median over the ` +
      `${evccSelection.calibrators.length} galaxies the EVCC measures too, scatter ${scatterDex.toFixed(2)} dex.`,
  );
  const ledaQueriedAt = new Date().toISOString();
  const ledaUngc = await fetchLedaMatches(ungcGalaxies.map(ledaProbe));
  const ledaEvcc = ledaUngc === null ? null : await fetchLedaMatches(evccSelection.galaxies.map(ledaProbe));
  const sources: Record<string, { url: string; queriedAt: string }> = {
    ungc: { url: ungc.url, queriedAt },
    ungcDistances: { url: distances.url, queriedAt },
    evcc: { url: evcc.url, queriedAt },
    meiSbf: { url: mei.url, queriedAt },
  };
  if (ledaUngc !== null && ledaEvcc !== null) {
    sources['hyperleda'] = { url: HYPERLEDA_SQL_URLS[0]!, queriedAt: ledaQueriedAt };
  }
  return buildLocalVolume({ ungc: ungcGalaxies, evcc: evccSelection.galaxies, ledaUngc, ledaEvcc, sources });
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { out: { type: 'string' } } });
  const outputDir = values.out === undefined ? OUTPUT_DIR : resolve(values.out);
  const catalog = await loadLocalVolume();
  for (const line of describeLocalVolume(catalog)) {
    console.log(line);
  }
  await writeLocalVolume(catalog, outputDir);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
