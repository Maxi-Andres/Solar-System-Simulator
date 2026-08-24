import {
  HORIZONS_API_URL,
  MAX_RETRIES,
  REQUEST_TIMEOUT_MS,
  RETRY_BASE_DELAY_MS,
} from '../config.ts';

/**
 * Shape of a successful Horizons API response. `result` is the same plain-text
 * report the web interface shows; everything useful sits between $$SOE and $$EOE.
 */
export interface HorizonsResponse {
  readonly signature: {
    readonly source: string;
    readonly version: string;
  };
  readonly result: string;
}

/** Horizons parameter values must be single-quoted, e.g. COMMAND='399'. */
function quote(value: string): string {
  return `'${value}'`;
}

/** HTTP statuses worth retrying: rate limiting and transient server faults. */
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

function delay(ms: number): Promise<void> {
  return new Promise((done) => {
    setTimeout(done, ms);
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Calls the Horizons API once and returns the parsed envelope.
 *
 * Throws `RetryableError` for faults worth another attempt, and a plain Error for
 * anything permanent (a bad body id, a malformed query) so we fail fast instead of
 * hammering JPL over a mistake of ours.
 */
class RetryableError extends Error {}

async function callOnce(params: Readonly<Record<string, string>>): Promise<HorizonsResponse> {
  const url = new URL(HORIZONS_API_URL);
  // `format` is the one parameter Horizons wants unquoted.
  url.searchParams.set('format', 'json');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, quote(value));
  }

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });
  } catch (cause) {
    // Network failures and timeouts are always worth retrying.
    throw new RetryableError(`Request to Horizons failed: ${String(cause)}`);
  }

  if (RETRYABLE_STATUSES.has(response.status)) {
    throw new RetryableError(`Horizons returned HTTP ${response.status}`);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    // Horizons reports query errors in an `error` field alongside HTTP 400.
    const detail = isRecord(body) && typeof body['error'] === 'string' ? body['error'] : '';
    throw new Error(`Horizons rejected the query (HTTP ${response.status}). ${detail}`.trim());
  }

  if (!isRecord(body) || typeof body['result'] !== 'string') {
    throw new Error('Horizons response had no `result` field.');
  }

  const signature = body['signature'];
  return {
    signature: {
      source: isRecord(signature) && typeof signature['source'] === 'string' ? signature['source'] : 'unknown',
      version:
        isRecord(signature) && typeof signature['version'] === 'string' ? signature['version'] : 'unknown',
    },
    result: body['result'],
  };
}

/**
 * Calls the Horizons API with retries and exponential backoff.
 *
 * `label` only appears in error messages, to say which body failed.
 */
export async function callHorizons(
  params: Readonly<Record<string, string>>,
  label: string,
): Promise<HorizonsResponse> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await callOnce(params);
    } catch (error) {
      lastError = error;
      if (!(error instanceof RetryableError) || attempt === MAX_RETRIES) {
        break;
      }
      const wait = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `[horizons] ${label}: attempt ${attempt}/${MAX_RETRIES} failed (${error.message}). ` +
          `Retrying in ${wait} ms.`,
      );
      await delay(wait);
    }
  }

  throw new Error(
    `Horizons request for ${label} failed after ${MAX_RETRIES} attempts: ${String(lastError)}`,
  );
}
