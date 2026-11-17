import { describe, expect, it } from 'vitest';

import { catalogDesignations } from './belt/buildBelt.ts';
import { CATALOG, getBody } from './catalog.ts';
import { EARTH_COMPANIONS } from './earthCompanions.ts';

describe("Earth's companions", () => {
  it('are asteroids about the Sun, on JPL vectors to a kilometre over the whole window', () => {
    expect(EARTH_COMPANIONS.map((body) => body.id)).toEqual(['2025-pn7', '2024-pt5']);
    for (const body of EARTH_COMPANIONS) {
      expect(getBody(body.id)).toBe(body);
      expect(body.kind, body.id).toBe('asteroid');
      expect(body.parent, body.id).toBeNull();
      expect(body.drawOrbit, body.id).toBe(true);
      expect(body.sampling, body.id).toEqual({ toleranceKm: 1, windowMonths: null });
    }
  });

  it('claim no size: only their brightness is measured', () => {
    for (const body of EARTH_COMPANIONS) {
      expect(body.radiusPublished, body.id).toBe(false);
      expect(body.shapeDrawn, body.id).toBe(false);
    }
  });

  it('are asked for by provisional designation, and left out of the belt', () => {
    expect(getBody('2025-pn7').horizonsId).toBe('DES=2025 PN7;');
    expect(getBody('2024-pt5').horizonsId).toBe('DES=2024 PT5;');
    const excluded = catalogDesignations(CATALOG);
    expect(excluded).toContain('2025 PN7');
    expect(excluded).toContain('2024 PT5');
  });
});
