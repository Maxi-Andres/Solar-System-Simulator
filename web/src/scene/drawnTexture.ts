import type { BodyDefinition, TextureSetId, TextureVariant } from '@sss/tools/types';

/**
 * Which of a body's two surface maps is drawn, decided body by body.
 *
 * The catalog carries two sets (TEXTURE_SETS in tools/src/catalog.ts) and they differ on three
 * bodies only. Each of the three was looked at on its own:
 *
 * - **Mars: the true-colour map.** Viking-derived, butterscotch where the illustrative one is
 *   orange-red. Its mean colour sits much nearer Mars's measured one: in linear light, red to
 *   green to blue 1 : 0.52 : 0.20 against the illustrative map's 1 : 0.23 : 0.11 and the
 *   1 : 0.66 : 0.33 that Mallama et al. 2017's band albedos give the whole disc (hazes, clouds
 *   and caps included, which a map of the ground does not hold). Its brightness is the disc's
 *   to 5%.
 * - **Neptune: the true-colour map**, which is the illustrative map's Voyager 2 clouds in
 *   Neptune's measured colour and brightness (web/public/textures/CREDITS.md). The illustrative
 *   one is the contrast-stretched deep blue and a quarter as bright as its albedo says.
 * - **Earth: the illustrative map.** Blue Marble's colour is calibrated, but the file paints
 *   shaded sea-floor relief into the oceans and holds December's snow all year; the
 *   illustrative map, drawn 30% less saturated (SolarSystem.tsx), has neither.
 *
 * So the sets are not switched whole: every other body's two maps are the same file anyway.
 */
export const TRUE_COLOUR_DRAWN: ReadonlySet<string> = new Set(['mars', 'neptune']);

/**
 * A per-channel gain on a body's map, in linear light, for the one body whose map the tone
 * curve visibly greys. **A display compensation, not a change to the measured colour**: the
 * file keeps Neptune's colour from its band albedos (web/public/textures/CREDITS.md).
 *
 * Why it is needed: three.js's ACES filmic curve mixes the channels before it compresses
 * them, so a bright lit disc comes out paler than its map. Neptune rendered at sRGB
 * (185, 205, 213) at 0.3-0.6 of the radius from the disc centre, fully lit, against
 * (176, 208, 224) at the same radii of Irwin et al. 2024's (MNRAS 527, 11521) true-colour
 * disc. These gains are solved so that ACES of the gained map colour gives Irwin's
 * chromaticity there, with the map's linear luminance (0.2126 R + 0.7152 G + 0.0722 B)
 * unchanged, so its brightness is still the one its albedo gives. Rendered after: (171,
 * 205, 219). Its white clouds take the same gain.
 *
 * Uranus has none: it renders in Irwin's hue already, linear R : G : B 0.74 : 0.98 : 1 at
 * mid-disc against their 0.77 : 0.99 : 1 -- not paler, only darker than their figure.
 */
export const MAP_COLOUR_GAIN: Readonly<Record<string, readonly [number, number, number]>> = {
  neptune: [0.76, 1.02, 1.21],
};

/** The colour a body's material multiplies its map by: white unless compensated above. */
export function mapColourGain(body: Pick<BodyDefinition, 'id'>): readonly [number, number, number] {
  return MAP_COLOUR_GAIN[body.id] ?? [1, 1, 1];
}

/** The set a body's map is drawn from. */
export function drawnTextureSet(body: Pick<BodyDefinition, 'id'>): TextureSetId {
  return TRUE_COLOUR_DRAWN.has(body.id) ? 'photometric' : 'illustrative';
}

/** The map drawn on a body, or null for one in flat colour. */
export function drawnTexture(body: Pick<BodyDefinition, 'id' | 'textures'>): TextureVariant | null {
  return body.textures?.[drawnTextureSet(body)] ?? null;
}
