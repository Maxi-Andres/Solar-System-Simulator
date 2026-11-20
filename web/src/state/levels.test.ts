import { describe, expect, it } from 'vitest';

import { LIGHT_YEAR_KM } from '../scene/scale.ts';
import { levelForDistance, sunLadder } from './levels.ts';

const SUN_LADDER = sunLadder();

describe('the breadcrumb following the zoom', () => {
  it('names the level each crumb frames from its own framing distance', () => {
    for (const rung of SUN_LADDER) expect(levelForDistance(rung.level, rung.km)).toBe(rung.level);
    for (const rung of SUN_LADDER) expect(levelForDistance(null, rung.km)).toBe(rung.level);
  });

  it('is the Sun near it, the Milky Way from 180,000 light years, the universe from 36 billion', () => {
    expect(levelForDistance(null, 1e6)).toBeNull();
    expect(levelForDistance(null, 180_000 * LIGHT_YEAR_KM)).toBe('milky-way');
    expect(levelForDistance(null, 36e9 * LIGHT_YEAR_KM)).toBe('observable-universe');
  });

  it('keeps the current level just past a boundary, and changes it well past', () => {
    const [ss, nb] = [SUN_LADDER[1]!, SUN_LADDER[2]!];
    const boundary = Math.sqrt(ss.km * nb.km);
    expect(levelForDistance('solar-system', boundary * 1.1)).toBe('solar-system');
    expect(levelForDistance('solar-system', boundary * 1.5)).toBe('solar-neighbourhood');
    expect(levelForDistance('solar-neighbourhood', boundary / 1.1)).toBe('solar-neighbourhood');
    expect(levelForDistance('solar-neighbourhood', boundary / 1.5)).toBe('solar-system');
  });
});
