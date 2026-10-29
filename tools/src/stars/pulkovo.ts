import { gunzipSync } from 'node:zlib';

import { PULKOVO_RV_URLS, REQUEST_TIMEOUT_MS } from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';

/**
 * The Pulkovo Compilation of Radial Velocities (Gontcharov 2006, Astron. Lett. 32, 759;
 * CDS III/252): weighted mean radial velocities for 35,493 Hipparcos stars from 203
 * publications, brought onto one zero point -- median accuracy 0.7 km/s.
 *
 * For the stars Gaia DR3 gave no radial velocity: the brightest, which its spectrometer
 * saturates on -- Tau Ceti, Epsilon Eridani, Sirius, Vega -- and the many it did not reach.
 * Without one a star moves across the sky only (build3d.ts); with one, in three dimensions.
 * Gaia's own is kept wherever it has one: Pulkovo fills the gaps, flagged as such
 * (STAR3D_FLAGS.LITERATURE_RADIAL_VELOCITY).
 */

export interface PulkovoRow {
  readonly hip: number;
  /** Mean radial velocity, km/s, positive receding. */
  readonly rvKmS: number;
  /** Its mean error, km/s. */
  readonly rvErrorKmS: number;
}

/** Parses table8.dat, fixed-width, by the byte positions of the catalogue's ReadMe. */
export function parsePulkovo(text: string): PulkovoRow[] {
  const rows: PulkovoRow[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 24) {
      continue;
    }
    // Bytes 1-6 HIP, 14-20 RV (F7.1), 22-24 e_RV (F3.1).
    const hip = Number(line.slice(0, 6));
    const rvText = line.slice(13, 20).trim();
    const errorText = line.slice(21, 24).trim();
    const rvKmS = Number(rvText);
    const rvErrorKmS = Number(errorText);
    if (!Number.isInteger(hip) || hip <= 0 || rvText === '' || !Number.isFinite(rvKmS)) {
      continue;
    }
    rows.push({ hip, rvKmS, rvErrorKmS: errorText === '' || !Number.isFinite(rvErrorKmS) ? Number.NaN : rvErrorKmS });
  }
  return rows;
}

/**
 * Tries per address before the next: two, not MAX_RETRIES' six -- the file is optional,
 * and six 90-second timeouts on a Strasbourg that is down would hold the build nine
 * minutes before the mirror is asked.
 */
const ATTEMPTS_PER_URL = 2;

function delay(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

/**
 * Downloads and parses the compilation from CDS's archive, or its mirror at the CfA when
 * Strasbourg does not answer; or returns null, and the stars Gaia gave no radial velocity
 * keep moving across the sky only. Logged, never fatal.
 */
export async function fetchPulkovo(): Promise<{ rows: PulkovoRow[]; url: string } | null> {
  let lastError: unknown;
  for (const url of PULKOVO_RV_URLS) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_URL; attempt += 1) {
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const rows = parsePulkovo(gunzipSync(Buffer.from(await response.arrayBuffer())).toString('latin1'));
        if (rows.length < 35_000) {
          throw new Error(`only ${rows.length} rows parsed; the format is not the one expected`);
        }
        return { rows, url };
      } catch (error) {
        lastError = error;
        if (attempt < ATTEMPTS_PER_URL) {
          await delay(retryDelayMs(attempt, null));
        }
      }
    }
  }
  console.warn(`[stars] Pulkovo radial velocities: FAILED, Gaia's only (${String(lastError).slice(0, 300)})`);
  return null;
}
