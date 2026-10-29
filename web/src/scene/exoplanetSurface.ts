import * as THREE from 'three';

/**
 * A planet of another star, drawn as a sphere of its estimated radius (exoplanets.ts):
 * lit by its own star rather than by the scene's one light, the Sun, which from Tau Ceti
 * is a star twelve light years away and would light the wrong side.
 *
 * Lambert from the star's direction -- `userData.starDirection`, a world-space unit vector
 * SolarSystem sets every frame from the planet to its star -- with the day side at the
 * body's colour and the night side black, under Natural lighting. Flood and Shadow lift
 * the night side by the share of ambient light they give the Solar System's planets
 * (`userData.ambient`, from shading.ts LIGHTING), so a planet seen from its night side is
 * not lost against the sky there either. The colour itself is a convention (grey unless
 * confirmed, exoplanets.ts): nothing about these planets' surfaces is known, and how
 * bright the day side is drawn is legibility, not the star's flux at that distance.
 */
export function exoplanetMaterial(color: string): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color });
  const starDirection = new THREE.Vector3(1, 0, 0);
  const ambient = { value: 0 };
  material.userData['starDirection'] = starDirection;
  material.userData['ambient'] = ambient;
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uStarDirection'] = { value: starDirection };
    shader.uniforms['uAmbient'] = ambient;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorldNormal;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n  vWorldNormal = normalize(mat3(modelMatrix) * normal);',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWorldNormal;\nuniform vec3 uStarDirection;\nuniform float uAmbient;',
      )
      .replace(
        '#include <color_fragment>',
        '#include <color_fragment>\n  diffuseColor.rgb *= uAmbient + (1.0 - uAmbient) * max(dot(normalize(vWorldNormal), uStarDirection), 0.0);',
      );
  };
  return material;
}

/** The share of a lit planet's light that is ambient in a lighting mode, from LIGHTING. */
export function ambientShare(light: { readonly sun: number; readonly ambient: number }): number {
  return light.ambient / (light.sun + light.ambient);
}
