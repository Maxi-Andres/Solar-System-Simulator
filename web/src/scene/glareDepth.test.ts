import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { SCENE_LOG_DEPTH_GLSL } from './logDepth.ts';
import { SOLAR_GLARE_VERTEX_SHADER } from './solarGlare.ts';
import { kmToUnits } from './scale.ts';

/** The two constants a log-depth formula is made of: w's scale and the inverse range. */
function constants(scaleSource: string, rangeSource: string): [number, number] {
  return [Number(scaleSource), Number(rangeSource)];
}

const glare = constants(
  /w \* ([-+.\de]+)\)/.exec(SCENE_LOG_DEPTH_GLSL)![1]!,
  /\) \* ([-+.\de]+);/.exec(SCENE_LOG_DEPTH_GLSL)![1]!,
);
const bodies = constants(
  /gl_Position\.w \* ([-+.\de]+);/.exec(THREE.ShaderChunk.logdepthbuf_vertex)![1]!,
  /log2\( vFragDepth \) \* ([-+.\de]+);/.exec(THREE.ShaderChunk.logdepthbuf_fragment)![1]!,
);

/** The depth a body's fragment writes at `w` scene units, as the chunks compute it. */
const bodyDepth = (w: number) => Math.log2(1 + w * bodies[0]) * bodies[1];
/** The glare's, at the depth it places itself (solarGlare.ts). */
const glareDepth = (w: number) => Math.min(Math.log2(1 + w * glare[0]) * glare[1], 1);

describe('the star glare against the bodies in front of its star', () => {
  it("places its depth by the scene's own formula, not three's", () => {
    // three's logDepthBufFC measures from one scene unit and this scene from the near plane
    // (logDepth.ts): a depth from it sat in front of every body, and a star's veil showed
    // through a planet in front of it.
    expect(glare).toEqual(bodies);
    expect(SOLAR_GLARE_VERTEX_SHADER).toContain('sceneLogDepth(front)');
    expect(SOLAR_GLARE_VERTEX_SHADER).not.toContain('logDepthBufFC');
  });

  it("is hidden by a planet in front of its star, and lies over the star's own disc", () => {
    // Adrian, about 0.1 AU from tau Ceti, seen from its night side at 20,000 km.
    const star = kmToUnits(0.105 * 1.496e8 + 20_000);
    const starRadius = kmToUnits(0.79 * 695_700);
    const front = star - 1.02 * starRadius;
    expect(bodyDepth(kmToUnits(20_000))).toBeLessThan(glareDepth(front));
    // A ship a few hundred metres off, and Earth in front of the Sun from beyond it.
    expect(bodyDepth(kmToUnits(0.3))).toBeLessThan(glareDepth(front));
    const sunFront = kmToUnits(1.496e8 + 1e6) - 1.02 * kmToUnits(695_700);
    expect(bodyDepth(kmToUnits(1e6))).toBeLessThan(glareDepth(sunFront));
    // The disc's nearest point is behind the veil, so the veil still lies over it.
    expect(glareDepth(front)).toBeLessThan(bodyDepth(star - starRadius));
  });
});
