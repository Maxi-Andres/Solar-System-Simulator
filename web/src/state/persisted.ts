/**
 * Settings kept for one viewer between visits, in the browser's localStorage.
 *
 * Only conveniences go here -- what is lost when the storage is not there costs a click,
 * never data. And it can be missing: with site data blocked, merely reading
 * `localStorage` throws a SecurityError, and older Safari private windows threw on every
 * write. So every read and write is wrapped, and a failure is the default value, said
 * nowhere: a setting that does not stick is not worth a console line on every visit.
 */

/** The parts of `Storage` used here, so a test can hand in one that fails. */
export type SettingStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The browser's localStorage, or null where touching it throws. */
function defaultStorage(): SettingStorage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

/** Every key this app writes starts with this, so its settings are easy to find and clear. */
const PREFIX = 'sss:';

/**
 * A stored whole number from `minimum` up, or `fallback` when there is none, it is not
 * one, or the storage cannot be read.
 */
export function readStoredInteger(
  key: string,
  fallback: number,
  minimum: number,
  storage: SettingStorage | null = defaultStorage(),
): number {
  try {
    const raw = storage?.getItem(PREFIX + key) ?? null;
    const value = raw === null ? Number.NaN : Number(raw);
    return Number.isInteger(value) && value >= minimum ? value : fallback;
  } catch {
    return fallback;
  }
}

/** Stores a number; does nothing where the storage cannot be written. */
export function writeStoredInteger(
  key: string,
  value: number,
  storage: SettingStorage | null = defaultStorage(),
): void {
  try {
    storage?.setItem(PREFIX + key, String(value));
  } catch {
    // Full, or forbidden: the setting lasts this visit instead.
  }
}
