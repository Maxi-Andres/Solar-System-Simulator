import * as THREE from 'three';

import { starColor } from './blackbody.ts';

/**
 * The disc of a star other than the Sun whose radius has been measured (D3b): Alpha
 * Centauri's three so far.
 *
 * ## Its colour is its blackbody's, at full brightness
 *
 * At the exposure this scene is set for -- sunlit Earth -- every star's surface is
 * overexposed: the Sun 45 times past full scale (solarGlare.ts), Alpha Centauri A 38
 * times, even Proxima, a thirtieth of the Sun's surface brightness, 1.3 times
 * (starDiscExposure). Run that through the renderer's filmic curve and every disc bleaches
 * toward the same yellow-white -- Proxima came out yellow. What survives an overexposure in
 * any picture is the hue, so the disc is drawn at its blackbody colour with its brightest
 * channel at full, the colour its point is drawn in from afar: A a warm white, B a
 * cream-orange, Proxima orange. Only a surface dimmer than the exposure (none here) would
 * be drawn darker, by its own exposure.
 *
 * ## Limb darkening
 *
 * A star's edge is darker than its middle: there the line of sight runs through the upper,
 * cooler photosphere. Linear in mu, the cosine of the angle from the disc's centre:
 * I(mu) / I(1) = 1 - u (1 - mu), with u = 0.6, the Sun's own in the visible (the classical
 * Eddington value, close to measured solar coefficients near 550 nm). For these three it
 * is the Sun's taken as theirs -- Kervella et al. 2017 measured A's and B's limb darkening in
 * the near infrared, where it is far weaker, not in the visible -- and said so here.
 */

export const LIMB_DARKENING_U = 0.6;

/** A star disc's display colour: blackbody chromaticity, brightest channel 1, dimmed only below exposure 1. */
export function starDiscColor(colorIndex: number, exposure: number): THREE.Color {
  const [r, g, b] = starColor(colorIndex);
  const peak = Math.max(r, g, b);
  const level = Math.min(1, exposure);
  return new THREE.Color((r / peak) * level, (g / peak) * level, (b / peak) * level);
}

/** An unlit material for a star's disc, limb-darkened, outside the filmic curve. */
export function starDiscMaterial(color: THREE.Color): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vDiscNormal;\nvarying vec3 vDiscView;',
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
  vDiscNormal = normalize(normalMatrix * normal);
  vDiscView = -(modelViewMatrix * vec4(position, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vDiscNormal;\nvarying vec3 vDiscView;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
  float discMu = clamp(dot(normalize(vDiscNormal), normalize(vDiscView)), 0.0, 1.0);
  diffuseColor.rgb *= 1.0 - ${LIMB_DARKENING_U.toFixed(2)} * (1.0 - discMu);`,
      );
  };
  return material;
}
