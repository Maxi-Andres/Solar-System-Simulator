import { gunzipSync } from 'node:zlib';

import { BSC_CATALOG_URL, MAX_RETRIES, REQUEST_TIMEOUT_MS } from '../config.ts';
import { retryDelayMs } from '../horizons/client.ts';
import { parseBscName, type Designation } from './designations.ts';

/**
 * The Yale Bright Star Catalogue (5th revised ed., Hoffleit & Warren 1991; CDS V/50), read
 * for the one thing no other source here has: Bayer and Flamsteed designations. Every
 * naked-eye star is in it: 9,110 entries, 9,096 with an HD number, and 3,143 of those
 * with a Greek-letter or Flamsteed designation (Latin-letter Bayer names such as "p Eri"
 * are not parsed).
 *
 * Joined to the stars by Henry Draper number, which both it and Hipparcos give.
 */

export interface BscStar {
  readonly hr: number;
  readonly hd: number;
  readonly designation: Designation | null;
  readonly spectralType: string | null;
  /** The catalogue's double/multiple code, byte 44 (A, W, D, I, R, S), or null. */
  readonly multiple: string | null;
}

/** Parses the fixed-width catalogue file, as CDS publishes it (ReadMe of V/50). */
export function parseBsc(text: string): BscStar[] {
  const stars: BscStar[] = [];
  for (const line of text.split('\n')) {
    if (line.length < 31) {
      continue;
    }
    const hr = Number(line.slice(0, 4));
    const hd = Number(line.slice(25, 31));
    if (!Number.isInteger(hr) || hr <= 0 || !Number.isInteger(hd) || hd <= 0) {
      // A handful of entries are novae and non-stellar objects with no HD number.
      continue;
    }
    const spectralType = line.slice(127, 147).trim();
    const multiple = line.slice(43, 44).trim();
    stars.push({
      hr,
      hd,
      designation: parseBscName(line.slice(4, 14)),
      spectralType: spectralType === '' ? null : spectralType,
      multiple: multiple === '' ? null : multiple,
    });
  }
  return stars;
}

function delay(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

/**
 * Downloads and parses the catalogue, or returns null -- the index then simply has no
 * Bayer and Flamsteed names beyond the IAU list's. Logged, never fatal.
 */
export async function fetchBsc(): Promise<BscStar[] | null> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const response = await fetch(BSC_CATALOG_URL, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = gunzipSync(Buffer.from(await response.arrayBuffer())).toString('latin1');
      const stars = parseBsc(text);
      if (stars.length < 9000) {
        throw new Error(`only ${stars.length} entries parsed; the format is not the one expected`);
      }
      return stars;
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES) {
        await delay(retryDelayMs(attempt, null));
      }
    }
  }
  console.error(`[stars] Bright Star Catalogue: FAILED, no Bayer/Flamsteed names (${String(lastError)})`);
  return null;
}
