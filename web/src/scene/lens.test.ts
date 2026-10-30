import { describe, expect, it } from 'vitest';

import { IMAGE_SAMPLES } from '../core/schwarzschildLens.ts';
import { LENS_UNIFORMS, LENS_VERTEX_GLSL, lensImageTexture, lensUniforms } from './lens.ts';
import { STAR_VERTEX_SHADER } from './starRendering.ts';
import { STAR3D_VERTEX_SHADER } from './stars3dShader.ts';
import { CLUSTER_VERTEX_SHADER } from './NuclearCluster.tsx';

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

  it('moves the cluster’s stars by the finite-distance lens: f from the hole’s distance, the table scaled by sqrt(f)', () => {
    // sourceDistanceFactor and finiteSourceImage (schwarzschildLens.ts), line for line.
    expect(LENS_VERTEX_GLSL).toContain('float f = clamp(1.0 - along / max(len * len, 1e-30), 0.0, 1.0);');
    expect(LENS_VERTEX_GLSL).toContain('float scaled = min(');
    expect(LENS_VERTEX_GLSL).toContain('theta = y + root * v.x;');
    expect(LENS_VERTEX_GLSL).toContain('theta = max(root * v.x, uLensShadow * 1.0001);');
    // A star in front of the hole: drawn where it is, and no second image.
    expect(LENS_VERTEX_GLSL).toMatch(/if \(f <= 1e-6\) \{\s+return uLensImage < 0\.5;/);
    expect(CLUSTER_VERTEX_SHADER).toContain('lensStarAt(rel, ');
    expect(lensUniforms(0)['uLensHoleKm']).toBe(LENS_UNIFORMS.uLensHoleKm);
    expect(lensUniforms(1)['uLensShadow']).toBe(LENS_UNIFORMS.uLensShadow);
  });

  it('dims a demagnified cluster image by its light, not its magnitude', () => {
    expect(CLUSTER_VERTEX_SHADER).toContain('lightShare = exp2(-dm * ');
    expect(CLUSTER_VERTEX_SHADER).toContain('* uFade * lightShare;');
  });
});
