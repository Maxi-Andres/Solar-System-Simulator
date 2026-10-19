import { describe, expect, it } from 'vitest';

import { readStoredInteger, writeStoredInteger, type SettingStorage } from './persisted.ts';

/**
 * Per-viewer settings, and above all what happens when there is nowhere to keep them:
 * the app must carry on with the default, silently, whatever the storage does.
 */

function memoryStorage(): SettingStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

/** Storage as a browser with site data blocked has it: every touch throws. */
const BLOCKED: SettingStorage = {
  getItem: () => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  },
  setItem: () => {
    throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
  },
};

describe('readStoredInteger and writeStoredInteger', () => {
  it('keep a number between visits, under the app prefix', () => {
    const storage = memoryStorage();
    writeStoredInteger('belt-tiers', 3, storage);
    expect(storage.items.get('sss:belt-tiers')).toBe('3');
    expect(readStoredInteger('belt-tiers', 1, 1, storage)).toBe(3);
  });

  it('fall back to the default for nothing stored, or anything that is not a setting', () => {
    const storage = memoryStorage();
    expect(readStoredInteger('belt-tiers', 1, 1, storage)).toBe(1);
    for (const junk of ['', 'all', '2.5', '0', '-4', 'NaN']) {
      storage.items.set('sss:belt-tiers', junk);
      expect(readStoredInteger('belt-tiers', 1, 1, storage)).toBe(1);
    }
  });

  it('carry on with the default where the storage throws, and say nothing', () => {
    expect(readStoredInteger('belt-tiers', 1, 1, BLOCKED)).toBe(1);
    expect(() => writeStoredInteger('belt-tiers', 5, BLOCKED)).not.toThrow();
  });

  it('carry on where there is no storage at all', () => {
    // As in these tests, which run in Node, and as where touching localStorage throws.
    expect(readStoredInteger('belt-tiers', 2, 1, null)).toBe(2);
    expect(() => writeStoredInteger('belt-tiers', 5, null)).not.toThrow();
    expect(readStoredInteger('belt-tiers', 2, 1)).toBe(2);
  });
});
