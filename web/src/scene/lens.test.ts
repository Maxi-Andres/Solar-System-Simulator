import { describe, expect, it } from 'vitest';

import { IMAGE_SAMPLES } from '../core/schwarzschildLens.ts';
import { LENS_UNIFORMS, LENS_VERTEX_GLSL, lensImageTexture, lensUniforms } from './lens.ts';
import { STAR_VERTEX_SHADER } from './starRendering.ts';
import { STAR3D_VERTEX_SHADER } from './stars3dShader.ts';

describe('the star shaders’ lens', () => {
  it('reads the image table as tableImage does: asinh-spaced, cell-centred, the near side less y', () => {
    expect(LENS_VERTEX_GLSL).toContain(
      '(asinh(y / uLensImageMap.x) + uLensImageMap.y) / (2.0 * uLensImageMap.y) * uLensImageMap.z - 0.5',
    );
    expect(LENS_VERTEX_GLSL).toContain('float theta = max(y, 0.0) + v.x;');
    expect(LENS_VERTEX_GLSL).toContain('dm = -2.5 * min(v.y, uLensMuCap);');
    expect(lensImageTexture.image.width).toBe(IMAGE_SAMPLES);
  });

  it('is in both star shaders, and each pass shares every uniform but which image it draws', () => {
    expect(STAR_VERTEX_SHADER).toContain('lensStar(direction, dm)');
    expect(STAR3D_VERTEX_SHADER).toContain('lensStar(rel, dm)');
    const primary = lensUniforms(0);
    const secondary = lensUniforms(1);
    expect(primary['uLensOn']).toBe(LENS_UNIFORMS.uLensOn);
    expect(secondary['uLensHole']).toBe(LENS_UNIFORMS.uLensHole);
    expect(primary['uLensImage']!.value).toBe(0);
    expect(secondary['uLensImage']!.value).toBe(1);
  });
});
